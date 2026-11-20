// POST /api/export — 생성 결과를 PDF·Word·PPT·Excel·ZIP 파일로 내보낸다.
// 런타임: Node.js(기본값). 실패 시 가짜 파일 대신 EXPORT_FAILED를 반환한다. 수신자 정보는 로그에 남기지 않는다.
import { z } from "zod";
import { AppError, errorResponse } from "@/lib/ai/errors";
import { generatedContentSchema } from "@/lib/ai/schema";
import type { ExportRequest } from "@/lib/deliver-types";
import { buildExport, contentDisposition, exportFilename, MIME } from "@/lib/export";
import { logExport, safeDb, saveRecipient } from "@/lib/db";

export const maxDuration = 60;

const MAX_BODY_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** data:image/(png|jpeg|webp);base64,... 이고 디코딩 크기가 8MB 이하 */
const imageDataUrl = z
  .string()
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "이미지는 PNG·JPEG·WEBP 데이터 URL만 허용합니다.")
  .refine((s) => {
    const b64 = s.slice(s.indexOf(",") + 1);
    return Math.floor((b64.length * 3) / 4) <= MAX_IMAGE_BYTES;
  }, "이미지는 각 8MB 이하만 허용합니다.");

const short = z.string().trim().max(100);

const recipientSchema = z.object({
  name: short,
  company: short,
  title: short,
  department: short,
  email: z.string().trim().pipe(z.email("이메일 형식이 올바르지 않습니다.")),
  phone: z.string().trim().max(40),
});

const guidelineCheckSchema = z.object({
  applicable: z.boolean(),
  requiredKeywords: z.array(
    z.object({ keyword: z.string(), inBlogTitle: z.boolean(), inBlogContent: z.boolean(), inHeadlines: z.boolean() }),
  ),
  titlePhrases: z.array(z.object({ phrase: z.string(), found: z.boolean() })),
  warnings: z.array(z.object({ label: z.string(), matches: z.array(z.string()), fields: z.array(z.string()) })),
  footerAppended: z.array(z.string()),
  hashtagsRemoved: z.array(z.string()),
  passed: z.boolean(),
});

const metaSchema = z.object({
  modelId: z.string(),
  provider: z.string(),
  model: z.string(),
  label: z.string(),
  isTlinkProduct: z.boolean(),
  attempts: z.number(),
  elapsedMs: z.number(),
  generatedAt: z.string(),
  generationId: z.string().uuid().optional(), // DB 이력 연결용(없으면 스키마가 지워 버리므로 명시)
});

const exportRequestSchema = z.object({
  format: z.enum(["pdf", "docx", "pptx", "xlsx", "zip"]),
  purpose: z.enum(["download", "preview", "email"]).optional(),
  generation: z.object({
    ok: z.literal(true),
    // 블로그 하단 문구가 자동 추가된 결과도 받을 수 있도록 본문 상한은 약간 여유를 둔다
    result: generatedContentSchema.extend({ blogContent: z.string().trim().min(1).max(10000) }),
    guidelineCheck: guidelineCheckSchema,
    meta: metaSchema,
  }),
  recipient: recipientSchema.optional(),
  cardPngDataUrl: imageDataUrl.optional(),
  photoDataUrl: imageDataUrl.optional(),
});

export async function POST(request: Request): Promise<Response> {
  let format = "unknown";
  try {
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      throw new AppError("INVALID_INPUT", "요청 크기가 너무 큽니다(최대 20MB).");
    }
    let text: string;
    try {
      text = await request.text();
    } catch {
      throw new AppError("INVALID_INPUT", "요청 본문을 읽을 수 없습니다.");
    }
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
      throw new AppError("INVALID_INPUT", "요청 크기가 너무 큽니다(최대 20MB).");
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AppError("INVALID_INPUT", "JSON 형식으로 요청해야 합니다.");
    }
    const parsed = exportRequestSchema.safeParse(json);
    if (!parsed.success) {
      // 수신자 값이 섞이지 않도록 경로와 메시지만 돌려준다
      const details = parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`);
      throw new AppError("INVALID_INPUT", "내보내기 요청 형식이 올바르지 않습니다.", details);
    }
    const req = parsed.data as ExportRequest;
    format = req.format;

    const now = new Date();
    let buf: Buffer;
    try {
      buf = await buildExport(req, now);
    } catch (e) {
      console.error(`[EXPORT_FAILED] format=${format}`, e instanceof Error ? e.message : "unknown");
      throw new AppError("EXPORT_FAILED", "파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
    if (!buf || buf.length === 0) {
      throw new AppError("EXPORT_FAILED", "파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }

    const filename = exportFilename(req.format, now);
    // DB: 내보내기 이력(고객 정보가 있으면 수신자도 저장). 실패해도 파일 응답은 막지 않는다.
    const recipientId =
      req.recipient && req.recipient.email.trim()
        ? await safeDb("수신자 저장", () => saveRecipient(req.recipient!))
        : null;
    await safeDb("내보내기 이력", () =>
      logExport({
        generationId: req.generation.meta.generationId ?? null,
        // 다운로드는 형식만, 미리보기·메일 첨부는 "pdf:preview", "pdf:email"처럼 용도를 붙여 구분한다
        format: req.purpose && req.purpose !== "download" ? `${req.format}:${req.purpose}` : req.format,
        recipientId,
      }),
    );
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": MIME[req.format],
        "Content-Disposition": contentDisposition(filename),
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
        "X-Export-Filename": encodeURIComponent(filename),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
