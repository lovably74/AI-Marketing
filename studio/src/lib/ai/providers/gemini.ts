// Gemini 어댑터 (@google/genai). 구조화 출력: responseMimeType + responseJsonSchema
import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import { AppError } from "../errors";
import { buildGeminiSchema } from "../schema";
import type { AIProvider, ProviderRequest } from "../types";

function mapGeminiError(err: unknown, signal: AbortSignal): AppError {
  if (err instanceof AppError) return err;
  if (signal.aborted) {
    return new AppError("TIMEOUT", "AI 응답이 제한 시간 안에 오지 않았습니다. 잠시 후 다시 시도해 주세요.");
  }
  if (err instanceof ApiError) {
    const status = err.status;
    if (status === 400 && /api key/i.test(err.message)) {
      return new AppError("PROVIDER_ERROR", "Gemini API 키가 올바르지 않습니다. .env.local의 GEMINI_API_KEY를 확인해 주세요.", [`HTTP ${status}`]);
    }
    if (status === 401 || status === 403) {
      return new AppError("PROVIDER_ERROR", "Gemini API 인증에 실패했습니다. API 키와 권한을 확인해 주세요.", [`HTTP ${status}`]);
    }
    if (status === 404) {
      return new AppError("PROVIDER_ERROR", "Gemini에서 해당 모델을 찾을 수 없습니다. 관리자 페이지에서 모델 ID를 확인해 주세요.", [`HTTP ${status}`]);
    }
    if (status === 429) {
      return new AppError("PROVIDER_ERROR", "Gemini 사용량 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.", [`HTTP ${status}`]);
    }
    return new AppError("PROVIDER_ERROR", `Gemini 호출에 실패했습니다(HTTP ${status}).`, [`HTTP ${status}`]);
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/abort/i.test(message)) {
    return new AppError("TIMEOUT", "AI 응답이 제한 시간 안에 오지 않았습니다. 잠시 후 다시 시도해 주세요.");
  }
  return new AppError("PROVIDER_ERROR", "Gemini 호출 중 오류가 발생했습니다.");
}

export const geminiProvider: AIProvider = {
  id: "gemini",
  async generate(apiKey: string, req: ProviderRequest): Promise<string> {
    const ai = new GoogleGenAI({ apiKey });
    const parts: Part[] = [];
    if (req.image) {
      parts.push({ inlineData: { data: req.image.base64, mimeType: req.image.mimeType } });
    }
    parts.push({ text: req.userPrompt });

    try {
      const response = await ai.models.generateContent({
        model: req.model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: req.systemPrompt,
          abortSignal: req.signal,
          httpOptions: { timeout: req.timeoutMs },
          ...(req.jsonSchema
            ? { responseMimeType: "application/json", responseJsonSchema: buildGeminiSchema() }
            : {}),
        },
      });

      const text = response.text;
      if (!text || !text.trim()) {
        const finish = response.candidates?.[0]?.finishReason;
        const blocked = response.promptFeedback?.blockReason;
        throw new AppError("INVALID_AI_RESPONSE", "Gemini가 빈 응답을 반환했습니다.", [
          `finishReason=${finish ?? "없음"}`,
          ...(blocked ? [`blockReason=${blocked}`] : []),
        ]);
      }
      return text;
    } catch (err) {
      throw mapGeminiError(err, req.signal);
    }
  },
};
