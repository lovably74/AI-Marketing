"use client";

import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { CampaignQr } from "@/lib/campaign";
import { CARD_HEIGHT, CARD_WIDTH } from "@/lib/card-export";
import { OFFICIAL_HOMEPAGE, OFFICIAL_PHONE } from "@/lib/constants";

export interface CardNewsData {
  imageSrc: string;
  headline: string;
  subtext: string;
  strengths: string[];
  cta: string;
  isTlink: boolean;
  productName: string;
  qr?: CampaignQr;
}

/** 글자 수 구간별 글자 크기와 최대 줄 수 */
export interface TextFit {
  /** 이 글자 수 이하일 때 적용 */
  maxLen: number;
  size: number;
  lines: number;
}

/**
 * 글자 수(공백 포함, 유니코드 문자 기준)에 맞는 단계를 고른다(FR-OUT-07).
 * 마지막 단계는 그보다 긴 글에도 적용한다.
 */
export function fitText(text: string, steps: readonly TextFit[]): TextFit {
  const len = [...text].length;
  return steps.find((s) => len <= s.maxLen) ?? steps[steps.length - 1];
}

// 카드 본문 폭 952px(1080 - 좌우 여백 64×2) 기준으로 잡은 단계.
// 한글 한 글자 폭은 약 1em이고 keep-all 줄바꿈으로 줄 끝이 조금씩 비는 것을 감안해 여유를 둔다.
// schema.ts 상한: cardHeadline 60자, cardSubtext 120자, cta 80자, feature 60자.

/** 제목: 900 굵기, 줄 간격 1.22 */
export const HEADLINE_FITS: readonly TextFit[] = [
  { maxLen: 10, size: 92, lines: 2 },
  { maxLen: 14, size: 82, lines: 2 },
  { maxLen: 18, size: 72, lines: 2 },
  { maxLen: 24, size: 62, lines: 2 },
  { maxLen: 30, size: 56, lines: 3 },
  { maxLen: 40, size: 52, lines: 3 },
  { maxLen: 50, size: 46, lines: 3 },
  { maxLen: 60, size: 42, lines: 4 },
  { maxLen: Infinity, size: 38, lines: 4 },
];

/** 부제: 500 굵기, 줄 간격 1.4 */
export const SUBTEXT_FITS: readonly TextFit[] = [
  { maxLen: 18, size: 40, lines: 2 },
  { maxLen: 28, size: 36, lines: 2 },
  { maxLen: 40, size: 32, lines: 2 },
  { maxLen: 60, size: 29, lines: 3 },
  { maxLen: 90, size: 27, lines: 4 },
  { maxLen: Infinity, size: 25, lines: 6 },
];

/** 강점: 700 굵기, 한 줄(번호 원 44px + 간격 18px을 뺀 890px 폭) */
const STRENGTH_FITS: readonly TextFit[] = [
  { maxLen: 20, size: 32, lines: 1 },
  { maxLen: Infinity, size: 28, lines: 1 },
];

/** CTA 버튼: 900 굵기. 티링크 카드는 연락처 옆이라 글자 폭이 최대 588px(640 - 좌우 패딩) */
const CTA_FITS: readonly TextFit[] = [
  { maxLen: 12, size: 28, lines: 1 },
  { maxLen: 18, size: 25, lines: 1 },
  { maxLen: 26, size: 22, lines: 2 },
  { maxLen: 40, size: 21, lines: 2 },
  { maxLen: Infinity, size: 18, lines: 3 },
];

/** 티링크 외 제품의 제품명(워드마크 자리, 글자 폭 최대 648px = 700 - 좌우 패딩) */
const PRODUCT_NAME_FITS: readonly TextFit[] = [
  { maxLen: 12, size: 40, lines: 1 },
  { maxLen: 18, size: 34, lines: 1 },
  { maxLen: 40, size: 28, lines: 2 },
  { maxLen: Infinity, size: 24, lines: 2 },
];

/** 카드 강점 한 줄에 넣을 최대 글자 수(28px에서 890px 폭 안에 들어가는 길이) */
const STRENGTH_MAX_CHARS = 26;

