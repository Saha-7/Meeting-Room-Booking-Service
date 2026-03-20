import type { FileDb } from './database';

export type RoomRow = {
  id: string;
  name: string;
  capacity: number;
  floor: number;
  amenities: string[];
  created_at: string;
};

export function createRoomRepo(db: FileDb) {
  return {
    insertRoom: (params: { id: string; name: string; capacity: number; floor: number; amenities: string[] }) => {
      db.state.rooms.push({
        id: params.id,
        name: params.name,
        capacity: params.capacity,
        floor: params.floor,
        amenities: params.amenities,
        created_at: new Date().toISOString()
      });
    },

    findById: (id: string) => {
      return (
        db.state.rooms.find((r) => r.id === id) ?? null
      ) as RoomRow | null;
    },

    findByNameCaseInsensitive: (name: string) => {
      const normalized = name.trim().toLowerCase();
      const row = db.state.rooms.find((r) => r.name.trim().toLowerCase() === normalized);
      return row ? row.id : null;
    },

    listRooms: (filters: { minCapacity?: number; amenity?: string }) => {
      const minCapacity = filters.minCapacity;
      const amenity = filters.amenity;

      let rows = [...db.state.rooms];
      if (typeof minCapacity === 'number') {
        rows = rows.filter((r) => r.capacity >= minCapacity);
      }
      if (typeof amenity === 'string') {
        rows = rows.filter((r) => r.amenities.includes(amenity));
      }

      rows.sort((a, b) => (a.floor - b.floor) || a.name.localeCompare(b.name));
      return rows as RoomRow[];
    }
  };
}

