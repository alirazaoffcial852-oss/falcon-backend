"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverConfigurationService = void 0;
const database_1 = require("../config/database");
const ResponseHandler_1 = require("../utils/responses/ResponseHandler");
class DriverConfigurationService {
    constructor() {
        this.db = database_1.DatabaseService.getInstance().getPrisma();
    }
    async get() {
        const config = await this.db.driverConfiguration.findFirst({
            orderBy: { id: "desc" },
        });
        if (!config)
            throw ResponseHandler_1.ResponseHandler.notFound("Driver configuration not found");
        return config;
    }
    async create(data) {
        const existing = await this.db.driverConfiguration.findFirst();
        if (existing)
            throw ResponseHandler_1.ResponseHandler.badRequest("Driver configuration already exists. Use update.");
        return this.db.driverConfiguration.create({
            data: {
                availability_time: data.availability_time.trim(),
                still_waiting_button_appear_in: data.still_waiting_button_appear_in.trim(),
                remaining_start_time: data.remaining_start_time.trim(),
                passenger_waiting_time: data.passenger_waiting_time.trim(),
                skip_button_appear_in: data.skip_button_appear_in.trim(),
            },
        });
    }
    async update(id, data) {
        await this.db.driverConfiguration.findUniqueOrThrow({ where: { id } });
        return this.db.driverConfiguration.update({
            where: { id },
            data: {
                ...(data.availability_time !== undefined && {
                    availability_time: data.availability_time.trim(),
                }),
                ...(data.still_waiting_button_appear_in !== undefined && {
                    still_waiting_button_appear_in: data.still_waiting_button_appear_in.trim(),
                }),
                ...(data.remaining_start_time !== undefined && {
                    remaining_start_time: data.remaining_start_time.trim(),
                }),
                ...(data.passenger_waiting_time !== undefined && {
                    passenger_waiting_time: data.passenger_waiting_time.trim(),
                }),
                ...(data.skip_button_appear_in !== undefined && {
                    skip_button_appear_in: data.skip_button_appear_in.trim(),
                }),
            },
        });
    }
}
exports.DriverConfigurationService = DriverConfigurationService;
