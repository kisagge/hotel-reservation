# HARU — 호텔방 대실·숙박 예약 사이트 설계

## 목적
- 포트폴리오/학습용 프로젝트. 실제 결제나 실제 운영은 하지 않는다.
- 핵심 가치는 "예약 도메인을 제대로 모델링했다"는 것을 보여주는 것이다.

## 범위
- 객실은 1개(스탠다드 더블 · 701호).
- 손님용 예약 사이트(모바일 우선)와 관리자 페이지(데스크톱)를 만든다.
- 스택: Next.js(App Router) 프론트엔드, FastAPI 백엔드, PostgreSQL.
- 디자인(승인됨): https://www.figma.com/design/8rIYX31Lxdsoy8eHinf4ub
  - 페이지 3개: Design System / Guest · Mobile / Admin · Desktop.

## 목표 / 비목표 / 실패 조건
- **목표**
  - 대실·숙박 예약이 끝까지 동작한다: 조회 → 선택 → 모의 결제 → 내 예약 → 취소.
  - 중복 예약이 DB 레벨에서 불가능하다.
  - 어드민에서 예약, 요금, 운영 시간, 차단 일정, 객실 정보를 관리할 수 있다.
  - 테스트와 README를 갖춘다.
- **비목표**
  - 여러 객실·여러 지점
  - 실제 PG 결제
  - 리뷰, 쿠폰·포인트
  - 다국어
  - 배포 자동화
- **실패 조건** (동작은 해도 실패로 본다)
  - 대실과 숙박 시간이 겹쳐서 예약된다.
  - 시간대(KST) 처리가 꼬인다.
  - 어드민 API가 일반 유저에게 열려 있다.

## 예약 규칙
| 항목 | 대실 | 숙박 |
|---|---|---|
| 시작 | 10:00~20:00 사이 정시 | 체크인 15:00 |
| 종료 | 시작 + 4시간 | 체크아웃 익일 11:00 |
| 단위 | 시작 시각 선택 | 1~7박 |
| 요금 | 평일 35,000 / 토·일 45,000 | 박마다 평일 79,000 / 금·토 밤 89,000 |

### 시간 구간 모델
- 모든 예약은 `[start_at, end_at)`로 저장한다.
- `blocked_until = end_at + cleaning_buffer(기본 60분)`을 함께 저장한다.
- 버퍼는 **끝에만** 붙는다. 양쪽에 붙이면 예약 사이 간격이 2배가 되기 때문이다.
- 겹침은 `tstzrange(start_at, blocked_until, '[)')`로 판정한다. 예시:
  - 숙박이 11:00에 체크아웃하면 12:00부터 대실을 받을 수 있다.
  - 대실이 10–14시이면 15:00부터 숙박 체크인이 가능하다.

### DB 제약
- 다음 제약으로 겹침을 막는다:
  `EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, blocked_until, '[)') WITH &&) WHERE (status = 'CONFIRMED')`
- `btree_gist` 확장을 사용한다.
- 동시에 요청이 와도 DB가 하나만 통과시킨다.

### 차단 일정
- 차단 일정은 `reservations.type = 'BLOCK'` 행으로 저장한다.
  - `user_id`는 NULL, 가격은 0, `blocked_until = end_at`(버퍼 없음).
- 같은 제약이 예약과 차단 사이의 겹침도 막는다.

### 상태
- 저장하는 상태는 `CONFIRMED`와 `CANCELLED` 두 가지다.
- `display_status`는 API가 계산한다. `CONFIRMED`이면서 `end_at <= now`이면 `COMPLETED`다.

### 결제
- 모의 결제다. 예약 생성 요청 1번에 예약 행과 `payments(PAID)`를 함께 만든다.
- 취소하면 결제가 `REFUNDED`가 된다.
- `PaymentProvider` 인터페이스를 둬서 나중에 Toss 테스트 모드로 바꿔 끼울 수 있게 한다.

### 취소
- 손님은 `now <= start_at - 24h`일 때 취소할 수 있다(경계값 포함).
- 어드민은 시작 전이면 언제든 취소할 수 있다.

### 시간대
- DB는 `timestamptz`를 쓴다.
- 날짜·시각 규칙과 "오늘" 판정은 서버 TZ와 상관없이 `Asia/Seoul` 기준이다.
- API 응답은 `+09:00` 오프셋으로 내보낸다.

### 설정
- 모든 수치는 `room_settings` 단일 행에 저장하고, 어드민에서 수정한다.
- 수정한 값은 이후의 새 예약에만 적용된다. 이미 저장된 예약의 `blocked_until`은 바뀌지 않는다.

## 사용자와 화면
- **인증**
  - 이메일·비밀번호로 가입하고 로그인한다.
  - JWT를 httpOnly 쿠키 `haru_session`에 담는다(24시간).
  - 역할은 `USER`/`ADMIN`이고, 예약하려면 로그인해야 한다.
- **손님 화면**: 홈, 예약(대실 탭 / 숙박 탭), 예약 확인·결제, 내 예약, 로그인.
- **어드민 화면**
  - 대시보드: KPI, 오늘의 객실 타임라인, 다가오는 예약.
  - 예약 관리: 필터, 목록, 상세 패널, 취소.
  - 요금·운영 설정: 요금, 시간, 청소 시간, 취소 마감, 차단 일정, 규칙 미리보기.
  - 객실 정보: 정보 수정, 사진 업로드.

## 기술 구성
- **backend**
  - FastAPI, SQLAlchemy 2.0(sync) + psycopg 3, Alembic, Pydantic v2.
  - 패키지와 Python 버전은 uv로 관리한다(Python 3.13).
  - 레이어: `domain/`(순수 규칙), `services/`(DB), `api/`(HTTP).
  - 모든 라우트는 `/api` 아래에 둔다.
- **frontend**
  - Next.js, TypeScript, Tailwind, TanStack Query.
  - `/api/*` 요청은 rewrites로 백엔드에 프록시한다.
  - 타입은 OpenAPI 스펙에서 생성한다.
  - 폰트: Noto Sans KR(UI), Gowun Batang(브랜드·헤드라인).
- **docker-compose**: PostgreSQL 16(호스트 포트 5433).
  - DB: `haru`(앱), `haru_test`(테스트).
- **사진**: 백엔드의 로컬 `uploads/`에 저장하고 `/uploads`로 서빙한다.
