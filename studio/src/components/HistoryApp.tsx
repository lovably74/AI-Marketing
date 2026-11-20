"use client";

// 발송 이력 화면 — 외부로 발송한 메일, 수신 고객, 내보내기, AI 생성 이력을 관리자 토큰으로 조회한다.
// 실제 저장소 데이터만 표시한다(예시·가짜 데이터 없음).
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { BLIND_SPOTS } from "@/lib/constants";

const TOKEN_STORAGE_KEY = "tlink-admin-token";

type Tab = "emails" | "recipients" | "exports" | "generations";

const TABS: { id: Tab; label: string; url: string }[] = [
  { id: "emails", label: "메일 발송 이력", url: "/api/history/emails?limit=100" },
  { id: "generations", label: "콘텐츠 생성 이력", url: "/api/history?limit=100" },
  { id: "recipients", label: "수신 고객", url: "/api/history/recipients?limit=100" },
  { id: "exports", label: "내보내기 이력", url: "/api/history/exports?limit=100" },
];

const isTab = (v: string | null): v is Tab => TABS.some((t) => t.id === v);

const FORMAT_LABEL: Record<string, string> = { pdf: "PDF", docx: "Word", pptx: "PowerPoint", xlsx: "Excel", zip: "ZIP" };
const PURPOSE_LABEL: Record<string, string> = { preview: "미리보기", email: "메일 첨부" };

/** export_logs.format("pdf", "pdf:preview", "pdf:email" 등)을 읽기 쉬운 표기로 바꾼다 */
function formatExport(raw: string): string {
  const [fmtId, purpose] = raw.split(":");
  const name = FORMAT_LABEL[fmtId] ?? fmtId.toUpperCase();
  if (!purpose || purpose === "download") return `${name} 다운로드`;
  return `${name}(${PURPOSE_LABEL[purpose] ?? purpose})`;
}

interface EmailRow {
  id: string;
  createdAt: string;
  status: "sent" | "failed";
  generationId: string | null;
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
interface RecipientRow {
  id: string;
  name: string | null;
  company: string | null;
  department: string | null;
  title: string | null;
  email: string;
  phone: string | null;
  updatedAt: string;
  emailCount: number;
}
interface ExportRow {
  id: string;
  createdAt: string;
  format: string;
  generationId: string | null;
  recipientEmail: string | null;
}
interface GenerationRow {
  id: string;
  createdAt: string;
  status: "success" | "error";
  errorCode: string | null;
  productName: string | null;
  modelId: string | null;
  provider: string | null;
  model: string | null;
}

type ApiError = { kind: "auth" | "other"; message: string };

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ko-KR", { hour12: false });
}
const dash = (v: string | null | undefined) => (v && v.trim() ? v : "-");

async function apiGet<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { "x-admin-token": token }, cache: "no-store" });
  const body = (await res.json().catch(() => null)) as
    | { ok: true }
    | { ok: false; error: { message: string } }
    | null;
  if (res.status === 401) {
    const err: ApiError = { kind: "auth", message: "관리자 토큰이 올바르지 않습니다. 토큰을 다시 입력해 주세요." };
    throw err;
  }
  if (!res.ok || !body || !body.ok) {
    const msg = body && !body.ok ? body.error.message : `요청에 실패했습니다(HTTP ${res.status}).`;
    const err: ApiError = { kind: "other", message: msg };
    throw err;
  }
  return body as T;
}

function toApiError(e: unknown): ApiError {
  if (e && typeof e === "object" && "kind" in e && "message" in e) return e as ApiError;
  return { kind: "other", message: e instanceof Error ? e.message : "목록을 불러오지 못했습니다." };
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${
        ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}
    >
      {label}
    </span>
  );
}

const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-bold text-muted";
const td = "px-3 py-2 align-top";

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

