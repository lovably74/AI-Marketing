# T-LINK Value Studio v3.0

현장 사진 1장과 제품 정보로 티링크의 기술 강점과 CEO 영업 문제 가설을 분석합니다(기본 AI: Google Gemini).
질문형 제목, 블로그·SNS 문구와 편집 가능한 카드뉴스(1080×1350 PNG)를 만들고, QR을 통해 CEO BLIND SPOT 체험(`/experience`) 또는 티링크 공식 경영분석 보고서로 연결합니다.
생성 결과는 수신 고객 정보와 함께 PDF·Word·PPT·Excel·ZIP으로 내려받거나 이메일로 보낼 수 있고, 생성·발송 이력은 DB(SQLite)에 남습니다.

- 요구사항: `../docs/deliverables/PRD_요구사항정의서.md`
- AI 제공사 구조: `../docs/adr/0001-ai-provider-추상화와-모델관리.md`
- 지식베이스: `data/tlink-knowledge.json` (기능 F001~F010, 확인 사실 K001~K014)
- 마케팅 가이드라인: `data/marketing-guidelines.json`
- 모델 목록: `config/ai-models.json`

## 1. 설치

필요 환경: Node.js 22.13 이상(`package.json` engines, 개발 시 v26에서 확인), npm.

```bash
cd studio
npm ci
```

## 2. `.env.local` 설정

```bash
cp .env.local.example .env.local
```

| 변수 | 필수 | 설명 |
|---|---|---|
| `GEMINI_API_KEY` | 예(기본 모델) | 기본 모델(`gemini-3.8-flash`) 호출용. https://aistudio.google.com/apikey 에서 발급 |
| `OPENAI_API_KEY` | 아니요 | `gpt-4o` 모델을 켜서 쓸 때만 필요. 기본 모델의 키가 없으면 키가 설정된 다른 사용 중 모델을 고릅니다 |
| `NEXT_PUBLIC_SITE_URL` | 아니요 | 공개 주소를 설정하면 카드뉴스 QR이 해당 주소의 `/experience`로 연결됩니다. 비어 있거나 루프백 주소면 티링크 공식 보고서로 연결됩니다 |
| `ADMIN_TOKEN` | 아니요 | `/admin`에서 모델을 추가·삭제·기본 지정하거나 연결 테스트할 때, `/history`·`/api/history`를 조회할 때 쓰는 토큰. 비워 두면 관리·이력 기능이 막힘 |
| `SMTP_HOST` | 이메일 발송 시 | SMTP 서버 주소(예: Gmail은 `smtp.gmail.com`) |
| `SMTP_PORT` / `SMTP_SECURE` | 이메일 발송 시 | Gmail은 `465` / `true`(SSL) |
| `SMTP_USER` / `SMTP_PASS` | 이메일 발송 시 | 발송 계정과 비밀번호. **Gmail은 계정에 2단계 인증을 켠 뒤 발급한 16자리 앱 비밀번호**를 넣습니다(일반 로그인 비밀번호는 거부됨) |
| `MAIL_FROM` | 이메일 발송 시 | 보내는 사람 표시. 예: `T-LINK 영업팀 <sales@example.com>` |
| `DATABASE_URL` | 아니요 | 이력 DB. 기본값 `sqlite:./.data/tlink.db`(studio 폴더 기준). PostgreSQL은 향후 지원 예정 |

- 키는 서버에서만 읽으며 브라우저로 보내지 않습니다. `.env.local`은 `.gitignore`로 git에서 제외됩니다.
- 값을 바꾼 뒤에는 서버를 다시 시작해야 합니다.
- SMTP 값이 없으면 이메일 발송만 막히고(발송 버튼 비활성, "SMTP 미설정" 안내) 생성·다운로드는 그대로 동작합니다.
- **키가 없으면 가짜 결과를 보여 주지 않고** `MISSING_API_KEY` 오류를 화면에 표시합니다.

## 3. 실행

```bash
npm run dev            # 개발 서버 (기본 http://localhost:3000)
npm run dev -- -p 3100 # 포트를 바꿀 때

npm run build          # 운영 빌드
npm start -- -p 3100   # 운영 서버(반드시 studio 폴더에서 실행: DB 마이그레이션을 <cwd>/src/lib/db/migrations에서 읽음)

npm run lint           # ESLint
npm run test:validate  # 검증 로직 단위 확인(근거 ID, 키워드, 금지표현, 해시태그, 하단 연락처, 이미지 검사)
```

## 4. 관리자 페이지 사용법 (`/admin`)

