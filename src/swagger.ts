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
		{ url: "/", description: "Current (Vercel / same origin)" },
		{ url: "http://192.168.1.22:5001", description: "Server" },
		{ url: "http://localhost:5051", description: "Local" },
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
				required: ["username", "password"],
				properties: {
					username: { type: "string" },
					password: { type: "string" },
				},
			},
			RegisterBody: {
				type: "object",
				required: ["username", "password", "role"],
				properties: {
					username: { type: "string" },
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
				},
			},
			// Driver (image fields can be URLs or multipart in real usage)
			CreateDriverBody: {
				type: "object",
				required: [
					"name",
					"phone_no",
					"address",
					"emergency_phone_no",
					"car_id",
				],
				properties: {
					name: { type: "string" },
					phone_no: { type: "string" },
					address: { type: "string" },
					emergency_phone_no: { type: "string" },
					driver_image_url: { type: "string", nullable: true },
					rate_per_km: { type: "number", nullable: true },
					driver_cnic_front_url: { type: "string", nullable: true },
					driver_cnic_back_url: { type: "string", nullable: true },
					driver_license_front_url: { type: "string", nullable: true },
					driver_license_back_url: { type: "string", nullable: true },
					salary: { type: "string", nullable: true },
					car_id: { type: "integer", minimum: 1 },
				},
			},
			UpdateDriverBody: {
				type: "object",
				minProperties: 1,
				properties: {
					name: { type: "string" },
					phone_no: { type: "string" },
					address: { type: "string" },
					emergency_phone_no: { type: "string" },
					driver_image_url: { type: "string", nullable: true },
					rate_per_km: { type: "number" },
					driver_cnic_front_url: { type: "string", nullable: true },
					driver_cnic_back_url: { type: "string", nullable: true },
					driver_license_front_url: { type: "string", nullable: true },
					driver_license_back_url: { type: "string", nullable: true },
					salary: { type: "string" },
					car_id: { type: "integer", minimum: 1 },
				},
			},
			// Passenger
			CreatePassengerBody: {
				type: "object",
				required: ["name", "phoneNo", "officeAddress", "companyId"],
				properties: {
					name: { type: "string" },
					phoneNo: { type: "string" },
					officeAddress: { type: "string" },
					companyId: { type: "integer", minimum: 1 },
					pickUpTime: { type: "string", nullable: true },
					dropOffTime: { type: "string", nullable: true },
				},
			},
			UpdatePassengerBody: {
				type: "object",
				minProperties: 1,
				properties: {
					name: { type: "string" },
					phoneNo: { type: "string" },
					officeAddress: { type: "string" },
					companyId: { type: "integer", minimum: 1 },
					pickUpTime: { type: "string", nullable: true },
					dropOffTime: { type: "string", nullable: true },
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
					"pickupTime",
					"dropoffAddress",
					"dropoffLat",
					"dropoffLong",
					"dropoffTime",
				],
				properties: {
					passengerId: { type: "integer", minimum: 1 },
					pickupAddress: { type: "string" },
					pickupLat: { type: "number" },
					pickupLong: { type: "number" },
					pickupTime: { type: "string", example: "08:00 am" },
					dropoffAddress: { type: "string" },
					dropoffLat: { type: "number" },
					dropoffLong: { type: "number" },
					dropoffTime: { type: "string", example: "05:00 pm" },
					tollAmount: { type: "number", nullable: true },
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
					"legs",
				],
				properties: {
					companyId: { type: "integer", minimum: 1 },
					driverId: { type: "integer", minimum: 1 },
					officeAddress: { type: "string" },
					officeLat: { type: "number" },
					officeLong: { type: "number" },
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
					legs: {
						type: "array",
						minItems: 1,
						items: { $ref: "#/components/schemas/RouteLeg" },
					},
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
					"Login with username/password. Use returned token as Bearer token for protected routes.",
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
		// ----- Routes -----
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
					"200": { description: "Route details" },
					"404": { description: "Not found" },
					"401": { description: "Unauthorized" },
					"403": { description: "Forbidden" },
				},
			},
			put: {
				tags: ["Routes"],
				summary: "Update route",
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
							schema: { $ref: "#/components/schemas/UpdateRouteBody" },
						},
					},
				},
				responses: {
					"200": { description: "Route updated" },
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
	},
};

export default swaggerDocument;
