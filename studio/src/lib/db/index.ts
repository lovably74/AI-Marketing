// 저장소 진입점 — DATABASE_URL로 구현체를 고르고 모듈 단위 싱글턴으로 재사용한다(서버 전용).
//   미설정            → sqlite:./.data/tlink.db
//   sqlite:<경로>     → SQLite(node:sqlite) 파일
//   postgres(ql)://  → 아직 미구현(CONFIG_ERROR). 향후 postgres.ts 어댑터를 추가한다.
import "server-only";
import path from "node:path";
import { AppError } from "../ai/errors";
import { SqliteRepository } from "./sqlite";
import type { EmailLogInput, ExportLogInput, RecipientInput, Repository } from "./types";

export type * from "./types";

export const DEFAULT_DATABASE_URL = "sqlite:./.data/tlink.db";

export type DatabaseConfig = { kind: "sqlite"; filePath: string };

/** DATABASE_URL을 해석한다. 지원하지 않는 형식이면 CONFIG_ERROR */
export function parseDatabaseUrl(raw: string | undefined): DatabaseConfig {
  const url = raw?.trim() || DEFAULT_DATABASE_URL;
  if (/^postgres(ql)?:\/\//i.test(url)) {
    throw new AppError("CONFIG_ERROR", "PostgreSQL 어댑터는 향후 추가 예정입니다. 현재는 sqlite: 형식의 DATABASE_URL만 지원합니다.");
  }
  if (/^sqlite:/i.test(url)) {
    const p = url.replace(/^sqlite:(\/\/)?/i, "");
    if (!p) throw new AppError("CONFIG_ERROR", "DATABASE_URL의 SQLite 파일 경로가 비어 있습니다.");
    return { kind: "sqlite", filePath: p === ":memory:" ? p : path.resolve(process.cwd(), p) };
  }
  throw new AppError("CONFIG_ERROR", "DATABASE_URL 형식을 알 수 없습니다. 예: sqlite:./.data/tlink.db");
}

export function createRepository(raw: string | undefined, opts: { migrationsDir?: string } = {}): Repository {
  const cfg = parseDatabaseUrl(raw);
  return new SqliteRepository(cfg.filePath, opts);
}

// 개발 모드의 HMR에서도 연결이 중복 생성되지 않도록 globalThis에 보관한다
const g = globalThis as typeof globalThis & { __tlinkRepository?: Repository };

export function getRepository(): Repository {
  if (!g.__tlinkRepository) g.__tlinkRepository = createRepository(process.env.DATABASE_URL);
  return g.__tlinkRepository;
}

// ── 내보내기·이메일 라우트에서 한 줄로 붙이기 위한 편의 함수 ──
export const saveRecipient = (info: RecipientInput) => getRepository().saveRecipient(info);
export const logEmail = (e: EmailLogInput) => getRepository().logEmail(e);
export const logExport = (e: ExportLogInput) => getRepository().logExport(e);

/** DB 기록 실패가 본 기능(응답)을 막지 않게 감싼다. 서버 로그에는 오류 코드만 남긴다 */
export async function safeDb<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    const code =
      e instanceof AppError ? e.code : ((e as { code?: unknown })?.code as string | undefined) ?? "DB_ERROR";
    console.error(`[DB] ${label} 실패: ${String(code)}`);
    return null;
  }
}
