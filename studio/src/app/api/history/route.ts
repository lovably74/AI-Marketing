// GET /api/history?limit=20 — 생성 이력 목록(이미지·결과 본문 제외). 관리자 토큰 필요(고객 정보 포함).
import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { errorResponse } from "@/lib/ai/errors";
import { getRepository } from "@/lib/db";

export async function GET(request: Request): Promise<Response> {
  await connection(); // 요청 시점 렌더링(빌드 시 프리렌더 제외)
  try {
    requireAdmin(request);
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 20);
    const items = await getRepository().listGenerations(Number.isFinite(limit) ? limit : 20);
    return Response.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
