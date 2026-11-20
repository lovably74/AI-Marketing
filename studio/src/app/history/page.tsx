import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryApp } from "@/components/HistoryApp";

export const metadata: Metadata = {
  title: "발송·생성 이력 | T-LINK AI Marketing Studio",
};

// HistoryApp은 useSearchParams(tab 쿼리)를 쓰므로 Suspense 경계가 필요하다
export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryApp />
    </Suspense>
  );
}
