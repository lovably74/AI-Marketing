// AI 응답 검증과 후처리: JSON 파싱, Zod 재검증, 근거 ID 검증, 가이드라인·금지표현 검사,
// 해시태그 정규화, 블로그 하단 연락처 자동 보완 (FR-API-05~07)
import { guidelines, knowledge, KNOWLEDGE_IDS, USER_INPUT_EVIDENCE } from "../knowledge";
import { BLIND_SPOTS, CAMPAIGN_HEADLINE_LENGTH } from "../constants";
import { sanitizeUserText } from "./prompt";
import { generatedContentSchema, type GeneratedContent } from "./schema";

export interface ParseResult {
  ok: boolean;
  content?: GeneratedContent;
  /** 재시도 피드백·오류 상세에 쓰는 문제 목록 */
  issues: string[];
}

/** 코드블록 표시 등을 걷어내고 JSON을 파싱한다 */
export function parseJsonText(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) t = fence[1];
  return JSON.parse(t);
}

/** 근거 ID를 정규화(공백 제거, 대문자, 중복 제거)한다. 쉼표로 묶인 값도 분리한다. */
export function normalizeEvidenceList(list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    for (const part of raw.split(/[,\s/]+/)) {
      const id = part.trim().toUpperCase();
      if (id && !out.includes(id)) out.push(id);
    }
  }
  return out;
}

/** 허용되지 않은 근거 ID 목록을 반환한다 */
export function findInvalidEvidence(content: GeneratedContent, isTlink: boolean): string[] {
  const invalid: string[] = [];
  for (const d of content.differentiators) {
    for (const id of d.evidence) {
      const allowed = isTlink ? KNOWLEDGE_IDS.has(id) || id === USER_INPUT_EVIDENCE : id === USER_INPUT_EVIDENCE;
      if (!allowed && !invalid.includes(id)) invalid.push(id);
    }
  }
  return invalid;
}

/**
 * 원문 응답을 파싱하고 Zod 스키마와 근거 ID를 검증한다.
 * 실패하면 issues에 재시도용 설명을 담아 돌려준다.
 */
export function parseAndValidate(text: string, isTlink: boolean, productInfo?: string): ParseResult {
  let data: unknown;
  try {
    data = parseJsonText(text);
  } catch {
    return { ok: false, issues: ["응답이 올바른 JSON이 아니었다."] };
  }
  const parsed = generatedContentSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 8).map((i) => {
      const where = i.path.length ? i.path.join(".") : "(루트)";
      return `스키마 불일치: ${where} — ${i.message}`;
    });
    return { ok: false, issues };
  }
  const content: GeneratedContent = {
    ...parsed.data,
    differentiators: parsed.data.differentiators.map((d) => ({
      ...d,
      evidence: normalizeEvidenceList(d.evidence),
    })),
  };
  if (!content.campaign && productInfo === undefined && content.differentiators.length !== 3) {
    return { ok: false, issues: ["differentiators: 기존 응답 형식은 기술 강점 3개가 필요하다."] };
  }
  const emptyIdx = content.differentiators.flatMap((d, i) => (d.evidence.length === 0 ? [i + 1] : []));
  if (emptyIdx.length > 0) {
    return {
      ok: false,
      content,
      issues: [`differentiators ${emptyIdx.join(", ")}번째 항목의 evidence가 비어 있다(정규화 후 0개). 근거 ID를 1개 이상 넣어라.`],
    };
  }
  const invalid = findInvalidEvidence(content, isTlink);
  if (invalid.length > 0) {
    const allowedText = isTlink
      ? `지식베이스 ID(F001~F010, K001~K014) 또는 ${USER_INPUT_EVIDENCE}`
      : `${USER_INPUT_EVIDENCE}(티링크 외 제품이므로 지식베이스 ID 사용 불가)`;
    return {
      ok: false,
      content,
      issues: [`evidence에 허용되지 않은 값이 있다: ${invalid.join(", ")}. 허용 값: ${allowedText}`],
    };
  }
  if (productInfo !== undefined) {
    const issues = campaignIssues(content, sanitizeUserText(productInfo));
    if (issues.length) return { ok: false, issues };
  }
  return { ok: true, content, issues: [] };
}

