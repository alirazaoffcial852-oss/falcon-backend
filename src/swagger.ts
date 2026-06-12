// src/swagger.ts – Falcon API – all endpoints

const swaggerDocument = {
	openapi: "3.0.0",
	info: {
		title: "Falcon API",
		version: "1.0.0",
		description:
			"API docs for Falcon backend. Use Authorize to set Bearer token (from POST /f1/auth/login). All admin routes require admin role.",
	},
	servers: [
		{ url: "/", description: "Current host (same origin)" },
	],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
				description: "JWT from POST /f1/auth/login",
			},
		},
		schemas: {
			// Auth
			LoginBody: {
				type: "object",
				required: ["email", "password"],
				properties: {
					email: { type: "string", format: "email" },
					password: { type: "string" },
				},
			},
			LogoutBody: {
				type: "object",
				required: ["deviceToken"],
				properties: {
					deviceToken: {
						type: "string",
						description:
							"FCM/APNS device token to remove from user_device_tokens on logout",
					},
				},
			},
			RegisterBody: {
				type: "object",
				required: ["email", "password", "role"],
				properties: {
					email: { type: "string", format: "email" },
					password: { type: "string", minLength: 6 },
					role: { type: "string", enum: ["admin", "driver", "passenger"] },
					adminSecret: {
						type: "string",
						description:
							"Required when creating admin and DB already has users. Set ADMIN_REGISTER_SECRET in env.",
					},
				},
			},
			// Company
			CreateCompanyBody: {
				type: "object",
				required: ["name", "phoneNo", "address"],
				properties: {
					name: { type: "string" },
					email: { type: "string", format: "email", nullable: true },
					phoneNo: { type: "string" },
					address: { type: "string" },
					lat: { type: "number" },
					long: { type: "number" },
					weekly_off_days: {
						type: "array",
						description:
							"Company weekly off days. Cron skips daily plan generation on these weekdays.",
						items: {
							type: "string",
							enum: [
								"SUNDAY",
								"MONDAY",
								"TUESDAY",
								"WEDNESDAY",
								"THURSDAY",
								"FRIDAY",
								"SATURDAY",
							],
						},
						example: ["SATURDAY", "SUNDAY"],
					},
				},
			},
			UpdateCompanyBody: {
				type: "object",
				minProperties: 1,
				properties: {
					name: { type: "string" },
					email: { type: "string", format: "email", nullable: true },
					phoneNo: { type: "string" },
					address: { type: "string" },
					lat: { type: "number" },
					long: { type: "number" },
					weekly_off_days: {
						type: "array",
						description:
							"Replace weekly off days. Send [] to clear all weekly offs.",
						items: {
							type: "string",
							enum: [
								"SUNDAY",
								"MONDAY",
								"TUESDAY",
								"WEDNESDAY",
								"THURSDAY",
								"FRIDAY",
								"SATURDAY",
							],
						},
						example: ["FRIDAY"],
					},
				},
			},
			// Driver (image fields can be URLs or multipart in real usage)
			CreateDriverBody: {
				type: "object",
				required: [
					"email",
					"password",
					"confirmPassword",
					"name",
					"address",
					"emergency_phone_no",
				],
				properties: {
					email: { type: "string", format: "email" },
					password: { type: "string", minLength: 6 },
					confirmPassword: { type: "string", minLength: 6 },
					name: { type: "string" },
					phone_no: { type: "string", nullable: true },
					address: { type: "string" },
					home_lat: {
						type: "number",
						nullable: true,
						description:
							"Optional; if omitted, geocoded from address when first route is created",
					},
					home_long: { type: "number", nullable: true },
					emergency_phone_no: { type: "string" },
					driver_image_url: { type: "string", nullable: true },
					rate_per_km: { type: "number", nullable: true },
					driver_cnic_front_url: { type: "string", nullable: true },
					driver_cnic_back_url: { type: "string", nullable: true },
					driver_license_front_url: { type: "string", nullable: true },
					driver_license_back_url: { type: "string", nullable: true },
					car_id: { type: "integer", minimum: 1 },
					car_ids: {
						type: "array",
						items: { type: "integer", minimum: 1 },
						minItems: 1,
					},
					default_car_id: { type: "integer", minimum: 1, nullable: true },
				},
				oneOf: [{ required: ["car_id"] }, { required: ["car_ids"] }],
			},
			UpdateDriverBody: {
				type: "object",
				minProperties: 1,
				properties: {
					name: { type: "string" },
					phone_no: { type: "string" },
					address: { type: "string" },
					home_lat: { type: "number", nullable: true },
					home_long: { type: "number", nullable: true },
					emergency_phone_no: { type: "string" },
					driver_image_url: { type: "string", nullable: true },
					rate_per_km: { type: "number" },
					driver_cnic_front_url: { type: "string", nullable: true },
					driver_cnic_back_url: { type: "string", nullable: true },
					driver_license_front_url: { type: "string", nullable: true },
					driver_license_back_url: { type: "string", nullable: true },
					car_id: { type: "integer", minimum: 1 },
					car_ids: {
						type: "array",
						items: { type: "integer", minimum: 1 },
						minItems: 1,
					},
					default_car_id: { type: "integer", minimum: 1, nullable: true },
				},
			},
			// Passenger
			CreatePassengerBody: {
				type: "object",
				required: [
					"email",
					"name",
					"phoneNo",
					"homeAddress",
					"homeLat",
					"homeLong",
					"officeAddress",
					"officeLat",
					"officeLong",
					"companyId",
				],
				properties: {
					email: { type: "string", format: "email" },
					name: { type: "string" },
					phoneNo: { type: "string" },
					homeAddress: { type: "string" },
					homeLat: { type: "number" },
					homeLong: { type: "number" },
					officeAddress: { type: "string" },
					officeLat: { type: "number" },
					officeLong: { type: "number" },
					companyId: { type: "integer", minimum: 1 },
					pickUpTime: {
						type: "string",
						nullable: true,
						description: "Optional — computed/synced pickup time (HH:MM)",
					},
					homePickupTime: {
						type: "string",
						nullable: true,
						description: "Optional — preferred home pickup time (HH:MM)",
					},
					dropOffTime: { type: "string", nullable: true },
					officePickUpTime: {
						type: "string",
						nullable: true,
						description: "HH:MM — office pickup (e.g. evening route)",
					},
				},
			},
			UpdatePassengerBody: {
				type: "object",
				minProperties: 1,
				properties: {
					name: { type: "string" },
					phoneNo: { type: "string" },
					homeAddress: { type: "string" },
					homeLat: { type: "number" },
					homeLong: { type: "number" },
					officeAddress: { type: "string" },
					officeLat: { type: "number" },
					officeLong: { type: "number" },
					companyId: { type: "integer", minimum: 1 },
					pickUpTime: {
						type: "string",
						nullable: true,
						description: "Optional — computed/synced pickup time (HH:MM)",
					},
					homePickupTime: {
						type: "string",
						nullable: true,
						description: "Optional — preferred home pickup time (HH:MM)",
					},
					dropOffTime: { type: "string", nullable: true },
					officePickUpTime: {
						type: "string",
						nullable: true,
						description: "HH:MM — office pickup (e.g. evening route)",
					},
				},
			},
			// Car
			CreateCarBody: {
				type: "object",
				required: ["name", "engine_capacity", "model", "car_no", "car_color"],
				properties: {
					name: { type: "string" },
					engine_capacity: { type: "string" },
					model: { type: "string" },
					car_no: { type: "string" },
					car_color: { type: "string" },
					fuel_per_km: { type: "string", nullable: true },
					car_front_image_url: { type: "string", nullable: true },
					car_back_image_url: { type: "string", nullable: true },
					car_front_card_url: { type: "string", nullable: true },
					car_back_card_url: { type: "string", nullable: true },
				},
			},
			UpdateCarBody: {
				type: "object",
				minProperties: 1,
				properties: {
					name: { type: "string" },
					engine_capacity: { type: "string" },
					model: { type: "string" },
					car_no: { type: "string" },
					car_color: { type: "string" },
					fuel_per_km: { type: "string", nullable: true },
					car_front_image_url: { type: "string", nullable: true },
					car_back_image_url: { type: "string", nullable: true },
					car_front_card_url: { type: "string", nullable: true },
					car_back_card_url: { type: "string", nullable: true },
				},
			},
			// Driver configuration (times in HH:mm:ss)
			CreateDriverConfigurationBody: {
				type: "object",
				required: [
					"availability_time",
					"still_waiting_button_appear_in",
					"remaining_start_time",
					"passenger_waiting_time",
					"skip_button_appear_in",
				],
				properties: {
					availability_time: {
						type: "string",
						example: "00:30:00",
						description: "HH:mm:ss",
					},
					still_waiting_button_appear_in: {
						type: "string",
						example: "00:05:00",
						description: "HH:mm:ss",
					},
					remaining_start_time: {
						type: "string",
						example: "00:15:00",
						description: "HH:mm:ss",
					},
					passenger_waiting_time: {
						type: "string",
						example: "00:10:00",
						description: "HH:mm:ss",
					},
					skip_button_appear_in: {
						type: "string",
						example: "00:03:00",
						description: "HH:mm:ss",
					},
				},
			},
			UpdateDriverConfigurationBody: {
				type: "object",
				minProperties: 1,
				properties: {
					availability_time: {
						type: "string",
						example: "00:30:00",
						description: "HH:mm:ss",
					},
					still_waiting_button_appear_in: {
						type: "string",
						example: "00:05:00",
						description: "HH:mm:ss",
					},
					remaining_start_time: {
						type: "string",
						example: "00:15:00",
						description: "HH:mm:ss",
					},
					passenger_waiting_time: {
						type: "string",
						example: "00:10:00",
						description: "HH:mm:ss",
					},
					skip_button_appear_in: {
						type: "string",
						example: "00:03:00",
						description: "HH:mm:ss",
					},
				},
			},
			// Route
			RouteLeg: {
				type: "object",
				required: [
					"passengerId",
					"pickupAddress",
					"pickupLat",
					"pickupLong",
					"dropoffAddress",
					"dropoffLat",
					"dropoffLong",
				],
				properties: {
					passengerId: { type: "integer", minimum: 1 },
					pickupAddress: { type: "string" },
					pickupLat: { type: "number" },
					pickupLong: { type: "number" },
					pickupTime: {
						type: "string",
						example: "08:00",
						description:
							"Optional. If omitted, computed from each passenger drop_off_time (office) and Google pickup durations (24h HH:MM).",
					},
					dropoffAddress: { type: "string" },
					dropoffLat: { type: "number" },
					dropoffLong: { type: "number" },
					dropoffTime: {
						type: "string",
						example: "17:00",
						description:
							"Optional on the leg; office deadline is taken from passenger.drop_off_time when pickup/dropoff times are auto-computed.",
					},
					tollAmount: { type: "number", nullable: true },
				},
			},
			RouteBatchInput: {
				type: "object",
				required: ["legs"],
				properties: {
					legs: {
						type: "array",
						minItems: 1,
						items: { $ref: "#/components/schemas/RouteLeg" },
					},
				},
			},
			CreateRouteBody: {
				type: "object",
				required: [
					"companyId",
					"driverId",
					"officeAddress",
					"officeLat",
					"officeLong",
					"waypointMode",
				],
				description:
					"Provide either batches (one or more pickup loads) or legacy legs (single batch). waypointMode is required ('auto' | 'manual'); you may send waypoint_mode instead of waypointMode.",
				properties: {
					companyId: { type: "integer", minimum: 1 },
					driverId: { type: "integer", minimum: 1 },
					officeAddress: { type: "string" },
					officeLat: { type: "number" },
					officeLong: { type: "number" },
					waypointMode: {
						type: "string",
						enum: ["auto", "manual"],
						description:
							"Required (unless you send waypoint_mode instead). auto: nearest-first pickup + pickup/dropoff times from drop_off_time and directions. manual: pickup order = batches[].legs / legs array; pickup_time = passenger home_pick_up_time after dropoff_time and office_pick_up_time are computed as auto.",
					},
					waypoint_mode: {
						type: "string",
						enum: ["auto", "manual"],
						description:
							"Snake_case alternative to waypointMode — send one of them (required).",
					},
					recurring_plan_start: {
						type: "string",
						example: "2026-04-08",
						description:
							"Optional start date (YYYY-MM-DD) for recurring daily plan creation.",
					},
					recurringPlanStartDate: {
						type: "string",
						example: "2026-04-08",
						description:
							"Backward compatible alias of recurring_plan_start (YYYY-MM-DD).",
					},
					recurringPlanMonths: {
						type: "integer",
						minimum: 0,
						maximum: 36,
						description: "Recurring window in months. 0 disables recurring.",
					},
					batches: {
						type: "array",
						minItems: 1,
						items: { $ref: "#/components/schemas/RouteBatchInput" },
					},
					legs: {
						type: "array",
						minItems: 1,
						items: { $ref: "#/components/schemas/RouteLeg" },
					},
				},
			},
			UpdateRouteBody: {
				type: "object",
				minProperties: 1,
				properties: {
					companyId: { type: "integer", minimum: 1 },
					driverId: { type: "integer", minimum: 1 },
					officeAddress: { type: "string" },
					officeLat: { type: "number" },
					officeLong: { type: "number" },
					waypointMode: {
						type: "string",
						enum: ["auto", "manual"],
						description:
							"When forking route (structural PUT), same semantics as create waypointMode.",
					},
					waypoint_mode: {
						type: "string",
						enum: ["auto", "manual"],
					},
					recurring_plan_start: {
						type: "string",
						example: "2026-04-08",
						description:
							"Optional start date (YYYY-MM-DD) for recurring daily plan creation.",
					},
					recurringPlanStartDate: {
						type: "string",
						example: "2026-04-08",
						description:
							"Backward compatible alias of recurring_plan_start (YYYY-MM-DD).",
					},
					recurringPlanMonths: {
						type: "integer",
						minimum: 0,
						maximum: 36,
						description: "Recurring window in months. 0 disables recurring.",
					},
					batches: {
						type: "array",
						minItems: 1,
						items: { $ref: "#/components/schemas/RouteBatchInput" },
					},
					legs: {
						type: "array",
						minItems: 1,
						items: { $ref: "#/components/schemas/RouteLeg" },
					},
				},
			},
			// Public driver registration (same shape as POST /f1/drivers for drivers)
			DriverSelfRegisterBody: {
				type: "object",
				required: [
					"email",
					"password",
					"confirmPassword",
					"name",
					"address",
					"emergency_phone_no",
				],
				description:
					"Requires car_id or car_ids (min 1). phone_no may be empty. Creates PENDING driver until admin approves.",
				properties: {
					email: { type: "string", format: "email" },
					password: { type: "string", minLength: 6 },
					confirmPassword: { type: "string", minLength: 6 },
					name: { type: "string" },
					phone_no: { type: "string", nullable: true },
					address: { type: "string" },
					home_lat: { type: "number", nullable: true },
					home_long: { type: "number", nullable: true },
					emergency_phone_no: { type: "string" },
					driver_image_url: { type: "string", nullable: true },
					rate_per_km: { type: "number", nullable: true },
					driver_cnic_front_url: { type: "string", nullable: true },
					driver_cnic_back_url: { type: "string", nullable: true },
					driver_license_front_url: { type: "string", nullable: true },
					driver_license_back_url: { type: "string", nullable: true },
					car_id: { type: "integer", minimum: 1 },
					car_ids: {
						type: "array",
						items: { type: "integer", minimum: 1 },
						minItems: 1,
					},
					default_car_id: { type: "integer", minimum: 1 },
				},
				oneOf: [{ required: ["car_id"] }, { required: ["car_ids"] }],
			},
			ApproveDriverCreateRequestBody: {
				type: "object",
				required: ["password", "confirmPassword"],
				properties: {
					password: { type: "string", minLength: 6 },
					confirmPassword: { type: "string", minLength: 6 },
				},
			},
			CreateFuelPriceBody: {
				type: "object",
				required: ["price_per_liter"],
				properties: {
					price_per_liter: {
						type: "number",
						minimum: 0,
						exclusiveMinimum: true,
						description: "Global fuel price per liter",
					},
					effective_from: {
						type: "string",
						format: "date-time",
						description: "Optional ISO datetime when this price becomes effective",
					},
				},
			},
			UpdateFuelPriceBody: {
				type: "object",
				minProperties: 1,
				properties: {
					price_per_liter: {
						type: "number",
						minimum: 0,
						exclusiveMinimum: true,
					},
					effective_from: {
						type: "string",
						format: "date-time",
					},
				},
			},
			PayrollSettleBody: {
				type: "object",
				required: ["from", "to", "components"],
				properties: {
					from: { type: "string", example: "2026-04-01" },
					to: { type: "string", example: "2026-04-30" },
					driver_id: {
						type: "integer",
						minimum: 1,
						description: "Omit to settle all drivers in range",
					},
					components: {
						type: "array",
						items: { type: "string", enum: ["SALARY", "FUEL"] },
						minItems: 1,
					},
				},
			},
			MobileDriverLocationBody: {
				type: "object",
				required: ["lat", "long"],
				properties: {
					lat: { type: "number" },
					long: { type: "number" },
				},
			},
			StartTripBody: {
				type: "object",
				description:
					"Optional car for this trip; defaults to driver's default assigned car.",
				properties: {
					car_id: { type: "integer", minimum: 1 },
					carId: { type: "integer", minimum: 1 },
				},
			},
			LegActionBody: {
				type: "object",
				required: ["action"],
				properties: {
					action: {
						type: "string",
						enum: ["PICKED", "STILL_WAITING", "MOVE_TO_NEXT", "DROPPED"],
						description:
							"PICKUP segment: PICKED | STILL_WAITING | MOVE_TO_NEXT. DROP segment: DROPPED (preferred) or PICKED to record drop with dropped_at.",
					},
					dropped_at: {
						type: "string",
						format: "date-time",
						nullable: true,
						description:
							"Optional ISO 8601 when action is DROPPED (or PICKED on DROP); default server time.",
					},
				},
			},
			PassengerDropBody: {
				type: "object",
				description:
					"Optional dropped_at (ISO 8601). Omit to use server time when recording drop on route_daily_plan_phase_passengers.",
				properties: {
					dropped_at: {
						type: "string",
						format: "date-time",
						nullable: true,
					},
				},
			},
			RouteIssueReportBody: {
				type: "object",
				required: ["image_url"],
				properties: {
					image_url: { type: "string", format: "uri" },
					note: { type: "string", nullable: true },
				},
			},
			PassengerAckBody: {
				type: "object",
				required: ["ack"],
				properties: {
					ack: { type: "string", enum: ["COMING", "NOT_COMING"] },
				},
			},
		},
	},
	paths: {
		// ----- Auth -----
		"/f1/auth/register": {
			post: {
				tags: ["Auth"],
				summary: "Register",
				description:
					"Create a new user (admin, driver, or passenger). First user can be admin without adminSecret. After that, creating admin requires adminSecret matching ADMIN_REGISTER_SECRET.",
				security: [],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/RegisterBody" },
						},
					},
				},
				responses: {
					"200": { description: "User created" },
					"400": { description: "Username taken or invalid role" },
					"403": { description: "Admin registration requires adminSecret" },
				},
			},
		},
		"/f1/auth/login": {
			post: {
				tags: ["Auth"],
				summary: "Login",
				description:
					"Login with email/password. Use returned token as Bearer token for protected routes.",
				security: [],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/LoginBody" },
						},
					},
				},
				responses: {
					"200": { description: "Success, returns JWT token" },
					"401": { description: "Invalid credentials" },
				},
			},
		},
		"/f1/auth/logout": {
			post: {
				tags: ["Auth"],
				summary: "Logout and remove current device token",
				description:
					"Requires Bearer token. Deletes the provided device token from user_device_tokens for this user.",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/LogoutBody" },
						},
					},
				},
				responses: {
					"200": { description: "Logout successful and token removed" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/auth/forgot-password/request-otp": {
			post: {
				tags: ["Auth"],
				summary: "Request forgot password OTP",
				description:
					"Request a forgot password OTP to be sent to the email address.",
				security: [],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/ForgotPasswordRequestBody",
							},
						},
					},
				},
				responses: {
					"200": { description: "OTP sent to email successfully" },
					"400": { description: "Email not found" },
				},
			},
		},
		"/f1/auth/forgot-password/verify-otp": {
			post: {
				tags: ["Auth"],
				summary: "Verify forgot password OTP",
				description:
					"Verify the forgot password OTP sent to the email address.",
				security: [],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ForgotPasswordVerifyBody" },
						},
					},
				},
				responses: {
					"200": { description: "OTP verified successfully" },
					"400": { description: "Invalid or expired OTP" },
				},
			},
		},
		"/f1/auth/forgot-password/reset-password": {
			post: {
				tags: ["Auth"],
				summary: "Reset forgot password",
				description: "Reset the forgot password for the email address.",
				security: [],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ForgotPasswordResetBody" },
						},
					},
				},
				responses: {
					"200": { description: "Password reset successfully" },
					"400": { description: "Invalid request or OTP" },
				},
			},
		},
		"/f1/auth/driver/register": {
			post: {
				tags: ["Auth"],
				summary: "Driver self-registration (pre-login)",
				description:
					"Public endpoint. Creates a PENDING driver and a create-request; admin must approve before login works.",
				security: [],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/DriverSelfRegisterBody",
							},
						},
					},
				},
				responses: {
					"201": { description: "Registration submitted" },
					"400": { description: "Validation error" },
				},
			},
		},
		// ----- Companies -----
		"/f1/companies": {
			get: {
				tags: ["Companies"],
				summary: "List companies",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "page",
						in: "query",
						schema: { type: "integer", default: 1 },
					},
					{
						name: "limit",
						in: "query",
						schema: { type: "integer", default: 20 },
					},
					{ name: "search", in: "query", schema: { type: "string" } },
				],
				responses: {
					"200": { description: "Paginated list of companies" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			post: {
				tags: ["Companies"],
				summary: "Create company",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/CreateCompanyBody" },
						},
					},
				},
				responses: {
					"201": { description: "Company created" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/companies/{id}": {
			get: {
				tags: ["Companies"],
				summary: "Get company by id",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Company details" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			patch: {
				tags: ["Companies"],
				summary: "Update company",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/UpdateCompanyBody" },
						},
					},
				},
				responses: {
					"200": { description: "Company updated" },
					"400": { description: "Validation error" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			delete: {
				tags: ["Companies"],
				summary: "Delete company",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Company deleted" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		// ----- Uploads -----
		"/f1/uploads/image": {
			post: {
				tags: ["Uploads"],
				summary: "Upload image to Cloudinary",
				description:
					"Common image upload endpoint. Sends file to Cloudinary and returns URL + public_id. Use the returned URL in other APIs (driver, car, etc.).",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"multipart/form-data": {
							schema: {
								type: "object",
								required: ["file", "type"],
								properties: {
									file: {
										type: "string",
										format: "binary",
										description: "Image file to upload",
									},
									type: {
										$ref: "#/components/schemas/UploadImageBody/properties/type",
									},
								},
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Image uploaded successfully",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string", example: "success" },
										message: {
											type: "string",
											example: "Image uploaded successfully",
										},
										data: {
											type: "object",
											properties: {
												url: {
													type: "string",
													example:
														"https://res.cloudinary.com/your-cloud/image/upload/v123/driver_image-1.jpg",
												},
												public_id: {
													type: "string",
													example: "falcon_uploads/driver_image-1",
												},
												type: {
													type: "string",
													example: "driver_image",
												},
											},
										},
									},
								},
							},
						},
					},
					"400": { description: "Validation error (missing file or type)" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		// ----- Drivers -----
		"/f1/drivers": {
			get: {
				tags: ["Drivers"],
				summary: "List drivers",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "page",
						in: "query",
						schema: { type: "integer", default: 1 },
					},
					{
						name: "limit",
						in: "query",
						schema: { type: "integer", default: 20 },
					},
					{ name: "search", in: "query", schema: { type: "string" } },
				],
				responses: {
					"200": { description: "Paginated list of drivers" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			post: {
				tags: ["Drivers"],
				summary: "Create driver",
				description:
					"Admin: creates APPROVED driver + user using provided password/confirmPassword. Driver role: submits PENDING registration (use POST /f1/auth/driver/register for pre-login). Use car_ids + default_car_id or legacy car_id.",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/CreateDriverBody" },
						},
					},
				},
				responses: {
					"201": { description: "Driver created" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/drivers/{id}": {
			get: {
				tags: ["Drivers"],
				summary: "Get driver by id",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Driver details" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			put: {
				tags: ["Drivers"],
				summary: "Update driver",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/UpdateDriverBody" },
						},
					},
				},
				responses: {
					"200": { description: "Driver updated" },
					"400": { description: "Validation error" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			delete: {
				tags: ["Drivers"],
				summary: "Delete driver",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Driver deleted" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/drivers/{id}/availability-override": {
			post: {
				tags: ["Drivers"],
				summary: "Grant 10-minute availability button override",
				description:
					"After availability deadline (e.g. 09:50), admin can re-enable Go Available on driver app for duration_minutes (default 10).",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer", description: "Driver id" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["phase_driver_id"],
								properties: {
									phase_driver_id: { type: "integer" },
									duration_minutes: {
										type: "integer",
										default: 10,
										minimum: 1,
										maximum: 120,
									},
								},
							},
						},
					},
				},
				responses: {
					"200": { description: "Override granted" },
					"404": { description: "Phase or driver not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/drivers/still-waiting": {
			get: {
				tags: ["Drivers"],
				summary: "List driver–passenger still-waiting events (after passenger_waiting_time elapsed)",
				description:
					"Rows where still_waiting_phase_notified_at is set. Real-time: driver:still_waiting, driver:waiting_skip_phase, driver:move_next_ready.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "date",
						in: "query",
						schema: { type: "string", example: "2026-05-20" },
						description: "YYYY-MM-DD (default today)",
					},
				],
				responses: {
					"200": { description: "Still waiting rows" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/drivers/availability-missed": {
			get: {
				tags: ["Drivers"],
				summary: "List drivers who missed availability deadline today",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "date",
						in: "query",
						schema: { type: "string", example: "2026-05-20" },
						description: "YYYY-MM-DD (default today)",
					},
				],
				responses: {
					"200": { description: "Missed availability rows" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/drivers/create-requests": {
			get: {
				tags: ["Drivers"],
				summary: "List driver registration create-requests (admin)",
				description: "Pending / approved self-registration requests.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "page",
						in: "query",
						schema: { type: "integer", default: 1 },
					},
					{
						name: "limit",
						in: "query",
						schema: { type: "integer", default: 20 },
					},
					{
						name: "status",
						in: "query",
						required: false,
						schema: { type: "string", enum: ["PENDING", "APPROVED"] },
					},
				],
				responses: {
					"200": { description: "Paginated create-requests" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden — admin only" },
				},
			},
		},
		"/f1/drivers/create-requests/{id}/approve": {
			post: {
				tags: ["Drivers"],
				summary: "Approve a driver create-request (admin)",
				description:
					"Creates user account with provided password/confirmPassword, sets driver APPROVED, links request to user.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
						description: "DriverCreateRequest id",
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/ApproveDriverCreateRequestBody",
							},
						},
					},
				},
				responses: {
					"200": { description: "Request approved" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden — admin only" },
					"404": { description: "Request not found" },
				},
			},
		},
		// ----- Passengers -----
		"/f1/passengers": {
			get: {
				tags: ["Passengers"],
				summary: "List passengers",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "page",
						in: "query",
						schema: { type: "integer", default: 1 },
					},
					{
						name: "limit",
						in: "query",
						schema: { type: "integer", default: 20 },
					},
					{ name: "search", in: "query", schema: { type: "string" } },
					{ name: "companyId", in: "query", schema: { type: "integer" } },
				],
				responses: {
					"200": { description: "Paginated list of passengers" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			post: {
				tags: ["Passengers"],
				summary: "Create passenger",
				description:
					"Creates passenger and linked user account. Email is required; a random 6-8 digit temporary password is sent to that email.",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/CreatePassengerBody" },
						},
					},
				},
				responses: {
					"201": { description: "Passenger created" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/passengers/{id}": {
			get: {
				tags: ["Passengers"],
				summary: "Get passenger by id",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Passenger details" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			patch: {
				tags: ["Passengers"],
				summary: "Update passenger",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/UpdatePassengerBody" },
						},
					},
				},
				responses: {
					"200": { description: "Passenger updated" },
					"400": { description: "Validation error" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			delete: {
				tags: ["Passengers"],
				summary: "Delete passenger",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Passenger deleted" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		// ----- Cars -----
		"/f1/cars": {
			get: {
				tags: ["Cars"],
				summary: "List cars",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "page",
						in: "query",
						schema: { type: "integer", default: 1 },
					},
					{
						name: "limit",
						in: "query",
						schema: { type: "integer", default: 20 },
					},
					{ name: "search", in: "query", schema: { type: "string" } },
				],
				responses: {
					"200": { description: "Paginated list of cars" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			post: {
				tags: ["Cars"],
				summary: "Create car",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/CreateCarBody" },
						},
					},
				},
				responses: {
					"201": { description: "Car created" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/cars/{id}": {
			get: {
				tags: ["Cars"],
				summary: "Get car by id",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Car details" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			put: {
				tags: ["Cars"],
				summary: "Update car",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/UpdateCarBody" },
						},
					},
				},
				responses: {
					"200": { description: "Car updated" },
					"400": { description: "Validation error" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			delete: {
				tags: ["Cars"],
				summary: "Delete car",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Car deleted" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		// ----- Driver configurations -----
		"/f1/driver-configurations": {
			get: {
				tags: ["Driver configurations"],
				summary: "Get driver configuration",
				description: "Returns current driver configuration (single record).",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Driver configuration" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			post: {
				tags: ["Driver configurations"],
				summary: "Create driver configuration",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/CreateDriverConfigurationBody",
							},
						},
					},
				},
				responses: {
					"201": { description: "Driver configuration created" },
					"400": { description: "Validation error (times in HH:mm:ss)" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/driver-configurations/{id}": {
			put: {
				tags: ["Driver configurations"],
				summary: "Update driver configuration",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/UpdateDriverConfigurationBody",
							},
						},
					},
				},
				responses: {
					"200": { description: "Driver configuration updated" },
					"400": { description: "Validation error (times in HH:mm:ss)" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		// ----- Fuel prices (global) -----
		"/f1/fuel-prices/current": {
			get: {
				tags: ["Fuel prices"],
				summary: "Current effective fuel price per liter",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Current price or null if none configured" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/fuel-prices": {
			get: {
				tags: ["Fuel prices"],
				summary: "List fuel price history",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "List of fuel price records" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			post: {
				tags: ["Fuel prices"],
				summary: "Create fuel price record",
				description:
					"Adds a new global price per liter; used for trip fuel snapshots at start.",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/CreateFuelPriceBody" },
						},
					},
				},
				responses: {
					"201": { description: "Fuel price created" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/fuel-prices/{id}": {
			put: {
				tags: ["Fuel prices"],
				summary: "Update a fuel price record by id",
				description:
					"Partial update: send price_per_liter and/or effective_from (at least one field).",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/UpdateFuelPriceBody" },
						},
					},
				},
				responses: {
					"200": { description: "Updated fuel price record" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
					"404": { description: "Record not found" },
				},
			},
			delete: {
				tags: ["Fuel prices"],
				summary: "Delete a fuel price record by id",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Deleted fuel price record" },
					"400": { description: "Invalid id" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
					"404": { description: "Record not found" },
				},
			},
		},
		// ----- Payroll -----
		"/f1/payroll/preview": {
			get: {
				tags: ["Payroll"],
				summary: "Preview unpaid/paid salary and fuel for completed trips",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "from",
						in: "query",
						required: true,
						schema: { type: "string", example: "2026-04-01" },
						description: "YYYY-MM-DD",
					},
					{
						name: "to",
						in: "query",
						required: true,
						schema: { type: "string", example: "2026-04-30" },
						description: "YYYY-MM-DD",
					},
					{
						name: "driverId",
						in: "query",
						required: false,
						schema: { type: "integer", minimum: 1 },
					},
				],
				responses: {
					"200": { description: "Aggregated payroll preview" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/payroll/history": {
			get: {
				tags: ["Payroll"],
				summary:
					"Payment history — grouped salary/fuel events (default: trips in date range; dateFilter=paid_at for payment date)",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "from",
						in: "query",
						required: true,
						schema: { type: "string", example: "2026-06-01" },
						description: "Payment date range start (YYYY-MM-DD)",
					},
					{
						name: "to",
						in: "query",
						required: true,
						schema: { type: "string", example: "2026-06-30" },
						description: "Payment date range end (YYYY-MM-DD)",
					},
					{
						name: "driverId",
						in: "query",
						required: false,
						schema: { type: "integer", minimum: 1 },
					},
					{
						name: "dateFilter",
						in: "query",
						required: false,
						schema: {
							type: "string",
							enum: ["trip", "paid_at"],
							default: "trip",
						},
						description:
							"trip = same as preview (scheduled_date); paid_at = when payment was marked",
					},
				],
				responses: {
					"200": { description: "Grouped salary/fuel payment events" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/payroll/settle": {
			post: {
				tags: ["Payroll"],
				summary: "Mark salary and/or fuel as PAID for trips in range",
				description:
					"Idempotent per component; prevents double payment for the same phase rows.",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/PayrollSettleBody" },
						},
					},
				},
				responses: {
					"200": { description: "Settlement applied" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		// ----- Routes -----
		"/f1/routes/history": {
			get: {
				tags: ["Routes"],
				summary:
					"Daily route history report (default today): plan status, pickup/drop per passenger; pickup.actual_pickup_time from route_legs (scheduled pickup).",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "date",
						in: "query",
						required: false,
						schema: { type: "string", format: "date", example: "2026-05-19" },
						description: "Calendar day (YYYY-MM-DD). Defaults to today.",
					},
					{ name: "companyId", in: "query", schema: { type: "integer" } },
					{ name: "driverId", in: "query", schema: { type: "integer" } },
				],
				responses: {
					"200": { description: "Route history report for the day" },
					"400": { description: "Invalid date" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/routes": {
			get: {
				tags: ["Routes"],
				summary: "List routes",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "page",
						in: "query",
						schema: { type: "integer", default: 1 },
					},
					{
						name: "limit",
						in: "query",
						schema: { type: "integer", default: 20 },
					},
					{ name: "search", in: "query", schema: { type: "string" } },
					{
						name: "status",
						in: "query",
						schema: {
							type: "string",
							enum: ["PENDING", "ONGOING", "COMPLETED", "CANCELLED"],
						},
					},
					{ name: "companyId", in: "query", schema: { type: "integer" } },
					{ name: "driverId", in: "query", schema: { type: "integer" } },
				],
				responses: {
					"200": { description: "Paginated list of routes" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			post: {
				tags: ["Routes"],
				summary: "Create route",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/CreateRouteBody" },
						},
					},
				},
				responses: {
					"201": { description: "Route created" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/routes/{id}": {
			get: {
				tags: ["Routes"],
				summary: "Get route by id",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": {
						description:
							"Route with relations; includes waypointMode (Prisma enum: auto | manual) on the route row.",
					},
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			put: {
				tags: ["Routes"],
				summary:
					"Update route in place (driver, price, recurring only) or fork (office/company/batches/legs)",
				description:
					"Validated body is stripUnknown. Fork when company, office, or non-empty batches/legs change. In-place patch: driver, route_price, recurring, waypointMode (re-runs optimize when mode changes).",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: false,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/UpdateRouteBody" },
						},
					},
				},
				responses: {
					"201": {
						description:
							"New route created; data.previous_route_id is the template id, data.route is the new route",
					},
					"400": { description: "Validation error" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			delete: {
				tags: ["Routes"],
				summary: "Delete route",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Route deleted" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/routes/{id}/optimize": {
			post: {
				tags: ["Routes"],
				summary: "Optimize and cache route directions",
				description:
					"Calls Google Directions API once, stores optimized waypoint order and polyline in DB, and updates leg sequence.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Route optimized and cached" },
					"400": { description: "Invalid route or Google API error" },
					"404": { description: "Route not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/routes/generate-daily/preview": {
			get: {
				tags: ["Routes"],
				summary: "Preview daily generation decisions",
				description:
					"Dry-run for daily route generation. Returns CAN_CREATE / SKIP reasons (duplicate, holiday, leave, etc.).",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "date",
						in: "query",
						required: false,
						schema: { type: "string", example: "2026-04-10" },
						description: "Calendar date in YYYY-MM-DD (defaults to today)",
					},
					{
						name: "plannedOnly",
						in: "query",
						required: false,
						schema: { type: "boolean", example: true },
						description:
							"true = recurring_plan_start <= date templates only (cron mode)",
					},
				],
				responses: {
					"200": { description: "Preview generated successfully" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/schedule/drivers/{driverId}/leaves": {
			get: {
				tags: ["Schedule"],
				summary: "List driver leaves (optional date range)",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "driverId",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
					{
						name: "from",
						in: "query",
						required: false,
						schema: { type: "string", example: "2026-04-10" },
						description: "From date (YYYY-MM-DD)",
					},
					{
						name: "to",
						in: "query",
						required: false,
						schema: { type: "string", example: "2026-04-15" },
						description: "To date (YYYY-MM-DD)",
					},
				],
				responses: {
					"200": { description: "Driver leave days" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			post: {
				tags: ["Schedule"],
				summary: "Add driver leave range (inclusive)",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "driverId",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["from", "to"],
								properties: {
									from: { type: "string", example: "2026-04-10" },
									to: { type: "string", example: "2026-04-15" },
									note: { type: "string", nullable: true, example: "Personal leave" },
								},
							},
						},
					},
				},
				responses: {
					"201": { description: "Driver leave range added" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/schedule/companies/{companyId}/holidays": {
			get: {
				tags: ["Schedule"],
				summary: "List company holidays",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "companyId",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Company holidays" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			post: {
				tags: ["Schedule"],
				summary: "Add company holiday",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "companyId",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["date"],
								properties: {
									date: { type: "string", example: "2026-04-10" },
									name: { type: "string", nullable: true, example: "Public Holiday" },
								},
							},
						},
					},
				},
				responses: {
					"201": { description: "Holiday added" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		"/f1/schedule/company-holidays/{id}": {
			get: {
				tags: ["Schedule"],
				summary: "Get company holiday by id",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Company holiday" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
					"404": { description: "Not found" },
				},
			},
			put: {
				tags: ["Schedule"],
				summary: "Update company holiday",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									date: { type: "string", example: "2026-04-11" },
									name: { type: "string", nullable: true, example: "Shifted Holiday" },
								},
							},
						},
					},
				},
				responses: {
					"200": { description: "Holiday updated" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
					"404": { description: "Not found" },
				},
			},
			delete: {
				tags: ["Schedule"],
				summary: "Remove company holiday by id",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Holiday removed" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
					"404": { description: "Not found" },
				},
			},
		},
		"/f1/schedule/driver-leaves/{id}": {
			delete: {
				tags: ["Schedule"],
				summary: "Remove driver leave by id",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Leave removed" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
		},
		// ----- Mobile driver -----
		"/f1/mobile/driver/available": {
			get: {
				tags: ["Mobile driver"],
				summary: "Get driver availability status (read-only)",
				description:
					"Includes availability_ui for PICKUP and DROP: mark available before trip_start − availability_time. After pickup completes, DROP uses drop trip_start_time (same OPEN/ALREADY_AVAILABLE rules). active_trip set when a phase is ONGOING. status: OPEN | IN_TRIP | DEADLINE_PASSED | ADMIN_OVERRIDE | ALREADY_AVAILABLE | NO_UPCOMING_TRIP.",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": {
						description:
							"driver, config, availability_ui (show_availability_button, must_mark_available_before, trip_schedule with mark_available_until, trip_pickup_starts_at, drop_phase_starts_at, trip_completes_at, etc.)",
					},
					"401": { description: "Unauthorized" },
				},
			},
			post: {
				tags: ["Mobile driver"],
				summary: "Mark driver as available for trips",
				description:
					"Allowed only while availability_ui.can_mark_available is true (before deadline or during admin override).",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Driver is available" },
					"400": { description: "Outside availability window" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/driver/leaves": {
			get: {
				tags: ["Mobile driver"],
				summary: "Get logged-in driver's leave days",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "from",
						in: "query",
						required: false,
						schema: { type: "string", example: "2026-04-10" },
						description: "From date (YYYY-MM-DD)",
					},
					{
						name: "to",
						in: "query",
						required: false,
						schema: { type: "string", example: "2026-04-15" },
						description: "To date (YYYY-MM-DD)",
					},
				],
				responses: {
					"200": { description: "Driver leave days" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"404": { description: "Driver profile not found" },
				},
			},
		},
		"/f1/mobile/driver/stats": {
			get: {
				tags: ["Mobile driver"],
				summary: "Per-day driven km and minutes (completed DROP trips only)",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "from",
						in: "query",
						required: false,
						schema: { type: "string", example: "2026-04-01" },
						description: "YYYY-MM-DD",
					},
					{
						name: "to",
						in: "query",
						required: false,
						schema: { type: "string", example: "2026-04-30" },
						description: "YYYY-MM-DD",
					},
				],
				responses: {
					"200": { description: "Stats by date" },
					"400": { description: "Invalid date range" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/driver/session": {
			get: {
				tags: ["Mobile driver"],
				summary: "Today's phases, segments, passengers for this driver",
				description:
					"Returns PICKUP/DROP phase rows for local today. Each phase_passengers[] item includes queue_position, scheduled_stop_time, travel_from_previous_* (seconds/minutes/label), travel_from (DRIVER|PREVIOUS_PASSENGER|OFFICE), and cumulative_travel_seconds — sorted by visit order.",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Driver session payload" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/driver/cars": {
			get: {
				tags: ["Mobile driver"],
				summary: "Cars assigned to this driver",
				description: "Includes which car is default for auto-selection on trip start.",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "cars array and default_car_id" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/driver/session/{phaseDriverId}/start": {
			post: {
				tags: ["Mobile driver"],
				summary: "Start PICKUP or DROP trip",
				description:
					"phaseDriverId = RouteDailyPlanPhaseDriver.id from GET /session. Response matches GET /session.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "phaseDriverId",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: false,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/StartTripBody" },
						},
					},
				},
				responses: {
					"200": { description: "Same shape as GET /mobile/driver/session" },
					"400": { description: "Validation / business error" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/driver/location": {
			patch: {
				tags: ["Mobile driver"],
				summary: "Update live GPS",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/MobileDriverLocationBody" },
						},
					},
				},
				responses: {
					"200": { description: "Location updated" },
					"400": { description: "Invalid lat/long" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/driver/session/phase-passengers/{phasePassengerId}/arrive": {
			post: {
				tags: ["Mobile driver"],
				summary: "Driver arrived at passenger stop",
				description:
					"Sets driver_arrived_at / dropoff_arrived_at. waiting_schedule: T1=arrived+passenger_waiting_time (still waiting + notify P+A), T2=T1+still_waiting_button_appear_in (skip countdown + notify P+A), T3=T2+skip_button_appear_in (MOVE_TO_NEXT + notify P+A).",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "phasePassengerId",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Arrival recorded" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/driver/session/phase-passengers/{phasePassengerId}/action": {
			post: {
				tags: ["Mobile driver"],
				summary: "Passenger leg action (picked / waiting / skip)",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "phasePassengerId",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/LegActionBody" },
						},
					},
				},
				responses: {
					"200": { description: "Action applied" },
					"400": { description: "Invalid action" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/driver/session/phase-passengers/{phasePassengerId}/drop": {
			post: {
				tags: ["Mobile driver"],
				summary:
					"Drop one passenger (DROP leg) — sets status DROPPED and dropped_at on route_daily_plan_phase_passengers",
				description:
					"phasePassengerId = RouteDailyPlanPhasePassenger.id for the DROP phase row from GET /session. Same behaviour as POST .../action with action=DROPPED (or legacy PICKED) on DROP_TO_HOMES. Optional body.dropped_at (ISO 8601); default is server time.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "phasePassengerId",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: false,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/PassengerDropBody" },
						},
					},
				},
				responses: {
					"200": {
						description:
							"Drop recorded; data.phase_passenger includes dropped_at",
					},
					"400": { description: "Wrong phase/segment or invalid dropped_at" },
					"401": { description: "Unauthorized" },
					"404": { description: "Not found" },
				},
			},
		},
		"/f1/mobile/driver/session/{routeId}/office-checkpoint": {
			post: {
				tags: ["Mobile driver"],
				summary: "Office checkpoint after pickup batch",
				description: "Advances to next pickup segment or drop phase.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "routeId",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Segment advanced" },
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/driver/session/{phaseDriverId}/complete": {
			post: {
				tags: ["Mobile driver"],
				summary: "Complete PICKUP or DROP phase",
				description:
					"phaseDriverId = RouteDailyPlanPhaseDriver.id. DROP completion may complete the daily plan and set driver unavailable.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "phaseDriverId",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Phase / trip completion result" },
					"400": { description: "Passengers or segments incomplete" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/driver/session/{routeId}/issue-report": {
			post: {
				tags: ["Mobile driver"],
				summary: "Report route blockage / protest (image required)",
				description:
					"Requires active ONGOING route and phase. Emits event to admins.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "routeId",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/RouteIssueReportBody" },
						},
					},
				},
				responses: {
					"200": { description: "Issue recorded" },
					"400": { description: "Missing image_url or invalid state" },
					"401": { description: "Unauthorized" },
					"404": { description: "No active route" },
				},
			},
		},
		// ----- Mobile passenger -----
		"/f1/mobile/passenger/session": {
			get: {
				tags: ["Mobile passenger"],
				summary:
					"Passenger trip session (DRIVER_NOT_AVAILABLE hides driver/vehicle; PASSENGER_DROPPED after drop-off)",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": {
						description:
							"session.state PASSENGER_DROPPED when drop is DROPPED (driver/vehicle null); driver/vehicle also null for DRIVER_NOT_AVAILABLE; session null when no trip today",
					},
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/passenger/driver/location": {
			get: {
				tags: ["Mobile passenger"],
				summary:
					"Driver GPS snapshot + history; passenger_id + realtime hints for Socket.IO (join:passenger / driver:location)",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": {
						description:
							"passenger_id, driver_id, lat/long, location_history, realtime.join_emit + listen_event; poll + subscribe socket for live movement",
					},
					"401": { description: "Unauthorized" },
					"404": { description: "No active trip" },
				},
			},
		},
		"/f1/mobile/passenger/session/{routeId}/ack": {
			post: {
				tags: ["Mobile passenger"],
				summary: "Acknowledge driver arrival (coming / not coming)",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "routeId",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/PassengerAckBody" },
						},
					},
				},
				responses: {
					"200": { description: "Ack saved" },
					"400": { description: "ack must be COMING or NOT_COMING" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/notifications/history": {
			get: {
				tags: ["Mobile notifications"],
				summary: "Get notification history",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "page",
						in: "query",
						required: false,
						schema: { type: "integer", default: 1 },
					},
					{
						name: "limit",
						in: "query",
						required: false,
						schema: { type: "integer", default: 20 },
					},
				],
				responses: {
					"200": { description: "Notification history" },
					"401": { description: "Unauthorized" },
				},
			},
		},
		"/f1/mobile/notifications/history/{id}/read": {
			post: {
				tags: ["Mobile notifications"],
				summary: "Mark notification as read",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": { description: "Notification marked as read" },
					"400": { description: "Invalid notification id" },
					"401": { description: "Unauthorized" },
					"404": { description: "Notification not found" },
				},
			},
		},
	},
};

export default swaggerDocument;
