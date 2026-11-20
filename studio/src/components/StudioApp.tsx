"use client";

import {
  AlertCircle,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiErrorBody, GenerateSuccess, ModelsResponse } from "@/lib/api-types";
import type { CampaignQr } from "@/lib/campaign";
import {
  DEFAULT_PRODUCT_INFO,
  DEFAULT_PRODUCT_NAME,
  DEFAULT_TARGET_CUSTOMER,
  EXPERIENCE_PATH,
  MAX_INDUSTRY_LENGTH,
  MAX_PRODUCT_INFO_LENGTH,
  MAX_PRODUCT_NAME_LENGTH,
  TARGET_CUSTOMERS,
} from "@/lib/constants";
import { checkImage } from "@/lib/image";
import { CardNewsEditor } from "./CardNewsEditor";
import { ResultAnalysis } from "./ResultAnalysis";
import { ResultContent } from "./ResultContent";
import ExportPanel from "./ExportPanel";
import { EmailPanel } from "./EmailPanel";
import { RecipientForm } from "./RecipientForm";
import { EMPTY_RECIPIENT, type RecipientInfo } from "@/lib/deliver-types";

const LOADING_STEPS = [
  { at: 0, text: "사진과 제품 정보를 서버로 보내는 중" },
  { at: 3, text: "AI가 현장 사진을 분석하는 중" },
  { at: 12, text: "기술 강점과 CEO 영업 문제 가설을 연결하는 중" },
  { at: 25, text: "질문형 제목과 홍보 문구를 만드는 중" },
  { at: 45, text: "근거 ID와 가이드라인을 검증하는 중(필요하면 1회 재시도)" },
];

/** 클라이언트 요청 제한(서버 90초 + 여유) */
const CLIENT_TIMEOUT_MS = 115_000;

interface SelectedImage {
  file: File;
  dataUrl: string;
}

