import fs from 'fs';
import path from 'path';

function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createDb(dbPath) {
  ensureDirExists(dbPath);

  const initialState = fs.existsSync(dbPath)
    ? JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    : { rooms: [], bookings: [], idempotency_keys: [] };

  const db = {
    state: initialState,
    persistNow() {
      fs.writeFileSync(dbPath, JSON.stringify(db.state, null, 2), 'utf8');
    },
    withWriteLock(fn) {
      const backup = JSON.parse(JSON.stringify(db.state));
      try {
        const result = fn(db.state);
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

export { createDb };
