// GET /api/history/exports?limit=50 — 내보내기 이력. 관리자 토큰 필요(고객 개인정보 포함). limit 최대 200.
import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { errorResponse } from "@/lib/ai/errors";
import { getRepository } from "@/lib/db";

export async function GET(request: Request): Promise<Response> {
  await connection(); // 요청 시점 렌더링(빌드 시 프리렌더 제외)
  try {
    requireAdmin(request);
    const raw = Number(new URL(request.url).searchParams.get("limit") ?? 50);
    const items = await getRepository().listExportLogs(Number.isFinite(raw) ? raw : 50);
    return Response.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
