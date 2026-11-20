// AI 제공사 어댑터 공통 인터페이스 (ADR-0001)
import type { AllowedImageType } from "../constants";

export type ProviderId = "gemini" | "openai";
export const PROVIDER_IDS: readonly ProviderId[] = ["gemini", "openai"];

export const PROVIDER_ENV_KEYS: Record<ProviderId, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
};

export interface ModelConfig {
  id: string;
  provider: ProviderId;
  model: string;
  label: string;
  enabled: boolean;
  isDefault: boolean;
}

export interface ProviderImage {
  /** base64 (data URL 접두어 없음) */
  base64: string;
  mimeType: AllowedImageType;
}

export interface ProviderRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  image?: ProviderImage;
  /** 지정하면 구조화 출력(JSON)을 요청한다 */
  jsonSchema?: "content";
  signal: AbortSignal;
  timeoutMs: number;
}

export interface AIProvider {
  id: ProviderId;
  /** 모델의 원문 응답 문자열(JSON 또는 텍스트)을 반환한다 */
  generate(apiKey: string, req: ProviderRequest): Promise<string>;
}
