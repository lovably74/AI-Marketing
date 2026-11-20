import { BookOpenCheck, PencilLine, Sparkles } from "lucide-react";

/** 지식베이스 원문(모델에 전달한 자료) 표시 */
export function OfficialBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-navy-deep px-2 py-0.5 text-[11px] font-semibold text-white">
      <BookOpenCheck size={12} /> 공식 자료
    </span>
  );
}

/** AI가 만든 표현 표시 */
export function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-[#c2560f]">
      <Sparkles size={12} /> AI 생성
    </span>
  );
}

/** 사용자 입력 근거 표시 */
export function UserBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
      <PencilLine size={12} /> 사용자 입력
    </span>
  );
}
