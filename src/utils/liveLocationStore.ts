type DriverLiveLocation = {
  lat: number;
  long: number;
  updated_at: Date;
};

type DriverLiveLocationHistoryOptions = {
  since?: Date;
  limit?: number;
};

const liveLocationMap = new Map<number, DriverLiveLocation>();
const liveLocationHistoryMap = new Map<number, DriverLiveLocation[]>();
const MAX_HISTORY_POINTS_PER_DRIVER = 2000;
const HISTORY_RETENTION_MS = 6 * 60 * 60 * 1000;

function pruneHistory(points: DriverLiveLocation[]): DriverLiveLocation[] {
  const cutoff = Date.now() - HISTORY_RETENTION_MS;
  const recent = points.filter((p) => p.updated_at.getTime() >= cutoff);
  if (recent.length <= MAX_HISTORY_POINTS_PER_DRIVER) return recent;
  return recent.slice(recent.length - MAX_HISTORY_POINTS_PER_DRIVER);
}

export function setDriverLiveLocation(
  driverId: number,
  lat: number,
  long: number,
  updatedAt: Date = new Date(),
): DriverLiveLocation {
  const location = { lat, long, updated_at: updatedAt };
  liveLocationMap.set(driverId, location);
  const history = liveLocationHistoryMap.get(driverId) ?? [];
  history.push(location);
  liveLocationHistoryMap.set(driverId, pruneHistory(history));
  return location;
}

export function getDriverLiveLocation(
  driverId: number,
): DriverLiveLocation | null {
  return liveLocationMap.get(driverId) ?? null;
}

export function getDriverLiveLocationHistory(
  driverId: number,
  options: DriverLiveLocationHistoryOptions = {},
): DriverLiveLocation[] {
  const rows = liveLocationHistoryMap.get(driverId) ?? [];
  const filtered =
    options.since != null
      ? rows.filter((x) => x.updated_at.getTime() >= options.since!.getTime())
      : rows;
  const limit =
    options.limit != null && Number.isFinite(options.limit)
      ? Math.max(1, Math.min(1000, Math.floor(options.limit)))
      : 200;
  return filtered.slice(Math.max(0, filtered.length - limit));
}

