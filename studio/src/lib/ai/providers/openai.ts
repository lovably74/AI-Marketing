// OpenAI 멀티모달 어댑터. 구조화 출력: response_format json_schema(strict)
import OpenAI, { APIConnectionTimeoutError, APIError, APIUserAbortError } from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { AppError } from "../errors";
import { buildOpenAISchema } from "../schema";
import type { AIProvider, ProviderRequest } from "../types";

function mapOpenAIError(err: unknown, signal: AbortSignal): AppError {
  if (err instanceof AppError) return err;
  if (signal.aborted || err instanceof APIUserAbortError || err instanceof APIConnectionTimeoutError) {
    return new AppError("TIMEOUT", "AI 응답이 제한 시간 안에 오지 않았습니다. 잠시 후 다시 시도해 주세요.");
  }
  if (err instanceof APIError) {
    const status = err.status;
    if (status === 401 || status === 403) {
      return new AppError("PROVIDER_ERROR", "OpenAI API 인증에 실패했습니다. OPENAI_API_KEY를 확인해 주세요.", [`HTTP ${status}`]);
    }
    if (status === 404) {
      return new AppError("PROVIDER_ERROR", "OpenAI에서 해당 모델을 찾을 수 없습니다. 관리자 페이지에서 모델 ID를 확인해 주세요.", [`HTTP ${status}`]);
    }
    if (status === 429) {
      return new AppError("PROVIDER_ERROR", "OpenAI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.", [`HTTP ${status}`]);
    }
    return new AppError("PROVIDER_ERROR", `OpenAI 호출에 실패했습니다${status ? `(HTTP ${status})` : ""}.`);
  }
  return new AppError("PROVIDER_ERROR", "OpenAI 호출 중 오류가 발생했습니다.");
}

export const openaiProvider: AIProvider = {
  id: "openai",
  async generate(apiKey: string, req: ProviderRequest): Promise<string> {
    const client = new OpenAI({ apiKey, maxRetries: 0, timeout: req.timeoutMs });

    const userContent: ChatCompletionContentPart[] = [];
    if (req.image) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${req.image.mimeType};base64,${req.image.base64}`, detail: "auto" },
      });
    }
    userContent.push({ type: "text", text: req.userPrompt });

    try {
      const completion = await client.chat.completions.create(
        {
          model: req.model,
          messages: [
            { role: "system", content: req.systemPrompt },
            { role: "user", content: userContent },
          ],
          ...(req.jsonSchema
            ? {
                response_format: {
                  type: "json_schema" as const,
                  json_schema: { name: "tlink_marketing_content", strict: true, schema: buildOpenAISchema() },
                },
              }
            : {}),
        },
        { signal: req.signal, timeout: req.timeoutMs, maxRetries: 0 },
      );

      const message = completion.choices[0]?.message;
      if (message?.refusal) {
        throw new AppError("INVALID_AI_RESPONSE", "OpenAI 모델이 응답을 거절했습니다.");
      }
      const text = message?.content;
      if (!text || !text.trim()) {
        throw new AppError("INVALID_AI_RESPONSE", "OpenAI가 빈 응답을 반환했습니다.", [
          `finish_reason=${completion.choices[0]?.finish_reason ?? "없음"}`,
        ]);
      }
      return text;
    } catch (err) {
      throw mapOpenAIError(err, req.signal);
    }
  },
};
