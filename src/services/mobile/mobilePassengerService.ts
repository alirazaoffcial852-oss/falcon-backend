import { DatabaseService } from "../../config/database";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { emitToDriver } from "../../config/socketService";
import {
	getDriverLiveLocation,
	getDriverLiveLocationHistory,
} from "../../utils/liveLocationStore";
import { notificationService } from "../notificationService";
import {
	getLocalDayRange,
	phaseDriverActiveScheduledDateWhere,
	phaseDriverScheduledDateWhere,
} from "../../utils/routeDayScope";
import { getLocalDateOnly } from "../../utils/recurringPlan";
import {
	getExecutionRouteIdForPlan,
	getPhaseDriverId,
	resolveActivePlanIdFromRoute,
} from "../../utils/phasePassengerHelpers";

const db = DatabaseService.getInstance().getPrisma();

const DRIVER_LOCATION_HEARTBEAT_SECONDS = (() => {
	const n = Number(process.env.DRIVER_LOCATION_HEARTBEAT_SECONDS);
	return Number.isFinite(n) && n >= 2 && n <= 30 ? n : 5;
})();
const DRIVER_LOCATION_STALE_AFTER_SECONDS = (() => {
	const n = Number(process.env.DRIVER_LOCATION_STALE_AFTER_SECONDS);
	return Number.isFinite(n) && n >= 10 && n <= 120 ? n : 20;
})();

type CarDisplay = {
	id: number;
	name: string;
	model: string;
	car_no: string;
	car_color: string;
	car_front_image_url: string;
	/** e.g. "Toyota Corolla – White" */
	display_label: string;
};

function toCarDisplay(car: {
	id: number;
	name: string;
	model: string;
	car_no: string;
	car_color: string;
	car_front_image_url: string;
}): CarDisplay {
	return {
		id: car.id,
		name: car.name,
		model: car.model,
		car_no: car.car_no,
		car_color: car.car_color,
		car_front_image_url: car.car_front_image_url,
		display_label: `${car.model} – ${car.car_color}`.trim(),
	};
}

function resolveTripCarForPassengerUi(params: {
	pickupPd:
		| {
				status: string;
				selected_car: {
					id: number;
					name: string;
					model: string;
					car_no: string;
					car_color: string;
					car_front_image_url: string;
				} | null;
		  }
		| undefined;
	dropPd:
		| {
				status: string;
				selected_car: {
					id: number;
					name: string;
					model: string;
					car_no: string;
					car_color: string;
					car_front_image_url: string;
				} | null;
		  }
		| undefined;
	fallbackCar: {
		id: number;
		name: string;
		model: string;
		car_no: string;
		car_color: string;
		car_front_image_url: string;
	} | null;
}): CarDisplay | null {
	const { pickupPd, dropPd, fallbackCar } = params;
	if (pickupPd?.status === "ONGOING" && pickupPd.selected_car) {
		return toCarDisplay(pickupPd.selected_car);
	}
	if (dropPd?.status === "ONGOING" && dropPd.selected_car) {
		return toCarDisplay(dropPd.selected_car);
	}
	if (fallbackCar) return toCarDisplay(fallbackCar);
	return null;
}

type PassengerProfile = {
	id: number;
	user_id: number | null;
	name: string;
	home_address: string | null;
	home_lat: number | null;
	home_long: number | null;
	office_address: string;
	office_lat: number | null;
	office_long: number | null;
	pick_up_time: string | null;
	drop_off_time: string | null;
	office_pick_up_time: string | null;
};

/** Resolve passenger profile from JWT user id */
async function resolvePassenger(userId: number): Promise<PassengerProfile> {
	const passenger = await db.passenger.findUnique({
		where: { user_id: userId },
		select: {
			id: true,
			user_id: true,
			name: true,
			home_address: true,
			home_lat: true,
			home_long: true,
			office_address: true,
			office_lat: true,
			office_long: true,
			pick_up_time: true,
			drop_off_time: true,
			office_pick_up_time: true,
		},
	});
	if (!passenger) throw ResponseHandler.notFound("Passenger profile not found");
	return passenger;
}

