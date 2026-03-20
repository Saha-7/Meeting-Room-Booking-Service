# Meeting Room Booking Service - Design

## Overview
This service implements the meeting room booking API with strict business rules:

1. Rooms: unique `name` (case-insensitive), `capacity >= 1`
2. Bookings:
   - `startTime < endTime`
   - duration between **15 minutes and 4 hours**
   - working hours **Mon–Fri, 08:00–20:00** (validated in the timezone implied by the provided ISO-8601 timestamps)
   - **no overlapping confirmed bookings** for the same room using **half-open intervals**: `[startTime, endTime)`
3. Idempotent booking creation using header `Idempotency-Key`, persisted across restarts
4. Cancellation allowed only up to **1 hour before** `startTime`
5. Cancelled bookings do **not** block new bookings
6. Utilization report uses partial-overlap math

All business logic is in the `src/services/*` layer (routes only parse inputs and call services).

## Folder Structure
```text
src/
  app.ts
  server.ts
  routes/
    rooms.routes.ts
    bookings.routes.ts
    reports.routes.ts
  middleware/
    errorHandler.ts
    notFoundHandler.ts
  errors/
    AppError.ts
  models/
    booking.ts
    room.ts
    idempotencyKey.ts
  services/
    rooms.service.ts
    bookings.service.ts
    reports.service.ts
  persistence/
    database.ts              (file-backed persistent store)
    room.repo.ts
    booking.repo.ts
    idempotency.repo.ts
  utils/
    time.ts                 (timezone-aware parsing + interval math)
```

## Data Model
The persisted state is represented by three conceptual models:

1. **Room**
   - `id`, `name`, `capacity`, `floor`, `amenities[]`
2. **Booking**
   - `id`, `roomId`, `title`, `organizerEmail`
   - `startTime` / `endTime` stored as UTC ISO strings (`start_time_utc`, `end_time_utc`)
   - `status`: `confirmed | cancelled`
3. **IdempotencyKey**
   - `organizerEmail`, `idempotencyKey`
   - `requestHash` (stable hash of the request body fields)
   - `status`: `in_progress | succeeded`
   - `bookingId` reference when succeeded

Persistence implementation detail:
- In this repo, persistence is file-backed (`meeting-room-booking.json` by default) to avoid native dependencies.
- The `IdempotencyKey` record is written to disk as part of the idempotent booking flow.

## How Overlap is Prevented
Bookings use **half-open intervals** `[start, end)`:
- Two intervals overlap iff:
  - `existing.start < new.end` AND `existing.end > new.start`

Overlap checking is done only against **confirmed** bookings:
- cancelled bookings never participate in overlap checks

Implementation location:
- `src/services/bookings.service.ts` calls `src/persistence/booking.repo.ts` overlap lookup during booking creation.

Edge cases covered:
- Partial overlaps: `start < from < end` etc are treated as overlap by the half-open rule.
- “Touching” endpoints are allowed:
  - booking1 ends at `10:00`, booking2 starts at `10:00` => no overlap.

## How Idempotency is Stored and Enforced
Request header:
- `Idempotency-Key` is required for `POST /bookings`.

Uniqueness:
- Considered unique per `organizerEmail` + `idempotencyKey`.

Persistence:
- An `idempotency_keys` record is inserted (status `in_progress`) and then updated to `succeeded` with `bookingId` once the booking is created.
- The record survives restarts because it is persisted to disk by the persistence layer.

Duplicate requests:
- If an `idempotencyKey` already exists with `status = succeeded`, the service returns the referenced `bookingId`.
- If the same `Idempotency-Key` is used with a different request body (different `requestHash`), the service returns `409`.

In-progress requests:
- This implementation uses a single-process write lock (`withWriteLock`) to serialize the idempotency+booking operation, so concurrent identical requests never create multiple bookings.

## Concurrency Handling (Simple Approach)
For a real database, you would typically use:
- a transaction with appropriate write locking
- and a UNIQUE constraint on `(organizerEmail, Idempotency-Key)` plus retry/atomic checks

In this repository (file-backed store), concurrency is handled by:
- `src/persistence/database.ts`: `withWriteLock()` serializes all write operations.
- Additionally, `withWriteLock()` emulates rollback by snapshotting state and restoring it if an error is thrown mid-operation.

This guarantees:
- no duplicate bookings for the same idempotency key
- overlap checks and booking inserts happen atomically relative to each other

## Cancellation Rules
`POST /bookings/{id}/cancel`:
- If booking is already `cancelled`: return the booking (no-op)
- Otherwise cancellation is allowed only if:
  - `now <= startTime - 1 hour`
- If too late, return `400`

Cancelled bookings:
- Status changes to `cancelled`
- Overlap checks for new bookings exclude `cancelled`

## Utilization Report Calculation
Endpoint:
- `GET /reports/room-utilization?from=...&to=...`

Definitions:
- Business hours in `[from, to)` are computed as the sum of daily windows:
  - Mon–Fri only
  - daily window: `[08:00, 20:00)` in the timezone implied by the timestamps
- Total booked hours in `[from, to)`:
  - sum of confirmed bookings’ overlap durations with the query interval `[from, to)` using half-open overlap math

Formulas:
- `totalBookingHours = sum(overlap(booking, [from,to)))`
- `utilizationPercent = totalBookingHours / totalBusinessHours`

Edge cases:
- No bookings => `totalBookingHours = 0`, utilization `0`
- Partial overlaps are included because overlap uses `[start,end)` rules.
- `totalBusinessHours = 0` => utilization `0` (avoid divide-by-zero).

## Error Handling Strategy
Services throw typed errors from `src/errors/AppError.ts`.
The global `src/middleware/errorHandler.ts` returns consistent JSON:
```json
{ "error": "ValidationError", "message": "..." }
```
Status codes:
- `400` for validation failures and invalid operations
- `409` for overlap and idempotency-key conflicts
- `404` for unknown rooms/bookings

