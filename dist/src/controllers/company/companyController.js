"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyController = void 0;
const companyService_1 = require("../../services/companyService");
const catchAsync_1 = require("../../middleware/catchAsync");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const parseId_1 = require("../../utils/parseId");
const companyService = new companyService_1.CompanyService();
exports.CompanyController = {
    list: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const query = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            search: req.query.search || "",
        };
        const result = await companyService.list(query);
        ResponseHandler_1.ResponseHandler.success(res, result, "Companies list");
    }),
    getById: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const company = await companyService.getById(id);
        ResponseHandler_1.ResponseHandler.success(res, company, `Company against id ${id}`);
    }),
    create: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const company = await companyService.create({
            ...req.body,
        });
        ResponseHandler_1.ResponseHandler.created(res, company, "Company created successfully");
    }),
    update: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const companyId = (0, parseId_1.parseIdParam)(req.params.id);
        if (companyId === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const company = await companyService.update(companyId, { ...req.body });
        ResponseHandler_1.ResponseHandler.success(res, company, "Company updated successfully");
    }),
    delete: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        await companyService.delete(id);
        ResponseHandler_1.ResponseHandler.success(res, null, "Company deleted");
    }),
};
