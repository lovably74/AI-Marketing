// SQLite 저장소 구현 — Node 내장 node:sqlite(DatabaseSync). 네이티브 모듈·ORM 없음.
// SQL은 PostgreSQL로 옮기기 쉬운 표준 형태(? 자리표시자 → PG에서는 $1.. 로 치환)로 쓴다.
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  EmailLogEntry,
  EmailLogInput,
  ExportLogEntry,
  ExportLogInput,
  GenerationDetail,
  GenerationImage,
  GenerationSummary,
  NewGeneration,
  Recipient,
  RecipientInput,
  RecipientSummary,
  Repository,
} from "./types";

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const nil = <T>(v: T | undefined): T | null => (v === undefined ? null : v);
const now = () => new Date().toISOString();

function parseJson(v: unknown): unknown {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export const MAX_LIST_LIMIT = 100;
/** 이력 조회(메일·수신자·내보내기) 목록 최대 건수 */
export const MAX_HISTORY_LIMIT = 200;

/** 마이그레이션 SQL 폴더(기본: <cwd>/src/lib/db/migrations). *.postgres.sql은 제외 */
export function defaultMigrationsDir(): string {
  return path.join(process.cwd(), "src", "lib", "db", "migrations");
}

export class SqliteRepository implements Repository {
  private readonly db: DatabaseSync;

  constructor(filePath: string, opts: { migrationsDir?: string } = {}) {
    if (filePath !== ":memory:") mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.migrate(opts.migrationsDir ?? defaultMigrationsDir());
  }

  /** schema_migrations로 버전을 관리하며 미적용 마이그레이션을 순서대로 적용한다 */
  private migrate(dir: string): void {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    const applied = new Set(
      (this.db.prepare("SELECT version FROM schema_migrations").all() as Row[]).map((r) => String(r.version)),
    );
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql") && !f.endsWith(".postgres.sql"))
      .sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      if (applied.has(version)) continue;
      const sql = readFileSync(path.join(dir, file), "utf8");
      this.db.exec("BEGIN");
      try {
        this.db.exec(sql);
        this.db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(version, now());
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
    }
  }

  appliedMigrations(): string[] {
    return (this.db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Row[]).map((r) =>
      String(r.version),
    );
  }

  async saveGeneration(g: NewGeneration): Promise<string> {
    const id = randomUUID();
    const image = g.image ?? null;
    this.db
      .prepare(
        `INSERT INTO generations (id, created_at, status, error_code, product_name, product_info, target_customer,
          model_id, provider, model, is_tlink, attempts, elapsed_ms, image_mime, image_size, image_sha256, image_blob,
          result_json, guideline_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        now(),
        g.status,
        nil(g.errorCode),
        nil(g.productName),
        nil(g.productInfo),
        nil(g.targetCustomer),
        nil(g.modelId),
        nil(g.provider),
        nil(g.model),
        g.isTlink === null || g.isTlink === undefined ? null : g.isTlink ? 1 : 0,
        nil(g.attempts),
        nil(g.elapsedMs),
        nil(g.imageMime),
        image ? image.byteLength : null,
        image ? createHash("sha256").update(image).digest("hex") : null,
        image,
        g.result === undefined ? null : JSON.stringify(g.result),
        g.guidelineCheck === undefined ? null : JSON.stringify(g.guidelineCheck),
      );
    return id;
  }

  private toSummary(r: Row): GenerationSummary {
    return {
      id: String(r.id),
      createdAt: String(r.created_at),
      status: r.status === "success" ? "success" : "error",
      errorCode: str(r.error_code),
      productName: str(r.product_name),
      modelId: str(r.model_id),
      provider: str(r.provider),
      model: str(r.model),
    };
  }

  async getGeneration(id: string): Promise<GenerationDetail | null> {
    const r = this.db
      .prepare(
        `SELECT id, created_at, status, error_code, product_name, product_info, target_customer, model_id, provider,
          model, is_tlink, attempts, elapsed_ms, image_mime, image_size, image_sha256, result_json, guideline_json
         FROM generations WHERE id = ?`,
      )
      .get(id) as Row | undefined;
    if (!r) return null;
    return {
      ...this.toSummary(r),
      productInfo: str(r.product_info),
      targetCustomer: str(r.target_customer),
      isTlink: r.is_tlink === null || r.is_tlink === undefined ? null : Number(r.is_tlink) === 1,
      attempts: num(r.attempts),
      elapsedMs: num(r.elapsed_ms),
      imageMime: str(r.image_mime),
      imageSize: num(r.image_size),
      imageSha256: str(r.image_sha256),
      result: parseJson(r.result_json),
      guidelineCheck: parseJson(r.guideline_json),
    };
  }

  async getGenerationImage(id: string): Promise<GenerationImage | null> {
    const r = this.db.prepare("SELECT image_mime, image_blob FROM generations WHERE id = ?").get(id) as
      | Row
      | undefined;
    if (!r || !(r.image_blob instanceof Uint8Array)) return null;
    return { mime: str(r.image_mime) ?? "application/octet-stream", data: r.image_blob };
  }

  async listGenerations(limit = 20): Promise<GenerationSummary[]> {
    const n = Math.min(Math.max(1, Math.trunc(Number(limit) || 20)), MAX_LIST_LIMIT);
    const rows = this.db
      .prepare(
        `SELECT id, created_at, status, error_code, product_name, model_id, provider, model
         FROM generations ORDER BY created_at DESC LIMIT ?`,
      )
      .all(n) as Row[];
    return rows.map((r) => this.toSummary(r));
  }

  async saveRecipient(input: RecipientInput): Promise<string> {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new Error("recipient email is required");
    const t = now();
    // 표준 UPSERT(SQLite 3.24+ / PostgreSQL 9.5+ 공통 문법)
    const r = this.db
      .prepare(
        `INSERT INTO recipients (id, created_at, updated_at, name, company, title, department, email, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (email) DO UPDATE SET
           updated_at = excluded.updated_at, name = excluded.name, company = excluded.company,
           title = excluded.title, department = excluded.department, phone = excluded.phone
         RETURNING id`,
      )
      .get(
        randomUUID(),
        t,
        t,
        nil(input.name),
        nil(input.company),
        nil(input.title),
        nil(input.department),
        email,
        nil(input.phone),
      ) as Row;
    return String(r.id);
  }

  async getRecipient(id: string): Promise<Recipient | null> {
    const r = this.db.prepare("SELECT * FROM recipients WHERE id = ?").get(id) as Row | undefined;
    if (!r) return null;
    return {
      id: String(r.id),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      name: str(r.name),
      company: str(r.company),
      title: str(r.title),
      department: str(r.department),
      email: String(r.email),
      phone: str(r.phone),
    };
  }

  async logEmail(e: EmailLogInput): Promise<string> {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO email_logs (id, created_at, generation_id, recipient_id, subject, body, status, message_id, error_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        now(),
        nil(e.generationId),
        nil(e.recipientId),
        nil(e.subject),
        nil(e.body),
        e.status,
        nil(e.messageId),
        nil(e.errorCode),
      );
    return id;
  }

  async logExport(e: ExportLogInput): Promise<string> {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO export_logs (id, created_at, generation_id, format, recipient_id) VALUES (?, ?, ?, ?, ?)")
      .run(id, now(), nil(e.generationId), e.format, nil(e.recipientId));
    return id;
  }

  private historyLimit(limit: number | undefined): number {
    return Math.min(Math.max(1, Math.trunc(Number(limit) || 50)), MAX_HISTORY_LIMIT);
  }

  async listEmailLogs(limit = 50): Promise<EmailLogEntry[]> {
    const rows = this.db
      .prepare(
        `SELECT e.id, e.created_at, e.status, e.generation_id, e.recipient_id, e.subject, e.body, e.message_id,
          e.error_code, r.name AS r_name, r.company AS r_company, r.department AS r_department, r.title AS r_title,
          r.email AS r_email, r.phone AS r_phone
         FROM email_logs e LEFT JOIN recipients r ON r.id = e.recipient_id
         ORDER BY e.created_at DESC LIMIT ?`,
      )
      .all(this.historyLimit(limit)) as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      createdAt: String(r.created_at),
      status: r.status === "sent" ? "sent" : "failed",
      generationId: str(r.generation_id),
      recipientId: str(r.recipient_id),
      recipientName: str(r.r_name),
      recipientCompany: str(r.r_company),
      recipientDepartment: str(r.r_department),
      recipientTitle: str(r.r_title),
      recipientEmail: str(r.r_email),
      recipientPhone: str(r.r_phone),
      subject: str(r.subject),
      body: str(r.body),
      messageId: str(r.message_id),
      errorCode: str(r.error_code),
    }));
  }

  async listRecipients(limit = 50): Promise<RecipientSummary[]> {
    const rows = this.db
      .prepare(
        `SELECT r.id, r.created_at, r.updated_at, r.name, r.company, r.title, r.department, r.email, r.phone,
          (SELECT COUNT(*) FROM email_logs e WHERE e.recipient_id = r.id) AS email_count
         FROM recipients r ORDER BY r.updated_at DESC LIMIT ?`,
      )
      .all(this.historyLimit(limit)) as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      name: str(r.name),
      company: str(r.company),
      title: str(r.title),
      department: str(r.department),
      email: String(r.email),
      phone: str(r.phone),
      emailCount: Number(r.email_count ?? 0),
    }));
  }

  async listExportLogs(limit = 50): Promise<ExportLogEntry[]> {
    const rows = this.db
      .prepare(
        `SELECT x.id, x.created_at, x.format, x.generation_id, x.recipient_id, r.email AS r_email
         FROM export_logs x LEFT JOIN recipients r ON r.id = x.recipient_id
         ORDER BY x.created_at DESC LIMIT ?`,
      )
      .all(this.historyLimit(limit)) as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      createdAt: String(r.created_at),
      format: String(r.format),
      generationId: str(r.generation_id),
      recipientId: str(r.recipient_id),
      recipientEmail: str(r.r_email),
    }));
  }

  /** 시험·점검용 단순 조회 (운영 API에는 노출하지 않음) */
  countRows(table: "generations" | "recipients" | "email_logs" | "export_logs"): number {
    return Number((this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as Row).n);
  }

  close(): void {
    this.db.close();
  }
}
