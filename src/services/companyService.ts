import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type { CompanyListQuery, Company } from "../types/admin/company";
import { buildWhereCondition } from "../utils/buildWhereCondition";

export class CompanyService {
	private db = DatabaseService.getInstance().getPrisma();

	async list(params: CompanyListQuery) {
		let total = 0;
		const where = buildWhereCondition(params, ["name"]);
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

	async getById(id: number) {
		const company = await this.db.company.findUnique({ where: { id } });
		if (!company)
			throw ResponseHandler.notFound("No company found against this id: " + id);
		return company;
	}

	async create(data: Company): Promise<Company> {
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

	async update(id: number, data: Company): Promise<Company> {
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

	async delete(id: number) {
		await this.getById(id);
		await this.db.company.delete({ where: { id } });
	}
}
