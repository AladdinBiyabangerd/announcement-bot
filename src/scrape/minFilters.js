export function roomIdsFromMin(minRooms, { maxExact = 4, plusLabel = "5+" } = {}) {
  const start = Number(minRooms);
  if (!Number.isInteger(start) || start < 1) {
    return [];
  }
  const ids = [];
  for (let n = start; n <= maxExact; n += 1) {
    ids.push(String(n));
  }
  ids.push(plusLabel);
  return ids;
}

export function evvRoomIdsFromMin(minRooms) {
  const start = Number(minRooms);
  if (!Number.isInteger(start) || start < 1) {
    return [];
  }
  const ids = [];
  for (let n = Math.min(start, 4); n <= 4; n += 1) {
    ids.push(String(n));
  }
  return ids;
}