function passengerStillInActiveTrip(
	pickupStatus: string,
	dropStatus: string,
	passengerAck?: string | null,
	hasPickupRow = true,
): boolean {
	// Drop complete → session must use PASSENGER_DROPPED branch, not active-trip UI.
	if (dropStatus === "DROPPED") return false;

	// Declined pickup — keep session (no driver/vehicle) until plan ends.
	if (passengerAck === "NOT_COMING" || pickupStatus === "SKIPPED") {
		return true;
	}

	const dropInProgress = [
		"PENDING",
		"ARRIVED",
		"STILL_WAITING",
		"PICKED",
		"MOVE_TO_NEXT",
	].includes(dropStatus);

	// Pickup phase driver COMPLETED — only DROP row may be in the active query.
	if (!hasPickupRow && dropInProgress) return true;

	return (
		["PENDING", "ARRIVED", "STILL_WAITING"].includes(pickupStatus) ||
		(pickupStatus === "PICKED" && dropInProgress)
	);
}

/** Today’s plan where this passenger’s DROP row is DROPPED — no driver/vehicle (trip over for this passenger). */
async function buildDroppedPassengerSessionForToday(passenger: PassengerProfile): Promise<{
	session: Record<string, unknown>;
} | null> {
	const dropRow = await db.routeDailyPlanPhasePassenger.findFirst({
		where: {
			passenger_id: passenger.id,
			status: "DROPPED",
			route_daily_plan_phase_driver: {
				phase: "DROP",
				scheduled_date: phaseDriverScheduledDateWhere(),
				route_daily_plan: {
					status: { in: ["PENDING", "ONGOING", "COMPLETED"] },
				},
			},
		},
		orderBy: [{ dropped_at: "desc" }, { id: "desc" }],
		include: {
			route_daily_plan_phase_driver: {
				include: {
					route_daily_plan: {
						select: {
							id: true,
							status: true,
							scheduled_date: true,
							execution_route: { select: { id: true } },
							definition_route: { select: { id: true } },
						},
					},
				},
			},
		},
	});

	if (!dropRow) return null;

	const dropPd = dropRow.route_daily_plan_phase_driver;
	const plan = dropPd.route_daily_plan;
	const routeId =
		plan.execution_route?.id ?? plan.definition_route?.id ?? null;
	if (routeId == null) return null;

	const pickupPp = await db.routeDailyPlanPhasePassenger.findFirst({
		where: {
			passenger_id: passenger.id,
			route_daily_plan_phase_driver: {
				route_daily_plan_id: plan.id,
				phase: "PICKUP",
			},
		},
		include: {
			route_daily_plan_phase_driver: {
				select: {
					id: true,
					status: true,
					trip_start_time: true,
				},
			},
		},
	});

	const pickupPd = pickupPp?.route_daily_plan_phase_driver;
	const pickupStatus = pickupPp?.status ?? "PICKED";

	const planId = plan.id;
	const scheduledDate = plan.scheduled_date;
	const tripStartHHMM =
		pickupPd?.trip_start_time?.trim() ||
		passenger.pick_up_time?.trim() ||
		null;

	const droppedAt = dropRow.dropped_at ?? dropRow.updated_at;

	return {
		session: {
			state: "PASSENGER_DROPPED",
			trip_completed: true,
			completion_message:
				"You have been dropped off. Your trip for today is complete.",
			driver_available: false,
			availability_message: null,
			active_trip_phase: "DROP",
			active_phase_driver_id: dropPd.id,
			plan_status: plan.status,
			scheduled_date: scheduledDate.toISOString().slice(0, 10),
			trip_start_time: tripStartHHMM,
			route_id: routeId,
			route_daily_plan_id: planId,
			plan_id: planId,
			pickup_phase_driver_id: pickupPd?.id ?? null,
			drop_phase_driver_id: dropPd.id,
			pickup_phase_passenger_id: pickupPp?.id ?? null,
			drop_phase_passenger_id: dropRow.id,
			pickup_status: pickupStatus,
			passenger_ack: pickupPp?.passenger_ack ?? null,
			driver_arrived_at: pickupPp?.driver_arrived_at ?? null,
			pickup_address: passenger.home_address,
			pickup_lat: passenger.home_lat,
			pickup_long: passenger.home_long,
			pickup_time: passenger.pick_up_time,
			dropoff_status: "DROPPED",
			dropped_at: droppedAt.toISOString(),
			dropoff_address: passenger.home_address,
			dropoff_lat: passenger.home_lat,
			dropoff_long: passenger.home_long,
			driver: null,
			vehicle: null,
		},
	};
}

