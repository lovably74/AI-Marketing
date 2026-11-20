"use client";
// 홍보자료 내보내기 패널: PDF 미리보기·다운로드, Word·PPT·Excel 개별 다운로드, 전체 ZIP
import { useEffect, useRef, useState } from "react";
import type { ApiErrorBody, GenerateSuccess } from "@/lib/api-types";
import type { ExportFormat, ExportPurpose, ExportRequest, RecipientInfo } from "@/lib/deliver-types";

export interface ExportPanelProps {
  generation: GenerateSuccess;
  recipient?: RecipientInfo;
  getCardPng: () => Promise<string>;
  photoDataUrl?: string;
}

type Busy = ExportFormat | "preview" | null;

const LABEL: Record<ExportFormat, string> = {
  pdf: "PDF 다운로드",
  docx: "Word",
  pptx: "PPT",
  xlsx: "Excel",
  zip: "전체 한 번에 다운로드(ZIP)",
};

/** Content-Disposition의 filename*(RFC 5987)에서 파일명을 꺼낸다 */
function filenameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get("content-disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* 무시하고 아래로 */
    }
  }
  const plain = /filename="([^"]+)"/i.exec(cd);
  return plain ? plain[1] : fallback;
}

function hasRecipientInfo(r?: RecipientInfo): r is RecipientInfo {
  return !!r && /.+@.+\..+/.test(r.email.trim());
}

export default function ExportPanel({ generation, recipient, getCardPng, photoDataUrl }: ExportPanelProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview_, setPreview] = useState<{ url: string; forGen: GenerateSuccess } | null>(null);
  // 생성 결과가 바뀌면 이전 미리보기는 표시하지 않는다(URL은 다음 미리보기·언마운트 때 해제)
  const previewUrl = preview_ && preview_.forGen === generation ? preview_.url : null;
  const previewRef = useRef<string | null>(null);

  // 언마운트 시 objectURL 해제
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  async function requestFile(
    format: ExportFormat,
    purpose: ExportPurpose = "download",
  ): Promise<{ blob: Blob; filename: string }> {
    let cardPngDataUrl: string | undefined;
    if (format === "pdf" || format === "pptx" || format === "zip") {
      try {
        cardPngDataUrl = await getCardPng();
      } catch {
        throw new Error("카드뉴스 이미지를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    }
    const body: ExportRequest = {
      format,
      purpose,
      generation,
      ...(hasRecipientInfo(recipient) ? { recipient } : {}),
      ...(cardPngDataUrl ? { cardPngDataUrl } : {}),
      ...(photoDataUrl && format === "zip" ? { photoDataUrl } : {}),
    };
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `파일을 만들지 못했습니다(${res.status}).`;
      try {
        const err = (await res.json()) as ApiErrorBody;
        if (err?.error?.message) msg = err.error.message;
      } catch {
        /* JSON이 아니면 기본 메시지 */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    if (blob.size === 0) throw new Error("빈 파일이 반환되었습니다.");
    return { blob, filename: filenameFrom(res, `tlink.${format}`) };
  }

  async function run(kind: Busy, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  const download = (format: ExportFormat) =>
    run(format, async () => {
      const { blob, filename } = await requestFile(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    });

  const preview = () =>
    run("preview", async () => {
      const { blob } = await requestFile("pdf", "preview");
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = url;
      setPreview({ url, forGen: generation });
    });

  const btn =
    "rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  const primary = `${btn} bg-[#2F5BEA] text-white hover:bg-[#244bd0]`;
  const secondary = `${btn} border border-[#6C9AFF] bg-white text-[#0B1736] hover:bg-[#F2F5FD]`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="export-heading">
      <h2 id="export-heading" className="text-lg font-bold text-[#0B1736]">
        홍보자료 내보내기
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        고객 전달용 PDF 브로셔와 Word·PPT·Excel 파일을 만듭니다.
        {hasRecipientInfo(recipient) ? " 입력한 고객 정보가 PDF 표지에 반영됩니다." : ""}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={primary} onClick={preview} disabled={!!busy}>
          {busy === "preview" ? "미리보기 생성 중…" : "PDF 미리보기"}
        </button>
        {(["pdf", "docx", "pptx", "xlsx"] as const).map((f) => (
          <button key={f} type="button" className={secondary} onClick={() => download(f)} disabled={!!busy}>
            {busy === f ? "생성 중…" : LABEL[f]}
          </button>
        ))}
        <button
          type="button"
          className={`${btn} bg-[#FF8A3D] text-white hover:bg-[#f07a2b]`}
          onClick={() => download("zip")}
          disabled={!!busy}
        >
          {busy === "zip" ? "묶는 중…" : LABEL.zip}
        </button>
      </div>

      <div aria-live="polite" className="mt-3 min-h-5 text-sm">
        {busy && <span className="text-slate-600">파일을 만드는 중입니다. 잠시만 기다려 주세요…</span>}
        {error && (
          <span role="alert" className="text-red-600">
            {error}
          </span>
        )}
      </div>

      {previewUrl && (
        <div className="mt-3">
          <iframe
            src={previewUrl}
            title="PDF 브로셔 미리보기"
            className="h-[70vh] max-h-[600px] min-h-[420px] w-full rounded-lg border border-slate-200"
          />
          <p className="mt-1 text-xs text-slate-500">
            미리보기가 보이지 않으면{" "}
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[#2F5BEA] underline">
              새 탭에서 열기
            </a>
            를 눌러 주세요. AI 생성 콘텐츠이므로 담당자 확인 후 사용하세요.
          </p>
        </div>
      )}
    </section>
  );
}
