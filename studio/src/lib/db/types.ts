// 저장소(Repository) 인터페이스 — DB 종류(SQLite/PostgreSQL)와 무관한 계약.
// 구현체: sqlite.ts (현재), postgres.ts (향후). 선택은 index.ts의 getRepository()가 DATABASE_URL로 한다.

export type GenerationStatus = "success" | "error";

export interface NewGeneration {
  status: GenerationStatus;
  errorCode?: string | null;
  productName?: string | null;
  productInfo?: string | null;
  targetCustomer?: string | null;
  modelId?: string | null;
  provider?: string | null;
  model?: string | null;
  isTlink?: boolean | null;
  attempts?: number | null;
  elapsedMs?: number | null;
  imageMime?: string | null;
  /** 원본 사진 바이트. 저장 시 크기·SHA-256을 자동 계산한다 */
  image?: Uint8Array | null;
  /** JSON 직렬화 가능한 값(결과/가이드라인 점검) */
  result?: unknown;
  guidelineCheck?: unknown;
}

/** 목록용 요약(이미지 BLOB·결과 본문 제외) */
export interface GenerationSummary {
  id: string;
  createdAt: string;
  status: GenerationStatus;
  errorCode: string | null;
  productName: string | null;
  modelId: string | null;
  provider: string | null;
  model: string | null;
}

/** 상세(이미지 BLOB 제외 — 이미지는 getGenerationImage로 따로 조회) */
export interface GenerationDetail extends GenerationSummary {
  productInfo: string | null;
  targetCustomer: string | null;
  isTlink: boolean | null;
  attempts: number | null;
  elapsedMs: number | null;
  imageMime: string | null;
  imageSize: number | null;
  imageSha256: string | null;
  result: unknown;
  guidelineCheck: unknown;
}

export interface GenerationImage {
  mime: string;
  data: Uint8Array;
}

export interface RecipientInput {
  name?: string | null;
  company?: string | null;
  title?: string | null;
  department?: string | null;
  email: string;
  phone?: string | null;
}

export interface Recipient {
  id: string;
  name: string | null;
  company: string | null;
  title: string | null;
  department: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailLogInput {
  generationId?: string | null;
  recipientId?: string | null;
  subject?: string | null;
  body?: string | null;
  status: "sent" | "failed";
  messageId?: string | null;
  errorCode?: string | null;
}

export interface ExportLogInput {
  generationId?: string | null;
  format: string;
  recipientId?: string | null;
}

/** 발송 메일 이력(email_logs + recipients 조인) */
export interface EmailLogEntry {
  id: string;
  createdAt: string;
  status: "sent" | "failed";
  generationId: string | null;
  recipientId: string | null;
  recipientName: string | null;
  recipientCompany: string | null;
  recipientDepartment: string | null;
  recipientTitle: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  subject: string | null;
  body: string | null;
  messageId: string | null;
  errorCode: string | null;
}

/** 수신 고객 + 발송 건수 */
export interface RecipientSummary extends Recipient {
  emailCount: number;
}

/** 내보내기 이력(export_logs + recipients 조인) */
export interface ExportLogEntry {
  id: string;
  createdAt: string;
  format: string;
  generationId: string | null;
  recipientId: string | null;
  recipientEmail: string | null;
}

/** 모든 메서드는 비동기(Promise) — PostgreSQL 등 비동기 드라이버로 바꿔도 호출부가 그대로 동작하게 한다 */
export interface Repository {
  /** 생성 이력 저장 → 새 id */
  saveGeneration(input: NewGeneration): Promise<string>;
  getGeneration(id: string): Promise<GenerationDetail | null>;
  getGenerationImage(id: string): Promise<GenerationImage | null>;
  listGenerations(limit?: number): Promise<GenerationSummary[]>;
  /** 같은 email(대소문자 무시)이면 갱신(upsert) → recipient id */
  saveRecipient(input: RecipientInput): Promise<string>;
  getRecipient(id: string): Promise<Recipient | null>;
  logEmail(input: EmailLogInput): Promise<string>;
  logExport(input: ExportLogInput): Promise<string>;
  /** 발송 메일 이력(최신순) */
  listEmailLogs(limit?: number): Promise<EmailLogEntry[]>;
  /** 수신 고객(최근 갱신순, 발송 건수 포함) */
  listRecipients(limit?: number): Promise<RecipientSummary[]>;
  /** 내보내기 이력(최신순) */
  listExportLogs(limit?: number): Promise<ExportLogEntry[]>;
  close(): void;
}