1. 화면 오른쪽 위 **[모델 관리]** 또는 `http://localhost:3000/admin`으로 이동합니다.
2. **관리자 토큰**에 `.env.local`의 `ADMIN_TOKEN` 값을 입력합니다(이 브라우저 탭에만 보관).
3. 할 수 있는 일
   - **기본 모델 지정**: 별(★) 아이콘을 누릅니다. 사용자 화면의 기본 선택값이 됩니다. 이 화면에서 연결 테스트를 통과하지 않은 모델이면 확인 창이 한 번 더 뜹니다.
   - **사용 여부**: 체크박스로 켜고 끕니다(최소 1개는 켜져 있어야 함).
   - **모델 추가**: 제공사(gemini/openai), 제공사 API 기준 모델 ID, 표시명, id를 입력하고 [추가].
   - **삭제**: [삭제]. 기본 모델은 끄거나 삭제할 수 없습니다(먼저 다른 모델을 기본으로 지정).
   - **연결 테스트**: 짧은 텍스트 요청을 실제로 보내 응답 여부를 확인합니다(소량 과금 가능).
4. 화면 위쪽에 제공사별 API 키 **설정 여부만** 표시됩니다(키 값은 노출하지 않음).
5. 토큰이 없거나 틀리면 저장·삭제·연결 테스트가 401로 거부됩니다. 존재하지 않는 모델 ID로 연결 테스트를 하면 `[PROVIDER_ERROR] Gemini에서 해당 모델을 찾을 수 없습니다…`가 표시됩니다.

### 이력 조회 (`/history`, `/api/history`)

생성·발송 이력은 DB에 저장되며 고객 정보가 포함되므로 관리자 토큰이 있어야 조회할 수 있습니다. 화면에서는 헤더의 **[메일 발송 이력]**·**[콘텐츠 생성 이력]**으로 들어가 토큰을 입력합니다.

```bash
curl -H "x-admin-token: <ADMIN_TOKEN>" "http://localhost:3000/api/history?limit=20"
```

## 5. 시연 절차 (CEO BLIND SPOT + 고객 전달)

### 사전 준비 (시연 전날까지)

- `.env.local`에 `GEMINI_API_KEY`(필수), `ADMIN_TOKEN`(관리자·이력 화면), `SMTP_*`·`MAIL_FROM`(메일 발송 시연 시)을 넣고 서버를 다시 시작합니다.
- `/admin`에서 토큰을 넣고 기본 모델의 **[연결 테스트]**가 성공하는지 확인합니다(소량 과금).
- 메일 시연은 본인 또는 `sales@example.com` 같은 시연용 주소로만 보냅니다. 실제 고객 주소를 쓰지 않습니다.
- Node.js 22.13 이상인지 확인합니다(`node -v`).

### 시연 순서

| # | 확인 항목 | 시연 방법 |
|---|---|---|
| 1 | 사진 업로드 | [1. 현장 사진 업로드]를 클릭하거나 끌어다 놓습니다(JPG·PNG·WebP, 8MB 이하). 다른 형식·8MB 초과·위장 파일은 즉시 거부됩니다(`test-assets/` 참고). |
| 2 | 제품 정보 | 티링크 기본값과 기본 타깃 **영업을 직접 관리하는 중소기업 대표**를 확인합니다. 업종은 필요할 때 입력합니다. |
| 3 | AI 분석 | **[AI 분석 및 홍보 문구 생성]**을 누르면 단계 안내와 경과 시간이 표시됩니다(최대 90초). |
| 4 | 분석 결과 | 사진 관찰, 예상 업무 환경, 기술 강점 1~3개와 근거(근거 ID를 누르면 공식 자료 원문), CEO 영업 문제 가설 3종(놓친 영업기회·반복 불만·영업 보고 공백)을 확인합니다. |
| 5 | 카드뉴스 편집 | **카드뉴스 편집 및 다운로드**에서 제목을 고르고 제목·상세 문구·CTA를 고쳐 미리보기 반영을 확인한 뒤 **[카드뉴스 PNG 다운로드 (1080×1350)]**를 누릅니다. |
| 6 | 30초 체험 | 상단 **[30초 체험]** 또는 공개 주소가 설정된 카드 QR로 `/experience`를 엽니다. 상황을 고르고 대표가 확인할 정보와 관련 기능을 봅니다. |
| 7 | 블로그·SNS | **블로그·SNS 홍보 콘텐츠**에서 블로그·SNS·CTA·해시태그와 가이드라인 점검 결과를 보고 **[복사]**합니다. |
| 8 | 고객 정보 | **고객 전달**에서 수신 고객 정보(이메일 필수)를 입력합니다. 고객 정보는 AI로 보내지 않습니다. |
| 9 | PDF 미리보기 | **[PDF 미리보기]**로 고객용 PDF를 확인하고 **[PDF 다운로드]**로 저장합니다. 카드 이미지는 편집한 카드 그대로 들어갑니다. |
| 10 | 일괄 다운로드 | Word·PPT·Excel을 각각 받거나 **[전체 한 번에 다운로드(ZIP)]**로 받습니다. |
| 11 | 이메일 발송 | 제목·본문 미리보기를 확인하고 **[발송]** → 확인 창의 **[발송 확정]**을 눌러야 실제로 발송됩니다. |
| 12 | 이력 | 헤더의 **[콘텐츠 생성 이력]**·**[메일 발송 이력]**에서 토큰을 넣고 방금 생성·발송 건을 확인합니다. |