function campaignIssues(content: GeneratedContent, productInfo: string): string[] {
  if (!content.campaign) return ["campaign 필드가 필요하다."];
  const issues: string[] = [];
  const headlines = content.headlines.map(compact);
  if (new Set(headlines).size !== 3 || content.headlines.some((title) =>
    title.length > CAMPAIGN_HEADLINE_LENGTH || !/[?？]$/.test(title)
  )) {
    issues.push(`headlines에는 서로 다른 질문형 제목 3개를 각각 ${CAMPAIGN_HEADLINE_LENGTH}자 이내로 넣어라.`);
  }
  for (const [index, feature] of content.differentiators.entries()) {
    if (!feature.executiveValue || !feature.marketingMessage || feature.inputExcerpt === undefined) {
      issues.push(`differentiators[${index}]: executiveValue, marketingMessage, inputExcerpt를 채워라.`);
    }
    const excerpt = compact(feature.inputExcerpt ?? "");
    if (feature.evidence.includes(USER_INPUT_EVIDENCE)
      ? !excerpt || !compact(productInfo).includes(excerpt)
      : !!excerpt) {
      issues.push(`differentiators[${index}]: USER_INPUT을 쓸 때만 원래 제품 정보에서 정확히 인용한 구절을 넣어라.`);
    }
  }
  for (const { id } of BLIND_SPOTS) {
    if (content.campaign.blindSpots[id].relatedFeature > content.differentiators.length) {
      issues.push(`campaign.blindSpots.${id}: 존재하는 기능 번호 또는 0을 사용하라.`);
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// 해시태그 정규화
// ---------------------------------------------------------------------------

/** 해시태그 하나를 "#단어" 형태로 정규화한다. 비어 있으면 null */
export function normalizeHashtag(tag: string): string | null {
  const body = tag
    .replace(/#/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}_]/gu, "");
  return body ? `#${body}` : null;
}

export interface HashtagResult {
  hashtags: string[];
  removed: string[];
}

/**
 * 공백 제거·중복 제거·#회의록작성 제외. 티링크 제품이면 가이드라인 허용 목록에 있는 태그만 남긴다.
 */
export function normalizeHashtags(tags: string[], isTlink: boolean): HashtagResult {
  const allowed = new Map(guidelines.allowedHashtags.map((t) => [t.toLowerCase(), t]));
  const excluded = new Set(guidelines.excludedHashtags.map((t) => t.toLowerCase()));
  const seen = new Set<string>();
  const hashtags: string[] = [];
  const removed: string[] = [];
  for (const raw of tags) {
    const tag = normalizeHashtag(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (excluded.has(key)) {
      removed.push(tag);
      continue;
    }
    if (isTlink) {
      const canonical = allowed.get(key);
      if (!canonical) {
        removed.push(tag);
        continue;
      }
      hashtags.push(canonical);
    } else {
      hashtags.push(tag);
    }
  }
  return { hashtags, removed };
}

// ---------------------------------------------------------------------------
// 블로그 하단 연락처 자동 보완
// ---------------------------------------------------------------------------

export interface FooterResult {
  content: string;
  appended: string[];
}

/** URL 비교용 정규화: 소문자, http(s):// 와 www. 제거 */
export function normalizeUrlText(s: string): string {
  return s.toLowerCase().replace(/https?:\/\//g, "").replace(/(^|[^a-z0-9-])www\./g, "$1");
}

/** 블로그 본문 하단 공식 정보가 빠졌으면 빠진 항목을 하단에 덧붙인다(티링크 제품만) */
export function ensureFooter(blogContent: string): FooterResult {
  const f = guidelines.footer;
  const items: { key: string; check: string; line: string }[] = [
    { key: "홈페이지", check: f.homepage, line: `홈페이지: ${f.homepage}` },
    { key: "블로그", check: f.blog, line: `블로그: ${f.blog}` },
    { key: "상담 문의 전화", check: f.phone, line: `상담 문의: ${f.phone}` },
    { key: "상담 페이지", check: f.center, line: `상담 페이지: ${f.center}` },
  ];
  // 프로토콜(http/https)과 www 유무를 무시하고 비교한다.
  // 홈페이지 주소는 상담 페이지 URL·공식 이메일 안에도 들어 있으므로 그 부분을 뺀 본문에서 확인한다.
  const normContent = normalizeUrlText(blogContent);
  const center = normalizeUrlText(f.center);
  const withoutCenter = normContent.split(center).join("").replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, "");
  const missing = items.filter((it) =>
    it.check === f.homepage
      ? !withoutCenter.includes(normalizeUrlText(it.check))
      : !normContent.includes(normalizeUrlText(it.check)),
  );
  if (missing.length === 0) return { content: blogContent, appended: [] };
  const footer = ["", "", "────────", ...missing.map((m) => m.line)].join("\n");
  return { content: blogContent.trimEnd() + footer, appended: missing.map((m) => m.key) };
}

// ---------------------------------------------------------------------------
// 가이드라인 점검
// ---------------------------------------------------------------------------

export interface KeywordCheck {
  keyword: string;
  inBlogTitle: boolean;
  inBlogContent: boolean;
  inHeadlines: boolean;
}

export interface PhraseCheck {
  phrase: string;
  found: boolean;
}

export interface GuidelineWarning {
  label: string;
  matches: string[];
  fields: string[];
}

export interface GuidelineCheck {
  /** 티링크 가이드라인 적용 여부(티링크 외 제품이면 false) */
  applicable: boolean;
  requiredKeywords: KeywordCheck[];
  titlePhrases: PhraseCheck[];
  warnings: GuidelineWarning[];
  footerAppended: string[];
  hashtagsRemoved: string[];
  /** 필수 키워드를 모두 충족하고 경고가 없으면 true */
  passed: boolean;
}

const compact = (s: string) => s.replace(/\s+/g, "");

function includesLoose(haystack: string, needle: string): boolean {
  return compact(haystack).includes(compact(needle));
}

function firstParagraph(text: string): string {
  return (
    text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p.length > 0) ?? ""
  );
}

/** 점검 대상 텍스트 필드 */
function textFields(c: GeneratedContent): Record<string, string> {
  const campaign = c.campaign;
  return {
    사진관찰: c.sceneAnalysis,
    홍보제목: c.headlines.join("\n"),
    블로그제목: c.blogTitle,
    블로그본문: c.blogContent,
    SNS문구: c.snsContent,
    카드뉴스제목: c.cardHeadline,
    카드뉴스부제: c.cardSubtext,
    CTA: c.cta,
    차별점: c.differentiators.map((d) =>
      [d.feature, d.customerProblem, d.customerBenefit, d.executiveValue, d.marketingMessage].join("\n")
    ).join("\n"),
    ...(campaign ? {
      현장해석: [campaign.probableEnvironment, campaign.potentialIssue, campaign.productRelevance].join("\n"),
      CEO사각지대: BLIND_SPOTS.map(({ id }) => {
        const { hypothesis, question, benefit, copy } = campaign.blindSpots[id];
        return [hypothesis, question, benefit, copy].join("\n");
      }).join("\n"),
    } : {}),
  };
}

function addWarning(map: Map<string, GuidelineWarning>, label: string, match: string, field: string) {
  const w = map.get(label) ?? { label, matches: [], fields: [] };
  if (!w.matches.includes(match) && w.matches.length < 8) w.matches.push(match);
  if (!w.fields.includes(field)) w.fields.push(field);
  map.set(label, w);
}

/**
 * 근거 자료에 나오는 숫자 집합.
 * 지식베이스는 features의 description·benefit과 facts의 fact 본문만 쓴다(source의 페이지·슬라이드 번호 등은 제외).
 * 영문자 바로 뒤의 숫자(P1, P2, 2.0x의 일부 등 식별자)는 수치로 보지 않는다.
 */
export function evidenceSourceText(productInfo: string, isTlink = true): string {
  if (!isTlink) return productInfo;
  return [
    ...knowledge.features.flatMap((f) => [f.description, f.benefit]),
    ...knowledge.facts.map((f) => f.fact),
    productInfo,
  ].join("\n");
}

export function evidenceNumbers(productInfo: string, isTlink = true): Set<string> {
  const set = new Set<string>();
  for (const m of evidenceSourceText(productInfo, isTlink).matchAll(/(?<![A-Za-z\d.,])\d[\d,]*(?:\.\d+)?/g)) {
    set.add(m[0].replace(/,/g, ""));
  }
  return set;
}

/** 비율·배수(%, 배)는 숫자만이 아니라 "숫자+단위" 조합이 근거 자료에 있어야 한다 */
const STRICT_UNITS = new Set(["%", "퍼센트", "배"]);

const NUMBER_WITH_UNIT =
  /(\d[\d,]*(?:\.\d+)?)\s*(%|퍼센트|건|명|석|배|원|개\s*(?:기업|사|언어|국)|USER|시간|분|초|일)/g;
const PHONE = /(?<![\d-])(0\d{1,2}-\d{3,4}-\d{4}|1\d{3}-\d{4})(?![\d-])/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function checkGuidelines(
  content: GeneratedContent,
  opts: { isTlink: boolean; productInfo: string; footerAppended: string[]; hashtagsRemoved: string[] },
): GuidelineCheck {
  const { isTlink, productInfo } = opts;
  const fields = textFields(content);
  const warnings = new Map<string, GuidelineWarning>();

  // 1) 금지 표현 패턴
  for (const p of guidelines.prohibitedPatterns) {
    if (p.scope === "tlink" && !isTlink) continue;
    const re = new RegExp(p.pattern, "gi");
    for (const [field, text] of Object.entries(fields)) {
      for (const m of text.matchAll(re)) addWarning(warnings, p.label, m[0], field);
    }
  }

  // 2) 공식 연락처 외 전화번호·이메일
  const allowedPhones = new Set([...guidelines.allowedPhoneNumbers, ...(productInfo.match(PHONE) ?? [])]);
  const allowedEmails = new Set(
    [...guidelines.allowedEmails, ...(productInfo.match(EMAIL) ?? [])].map((e) => e.toLowerCase()),
  );
  for (const [field, text] of Object.entries(fields)) {
    for (const m of text.matchAll(PHONE)) {
      if (!allowedPhones.has(m[0])) addWarning(warnings, "공식 연락처 외 전화번호", m[0], field);
    }
    for (const m of text.matchAll(EMAIL)) {
      if (!allowedEmails.has(m[0].toLowerCase())) addWarning(warnings, "공식 연락처 외 이메일", m[0], field);
    }
  }

  // 3) 근거 자료에 없는 수치
  const numbers = evidenceNumbers(productInfo, isTlink);
  const normalizeUnit = (value: string) => value.replace(/[\s,]/g, "").replace(/퍼센트/g, "%");
  const sourceUnits = new Set(Array.from(
    evidenceSourceText(productInfo, isTlink).matchAll(NUMBER_WITH_UNIT),
    (match) => normalizeUnit(match[0]),
  ));
  for (const [field, text] of Object.entries(fields)) {
    if (field === "사진관찰") continue;
    for (const m of text.matchAll(NUMBER_WITH_UNIT)) {
      const n = m[1].replace(/,/g, "");
      const unit = m[2].replace(/\s+/g, "");
      const ok = STRICT_UNITS.has(unit)
        ? sourceUnits.has(normalizeUnit(m[0]))
        : numbers.has(n);
      if (!ok) addWarning(warnings, "근거 자료에 없는 수치", m[0].trim(), field);
    }
  }

  // 4) 필수 키워드·제목/첫 문단 표현 (티링크 제품만)
  const requiredKeywords: KeywordCheck[] = isTlink
    ? guidelines.requiredKeywords.map((keyword) => ({
        keyword,
        inBlogTitle: includesLoose(content.blogTitle, keyword),
        inBlogContent: includesLoose(content.blogContent, keyword),
        inHeadlines: includesLoose(content.headlines.join(" "), keyword),
      }))
    : [];
  const intro = `${content.blogTitle}\n${firstParagraph(content.blogContent)}`;
  const titlePhrases: PhraseCheck[] = isTlink
    ? guidelines.titleOrFirstParagraphPhrases.map((phrase) => ({ phrase, found: includesLoose(intro, phrase) }))
    : [];

  const keywordsOk = requiredKeywords.every((k) => k.inBlogTitle && k.inBlogContent && k.inHeadlines);
  const warningList = [...warnings.values()];
  return {
    applicable: isTlink,
    requiredKeywords,
    titlePhrases,
    warnings: warningList,
    footerAppended: opts.footerAppended,
    hashtagsRemoved: opts.hashtagsRemoved,
    passed: keywordsOk && warningList.length === 0,
  };
}

/** 검증 통과한 응답에 후처리(해시태그·하단 정보)를 적용하고 가이드라인을 점검한다 */
export function finalizeContent(
  content: GeneratedContent,
  opts: { isTlink: boolean; productInfo: string },
): { content: GeneratedContent; guidelineCheck: GuidelineCheck } {
  const tags = normalizeHashtags(content.hashtags, opts.isTlink);
  const footer = opts.isTlink ? ensureFooter(content.blogContent) : { content: content.blogContent, appended: [] };
  const finalContent: GeneratedContent = { ...content, hashtags: tags.hashtags, blogContent: footer.content };
  const guidelineCheck = checkGuidelines(finalContent, {
    isTlink: opts.isTlink,
    productInfo: opts.productInfo,
    footerAppended: footer.appended,
    hashtagsRemoved: tags.removed,
  });
  return { content: finalContent, guidelineCheck };
}
