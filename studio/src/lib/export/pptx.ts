// 홍보 PPT(.pptx, 16:9) (서버 전용)
import PptxGenJS from "pptxgenjs";
import type { GenerateSuccess } from "../api-types";
import { AI_NOTICE, BLIND_SPOT_NOTICE, BRAND, CONTACT, blindSpotRows, decodeDataUrl, tag } from "./common";

const FONT = "맑은 고딕";
const c = (x: string) => x.replace("#", "");

export async function buildPptx(generation: GenerateSuccess, cardPngDataUrl?: string): Promise<Buffer> {
  const { result } = generation;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9"; // 10 x 5.625 in
  pptx.title = result.blogTitle;

  const bar = (s: PptxGenJS.Slide, title: string) => {
    s.background = { color: "FFFFFF" };
    s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.8, fill: { color: c(BRAND.navy) }, line: { color: c(BRAND.navy) } });
    s.addShape("rect", { x: 0, y: 0.8, w: 10, h: 0.06, fill: { color: c(BRAND.orange) }, line: { color: c(BRAND.orange) } });
    s.addText(title, { x: 0.4, y: 0.1, w: 9.2, h: 0.6, fontFace: FONT, fontSize: 22, bold: true, color: "FFFFFF" });
    s.addText(AI_NOTICE, { x: 0.4, y: 5.25, w: 9.2, h: 0.3, fontFace: FONT, fontSize: 9, color: "888888", align: "right" });
  };

  // 1) 표지
  const s1 = pptx.addSlide();
  s1.background = { color: c(BRAND.navy) };
  const card = decodeDataUrl(cardPngDataUrl);
  if (card) {
    // 카드뉴스 1080×1350(4:5) 비율 유지
    const h = 4.6;
    const w = h * (1080 / 1350);
    s1.addImage({ data: `data:${card.mime};base64,${card.buffer.toString("base64")}`, x: 5.3 + (4.4 - w) / 2, y: 0.5, w, h });
  }
  s1.addText("TLINK 티링크", { x: 0.5, y: 0.5, w: 4.6, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: c(BRAND.light) });
  s1.addText(result.cardHeadline, { x: 0.5, y: 1.3, w: 4.6, h: 1.6, fontFace: FONT, fontSize: 30, bold: true, color: "FFFFFF", valign: "top" });
  s1.addText(result.cardSubtext, { x: 0.5, y: 3.0, w: 4.6, h: 1.0, fontFace: FONT, fontSize: 16, color: "DDE4F5", valign: "top" });
  s1.addShape("rect", { x: 0.5, y: 4.3, w: 1.2, h: 0.08, fill: { color: c(BRAND.orange) }, line: { color: c(BRAND.orange) } });

  // 2) 홍보 제목 3종(새 응답 형식이면 CEO 영업 사각지대 질문형 제목)
  const spots = blindSpotRows(result);
  const s2 = pptx.addSlide();
  bar(s2, spots.length ? "대표님이 확인해 볼 질문" : "홍보 제목");
  result.headlines.forEach((h, i) => {
    const y = 1.2 + i * 1.3;
    s2.addShape("roundRect", { x: 0.5, y, w: 9, h: 1.1, fill: { color: "F2F5FD" }, line: { color: c(BRAND.light) }, rectRadius: 0.1 });
    s2.addText(String(i + 1), { x: 0.7, y: y + 0.2, w: 0.7, h: 0.7, fontFace: FONT, fontSize: 24, bold: true, color: c(BRAND.orange) });
    s2.addText(
      spots[i]
        ? [
            { text: `${spots[i].label}\n`, options: { fontSize: 11, bold: true, color: c(BRAND.blue) } },
            { text: h, options: {} },
          ]
        : h,
      { x: 1.4, y: y + 0.05, w: 7.9, h: 1.0, fontFace: FONT, fontSize: 16, color: c(BRAND.navy), valign: "middle", fit: "shrink" },
    );
  });

  // 3) 기술 강점 1~3개
  const s3 = pptx.addSlide();
  bar(s3, "기술 강점");
  const n = Math.max(result.differentiators.length, 1);
  const colW = (9.2 - (n - 1) * 0.2) / n;
  result.differentiators.forEach((d, i) => {
    const x = 0.4 + i * (colW + 0.2);
    s3.addShape("rect", { x, y: 1.1, w: colW, h: 4.0, fill: { color: "F7F9FE" }, line: { color: c(BRAND.light) } });
    s3.addText(d.feature, { x: x + 0.1, y: 1.15, w: colW - 0.2, h: 0.7, fontFace: FONT, fontSize: 14, bold: true, color: c(BRAND.blue) });
    s3.addText(
      [
        { text: "고객 문제\n", options: { bold: true, color: c(BRAND.navy) } },
        { text: `${d.customerProblem}\n\n`, options: { color: "333333" } },
        { text: "기대 가치\n", options: { bold: true, color: c(BRAND.navy) } },
        { text: `${d.customerBenefit}\n\n`, options: { color: "333333" } },
        ...(d.executiveValue
          ? [
              { text: "경영 가치\n", options: { bold: true, color: c(BRAND.navy) } },
              { text: `${d.executiveValue}\n\n`, options: { color: "333333" } },
            ]
          : []),
        { text: `근거: ${d.evidence.join(", ")}`, options: { color: "888888", fontSize: 9 } },
      ],
      { x: x + 0.1, y: 1.85, w: colW - 0.2, h: 3.2, fontFace: FONT, fontSize: 10.5, valign: "top", fit: "shrink" },
    );
  });

  // 3-1) CEO 영업 사각지대(가설)
  if (spots.length) {
    const sc = pptx.addSlide();
    bar(sc, "CEO 영업 사각지대 점검");
    spots.forEach((spot, i) => {
      const x = 0.4 + i * 3.1;
      sc.addShape("rect", { x, y: 1.05, w: 2.9, h: 3.85, fill: { color: "F7F9FE" }, line: { color: c(BRAND.light) } });
      sc.addText(spot.label, { x: x + 0.1, y: 1.1, w: 2.7, h: 0.5, fontFace: FONT, fontSize: 14, bold: true, color: c(BRAND.blue) });
      sc.addText(
        [
          { text: "가설\n", options: { bold: true, color: c(BRAND.navy) } },
          { text: `${spot.hypothesis}\n\n`, options: { color: "333333" } },
          { text: "확인 질문\n", options: { bold: true, color: c(BRAND.navy) } },
          { text: `${spot.question}\n\n`, options: { color: "333333" } },
          { text: "관련 기능\n", options: { bold: true, color: c(BRAND.navy) } },
          { text: `${spot.relatedFeature || "확인 필요"}\n\n`, options: { color: "333333" } },
          { text: "기대 편익\n", options: { bold: true, color: c(BRAND.navy) } },
          { text: spot.benefit, options: { color: "333333" } },
        ],
        { x: x + 0.1, y: 1.6, w: 2.7, h: 3.25, fontFace: FONT, fontSize: 10, valign: "top", fit: "shrink" },
      );
    });
    sc.addText(BLIND_SPOT_NOTICE, { x: 0.4, y: 4.92, w: 9.2, h: 0.3, fontFace: FONT, fontSize: 9, color: "666666" });
  }

  // 4) SNS 문구·CTA·해시태그
  const s4 = pptx.addSlide();
  bar(s4, "SNS 문구");
  s4.addText(result.snsContent, { x: 0.5, y: 1.1, w: 9, h: 2.9, fontFace: FONT, fontSize: 13, color: "222222", valign: "top", fit: "shrink" });
  s4.addShape("roundRect", { x: 0.5, y: 4.05, w: 4.2, h: 0.55, fill: { color: c(BRAND.orange) }, line: { color: c(BRAND.orange) }, rectRadius: 0.1 });
  s4.addText(result.cta, { x: 0.5, y: 4.05, w: 4.2, h: 0.55, fontFace: FONT, fontSize: 15, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
  s4.addText(result.hashtags.map(tag).join(" "), { x: 0.5, y: 4.65, w: 9, h: 0.55, fontFace: FONT, fontSize: 11, color: c(BRAND.blue), fit: "shrink" });

  // 5) 연락처
  const s5 = pptx.addSlide();
  s5.background = { color: c(BRAND.navy) };
  s5.addText("상담 문의", { x: 0.5, y: 0.8, w: 9, h: 0.8, fontFace: FONT, fontSize: 32, bold: true, color: "FFFFFF", align: "center" });
  s5.addText(
    [
      { text: `홈페이지  ${CONTACT.homepage}\n`, options: {} },
      { text: `대표번호  ${CONTACT.phone}\n`, options: {} },
      { text: `상담 페이지  ${CONTACT.center}`, options: {} },
    ],
    { x: 1, y: 1.9, w: 8, h: 2, fontFace: FONT, fontSize: 18, color: "DDE4F5", align: "center", lineSpacingMultiple: 1.4 },
  );
  s5.addText(AI_NOTICE, { x: 0.5, y: 4.8, w: 9, h: 0.4, fontFace: FONT, fontSize: 11, color: c(BRAND.light), align: "center" });

  const out = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}
