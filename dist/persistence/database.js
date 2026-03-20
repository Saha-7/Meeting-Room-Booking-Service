"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDb = createDb;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function ensureDirExists(filePath) {
    const dir = path_1.default.dirname(filePath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
function createDb(dbPath) {
    ensureDirExists(dbPath);
    const initialState = fs_1.default.existsSync(dbPath)
        ? JSON.parse(fs_1.default.readFileSync(dbPath, 'utf8'))
        : { rooms: [], bookings: [], idempotency_keys: [] };
    const db = {
        state: initialState,
        persistNow: () => {
            fs_1.default.writeFileSync(dbPath, JSON.stringify(db.state, null, 2), 'utf8');
        },
        withWriteLock: (fn) => {
            // File-backed store doesn't have transactions; emulate rollback by snapshotting state.
            const backup = JSON.parse(JSON.stringify(db.state));
            try {
                const result = fn(db.state);
                // Persist only after successful mutation.
                db.persistNow();
                return result;
            }
            catch (e) {
                db.state = backup;
                throw e;
            }
        }
    };
    return db;
}
