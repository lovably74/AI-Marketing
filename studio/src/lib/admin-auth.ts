// 관리자 토큰 확인 (로그인 시스템이 아닌 단일 토큰 비교, PRD C3)
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "./ai/errors";

export const ADMIN_TOKEN_HEADER = "x-admin-token";

/** x-admin-token 헤더가 환경변수 ADMIN_TOKEN과 같지 않으면 오류를 던진다 */
export function requireAdmin(request: Request): void {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) {
    throw new AppError(
      "ADMIN_TOKEN_NOT_SET",
      "서버에 ADMIN_TOKEN이 설정되지 않아 관리 기능을 사용할 수 없습니다. .env.local에 ADMIN_TOKEN을 입력한 뒤 서버를 다시 시작해 주세요.",
    );
  }
  const given = request.headers.get(ADMIN_TOKEN_HEADER)?.trim() ?? "";
  // 길이 차이로 인한 정보 노출을 막기 위해 해시끼리 비교한다
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!given || !timingSafeEqual(a, b)) {
    throw new AppError("UNAUTHORIZED", "관리자 토큰이 올바르지 않습니다.");
  }
}