type Status = "idle" | "loading" | "success" | "error";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function StudioApp({ campaignQr }: { campaignQr: CampaignQr }) {
  const [image, setImage] = useState<SelectedImage | null>(null);
  // 고객 전달: 수신 고객 정보(AI에는 보내지 않음)와 카드 PNG 캡처 연결부
  const [recipient, setRecipient] = useState<RecipientInfo>(EMPTY_RECIPIENT);
  const cardCaptureRef = useRef<(() => Promise<string>) | null>(null);
  const getCardPng = async () => {
    if (!cardCaptureRef.current) throw new Error("카드뉴스가 아직 준비되지 않았습니다.");
    return cardCaptureRef.current();
  };
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [productName, setProductName] = useState(DEFAULT_PRODUCT_NAME);
  const [productInfo, setProductInfo] = useState(DEFAULT_PRODUCT_INFO);
  const [targetCustomer, setTargetCustomer] = useState<string>(DEFAULT_TARGET_CUSTOMER);
  const [industry, setIndustry] = useState("");
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>("");

  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [response, setResponse] = useState<GenerateSuccess | null>(null);
  const [error, setError] = useState<ApiErrorBody["error"] | null>(null);
  /** 결과 화면에 쓰는 요청 당시 입력 스냅샷 */
  const [snapshot, setSnapshot] = useState<{ imageSrc: string; productInfo: string; productName: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const imageRequest = useRef(0);

  async function loadModels() {
    setModelsError(null);
    try {
      const res = await fetch("/api/models", { cache: "no-store" });
      const body = (await res.json()) as ModelsResponse | ApiErrorBody;
      if (!body.ok) throw new Error(body.error.message);
      setModels(body);
      setModelId((current) => {
        const enabled = body.models.filter((model) => model.enabled);
        if (enabled.some((model) => model.id === current)) return current;
        const preferred = enabled.find((model) => model.id === body.defaultId);
        if (preferred && body.keyStatus[preferred.provider]) return preferred.id;
        return enabled.find((model) => body.keyStatus[model.provider])?.id ?? preferred?.id ?? "";
      });
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : "모델 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    // 마운트 시 1회 모델 목록 조회
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadModels();
  }, []);

  useEffect(() => {
    if (status !== "loading") return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
  }, [status]);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    const requestId = ++imageRequest.current;
    setImageError(null);
    setImage(null);
    try {
      const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const check = checkImage(file.type, file.size, head);
      if (!check.ok) throw new Error(check.message);
      const dataUrl = await readAsDataUrl(file);
      if (requestId === imageRequest.current) setImage({ file, dataUrl });
    } catch (error) {
      if (requestId === imageRequest.current) {
        setImageError(error instanceof Error ? error.message : "사진을 읽을 수 없습니다. 다시 올려 주세요.");
      }
    }
  }

  const enabledModels = useMemo(() => models?.models.filter((m) => m.enabled) ?? [], [models]);
  const selectedModel = enabledModels.find((m) => m.id === modelId);
  const selectedKeyMissing = selectedModel && models ? !models.keyStatus[selectedModel.provider] : false;

  const infoTooLong = productInfo.length > MAX_PRODUCT_INFO_LENGTH;
  const canSubmit =
    !!image && productName.trim().length > 0 && productInfo.trim().length > 0 && !infoTooLong && status !== "loading";

  async function handleSubmit() {
    if (!image || !canSubmit) return;
    setStatus("loading");
    setElapsed(0);
    setError(null);
    setResponse(null);

    const form = new FormData();
    form.append("image", image.file);
    form.append("productName", productName.trim());
    form.append("productInfo", productInfo.trim());
    form.append("targetCustomer", targetCustomer);
    if (industry.trim()) form.append("industry", industry.trim());
    if (modelId) form.append("modelId", modelId);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch("/api/generate", { method: "POST", body: form, signal: controller.signal });
      let body: GenerateSuccess | ApiErrorBody;
      try {
        body = (await res.json()) as GenerateSuccess | ApiErrorBody;
      } catch {
        throw { code: "INTERNAL_ERROR", message: `서버 응답을 해석할 수 없습니다(HTTP ${res.status}).` };
      }
      if (!body.ok) {
        setError(body.error);
        setStatus("error");
        return;
      }
      setSnapshot({ imageSrc: image.dataUrl, productInfo: productInfo.trim(), productName: productName.trim() });
      setResponse(body);
      setStatus("success");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      if (controller.signal.aborted) {
        setError({ code: "TIMEOUT", message: "응답 대기 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요." });
      } else if (e && typeof e === "object" && "code" in e) {
        setError(e as ApiErrorBody["error"]);
      } else {
        setError({ code: "INTERNAL_ERROR", message: "서버에 연결하지 못했습니다. 네트워크와 서버 실행 상태를 확인해 주세요." });
      }
      setStatus("error");
    } finally {
      clearTimeout(timer);
    }
  }

  const step = [...LOADING_STEPS].reverse().find((s) => elapsed >= s.at) ?? LOADING_STEPS[0];

  return (
    <div className="flex min-h-full flex-col">
      {/* 헤더 */}
      <header className="bg-gradient-to-br from-navy via-navy-deep to-[#164756] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-5 px-4 py-7 sm:px-6">
          <div>
            <div className="mb-3 text-lg font-black tracking-wider">
              T<span className="text-teal-300">·</span>LINK
            </div>
            <h1 className="text-2xl font-black sm:text-4xl">T-LINK Value Studio</h1>
            <p className="mt-2 text-sm text-[#DCE6FF] sm:text-base">현장 사진에서 대표가 점검할 영업 문제와 카드뉴스를 만듭니다.</p>
          </div>
          <nav aria-label="주요 페이지·이력·관리 메뉴" className="flex flex-wrap gap-2">
            <Link href={EXPERIENCE_PATH}
              className="inline-flex items-center rounded-lg bg-teal-300 px-3 py-2 text-sm font-bold text-navy hover:bg-teal-200">
              30초 체험
            </Link>
            <Link href="/history?tab=emails" className="inline-flex items-center rounded-lg border border-white/30 px-3 py-2 text-sm text-white/90 hover:bg-white/10">메일 발송 이력</Link>
            <Link href="/history?tab=generations" className="inline-flex items-center rounded-lg border border-white/30 px-3 py-2 text-sm text-white/90 hover:bg-white/10">콘텐츠 생성 이력</Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 rounded-lg border border-white/30 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              <Settings size={14} /> 모델 관리
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid w-full min-w-0 max-w-7xl flex-1 items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] xl:gap-8">
        <div className="min-w-0">
          {/* 입력 */}
          <section aria-label="분석에 사용할 현장 사진과 제품 정보" className="space-y-4">
            {/* 사진 업로드 */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-line sm:p-6">
              <h2 className="mb-1 text-lg font-bold">1. 현장 사진 업로드 <span className="text-red-500">*</span></h2>
              <p className="mb-4 text-xs text-muted">JPG·PNG·WebP, 최대 8MB, 1장</p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void handleFile(e.dataTransfer.files?.[0]);
                }}
                className={`relative flex min-h-[144px] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition ${
                  dragOver ? "border-brand bg-[#EEF3FF]" : "border-line bg-[#F8FAFE] hover:border-brand-light"
                }`}
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.dataUrl} alt="업로드한 현장 사진 미리보기" className="max-h-[200px] w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-6 text-center text-muted">
                    <ImagePlus size={36} className="text-brand-light" />
                    <span className="font-semibold text-navy-deep">클릭하거나 사진을 끌어다 놓으세요</span>
                    <span className="text-xs">영업 현장, 사무실, 상담 공간 등</span>
                  </div>
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset">
                  <span className="sr-only">{image ? "다른 사진 선택" : "현장 사진 선택"}</span>
                </button>
                {image && (
                  <button type="button" onClick={() => {
                    imageRequest.current++;
                    setImage(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }} className="absolute right-2 top-2 z-10 rounded-full bg-navy/80 p-1.5 text-white hover:bg-navy" aria-label="사진 지우기">
                    <X size={16} />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    void handleFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
              {image && (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                  <Upload size={12} /> {image.file.name} · {(image.file.size / 1024 / 1024).toFixed(2)}MB
                </p>
              )}
              {imageError && (
                <p className="mt-2 flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle size={14} /> {imageError}
                </p>
              )}

              {/* 개인정보 주의·외부 전송 고지 (FR-IN-03) */}
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                <div className="mb-1 flex items-center gap-1 font-bold">
                  <ShieldAlert size={14} /> 개인정보 주의 · 외부 AI 전송 고지
                </div>
                <p>얼굴, 전화번호, 고객명 등 개인정보를 가린 뒤 올려 주세요. 사진과 제품 정보는 분석에 선택한 AI 제공사로 전송되며 사진은 서버 메모리에서 처리합니다.</p>
              </div>
            </div>

            {/* 제품 정보 */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-line sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold">2. 제품 정보</h2>
                <button
                  type="button"
                  onClick={() => {
                    setProductName(DEFAULT_PRODUCT_NAME);
                    setProductInfo(DEFAULT_PRODUCT_INFO);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-[#EEF3FF]"
                >
                  <RotateCcw size={13} /> 티링크 기본값 불러오기
                </button>
              </div>

              <label className="mb-1 block text-sm font-semibold" htmlFor="productName">
                제품명 <span className="text-red-500">*</span>
              </label>
              <input
                id="productName"
                value={productName}
                maxLength={MAX_PRODUCT_NAME_LENGTH}
                onChange={(e) => setProductName(e.target.value)}
                className="mb-4 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="예: 티링크 비즈레코딩"
              />

              <label className="mb-1 block text-sm font-semibold" htmlFor="productInfo">
                제품 주요 정보 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="productInfo"
                value={productInfo}
                onChange={(e) => setProductInfo(e.target.value)}
                rows={5}
                className={`w-full rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 ${
                  infoTooLong ? "border-red-400 focus:ring-red-200" : "border-line focus:border-brand focus:ring-brand/20"
                }`}
              />
              <div className={`mb-4 text-right text-xs ${infoTooLong ? "text-red-600" : "text-muted"}`}>
                {productInfo.length.toLocaleString()} / {MAX_PRODUCT_INFO_LENGTH.toLocaleString()}자
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-semibold" htmlFor="target">
                    타깃 고객
                  </label>
                  <select
                    id="target"
                    value={targetCustomer}
                    onChange={(e) => setTargetCustomer(e.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                  >
                    {TARGET_CUSTOMERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 flex items-center justify-between text-sm font-semibold" htmlFor="model">
                    AI 모델
                    <button type="button" onClick={() => void loadModels()} className="text-muted hover:text-brand" aria-label="모델 목록 새로 고침">
                      <RefreshCw size={13} />
                    </button>
                  </label>
                  <select
                    id="model"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                    disabled={!models}
                  >
                    {!models && <option value="">불러오는 중…</option>}
                    {enabledModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                        {m.isDefault ? " (기본)" : ""}
                        {models && !models.keyStatus[m.provider] ? " — 키 미설정" : ""}
                      </option>
                    ))}
                  </select>
                  {modelsError && <p className="mt-1 text-xs text-red-600">{modelsError}</p>}
                  {selectedKeyMissing && (
                    <p className="mt-1 text-xs text-amber-700">
                      이 모델의 API 키가 서버에 설정되지 않았습니다. 생성하면 MISSING_API_KEY 오류가 납니다.
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold" htmlFor="industry">적용 업종 <span className="font-normal text-muted">(선택)</span></label>
                  <input id="industry" value={industry} maxLength={MAX_INDUSTRY_LENGTH} onChange={(event) => setIndustry(event.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                    placeholder="예  기업용 통신 서비스" />
                </div>
              </div>
            </div>
          </section>

          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-3.5 text-base font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700"
            >
              {status === "loading" ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              {status === "loading" ? "AI가 작업 중입니다…" : "AI 분석 및 홍보 문구 생성"}
            </button>
            {!image && <p className="text-xs text-muted">현장 사진을 올리고 필수 항목을 채우면 버튼이 활성화됩니다.</p>}
          </div>
        </div>

        <div className="min-w-0">
          {status === "idle" && (
            <section className="rounded-3xl bg-navy p-6 text-white sm:p-8">
              <p className="text-sm font-bold tracking-widest text-teal-300">CEO BLIND SPOT</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">대표님, 직원에게 묻기 전에 고객이 무엇을 말했는지 확인해 보세요.</h2>
              <p className="mt-4 max-w-xl leading-relaxed text-slate-200">현장 사진과 제품 정보를 입력하면 AI가 관련 기술과 근거를 찾고, 영업 사각지대에 대한 질문과 카드뉴스 문구를 만듭니다.</p>
              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-white/10 p-4 text-sm leading-relaxed text-slate-200">
                <LayoutTemplate size={22} className="mt-0.5 shrink-0 text-teal-300" />
                <p>제목, 홍보 문구, CTA를 편집하고 QR이 포함된 카드뉴스를 PNG로 저장할 수 있습니다.</p>
              </div>
            </section>
          )}

          {/* 로딩 */}
          {status === "loading" && (
            <div className="mx-auto mt-6 max-w-xl rounded-xl bg-white p-5 text-center ring-1 ring-line">
              <Loader2 className="mx-auto mb-2 animate-spin text-brand" size={28} />
              <p className="font-semibold" role="status">{step.text}</p>
              <p className="mt-1 text-xs text-muted">
                경과 {elapsed}초 · 최대 90초까지 걸릴 수 있습니다{selectedModel ? ` · ${selectedModel.label}` : ""}
              </p>
              <ol className="mt-3 space-y-1 text-left text-xs">
                {LOADING_STEPS.map((s) => (
                  <li key={s.at} className={elapsed >= s.at ? "text-navy-deep" : "text-slate-400"}>
                    {elapsed >= s.at ? "●" : "○"} {s.text}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[11px] text-slate-400">단계 표시는 경과 시간 기준 안내입니다.</p>
            </div>
          )}

          {/* 오류 (가짜 결과 대신 오류를 그대로 보여 준다) */}
          {status === "error" && error && (
            <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 shrink-0 text-red-600" size={20} />
                <div className="flex-1">
                  <p className="font-bold text-red-800">생성하지 못했습니다 ({error.code})</p>
                  <p className="mt-1 text-sm text-red-800">{error.message}</p>
                  {error.details && error.details.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-xs text-red-700">
                      {error.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={!canSubmit}
                    className="mt-3 inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <RefreshCw size={14} /> 다시 시도
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 결과 */}
          {status === "success" && response && snapshot && (
            <div ref={resultRef} className="scroll-mt-4 space-y-8">
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-4 py-3 text-xs text-muted ring-1 ring-line">
                <span>
                  모델: <b className="text-navy-deep">{response.meta.label}</b> ({response.meta.model})
                </span>
                <span>· 소요 {(response.meta.elapsedMs / 1000).toFixed(1)}초</span>
                <span>· 시도 {response.meta.attempts}회</span>
                <span>
                  · 제품 판별: {response.meta.isTlinkProduct ? "티링크 제품" : "티링크 외 제품(사용자 입력만 근거)"}
                </span>
              </div>

              <section>
                <h2 className="mb-4 text-xl font-black">현장 분석과 기술 근거</h2>
                <ResultAnalysis result={response.result} imageSrc={snapshot.imageSrc} productInfo={snapshot.productInfo} />
              </section>

              <section>
                <h2 className="mb-4 text-xl font-black">카드뉴스 편집 및 다운로드</h2>
                <CardNewsEditor
                  result={response.result}
                  snapshot={snapshot}
                  qr={response.meta.isTlinkProduct ? campaignQr : undefined}
                  captureRef={cardCaptureRef}
                />
              </section>

              <section>
                <h2 className="mb-4 text-xl font-black">블로그·SNS 홍보 콘텐츠</h2>
                <ResultContent result={response.result} check={response.guidelineCheck} />
              </section>

              <section>
                <h2 className="mb-1 text-xl font-black">고객 전달</h2>
                <p className="mb-4 text-sm text-muted">
                  홍보자료를 PDF·Word·PPT·Excel로 받거나, 고객 정보를 입력해 PDF를 첨부한 메일을 바로 보냅니다.
                  카드 이미지는 위에서 편집한 카드뉴스가 그대로 들어갑니다.
                </p>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2 [&>*]:min-w-0">
                  <div className="min-w-0 space-y-6">
                    <RecipientForm value={recipient} onChange={setRecipient} />
                    <EmailPanel generation={response} recipient={recipient} getCardPng={getCardPng} />
                  </div>
                  <ExportPanel
                    generation={response}
                    recipient={recipient}
                    getCardPng={getCardPng}
                    photoDataUrl={snapshot.imageSrc}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-line bg-white py-4 text-center text-xs text-muted">
        T-LINK Value Studio · 게시 전 AI 생성 문구의 사실 여부를 확인해 주세요.
      </footer>
    </div>
  );
}
