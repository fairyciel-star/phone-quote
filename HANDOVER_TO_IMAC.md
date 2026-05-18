# 📋 인수인계 문서: phone-quote-v2 (iMac 신규 프로젝트)

> **사용법:** iMac에서 Claude Code 첫 메시지로 이 파일 전체 내용을 붙여넣으세요.
> Claude가 배경·목표·기술스택을 즉시 이해하고 바로 작업을 시작할 수 있습니다.

---

## 1. 프로젝트 배경

### 비즈니스 컨텍스트
- **운영 매장**: 동네휴대폰마트 (부천시 오정구 삼작로 385)
- **기존 앱**: `phone-quote` (Windows PC에서 개발 중, Vercel 배포됨)
- **이번 작업**: iMac에서 **완전히 새로운 v2 앱**을 처음부터 빌드
- **기존 앱은 건드리지 않음** (참조·학습용으로만 사용 가능)

### 3단계 사업 플랜
**Phase 1 (현재 목표)**: QR코드 → 24시간 견적 확인 → **매장 내방 유도**
- 당근마켓·로드샵·전단지 등에 QR 뿌리기
- 매장 방문 실적 증대

**Phase 2**: 타 매장(SK/KT/LG) 판매 지원 → **건당 수수료 수익**
- 매장주가 직접 가격 입력하는 셀프서비스 툴
- 리드 라우팅 → 해당 매장에 카톡/텔레그램 알림

**Phase 3 (최종 목표)**: 하이퍼로컬 폰 가격 마켓플레이스
- 소비자가 근처 매장 최저가 검색
- 매장에서 실제 구매 시 성약 수수료 정산
- 네이버 플레이스·번개장터 로컬처럼 **동네 유통망 플랫폼**

---

## 2. 기술 스택 (결정 완료)

### 프론트엔드
- **React 18 + TypeScript + Vite** (기존 앱과 동일 스택 유지)
- **Zustand** (상태관리)
- **CSS Modules** (스타일)
- **PWA** (`vite-plugin-pwa`) — 홈화면 추가, 재방문 유도

### 백엔드 (Phase 2 기반으로 처음부터 반영)
- **Supabase** (Postgres + Auth + RLS + Realtime)
  - 서울 리전 선택
  - 무료 티어로 시작
- **Vercel Edge Functions** — 텔레그램·카카오 알림톡 프록시 (토큰 보호)

### 외부 서비스
- **Google Maps Embed API** (매장 지도)
- **Google Sheets API** (가격 관리, Phase 1 임시) → Phase 2에 Supabase로 마이그레이션
- **Telegram Bot API** (사장님 즉시 알림)
- **KakaoTalk 채널 / 알림톡** (Phase 2)
- **GA4 + UTM** (QR 출처 추적)

### 인프라
- **GitHub**: `fairyciel-star/phone-quote-v2` (새 레포)
- **Vercel**: 새 프로젝트 (별도 URL)

---

## 3. 데이터 모델 (Phase 2 구조를 처음부터)

### Supabase 주요 테이블
```sql
-- 매장
stores (
  id uuid PRIMARY KEY,
  name text,                    -- "동네휴대폰마트"
  address text,
  phone text,
  lat numeric, lng numeric,     -- Phase 3 근처 검색용
  telegram_chat_id text,
  kakao_channel_id text,
  owner_user_id uuid REFERENCES auth.users,
  active boolean DEFAULT true,
  created_at timestamptz
)

-- 통신사
carriers (id text PRIMARY KEY, name text, logo_url text)

-- 모델
phones (
  id text PRIMARY KEY,
  brand text, name text,
  image_url text,
  storage_options jsonb,
  colors jsonb,
  created_at timestamptz
)

-- 매장별 지원금 (핵심!)
subsidies (
  store_id uuid REFERENCES stores,
  phone_id text, carrier_id text, storage text, subscription_type text,
  msrp numeric,                 -- 출고가
  common_subsidy numeric,       -- 공통지원금
  store_subsidy numeric,        -- 매장지원금(추가지원금)
  special_subsidy numeric,      -- 특별지원
  badge text,                   -- HOT, NEW, 등
  updated_at timestamptz,
  PRIMARY KEY (store_id, phone_id, carrier_id, storage, subscription_type)
)

-- 매장별 요금제/할인
plans (store_id, carrier_id, ...)
card_discounts (store_id, carrier_id, ...)
addons (store_id, carrier_id, ...)

-- 상담/리드 (수수료 정산 기반!)
leads (
  id uuid PRIMARY KEY,
  store_id uuid,                -- 어느 매장으로 갈지
  customer_name text, customer_phone text,
  preferred_time text, memo text,
  quote_snapshot jsonb,         -- 당시 견적 전체
  utm_source text, utm_campaign text,  -- 출처
  visit_code text,              -- 6자리 방문 코드 (Phase 3)
  status text,                  -- pending/contacted/visited/sold/lost
  sold_at timestamptz,
  commission_amount numeric,
  created_at timestamptz
)

-- 이벤트 로그 (분석·정산용)
events (
  id bigserial PRIMARY KEY,
  timestamp timestamptz,
  store_id uuid,
  session_id text,
  event_type text,              -- page_view/quote_calc/consult_submit/sold
  payload jsonb
)
```