/**
 * 강점 문구를 카드용으로 짧게 만든다.
 * 들어가면 원문 그대로 두고, 길면 괄호 속 부연 설명을 먼저 빼고, 그래도 길면 단어 경계에서 자른다.
 */
export function shortenStrength(s: string, max = STRENGTH_MAX_CHARS): string {
  let t = s.replace(/\s+/g, " ").trim();
  if ([...t].length <= max) return t;
  const noParen = t
    .replace(/\s*[(（[][^)）\]]*[)）\]]\s*/g, " ") // 닫힌 괄호 설명
    .replace(/\s*[(（[][^)）\]]*$/, "") // 닫히지 않은 채 끝나는 괄호 설명
    .replace(/\s+/g, " ")
    .trim();
  if (noParen) t = noParen;
  const chars = [...t];
  if (chars.length <= max) return t;
  const cut = chars.slice(0, max - 1).join("");
  const idx = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("·"), cut.lastIndexOf(","), cut.lastIndexOf("/"));
  const base = idx >= Math.floor(max / 2) ? cut.slice(0, idx) : cut;
  return `${base.replace(/[\s·,/]+$/, "")}…`;
}

/** 줄 수 제한(line-clamp). 넘침의 마지막 안전장치이며, 정상 범위 글은 단계 조정만으로 들어가게 잡았다. */
const clamp = (lines: number): CSSProperties => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: lines,
  overflow: "hidden",
});

const FONT = 'var(--font-noto-sans-kr), "Noto Sans KR", "Malgun Gothic", sans-serif';

// 브랜드 컬러(제안서 테마): 네이비 #0B1736 / 네이비 딥 #13254F(오버레이 중간 톤 rgba(19,37,79)),
// 메인 블루 #2F5BEA, 로고 블루 #6C9AFF, 포인트 오렌지 #FF8A3D
const NAVY = "#0B1736";
const BLUE = "#2F5BEA";
const LOGO_BLUE = "#6C9AFF";
const ORANGE = "#FF8A3D";
const TEAL = "#57E3D0";

/**
 * 1080×1350 카드뉴스 원본. 화면 미리보기는 이 노드를 축소(transform)해 보여 주고,
 * 다운로드는 화면 밖에 그린 원본 크기 노드를 캡처한다.
 */
