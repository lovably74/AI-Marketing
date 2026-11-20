import type { Metadata } from "next";
import Link from "next/link";
import { BlindSpotExperience } from "@/components/BlindSpotExperience";

export const metadata: Metadata = {
  title: "CEO BLIND SPOT | T-LINK Value Studio",
  description: "견적 요청, 반복 불만, 상담 이력 단절 중 하나를 골라 대표가 놓칠 수 있는 영업 정보를 확인하세요.",
};

export default function ExperiencePage() {
  return (
    <div className="flex min-h-svh flex-col bg-[#101d32]">
      <header className="border-b border-white/15">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-white sm:px-6">
          <span className="font-black tracking-wider">T<span className="text-teal-300">·</span>LINK</span>
          <Link href="/" className="rounded-lg border border-slate-500 px-3 py-2 text-sm font-semibold hover:border-teal-300 hover:text-teal-200">
            Value Studio
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <BlindSpotExperience />
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 py-5 text-sm text-slate-300 sm:px-6">
        티링크 · CEO BLIND SPOT
      </footer>
    </div>
  );
}
