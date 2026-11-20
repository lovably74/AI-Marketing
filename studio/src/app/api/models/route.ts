// /api/models — 모델 목록 조회(GET)와 관리(POST/PUT/DELETE, x-admin-token 필요) (FR-ADM-01~03)
import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { AppError, errorResponse } from "@/lib/ai/errors";
import { getKeyStatus, modelConfigSchema, readModels, writeModels } from "@/lib/ai/registry";
import type { ModelConfig } from "@/lib/ai/types";

async function listResponse(models?: ModelConfig[]): Promise<Response> {
  const list = models ?? (await readModels());
  return Response.json(
    {
      ok: true,
      models: list,
      defaultId: list.find((m) => m.isDefault)?.id ?? null,
      // 키 값은 절대 내보내지 않고 설정 여부만 알린다(FR-ADM-03)
      keyStatus: getKeyStatus(),
      adminTokenConfigured: Boolean(process.env.ADMIN_TOKEN?.trim()),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new AppError("INVALID_INPUT", "JSON 본문을 읽을 수 없습니다.");
  }
}

/** 모델 목록, 기본 모델, 제공사별 키 설정 여부 */
export async function GET(): Promise<Response> {
  await connection(); // 요청 시점에 파일을 읽도록 동적 렌더링
  try {
    return await listResponse();
  } catch (err) {
    return errorResponse(err);
  }
}

/** 모델 추가 */
export async function POST(request: Request): Promise<Response> {
  try {
    requireAdmin(request);
    const body = await readJson(request);
    const parsed = modelConfigSchema.safeParse({
      enabled: true,
      isDefault: false,
      ...body,
    });
    if (!parsed.success) {
      throw new AppError(
        "INVALID_INPUT",
        "모델 정보가 올바르지 않습니다.",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      );
    }
    if (parsed.data.isDefault && !parsed.data.enabled) {
      // 그대로 저장하면 기본 모델이 다른 모델로 자동 보정되어 의도와 달라지므로 거부한다
      throw new AppError("INVALID_INPUT", "사용 중지 상태의 모델은 기본 모델로 추가할 수 없습니다.");
    }
    const models = await readModels();
    if (models.some((m) => m.id === parsed.data.id)) {
      throw new AppError("INVALID_INPUT", `이미 등록된 id입니다: ${parsed.data.id}`);
    }
    let next = [...models, parsed.data];
    if (parsed.data.isDefault) next = next.map((m) => ({ ...m, isDefault: m.id === parsed.data.id }));
    return await listResponse(await writeModels(next));
  } catch (err) {
    return errorResponse(err);
  }
}

/** 기본 모델 지정, 사용 여부·표시명 변경. body: { id, isDefault?, enabled?, label? } */
export async function PUT(request: Request): Promise<Response> {
  try {
    requireAdmin(request);
    const body = await readJson(request);
    const id = typeof body.id === "string" ? body.id : "";
    const models = await readModels();
    const target = models.find((m) => m.id === id);
    if (!target) throw new AppError("MODEL_NOT_FOUND", `모델을 찾을 수 없습니다: ${id}`);

    let next = models.map((m) => ({ ...m }));
    const t = next.find((m) => m.id === id)!;
    if (typeof body.label === "string") {
      const label = body.label.trim();
      if (!label || label.length > 60) throw new AppError("INVALID_INPUT", "표시명은 1~60자로 입력해 주세요.");
      t.label = label;
    }
    if (typeof body.enabled === "boolean") {
      if (!body.enabled && t.enabled) {
        if (next.filter((m) => m.enabled).length <= 1) {
          throw new AppError("INVALID_INPUT", "최소 1개의 모델은 사용 상태여야 합니다.");
        }
        // 기본 모델을 끄면 기본이 다른 모델로 몰래 바뀌므로, 먼저 기본을 옮기게 한다
        if (t.isDefault) {
          throw new AppError(
            "INVALID_INPUT",
            `기본 모델(${t.label})은 사용 중지할 수 없습니다. 먼저 다른 모델을 기본으로 지정해 주세요.`,
          );
        }
      }
      t.enabled = body.enabled;
    }
    if (body.isDefault === true) {
      if (!t.enabled) throw new AppError("INVALID_INPUT", "사용 중지된 모델은 기본 모델로 지정할 수 없습니다.");
      next = next.map((m) => ({ ...m, isDefault: m.id === id }));
    }
    return await listResponse(await writeModels(next));
  } catch (err) {
    return errorResponse(err);
  }
}

/** 모델 삭제. /api/models?id=xxx */
export async function DELETE(request: Request): Promise<Response> {
  try {
    requireAdmin(request);
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const models = await readModels();
    const target = models.find((m) => m.id === id);
    if (!target) throw new AppError("MODEL_NOT_FOUND", `모델을 찾을 수 없습니다: ${id}`);
    const next = models.filter((m) => m.id !== id);
    if (!next.some((m) => m.enabled)) {
      throw new AppError("INVALID_INPUT", "사용 가능한 모델이 최소 1개는 남아 있어야 합니다.");
    }
    // 기본 모델이 없는 상태를 막기 위해, 기본 모델은 다른 모델을 기본으로 지정한 뒤에만 삭제할 수 있다
    if (target.isDefault) {
      throw new AppError(
        "INVALID_INPUT",
        `기본 모델(${target.label})은 삭제할 수 없습니다. 먼저 다른 모델을 기본으로 지정한 뒤 삭제해 주세요.`,
      );
    }
    return await listResponse(await writeModels(next));
  } catch (err) {
    return errorResponse(err);
  }
}
