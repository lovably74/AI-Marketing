"use client";

import Link from "next/link";
import { useState, type RefObject } from "react";
import type { GeneratedContent } from "@/lib/api-types";
import type { CampaignQr } from "@/lib/campaign";
import {
  BLIND_SPOTS,
  CAMPAIGN_COPY_LENGTH,
  CAMPAIGN_CTA_LENGTH,
  CAMPAIGN_HEADLINE_LENGTH,
  EXPERIENCE_CTA,
  EXPERIENCE_PATH,
  REPORT_CTA,
} from "@/lib/constants";
import { CardNewsSection } from "./CardNewsSection";
import { CopyButton } from "./CopyButton";

type SpotId = (typeof BLIND_SPOTS)[number]["id"];
type Copy = { headline: string; subtext: string; cta: string };

const fieldStyle = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm leading-relaxed text-navy outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20";

export function CardNewsEditor({
  result,
  snapshot,
  qr,
  captureRef,
}: {
  result: GeneratedContent;
  snapshot: { imageSrc: string; productName: string };
  qr?: CampaignQr;
  /** D. 고객 전달(PDF·PPT·ZIP·메일)에 편집된 카드 PNG를 공급하는 캡처 연결부 */
  captureRef?: RefObject<(() => Promise<string>) | null>;
}) {
  const [selected, setSelected] = useState<SpotId>("opportunity");
  const [edits, setEdits] = useState<Partial<Record<SpotId, Partial<Copy>>>>({});
  const selectedIndex = BLIND_SPOTS.findIndex(({ id }) => id === selected);
  const defaultCta = qr ? (qr.goesToExperience ? EXPERIENCE_CTA : REPORT_CTA) : result.cta;
  const copy: Copy = {
    headline: !result.campaign && selectedIndex === 0 ? result.cardHeadline : result.headlines[selectedIndex],
    subtext: result.campaign?.blindSpots[selected].copy ?? result.cardSubtext,
    cta: defaultCta,
    ...edits[selected],
  };
  const canDownload = Object.values(copy).every((value) => value.trim());
  const ctaOptions = qr ? [...new Set([
    defaultCta,
    ...(qr.goesToExperience ? ["우리 회사도 놓친 고객이 있을까요?", "대표님이 놓치기 쉬운 영업 문제 확인하기"] : ["대표님이 확인할 경영 지표 보기"]),
  ])] : [];

  function edit(field: keyof Copy, value: string) {
    setEdits((previous) => ({ ...previous, [selected]: { ...previous[selected], [field]: value } }));
  }

  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4 rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
        <fieldset>
          <legend className="mb-2 text-sm font-bold">홍보 제목 선택</legend>
          <div className="space-y-2">
            {BLIND_SPOTS.map(({ id, label }, index) => (
              <label key={id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-2.5 text-sm has-checked:border-teal-700 has-checked:bg-teal-50">
                <input type="radio" name="campaign-headline" checked={selected === id} onChange={() => setSelected(id)}
                  className="mt-1 accent-teal-700" />
                <span><span className="block text-xs font-bold text-teal-800">{label}</span>{edits[id]?.headline?.trim() || result.headlines[index]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="card-headline" className="mb-1 block text-sm font-bold">카드 제목</label>
          <input id="card-headline" className={fieldStyle} value={copy.headline} maxLength={CAMPAIGN_HEADLINE_LENGTH} onChange={(event) => edit("headline", event.target.value)} />
        </div>
        <div>
          <label htmlFor="card-copy" className="mb-1 block text-sm font-bold">상세 홍보 문구</label>
          <textarea id="card-copy" className={fieldStyle} rows={4} value={copy.subtext} maxLength={CAMPAIGN_COPY_LENGTH} onChange={(event) => edit("subtext", event.target.value)} />
          <p className="text-right text-xs text-muted">{copy.subtext.length}/{CAMPAIGN_COPY_LENGTH}자</p>
        </div>
        <div>
          <label htmlFor="card-cta" className="mb-1 block text-sm font-bold">CTA 문구</label>
          <input id="card-cta" className={fieldStyle} value={copy.cta} maxLength={CAMPAIGN_CTA_LENGTH} onChange={(event) => edit("cta", event.target.value)} />
          {ctaOptions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {ctaOptions.map((option) => (
                <button key={option} type="button" onClick={() => edit("cta", option)} aria-pressed={copy.cta === option}
                  className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 aria-pressed:bg-teal-100">
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
        {canDownload
          ? <CopyButton text={[copy.headline, copy.subtext, copy.cta, qr?.url].filter(Boolean).join("\n\n")} label="홍보 문구 복사" />
          : <p className="text-sm text-rose-700" role="status">제목, 상세 홍보 문구, CTA를 모두 입력해 주세요.</p>}
      </div>
      <div className="min-w-0 space-y-4">
        <CardNewsSection canDownload={canDownload} captureRef={captureRef} data={{
          ...snapshot,
          ...copy,
          strengths: result.differentiators.map((item) => item.feature),
          isTlink: Boolean(qr),
          qr,
        }} />
        {qr && (
          <div className="rounded-xl bg-teal-50 p-3 text-sm text-teal-950">
            <p className="font-bold">QR 연결 대상</p>
            <a className="font-semibold underline decoration-teal-600 underline-offset-4" href={qr.url} target="_blank" rel="noreferrer">
              {qr.goesToExperience ? "30초 영업 사각지대 체험" : "티링크 공식 AI 경영분석 보고서"}
            </a>
            {!qr.goesToExperience && (
              <p className="mt-1 text-xs">공개 배포 주소가 설정되면 체험 페이지로 연결됩니다.{" "}
                <Link href={EXPERIENCE_PATH} className="font-bold underline underline-offset-2">현재 웹에서 체험하기</Link>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
