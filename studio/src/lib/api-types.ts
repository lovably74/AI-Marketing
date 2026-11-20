// API 응답 타입 (클라이언트·서버 공용)
import type { ErrorCode } from "./constants";
import type { GeneratedContent } from "./ai/schema";
import type { ModelConfig, ProviderId } from "./ai/types";
import type { GuidelineCheck } from "./ai/validate";

export type { GeneratedContent, GuidelineCheck, ModelConfig, ProviderId };

export interface GenerateMeta {
  modelId: string;
  provider: string;
  model: string;
  label: string;
  isTlinkProduct: boolean;
  attempts: number;
  elapsedMs: number;
  generatedAt: string;
  /** DB에 저장된 생성 이력 id (저장 실패 시 없음) */
  generationId?: string;
}

export interface GenerateSuccess {
  ok: true;
  result: GeneratedContent;
  guidelineCheck: GuidelineCheck;
  meta: GenerateMeta;
}

export interface ApiErrorBody {
  ok: false;
  error: { code: ErrorCode; message: string; details?: string[] };
}

export interface ModelsResponse {
  ok: true;
  models: ModelConfig[];
  defaultId: string | null;
  keyStatus: Record<ProviderId, boolean>;
  adminTokenConfigured: boolean;
}
