"use client";

// 간단한 모델 관리 페이지 (FR-ADM-01~04). 로그인 없이 ADMIN_TOKEN 일치 시에만 저장된다.
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Plug, Plus, Star, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ApiErrorBody, ModelsResponse, ProviderId } from "@/lib/api-types";

const TOKEN_STORAGE_KEY = "tlink-admin-token";

type TestState = { status: "running" } | { status: "ok"; text: string } | { status: "fail"; text: string };

type TestResponse = { ok: true; reply: string; elapsedMs: number } | ApiErrorBody;

const DEFAULT_LOCK_HINT = "기본 모델은 끄거나 삭제할 수 없습니다. 먼저 다른 모델을 기본(★)으로 지정해 주세요.";

/** 오류 코드, 메시지, 상세(HTTP 상태 등)를 한 줄로 만든다 */
function formatError(error: ApiErrorBody["error"]): string {
  const details = error.details?.length ? ` (${error.details.join("; ")})` : "";
  return `[${error.code}] ${error.message}${details}`;
}

function TestResult({ state }: { state?: TestState }) {
  if (!state || state.status === "running") return null;
  return (
    <p role="status" className={`mt-1 text-xs ${state.status === "ok" ? "text-green-700" : "text-red-600"}`}>
      {state.text}
    </p>
  );
}

