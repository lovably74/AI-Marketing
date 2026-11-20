// 모델 레지스트리: config/ai-models.json 읽기·쓰기 (서버 전용)
import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { AppError } from "./errors";
import { PROVIDER_ENV_KEYS, PROVIDER_IDS, type ModelConfig, type ProviderId } from "./types";

const CONFIG_PATH = path.join(process.cwd(), "config", "ai-models.json");

export const modelConfigSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9._-]*$/, "id는 영문 소문자, 숫자, 점, 밑줄, 하이픈만 쓸 수 있습니다."),
  provider: z.enum(PROVIDER_IDS as [ProviderId, ...ProviderId[]]),
  model: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, "모델 ID 형식이 올바르지 않습니다."),
  label: z.string().trim().min(1).max(60),
  enabled: z.boolean(),
  isDefault: z.boolean(),
});

const fileSchema = z.object({ models: z.array(modelConfigSchema) });

export async function readModels(): Promise<ModelConfig[]> {
  let raw: string;
  try {
    raw = await fs.readFile(CONFIG_PATH, "utf8");
  } catch {
    throw new AppError("CONFIG_ERROR", "모델 설정 파일(config/ai-models.json)을 읽을 수 없습니다.");
  }
  try {
    const parsed = fileSchema.parse(JSON.parse(raw));
    return normalizeDefault(parsed.models);
  } catch {
    throw new AppError("CONFIG_ERROR", "모델 설정 파일(config/ai-models.json) 형식이 올바르지 않습니다.");
  }
}

/** 기본 모델이 정확히 1개(활성 모델 중)가 되도록 보정한다 */
export function normalizeDefault(models: ModelConfig[]): ModelConfig[] {
  const enabled = models.filter((m) => m.enabled);
  const currentDefault = enabled.find((m) => m.isDefault);
  const defaultId = currentDefault?.id ?? enabled[0]?.id;
  return models.map((m) => ({ ...m, isDefault: m.id === defaultId }));
}

export async function writeModels(models: ModelConfig[]): Promise<ModelConfig[]> {
  const normalized = normalizeDefault(models);
  const ids = new Set<string>();
  for (const m of normalized) {
    if (ids.has(m.id)) throw new AppError("INVALID_INPUT", `중복된 모델 id입니다: ${m.id}`);
    ids.add(m.id);
  }
  const body = JSON.stringify({ models: normalized }, null, 2) + "\n";
  const tmp = `${CONFIG_PATH}.tmp`;
  try {
    await fs.writeFile(tmp, body, "utf8");
    await fs.rename(tmp, CONFIG_PATH);
  } catch {
    throw new AppError(
      "CONFIG_ERROR",
      "모델 설정을 저장하지 못했습니다. 서버리스 환경에서는 파일 저장이 지원되지 않습니다.",
    );
  }
  return normalized;
}

/** 요청한 모델(없으면 기본 모델)을 찾는다. 비활성 모델은 사용할 수 없다. */
export async function resolveModel(modelId?: string | null): Promise<ModelConfig> {
  const models = await readModels();
  if (modelId) {
    const found = models.find((m) => m.id === modelId);
    if (!found || !found.enabled) {
      throw new AppError("MODEL_NOT_FOUND", `선택한 모델(${modelId})을 사용할 수 없습니다. 모델 목록을 새로 고쳐 주세요.`);
    }
    return found;
  }
  const def = models.find((m) => m.isDefault && m.enabled);
  if (!def) throw new AppError("MODEL_NOT_FOUND", "사용 가능한 AI 모델이 없습니다. 관리자 페이지에서 모델을 등록해 주세요.");
  if (getApiKey(def.provider)) return def;
  return models.find((m) => m.enabled && getApiKey(m.provider)) ?? def;
}

/** 제공사 API 키를 환경변수에서만 읽는다(FR-API-11) */
export function getApiKey(provider: ProviderId): string | null {
  const v = process.env[PROVIDER_ENV_KEYS[provider]];
  return v && v.trim() ? v.trim() : null;
}

export function requireApiKey(provider: ProviderId): string {
  const key = getApiKey(provider);
  if (!key) {
    throw new AppError(
      "MISSING_API_KEY",
      `${provider === "gemini" ? "Gemini" : "OpenAI"} API 키가 설정되지 않았습니다. 서버의 .env.local에 ${PROVIDER_ENV_KEYS[provider]}를 입력한 뒤 서버를 다시 시작해 주세요.`,
    );
  }
  return key;
}

export function getKeyStatus(): Record<ProviderId, boolean> {
  return { gemini: getApiKey("gemini") !== null, openai: getApiKey("openai") !== null };
}