export const CardNews = forwardRef<HTMLDivElement, { data: CardNewsData }>(function CardNews({ data }, ref) {
  const headline = fitText(data.headline, HEADLINE_FITS);
  const subtext = fitText(data.subtext, SUBTEXT_FITS);
  const cta = fitText(data.cta, CTA_FITS);
  const productName = fitText(data.productName, PRODUCT_NAME_FITS);
  const strengths = data.strengths.slice(0, 3).map((s) => shortenStrength(s));
  const accent = data.qr ? TEAL : ORANGE;

  return (
    <div
      ref={ref}
      data-card-news=""
      style={{
        position: "relative",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        overflow: "hidden",
        backgroundColor: NAVY,
        fontFamily: FONT,
        color: "#FFFFFF",
        wordBreak: "keep-all",
        overflowWrap: "break-word",
        lineBreak: "strict",
      }}
    >
      {/* 원본 사진: 비율 유지(cover)로 잘라 채우기만 하고 늘이거나 왜곡하지 않는다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.imageSrc}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          display: "block",
        }}
      />
      {/* 전체 오버레이: 사진은 살리되 상·하단을 네이비로 눌러 준다 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          // QA-02: 밝은 사진에서도 상단 워드마크(LINK)·배지 대비가 유지되도록 상단을 더 짙게 누른다
          background: `linear-gradient(180deg, rgba(11,23,54,0.82) 0%, rgba(11,23,54,0.55) 12%, rgba(11,23,54,0.18) 26%, rgba(19,37,79,0.30) 50%, rgba(11,23,54,0.70) 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(47,91,234,0.30) 0%, rgba(47,91,234,0) 55%)",
        }}
      />

      {/* 상단: 워드마크(밝은 사진에서도 읽히도록 네이비 바탕) */}
      <div
        style={{
          position: "absolute",
          top: 52,
          left: 64,
          right: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div
          style={{
            flex: "0 1 auto",
            minWidth: 0,
            padding: "14px 26px",
            borderRadius: 16,
            background: "rgba(11,23,54,0.92)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          }}
        >
          {data.isTlink ? (
            <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: 2, lineHeight: 1, whiteSpace: "nowrap" }}>
              <span style={{ color: "#FFFFFF" }}>T</span>
              <span style={{ color: ORANGE }}>·</span>
              <span style={{ color: LOGO_BLUE }}>LINK</span>
            </div>
          ) : (
            <div
              data-card-field="productName"
              style={{
                fontSize: productName.size,
                fontWeight: 900,
                lineHeight: 1.2,
                maxWidth: 648,
                ...clamp(productName.lines),
              }}
            >
              {data.productName}
            </div>
          )}
        </div>
        <div
          style={{
            flexShrink: 0,
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.2,
            padding: "10px 22px",
            borderRadius: 999,
            background: "rgba(11,23,54,0.8)",
            border: `2px solid ${LOGO_BLUE}`,
            color: "#FFFFFF",
            whiteSpace: "nowrap",
          }}
        >
          {data.qr ? "CEO BLIND SPOT" : data.isTlink ? "티링크 비즈레코딩" : "AI 홍보 카드"}
        </div>
      </div>

      {/* 하단 콘텐츠: 내용 높이만큼 위로 자라는 네이비 그라데이션 위에 놓아 사진 밝기와 무관하게 대비를 확보 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "190px 64px 56px",
          background: `linear-gradient(180deg, rgba(11,23,54,0) 0px, rgba(11,23,54,0.82) 170px, rgba(11,23,54,0.94) 340px, ${NAVY} 100%)`,
        }}
      >
        <div style={{ width: 72, height: 8, borderRadius: 4, background: accent, marginBottom: 28 }} />
        <div
          data-card-field="headline"
          style={{
            fontSize: headline.size,
            fontWeight: 900,
            lineHeight: 1.22,
            letterSpacing: -1,
            marginBottom: 20,
            textShadow: "0 2px 18px rgba(0,0,0,0.35)",
            ...clamp(headline.lines),
          }}
        >
          {data.headline}
        </div>
        <div
          data-card-field="subtext"
          style={{
            fontSize: subtext.size,
            fontWeight: 500,
            lineHeight: 1.4,
            color: "#DCE6FF",
            marginBottom: 34,
            ...clamp(subtext.lines),
          }}
        >
          {data.subtext}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 34 }}>
          {strengths.map((s, i) => {
            const fit = fitText(s, STRENGTH_FITS);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    borderRadius: 999,
                    background: BLUE,
                    color: "#FFFFFF",
                    fontSize: 24,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {i + 1}
                </div>
                <div
                  data-card-field="strength"
                  style={{ minWidth: 0, fontSize: fit.size, fontWeight: 700, lineHeight: 1.3, ...clamp(fit.lines) }}
                >
                  {s}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            paddingTop: 26,
            borderTop: `2px solid rgba(108,154,255,0.45)`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              data-card-field="cta"
              style={{
                width: "fit-content",
                maxWidth: "100%",
                fontSize: cta.size,
                fontWeight: 900,
                lineHeight: 1.3,
                color: NAVY,
                background: accent,
                borderRadius: 28,
                padding: "14px 26px",
                ...clamp(cta.lines),
              }}
            >
              {data.cta}
            </div>
            {data.isTlink && (
              <div style={{ marginTop: 16, fontSize: 24, fontWeight: 700, lineHeight: 1.35, color: "#DCE6FF" }}>
                {OFFICIAL_HOMEPAGE} · 상담 {OFFICIAL_PHONE}
              </div>
            )}
          </div>
          {data.qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.qr.imageSrc}
              alt={data.qr.goesToExperience ? "30초 영업 사각지대 체험 QR" : "티링크 공식 경영분석 보고서 QR"}
              style={{ display: "block", width: 172, height: 172, flexShrink: 0, background: "#fff" }}
            />
          )}
        </div>
      </div>
      {/* 하단 브랜드 블루 띠: 카드 가장자리 마감 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 10,
          background: `linear-gradient(90deg, ${BLUE} 0%, ${data.qr ? TEAL : LOGO_BLUE} 100%)`,
        }}
      />
    </div>
  );
});
