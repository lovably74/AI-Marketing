// 앱 공통 오류. 가짜 결과 대신 항상 이 오류를 반환한다(FR-API-08).
import type { ErrorCode } from "../constants";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  INVALID_IMAGE: 400,
  IMAGE_TOO_LARGE: 413,
  MODEL_NOT_FOUND: 400,
  MISSING_API_KEY: 503,
  PROVIDER_ERROR: 502,
  INVALID_AI_RESPONSE: 502,
  TIMEOUT: 504,
  UNAUTHORIZED: 401,
  ADMIN_TOKEN_NOT_SET: 503,
  CONFIG_ERROR: 500,
  INTERNAL_ERROR: 500,
  EXPORT_FAILED: 500,
  SMTP_NOT_CONFIGURED: 503,
  EMAIL_SEND_FAILED: 502,
  RATE_LIMITED: 429,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: string[];

  constructor(code: ErrorCode, message: string, details?: string[]) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export interface ErrorBody {
  ok: false;
  error: { code: ErrorCode; message: string; details?: string[] };
}

/** 어떤 오류든 클라이언트용 JSON 응답으로 바꾼다. 내부 스택·키는 노출하지 않는다. */
export function errorResponse(err: unknown): Response {
  const appErr =
    err instanceof AppError
      ? err
      : new AppError("INTERNAL_ERROR", "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  if (!(err instanceof AppError)) {
    console.error("[INTERNAL_ERROR]", err);
  }
  const body: ErrorBody = {
    ok: false,
    error: { code: appErr.code, message: appErr.message, ...(appErr.details ? { details: appErr.details } : {}) },
  };
  return Response.json(body, { status: appErr.status });
}
