import { DatabaseService } from "../../config/database";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { emitToDriver } from "../../config/socketService";
import { getDriverLiveLocation } from "../../utils/liveLocationStore";

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

		// Active leg: pickup in progress, or picked up and drop not done yet
		const leg = await db.routeLeg.findFirst({
			where: {
				passenger_id: passenger.id,
				route: {
					status: { in: ["PENDING", "ONGOING"] },
					created_at: { gte: today, lt: tomorrow },
				},
				OR: [
					{ pickup_status: { in: ["PENDING", "ARRIVED"] } },
					{
						pickup_status: "PICKED",
						dropoff_status: { in: ["PENDING", "ARRIVED"] },
					},
				],
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
		const driverLive = getDriverLiveLocation(driver.id);

		const activeDropSegment =
			leg.pickup_status === "PICKED" &&
			(leg.dropoff_status === "PENDING" || leg.dropoff_status === "ARRIVED")
				? await db.routeSegment.findFirst({
						where: {
							route_id: route.id,
							batch_id: leg.batch_id,
							kind: "DROP_TO_HOMES",
							status: "ONGOING",
						},
					})
				: null;

		let state: string;
		if (route.status === "PENDING" && !driver.is_available) {
			state = "WAITING_FOR_DRIVER";
		} else if (route.status === "PENDING" && driver.is_available) {
			state = "DRIVER_AVAILABLE";
		} else if (
			route.status === "ONGOING" &&
			leg.pickup_status === "PENDING"
		) {
			state = "DRIVER_ON_WAY";
		} else if (
			route.status === "ONGOING" &&
			leg.pickup_status === "ARRIVED"
		) {
			state = "DRIVER_ARRIVED";
		} else if (
			leg.pickup_status === "PICKED" &&
			leg.dropoff_status === "PENDING" &&
			activeDropSegment
		) {
			state = "DRIVER_ON_WAY_HOME";
		} else if (leg.pickup_status === "PICKED" && leg.dropoff_status === "PENDING") {
			state = "AT_OFFICE_OR_WAITING_DROP";
		} else if (leg.dropoff_status === "ARRIVED") {
			state = "DRIVER_ARRIVED_HOME";
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
				dropoff_status: leg.dropoff_status,
				dropoff_address: leg.dropoff_address,
				dropoff_lat: leg.dropoff_lat,
				dropoff_long: leg.dropoff_long,
				driver: {
					id: driver.id,
					name: driver.name,
					phone_no: driver.phone_no,
					image_url: driver.driver_image_url,
					is_available: driver.is_available,
					current_lat: driverLive?.lat ?? null,
					current_long: driverLive?.long ?? null,
					location_updated_at: driverLive?.updated_at ?? null,
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
			include: {
				route: {
					include: {
						driver: {
							select: {
								id: true,
								name: true,
								phone_no: true,
								driver_image_url: true,
								is_available: true,
							},
						},
					},
				},
			},
		});
		if (!leg) throw ResponseHandler.notFound("No active trip found");

		const driver = leg.route.driver;
		const driverLive = getDriverLiveLocation(driver.id);
		return {
			driver_id: driver.id,
			lat: driverLive?.lat ?? null,
			long: driverLive?.long ?? null,
			updated_at: driverLive?.updated_at ?? null,
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
				OR: [{ pickup_status: "ARRIVED" }, { dropoff_status: "ARRIVED" }],
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
