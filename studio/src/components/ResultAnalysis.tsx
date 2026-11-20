"use client";

import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useState } from "react";
import type { GeneratedContent } from "@/lib/api-types";
import { BLIND_SPOTS } from "@/lib/constants";
import { lookupEvidence } from "@/lib/knowledge";
import { AiBadge, OfficialBadge, UserBadge } from "./Badges";
import { CopyButton } from "./CopyButton";

function EvidenceChip({ id, productInfo }: { id: string; productInfo: string }) {
  const [open, setOpen] = useState(false);
  const ev = lookupEvidence(id);
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-line bg-[#F3F5FA] px-2 py-1 text-xs font-semibold text-navy-deep hover:border-brand"
        aria-expanded={open}
      >
        <FileText size={13} />
        {id}
        {ev.kind !== "user" && ev.kind !== "unknown" && <span className="font-normal text-muted">· {ev.title}</span>}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-navy-deep/20 bg-white p-3 text-sm">
          <div className="mb-2 flex items-center gap-2">
            {ev.kind === "user" ? <UserBadge /> : <OfficialBadge />}
            <span className="font-semibold">{ev.kind === "user" ? "사용자가 입력한 제품 정보" : `${ev.id} ${ev.title}`}</span>
          </div>
          {ev.kind === "user" ? (
            <p className="whitespace-pre-wrap text-muted">{productInfo}</p>
          ) : (
            <>
              <p className="text-foreground">{ev.text}</p>
              {ev.kind === "feature" && <p className="mt-2 text-muted">편익(원문): {ev.benefit}</p>}
              {ev.kind === "fact" && ev.caution && <p className="mt-2 text-[#c2560f]">주의: {ev.caution}</p>}
              <p className="mt-2 text-xs text-muted">출처: {ev.source}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ResultAnalysis({
  result,
  imageSrc,
  productInfo,
}: {
  result: GeneratedContent;
  imageSrc: string;
  productInfo: string;
}) {
  const campaign = result.campaign;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)] [&>*]:min-w-0">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="업로드한 현장 사진" className="w-full rounded-xl object-contain ring-1 ring-line" />
          <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="font-bold">현장 사진 분석</h4>
              <div className="flex items-center gap-2">
                <AiBadge />
                <CopyButton text={result.sceneAnalysis} />
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{result.sceneAnalysis}</p>
            {campaign && (
              <dl className="mt-4 space-y-3 border-t border-line pt-3 text-sm leading-relaxed">
                {[
                  ["예상 업무 환경", campaign.probableEnvironment],
                  ["고객관리 문제 가설", campaign.potentialIssue],
                  ["제품과 현장의 관련성", campaign.productRelevance],
                ].map(([label, text]) => (
                  <div key={label}>
                    <dt className="font-bold text-teal-800">{label}</dt>
                    <dd>{text}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>표시 구분:</span>
            <OfficialBadge /> <span>모델에 전달한 지식베이스 원문</span>
            <AiBadge /> <span>AI가 만든 표현</span>
          </div>
          {result.differentiators.map((d, i) => (
            <div key={i} className="rounded-xl bg-white p-5 ring-1 ring-line">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-black text-white">
                    {i + 1}
                  </span>
                  <h4 className="text-lg font-bold">{d.feature}</h4>
                  <AiBadge />
                </div>
                <CopyButton
                  text={`${d.feature}\n고객 문제: ${d.customerProblem}\n기대 가치: ${d.customerBenefit}\n근거: ${d.evidence.join(", ")}`}
                />
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-[#F3F5FA] p-3">
                  <dt className="mb-1 text-xs font-semibold text-muted">고객 문제</dt>
                  <dd>{d.customerProblem}</dd>
                </div>
                <div className="rounded-lg bg-[#EEF3FF] p-3">
                  <dt className="mb-1 text-xs font-semibold text-brand">기대 가치</dt>
                  <dd>{d.customerBenefit}</dd>
                </div>
              </dl>
              {d.executiveValue && <p className="mt-3 text-sm"><strong className="text-teal-800">경영 가치</strong> {d.executiveValue}</p>}
              {d.marketingMessage && <p className="mt-2 text-sm"><strong className="text-teal-800">홍보 메시지</strong> {d.marketingMessage}</p>}
              {d.inputExcerpt && <blockquote className="mt-3 border-l-2 border-teal-500 pl-3 text-sm text-muted">“{d.inputExcerpt}”</blockquote>}
              <div className="mt-3">
                <div className="mb-1.5 text-xs font-semibold text-muted">근거 (눌러서 원문 보기)</div>
                <div className="flex flex-col gap-2">
                  {d.evidence.map((id) => (
                    <EvidenceChip key={id} id={id} productInfo={productInfo} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {campaign && (
        <section className="rounded-2xl bg-navy p-4 text-white sm:p-5">
          <h4 className="mb-1 text-lg font-bold">CEO 영업 사각지대</h4>
          <p className="mb-4 text-sm text-slate-300">사진과 입력 자료에서 도출한 점검 가설입니다.</p>
          <div className="grid gap-3 xl:grid-cols-3">
            {BLIND_SPOTS.map(({ id, label }) => {
              const spot = campaign.blindSpots[id];
              const feature = result.differentiators[spot.relatedFeature - 1];
              return (
                <article key={id} className="min-w-0 rounded-xl bg-white/10 p-4 text-sm leading-relaxed">
                  <h5 className="mb-2 font-bold text-teal-200">{label}</h5>
                  <p className="mb-2 font-semibold">{spot.question}</p>
                  <p className="text-slate-200">{spot.hypothesis}</p>
                  <dl className="mt-3 space-y-2 border-t border-white/15 pt-3 text-slate-200">
                    <div><dt className="font-bold text-white">관련 기능</dt><dd>{feature?.feature ?? "입력·제품 자료 확인 필요"}</dd></div>
                    <div><dt className="font-bold text-white">관리상 기대 편익</dt><dd>{spot.benefit}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
