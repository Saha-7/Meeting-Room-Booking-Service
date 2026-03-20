import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { createApp } from './app';

function makeDbPath() {
  return path.join(os.tmpdir(), `mrb-${randomUUID()}.json`);
}

function iso(day: string, time: string) {
  return `${day}T${time}+00:00`;
}

describe('Meeting Room Booking Service - core rules', () => {
  const dayMon = '2026-03-16'; // Monday
  const daySun = '2026-03-15'; // Sunday

  let dbPath: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    dbPath = makeDbPath();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    app = createApp({ dbPath });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  async function createRoom() {
    const res = await request(app).post('/rooms').send({
      name: `Room-${randomUUID()}`,
      capacity: 10,
      floor: 1,
      amenities: ['projector']
    });
    expect(res.status).toBe(201);
    return res.body as { id: string };
  }

  async function createBooking(params: {
    roomId: string;
    startTime: string;
    endTime: string;
    idempotencyKey: string;
    title?: string;
    organizerEmail?: string;
  }) {
    const res = await request(app)
      .post('/bookings')
      .set('Idempotency-Key', params.idempotencyKey)
      .send({
        roomId: params.roomId,
        title: params.title ?? 'Team sync',
        organizerEmail: params.organizerEmail ?? 'organizer@example.com',
        startTime: params.startTime,
        endTime: params.endTime
      });
    return res;
  }

  it('prevents overlapping confirmed bookings (half-open intervals)', async () => {
    const room = await createRoom();

    const b1 = await createBooking({
      roomId: room.id,
      idempotencyKey: 'k-b1',
      startTime: iso(dayMon, '09:00:00'),
      endTime: iso(dayMon, '10:00:00')
    });
    expect(b1.status).toBe(201);

    const bOverlap = await createBooking({
      roomId: room.id,
      idempotencyKey: 'k-b2',
      startTime: iso(dayMon, '09:30:00'),
      endTime: iso(dayMon, '10:30:00')
    });
    expect(bOverlap.status).toBe(409);

    const bTouching = await createBooking({
      roomId: room.id,
      idempotencyKey: 'k-b3',
      startTime: iso(dayMon, '10:00:00'),
      endTime: iso(dayMon, '11:00:00')
    });
    expect(bTouching.status).toBe(201);
  });

  it('validates working hours (Mon–Fri, 08:00–20:00 local)', async () => {
    const room = await createRoom();

    const tooEarly = await createBooking({
      roomId: room.id,
      idempotencyKey: 'k-1',
      startTime: iso(dayMon, '07:00:00'),
      endTime: iso(dayMon, '08:00:00')
    });
    expect(tooEarly.status).toBe(400);

    const endsAfter20 = await createBooking({
      roomId: room.id,
      idempotencyKey: 'k-2',
      startTime: iso(dayMon, '19:30:00'),
      endTime: iso(dayMon, '20:15:00')
    });
    expect(endsAfter20.status).toBe(400);

    const weekend = await createBooking({
      roomId: room.id,
      idempotencyKey: 'k-3',
      startTime: iso(daySun, '10:00:00'),
      endTime: iso(daySun, '10:30:00')
    });
    expect(weekend.status).toBe(400);
  });

  it('enforces booking duration (15 min – 4 hours) and start < end', async () => {
    const room = await createRoom();

    const tooShort = await createBooking({
      roomId: room.id,
      idempotencyKey: 'k-d1',
      startTime: iso(dayMon, '09:00:00'),
      endTime: iso(dayMon, '09:14:00')
    });
    expect(tooShort.status).toBe(400);

    const tooLong = await createBooking({
      roomId: room.id,
      idempotencyKey: 'k-d2',
      startTime: iso(dayMon, '09:00:00'),
      endTime: iso(dayMon, '13:01:00')
    });
    expect(tooLong.status).toBe(400);

    const invalidRange = await createBooking({
      roomId: room.id,
      idempotencyKey: 'k-d3',
      startTime: iso(dayMon, '10:00:00'),
      endTime: iso(dayMon, '10:00:00')
    });
    expect(invalidRange.status).toBe(400);
  });

  it('implements idempotency (same Idempotency-Key -> same booking, no duplicates)', async () => {
    const room = await createRoom();

    const payload = {
      roomId: room.id,
      startTime: iso(dayMon, '09:00:00'),
      endTime: iso(dayMon, '10:00:00')
    };

    const [r1, r2] = await Promise.all([
      createBooking({ ...payload, idempotencyKey: 'idem-1' }),
      createBooking({ ...payload, idempotencyKey: 'idem-1' })
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.id).toBe(r2.body.id);

    const list = await request(app).get(`/bookings`).query({ roomId: room.id });
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
  });

  it('allows cancellation only until 1 hour before startTime; cancelled bookings do not block', async () => {
    const dateNowSpy = vi.spyOn(Date, 'now');
    dateNowSpy.mockReturnValue(new Date(`${dayMon}T08:00:00.000Z`).getTime());

    const room = await createRoom();

    const booking = await createBooking({
      roomId: room.id,
      idempotencyKey: 'k-can-1',
      startTime: iso(dayMon, '10:00:00'),
      endTime: iso(dayMon, '11:00:00')
    });
    expect(booking.status).toBe(201);

    const cancel1 = await request(app).post(`/bookings/${booking.body.id}/cancel`);
    expect(cancel1.status).toBe(200);
    expect(cancel1.body.status).toBe('cancelled');

    const cancelNoop = await request(app).post(`/bookings/${booking.body.id}/cancel`);
    expect(cancelNoop.status).toBe(200);
    expect(cancelNoop.body.status).toBe('cancelled');

    // Now create a new overlapping booking; it should succeed because the previous one is cancelled.
    const newBooking = await createBooking({
      roomId: room.id,
      idempotencyKey: 'k-can-2',
      startTime: iso(dayMon, '10:30:00'),
      endTime: iso(dayMon, '11:30:00')
    });
    expect(newBooking.status).toBe(201);

    // Cancellation after cutoff should fail.
    dateNowSpy.mockReturnValue(new Date(`${dayMon}T11:01:00.000Z`).getTime()); // 1 hour + 1 minute before start (too late)
    const booking2 = await createBooking({
      roomId: room.id,
      idempotencyKey: 'k-can-3',
      startTime: iso(dayMon, '12:00:00'),
      endTime: iso(dayMon, '13:00:00')
    });
    expect(booking2.status).toBe(201);

    const cancelLate = await request(app).post(`/bookings/${booking2.body.id}/cancel`);
    expect(cancelLate.status).toBe(400);

    dateNowSpy.mockRestore();
  });

  it('computes room utilization with partial overlaps', async () => {
    const room1 = await (async () => {
      const res = await request(app).post('/rooms').send({
        name: `Room-1-${randomUUID()}`,
        capacity: 10,
        floor: 1,
        amenities: []
      });
      expect(res.status).toBe(201);
      return res.body as { id: string; name: string };
    })();

    const room2 = await (async () => {
      const res = await request(app).post('/rooms').send({
        name: `Room-2-${randomUUID()}`,
        capacity: 10,
        floor: 2,
        amenities: []
      });
      expect(res.status).toBe(201);
      return res.body as { id: string; name: string };
    })();

    await createBooking({
      roomId: room1.id,
      idempotencyKey: 'u1',
      startTime: iso(dayMon, '09:00:00'),
      endTime: iso(dayMon, '10:00:00')
    });

    await createBooking({
      roomId: room1.id,
      idempotencyKey: 'u2',
      startTime: iso(dayMon, '15:00:00'),
      endTime: iso(dayMon, '16:00:00')
    });

    const report = await request(app).get('/reports/room-utilization').query({
      from: iso(dayMon, '09:30:00'),
      to: iso(dayMon, '10:30:00')
    });
    expect(report.status).toBe(200);

    const items = report.body as Array<{
      roomId: string;
      totalBookingHours: number;
      utilizationPercent: number;
    }>;

    const r1 = items.find((x) => x.roomId === room1.id)!;
    const r2 = items.find((x) => x.roomId === room2.id)!;

    expect(r1.totalBookingHours).toBeCloseTo(0.5, 5); // 09:30-10:00
    expect(r1.utilizationPercent).toBeCloseTo(0.5, 5);
    expect(r2.totalBookingHours).toBe(0);
    expect(r2.utilizationPercent).toBe(0);
  });

  it('returns correct pagination for booking listing', async () => {
    const room = await createRoom();

    const b1 = await createBooking({
      roomId: room.id,
      idempotencyKey: 'p1',
      startTime: iso(dayMon, '09:00:00'),
      endTime: iso(dayMon, '09:30:00')
    });
    expect(b1.status).toBe(201);

    const b2 = await createBooking({
      roomId: room.id,
      idempotencyKey: 'p2',
      startTime: iso(dayMon, '09:30:00'),
      endTime: iso(dayMon, '10:00:00')
    });
    expect(b2.status).toBe(201);

    const b3 = await createBooking({
      roomId: room.id,
      idempotencyKey: 'p3',
      startTime: iso(dayMon, '10:00:00'),
      endTime: iso(dayMon, '10:30:00')
    });
    expect(b3.status).toBe(201);

    const page = await request(app).get('/bookings').query({
      roomId: room.id,
      limit: 1,
      offset: 1
    });
    expect(page.status).toBe(200);
    expect(page.body.total).toBe(3);
    expect(page.body.limit).toBe(1);
    expect(page.body.offset).toBe(1);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.items[0].id).toBe(b2.body.id);
  });
});

