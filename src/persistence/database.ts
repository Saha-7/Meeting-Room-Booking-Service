import fs from 'fs';
import path from 'path';

export type DbState = {
  rooms: Array<{
    id: string;
    name: string;
    capacity: number;
    floor: number;
    amenities: string[];
    created_at: string;
  }>;
  bookings: Array<{
    id: string;
    room_id: string;
    title: string;
    organizer_email: string;
    start_time_utc: string;
    end_time_utc: string;
    status: 'confirmed' | 'cancelled';
    created_at: string;
    cancelled_at: string | null;
  }>;
  idempotency_keys: Array<{
    id: string;
    organizer_email: string;
    idempotency_key: string;
    request_hash: string;
    status: 'in_progress' | 'succeeded';
    booking_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
};

export type FileDb = {
  state: DbState;
  withWriteLock<T>(fn: (state: DbState) => T): T;
  persistNow(): void;
};

function ensureDirExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function createDb(dbPath: string): FileDb {
  ensureDirExists(dbPath);

  const initialState: DbState = fs.existsSync(dbPath)
    ? (JSON.parse(fs.readFileSync(dbPath, 'utf8')) as DbState)
    : { rooms: [], bookings: [], idempotency_keys: [] };

  const db: FileDb = {
    state: initialState,
    persistNow: () => {
      fs.writeFileSync(dbPath, JSON.stringify(db.state, null, 2), 'utf8');
    },
    withWriteLock: <T,>(fn: (state: DbState) => T): T => {
      // File-backed store doesn't have transactions; emulate rollback by snapshotting state.
      const backup: DbState = JSON.parse(JSON.stringify(db.state)) as DbState;
      try {
        const result = fn(db.state);
        // Persist only after successful mutation.
        db.persistNow();
        return result;
      } catch (e) {
        db.state = backup;
        throw e;
      }
    }
  };

  return db;
}

