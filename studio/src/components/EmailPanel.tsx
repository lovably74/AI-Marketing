"use client";

import { CheckCircle2, Loader2, Mail, RotateCcw, Send, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ApiErrorBody, GenerateSuccess } from "@/lib/api-types";
import type { EmailRequest, EmailSuccess, RecipientInfo } from "@/lib/deliver-types";
import {
  MAX_EMAIL_BODY_LENGTH,
  MAX_EMAIL_SUBJECT_LENGTH,
  composeBody,
  composeSubject,
  isValidEmail,
} from "@/lib/mail/compose";

type Phase =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "sending"; step: string }
  | { kind: "success"; messageId: string; to: string }
  | { kind: "error"; message: string; details?: string[] };

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function readError(res: Response, fallback: string): Promise<{ message: string; details?: string[] }> {
  try {
    const data = (await res.json()) as ApiErrorBody;
    if (data && data.ok === false) return { message: data.error.message, details: data.error.details };
  } catch {
    // JSON이 아니면 기본 메시지
  }
  return { message: `${fallback} (HTTP ${res.status})` };
}

function filenameFromDisposition(cd: string | null): string | null {
  if (!cd) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      // 무시
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  return plain ? plain[1].trim() : null;
}

export function EmailPanel({
  generation,
  recipient,
  getCardPng,
}: {
  generation: GenerateSuccess;
  recipient: RecipientInfo;
  getCardPng: () => Promise<string>;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  // null이면 compose 기본값을 그대로 쓴다(수정하면 문자열로 고정)
  const [subjectEdit, setSubjectEdit] = useState<string | null>(null);
  const [bodyEdit, setBodyEdit] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const sendingRef = useRef(false);

  const subject = subjectEdit ?? composeSubject(generation, recipient);
  const body = bodyEdit ?? composeBody(generation, recipient);
  const email = recipient.email.trim();
  const emailOk = isValidEmail(email);

  useEffect(() => {
    let alive = true;
    fetch("/api/email", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; configured?: boolean }) => {
        if (alive) setConfigured(Boolean(d?.configured));
      })
      .catch(() => {
        if (alive) setConfigured(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const subjectInvalid = subject.trim() === "" || /[\r\n]/.test(subject) || subject.length > MAX_EMAIL_SUBJECT_LENGTH;
  const bodyInvalid = body.trim() === "" || body.length > MAX_EMAIL_BODY_LENGTH;
  const busy = phase.kind === "sending";
  const canSend = configured === true && emailOk && !subjectInvalid && !bodyInvalid && !busy;

  async function send() {
    if (sendingRef.current) return; // 중복 클릭 방지
    sendingRef.current = true;
    try {
      setPhase({ kind: "sending", step: "카드뉴스 이미지를 준비하는 중…" });
      let cardPngDataUrl: string | undefined;
      try {
        cardPngDataUrl = await getCardPng();
      } catch {
        cardPngDataUrl = undefined; // 카드 이미지 없이도 PDF는 만들 수 있다
      }

      setPhase({ kind: "sending", step: "홍보 PDF를 만드는 중…" });
      const exportRes = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "pdf", purpose: "email", generation, recipient, cardPngDataUrl }),
      });
      if (!exportRes.ok) {
        const e = await readError(exportRes, "PDF를 만들지 못했습니다");
        setPhase({ kind: "error", ...e });
        return;
      }
      const pdfFilename = filenameFromDisposition(exportRes.headers.get("content-disposition")) ?? "tlink-bizrecording.pdf";
      const pdfBase64 = arrayBufferToBase64(await exportRes.arrayBuffer());

      setPhase({ kind: "sending", step: `${email}로 메일을 발송하는 중…` });
      const payload: EmailRequest = {
        recipient,
        subject: subject.trim(),
        body: body.trim(),
        pdfBase64,
        pdfFilename,
        generationId: generation.meta.generationId,
      };
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await readError(res, "메일을 발송하지 못했습니다");
        setPhase({ kind: "error", ...e });
        return;
      }
      const data = (await res.json()) as EmailSuccess;
      setPhase({ kind: "success", messageId: data.messageId, to: data.acceptedTo });
    } catch {
      setPhase({ kind: "error", message: "네트워크 오류로 발송하지 못했습니다. 다시 시도해 주세요." });
    } finally {
      sendingRef.current = false;
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-line bg-white p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-navy-deep">
          <Mail size={16} /> 고객에게 메일 발송
        </h3>
        <span className="text-xs">
          {configured === null ? (
            <span className="text-gray-500">SMTP 확인 중…</span>
          ) : configured ? (
            <span className="text-green-700">SMTP 설정됨</span>
          ) : (
            <span className="text-red-600">SMTP 미설정</span>
          )}
        </span>
      </header>

      {configured === false && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          메일 발송 서버(SMTP)가 설정되지 않아 발송할 수 없습니다. 관리자가 .env.local에 SMTP_HOST, SMTP_PORT,
          SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM을 넣고 서버를 다시 시작해야 합니다.
        </p>
      )}

      <div className="text-xs text-navy-deep">
        받는 사람:{" "}
        {emailOk ? (
          <strong>{email}</strong>
        ) : (
          <span className="text-red-600">수신 고객 정보에 올바른 이메일을 입력해 주세요.</span>
        )}
      </div>

      <label className="block text-xs font-medium text-navy-deep">
        제목 (미리보기·수정 가능)
        <input
          type="text"
          value={subject}
          maxLength={MAX_EMAIL_SUBJECT_LENGTH}
          disabled={busy}
          onChange={(e) => setSubjectEdit(e.target.value.replace(/[\r\n]/g, " "))}
          className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </label>

      <label className="block text-xs font-medium text-navy-deep">
        본문 (미리보기·수정 가능)
        <textarea
          value={body}
          rows={12}
          maxLength={MAX_EMAIL_BODY_LENGTH}
          disabled={busy}
          onChange={(e) => setBodyEdit(e.target.value)}
          className="mt-1 block w-full rounded-md border border-line px-3 py-2 font-sans text-sm leading-relaxed outline-none focus:border-brand"
        />
        <span className="mt-1 block text-right text-gray-400">
          {body.length.toLocaleString()} / {MAX_EMAIL_BODY_LENGTH.toLocaleString()}자 · 첨부: 홍보 PDF 1개
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canSend || phase.kind === "confirm"}
          onClick={() => setPhase({ kind: "confirm" })}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {busy ? "발송 중…" : "발송"}
        </button>
        <button
          type="button"
          disabled={busy || (subjectEdit === null && bodyEdit === null)}
          onClick={() => {
            setSubjectEdit(null);
            setBodyEdit(null);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-xs text-navy-deep disabled:opacity-40"
        >
          <RotateCcw size={14} /> 기본 문구로 되돌리기
        </button>
      </div>

      {phase.kind === "confirm" && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="email-confirm-title" className="rounded-lg border-2 border-brand bg-blue-50 p-4">
          <p id="email-confirm-title" className="text-sm font-semibold text-navy-deep">
            {email}로 발송합니다
          </p>
          <p className="mt-1 text-xs text-gray-600">
            실제 고객에게 메일이 나갑니다. 제목·본문·받는 사람을 다시 확인해 주세요. 발송 후에는 취소할 수 없습니다.
          </p>
          <p className="mt-2 truncate text-xs text-navy-deep">제목: {subject}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => void send()}
              className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-white"
            >
              발송 확정
            </button>
            <button
              type="button"
              onClick={() => setPhase({ kind: "idle" })}
              className="rounded-md border border-line bg-white px-4 py-1.5 text-sm text-navy-deep"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <div aria-live="polite">
        {phase.kind === "sending" && (
          <p className="flex items-center gap-1.5 text-xs text-gray-600">
            <Loader2 size={14} className="animate-spin" /> {phase.step}
          </p>
        )}
        {phase.kind === "success" && (
          <p className="flex items-start gap-1.5 text-xs text-green-700">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <span>
              {phase.to}로 발송했습니다. (메시지 ID: <code className="break-all">{phase.messageId}</code>)
            </span>
          </p>
        )}
        {phase.kind === "error" && (
          <div className="flex items-start gap-1.5 text-xs text-red-600">
            <XCircle size={14} className="mt-0.5 shrink-0" />
            <div>
              <p>{phase.message}</p>
              {phase.details && phase.details.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {phase.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
