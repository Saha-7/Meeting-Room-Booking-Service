function createRoomRepo(db) {
  return {
    insertRoom(params) {
      db.state.rooms.push({
        id: params.id,
        name: params.name,
        capacity: params.capacity,
        floor: params.floor,
        amenities: params.amenities,
        created_at: new Date().toISOString()
      });
    },

    findById(id) {
      return db.state.rooms.find((r) => r.id === id) ?? null;
    },

    findByNameCaseInsensitive(name) {
      const normalized = name.trim().toLowerCase();
      const row = db.state.rooms.find((r) => r.name.trim().toLowerCase() === normalized);
      return row ? row.id : null;
    },

    listRooms(filters) {
      const { minCapacity, amenity } = filters;
      let rows = [...db.state.rooms];
      if (typeof minCapacity === 'number') {
        rows = rows.filter((r) => r.capacity >= minCapacity);
      }
      if (typeof amenity === 'string') {
        rows = rows.filter((r) => r.amenities.includes(amenity));
      }
      rows.sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name));
      return rows;
    }
  };
}

export { createRoomRepo };
