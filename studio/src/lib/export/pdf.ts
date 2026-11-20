// 고객 전달용 홍보 브로셔 PDF (서버 전용, A4). 한글은 NanumGothic(OFL) TTF를 임베드한다.
import path from "node:path";
import fs from "node:fs";
import PDFDocument from "pdfkit";
import type { GenerateSuccess } from "../api-types";
import type { RecipientInfo } from "../deliver-types";
import { lookupEvidence } from "../knowledge";
import { AI_NOTICE, BLIND_SPOT_NOTICE, BRAND, CONTACT, blindSpotRows, decodeDataUrl, greetingLine, paragraphs } from "./common";

export interface PdfInput {
  generation: GenerateSuccess;
  recipient?: RecipientInfo;
  cardPngDataUrl?: string;
  photoDataUrl?: string;
}

function fontPath(name: string): string {
  return path.join(process.cwd(), "assets/fonts", name);
}

const PAGE_W = 595.28;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

export async function buildPdf(input: PdfInput): Promise<Buffer> {
  const { result } = input.generation;
  const regular = fs.readFileSync(fontPath("NanumGothic-Regular.ttf"));
  const bold = fs.readFileSync(fontPath("NanumGothic-Bold.ttf"));

  // 기본 폰트를 한글 TTF로 지정해 pdfkit 내장 AFM(Helvetica) 로드를 피한다.
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    font: regular as unknown as string,
    info: { Title: result.blogTitle, Author: "티링크 홍보 콘텐츠 생성기", Subject: "티링크 소개 브로셔" },
  });
  doc.registerFont("R", regular);
  doc.registerFont("B", bold);

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const header = (label: string) => {
    doc.save().rect(0, 0, PAGE_W, 56).fill(BRAND.navy).restore();
    doc.save().rect(0, 56, PAGE_W, 4).fill(BRAND.orange).restore();
    doc.font("B").fontSize(13).fillColor("#FFFFFF").text("TLINK 티링크", MARGIN, 21, { lineBreak: false });
    doc.font("R").fontSize(10).fillColor(BRAND.light).text(label, MARGIN, 23, { width: CONTENT_W, align: "right" });
    doc.x = MARGIN;
    doc.y = 80;
  };
  const sectionTitle = (t: string) => {
    doc.moveDown(0.6);
    const y = doc.y;
    doc.save().rect(MARGIN, y + 2, 4, 14).fill(BRAND.blue).restore();
    doc.font("B").fontSize(14).fillColor(BRAND.navy).text(t, MARGIN + 12, y, { width: CONTENT_W - 12 });
    doc.x = MARGIN;
    doc.moveDown(0.4);
  };

  // ── 1쪽: 표지 ──
  header("고객 맞춤 소개 자료");
  doc.font("B").fontSize(16).fillColor(BRAND.blue).text(greetingLine(input.recipient), { width: CONTENT_W });
  doc.moveDown(0.3);
  doc.font("R").fontSize(10.5).fillColor("#333333").text(
    "현장에 꼭 맞는 통화 업무 자동화 방안을 정리해 드립니다. 아래 내용을 편하게 살펴봐 주세요.",
    { width: CONTENT_W },
  );
  doc.moveDown(0.6);
  doc.font("B").fontSize(20).fillColor(BRAND.navy).text(result.blogTitle, { width: CONTENT_W });
  doc.moveDown(0.6);

  const card = decodeDataUrl(input.cardPngDataUrl);
  if (card && card.mime !== "image/webp") {
    // 카드뉴스는 1080×1350(4:5). 비율을 유지해 가운데에 놓는다.
    const h = 300;
    const w = h * (1080 / 1350);
    const x = (PAGE_W - w) / 2;
    const y = doc.y;
    doc.image(card.buffer, x, y, { fit: [w, h], align: "center", valign: "center" });
    doc.y = y + h + 14;
    doc.x = MARGIN;
  }

  const spots = blindSpotRows(result);
  sectionTitle(spots.length ? "대표님이 확인해 볼 질문" : "홍보 제목");
  result.headlines.forEach((h, i) => {
    const label = spots[i]?.label;
    doc.font("B").fontSize(11).fillColor(BRAND.orange).text(label ? `${label}  ` : `${i + 1}. `, { continued: true });
    doc.font("R").fillColor("#222222").text(h, { width: CONTENT_W });
    doc.moveDown(0.2);
  });

  // ── 2쪽: 차별점 + 블로그 ──
  doc.addPage();
  header("기술 강점");
  sectionTitle(`관련 기술 강점 ${result.differentiators.length}가지`);
  result.differentiators.forEach((d, i) => {
    if (doc.y > 700) {
      doc.addPage();
      header("기술 강점");
    }
    doc.font("B").fontSize(12.5).fillColor(BRAND.blue).text(`${i + 1}. ${d.feature}`, { width: CONTENT_W });
    doc.moveDown(0.2);
    doc.font("B").fontSize(10).fillColor(BRAND.navy).text("고객 문제  ", { continued: true });
    doc.font("R").fillColor("#333333").text(d.customerProblem, { width: CONTENT_W });
    doc.moveDown(0.15);
    doc.font("B").fontSize(10).fillColor(BRAND.navy).text("기대 가치  ", { continued: true });
    doc.font("R").fillColor("#333333").text(d.customerBenefit, { width: CONTENT_W });
    doc.moveDown(0.15);
    if (d.executiveValue) {
      doc.font("B").fontSize(10).fillColor(BRAND.navy).text("경영 가치  ", { continued: true });
      doc.font("R").fillColor("#333333").text(d.executiveValue, { width: CONTENT_W });
      doc.moveDown(0.15);
    }
    const ev = d.evidence
      .map((id) => {
        const e = lookupEvidence(id);
        return e.kind === "user" ? `${id}(사용자 입력)` : `${id} ${e.title}${e.source ? ` · ${e.source}` : ""}`;
      })
      .join(" / ");
    doc.font("R").fontSize(8.5).fillColor("#777777").text(`근거: ${ev}`, { width: CONTENT_W });
    doc.moveDown(0.7);
  });

  // CEO 영업 사각지대(새 응답 형식에만 있음). 가설임을 분명히 밝힌다.
  if (result.campaign && spots.length) {
    doc.addPage();
    header("CEO 영업 사각지대 점검");
    sectionTitle("현장 해석");
    const pair = (k: string, v: string) => {
      doc.font("B").fontSize(10).fillColor(BRAND.navy).text(`${k}  `, { continued: true });
      doc.font("R").fillColor("#333333").text(v, { width: CONTENT_W });
      doc.moveDown(0.2);
    };
    pair("예상 업무 환경", result.campaign.probableEnvironment);
    pair("가능한 고객관리 문제", result.campaign.potentialIssue);
    pair("제품과의 관련성", result.campaign.productRelevance);
    doc.font("R").fontSize(8.5).fillColor("#777777").text(`※ ${BLIND_SPOT_NOTICE}`, { width: CONTENT_W });
    for (const spot of spots) {
      if (doc.y > 640) {
        doc.addPage();
        header("CEO 영업 사각지대 점검");
      }
      sectionTitle(spot.label);
      pair("가설", spot.hypothesis);
      pair("확인 질문", spot.question);
      pair("관련 기능", spot.relatedFeature || "확인 필요(근거 있는 관련 기능 없음)");
      pair("기대 편익", spot.benefit);
    }
  }

  if (doc.y > 640) {
    doc.addPage();
    header("블로그 본문 요약");
  }
  sectionTitle("블로그 본문 요약");
  const paras = paragraphs(result.blogContent);
  const summary = paras.slice(0, 4);
  doc.font("R").fontSize(10).fillColor("#333333");
  for (const p of summary) {
    if (doc.y > 760) {
      doc.addPage();
      header("블로그 본문 요약");
      doc.font("R").fontSize(10).fillColor("#333333");
    }
    doc.text(p, { width: CONTENT_W, lineGap: 3, align: "justify" });
    doc.moveDown(0.5);
  }
  if (paras.length > summary.length) {
    doc.font("R").fontSize(9).fillColor("#777777").text("※ 전문은 함께 전달드리는 블로그 게시글(Word)에서 확인하실 수 있습니다.");
  }

  // ── 마지막 쪽: 연락처 ──
  doc.addPage();
  header("상담 안내");
  doc.moveDown(2);
  doc.font("B").fontSize(22).fillColor(BRAND.navy).text(result.cta, { width: CONTENT_W, align: "center" });
  doc.moveDown(1.5);
  const boxY = doc.y;
  doc.save().roundedRect(MARGIN, boxY, CONTENT_W, 130, 10).fill("#F2F5FD").restore();
  doc.y = boxY + 20;
  const contactLine = (k: string, v: string) => {
    doc.font("B").fontSize(12).fillColor(BRAND.blue).text(`${k}   `, MARGIN + 30, doc.y, { continued: true });
    doc.font("R").fillColor("#222222").text(v);
    doc.moveDown(0.6);
  };
  contactLine("홈페이지", CONTACT.homepage);
  contactLine("대표번호", CONTACT.phone);
  contactLine("상담 페이지", CONTACT.center);
  doc.x = MARGIN;
  doc.y = boxY + 150;
  doc.font("R").fontSize(10).fillColor("#333333").text(result.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "), {
    width: CONTENT_W,
    align: "center",
  });
  doc.moveDown(2);
  doc.save().rect(MARGIN, doc.y, CONTENT_W, 1).fill(BRAND.orange).restore();
  doc.moveDown(0.8);
  doc.font("R").fontSize(9).fillColor("#888888").text(AI_NOTICE, { width: CONTENT_W, align: "center" });

  doc.end();
  return done;
}
