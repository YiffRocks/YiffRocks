import GenericSearch from "./GenericSearch";
import Config from "../../config";
import Tag from "../../db/Models/Tag";

export interface TagSearchOptions {
	name?: string;
	category?: number;
	post_count?: string;
	locked?: boolean;
}
export default class TagSearch extends GenericSearch {
	protected static searchName(value: string) {
		return this.genericSearch("reason", value);
	}

	protected static searchCategory(value: number) {
		return this.genericSearch("category", value);
	}

	protected static searchPostCount(value: string) {
		return this.searchWithOperator("post_count", value);
	}

	protected static searchLocked(value: boolean) {
		return this.genericSearch("locked", value);
	}

	static override async constructQuery(query: TagSearchOptions, limit?: number, offset?: number): Promise<[query: string, values: Array<unknown>]> {
		const filters: Array<[sql: string, ...values: Array<unknown>] | null> = [];
		const selectExtra: Array<string> = [];
		let order: string | undefined;
		if (query.name) filters.push(this.searchName(query.name));
		if (query.category && !isNaN(query.category)) filters.push(this.searchCategory(query.category));
		if (query.post_count) filters.push(this.searchPostCount(query.post_count));
		if (query.locked)     filters.push(this.searchLocked(query.locked));
		let index = 0;
		const statements = filters.filter(Boolean).map(f => f![0].replace(/\?/g, () => `$${++index}`));
		const values: Array<unknown> = [];
		const f = filters.filter(v => v !== null) as Array<Exclude<typeof filters[number], null>>;
		for (const [,...val] of f) val.forEach(v => v !== undefined && v !== null ? values.push(v) : null);

		if (!order) order = "ORDER BY id DESC";
		return [`SELECT t.* FROM ${Tag.TABLE} t${selectExtra.length === 0 ? "" : `, ${selectExtra.join(", ")}`}${statements.length === 0 ? "" : ` WHERE ${statements.join(" AND ")}`}${!order ? "" : ` ${order}`} LIMIT ${limit || Config.defaultPostLimit} OFFSET ${offset || 0}`, values];
	}
}
