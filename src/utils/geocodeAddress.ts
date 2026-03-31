import { ResponseHandler } from "./responses/ResponseHandler";

export interface LatLng {
	lat: number;
	lng: number;
}

interface GeocodeResponse {
	status: string;
	error_message?: string;
	results?: Array<{
		geometry?: { location?: { lat: number; lng: number } };
	}>;
}

/**
 * Geocode a free-text address using Google Geocoding API.
 * Used to set driver home_lat/home_long when missing.
 */
export async function geocodeAddressToLatLng(
	address: string,
): Promise<LatLng> {
	const trimmed = address.trim();
	if (!trimmed) {
		throw ResponseHandler.badRequest("Address is empty; cannot geocode");
	}
	const apiKey = process.env.GOOGLE_MAPS_API_KEY;
	if (!apiKey) {
		throw ResponseHandler.badRequest(
			"GOOGLE_MAPS_API_KEY is missing; cannot geocode driver address",
		);
	}

	const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
	url.searchParams.set("address", trimmed);
	url.searchParams.set("key", apiKey);

	const res = await fetch(url.toString());
	if (!res.ok) {
		throw ResponseHandler.badRequest(
			`Google Geocoding request failed with status ${res.status}`,
		);
	}

	const body = (await res.json()) as GeocodeResponse;
	if (body.status !== "OK" || !body.results?.[0]?.geometry?.location) {
		throw ResponseHandler.badRequest(
			body.error_message ||
				`Geocoding failed (${body.status}). Set driver home_lat/home_long manually or fix the address.`,
		);
	}

	const loc = body.results[0].geometry!.location!;
	return { lat: loc.lat, lng: loc.lng };
}
