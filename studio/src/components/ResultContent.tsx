"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { GeneratedContent, GuidelineCheck } from "@/lib/api-types";
import { AiBadge } from "./Badges";
import { CopyButton } from "./CopyButton";

function Block({ title, copyText, children }: { title: string; copyText: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-line">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h4 className="font-bold">{title}</h4>
          <AiBadge />
        </div>
        <CopyButton text={copyText} />
      </div>
      {children}
    </div>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 size={16} className="inline text-green-600" aria-label="충족" />
  ) : (
    <XCircle size={16} className="inline text-red-500" aria-label="미충족" />
  );
}

function GuidelinePanel({ check }: { check: GuidelineCheck }) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-line">
      <div className="mb-3 flex items-center gap-2">
        <h4 className="font-bold">가이드라인 점검 결과</h4>
        {check.passed ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">통과</span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">확인 필요</span>
        )}
        <span className="text-xs text-muted">서버가 문자열 규칙으로 자동 점검한 결과입니다.</span>
      </div>

      {!check.applicable && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          <Info size={16} className="mt-0.5 shrink-0" />
          티링크 외 제품으로 판별되어 티링크 전용 가이드라인(필수 키워드, 공식 연락처 보완, 태그 목록)은 적용하지 않았습니다.
          근거는 사용자 입력(USER_INPUT)만 허용했습니다.
        </p>
      )}

      {check.requiredKeywords.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2">필수 키워드</th>
                <th className="py-2 text-center">블로그 제목</th>
                <th className="py-2 text-center">블로그 본문</th>
                <th className="py-2 text-center">홍보 제목 3종</th>
              </tr>
            </thead>
            <tbody>
              {check.requiredKeywords.map((k) => (
                <tr key={k.keyword} className="border-b border-line/60">
                  <td className="py-2 font-medium">{k.keyword}</td>
                  <td className="py-2 text-center"><Mark ok={k.inBlogTitle} /></td>
                  <td className="py-2 text-center"><Mark ok={k.inBlogContent} /></td>
                  <td className="py-2 text-center"><Mark ok={k.inHeadlines} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {check.titlePhrases.length > 0 && (
        <div className="mt-3 text-sm">
          <div className="mb-1 text-xs font-semibold text-muted">제목·첫 문단 표현</div>
          <div className="flex flex-wrap gap-2">
            {check.titlePhrases.map((p) => (
              <span key={p.phrase} className="inline-flex items-center gap-1 rounded-md bg-[#F3F5FA] px-2 py-1">
                <Mark ok={p.found} /> {p.phrase}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2 text-sm">
        {check.warnings.length === 0 ? (
          <p className="flex items-center gap-2 text-green-700">
            <CheckCircle2 size={16} /> 금지 표현·공식 외 연락처·근거 없는 수치가 발견되지 않았습니다.
          </p>
        ) : (
          check.warnings.map((w) => (
            <div key={w.label} className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">{w.label}</span>: {w.matches.map((m) => `"${m}"`).join(", ")}
                <span className="text-xs text-amber-700"> ({w.fields.join(", ")})</span>
              </div>
            </div>
          ))
        )}
        {check.footerAppended.length > 0 && (
          <p className="flex items-start gap-2 text-muted">
            <Info size={16} className="mt-0.5 shrink-0" />
            블로그 하단에 빠진 공식 정보({check.footerAppended.join(", ")})를 서버가 자동으로 덧붙였습니다.
          </p>
        )}
        {check.hashtagsRemoved.length > 0 && (
          <p className="flex items-start gap-2 text-muted">
            <Info size={16} className="mt-0.5 shrink-0" />
            가이드라인에 없는 해시태그를 제외했습니다: {check.hashtagsRemoved.join(" ")}
          </p>
        )}
      </div>
    </div>
  );
}

export function ResultContent({ result, check }: { result: GeneratedContent; check: GuidelineCheck }) {
  const hashtags = result.hashtags.join(" ");
  return (
    <div className="space-y-4">
      <Block title="홍보 제목 3종" copyText={result.headlines.join("\n")}>
        <ol className="space-y-2">
          {result.headlines.map((h, i) => (
            <li key={i} className="flex items-start justify-between gap-3 rounded-lg bg-[#F3F5FA] p-3">
              <span className="font-semibold">
                <span className="mr-2 text-brand">{i + 1}.</span>
                {h}
              </span>
              <CopyButton text={h} />
            </li>
          ))}
        </ol>
      </Block>

      <Block title="블로그" copyText={`${result.blogTitle}\n\n${result.blogContent}`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="text-lg font-bold">{result.blogTitle}</p>
          <CopyButton text={result.blogTitle} label="제목 복사" />
        </div>
        <div className="max-h-[480px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#F3F5FA] p-4 text-sm leading-relaxed">
          {result.blogContent}
        </div>
        <div className="mt-2 flex justify-end">
          <CopyButton text={result.blogContent} label="본문 복사" />
        </div>
      </Block>

      <Block title="SNS 문구" copyText={`${result.snsContent}\n\n${hashtags}`}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.snsContent}</p>
      </Block>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <Block title="CTA" copyText={result.cta}>
          <p className="font-semibold text-[#c2560f]">{result.cta}</p>
        </Block>
        <Block title="해시태그" copyText={hashtags}>
          <div className="flex flex-wrap gap-1.5">
            {result.hashtags.map((t) => (
              <span key={t} className="rounded-full bg-[#EEF3FF] px-2.5 py-1 text-xs font-semibold text-brand">
                {t}
              </span>
            ))}
            {result.hashtags.length === 0 && <span className="text-sm text-muted">허용 목록에 맞는 해시태그가 없습니다.</span>}
          </div>
        </Block>
      </div>

      <GuidelinePanel check={check} />
    </div>
  );
}