function EmailsTable({ items, onShowGeneration }: { items: EmailRow[]; onShowGeneration: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <TableWrap>
      <thead className="bg-slate-50">
        <tr>
          <th className={th} />
          <th className={th}>시각</th>
          <th className={th}>상태</th>
          <th className={th}>수신자</th>
          <th className={th}>제목</th>
        </tr>
      </thead>
      <tbody>
        {items.map((e) => {
          const isOpen = open === e.id;
          return (
            <Fragment key={e.id}>
              <tr
                className="cursor-pointer border-t border-line hover:bg-slate-50"
                onClick={() => setOpen(isOpen ? null : e.id)}
                aria-expanded={isOpen}
              >
                <td className={td}>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                <td className={`${td} whitespace-nowrap`}>{fmt(e.createdAt)}</td>
                <td className={td}>
                  <StatusBadge ok={e.status === "sent"} label={e.status} />
                </td>
                <td className={td}>
                  <div className="font-semibold">{dash(e.recipientName)}</div>
                  <div className="text-xs text-muted">{dash(e.recipientEmail)}</div>
                </td>
                <td className={`${td} break-all`}>{dash(e.subject)}</td>
              </tr>
              {isOpen && (
                <tr className="border-t border-line bg-slate-50/60">
                  <td className={td} />
                  <td className={td} colSpan={4}>
                    <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
                      <dt className="text-muted">수신자</dt>
                      <dd className="break-all">
                        {[e.recipientName, e.recipientCompany, e.recipientDepartment, e.recipientTitle]
                          .filter(Boolean)
                          .join(" · ") || "-"}{" "}
                        / {dash(e.recipientEmail)} / {dash(e.recipientPhone)}
                      </dd>
                      <dt className="text-muted">messageId</dt>
                      <dd className="break-all font-mono">{dash(e.messageId)}</dd>
                      <dt className="text-muted">오류 코드</dt>
                      <dd className="font-mono">{dash(e.errorCode)}</dd>
                      <dt className="text-muted">연결된 생성 건</dt>
                      <dd className="break-all">
                        {e.generationId ? (
                          <button
                            type="button"
                            onClick={() => onShowGeneration(e.generationId as string)}
                            className="rounded-md border border-brand px-2 py-0.5 font-bold text-brand hover:bg-brand hover:text-white"
                          >
                            생성 이력 보기
                          </button>
                        ) : (
                          "-"
                        )}
                      </dd>
                    </dl>
                    <div className="mt-2 text-xs text-muted">본문</div>
                    <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-white p-3 font-sans text-xs">
                      {e.body ?? "(본문 없음)"}
                    </pre>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </TableWrap>
  );
}

function RecipientsTable({ items }: { items: RecipientRow[] }) {
  return (
    <TableWrap>
      <thead className="bg-slate-50">
        <tr>
          {["이름", "회사", "부서", "직함", "이메일", "연락처", "발송 건수", "최근 갱신"].map((h) => (
            <th key={h} className={th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((r) => (
          <tr key={r.id} className="border-t border-line">
            <td className={`${td} font-semibold`}>{dash(r.name)}</td>
            <td className={td}>{dash(r.company)}</td>
            <td className={td}>{dash(r.department)}</td>
            <td className={td}>{dash(r.title)}</td>
            <td className={`${td} break-all`}>{r.email}</td>
            <td className={`${td} whitespace-nowrap`}>{dash(r.phone)}</td>
            <td className={`${td} text-right`}>{r.emailCount}</td>
            <td className={`${td} whitespace-nowrap`}>{fmt(r.updatedAt)}</td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

function ExportsTable({ items }: { items: ExportRow[] }) {
  return (
    <TableWrap>
      <thead className="bg-slate-50">
        <tr>
          <th className={th}>시각</th>
          <th className={th}>형식</th>
          <th className={th}>수신자 이메일</th>
          <th className={th}>생성 ID</th>
        </tr>
      </thead>
      <tbody>
        {items.map((x) => (
          <tr key={x.id} className="border-t border-line">
            <td className={`${td} whitespace-nowrap`}>{fmt(x.createdAt)}</td>
            <td className={`${td} whitespace-nowrap font-semibold`} title={x.format}>
              {formatExport(x.format)}
            </td>
            <td className={`${td} break-all`}>{dash(x.recipientEmail)}</td>
            <td className={`${td} break-all font-mono text-xs`}>{dash(x.generationId)}</td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

interface GenerationDetailData {
  sceneAnalysis?: string;
  differentiators: { feature: string; customerBenefit: string; executiveValue?: string }[];
  headlines: string[];
  /** CEO 영업 사각지대(새 응답 형식에만 있음) */
  campaign: {
    probableEnvironment?: string;
    potentialIssue?: string;
    spots: { label: string; hypothesis?: string; question?: string }[];
  } | null;
  blogTitle?: string;
  cardHeadline?: string;
  cardSubtext?: string;
  guideline: { applicable: boolean; passed: boolean; warnings: string[] } | null;
}

const asStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function parseDetail(result: unknown, guidelineCheck: unknown): GenerationDetailData {
  const r = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  const g = (guidelineCheck && typeof guidelineCheck === "object" ? guidelineCheck : null) as Record<
    string,
    unknown
  > | null;
  return {
    sceneAnalysis: asStr(r.sceneAnalysis),
    differentiators: Array.isArray(r.differentiators)
      ? r.differentiators.map((d) => {
          const o = (d ?? {}) as Record<string, unknown>;
          return {
            feature: asStr(o.feature) ?? "-",
            customerBenefit: asStr(o.customerBenefit) ?? "",
            executiveValue: asStr(o.executiveValue),
          };
        })
      : [],
    campaign: parseCampaign(r.campaign),
    headlines: Array.isArray(r.headlines) ? r.headlines.filter((h): h is string => typeof h === "string") : [],
    blogTitle: asStr(r.blogTitle),
    cardHeadline: asStr(r.cardHeadline),
    cardSubtext: asStr(r.cardSubtext),
    guideline: g
      ? {
          applicable: g.applicable === true,
          passed: g.passed === true,
          warnings: Array.isArray(g.warnings)
            ? g.warnings.map((w) => asStr((w as Record<string, unknown> | null)?.label) ?? "").filter(Boolean)
            : [],
        }
      : null,
  };
}

function parseCampaign(value: unknown): GenerationDetailData["campaign"] {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  const spots = (c.blindSpots && typeof c.blindSpots === "object" ? c.blindSpots : {}) as Record<string, unknown>;
  return {
    probableEnvironment: asStr(c.probableEnvironment),
    potentialIssue: asStr(c.potentialIssue),
    spots: BLIND_SPOTS.map(({ id, label }) => {
      const s = (spots[id] && typeof spots[id] === "object" ? spots[id] : {}) as Record<string, unknown>;
      return { label, hypothesis: asStr(s.hypothesis), question: asStr(s.question) };
    }),
  };
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-bold text-muted">{label}</div>
      <div className="mt-0.5 break-words text-sm">{children}</div>
    </div>
  );
}

function GenerationDetailView({ id, token }: { id: string; token: string }) {
  const [detail, setDetail] = useState<GenerationDetailData | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      try {
        const body = await apiGet<{ item: { result: unknown; guidelineCheck: unknown } }>(
          `/api/history/${encodeURIComponent(id)}`,
          token,
        );
        if (!cancelled) setDetail(parseDetail(body.item.result, body.item.guidelineCheck));
      } catch (e) {
        if (!cancelled) setError(toApiError(e).message);
      }
      try {
        const res = await fetch(`/api/history/${encodeURIComponent(id)}/image`, {
          headers: { "x-admin-token": token },
          cache: "no-store",
        });
        if (res.ok) {
          url = URL.createObjectURL(await res.blob());
          if (cancelled) URL.revokeObjectURL(url);
          else setImgUrl(url);
        }
      } catch {
        // 이미지가 없으면 표시하지 않는다
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, token]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {imgUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl} alt="현장 사진 썸네일" className="h-32 w-32 shrink-0 rounded-lg border border-line object-cover" />
      ) : (
        <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
          이미지 없음
        </div>
      )}
      <div className="grid min-w-0 flex-1 gap-3">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !detail ? (
          <p className="text-sm text-muted">불러오는 중…</p>
        ) : (
          <>
            <DetailItem label="가이드라인 점검">
              {!detail.guideline ? (
                "-"
              ) : !detail.guideline.applicable ? (
                <span className="text-muted">해당 없음(티링크 외 제품)</span>
              ) : (
                <>
                  <StatusBadge ok={detail.guideline.passed} label={detail.guideline.passed ? "통과" : "미통과"} />
                  {detail.guideline.warnings.length > 0 && (
                    <span className="ml-2 text-xs text-muted">경고: {detail.guideline.warnings.join(", ")}</span>
                  )}
                </>
              )}
            </DetailItem>
            <DetailItem label="현장 분석">
              <span className="whitespace-pre-wrap">{dash(detail.sceneAnalysis)}</span>
            </DetailItem>
            {detail.campaign && (
              <DetailItem label="CEO 영업 사각지대(가설)">
                <div className="text-muted">{dash(detail.campaign.probableEnvironment)}</div>
                <div className="text-muted">{dash(detail.campaign.potentialIssue)}</div>
                <ul className="mt-1 space-y-1">
                  {detail.campaign.spots.map((s) => (
                    <li key={s.label}>
                      <span className="font-semibold">{s.label}</span>
                      {s.hypothesis && <span> — {s.hypothesis}</span>}
                      {s.question && <span className="block text-xs text-muted">확인 질문: {s.question}</span>}
                    </li>
                  ))}
                </ul>
              </DetailItem>
            )}
            <DetailItem label="기술 강점">
              {detail.differentiators.length === 0 ? (
                "-"
              ) : (
                <ol className="list-decimal space-y-1 pl-5">
                  {detail.differentiators.map((d, i) => (
                    <li key={i}>
                      <span className="font-semibold">{d.feature}</span>
                      {d.customerBenefit && <span className="text-muted"> — {d.customerBenefit}</span>}
                      {d.executiveValue && <span className="block text-xs text-muted">경영 가치: {d.executiveValue}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </DetailItem>
            <DetailItem label="홍보 제목">
              {detail.headlines.length === 0 ? (
                "-"
              ) : (
                <ol className="list-decimal space-y-0.5 pl-5">
                  {detail.headlines.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ol>
              )}
            </DetailItem>
            <DetailItem label="블로그 제목">{dash(detail.blogTitle)}</DetailItem>
            <DetailItem label="카드 제목 · 부제">
              <div className="font-semibold">{dash(detail.cardHeadline)}</div>
              <div className="text-muted">{dash(detail.cardSubtext)}</div>
            </DetailItem>
            <div className="break-all font-mono text-xs text-muted">생성 ID {id}</div>
          </>
        )}
      </div>
    </div>
  );
}

function GenerationsTable({
  items,
  token,
  open,
  setOpen,
}: {
  items: GenerationRow[];
  token: string;
  open: string | null;
  setOpen: (id: string | null) => void;
}) {
  useEffect(() => {
    if (open) document.getElementById(`gen-${open}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [open]);
  return (
    <TableWrap>
      <thead className="bg-slate-50">
        <tr>
          <th className={th} />
          <th className={th}>시각</th>
          <th className={th}>제품명</th>
          <th className={th}>모델</th>
          <th className={th}>상태</th>
        </tr>
      </thead>
      <tbody>
        {items.map((g) => {
          const isOpen = open === g.id;
          return (
            <Fragment key={g.id}>
              <tr
                id={`gen-${g.id}`}
                className="cursor-pointer border-t border-line hover:bg-slate-50"
                onClick={() => setOpen(isOpen ? null : g.id)}
                aria-expanded={isOpen}
              >
                <td className={td}>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                <td className={`${td} whitespace-nowrap`}>{fmt(g.createdAt)}</td>
                <td className={td}>{dash(g.productName)}</td>
                <td className={td}>
                  <div>{dash(g.modelId)}</div>
                  <div className="text-xs text-muted">{[g.provider, g.model].filter(Boolean).join(" / ")}</div>
                </td>
                <td className={td}>
                  <StatusBadge
                    ok={g.status === "success"}
                    label={g.status === "success" ? "성공" : `실패${g.errorCode ? ` (${g.errorCode})` : ""}`}
                  />
                </td>
              </tr>
              {isOpen && (
                <tr className="border-t border-line bg-slate-50/60">
                  <td className={td} colSpan={5}>
                    <GenerationDetailView id={g.id} token={token} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </TableWrap>
  );
}

export function HistoryApp() {
  // useSearchParams 때문에 이 컴포넌트는 클라이언트에서만 렌더링된다(Suspense 경계) → sessionStorage를 초기값으로 바로 읽는다
  const [token, setToken] = useState(() => {
    try {
      return typeof window === "undefined" ? "" : (sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "");
    } catch {
      return ""; // 저장소를 쓸 수 없는 환경이면 무시
    }
  });
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("tab");
  const tab: Tab = isTab(q) ? q : "emails";
  const [openGen, setOpenGen] = useState<string | null>(null);

  function setTab(t: Tab) {
    router.replace(`/history?tab=${t}`, { scroll: false });
  }

  function showGeneration(id: string) {
    setOpenGen(id);
    setTab("generations");
  }
  const [items, setItems] = useState<unknown[] | null>(null);
  const [loadedTab, setLoadedTab] = useState<Tab | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  function saveToken(v: string) {
    setToken(v);
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, v);
    } catch {
      // 무시
    }
  }

  const load = useCallback(
    async (t: Tab) => {
      const tk = token.trim();
      if (!tk) return;
      setLoading(true);
      setError(null);
      try {
        const url = TABS.find((x) => x.id === t)?.url ?? TABS[0].url;
        const body = await apiGet<{ items: unknown[] }>(url, tk);
        setItems(body.items);
        setLoadedTab(t);
      } catch (e) {
        setItems(null);
        setLoadedTab(null);
        setError(toApiError(e));
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  // 탭 전환 시 자동 조회(토큰 입력 중에는 새로고침 버튼으로 조회)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const shown = loadedTab === tab ? items : null;

  return (
    <div className="flex min-h-full flex-col">
      <header className="bg-gradient-to-br from-navy via-navy-deep to-[#1d3a8a] text-white">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-4 py-6 sm:px-6">
          <div className="min-w-0">
            <div className="mb-2 text-lg font-black tracking-wider">
              T<span className="text-accent">·</span>
              <span className="text-brand-light">LINK</span>
            </div>
            <h1 className="text-xl font-black sm:text-3xl">발송·생성 이력</h1>
            <p className="mt-1 text-sm text-[#DCE6FF]">외부로 발송한 메일·수신 고객·내보내기·AI 생성 이력</p>
          </div>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/30 px-3 py-1.5 text-xs text-white/90 hover:bg-white/10"
          >
            <ArrowLeft size={14} /> 스튜디오
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>고객 개인정보가 포함된 화면입니다. 화면 공유·캡처·외부 반출에 주의해 주세요.</span>
        </div>

        <form
          className="mb-4 rounded-xl border border-line bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void load(tab);
          }}
        >
          <label htmlFor="admin-token" className="mb-1 block text-sm font-bold text-navy">
            관리자 토큰
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="admin-token"
              type="password"
              value={token}
              onChange={(e) => saveToken(e.target.value)}
              placeholder="ADMIN_TOKEN 입력"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-navy disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 새로고침
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">토큰은 이 브라우저 탭(sessionStorage)에만 보관됩니다.</p>
        </form>

        <div role="tablist" className="mb-3 flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-bold ${
                tab === t.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-navy"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!token.trim() ? (
          <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
            관리자 토큰을 입력한 뒤 새로고침을 누르면 이력이 표시됩니다.
          </p>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error.message}
            {error.kind === "auth" && (
              <div className="mt-1 text-xs">위 입력란에 올바른 관리자 토큰을 다시 입력한 뒤 새로고침을 눌러 주세요.</div>
            )}
          </div>
        ) : !shown ? (
          <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
            {loading ? "불러오는 중…" : "새로고침을 눌러 이력을 조회해 주세요."}
          </p>
        ) : shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
            기록된 이력이 없습니다.
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted">최근 {shown.length}건 (행을 누르면 상세가 펼쳐집니다)</p>
            {tab === "emails" && <EmailsTable items={shown as EmailRow[]} onShowGeneration={showGeneration} />}
            {tab === "recipients" && <RecipientsTable items={shown as RecipientRow[]} />}
            {tab === "exports" && <ExportsTable items={shown as ExportRow[]} />}
            {tab === "generations" && (
              <GenerationsTable items={shown as GenerationRow[]} token={token.trim()} open={openGen} setOpen={setOpenGen} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
