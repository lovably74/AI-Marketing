// POST /api/generate — 현장 사진 + 제품 정보 → AI 분석·홍보 콘텐츠 (FR-API-01~11)
// 런타임: Node.js(기본값). Cache Components가 켜져 있어 `runtime` 내보내기는 지원되지 않으므로 생략한다.
import { AppError, errorResponse } from "@/lib/ai/errors";
import { generateMarketingContent } from "@/lib/ai/generate";
import {
  DEFAULT_TARGET_CUSTOMER,
  MAX_IMAGE_BYTES,
  MAX_INDUSTRY_LENGTH,
  MAX_PRODUCT_INFO_LENGTH,
  MAX_PRODUCT_NAME_LENGTH,
  TARGET_CUSTOMERS,
} from "@/lib/constants";
import { getRepository, safeDb } from "@/lib/db";
import type { NewGeneration } from "@/lib/db";
import { checkImage } from "@/lib/image";

/** AI 타임아웃 90초 + 업로드·검증 여유 */
export const maxDuration = 120;

/**
 * 요청 본문 상한: 이미지 8MB + 텍스트 필드(제품정보 3,000자 등, UTF-8 최대 3바이트/자)와 multipart 경계 여유분.
 * Content-Length가 이를 넘으면 본문을 파싱하기 전에 413으로 거부한다.
 */
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

function readText(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request): Promise<Response> {
  // DB 기록용(성공·실패 모두 저장). 저장 실패는 응답을 막지 않는다.
  const record: Omit<NewGeneration, "status"> = {};
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new AppError("INVALID_INPUT", "multipart/form-data 형식으로 요청해야 합니다.");
    }

    // 본문 파싱 전 크기 사전 검사(Content-Length가 없으면 아래 이미지 크기 검사로 처리)
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      throw new AppError(
        "IMAGE_TOO_LARGE",
        `요청 크기가 너무 큽니다(${(contentLength / 1024 / 1024).toFixed(2)}MB). 사진은 최대 8MB까지 올릴 수 있습니다.`,
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new AppError("INVALID_INPUT", "요청 본문을 읽을 수 없습니다.");
    }

    // 1) 텍스트 입력 검사
    const productName = readText(form, "productName");
    const productInfo = readText(form, "productInfo");
    const targetCustomerRaw = readText(form, "targetCustomer");
    const industry = readText(form, "industry");
    const modelId = readText(form, "modelId") || null;
    Object.assign(record, { productName, productInfo, targetCustomer: targetCustomerRaw || null, modelId });

    const problems: string[] = [];
    if (!productName) problems.push("제품명을 입력해 주세요.");
    if (productName.length > MAX_PRODUCT_NAME_LENGTH) problems.push(`제품명은 ${MAX_PRODUCT_NAME_LENGTH}자 이하로 입력해 주세요.`);
    if (!productInfo) problems.push("제품 주요 정보를 입력해 주세요.");
    if (productInfo.length > MAX_PRODUCT_INFO_LENGTH) {
      problems.push(`제품 주요 정보는 ${MAX_PRODUCT_INFO_LENGTH.toLocaleString()}자 이하로 입력해 주세요(현재 ${productInfo.length.toLocaleString()}자).`);
    }
    const targetCustomer = targetCustomerRaw || DEFAULT_TARGET_CUSTOMER;
    if (industry.length > MAX_INDUSTRY_LENGTH) problems.push(`적용 업종은 ${MAX_INDUSTRY_LENGTH}자 이하로 입력해 주세요.`);
    if (!(TARGET_CUSTOMERS as readonly string[]).includes(targetCustomer)) problems.push("타깃 고객 값이 올바르지 않습니다.");
    if (problems.length > 0) throw new AppError("INVALID_INPUT", problems[0], problems);

    // 2) 이미지 검사(형식·매직바이트·크기). 디스크에 저장하지 않고 메모리에서만 처리한다(NFR-02).
    const image = form.get("image");
    if (!(image instanceof File)) throw new AppError("INVALID_IMAGE", "현장 사진 1장을 올려 주세요.");
    const buffer = Buffer.from(await image.arrayBuffer());
    const check = checkImage(image.type, buffer.byteLength, new Uint8Array(buffer.subarray(0, 16)));
    if (!check.ok) throw new AppError(check.code, check.message);
    Object.assign(record, { imageMime: check.mimeType, image: new Uint8Array(buffer) });

    // 3) AI 호출 (키가 없거나 실패하면 오류. 가짜 결과 없음)
    const result = await generateMarketingContent({
      productName,
      productInfo,
      targetCustomer,
      industry,
      modelId,
      image: { base64: buffer.toString("base64"), mimeType: check.mimeType },
    });
    const generationId = await safeDb("generations 저장", () =>
      getRepository().saveGeneration({
        ...record,
        status: "success",
        provider: result.meta.provider,
        model: result.meta.model,
        modelId: result.meta.modelId,
        isTlink: result.meta.isTlinkProduct,
        attempts: result.meta.attempts,
        elapsedMs: result.meta.elapsedMs,
        result: result.result,
        guidelineCheck: result.guidelineCheck,
      }),
    );
    const body = generationId ? { ...result, meta: { ...result.meta, generationId } } : result;
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const errorCode = err instanceof AppError ? err.code : "INTERNAL_ERROR";
    await safeDb("generations 오류 저장", () => getRepository().saveGeneration({ ...record, status: "error", errorCode }));
    return errorResponse(err);
  }
}
