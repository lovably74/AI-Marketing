"use client";

import { ClipboardList, MessagesSquare, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BLIND_SPOTS, OFFICIAL_INQUIRY_URL, OFFICIAL_REPORT_URL } from "@/lib/constants";
import { EXPERIENCE_SCENARIOS } from "@/lib/experience-scenarios";

type SpotId = keyof typeof EXPERIENCE_SCENARIOS;

const icons = {
  opportunity: ClipboardList,
  complaint: MessagesSquare,
  handoff: UsersRound,
};

export function BlindSpotExperience() {
  const [selected, setSelected] = useState<SpotId | null>(null);
  const choiceHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const scenario = selected ? EXPERIENCE_SCENARIOS[selected] : null;

  useEffect(() => {
    if (selected) resultHeading.current?.focus();
  }, [selected]);

  function reset() {
    setSelected(null);
    choiceHeading.current?.focus();
  }

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-14">
        <div className="mb-7 max-w-3xl">
          <p className="mb-3 text-sm font-bold tracking-widest text-teal-300">CEO BLIND SPOT · 30초 체험</p>
          <h1 ref={choiceHeading} tabIndex={-1} className="text-3xl font-black leading-tight tracking-tight text-white focus-visible:outline-teal-300 sm:text-5xl">
            대표님, 우리 회사에서 가장 걱정되는 영업 상황은 무엇입니까?
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
            상황을 하나 고르면 상담 사례를 보고 대표가 확인할 정보와 관련 티링크 기능을 살펴볼 수 있습니다.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3" role="group" aria-label="영업 상황 선택">
          {BLIND_SPOTS.map(({ id, label }) => {
            const option = EXPERIENCE_SCENARIOS[id];
            const Icon = icons[id];
            const active = selected === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(id)}
                className="flex flex-col items-start rounded-2xl border border-slate-600 bg-[#14243a] px-4 py-4 text-left text-white transition hover:border-teal-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300 aria-pressed:border-teal-300 aria-pressed:bg-[#153840] sm:px-5 md:min-h-44"
              >
                <span className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-teal-200">
                  <Icon size={20} aria-hidden="true" /> {label}
                </span>
                <span className="text-lg font-bold leading-snug">{option.title}</span>
                <span className="mt-2 text-sm leading-relaxed text-slate-200">{option.summary}</span>
              </button>
            );
          })}
        </div>
      </section>

      {scenario && (
        <section aria-labelledby="scenario-title" className="border-y border-slate-200 bg-[#f1f6fa] text-navy">
          <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-7 sm:px-6 sm:pb-14 sm:pt-10">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
              <div>
                <p className="mb-1 text-sm font-bold text-teal-800">체험용 예시</p>
                <h2 id="scenario-title" ref={resultHeading} tabIndex={-1} className="scroll-mt-6 text-2xl font-black focus-visible:outline-teal-700 sm:text-3xl">{scenario.title}</h2>
              </div>
              <button type="button" onClick={reset} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold hover:border-teal-700">
                다른 상황 선택
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <article className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
                <h3 className="text-lg font-bold">고객 상담 상황</h3>
                <blockquote className="mt-3 rounded-xl border-l-4 border-teal-600 bg-teal-50 px-4 py-3 font-semibold leading-relaxed">
                  “{scenario.conversation}”
                </blockquote>
                <p className="mt-4 leading-relaxed text-slate-700">{scenario.situation}</p>
              </article>
              <article className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
                <h3 className="text-lg font-bold">대표가 확인할 정보</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-slate-700 marker:text-teal-700">
                  {scenario.checks.map((check) => <li key={check}>{check}</li>)}
                </ul>
              </article>
            </div>

            <div className="mt-6 rounded-2xl bg-[#0b1736] p-5 text-white sm:p-7">
              <h3 className="text-xl font-bold">티링크에서 확인할 수 있는 정보</h3>
              <dl className="mt-4 grid gap-3 md:grid-cols-2">
                {scenario.features.map(({ title, benefit }) => (
                  <div key={title} className="rounded-xl bg-white/10 p-4">
                    <dt className="font-bold text-teal-200">{title}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-slate-200">{benefit}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-slate-300">이용 가능한 기능은 도입 환경, 권한, 계약 옵션에 따라 달라질 수 있습니다.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a href={OFFICIAL_REPORT_URL} target="_blank" rel="noreferrer" className="rounded-lg bg-teal-300 px-4 py-3 text-center text-sm font-bold text-navy hover:bg-teal-200">
                  티링크 AI 경영분석 보고서 확인하기
                </a>
                <a href={OFFICIAL_INQUIRY_URL} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-400 px-4 py-3 text-center text-sm font-bold text-white hover:border-teal-300 hover:text-teal-200">
                  티링크 제품 도입 문의
                </a>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
