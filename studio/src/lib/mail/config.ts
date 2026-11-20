// SMTP 설정 읽기 (서버 전용). 비밀값은 로그·응답에 절대 넣지 않는다.
import "server-only";
import { AppError } from "@/lib/ai/errors";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

const REQUIRED = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"] as const;

function readEnv(name: (typeof REQUIRED)[number]): string {
  return (process.env[name] ?? "").trim();
}

/** 필수 환경변수가 모두 있는지(값은 노출하지 않음) */
export function isSmtpConfigured(): boolean {
  return REQUIRED.every((k) => readEnv(k) !== "");
}

/** 설정을 읽는다. 하나라도 없거나 형식이 틀리면 SMTP_NOT_CONFIGURED. */
export function getSmtpConfig(): SmtpConfig {
  if (!isSmtpConfigured()) {
    throw new AppError(
      "SMTP_NOT_CONFIGURED",
      "메일 발송 서버(SMTP)가 설정되지 않았습니다. 관리자에게 .env.local의 SMTP 항목 설정을 요청해 주세요.",
    );
  }
  const port = Number(readEnv("SMTP_PORT"));
  const secureRaw = readEnv("SMTP_SECURE").toLowerCase();
  if (!Number.isInteger(port) || port <= 0 || port > 65535 || (secureRaw !== "true" && secureRaw !== "false")) {
    throw new AppError(
      "SMTP_NOT_CONFIGURED",
      "SMTP 설정 형식이 올바르지 않습니다(SMTP_PORT는 숫자, SMTP_SECURE는 true/false).",
    );
  }
  return {
    host: readEnv("SMTP_HOST"),
    port,
    secure: secureRaw === "true",
    user: readEnv("SMTP_USER"),
    pass: readEnv("SMTP_PASS"),
    from: readEnv("MAIL_FROM"),
  };
}