export const MobilePassengerService = {
	/**
	 * Get current session — driver, plan, and phase-passenger state (same sources as driver session).
	 */
	async getSession(userId: number) {
		const passenger = await resolvePassenger(userId);

		// Same "today" rule as driver session: phase_driver.scheduled_date only.
		// Do not also filter route_daily_plan.scheduled_date — UTC midnight range can
		// exclude valid rows when DB DATE and server TZ disagree.
		const phasePassengerRows = await db.routeDailyPlanPhasePassenger.findMany({
			where: {
				passenger_id: passenger.id,
				route_daily_plan_phase_driver: {
					scheduled_date: phaseDriverActiveScheduledDateWhere(),
					status: { not: "COMPLETED" },
					route_daily_plan: {
						status: { in: ["PENDING", "ONGOING"] },
					},
				},
			},
			include: {
				route_daily_plan_phase_driver: {
					include: {
						selected_car: {
							select: {
								id: true,
								name: true,
								model: true,
								car_no: true,
								car_color: true,
								car_front_image_url: true,
							},
						},
						route_daily_plan: {
							include: {
								execution_route: {
									include: {
										batches: {
											orderBy: { batch_order: "asc" },
											take: 1,
											select: {
												pickup_duration_seconds: true,
												drop_duration_seconds: true,
											},
										},
										driver: {
											include: {
												driver_assign_cars: {
													orderBy: [
														{ is_default: "desc" },
														{ created_at: "asc" },
													],
													take: 1,
													include: { car: true },
												},
											},
										},
									},
								},
								definition_route: {
									include: {
										batches: {
											orderBy: { batch_order: "asc" },
											take: 1,
											select: {
												pickup_duration_seconds: true,
												drop_duration_seconds: true,
											},
										},
										driver: {
											include: {
												driver_assign_cars: {
													orderBy: [
														{ is_default: "desc" },
														{ created_at: "asc" },
													],
													take: 1,
													include: { car: true },
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		});

		type PpRow = (typeof phasePassengerRows)[number];
		const byPlan = new Map<number, { pickup?: PpRow; drop?: PpRow }>();

		for (const row of phasePassengerRows) {
			const pd = row.route_daily_plan_phase_driver;
			const rowDate = getLocalDateOnly(pd.scheduled_date);
			const todayStart = getLocalDayRange().start;
			if (rowDate.getTime() < todayStart.getTime()) {
				if (pd.phase === "PICKUP" && pd.status !== "ONGOING") continue;
				if (pd.phase === "DROP" && pd.status === "COMPLETED") continue;
			}
			const planId = pd.route_daily_plan_id;

			const slot = byPlan.get(planId) ?? {};
			if (pd.phase === "PICKUP") slot.pickup = row;
			else if (pd.phase === "DROP") slot.drop = row;
			byPlan.set(planId, slot);
		}

		const candidates: {
			planId: number;
			plan: NonNullable<
				PpRow["route_daily_plan_phase_driver"]["route_daily_plan"]
			>;
			pickupPp: PpRow | undefined;
			dropPp: PpRow | undefined;
			pickupStatus: string;
			dropStatus: string;
		}[] = [];

		for (const [planId, phases] of byPlan) {
			const plan =
				phases.pickup?.route_daily_plan_phase_driver.route_daily_plan ??
				phases.drop?.route_daily_plan_phase_driver.route_daily_plan;
			if (!(plan?.execution_route ?? plan?.definition_route)) continue;

			const pickupStatus = phases.pickup?.status ?? "PENDING";
			const dropStatus = phases.drop?.status ?? "PENDING";
			const pickupAck = phases.pickup?.passenger_ack ?? null;
			if (
				!passengerStillInActiveTrip(
					pickupStatus,
					dropStatus,
					pickupAck,
					Boolean(phases.pickup),
				)
			) {
				continue;
			}

			candidates.push({
				planId,
				plan,
				pickupPp: phases.pickup,
				dropPp: phases.drop,
				pickupStatus,
				dropStatus,
			});
		}

		if (!candidates.length) {
			const droppedSession = await buildDroppedPassengerSessionForToday(
				passenger,
			);
			if (droppedSession) return droppedSession;
			return {
				session: null,
				message: "No active trip for today.",
			};
		}

		candidates.sort((a, b) => {
			if (a.plan.status === "ONGOING" && b.plan.status !== "ONGOING") return -1;
			if (b.plan.status === "ONGOING" && a.plan.status !== "ONGOING") return 1;
			return b.plan.id - a.plan.id;
		});

		const chosen = candidates[0];
		const route = chosen.plan.execution_route ?? chosen.plan.definition_route;
		if (!route) {
			return { session: null, message: "No active trip today" };
		}
		const planId = chosen.plan.id;
		let pickupPp = chosen.pickupPp;
		const dropPp = chosen.dropPp;
		let pickupStatus = chosen.pickupStatus;
		const dropStatus = chosen.dropStatus;

		// Pickup phase driver may be COMPLETED (excluded from active query) while DROP is ongoing.
		let completedPickupPhasePassengerId: number | null = null;
		let completedPickupAck: PpRow["passenger_ack"] = null;
		let completedPickupDriverArrivedAt: Date | null = null;
		let completedPickupPd: PpRow["route_daily_plan_phase_driver"] | undefined;

		if (!pickupPp && dropPp) {
			const completedPickupPp = await db.routeDailyPlanPhasePassenger.findFirst({
				where: {
					passenger_id: passenger.id,
					route_daily_plan_phase_driver: {
						route_daily_plan_id: planId,
						phase: "PICKUP",
					},
				},
				select: {
					id: true,
					status: true,
					passenger_ack: true,
					driver_arrived_at: true,
					route_daily_plan_phase_driver: {
						select: {
							id: true,
							status: true,
							trip_start_time: true,
							selected_car: {
								select: {
									id: true,
									name: true,
									model: true,
									car_no: true,
									car_color: true,
									car_front_image_url: true,
								},
							},
						},
					},
				},
			});
			if (completedPickupPp) {
				pickupStatus = completedPickupPp.status;
				completedPickupPhasePassengerId = completedPickupPp.id;
				completedPickupAck = completedPickupPp.passenger_ack;
				completedPickupDriverArrivedAt = completedPickupPp.driver_arrived_at;
				completedPickupPd =
					completedPickupPp.route_daily_plan_phase_driver as PpRow["route_daily_plan_phase_driver"];
			}
		}

		const pickupPd =
			pickupPp?.route_daily_plan_phase_driver ?? completedPickupPd;
		const dropPd = dropPp?.route_daily_plan_phase_driver;

		const pickupPhaseDone =
			Boolean(dropPp && !chosen.pickupPp) ||
			pickupStatus === "PICKED" ||
			pickupPd?.status === "COMPLETED";

		const dropLegActive = [
			"PENDING",
			"ARRIVED",
			"STILL_WAITING",
			"PICKED",
			"MOVE_TO_NEXT",
		].includes(dropStatus);

		const isDropPhaseActive = Boolean(dropPp) && dropLegActive && pickupPhaseDone;

		const planStatus = chosen.plan.status;
		const driver = route.driver;
		const fallbackCar = driver.driver_assign_cars[0]?.car ?? null;
		const driverLive = getDriverLiveLocation(driver.id);

		const activeDropSegment =
			pickupPhaseDone &&
			(dropStatus === "PENDING" ||
				dropStatus === "ARRIVED" ||
				dropStatus === "STILL_WAITING")
				? await db.routeSegment.findFirst({
						where: {
							route_id: route.id,
							kind: "DROP_TO_HOMES",
							status: "ONGOING",
						},
					})
				: null;

		const pickupNotComplete = !pickupPhaseDone;
		const passengerDeclinedTrip =
			pickupPp?.passenger_ack === "NOT_COMING" ||
			completedPickupAck === "NOT_COMING" ||
			dropPp?.passenger_ack === "NOT_COMING";

		let state: string;
		if (passengerDeclinedTrip) {
			state = "PASSENGER_NOT_COMING";
		} else if (isDropPhaseActive) {
			if (dropStatus === "ARRIVED" || dropStatus === "STILL_WAITING") {
				state =
					dropStatus === "STILL_WAITING"
						? "STILL_WAITING_AT_DROP"
						: "DRIVER_ARRIVED_HOME";
			} else if (dropStatus === "PICKED") {
				state = "DRIVER_ON_WAY_HOME";
			} else if (
				dropStatus === "PENDING" &&
				planStatus === "ONGOING" &&
				activeDropSegment
			) {
				state = "DRIVER_ON_WAY_HOME";
			} else if (dropStatus === "PENDING" && planStatus === "ONGOING") {
				state = "AT_OFFICE_OR_WAITING_DROP";
			} else if (dropStatus === "MOVE_TO_NEXT") {
				state = "STILL_WAITING_AT_DROP";
			} else {
				state = "AT_OFFICE_OR_WAITING_DROP";
			}
		} else if (!driver.is_available && pickupNotComplete) {
			state = "DRIVER_NOT_AVAILABLE";
		} else if (planStatus === "PENDING" && driver.is_available) {
			state = "DRIVER_AVAILABLE";
		} else if (planStatus === "ONGOING" && pickupStatus === "PENDING") {
			state = "DRIVER_ON_WAY";
		} else if (
			planStatus === "ONGOING" &&
			(pickupStatus === "ARRIVED" || pickupStatus === "STILL_WAITING")
		) {
			state =
				pickupStatus === "STILL_WAITING"
					? "STILL_WAITING_AT_PICKUP"
					: "DRIVER_ARRIVED";
		} else if (
			pickupStatus === "PICKED" &&
			dropStatus === "PENDING" &&
			activeDropSegment
		) {
			state = "DRIVER_ON_WAY_HOME";
		} else if (pickupStatus === "PICKED" && dropStatus === "PENDING") {
			state = "AT_OFFICE_OR_WAITING_DROP";
		} else if (dropStatus === "ARRIVED" || dropStatus === "STILL_WAITING") {
			state =
				dropStatus === "STILL_WAITING"
					? "STILL_WAITING_AT_DROP"
					: "DRIVER_ARRIVED_HOME";
		} else if (pickupStatus === "PICKED") {
			state = "PICKED_UP";
		} else {
			state = "UNKNOWN";
		}

		const vehicle = resolveTripCarForPassengerUi({
			pickupPd: pickupPd
				? {
						status: pickupPd.status,
						selected_car: pickupPd.selected_car,
					}
				: undefined,
			dropPd: dropPd
				? {
						status: dropPd.status,
						selected_car: dropPd.selected_car,
					}
				: undefined,
			fallbackCar,
		});

		/** Evening drop: office until picked at office, then home. Morning pickup done => office first. */
		const dropIsReturnHome =
			pickupPhaseDone &&
			(dropStatus === "PICKED" || dropStatus === "DROPPED");
		const dropoffAddress = dropIsReturnHome
			? passenger.home_address
			: passenger.office_address;
		const dropoffLat = dropIsReturnHome
			? passenger.home_lat
			: passenger.office_lat;
		const dropoffLong = dropIsReturnHome
			? passenger.home_long
			: passenger.office_long;

		const scheduledDate = chosen.plan.scheduled_date;
		const tripStartHHMM = isDropPhaseActive
			? dropPd?.trip_start_time?.trim() ||
				pickupPd?.trip_start_time?.trim() ||
				passenger.pick_up_time?.trim() ||
				null
			: pickupPd?.trip_start_time?.trim() ||
				passenger.pick_up_time?.trim() ||
				null;

		const active_trip_phase: "PICKUP" | "DROP" = isDropPhaseActive
			? "DROP"
			: "PICKUP";
		const active_phase_driver_id =
			active_trip_phase === "PICKUP" ? pickupPd?.id ?? null : dropPd?.id ?? null;

		const pickupStatusForUi = pickupPp
			? pickupStatus
			: pickupPhaseDone
				? "PICKED"
				: pickupStatus;

		const hideDriverAndVehicle =
			passengerDeclinedTrip || (!driver.is_available && pickupNotComplete);
		const availability_message = passengerDeclinedTrip
			? "You are not taking this trip today."
			: hideDriverAndVehicle
				? "Driver is not available now."
				: null;

		return {
			session: {
				state,
				trip_declined: passengerDeclinedTrip,
				driver_available: passengerDeclinedTrip ? false : driver.is_available,
				availability_message,
				active_trip_phase,
				active_phase_driver_id,
				plan_status: planStatus,
				scheduled_date: scheduledDate.toISOString().slice(0, 10),
				trip_start_time: tripStartHHMM,
				route_id: route.id,
				route_daily_plan_id: planId,
				plan_id: planId,
				pickup_phase_driver_id: pickupPd?.id ?? null,
				drop_phase_driver_id: dropPd?.id ?? null,
				pickup_phase_passenger_id:
					pickupPp?.id ?? completedPickupPhasePassengerId,
				drop_phase_passenger_id: dropPp?.id ?? null,
				pickup_status: pickupStatusForUi,
				passenger_ack:
					pickupPp?.passenger_ack ??
					completedPickupAck ??
					dropPp?.passenger_ack ??
					null,
				driver_arrived_at: isDropPhaseActive
					? (dropPp?.dropoff_arrived_at ?? dropPp?.driver_arrived_at ?? null)
					: (pickupPp?.driver_arrived_at ?? completedPickupDriverArrivedAt),
				dropoff_arrived_at: dropPp?.dropoff_arrived_at ?? null,
				pickup_address: passenger.home_address,
				pickup_lat: passenger.home_lat,
				pickup_long: passenger.home_long,
				pickup_time: passenger.pick_up_time,
				dropoff_status: dropStatus,
				dropoff_address: dropoffAddress,
				dropoff_lat: dropoffLat,
				dropoff_long: dropoffLong,
				driver: hideDriverAndVehicle
					? null
					: {
							id: driver.id,
							name: driver.name,
							phone_no: driver.phone_no,
							image_url: driver.driver_image_url,
							is_available: driver.is_available,
							current_lat: driverLive?.lat ?? null,
							current_long: driverLive?.long ?? null,
							location_updated_at: driverLive?.updated_at ?? null,
						},
				vehicle: hideDriverAndVehicle ? null : vehicle,
			},
		};
	},

	/**
	 * Get driver's live location for tracking on map.
	 */
	async getDriverLocation(
		userId: number,
		options?: { since?: string; limit?: number },
	) {
		const passenger = await resolvePassenger(userId);
		const parsedSince =
			options?.since && !Number.isNaN(Date.parse(options.since))
				? new Date(options.since)
				: undefined;
		const parsedLimit =
			options?.limit != null && Number.isFinite(options.limit)
				? options.limit
				: undefined;

		const pp = await db.routeDailyPlanPhasePassenger.findFirst({
			where: {
				passenger_id: passenger.id,
				route_daily_plan_phase_driver: {
					scheduled_date: phaseDriverActiveScheduledDateWhere(),
					status: { not: "COMPLETED" },
					route_daily_plan: {
						status: "ONGOING",
					},
				},
			},
			include: {
				route_daily_plan_phase_driver: {
					include: {
						route_daily_plan: {
							include: {
								execution_route: {
									include: {
										legs: {
											orderBy: { sequence: "asc" },
											select: {
												passenger_id: true,
												sequence: true,
												drop_sequence: true,
												pickup_address: true,
												pickup_lat: true,
												pickup_long: true,
												dropoff_address: true,
												dropoff_lat: true,
												dropoff_long: true,
											},
										},
										driver: {
											select: {
												id: true,
												name: true,
												phone_no: true,
												driver_image_url: true,
												is_available: true,
												home_lat: true,
												home_long: true,
											},
										},
									},
								},
								definition_route: {
									include: {
										legs: {
											orderBy: { sequence: "asc" },
											select: {
												passenger_id: true,
												sequence: true,
												drop_sequence: true,
												pickup_address: true,
												pickup_lat: true,
												pickup_long: true,
												dropoff_address: true,
												dropoff_lat: true,
												dropoff_long: true,
											},
										},
										driver: {
											select: {
												id: true,
												name: true,
												phone_no: true,
												driver_image_url: true,
												is_available: true,
												home_lat: true,
												home_long: true,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		});

		if (!pp) throw ResponseHandler.notFound("No active trip found");
		const plan = pp?.route_daily_plan_phase_driver.route_daily_plan;
		const route = plan?.execution_route ?? plan?.definition_route;
		if (!route) throw ResponseHandler.notFound("No active trip found");

		const phaseDriver = pp.route_daily_plan_phase_driver;
		const pickupPd = await db.routeDailyPlanPhaseDriver.findFirst({
			where: {
				route_daily_plan_id: phaseDriver.route_daily_plan_id,
				phase: "PICKUP",
			},
			select: {
				id: true,
				status: true,
				route_daily_plan_phase_passengers: {
					select: {
						passenger_id: true,
						status: true,
					},
				},
			},
		});
		const dropPd = await db.routeDailyPlanPhaseDriver.findFirst({
			where: {
				route_daily_plan_id: phaseDriver.route_daily_plan_id,
				phase: "DROP",
			},
			select: {
				id: true,
				status: true,
				route_daily_plan_phase_passengers: {
					select: {
						passenger_id: true,
						status: true,
					},
				},
			},
		});

		const driver = route.driver;
		const driverLive = getDriverLiveLocation(driver.id);
		const locationHistory = getDriverLiveLocationHistory(driver.id, {
			since: parsedSince,
			limit: parsedLimit,
		});
		const resolvedLat = driverLive?.lat ?? driver.home_lat ?? null;
		const resolvedLong = driverLive?.long ?? driver.home_long ?? null;
		const locationSource =
			driverLive != null
				? "live"
				: driver.home_lat != null && driver.home_long != null
					? "driver_home_fallback"
					: "unavailable";
		const staleMs = DRIVER_LOCATION_STALE_AFTER_SECONDS * 1000;
		const isLiveStale =
			driverLive != null &&
			Date.now() - driverLive.updated_at.getTime() > staleMs;

		const pickupOpenStatuses = new Set(["PENDING", "ARRIVED", "STILL_WAITING"]);
		const pickupStatusByPassenger = new Map<number, string>(
			(pickupPd?.route_daily_plan_phase_passengers ?? []).map((x) => [
				x.passenger_id,
				x.status,
			]),
		);
		const dropStatusByPassenger = new Map<number, string>(
			(dropPd?.route_daily_plan_phase_passengers ?? []).map((x) => [
				x.passenger_id,
				x.status,
			]),
		);

		const nextPickupLeg =
			route.legs.find((leg) =>
				pickupOpenStatuses.has(
					pickupStatusByPassenger.get(leg.passenger_id) ?? "PENDING",
				),
			) ?? null;
		const nextDropLeg =
			[...route.legs]
				.sort((a, b) => a.drop_sequence - b.drop_sequence)
				.find((leg) =>
					pickupOpenStatuses.has(
						dropStatusByPassenger.get(leg.passenger_id) ?? "PENDING",
					),
				) ?? null;
		const shouldUseDropTarget =
			pickupPd?.status === "COMPLETED" || phaseDriver.phase === "DROP";
		const targetLeg = shouldUseDropTarget ? nextDropLeg : nextPickupLeg;
		const targetMode = shouldUseDropTarget ? "DROP" : "PICKUP";

		console.log(
			`[PASSENGER][GET driver/location] passenger_db_id=${passenger.id} user_id=${passenger.user_id ?? "?"} driver_id=${driver.id} lat=${resolvedLat} long=${resolvedLong} source=${locationSource} history_points=${locationHistory.length}`,
		);
		console.log(
			`[PASSENGER][socket hint] Real-time movement: client must socket.emit("join:passenger", ${passenger.id}) then socket.on("driver:location", …). Driver app emits("driver:location:update", { driverId, lat, long }); server broadcasts event "driver:location" to room passenger:${passenger.id}.`,
		);

		return {
			passenger_id: passenger.id,
			driver_id: driver.id,
			lat: resolvedLat,
			long: resolvedLong,
			updated_at: driverLive?.updated_at ?? null,
			location_source: locationSource,
			/** Socket.IO on same host as API: emit join then subscribe (passenger_id above). */
			realtime: {
				join_emit: "join:passenger",
				listen_event: "driver:location",
			},
			live_tracking: {
				heartbeat_interval_seconds: DRIVER_LOCATION_HEARTBEAT_SECONDS,
				stale_after_seconds: DRIVER_LOCATION_STALE_AFTER_SECONDS,
				is_live_stale: isLiveStale,
			},
			location_history: locationHistory.map((p) => ({
				lat: p.lat,
				long: p.long,
				updated_at: p.updated_at.toISOString(),
			})),
			path_context: {
				phase: targetMode,
				current_target_passenger_id: targetLeg?.passenger_id ?? null,
				current_target_sequence:
					targetMode === "PICKUP"
						? (targetLeg?.sequence ?? null)
						: (targetLeg?.drop_sequence ?? null),
				target_pickup_address:
					targetMode === "PICKUP" ? (targetLeg?.pickup_address ?? null) : null,
				target_pickup_lat:
					targetMode === "PICKUP" ? (targetLeg?.pickup_lat ?? null) : null,
				target_pickup_long:
					targetMode === "PICKUP" ? (targetLeg?.pickup_long ?? null) : null,
				target_dropoff_address:
					targetMode === "DROP" ? (targetLeg?.dropoff_address ?? null) : null,
				target_dropoff_lat:
					targetMode === "DROP" ? (targetLeg?.dropoff_lat ?? null) : null,
				target_dropoff_long:
					targetMode === "DROP" ? (targetLeg?.dropoff_long ?? null) : null,
			},
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

		const planId = await resolveActivePlanIdFromRoute(db, routeId);
		if (!planId) {
			throw ResponseHandler.notFound(
				"Active plan not found for this route — use execution route_id from GET /passenger/session",
			);
		}

		const executionRouteId =
			(await getExecutionRouteIdForPlan(db, planId)) ?? routeId;

		const pickupPdId = await getPhaseDriverId(db, planId, "PICKUP");
		if (!pickupPdId) {
			throw ResponseHandler.notFound("Pickup phase not found for this plan");
		}

		const pickupPp = await db.routeDailyPlanPhasePassenger.findFirst({
			where: {
				route_daily_plan_phase_driver_id: pickupPdId,
				passenger_id: passenger.id,
			},
		});
		if (!pickupPp) {
			throw ResponseHandler.notFound(
				"No pickup phase passenger row found for this route",
			);
		}

		const canAckPickup =
			pickupPp.driver_arrived_at != null &&
			["ARRIVED", "STILL_WAITING"].includes(pickupPp.status);

		const route = await db.route.findFirst({
			where: { id: executionRouteId },
			select: { driver_id: true },
		});
		if (!route) throw ResponseHandler.notFound("Route not found");

		const leg = await db.routeLeg.findFirst({
			where: { passenger_id: passenger.id, route_id: executionRouteId },
			select: { id: true },
		});

		if (canAckPickup) {
			if (pickupPp.passenger_ack != null) {
				throw ResponseHandler.badRequest(
					"Passenger acknowledgement was already recorded",
				);
			}

			await db.routeDailyPlanPhasePassenger.update({
				where: { id: pickupPp.id },
				data: {
					passenger_ack: ack,
					...(ack === "NOT_COMING" ? { status: "SKIPPED" } : {}),
				},
			});

			emitToDriver(route.driver_id, "passenger:ack", {
				legId: leg?.id ?? null,
				phase_passenger_id: pickupPp.id,
				passengerId: passenger.id,
				passengerName: passenger.name,
				ack,
				routeId: executionRouteId,
				phase: "PICKUP",
			});
			void notificationService.sendToDriverId(route.driver_id, {
				title: "Passenger Response",
				body:
					ack === "COMING"
						? `${passenger.name} is coming`
						: `${passenger.name} is not coming`,
				data: {
					routeId: String(executionRouteId),
					legId: leg?.id != null ? String(leg.id) : "",
					phase_passenger_id: String(pickupPp.id),
					ack,
					type: "passenger_ack",
					phase: "PICKUP",
				},
			});

			return {
				phase: "PICKUP" as const,
				phase_passenger_id: pickupPp.id,
				route_id: executionRouteId,
				leg_id: leg?.id ?? null,
				ack,
				message:
					ack === "COMING"
						? "Great! Driver is waiting for you."
						: "Acknowledged. You will be skipped.",
			};
		}

		// DROP phase — same acknowledgement rules as pickup (evening office pick-up leg).
		const dropPdId = await getPhaseDriverId(db, planId, "DROP");
		if (!dropPdId) {
			throw ResponseHandler.badRequest(
				pickupPp.status === "PICKED"
					? "Pickup already completed — acknowledgement is no longer required"
					: "Driver has not arrived at pickup yet — wait for DRIVER_ARRIVED",
			);
		}

		const dropPp = await db.routeDailyPlanPhasePassenger.findFirst({
			where: {
				route_daily_plan_phase_driver_id: dropPdId,
				passenger_id: passenger.id,
			},
		});
		if (!dropPp) {
			throw ResponseHandler.notFound(
				"No drop phase passenger row found for this route",
			);
		}

		const dropArrivedAt =
			dropPp.dropoff_arrived_at ?? dropPp.driver_arrived_at;
		const canAckDrop =
			dropArrivedAt != null &&
			["ARRIVED", "STILL_WAITING"].includes(dropPp.status);
		if (!canAckDrop) {
			throw ResponseHandler.badRequest(
				["PICKED", "DROPPED", "SKIPPED", "MOVE_TO_NEXT"].includes(dropPp.status)
					? "Drop pickup already completed — acknowledgement is no longer required"
					: "Driver has not arrived yet — wait for DRIVER_ARRIVED_HOME",
			);
		}

		if (dropPp.passenger_ack != null) {
			throw ResponseHandler.badRequest(
				"Passenger acknowledgement was already recorded",
			);
		}

		await db.routeDailyPlanPhasePassenger.update({
			where: { id: dropPp.id },
			data: {
				passenger_ack: ack,
				...(ack === "NOT_COMING" ? { status: "SKIPPED" } : {}),
			},
		});

		emitToDriver(route.driver_id, "passenger:ack", {
			legId: leg?.id ?? null,
			phase_passenger_id: dropPp.id,
			passengerId: passenger.id,
			passengerName: passenger.name,
			ack,
			routeId: executionRouteId,
			phase: "DROP",
		});
		void notificationService.sendToDriverId(route.driver_id, {
			title: "Passenger Response",
			body:
				ack === "COMING"
					? `${passenger.name} is coming`
					: `${passenger.name} is not coming`,
			data: {
				routeId: String(executionRouteId),
				legId: leg?.id != null ? String(leg.id) : "",
				phase_passenger_id: String(dropPp.id),
				ack,
				type: "passenger_ack",
				phase: "DROP",
			},
		});

		return {
			phase: "DROP" as const,
			phase_passenger_id: dropPp.id,
			route_id: executionRouteId,
			leg_id: leg?.id ?? null,
			ack,
			message:
				ack === "COMING"
					? "Great! Driver is waiting for you."
					: "Acknowledged. You will be skipped.",
		};
	},
};