### RLS 정책
- `stores`: 본인 매장만 조회·수정 (`owner_user_id = auth.uid()`)
- `subsidies`: 본인 매장 가격만 수정, 조회는 active 매장 누구나
- `leads`: 본인 매장 리드만 조회

---

## 4. 가격 계산 로직 (기존 앱에서 검증된 공식)

```typescript
// 할부원금 = 출고가 - 공통지원금 - 매장지원금 - 특별지원 - 제휴카드24개월할인 - 부가서비스추가할인
//
// 단, 할인유형이 '선택약정'이면 공통지원금은 적용 안 함 (법적 상호배타)
// 특별지원·매장지원금은 할인유형 무관하게 항상 적용

// 월할부금: 연이율 5.9%, 복리 공식
const 월이율 = 0.059 / 12;
const factor = Math.pow(1 + 월이율, months);
월할부금 = 할부원금 * (월이율 * factor) / (factor - 1);

// 선택약정 요금할인율: 기본 25% (plan.선택약정할인율로 관리)
월요금제 = plan.monthlyFee - (선택약정 ? plan.monthlyFee * 할인율 : 0);

월납입금총액 = 월할부금 + 월요금제 + 월부가서비스료;
```

할부개월 옵션: 12·24·36개월

---

## 5. Phase 1 필수 기능 (전환율 최적화)

### UI/UX
- [ ] 7스텝 퍼널: Brand → Subscription → Carrier → Phone → Plan/Discount → Summary → Consultation
- [ ] **최저가 배지**: `🔥 HOT` + "3사 최저가 기준" + "출고가 대비 85% 할인" 문구 (통신사 로고 대신)
- [ ] **사회적 증거 토스트**: "3분 전 김○○님 상담" 랜덤 롤링
- [ ] **긴급성**: "오늘 남은 특가 N대", 일일 카운트다운
- [ ] **카톡 상담 플로팅 버튼**: Step3~5에서 조기 리드 수집
- [ ] **Exit Intent 모달**: 뒤로가기 시 "견적 저장하기" 유도 (SMS/카톡 전송)
- [ ] **공유 버튼**: 견적 페이지에서 카톡 공유
- [ ] **누적 판매대수 / 리뷰**: 매장 스토리 블록 강화
- [ ] **"왜 저렴한가" 설명**: 직매입·3사계약 스토리

### 퍼포먼스 로딩
- [ ] 시트 데이터 로드 전 skeleton 표시 (flicker 방지)
- [ ] 제조사 선택 후 "최저가 검색중" 1초 오버레이 (이미 기존 앱에 있음, 유지)

### 추적
- [ ] GA4 설치
- [ ] UTM 파라미터 파싱: `?utm_source=danggeun&utm_medium=qr&utm_campaign=20260418`
- [ ] 각 QR마다 다른 UTM → 채널 ROI 분석
- [ ] events 테이블에 주요 액션 기록 (view/quote/consult)

### PWA
- [ ] `manifest.json` (앱 이름, 아이콘, 테마색)
- [ ] Service Worker (오프라인 기본 캐시)
- [ ] 홈화면 추가 유도 UI

---

## 6. 보안 체크리스트 (기존 앱에서 배운 교훈)

> ⚠️ **중요: 이 이슈들은 기존 앱의 실수였습니다. v2에서는 처음부터 차단하세요.**

- [ ] **텔레그램 봇 토큰** 절대 클라이언트에 두지 말 것 → Vercel Edge Function으로 프록시
- [ ] **GitHub 토큰**을 커밋에 포함시키지 말 것 (gitleaks pre-commit hook 설치)
- [ ] `/admin` 경로 **Supabase Auth 보호** + RLS
- [ ] 개인정보는 **localStorage 저장 금지**, Supabase로 즉시 전송
- [ ] Vercel Middleware로 **상담 API rate limiting** (IP당 분당 3회)
- [ ] Google Maps API 키 → Google Cloud Console에서 **HTTP Referer 제한** (새 도메인 추가)
- [ ] `.env.local`은 `.gitignore`에 포함, Vercel 환경변수로 관리
- [ ] Zod로 모든 사용자 입력 검증 (이름·전화번호 포맷)

---

## 7. 준비해야 할 것 (사장님 액션)

### 계정·토큰
- [x] GitHub 계정 (fairyciel-star) — 이미 있음
- [x] Vercel 계정 — 이미 있음
- [x] Google Maps API 키 — 기존 재사용 가능 (Referer에 새 도메인 추가 필요)
- [ ] **Supabase 계정 새로 생성** → https://supabase.com
  - 프로젝트명: `phone-quote-v2`
  - 서울 리전
  - DB 비밀번호 안전하게 보관
