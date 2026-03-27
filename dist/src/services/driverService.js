"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverService = void 0;
const database_1 = require("../config/database");
const ResponseHandler_1 = require("../utils/responses/ResponseHandler");
const buildWhereCondition_1 = require("../utils/buildWhereCondition");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const generateRandomPassword_1 = require("../utils/generateRandomPassword");
const email_1 = require("../utils/email");
class DriverService {
    constructor() {
        this.db = database_1.DatabaseService.getInstance().getPrisma();
    }
    async list(params) {
        const where = (0, buildWhereCondition_1.buildWhereCondition)(params, [
            "name",
            "address",
            "phone_no",
            "emergency_phone_no",
        ]);
        const total = await this.db.driver.count({ where });
        const drivers = await this.db.driver.findMany({
            where,
            take: params.limit,
            skip: (params.page - 1) * params.limit,
            orderBy: { created_at: "desc" },
            include: {
                driver_assign_cars: {
                    orderBy: { created_at: "desc" },
                    take: 1,
                    include: { car: true },
                },
            },
        });
        const data = drivers.map((driver) => {
            const assignedCar = driver.driver_assign_cars[0];
            return {
                ...driver,
                car_id: assignedCar?.car_id ?? null,
                car_name: assignedCar?.car?.name ?? null,
                car_number: assignedCar?.car?.car_no ?? null,
                driver_assign_cars: undefined,
            };
        });
        return {
            data,
            pagination: {
                total,
                page: params.page,
                limit: params.limit,
                total_pages: Math.ceil(total / params.limit),
            },
        };
    }
    async getById(id) {
        const driver = await this.db.driver.findUnique({
            where: { id },
            include: {
                driver_assign_cars: {
                    orderBy: { created_at: "desc" },
                    take: 1,
                    include: { car: true },
                },
            },
        });
        if (!driver)
            throw ResponseHandler_1.ResponseHandler.notFound("No driver found against this id: " + id);
        const assignedCar = driver.driver_assign_cars[0];
        return {
            ...driver,
            car_id: assignedCar?.car_id ?? null,
            car_name: assignedCar?.car?.name ?? null,
            car_number: assignedCar?.car?.car_no ?? null,
            driver_assign_cars: undefined,
        };
    }
    async create(data) {
        if (!data.email) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Email is required");
        }
        const email = data.email.trim().toLowerCase();
        const existingUser = await this.db.user.findUnique({ where: { email } });
        if (existingUser) {
            throw ResponseHandler_1.ResponseHandler.duplicateResource("User", "email");
        }
        const plainPassword = (0, generateRandomPassword_1.generateRandomNumericPassword)(6, 8);
        const hashedPassword = await bcryptjs_1.default.hash(plainPassword, 10);
        const driver = await this.db.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    role_id: 2,
                },
            });
            const createdDriver = await tx.driver.create({
                data: {
                    user_id: createdUser.id,
                    name: data.name,
                    phone_no: data.phone_no,
                    address: data.address,
                    emergency_phone_no: data.emergency_phone_no,
                    driver_image_url: data.driver_image_url ?? "",
                    rate_per_km: data.rate_per_km !== undefined && data.rate_per_km !== null
                        ? Number(data.rate_per_km)
                        : 0,
                    driver_cnic_front_url: data.driver_cnic_front_url ?? "",
                    driver_cnic_back_url: data.driver_cnic_back_url ?? "",
                    salary: data.salary ?? "",
                    driver_license_front_url: data.driver_license_front_url ?? "",
                    driver_license_back_url: data.driver_license_back_url ?? "",
                },
            });
            if (data.car_id) {
                await tx.driverAssignCar.create({
                    data: {
                        driver_id: createdDriver.id,
                        car_id: Number(data.car_id),
                    },
                });
            }
            return createdDriver;
        });
        await (0, email_1.sendCredentialEmail)(email, "driver", plainPassword);
        return {
            email,
            ...driver,
            car_id: Number(data.car_id),
        };
    }
    async update(id, data) {
        await this.getById(id);
        await this.db.driver.update({
            where: { id },
            data: {
                name: data.name,
                phone_no: data.phone_no,
                address: data.address,
                emergency_phone_no: data.emergency_phone_no,
                driver_image_url: data.driver_image_url ?? "",
                rate_per_km: data.rate_per_km !== undefined && data.rate_per_km !== null
                    ? Number(data.rate_per_km)
                    : 0,
                driver_cnic_front_url: data.driver_cnic_front_url ?? "",
                driver_cnic_back_url: data.driver_cnic_back_url ?? "",
                salary: data.salary ?? "",
                driver_license_front_url: data.driver_license_front_url ?? "",
                driver_license_back_url: data.driver_license_back_url ?? "",
            },
        });
        if (data.car_id !== undefined && data.car_id !== null) {
            const existingForDriver = await this.db.driverAssignCar.findFirst({
                where: { driver_id: id },
                orderBy: { created_at: "desc" },
            });
            if (existingForDriver) {
                await this.db.driverAssignCar.update({
                    where: { id: existingForDriver.id },
                    data: { car_id: Number(data.car_id) },
                });
            }
            else {
                await this.db.driverAssignCar.create({
                    data: { driver_id: id, car_id: Number(data.car_id) },
                });
            }
        }
        return this.getById(id);
    }
    async delete(id) {
        await this.getById(id);
        await this.db.driver.delete({ where: { id } });
    }
}
exports.DriverService = DriverService;
