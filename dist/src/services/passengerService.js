"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PassengerService = void 0;
const database_1 = require("../config/database");
const ResponseHandler_1 = require("../utils/responses/ResponseHandler");
const buildWhereCondition_1 = require("../utils/buildWhereCondition");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const generateRandomPassword_1 = require("../utils/generateRandomPassword");
const email_1 = require("../utils/email");
class PassengerService {
    constructor() {
        this.db = database_1.DatabaseService.getInstance().getPrisma();
    }
    async list(params) {
        let total = 0;
        const where = (0, buildWhereCondition_1.buildWhereCondition)(params, ["name"]);
        total = await this.db.passenger.count({ where });
        const passengers = await this.db.passenger.findMany({
            where,
            take: params.limit,
            skip: (params.page - 1) * params.limit,
            orderBy: { created_at: "desc" },
            include: { company: { select: { id: true, name: true } } },
        });
        return {
            data: passengers,
            pagination: {
                total,
                page: params.page,
                limit: params.limit,
                total_pages: Math.ceil(total / params.limit),
            },
        };
    }
    async getById(id) {
        const passenger = await this.db.passenger.findUnique({
            where: { id },
            include: { company: true },
        });
        if (!passenger)
            throw ResponseHandler_1.ResponseHandler.notFound("No passenger found against this id: " + id);
        return passenger;
    }
    async create(data) {
        if (!data.email) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Email is required");
        }
        if (!data.name || !data.phoneNo || !data.officeAddress || !data.companyId) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Missing required passenger fields");
        }
        if (!data.homeAddress ||
            data.homeLat === undefined ||
            data.homeLong === undefined ||
            data.officeLat === undefined ||
            data.officeLong === undefined) {
            throw ResponseHandler_1.ResponseHandler.badRequest("homeAddress, homeLat, homeLong, officeLat and officeLong are required");
        }
        const name = data.name;
        const phoneNo = data.phoneNo;
        const homeAddress = data.homeAddress;
        const homeLat = data.homeLat;
        const homeLong = data.homeLong;
        const officeAddress = data.officeAddress;
        const officeLat = data.officeLat;
        const officeLong = data.officeLong;
        const companyId = data.companyId;
        const email = data.email.trim().toLowerCase();
        const existingUser = await this.db.user.findUnique({ where: { email } });
        if (existingUser) {
            throw ResponseHandler_1.ResponseHandler.duplicateResource("User", "email");
        }
        const plainPassword = (0, generateRandomPassword_1.generateRandomNumericPassword)(6, 8);
        const hashedPassword = await bcryptjs_1.default.hash(plainPassword, 10);
        const company = await this.db.company.findUnique({
            where: { id: Number(companyId) },
        });
        if (!company)
            throw ResponseHandler_1.ResponseHandler.badRequest("No company found against this id: " + companyId);
        const passenger = await this.db.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    role_id: 3,
                },
            });
            return tx.passenger.create({
                data: {
                    user_id: createdUser.id,
                    name: name.trim(),
                    phone_no: phoneNo.trim(),
                    home_address: homeAddress.trim(),
                    home_lat: Number(homeLat),
                    home_long: Number(homeLong),
                    office_address: officeAddress.trim(),
                    office_lat: Number(officeLat),
                    office_long: Number(officeLong),
                    company_id: Number(companyId),
                    pick_up_time: data.pickUpTime?.trim(),
                    drop_off_time: data.dropOffTime?.trim(),
                },
                include: { company: { select: { id: true, name: true } } },
            });
        });
        await (0, email_1.sendCredentialEmail)(email, "passenger", plainPassword);
        return {
            email,
            name: passenger.name,
            phoneNo: passenger.phone_no,
            homeAddress: passenger.home_address ?? undefined,
            homeLat: passenger.home_lat ?? undefined,
            homeLong: passenger.home_long ?? undefined,
            officeAddress: passenger.office_address,
            officeLat: passenger.office_lat ?? undefined,
            officeLong: passenger.office_long ?? undefined,
            companyId: passenger.company_id,
            pickUpTime: passenger.pick_up_time ?? undefined,
            dropOffTime: passenger.drop_off_time ?? undefined,
        };
    }
    async update(id, data) {
        await this.getById(id);
        const passenger = await this.db.passenger.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name.trim() }),
                ...(data.phoneNo !== undefined && { phone_no: data.phoneNo.trim() }),
                ...(data.homeAddress !== undefined && {
                    home_address: data.homeAddress.trim(),
                }),
                ...(data.homeLat !== undefined && { home_lat: Number(data.homeLat) }),
                ...(data.homeLong !== undefined && {
                    home_long: Number(data.homeLong),
                }),
                ...(data.officeAddress !== undefined && {
                    office_address: data.officeAddress.trim(),
                }),
                ...(data.officeLat !== undefined && {
                    office_lat: Number(data.officeLat),
                }),
                ...(data.officeLong !== undefined && {
                    office_long: Number(data.officeLong),
                }),
                ...(data.companyId !== undefined && { company_id: data.companyId }),
                ...(data.pickUpTime !== undefined && {
                    pick_up_time: data.pickUpTime.trim(),
                }),
                ...(data.dropOffTime !== undefined && {
                    drop_off_time: data.dropOffTime.trim(),
                }),
            },
        });
        return {
            name: passenger.name,
            phoneNo: passenger.phone_no,
            homeAddress: passenger.home_address ?? undefined,
            homeLat: passenger.home_lat ?? undefined,
            homeLong: passenger.home_long ?? undefined,
            officeAddress: passenger.office_address,
            officeLat: passenger.office_lat ?? undefined,
            officeLong: passenger.office_long ?? undefined,
            companyId: passenger.company_id,
            pickUpTime: passenger.pick_up_time ?? undefined,
            dropOffTime: passenger.drop_off_time ?? undefined,
        };
    }
    async delete(id) {
        await this.getById(id);
        await this.db.passenger.delete({ where: { id } });
    }
}
exports.PassengerService = PassengerService;
