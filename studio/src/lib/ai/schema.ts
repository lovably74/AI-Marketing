// AI 응답 스키마: 서버 재검증용 Zod 스키마와 제공사별 JSON 스키마 (FR-API-05)
import { z } from "zod";
import { BLIND_SPOTS, CAMPAIGN_COPY_LENGTH, CAMPAIGN_HEADLINE_LENGTH } from "../constants";

const text = (max: number) => z.string().trim().min(1).max(max);

const blindSpotSchema = z.object({
  hypothesis: text(220),
  question: text(120),
  relatedFeature: z.number().int().min(0).max(3),
  benefit: text(160),
  copy: text(CAMPAIGN_COPY_LENGTH),
});

const campaignSchema = z.object({
  probableEnvironment: text(160),
  potentialIssue: text(220),
  productRelevance: text(220),
  blindSpots: z.object({
    opportunity: blindSpotSchema,
    complaint: blindSpotSchema,
    handoff: blindSpotSchema,
  }),
});

/**
 * evidence 형식은 "문자열 배열"로 통일한다. 예: ["F004", "K002"] 또는 ["USER_INPUT"]
 */
export const differentiatorSchema = z.object({
  feature: z.string().trim().min(1).max(60),
  customerProblem: z.string().trim().min(1).max(400),
  customerBenefit: z.string().trim().min(1).max(400),
  evidence: z.array(z.string().trim().min(1).max(20)).min(1).max(5),
  inputExcerpt: z.string().trim().max(300).optional(),
  executiveValue: text(160).optional(),
  marketingMessage: text(160).optional(),
});

export const generatedContentSchema = z.object({
  sceneAnalysis: z.string().trim().min(1).max(1500),
  differentiators: z.array(differentiatorSchema).min(1).max(3),
  headlines: z.array(z.string().trim().min(1).max(120)).length(3),
  blogTitle: z.string().trim().min(1).max(150),
  blogContent: z.string().trim().min(200).max(8000),
  snsContent: z.string().trim().min(1).max(1500),
  cardHeadline: z.string().trim().min(1).max(60),
  cardSubtext: z.string().trim().min(1).max(120),
  cta: z.string().trim().min(1).max(80),
  hashtags: z.array(z.string().trim().min(1).max(40)).min(1).max(30),
  campaign: campaignSchema.optional(),
});

export type Differentiator = z.infer<typeof differentiatorSchema>;
export type GeneratedContent = z.infer<typeof generatedContentSchema>;

const str = (description: string) => ({ type: "string", description });

function object(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

/** 공통 JSON 스키마 (원 과제 7절 형식). 제공사 변환 전 원본 */
export function buildResponseJsonSchema(): Record<string, unknown> {
  const blindSpot = object({
    hypothesis: str("고객관리 문제 가설. 발생 사실이나 고객 성과로 단정하지 않는다"),
    question: str("대표가 확인해야 할 핵심 질문"),
    relatedFeature: { type: "integer", description: "차별점의 1부터 시작하는 번호. 관련 기능 근거가 없으면 0" },
    benefit: str("관련 기능을 적용할 때 기대되는 관리상 편익. 근거가 없으면 확인이 필요한 점"),
    copy: str(`문제, 근거 있는 기능, 기대 가치를 연결한 상세 홍보 문구. ${CAMPAIGN_COPY_LENGTH}자 이하`),
  });
  return object({
    sceneAnalysis: str("현장 사진에서 실제로 보이는 것만 설명한 분석(추측 금지)"),
    differentiators: {
      type: "array",
      description: "근거 있는 기술 강점 1~3개. 근거가 충분하면 3개",
      minItems: 1,
      maxItems: 3,
      items: object({
        feature: str("기능명(20자 이내로 짧게)"),
        customerProblem: str("고객이 겪는 문제"),
        customerBenefit: str("고객이 얻는 기대 가치"),
        evidence: {
          type: "array",
          description: "근거 ID 배열. 지식베이스 ID(F001 형식, K001 형식) 또는 USER_INPUT만 허용",
          minItems: 1,
          maxItems: 5,
          items: { type: "string" },
        },
        inputExcerpt: str("USER_INPUT을 근거로 썼으면 제품 주요 정보의 해당 구절을 그대로 인용한다. 아니면 빈 문자열"),
        executiveValue: str("중소기업 대표의 의사결정에 도움이 될 수 있는 경영 가치"),
        marketingMessage: str("기능과 기대 가치를 담은 짧은 홍보 문구"),
      }),
    },
    headlines: {
      type: "array",
      description: `놓친 영업기회, 반복적인 고객 불만, 영업 보고의 공백 순서의 질문형 제목 3개. 각각 ${CAMPAIGN_HEADLINE_LENGTH}자 이하, 물음표로 끝낸다`,
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
    },
    blogTitle: str("블로그 제목"),
    blogContent: str("블로그 본문(줄바꿈 포함 일반 텍스트)"),
    snsContent: str("SNS 게시 문구"),
    cardHeadline: str("카드뉴스 제목(20자 이내)"),
    cardSubtext: str("카드뉴스 부제(40자 이내)"),
    cta: str("행동 유도 문구(25자 이내)"),
    hashtags: {
      type: "array",
      description: "해시태그 8~12개(# 포함, 공백 없음)",
      items: { type: "string" },
    },
    campaign: object({
      probableEnvironment: str("사진과 입력 업종을 바탕으로 추정한 업무 환경"),
      potentialIssue: str("이 환경에서 나타날 수 있는 고객관리 문제. 확인이 필요한 가설"),
      productRelevance: str("입력·공식 자료로 확인된 기능과 환경의 관련성"),
      blindSpots: object(Object.fromEntries(BLIND_SPOTS.map(({ id }) => [id, blindSpot]))),
    }),
  });
}

/** 객체 트리에서 특정 키를 재귀적으로 제거한다 */
function stripKeys(value: unknown, keys: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) return value.map((v) => stripKeys(v, keys));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (keys.has(k)) continue;
      out[k] = stripKeys(v, keys);
    }
    return out;
  }
  return value;
}

/**
 * Gemini responseJsonSchema용.
 * 설치된 @google/genai 타입 주석상 responseJsonSchema 지원 키는 type, description, items, minItems,
 * maxItems, properties, required, additionalProperties 등이며 propertyOrdering은 "설정 가능한 비표준 키"다.
 * 비표준 키에 의존하지 않도록 propertyOrdering은 넣지 않는다(표준 JSON Schema 키만 사용).
 */
export function buildGeminiSchema(): Record<string, unknown> {
  return buildResponseJsonSchema();
}

/**
 * OpenAI strict json_schema용.
 * strict 모드 호환을 위해 배열 길이 제약을 제거한다.
 * (길이 제약은 서버 Zod 검증에서 강제한다.)
 */
export function buildOpenAISchema(): Record<string, unknown> {
  return stripKeys(buildResponseJsonSchema(), new Set(["minItems", "maxItems"])) as Record<
    string,
    unknown
  >;
}
