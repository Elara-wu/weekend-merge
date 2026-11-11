import {
  EstimateRouteInputSchema,
  EstimateRouteOutputSchema,
  type EstimateRouteInput,
  type EstimateRouteOutput,
} from "./contracts";

const EARTH_RADIUS_KM = 6371;
const WALKING_SPEED_KMH = 4.5;
const TRANSIT_SPEED_KMH = 18;
const TRANSIT_BUFFER_MINUTES = 8;
const WALKING_THRESHOLD_KM = 1.2;

function radians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function roundTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function estimateRoute(input: EstimateRouteInput): EstimateRouteOutput {
  const { stops, mode } = EstimateRouteInputSchema.parse(input);
  let totalRawDistanceKm = 0;
  const legs = stops.slice(1).map((stop, index) => {
    const previous = stops[index];
    const rawDistanceKm = distanceKm(previous, stop);
    totalRawDistanceKm += rawDistanceKm;
    const legMode = mode === "mixed"
      ? (rawDistanceKm <= WALKING_THRESHOLD_KM ? "walking" : "transit")
      : mode;
    const durationMinutes = legMode === "walking"
      ? Math.ceil(rawDistanceKm / WALKING_SPEED_KMH * 60)
      : Math.ceil(rawDistanceKm / TRANSIT_SPEED_KMH * 60 + TRANSIT_BUFFER_MINUTES);

    return {
      fromPlaceId: previous.placeId,
      toPlaceId: stop.placeId,
      mode: legMode,
      distanceKm: roundTwo(rawDistanceKm),
      durationMinutes,
    };
  });

  return EstimateRouteOutputSchema.parse({
    legs,
    totalDistanceKm: roundTwo(totalRawDistanceKm),
    totalDurationMinutes: legs.reduce((total, leg) => total + leg.durationMinutes, 0),
    estimated: true,
  });
}
