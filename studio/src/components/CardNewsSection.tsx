"use client";

import { Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { CARD_HEIGHT, CARD_WIDTH, blobToDataUrl, captureCardPng, downloadBlob } from "@/lib/card-export";
import { CardNews, type CardNewsData } from "./CardNews";

const PREVIEW_MAX = 540;

/** 로컬(브라우저) 시각 기준 YYYYMMDD-HHmm */
export function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function CardNewsSection({
  data,
  canDownload = true,
  captureRef,
}: {
  data: CardNewsData;
  canDownload?: boolean;
  /** 바깥(PDF·PPT·ZIP·메일)에서 카드 PNG(data URL)를 얻기 위한 캡처 함수 연결부 */
  captureRef?: RefObject<(() => Promise<string>) | null>;
}) {
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = async () => {
      // 다운로드와 같은 방식: 화면 밖 원본 노드를 복제해 캡처한다(편집 중인 문구 그대로)
      const node = exportRef.current;
      if (!node?.parentElement) throw new Error("카드뉴스가 아직 준비되지 않았습니다.");
      const snapshot = node.cloneNode(true) as HTMLElement;
      node.parentElement.append(snapshot);
      try {
        return await blobToDataUrl(await captureCardPng(snapshot));
      } finally {
        snapshot.remove();
      }
    };
    return () => {
      captureRef.current = null;
    };
  }, [captureRef]);

  // 미리보기 영역 폭에 맞춰 축소 비율 계산
  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    // 내용 폭이 아니라 부모 칸 폭 기준으로 계산한다(미리보기 폭이 칸을 밀어내는 순환 방지)
    const parent = el.parentElement ?? el;
    const update = () => {
      const w = Math.min(parent.clientWidth, PREVIEW_MAX);
      if (w > 0) setScale(Math.min(1, w / CARD_WIDTH));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  async function handleDownload() {
    // 축소 미리보기 대신 화면 밖의 원본 노드를 캡처한다.
    const node = exportRef.current;
    if (!node?.parentElement || busy || !canDownload) return;
    const snapshot = node.cloneNode(true) as HTMLElement;
    node.parentElement.append(snapshot);
    setBusy(true);
    setError(null);
    setSavedName(null);
    try {
      const blob = await captureCardPng(snapshot);
      const name = `tlink-cardnews-${localStamp(new Date())}.png`;
      downloadBlob(blob, name);
      setSavedName(name);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      setError(`카드뉴스 PNG를 만들지 못했습니다. 잠시 후 다시 시도해 주세요. (원인: ${reason})`);
    } finally {
      snapshot.remove();
      setBusy(false);
    }
  }

  return (
    <div className="w-full min-w-0">
      <div ref={previewBoxRef} className="w-full min-w-0 max-w-[540px] overflow-hidden">
        <div
          className="max-w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-line"
          style={{ width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale }}
        >
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: CARD_WIDTH, height: CARD_HEIGHT }}>
            <CardNews data={data} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy || !canDownload}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-[#2449c4] disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {busy ? "PNG 만드는 중…" : `카드뉴스 PNG 다운로드 (${CARD_WIDTH}×${CARD_HEIGHT})`}
        </button>
        <span className="text-xs text-muted">미리보기는 축소 화면이며, 다운로드는 원본 크기로 저장됩니다.</span>
      </div>
      {savedName && !error && (
        <p className="mt-2 text-xs text-muted" role="status">
          저장했습니다: {savedName}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* 다운로드용 원본 크기 노드: 화면 밖에 그린다(캡처 대상은 내부 카드 노드) */}
      <div
        aria-hidden
        style={{ position: "fixed", left: -20000, top: 0, width: CARD_WIDTH, height: CARD_HEIGHT, pointerEvents: "none" }}
      >
        <CardNews ref={exportRef} data={data} />
      </div>
    </div>
  );
}
