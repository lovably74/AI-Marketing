// GET /api/history/[id] — 생성 이력 상세(result 포함, 이미지는 /image로 별도). 관리자 토큰 필요.
import { requireAdmin } from "@/lib/admin-auth";
import { errorResponse } from "@/lib/ai/errors";
import { getRepository } from "@/lib/db";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    requireAdmin(request);
    const { id } = await ctx.params;
    const item = await getRepository().getGeneration(id);
    if (!item) {
      return Response.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "해당 생성 이력을 찾을 수 없습니다." } },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json({ ok: true, item }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
