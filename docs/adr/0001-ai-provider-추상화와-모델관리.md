# ADR-0001: AI 제공사 추상화(Gemini 기본 + OpenAI 예비)와 JSON 파일 기반 모델 관리

- 상태: 승인됨 (2026-11-20, 사용자 인터뷰)
- 결정자: 사용자(경영자), Claude(PM)

## 배경
원 과제는 "OpenAI Vision 지원 멀티모달 API" 사용과 "복잡한 관리자 화면 제외"를 명시했다.
사용자는 인터뷰에서 **Gemini를 우선 활용**하고, **관리자가 모델을 추가할 수 있도록** 확장성을 갖추길 요구했다.
그러면서도 DB, 로그인, RAG는 여전히 만들지 않는다는 원 과제의 제약은 유지된다.

## 결정
1. **제공사 어댑터 구조**: `lib/ai/providers/{gemini,openai}.ts`가 공통 인터페이스
   `generate({ systemPrompt, userPrompt, image, jsonSchema, model }) => 원문 JSON 문자열`을 구현한다.
   - Gemini: `@google/genai` SDK, `responseMimeType: application/json` + `responseSchema`(구조화 출력)
   - OpenAI: `openai` SDK, Chat Completions `response_format: json_schema`(strict)
   - 새 제공사는 어댑터 파일 하나와 레지스트리 등록만으로 추가할 수 있다.
2. **모델 레지스트리**: `config/ai-models.json`(id, provider, model, label, enabled, isDefault).
   기본값은 `gemini-3.8-flash`(2026-11 Google 공식 문서 기준 최신 안정 Flash 모델)다.
3. **관리자 페이지 `/admin`**: 목록·추가·삭제·기본 모델 지정만 한다. 저장은 `ADMIN_TOKEN` 헤더가 일치할 때만 허용한다.
   로그인·세션은 만들지 않는다.
4. **검증은 제공사와 무관하게 서버에서 Zod로 한다.** 제공사의 구조화 출력은 1차 방어일 뿐 신뢰하지 않는다.

## 대안
| 대안 | 기각 사유 |
|---|---|
| 환경변수로 단일 모델만 지정 | 사용자 요구(관리자가 모델 추가)를 충족하지 못함 |
| DB 기반 관리자 기능 | 원 과제의 "DB 제외" 위반, 3시간 범위 초과 |
| Vercel AI SDK 등 통합 라이브러리 | 의존성과 학습 비용 증가. 어댑터 2개는 직접 구현이 더 단순함 |

## 결과·제약
- JSON 파일에 저장하므로 서버리스 배포 환경에서는 관리자 변경이 영구 저장되지 않는다(로컬과 단일 서버 시연 기준).
- 사진은 Google 또는 OpenAI로 전송된다. 사용자가 2026-11-20 전송을 승인했고, 화면에 고지 문구를 둔다.