**시연 사진**: `test-assets/demo/`의 사진을 씁니다(출처는 같은 폴더 README). 권장 순서는 `01_사무실_인터넷전화.jpg`(기본 시연) → `03_상담팀_헤드셋.jpg`(타깃 변경) → `02_외근영업_휴대폰.jpg` → `99_무관사진_매장결제.jpg`(무관한 사진 처리)입니다. 경계값 시험용 사진(세로 사진, 어두운 사진, 위장 파일 등)은 `test-assets/`에 있습니다.

**응답 시간**: 실측 기준 생성 1회에 약 22~40초가 걸립니다(모델·네트워크 상황에 따라 달라짐).

### 실패 시 대응

| 화면의 오류 코드 | 의미 | 대응 |
|---|---|---|
| `MISSING_API_KEY` | 선택한 모델의 제공사 키가 서버에 없음 | `.env.local`에 키를 넣고 서버 재시작. 또는 [AI 모델]에서 "키 미설정"이 없는 모델을 고릅니다 |
| `PROVIDER_ERROR` | 제공사 호출 실패(사용량 한도 429, 모델 없음, 네트워크) | 30초쯤 기다렸다 **[다시 시도]**. 반복되면 [AI 모델]에서 다른 모델을 고르거나 `/admin` 연결 테스트로 원인 확인 |
| `INVALID_AI_RESPONSE` | AI 응답이 형식·근거 ID·금지 표현 검증을 1회 재시도 후에도 통과하지 못함 | **[다시 시도]**. 제품 주요 정보를 줄이거나 사진을 바꾸면 통과율이 오릅니다 |
| `TIMEOUT` | 90초 안에 응답이 오지 않음 | **[다시 시도]**. 반복되면 다른 모델 선택 |
| `INVALID_INPUT` / `INVALID_IMAGE` / `IMAGE_TOO_LARGE` | 입력 길이·사진 형식·크기(8MB) 문제 | 안내 문구대로 입력을 고칩니다 |
| `RATE_LIMITED` | 메일 발송 속도 제한(IP당 분당 3회) | 1분 뒤 다시 발송 |
| `SMTP_NOT_CONFIGURED` / `EMAIL_SEND_FAILED` | SMTP 값 누락 또는 인증·발송 실패 | `SMTP_*` 값 확인(Gmail은 앱 비밀번호). 메일 대신 PDF를 내려받아 전달 |

PNG 저장이 실패하면(폰트 로딩 지연) 페이지를 새로고침한 뒤 다시 저장합니다. 시연 중 AI가 계속 실패하면 미리 생성해 둔 결과를 **[콘텐츠 생성 이력]**에서 보여 주는 것으로 대체합니다(가짜 결과를 만들지 않습니다).

오류 시연(선택): `.env.local`의 키를 비우고 서버를 재시작한 뒤 생성하면 `MISSING_API_KEY` 오류가 화면에 표시되고 결과는 나오지 않습니다.

## 6. 동작 원칙과 제약

