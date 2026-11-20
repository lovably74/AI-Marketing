// POST /api/models/test — 연결 테스트: 짧은 텍스트 요청으로 실제 응답 여부 확인 (FR-ADM-04, P2)
// 과금이 발생할 수 있으므로 관리자 토큰이 필요하다.
// body: { id } (등록된 모델) 또는 { provider, model } (등록 전 확인용 초안)
import { requireAdmin } from "@/lib/admin-auth";
import { AppError, errorResponse } from "@/lib/ai/errors";
import { PROVIDERS } from "@/lib/ai/providers";
import { modelConfigSchema, readModels, requireApiKey } from "@/lib/ai/registry";
import type { ProviderId } from "@/lib/ai/types";

export const maxDuration = 60;

const TEST_TIMEOUT_MS = 30_000;

const draftSchema = modelConfigSchema.pick({ provider: true, model: true });

interface TestTarget {
  modelId: string | null;
  provider: ProviderId;
  model: string;
}

async function resolveTarget(body: Record<string, unknown>): Promise<TestTarget> {
  if (typeof body.id === "string" && body.id) {
    const found = (await readModels()).find((m) => m.id === body.id);
    if (!found) throw new AppError("MODEL_NOT_FOUND", `모델을 찾을 수 없습니다: ${body.id}`);
    return { modelId: found.id, provider: found.provider, model: found.model };
  }
  const parsed = draftSchema.safeParse({ provider: body.provider, model: body.model });
  if (!parsed.success) {
    throw new AppError(
      "INVALID_INPUT",
      "연결 테스트할 모델 정보가 올바르지 않습니다. 등록된 id 또는 제공사와 모델 ID를 보내 주세요.",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  return { modelId: null, ...parsed.data };
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireAdmin(request);
    let body: Record<string, unknown>;
    try {
      const raw = (await request.json()) as unknown;
      if (!raw || typeof raw !== "object") throw new Error();
      body = raw as Record<string, unknown>;
    } catch {
      throw new AppError("INVALID_INPUT", "JSON 본문을 읽을 수 없습니다.");
    }
    const target = await resolveTarget(body);
    const apiKey = requireApiKey(target.provider);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
    const startedAt = Date.now();
    try {
      const text = await PROVIDERS[target.provider].generate(apiKey, {
        model: target.model,
        systemPrompt: "연결 테스트다. 지시에 따라 짧게 답한다.",
        userPrompt: "'연결 성공'이라고만 답하라.",
        signal: controller.signal,
        timeoutMs: TEST_TIMEOUT_MS,
      });
      return Response.json(
        {
          ok: true,
          modelId: target.modelId,
          provider: target.provider,
          model: target.model,
          elapsedMs: Date.now() - startedAt,
          reply: text.trim().slice(0, 100),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (err) {
      // 어느 모델의 실패인지 바로 알 수 있도록 제공사/모델 ID를 메시지 앞에 붙인다(코드·상세는 유지)
      if (err instanceof AppError) {
        throw new AppError(err.code, `${target.provider}/${target.model} 연결 실패: ${err.message}`, err.details);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return errorResponse(err);
  }
}
