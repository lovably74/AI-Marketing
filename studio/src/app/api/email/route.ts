// POST /api/email — 고객에게 홍보 PDF를 첨부해 SMTP로 실제 발송 (FR-MAIL)
// GET  /api/email — SMTP 설정 여부만 반환(값은 노출하지 않음)
// 런타임: Node.js(기본값). Cache Components가 켜져 있어 `runtime` 내보내기는 생략한다.
import nodemailer from "nodemailer";
import { z } from "zod";
import { AppError, errorResponse } from "@/lib/ai/errors";
import type { EmailSuccess } from "@/lib/deliver-types";
import { MAX_EMAIL_BODY_LENGTH, MAX_EMAIL_PDF_BYTES, MAX_EMAIL_SUBJECT_LENGTH } from "@/lib/mail/compose";
import { getSmtpConfig, isSmtpConfigured } from "@/lib/mail/config";
import { logEmail, safeDb, saveRecipient } from "@/lib/db";

export const maxDuration = 60;

/** base64(4/3배) + JSON 필드 여유분 */
const MAX_REQUEST_BYTES = Math.ceil((MAX_EMAIL_PDF_BYTES * 4) / 3) + 64 * 1024;

const noNewline = (label: string) =>
  z.string().refine((s) => !/[\r\n\u0000-\u001f\u007f]/.test(s), `${label}에 줄바꿈이나 제어문자를 넣을 수 없습니다.`);

const field = (label: string, max: number) => noNewline(label).pipe(z.string().trim().max(max, `${label}은(는) ${max}자 이하로 입력해 주세요.`));

const EmailRequestSchema = z.object({
  recipient: z.object({
    name: field("이름", 50),
    company: field("회사명", 100),
    title: field("직함", 50),
    department: field("부서명", 100),
    // 수신자는 1명만: 쉼표·세미콜론·공백 등은 z.email()에서 거부된다
    email: noNewline("이메일").pipe(z.string().trim().max(254).pipe(z.email("이메일 형식이 올바르지 않습니다."))),
    phone: field("연락처", 30),
  }),
  subject: noNewline("제목").pipe(
    z.string().trim().min(1, "제목을 입력해 주세요.").max(MAX_EMAIL_SUBJECT_LENGTH, `제목은 ${MAX_EMAIL_SUBJECT_LENGTH}자 이하로 입력해 주세요.`),
  ),
  body: z.string().trim().min(1, "본문을 입력해 주세요.").max(MAX_EMAIL_BODY_LENGTH, `본문은 ${MAX_EMAIL_BODY_LENGTH}자 이하로 입력해 주세요.`),
  pdfBase64: z.string().min(1, "PDF 첨부가 없습니다.").regex(/^[A-Za-z0-9+/]+={0,2}$/, "PDF 데이터(base64) 형식이 올바르지 않습니다."),
  pdfFilename: noNewline("파일명").pipe(z.string().trim().min(1).max(120)),
  generationId: z.string().uuid().optional(),
});

// ── 간단한 메모리 속도 제한(남용 방지용, 단일 프로세스 기준) ──
const PER_IP_LIMIT = 3;
const PER_IP_WINDOW_MS = 60_000;
const GLOBAL_LIMIT = 30;
const GLOBAL_WINDOW_MS = 3_600_000;
const ipHits = new Map<string, number[]>();
let globalHits: number[] = [];

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function checkRateLimit(ip: string): void {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < GLOBAL_WINDOW_MS);
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < PER_IP_WINDOW_MS);
  if (hits.length >= PER_IP_LIMIT) {
    ipHits.set(ip, hits);
    throw new AppError("RATE_LIMITED", "발송 요청이 너무 잦습니다. 1분 후 다시 시도해 주세요.");
  }
  if (globalHits.length >= GLOBAL_LIMIT) {
    throw new AppError("RATE_LIMITED", "시간당 발송 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
  }
  hits.push(now);
  ipHits.set(ip, hits);
  globalHits.push(now);
  // 메모리 누수 방지: 오래된 IP 항목 정리
  if (ipHits.size > 1000) {
    for (const [k, v] of ipHits) if (v.every((t) => now - t >= PER_IP_WINDOW_MS)) ipHits.delete(k);
  }
}

