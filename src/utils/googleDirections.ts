import { ResponseHandler } from "./responses/ResponseHandler";

export interface LatLng {
	lat: number;
	lng: number;
}

interface GoogleDirectionsRoute {
	overview_polyline?: { points?: string };
	waypoint_order?: number[];
	legs?: Array<{
		distance?: { value?: number };
		duration?: { value?: number };
		start_address?: string;
		end_address?: string;
	}>;
}

interface GoogleDirectionsResponse {
	status: string;
	error_message?: string;
	routes: GoogleDirectionsRoute[];
}

export async function fetchGoogleDirections(params: {
	origin: LatLng;
	destination: LatLng;
	waypoints: LatLng[];
	optimizeWaypoints?: boolean;
}): Promise<GoogleDirectionsRoute> {
	const apiKey = process.env.GOOGLE_MAPS_API_KEY;
	if (!apiKey) {
		throw ResponseHandler.badRequest(
			"GOOGLE_MAPS_API_KEY is missing in environment",
		);
	}

	const origin = `${params.origin.lat},${params.origin.lng}`;
	const destination = `${params.destination.lat},${params.destination.lng}`;
	const waypointStr = params.waypoints
		.map((w) => `${w.lat},${w.lng}`)
		.join("|");

	const url = new URL(
		"https://maps.googleapis.com/maps/api/directions/json",
	);
	url.searchParams.set("origin", origin);
	url.searchParams.set("destination", destination);
	url.searchParams.set("key", apiKey);
	if (waypointStr.length > 0) {
		const optimize = params.optimizeWaypoints ?? true;
		url.searchParams.set(
			"waypoints",
			optimize ? `optimize:true|${waypointStr}` : waypointStr,
		);
	}

	const res = await fetch(url.toString());
	if (!res.ok) {
		throw ResponseHandler.badRequest(
			`Google Directions request failed with status ${res.status}`,
		);
	}

	const body = (await res.json()) as GoogleDirectionsResponse;
	if (body.status !== "OK" || !body.routes || body.routes.length === 0) {
		throw ResponseHandler.badRequest(
			body.error_message || `Google Directions failed with status ${body.status}`,
		);
	}

	return body.routes[0];
}
