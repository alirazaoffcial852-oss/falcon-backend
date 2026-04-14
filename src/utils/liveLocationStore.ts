type DriverLiveLocation = {
  lat: number;
  long: number;
  updated_at: Date;
};

const liveLocationMap = new Map<number, DriverLiveLocation>();

export function setDriverLiveLocation(
  driverId: number,
  lat: number,
  long: number,
  updatedAt: Date = new Date(),
): DriverLiveLocation {
  const location = { lat, long, updated_at: updatedAt };
  liveLocationMap.set(driverId, location);
  return location;
}

export function getDriverLiveLocation(
  driverId: number,
): DriverLiveLocation | null {
  return liveLocationMap.get(driverId) ?? null;
}

