import { DatabaseService } from "../../config/database";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { emitToDriver } from "../../config/socketService";

const db = DatabaseService.getInstance().getPrisma();

/** Resolve passenger profile from JWT user id */
async function resolvePassenger(userId: number) {
	const passenger = await db.passenger.findUnique({ where: { user_id: userId } });
	if (!passenger) throw ResponseHandler.notFound("Passenger profile not found");
	return passenger;
}

export const MobilePassengerService = {
	/**
	 * Get current session — shows driver availability, eta, route leg status.
	 */
	async getSession(userId: number) {
		const passenger = await resolvePassenger(userId);

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		// Find the route leg for today that is not yet completed
		const leg = await db.routeLeg.findFirst({
			where: {
				passenger_id: passenger.id,
				pickup_status: { in: ["PENDING", "ARRIVED", "PICKED"] },
				route: {
					status: { in: ["PENDING", "ONGOING"] },
					created_at: { gte: today, lt: tomorrow },
				},
			},
			include: {
				route: {
					include: {
						driver: {
							include: {
								driver_assign_cars: { include: { car: true }, take: 1 },
							},
						},
					},
				},
			},
			orderBy: { id: "desc" },
		});

		if (!leg) return { session: null, message: "No active trip today" };

		const route = leg.route;
		const driver = route.driver;
		const car = driver.driver_assign_cars[0]?.car ?? null;

		// Determine UI state for passenger
		let state: string;
		if (route.status === "PENDING" && !driver.is_available) {
			state = "WAITING_FOR_DRIVER";
		} else if (route.status === "PENDING" && driver.is_available) {
			state = "DRIVER_AVAILABLE";
		} else if (route.status === "ONGOING" && leg.pickup_status === "PENDING") {
			state = "DRIVER_ON_WAY";
		} else if (route.status === "ONGOING" && leg.pickup_status === "ARRIVED") {
			state = "DRIVER_ARRIVED";
		} else if (leg.pickup_status === "PICKED") {
			state = "PICKED_UP";
		} else {
			state = "UNKNOWN";
		}

		return {
			session: {
				state,
				route_id: route.id,
				leg_id: leg.id,
				pickup_status: leg.pickup_status,
				passenger_ack: leg.passenger_ack,
				driver_arrived_at: leg.driver_arrived_at,
				pickup_address: leg.pickup_address,
				pickup_lat: leg.pickup_lat,
				pickup_long: leg.pickup_long,
				pickup_time: leg.pickup_time,
				driver: {
					id: driver.id,
					name: driver.name,
					phone_no: driver.phone_no,
					image_url: driver.driver_image_url,
					is_available: driver.is_available,
					current_lat: driver.current_lat,
					current_long: driver.current_long,
					location_updated_at: driver.location_updated_at,
				},
				car: car
					? {
							name: car.name,
							car_no: car.car_no,
							car_color: car.car_color,
							car_front_image_url: car.car_front_image_url,
						}
					: null,
			},
		};
	},

	/**
	 * Get driver's live location for tracking on map.
	 */
	async getDriverLocation(userId: number) {
		const passenger = await resolvePassenger(userId);

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		const leg = await db.routeLeg.findFirst({
			where: {
				passenger_id: passenger.id,
				route: {
					status: "ONGOING",
					created_at: { gte: today, lt: tomorrow },
				},
			},
			include: { route: { include: { driver: true } } },
		});
		if (!leg) throw ResponseHandler.notFound("No active trip found");

		const driver = leg.route.driver;
		return {
			driver_id: driver.id,
			lat: driver.current_lat,
			long: driver.current_long,
			updated_at: driver.location_updated_at,
		};
	},

	/**
	 * Passenger acknowledges driver arrival: "OK I'm Coming" or "I'm not Coming"
	 */
	async acknowledgeArrival(
		userId: number,
		routeId: number,
		ack: "COMING" | "NOT_COMING",
	) {
		const passenger = await resolvePassenger(userId);

		const leg = await db.routeLeg.findFirst({
			where: {
				passenger_id: passenger.id,
				route_id: routeId,
				pickup_status: "ARRIVED",
			},
			include: { route: { select: { driver_id: true } } },
		});
		if (!leg) throw ResponseHandler.notFound("No arrived leg found for this route");

		await db.routeLeg.update({
			where: { id: leg.id },
			data: { passenger_ack: ack },
		});

		// Notify the driver of passenger's decision
		emitToDriver(leg.route.driver_id, "passenger:ack", {
			legId: leg.id,
			passengerId: passenger.id,
			passengerName: passenger.name,
			ack,
			routeId,
		});

		return {
			leg_id: leg.id,
			ack,
			message: ack === "COMING" ? "Great! Driver is waiting for you." : "Acknowledged. You will be skipped.",
		};
	},
};