/** 로그용: 수신자 개인정보 대신 마스킹한 도메인만 */
function maskedDomain(email: string): string {
  const domain = email.split("@")[1] ?? "";
  return domain ? `***@${domain}` : "***";
}

/** 첨부 파일명 정리(경로·제어문자 제거, .pdf 보장) */
function safeFilename(name: string): string {
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, "_").trim() || "tlink-promo";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

export async function GET(): Promise<Response> {
  return Response.json({ ok: true, configured: isSmtpConfigured() });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const config = getSmtpConfig(); // 미설정이면 503 SMTP_NOT_CONFIGURED

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      throw new AppError("INVALID_INPUT", "요청 크기가 너무 큽니다. PDF는 최대 15MB까지 첨부할 수 있습니다.");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new AppError("INVALID_INPUT", "요청 본문(JSON)을 읽을 수 없습니다.");
    }

    const parsed = EmailRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => i.message);
      throw new AppError("INVALID_INPUT", "입력값을 확인해 주세요.", details);
    }
    const input = parsed.data;

    if (input.pdfBase64.length > Math.ceil((MAX_EMAIL_PDF_BYTES * 4) / 3) + 4) {
      throw new AppError("INVALID_INPUT", "PDF는 최대 15MB까지 첨부할 수 있습니다.");
    }
    const pdf = Buffer.from(input.pdfBase64, "base64");
    if (pdf.length > MAX_EMAIL_PDF_BYTES) {
      throw new AppError("INVALID_INPUT", "PDF는 최대 15MB까지 첨부할 수 있습니다.");
    }
    if (pdf.length < 5 || pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new AppError("INVALID_INPUT", "첨부 파일이 PDF 형식이 아닙니다.");
    }

    // 실제 발송 시도만 속도 제한에 집계한다
    checkRateLimit(clientIp(request));

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });

    const to = input.recipient.email;
    // DB: 수신 고객 저장(이메일 기준 upsert). 실패해도 발송은 계속한다.
    const recipientId = await safeDb("수신자 저장", () => saveRecipient(input.recipient));
    const logBase = {
      generationId: input.generationId ?? null,
      recipientId,
      subject: input.subject,
      body: input.body,
    };
    try {
      const info = await transporter.sendMail({
        from: config.from,
        to,
        subject: input.subject,
        text: input.body,
        attachments: [{ filename: safeFilename(input.pdfFilename), content: pdf, contentType: "application/pdf" }],
      });
      const accepted = ((info.accepted ?? []) as unknown[]).map((a) =>
        typeof a === "string" ? a : String((a as { address?: string })?.address ?? ""),
      );
      if (!accepted.some((a) => a.toLowerCase() === to.toLowerCase())) {
        console.error("[EMAIL_SEND_FAILED] 수신 서버가 수신자를 거부함", maskedDomain(to));
        await safeDb("발송 이력", () => logEmail({ ...logBase, status: "failed", errorCode: "RECIPIENT_REJECTED" }));
        throw new AppError("EMAIL_SEND_FAILED", "메일 서버가 수신자 주소를 받아들이지 않았습니다. 주소를 확인해 주세요.");
      }
      console.info("[email] 발송 성공", maskedDomain(to));
      await safeDb("발송 이력", () => logEmail({ ...logBase, status: "sent", messageId: info.messageId }));
      const body: EmailSuccess = { ok: true, messageId: info.messageId, acceptedTo: to };
      return Response.json(body);
    } catch (err) {
      if (err instanceof AppError) throw err;
      // SMTP 원문 오류는 서버 로그에만(자격증명은 포함하지 않음)
      const e = err as { code?: string; responseCode?: number; command?: string; message?: string };
      console.error("[EMAIL_SEND_FAILED]", maskedDomain(to), {
        code: e.code,
        responseCode: e.responseCode,
        command: e.command,
        message: (e.message ?? "").replaceAll(config.pass, "***").replaceAll(config.user, "***").slice(0, 300),
      });
      await safeDb("발송 이력", () =>
        logEmail({ ...logBase, status: "failed", errorCode: e.code ?? String(e.responseCode ?? "SMTP_ERROR") }),
      );
      throw new AppError("EMAIL_SEND_FAILED", "메일 발송에 실패했습니다. SMTP 설정이나 수신 주소를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      transporter.close();
    }
  } catch (err) {
    return errorResponse(err);
  }
}
