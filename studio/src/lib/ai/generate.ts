// 생성 오케스트레이션: 한 번의 AI 호출(검증 실패 시 1회 재시도) → 검증 → 후처리 (서버 전용)
import "server-only";
import { AI_TIMEOUT_MS } from "../constants";
import { isTlinkProduct } from "../knowledge";
import { AppError } from "./errors";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { PROVIDERS } from "./providers";
import { requireApiKey, resolveModel } from "./registry";
import type { GenerateSuccess } from "../api-types";
import type { ProviderImage } from "./types";
import { finalizeContent, parseAndValidate } from "./validate";

export interface GenerateInput {
  productName: string;
  productInfo: string;
  targetCustomer: string;
  industry?: string;
  modelId?: string | null;
  image: ProviderImage;
}

/** 재시도에 필요한 최소 남은 시간 */
const MIN_RETRY_BUDGET_MS = 15_000;

export async function generateMarketingContent(input: GenerateInput): Promise<GenerateSuccess> {
  const startedAt = Date.now();
  const modelConfig = await resolveModel(input.modelId);
  const apiKey = requireApiKey(modelConfig.provider); // 키가 없으면 MISSING_API_KEY (가짜 결과 없음)
  const provider = PROVIDERS[modelConfig.provider];
  const isTlink = isTlinkProduct(input.productName);

  const promptInput = {
    productName: input.productName,
    productInfo: input.productInfo,
    targetCustomer: input.targetCustomer,
    industry: input.industry,
    isTlink,
  };
  const systemPrompt = buildSystemPrompt({ isTlink });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    let feedback: string[] | undefined;
    let lastIssues: string[] = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      const remaining = AI_TIMEOUT_MS - (Date.now() - startedAt);
      if (attempt > 1 && remaining < MIN_RETRY_BUDGET_MS) break;

      const raw = await provider.generate(apiKey, {
        model: modelConfig.model,
        systemPrompt,
        userPrompt: buildUserPrompt(promptInput, feedback),
        image: input.image,
        jsonSchema: "content",
        signal: controller.signal,
        timeoutMs: Math.max(remaining, 1_000),
      });

      const parsed = parseAndValidate(raw, isTlink, input.productInfo);
      if (parsed.ok && parsed.content) {
        const { content, guidelineCheck } = finalizeContent(parsed.content, {
          isTlink,
          productInfo: input.productInfo,
        });
        if (guidelineCheck.warnings.length > 0) {
          lastIssues = guidelineCheck.warnings.map((warning) => `${warning.label} (${warning.fields.join(", ")})`);
          feedback = lastIssues;
          continue;
        }
        return {
          ok: true,
          result: content,
          guidelineCheck,
          meta: {
            modelId: modelConfig.id,
            provider: modelConfig.provider,
            model: modelConfig.model,
            label: modelConfig.label,
            isTlinkProduct: isTlink,
            attempts: attempt,
            elapsedMs: Date.now() - startedAt,
            generatedAt: new Date().toISOString(),
          },
        };
      }
      lastIssues = parsed.issues;
      feedback = parsed.issues;
      console.warn(`[generate] 응답 검증 실패(시도 ${attempt}/2):`, parsed.issues);
    }
    throw new AppError(
      "INVALID_AI_RESPONSE",
      "AI 응답이 형식·근거 검증을 통과하지 못했습니다(1회 재시도 포함). 다시 시도하거나 다른 모델을 선택해 주세요.",
      lastIssues,
    );
  } catch (err) {
    if (controller.signal.aborted && !(err instanceof AppError && err.code !== "TIMEOUT")) {
      throw new AppError("TIMEOUT", "AI 응답 시간이 90초를 넘었습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