export function AdminApp() {
  const [data, setData] = useState<ModelsResponse | null>(null);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [draftTest, setDraftTest] = useState<TestState | undefined>();
  const [form, setForm] = useState<{ id: string; provider: ProviderId; model: string; label: string }>({
    id: "",
    provider: "gemini",
    model: "",
    label: "",
  });

  async function load() {
    try {
      const res = await fetch("/api/models", { cache: "no-store" });
      const body = (await res.json()) as ModelsResponse | ApiErrorBody;
      if (!body.ok) throw new Error(body.error.message);
      setData(body);
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "목록을 불러오지 못했습니다." });
    }
  }

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setToken(saved);
    } catch {
      // 저장소를 쓸 수 없는 환경이면 무시
    }
    void load();
  }, []);

  function saveToken(v: string) {
    setToken(v);
    // 토큰을 고치면 이전 토큰 오류 안내가 남아 있지 않게 지운다
    setMessage((m) => (m?.kind === "error" ? null : m));
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, v);
    } catch {
      // 무시
    }
  }

  async function mutate(method: "POST" | "PUT" | "DELETE", body?: object, query?: string, okText?: string) {
    if (!token.trim()) {
      setMessage({ kind: "error", text: "관리자 토큰을 먼저 입력해 주세요." });
      return false;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/models${query ?? ""}`, {
        method,
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: body ? JSON.stringify(body) : undefined,
      });
      const resBody = (await res.json()) as ModelsResponse | ApiErrorBody;
      if (!resBody.ok) {
        setMessage({ kind: "error", text: formatError(resBody.error) });
        return false;
      }
      setData(resBody);
      setMessage({ kind: "ok", text: okText ?? "저장했습니다." });
      return true;
    } catch {
      setMessage({ kind: "error", text: "서버에 연결하지 못했습니다." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** 연결 테스트. 등록된 모델은 { id }, 추가 전 초안은 { provider, model }을 보낸다. */
  async function requestTest(payload: object): Promise<TestState> {
    if (!token.trim()) return { status: "fail", text: "관리자 토큰을 먼저 입력해 주세요." };
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as TestResponse;
      if (body.ok) {
        return { status: "ok", text: `연결 성공: 응답 "${body.reply}" · ${(body.elapsedMs / 1000).toFixed(1)}초` };
      }
      return { status: "fail", text: formatError(body.error) };
    } catch {
      return { status: "fail", text: "서버에 연결하지 못했습니다." };
    }
  }

  async function runTest(id: string) {
    setTests((t) => ({ ...t, [id]: { status: "running" } }));
    const result = await requestTest({ id });
    setTests((t) => ({ ...t, [id]: result }));
  }

  async function runDraftTest() {
    if (!form.model.trim()) {
      setDraftTest({ status: "fail", text: "모델 ID를 입력한 뒤 연결 테스트를 해 주세요." });
      return;
    }
    setDraftTest({ status: "running" });
    setDraftTest(await requestTest({ provider: form.provider, model: form.model.trim() }));
  }

  const defaultModel = data?.models.find((m) => m.isDefault);
  const formKeyMissing = data ? !data.keyStatus[form.provider] : false;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-brand">
        <ArrowLeft size={14} /> 스튜디오로 돌아가기
      </Link>
      <h1 className="text-2xl font-black">AI 모델 관리</h1>
      <p className="mt-1 text-sm text-muted">
        모델 등록·삭제·기본 모델 지정. 변경은 서버의 ADMIN_TOKEN과 같은 토큰을 입력해야 저장됩니다(config/ai-models.json).
      </p>

      {/* 토큰 */}
      <div className="mt-6 rounded-xl bg-white p-4 ring-1 ring-line">
        <label htmlFor="token" className="mb-1 flex items-center gap-1 text-sm font-semibold">
          <KeyRound size={14} /> 관리자 토큰
        </label>
        <input
          id="token"
          type="password"
          value={token}
          onChange={(e) => saveToken(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          placeholder="ADMIN_TOKEN 값"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-muted">
          토큰은 이 브라우저 탭(sessionStorage)에만 보관됩니다.
          {data && !data.adminTokenConfigured && (
            <span className="ml-1 font-semibold text-red-600">서버에 ADMIN_TOKEN이 설정되지 않아 저장할 수 없습니다.</span>
          )}
        </p>
      </div>

      {/* 키 상태 · 기본 모델 */}
      {data && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {(Object.keys(data.keyStatus) as ProviderId[]).map((p) => (
            <span key={p} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 ring-1 ring-line">
              {data.keyStatus[p] ? <CheckCircle2 size={14} className="text-green-600" /> : <XCircle size={14} className="text-red-500" />}
              {p === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"}: {data.keyStatus[p] ? "설정됨" : "미설정"}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 ring-1 ring-line">
            <Star size={14} className="fill-accent text-accent" />
            기본 모델: {defaultModel ? <b>{defaultModel.label}</b> : <b className="text-red-600">없음(사용 모델을 추가해 주세요)</b>}
          </span>
        </div>
      )}

      {message && (
        <p
          className={`mt-4 rounded-lg p-3 text-sm ${message.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
          role="status"
        >
          {message.text}
        </p>
      )}

      {/* 목록 */}
      <div className="mt-4 overflow-x-auto rounded-xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3">기본</th>
              <th className="px-4 py-3">표시명 / id</th>
              <th className="px-4 py-3">제공사</th>
              <th className="px-4 py-3">모델 ID</th>
              <th className="px-4 py-3">사용</th>
              <th className="px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody>
            {!data && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  불러오는 중…
                </td>
              </tr>
            )}
            {data?.models.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  등록된 모델이 없습니다. 아래에서 모델을 추가해 주세요.
                </td>
              </tr>
            )}
            {data?.models.map((m) => {
              const t = tests[m.id];
              return (
                <tr key={m.id} className="border-b border-line/60 align-top">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={busy || m.isDefault || !m.enabled}
                      onClick={() => {
                        // QA-03: 이번 화면에서 연결 테스트를 통과하지 않은 모델을 기본으로 바꿀 때는 한 번 더 확인한다
                        if (
                          t?.status !== "ok" &&
                          !confirm(
                            `${m.label}은(는) 이 화면에서 연결 테스트를 통과하지 않았습니다.
기본 모델이 되면 사용자 화면의 생성 요청이 모두 이 모델로 갑니다. 그래도 기본으로 지정할까요?
(먼저 [연결 테스트]를 눌러 확인하는 것을 권장합니다)`,
                          )
                        )
                          return;
                        void mutate("PUT", { id: m.id, isDefault: true }, undefined, `${m.label}을(를) 기본 모델로 지정했습니다.`);
                      }}
                      aria-label={m.isDefault ? "현재 기본 모델" : "기본 모델로 지정"}
                      title={m.isDefault ? "현재 기본 모델" : m.enabled ? "기본 모델로 지정" : "사용 중지된 모델은 기본으로 지정할 수 없습니다"}
                      className="disabled:cursor-default"
                    >
                      <Star size={18} className={m.isDefault ? "fill-accent text-accent" : "text-slate-300 hover:text-accent"} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">
                      {m.label}
                      {m.isDefault && <span className="ml-1 rounded bg-orange-50 px-1.5 py-0.5 text-[11px] text-accent">기본</span>}
                    </div>
                    <div className="text-xs text-muted">{m.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    {m.provider}
                    {!data.keyStatus[m.provider] && <div className="text-[11px] text-red-600">키 미설정</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{m.model}</td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      disabled={busy || m.isDefault}
                      title={m.isDefault ? DEFAULT_LOCK_HINT : undefined}
                      onChange={(e) =>
                        void mutate(
                          "PUT",
                          { id: m.id, enabled: e.target.checked },
                          undefined,
                          `${m.label}을(를) ${e.target.checked ? "사용" : "사용 중지"} 상태로 바꿨습니다.`,
                        )
                      }
                      aria-label="사용 여부"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void runTest(m.id)}
                        disabled={t?.status === "running"}
                        className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs hover:border-brand hover:text-brand"
                      >
                        {t?.status === "running" ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />} 연결 테스트
                      </button>
                      <button
                        type="button"
                        disabled={busy || m.isDefault}
                        title={m.isDefault ? DEFAULT_LOCK_HINT : undefined}
                        onClick={() => {
                          if (confirm(`${m.label} 모델을 삭제할까요?`)) {
                            void mutate("DELETE", undefined, `?id=${encodeURIComponent(m.id)}`, `${m.label}을(를) 삭제했습니다.`);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <Trash2 size={12} /> 삭제
                      </button>
                    </div>
                    <TestResult state={t} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">{DEFAULT_LOCK_HINT}</p>

      {/* 추가 */}
      <form
        className="mt-6 rounded-xl bg-white p-4 ring-1 ring-line"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await mutate(
            "POST",
            { ...form, model: form.model.trim(), id: form.id.trim(), label: form.label.trim(), enabled: true, isDefault: false },
            undefined,
            `${form.label.trim()} 모델을 추가했습니다. 메인 화면의 모델 선택에서 바로 고를 수 있습니다.`,
          );
          if (ok) {
            setForm({ id: "", provider: form.provider, model: "", label: "" });
            setDraftTest(undefined);
          }
        }}
      >
        <h2 className="mb-3 flex items-center gap-1 font-bold">
          <Plus size={16} /> 모델 추가
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">제공사</span>
            <select
              value={form.provider}
              onChange={(e) => {
                setForm({ ...form, provider: e.target.value as ProviderId });
                setDraftTest(undefined);
              }}
              className="w-full rounded-lg border border-line bg-white px-3 py-2"
            >
              <option value="gemini">gemini</option>
              <option value="openai">openai</option>
            </select>
            {formKeyMissing && (
              <span className="mt-1 block text-xs text-red-600">
                이 제공사의 API 키가 미설정입니다. 추가는 되지만 생성·연결 테스트는 실패합니다.
              </span>
            )}
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">모델 ID (제공사 API 기준)</span>
            <input
              required
              value={form.model}
              onChange={(e) => {
                setForm({ ...form, model: e.target.value });
                setDraftTest(undefined);
              }}
              placeholder={form.provider === "gemini" ? "예: gemini-3.8-pro" : "예: gpt-4o-mini"}
              className="w-full rounded-lg border border-line px-3 py-2 font-mono"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">표시명</span>
            <input
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="예: Gemini 3.8 Pro"
              className="w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">id (영문 소문자·숫자·-·_·.)</span>
            <input
              required
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              placeholder="예: gemini-pro"
              className="w-full rounded-lg border border-line px-3 py-2 font-mono"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-[#2449c4] disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 추가
          </button>
          <button
            type="button"
            onClick={() => void runDraftTest()}
            disabled={draftTest?.status === "running"}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-4 py-2 text-sm hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {draftTest?.status === "running" ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />} 추가 전 연결 테스트
          </button>
        </div>
        <TestResult state={draftTest} />
      </form>

      <p className="mt-6 text-xs text-muted">
        참고: JSON 파일 저장 방식이므로 로컬이나 단일 서버에서 실행할 때만 변경이 유지됩니다(서버리스 배포 환경에서는 저장되지 않음).
        연결 테스트는 실제 API를 호출하므로 소량의 과금이 발생할 수 있습니다.
      </p>
    </div>
  );
}
