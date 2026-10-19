# HARU 데이터 모델 (ERD)

PostgreSQL 16, 마이그레이션 `backend/alembic/versions/0001`~`0003`. 시각은 모두 `timestamptz`(UTC 저장, 규칙은 Asia/Seoul).

```mermaid
erDiagram
    users ||--o{ reservations : "예약한다 (BLOCK·워크인은 NULL)"
    rooms ||--|| room_settings : "운영 규칙 1:1"
    rooms ||--o{ room_photos : "사진"
    rooms ||--o{ reservations : "점유"
    reservations ||--o| payments : "결제 (BLOCK은 없음)"

    users {
        int id PK
        varchar email UK "소문자만"
        varchar password_hash "argon2"
        varchar name
        varchar phone
        varchar role "USER | ADMIN"
        timestamptz created_at
    }
    rooms {
        int id PK
        varchar name
        text description
        int capacity ">= 1"
        varchar bed
        int size_m2 ">= 1"
        jsonb amenities "list[str]"
    }
    room_settings {
        int id PK
        int room_id FK,UK
        int dayuse_weekday_price "> 0"
        int dayuse_weekend_price "> 0"
        int stay_weekday_price "> 0"
        int stay_weekend_price "> 0"
        int dayuse_first_start_hour "0-23"
        int dayuse_last_start_hour ">= first"
        int dayuse_hours "1-12"
        int stay_check_in_hour "0-23"
        int stay_check_out_hour "out*60+buffer <= in*60"
        int stay_max_nights "1-30"
        int cleaning_buffer_minutes "0-240"
        int guest_cancel_deadline_hours "0-168"
        timestamptz updated_at
    }
    room_photos {
        int id PK
        int room_id FK
        varchar url
        int sort_order
    }
    reservations {
        int id PK
        varchar code UK "HR-MMDD-NNNN, BLOCK은 NULL"
        int room_id FK
        int user_id FK "nullable"
        varchar type "DAYUSE | STAY | BLOCK"
        varchar status "CONFIRMED | CANCELLED"
        timestamptz start_at
        timestamptz end_at
        timestamptz blocked_until "end_at + 청소 버퍼 (스냅샷)"
        int nights "STAY만"
        varchar guest_name
        varchar guest_phone
        varchar block_reason "BLOCK만"
        int total_price ">= 0"
        timestamptz cancel_deadline_at "손님 취소 마감 (스냅샷)"
        timestamptz created_at
        timestamptz cancelled_at
        varchar cancelled_by "GUEST | ADMIN"
    }
    payments {
        int id PK
        int reservation_id FK,UK
        varchar provider "MOCK"
        int amount ">= 0"
        varchar status "PAID | REFUNDED"
        timestamptz paid_at
        timestamptz refunded_at "REFUNDED일 때만"
    }
```

## 설계 원칙

- **하나의 점유 테이블:** 대실, 숙박, 차단 일정이 모두 `reservations`에 들어가요.
  - 겹침은 `reservations_no_overlap` 하나가 막아요. `EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, blocked_until, '[)') WITH &&) WHERE status = 'CONFIRMED'`
  - 같은 GiST 인덱스가 예약 가능 여부 조회(`busy_query`)에도 쓰여요. 쿼리를 같은 `tstzrange … &&` 식으로 썼기 때문이에요.
- **정책 스냅샷:** `blocked_until`(청소 시간)과 `cancel_deadline_at`(취소 마감)은 예약할 때 행에 저장해요. 그래서 어드민이 설정을 바꿔도 기존 예약에는 소급 적용되지 않아요.
- **상태는 최소한만 저장:** `COMPLETED`는 저장하지 않아요. API가 `end_at <= now`로 계산해요.
- **동시성:**
  - 예약과 차단을 쓰기 전에 `rooms` 행을 `FOR UPDATE`로 잠가요. 그래서 겹침 검사 교착(40P01)이 생기지 않아요.
  - 취소할 때는 예약 행을 `FOR UPDATE`로 잠가요. 그래서 환불이 한 번만 일어나요.

## 무결성 제약 (DB가 직접 보장)

| 제약 | 내용 |
|---|---|
| `reservations_kind_shape` | 행은 아래 세 모양 중 하나여야 함 |
| `reservations_cancel_state` | `status = 'CANCELLED'` ⇔ `cancelled_at`과 `cancelled_by`가 둘 다 있음 |
| `reservations_window` | `start_at < end_at <= blocked_until` |
| `reservations_price_nonneg`, `payments_amount_nonneg` | 금액 ≥ 0 |
| `payments_refund_state` | `status = 'REFUNDED'` ⇔ `refunded_at`이 있음 |
| `users_email_lower` | 이메일은 소문자로만 저장(대소문자 무시 유일성) |
| `room_settings_*` | 요금 > 0, 시간 범위, 첫 입실 ≤ 마지막 입실, 체크아웃 + 청소 시간 ≤ 체크인 |
| `rooms_sizes` | 인원과 면적 ≥ 1 |

`reservations_kind_shape`가 허용하는 세 모양이에요.

- **BLOCK:** 사용자 없음, 가격 0, 박수 없음, 사유 필수, 취소 마감 없음, 버퍼 없음(`end_at = blocked_until`)
- **DAYUSE:** 박수 없음, 취소 마감과 손님 이름 필수
- **STAY:** 박수 ≥ 1(NULL 불가), 취소 마감과 손님 이름 필수

## 인덱스와 사용처

벤치마크는 예약 5만 건 기준이에요. 실행 시간은 `EXPLAIN ANALYZE`로 쟀어요.

| 인덱스 | 쓰는 쿼리 | 이전 → 이후 |
|---|---|---|
| `reservations_no_overlap` (GiST, 부분) | 예약 가능 여부, 견적, 예약 생성의 겹침 조회 | 8.3ms → 0.5ms |
| `ix_reservations_user_start (user_id, start_at)` | 내 예약 | 2.2ms → 0.12ms |
| `ix_reservations_start_at` | 어드민 목록(기간), 대시보드 | 4.2ms → 0.04ms |
| `ix_reservations_{code,guest_name,guest_phone}_trgm` (GIN, pg_trgm) | 어드민 검색 `ILIKE '%q%'` | 55ms → 0.12ms |
| `ix_reservations_blocks_upcoming` (부분: BLOCK·CONFIRMED) | 차단 일정 목록 | 4.6ms → 0.006ms |
| `ix_room_photos_room_sort (room_id, sort_order)` | 객실 사진(정렬) | — |
| `payments_reservation_id_key`, `users_email_key`, `reservations_code_key` | 유일성 및 FK 조회 | — |

목록 정렬은 항상 `(start_at, id)`예요. 같은 시각에 시작하는 행이 있어도 페이지가 겹치거나 빠지지 않아요. 검색어의 `%`, `_`는 와일드카드가 아니라 문자 그대로 검색해요.
