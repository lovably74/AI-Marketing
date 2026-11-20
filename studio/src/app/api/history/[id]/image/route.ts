// GET /api/history/[id]/image — 생성 시 업로드한 원본 사진. 관리자 토큰 필요.
import { requireAdmin } from "@/lib/admin-auth";
import { errorResponse } from "@/lib/ai/errors";
import { getRepository } from "@/lib/db";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    requireAdmin(request);
    const { id } = await ctx.params;
    const img = await getRepository().getGenerationImage(id);
    if (!img) {
      return Response.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "해당 이력의 사진을 찾을 수 없습니다." } },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return new Response(new Uint8Array(img.data), {
      headers: { "Content-Type": img.mime, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