- [ ] **Telegram 봇 새로 발급** (기존 것 노출 이력 있으면)
  - BotFather에서 `/newbot` → 토큰 받기
  - 본인 chat_id 확인 (https://api.telegram.org/bot<token>/getUpdates)
- [ ] **카카오 비즈니스 채널** (Phase 2 준비용, 당장 필수는 아님)
  - https://center-pf.kakao.com
- [ ] **Google Analytics 4** 속성 생성 → 측정 ID (G-XXXXXXXXXX)

### 로컬 환경 (iMac)
```bash
brew install node git gh
brew install --cask visual-studio-code
npm install -g @anthropic-ai/claude-code vercel
gh auth login
vercel login
```

### 환경변수 템플릿 (`.env.local`)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_GOOGLE_MAPS_KEY=...
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_DEFAULT_STORE_ID=...        # 동네폰마트 UUID
TELEGRAM_BOT_TOKEN=...           # 서버 전용 (Vercel 환경변수)
TELEGRAM_CHAT_ID=...             # 서버 전용
```

---

## 8. 매장 기본 정보 (seed 데이터)

```typescript
const defaultStore = {
  name: '동네휴대폰마트',
  address: '부천시 오정구 삼작로 385호 5호 1층',
  phone: '01056812956',
  lat: null,  // Google Geocoding으로 채울 것
  lng: null,
  story: [
    '본사 직매입으로 중간 유통 단계 제거',
    '3사 동시 계약으로 최대 지원금 확보',
    '부천지역 4,200명이 선택한 매장' // 실제 수치로 교체
  ]
};
```

---

## 9. 작업 순서 (iMac에서 이렇게 진행)

### Week 1: 기반 세팅
1. `phone-quote-v2` GitHub 레포 생성
2. Vite + React + TS 프로젝트 스캐폴딩
3. Supabase 프로젝트 생성 → 스키마 마이그레이션 (위 SQL)
4. 기본 라우팅·레이아웃·타입 정의
5. Vercel 배포 파이프라인 연결

### Week 2: 핵심 퍼널
6. 7스텝 컴포넌트 구현 (가격 계산 로직 포함)
7. Supabase에서 stores·phones·subsidies 데이터 바인딩
8. Telegram 알림 Edge Function

### Week 3: Phase 1 마케팅 요소
9. HOT 배지 + 할인율 표시
10. 사회적 증거 토스트
11. 카톡 CTA 플로팅 버튼
12. Exit Intent 모달
13. PWA 설정
14. GA4 + UTM 추적

### Week 4: 어드민 + QA
15. 매장 어드민 페이지 (Supabase Auth)
16. 가격 CRUD UI
17. 리드 대시보드 (기본)
18. QA·버그픽스
19. 실제 QR 생성·배포

---

## 10. 기존 앱에서 참조하면 좋은 자산

필요 시 기존 앱에서 **개념만 가져가고 코드는 다시 쓰기** 권장:

- 가격 계산 공식: `phone-quote/src/utils/price.ts`
- 타입 정의: `phone-quote/src/types/index.ts`
- 한국 통신사 seed: `phone-quote/src/data/carriers.json`
- Telegram 알림 메시지 포맷: `phone-quote/src/utils/telegram.ts`
- 7스텝 퍼널 구조 (참조용)

**주의: 기존 앱 레포 자체는 건드리지 말고, 필요하면 로컬에 clone만 해서 읽기용으로 사용.**

---

## 11. iMac Claude에게 전달할 첫 명령 예시

이 문서 붙여넣은 뒤 아래를 추가:

```
위 인수인계 문서 이해했으면, 먼저 다음 순서로 작업 시작해줘:

1. 현재 ~/projects/phone-quote-v2 폴더에 Vite + React + TS 프로젝트 스캐폴딩
2. GitHub 새 레포(fairyciel-star/phone-quote-v2, private) 생성하고 푸시
3. 기본 폴더 구조 잡기 (components, store, lib/supabase, types, hooks, utils)
4. Supabase 스키마 SQL 파일 생성 (supabase/migrations/)
5. .env.example 생성 (위 문서의 환경변수 템플릿)
6. README에 Phase 1~3 로드맵 요약
7. 완료되면 다음 단계 상의
```

---

## 12. 진행 상황 추적

iMac Claude가 이 문서 기반으로 작업하면서, 주요 결정·변경사항이 생기면 이 문서를 업데이트하도록 요청하세요. 나중에 Windows 쪽에서 참조하거나, 다른 날 재개할 때 히스토리가 됩니다.

---

**작성일**: 2026-04-18
**작성자**: Windows PC Claude Code 세션 (phone-quote 프로젝트 기반 회고)
**대상**: iMac Claude Code 세션 (phone-quote-v2 신규 프로젝트)
