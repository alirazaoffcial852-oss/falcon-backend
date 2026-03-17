"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyService = void 0;
const database_1 = require("../config/database");
const ResponseHandler_1 = require("../utils/responses/ResponseHandler");
const buildWhereCondition_1 = require("../utils/buildWhereCondition");
class CompanyService {
    constructor() {
        this.db = database_1.DatabaseService.getInstance().getPrisma();
    }
    async list(params) {
        let total = 0;
        const where = (0, buildWhereCondition_1.buildWhereCondition)(params, ["name"]);
        total = await this.db.company.count({ where });
        const companies = await this.db.company.findMany({
            where,
            take: params.limit,
            skip: (params.page - 1) * params.limit,
            orderBy: { created_at: "desc" },
        });
        return {
            data: companies,
            pagination: {
                total,
                page: params.page,
                limit: params.limit,
                total_pages: Math.ceil(total / params.limit),
            },
        };
    }
    async getById(id) {
        const company = await this.db.company.findUnique({ where: { id } });
        if (!company)
            throw ResponseHandler_1.ResponseHandler.notFound("No company found against this id: " + id);
        return company;
    }
    async create(data) {
        const company = await this.db.company.create({
            data: {
                name: data.name,
                email: data.email ?? null,
                phone_no: data.phoneNo,
                address: data.address,
            },
        });
        return {
            name: company.name,
            email: company.email ?? undefined,
            phoneNo: company.phone_no,
            address: company.address,
        };
    }
    async update(id, data) {
        await this.getById(id);
        const company = await this.db.company.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name.trim() }),
                ...(data.email !== undefined && { email: data.email?.trim() ?? null }),
                ...(data.phoneNo !== undefined && { phoneNo: data.phoneNo.trim() }),
                ...(data.address !== undefined && { address: data.address.trim() }),
            },
        });
        return {
            name: company.name,
            email: company.email ?? undefined,
            phoneNo: company.phone_no,
            address: company.address,
        };
    }
    async delete(id) {
        await this.getById(id);
        await this.db.company.delete({ where: { id } });
    }
}
exports.CompanyService = CompanyService;
