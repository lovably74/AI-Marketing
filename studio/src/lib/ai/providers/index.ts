// 제공사 어댑터 목록. 새 제공사는 어댑터 파일을 만들고 여기에 등록한다(ADR-0001).
import type { AIProvider, ProviderId } from "../types";
import { geminiProvider } from "./gemini";
import { openaiProvider } from "./openai";

export const PROVIDERS: Record<ProviderId, AIProvider> = {
  gemini: geminiProvider,
  openai: openaiProvider,
};
