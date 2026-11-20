// 지식베이스와 마케팅 가이드라인 (클라이언트·서버 공용, 공개 자료)
import knowledgeJson from "../../data/tlink-knowledge.json";
import guidelinesJson from "../../data/marketing-guidelines.json";

export interface KnowledgeFeature {
  id: string;
  feature: string;
  description: string;
  benefit: string;
  source: string;
}

export interface KnowledgeFact {
  id: string;
  fact: string;
  source: string;
  caution: string;
}

export interface KnowledgeBase {
  product: string;
  brand: string;
  company: string;
  version: string;
  basis: string;
  contacts: { homepage: string; blog: string; phone: string; center: string; email: string };
  features: KnowledgeFeature[];
  facts: KnowledgeFact[];
  cautions: string[];
}

export interface MarketingGuidelines {
  source: string;
  requiredKeywords: string[];
  requiredKeywordRule: string;
  titleOrFirstParagraphPhrases: string[];
  titleOrFirstParagraphRule: string;
  subKeywords: string[];
  allowedHashtags: string[];
  excludedHashtags: string[];
  blogStructure: string[];
  blogStyle: string;
  conclusionMessage: string;
  securityPoints: string[];
  imagePlaceholders: string[];
  imagePlaceholderRule: string;
  footer: { homepage: string; blog: string; phone: string; center: string };
  adjustedRules: string[];
  prohibitions: string[];
  prohibitedPatterns: { label: string; scope: "all" | "tlink"; pattern: string }[];
  allowedPhoneNumbers: string[];
  allowedEmails: string[];
}

export const knowledge = knowledgeJson as KnowledgeBase;
export const guidelines = guidelinesJson as MarketingGuidelines;

/** 근거로 쓸 수 있는 ID 목록 (USER_INPUT 제외) */
export const KNOWLEDGE_IDS: ReadonlySet<string> = new Set([
  ...knowledge.features.map((f) => f.id),
  ...knowledge.facts.map((f) => f.id),
]);

export const USER_INPUT_EVIDENCE = "USER_INPUT";

export type EvidenceDetail =
  | { id: string; kind: "feature"; title: string; text: string; benefit: string; source: string }
  | { id: string; kind: "fact"; title: string; text: string; caution: string; source: string }
  | { id: string; kind: "user"; title: string; text: string; source: string }
  | { id: string; kind: "unknown"; title: string; text: string; source: string };

/** 근거 ID로 지식베이스 원문을 찾는다 */
export function lookupEvidence(id: string): EvidenceDetail {
  const feature = knowledge.features.find((f) => f.id === id);
  if (feature) {
    return {
      id,
      kind: "feature",
      title: feature.feature,
      text: feature.description,
      benefit: feature.benefit,
      source: feature.source,
    };
  }
  const fact = knowledge.facts.find((f) => f.id === id);
  if (fact) {
    return { id, kind: "fact", title: "추가 확인 사실", text: fact.fact, caution: fact.caution, source: fact.source };
  }
  if (id === USER_INPUT_EVIDENCE) {
    return {
      id,
      kind: "user",
      title: "사용자 입력",
      text: "사용자가 입력한 제품 주요 정보를 근거로 했습니다.",
      source: "입력 화면의 제품 주요 정보",
    };
  }
  return { id, kind: "unknown", title: "알 수 없는 근거", text: "등록되지 않은 근거 ID입니다.", source: "-" };
}

/** 제품명·정보가 티링크 제품인지 판별한다 (FR-API-10) */
export function isTlinkProduct(productName: string): boolean {
  const normalized = productName.replace(/\s+/g, "").toLowerCase();
  return ["티링크", "t-link", "tlink", "t·link", "t.link", "비즈레코딩", "티링크노트", "tlinknote"].some((k) =>
    normalized.includes(k),
  );
}