- **가짜 결과 없음**: 키 없음(`MISSING_API_KEY`), 제공사 오류(`PROVIDER_ERROR`), 응답 형식·근거 검증 실패(`INVALID_AI_RESPONSE`), 시간 초과(`TIMEOUT`) 시 오류 코드와 메시지만 반환합니다. 목업·예시·폴백 콘텐츠는 없습니다.
- **근거 검증**: `evidence`에는 `F001~F010`, `K001~K014`, `USER_INPUT`만 허용합니다. 사용자 입력을 근거로 삼으면 해당 구절을 확인합니다. 근거 또는 금지 표현 검증에 실패하면 1회 재시도합니다.
- **티링크 외 제품**: 제품명에 티링크 관련 명칭이 없으면 사용자 입력(`USER_INPUT`)만 근거로 허용하고 티링크 전용 가이드라인(필수 키워드·공식 연락처·태그 목록)은 적용하지 않습니다.
- **프롬프트 인젝션 방어**: 사용자 입력은 `<user_input>` 블록 안의 데이터로만 전달하고(구분 태그는 제거), 시스템 지침 우선과 사진 속 글자 무시를 명시합니다.
- **이미지**: 클라이언트와 서버 양쪽에서 MIME 형식·매직바이트·크기(8MB)를 검사합니다. 서버 디스크에 저장하지 않고 메모리에서만 처리합니다.
- **외부 AI 전송 고지**: 업로드한 사진과 입력한 제품 정보는 분석을 위해 **Google Gemini 또는 OpenAI로 전송**됩니다. 얼굴·전화번호·고객명 등 개인정보는 가린 뒤 올려 주세요.
- **JSON 저장 제약**: 모델 설정은 `config/ai-models.json` 파일에 저장하므로 **로컬이나 단일 서버에서 실행할 때만 영구 유지**됩니다. Vercel 같은 서버리스 환경에서는 관리자 변경이 저장되지 않습니다.
- **타임아웃**: AI 호출은 재시도를 포함해 90초로 제한하며 `/api/generate`의 `maxDuration`은 120초입니다.
- **카드뉴스 폰트**: Noto Sans KR(next/font, 같은 출처 번들)을 쓰며, PNG 저장 시 카드에 쓰인 글자가 속한 폰트 조각만 골라 임베드합니다.
- **메일 속도 제한**: `/api/email`은 IP당 분당 3회, 서버 전체 시간당 30회로 제한합니다(초과 시 `RATE_LIMITED`). 서버 메모리에 기록하므로 서버를 재시작하면 초기화됩니다.
- **실행 위치**: `next start`(`npm start`)는 반드시 `studio` 폴더에서 실행합니다. DB 파일(`./.data/tlink.db`)과 마이그레이션 경로가 현재 폴더 기준이기 때문입니다.
- **`.data/` 보호**: 이력 DB에는 고객 개인정보(이름·이메일 등)와 원본 사진이 들어 있습니다. git에서는 제외되지만, 운영 시 백업과 접근 통제(폴더 권한 제한)가 필요합니다.
- **OpenAI**: 어댑터는 있으나 현재 `gpt-4o`는 비활성 상태입니다(키를 넣고 `/admin`에서 켜면 사용 가능).
- AI 생성 결과는 게시 전에 담당자가 사실 여부를 확인해야 합니다.

## 7. 폴더 구조

```
studio/
├─ config/ai-models.json          모델 레지스트리(관리자 페이지에서 수정)
├─ data/tlink-knowledge.json      지식베이스(features·facts·cautions)
├─ data/marketing-guidelines.json 마케팅 가이드라인·금지 표현 패턴
├─ assets/fonts/                 PDF·문서용 한글 폰트(나눔고딕, OFL)
├─ test-assets/                  경계값 시험 사진(README 참고)
├─ test-assets/demo/             시연 사진과 출처
├─ scripts/test-validate.ts       검증 로직 단위 확인
└─ src/
   ├─ app/page.tsx, app/admin/page.tsx, app/experience/page.tsx
   ├─ app/api/generate/route.ts       POST 생성(multipart)
   ├─ app/api/models/route.ts         GET 목록·키 설정 여부 / POST·PUT·DELETE(x-admin-token)
   ├─ app/api/models/test/route.ts    POST 연결 테스트(x-admin-token)
   ├─ app/api/export, api/email       문서 내보내기·이메일 발송
   ├─ app/api/history/route.ts        GET 이력 조회(x-admin-token)
   ├─ app/experience/page.tsx         CEO BLIND SPOT 30초 체험
   ├─ components/                     입력·결과·카드뉴스 편집·고객 전달·이력·관리자 화면
   └─ lib/
      ├─ ai/providers/{gemini,openai}.ts  제공사 어댑터
      ├─ ai/registry.ts, prompt.ts, schema.ts, validate.ts, generate.ts
      ├─ export/                          PDF·Word·PPT·Excel·ZIP 생성
      ├─ mail/                            메일 본문 구성·SMTP 설정
      ├─ db/                              이력 저장소(SQLite, migrations)
      ├─ card-export.ts                   PNG 캡처(폰트 임베드)
      └─ image.ts, knowledge.ts, constants.ts
```
