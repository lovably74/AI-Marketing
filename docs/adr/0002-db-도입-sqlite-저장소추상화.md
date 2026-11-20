# ADR-0002: DB 도입 — SQLite(node:sqlite) + 저장소 추상화, 향후 PostgreSQL 확장

- 상태: 승인됨 (2026-11-20, 사용자 지시)
- 결정자: 사용자(경영자), Claude(PM)
- 관련: 원 과제 2절·11절 "별도 DB 구축 안 함"을 **대체**한다. PRD 변경사항 C7.

## 배경
원 과제는 DB를 제외했다. 고객 전달 기능(PDF·이메일, ADR 없음·PRD C6)이 추가되면서 사용자는 "모든 정보를 DB화하고, 지금은 SQLite를 쓰되 향후 PostgreSQL 등으로 확장할 수 있게" 하라고 지시했다.

## 결정
1. **드라이버**: Node 26 내장 `node:sqlite`(DatabaseSync)를 쓴다. 네이티브 모듈 빌드나 ORM 의존성이 없어 3시간 일정과 Windows 환경에서 위험이 가장 낮다.
2. **저장소 인터페이스**: `src/lib/db/types.ts`의 `Repository`를 기준으로 하고, `sqlite.ts`가 구현한다. `getRepository()`가 `DATABASE_URL`로 드라이버를 고른다(기본 `sqlite:./.data/tlink.db`). PostgreSQL은 같은 인터페이스의 `postgres.ts`(pg 드라이버)를 추가하면 되며, 지금은 명확한 미구현 오류를 낸다.
3. **스키마**: generations(입력, 모델, 결과 JSON, 가이드라인 점검, 원본 사진 BLOB), recipients(수신 고객, email 기준 upsert), email_logs, export_logs. 이식성을 위해 UUID 텍스트 키, ISO 시각 텍스트, JSON 텍스트를 쓴다. PG용 참고 마이그레이션을 함께 둔다.
4. **보안·개인정보**: DB 파일(`studio/.data/`)은 git에서 제외한다. 이력 조회 API는 `ADMIN_TOKEN`으로 보호한다. 고객 정보는 AI에 보내지 않는다.
5. **범위**: AI 모델 설정은 이번에는 기존 `config/ai-models.json`에 그대로 둔다(관리자 기능 회귀 위험). 다음 단계에서 DB로 옮긴다.

## 대안
| 대안 | 기각 사유 |
|---|---|
| Prisma | 엔진 바이너리와 생성 단계 필요, 마감 내 Windows·Node 26 검증 위험 |
| Drizzle + better-sqlite3 | Node 26용 네이티브 바이너리 빌드 위험 |
| JSON 파일 저장 | 동시성·조회·PG 이전에 부적합 |

## 결과·제약
- 원본 현장 사진을 DB에 저장하므로 개인정보가 포함될 수 있다. 화면 고지와 DB 파일 접근 통제가 필요하다. NFR-02("디스크 미저장")는 이 결정으로 대체된다.
- SQLite 파일 DB는 단일 서버 기준이다. 다중 서버나 서버리스 배포 시 PostgreSQL 어댑터가 필요하다.
