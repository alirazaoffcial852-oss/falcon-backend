interface SearchParams {
	search?: string;
	fields?: string;
	[key: string]: any;
}

/**
 * Builds a dynamic search query for Prisma
 * @param params Search parameters containing search term and optional fields
 * @param defaultFields Default fields to search if none specified
 * @param enumFields Fields that should use exact match instead of contains
 * @returns Prisma where condition object
 */
export function buildWhereCondition<T extends SearchParams>(
	params: T,
	defaultFields: string[] = ["name"],
	enumFields: string[] = [],
): any {
	const where: any = {};

	// Add any direct filter parameters (excluding enum fields from search)
	Object.entries(params).forEach(([key, value]) => {
		// Skip special search parameters and pagination
		if (["search", "fields", "page", "limit", "sort", "order"].includes(key))
			return;
		if (value !== undefined) {
			// Handle enum fields with exact match
			if (enumFields.includes(key)) {
				where[key] = value;
			} else {
				where[key] = value;
			}
		}
	});

	// Add search conditions if search term provided
	if (params.search) {
		const searchFields = params.fields?.split(",") || defaultFields;

		where.OR = searchFields
			.filter((field) => !enumFields.includes(field)) // Exclude enum fields from text search
			.map((field) => {
				// Handle nested fields (e.g., customer.name)
				if (field.includes(".")) {
					const parts = field.split(".");
					let nestedCondition: any = {
						contains: params.search,
						mode: "insensitive",
					};

					// Build the nested condition from inside out
					for (let i = parts.length - 1; i > 0; i--) {
						nestedCondition = {
							[parts[i]]: nestedCondition,
						};
					}

					return { [parts[0]]: nestedCondition };
				}

				// Handle direct fields
				return {
					[field]: {
						contains: params.search,
						mode: "insensitive",
					},
				};
			});
	}

	return where;
}
