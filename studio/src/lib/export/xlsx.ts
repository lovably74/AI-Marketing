// 분석 데이터 Excel(.xlsx) (서버 전용)
import ExcelJS from "exceljs";
import type { GenerateSuccess } from "../api-types";
import { lookupEvidence } from "../knowledge";
import { BLIND_SPOT_NOTICE, BRAND, blindSpotRows, tag } from "./common";

const argb = (hex: string) => `FF${hex.replace("#", "")}`;

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(BRAND.navy) } };
  row.alignment = { vertical: "middle" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function wrapAll(ws: ExcelJS.Worksheet) {
  ws.eachRow((r, i) => {
    if (i > 1) r.alignment = { wrapText: true, vertical: "top" };
  });
}

export async function buildXlsx(generation: GenerateSuccess): Promise<Buffer> {
  const { result, guidelineCheck: gc, meta } = generation;
  const wb = new ExcelJS.Workbook();
  wb.creator = "티링크 홍보 콘텐츠 생성기";
  wb.created = new Date();

  // 1) 기술 강점(1~3개)
  const ws1 = wb.addWorksheet("기술 강점");
  ws1.columns = [
    { header: "번호", key: "no", width: 6 },
    { header: "기능", key: "feature", width: 24 },
    { header: "고객 문제", key: "problem", width: 50 },
    { header: "기대 가치", key: "benefit", width: 50 },
    { header: "경영 가치", key: "executive", width: 40 },
    { header: "홍보 문구", key: "message", width: 40 },
    { header: "근거", key: "evidence", width: 50 },
    { header: "사용자 입력 인용", key: "excerpt", width: 40 },
  ];
  result.differentiators.forEach((d, i) =>
    ws1.addRow({
      no: i + 1,
      feature: d.feature,
      problem: d.customerProblem,
      benefit: d.customerBenefit,
      executive: d.executiveValue ?? "",
      message: d.marketingMessage ?? "",
      excerpt: d.inputExcerpt ?? "",
      evidence: d.evidence
        .map((id) => {
          const e = lookupEvidence(id);
          return `${id} ${e.title}${e.source ? ` (${e.source})` : ""}`;
        })
        .join("\n"),
    }),
  );
  styleHeader(ws1);
  wrapAll(ws1);

  // 2) 콘텐츠
  const ws2 = wb.addWorksheet("콘텐츠");
  ws2.columns = [
    { header: "항목", key: "k", width: 18 },
    { header: "내용", key: "v", width: 100 },
  ];
  const rows: [string, string][] = [
    ["현장 분석", result.sceneAnalysis],
    ...result.headlines.map((h, i): [string, string] => [`홍보 제목 ${i + 1}`, h]),
    ["블로그 제목", result.blogTitle],
    ["블로그 본문", result.blogContent],
    ["SNS 문구", result.snsContent],
    ["카드뉴스 제목", result.cardHeadline],
    ["카드뉴스 부제", result.cardSubtext],
    ["CTA", result.cta],
    ["해시태그", result.hashtags.map(tag).join(" ")],
  ];
  rows.forEach(([k, v]) => ws2.addRow({ k, v }));
  styleHeader(ws2);
  wrapAll(ws2);

  // 2-1) CEO 영업 사각지대(새 응답 형식에만 있음)
  const spots = blindSpotRows(result);
  if (result.campaign && spots.length) {
    const wsc = wb.addWorksheet("CEO 사각지대");
    wsc.columns = [
      { header: "구분", key: "label", width: 18 },
      { header: "질문형 제목", key: "headline", width: 36 },
      { header: "가설", key: "hypothesis", width: 50 },
      { header: "확인 질문", key: "question", width: 36 },
      { header: "관련 기능", key: "feature", width: 22 },
      { header: "기대 편익", key: "benefit", width: 40 },
      { header: "상세 홍보 문구", key: "copy", width: 50 },
    ];
    spots.forEach((s) =>
      wsc.addRow({ ...s, feature: s.relatedFeature || "확인 필요(근거 있는 관련 기능 없음)" }),
    );
    wsc.addRow({});
    wsc.addRow({ label: "예상 업무 환경", headline: result.campaign.probableEnvironment });
    wsc.addRow({ label: "가능한 고객관리 문제", headline: result.campaign.potentialIssue });
    wsc.addRow({ label: "제품과의 관련성", headline: result.campaign.productRelevance });
    wsc.addRow({ label: "주의", headline: BLIND_SPOT_NOTICE });
    styleHeader(wsc);
    wrapAll(wsc);
  }

  // 3) 가이드라인 점검
  const ws3 = wb.addWorksheet("가이드라인 점검");
  ws3.columns = [
    { header: "구분", key: "kind", width: 14 },
    { header: "항목", key: "item", width: 30 },
    { header: "블로그 제목", key: "a", width: 12 },
    { header: "블로그 본문", key: "b", width: 12 },
    { header: "홍보 제목", key: "c", width: 12 },
    { header: "비고", key: "note", width: 60 },
  ];
  const yn = (v: boolean) => (v ? "포함" : "미포함");
  ws3.addRow({ kind: "적용 여부", item: gc.applicable ? "티링크 가이드라인 적용" : "미적용(티링크 외 제품)", note: gc.passed ? "통과" : "확인 필요" });
  for (const k of gc.requiredKeywords) {
    ws3.addRow({ kind: "필수 키워드", item: k.keyword, a: yn(k.inBlogTitle), b: yn(k.inBlogContent), c: yn(k.inHeadlines) });
  }
  for (const p of gc.titlePhrases) {
    ws3.addRow({ kind: "제목·첫 단락 문구", item: p.phrase, note: p.found ? "포함" : "미포함" });
  }
  for (const w of gc.warnings) {
    ws3.addRow({ kind: "경고", item: w.label, note: `${w.matches.join(", ")} (위치: ${w.fields.join(", ")})` });
  }
  if (gc.warnings.length === 0) ws3.addRow({ kind: "경고", item: "없음" });
  if (gc.footerAppended.length) ws3.addRow({ kind: "자동 보정", item: "하단 문구 추가", note: gc.footerAppended.join(", ") });
  if (gc.hashtagsRemoved.length) ws3.addRow({ kind: "자동 보정", item: "제외 해시태그 삭제", note: gc.hashtagsRemoved.join(", ") });
  styleHeader(ws3);
  wrapAll(ws3);

  // 4) 메타
  const ws4 = wb.addWorksheet("메타");
  ws4.columns = [
    { header: "항목", key: "k", width: 20 },
    { header: "값", key: "v", width: 60 },
  ];
  [
    ["모델", meta.label],
    ["제공사", meta.provider],
    ["모델 ID", meta.model],
    ["생성 시각", meta.generatedAt],
    ["소요 시간(ms)", String(meta.elapsedMs)],
    ["시도 횟수", String(meta.attempts)],
    ["티링크 제품 여부", meta.isTlinkProduct ? "예" : "아니오"],
    ["내보낸 시각", new Date().toISOString()],
  ].forEach(([k, v]) => ws4.addRow({ k, v }));
  styleHeader(ws4);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
