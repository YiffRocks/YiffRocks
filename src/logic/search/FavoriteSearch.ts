import GenericSearch from "./GenericSearch";
import Config from "../../config";
import Favorite from "../../db/Models/Favorite";

export interface FavoriteSearchOptions {
	user_id?: number;
	user_name?: string;
	post_id?: number;
}
export default class FavoriteSearch extends GenericSearch {
	protected static searchUserID(value: number) {
		return this.genericSearch("user_id", value);
	}

	protected static async searchUserName(value: string) {
		return super.searchUserName("user_id", value);
	}

	protected static searchPostID(value: number) {
		return this.genericSearch("post_id", value);
	}

	static override async constructQuery(query: FavoriteSearchOptions, limit?: number, offset?: number): Promise<[query: string, values: Array<unknown>]> {
		const filters: Array<[sql: string, ...values: Array<unknown>] | null> = [];
		const selectExtra: Array<string> = [];
		if (query.user_id && !isNaN(query.user_id)) filters.push(this.searchUserID(query.user_id));
		if (query.user_name) filters.push(await this.searchUserName(query.user_name));
		if (query.post_id && !isNaN(query.post_id)) filters.push(this.searchPostID(query.post_id));
		let index = 0;
		const statements = filters.filter(Boolean).map(f => f![0].replace(/\?/g, () => `$${++index}`));
		const values: Array<unknown> = [];
		const f = filters.filter(v => v !== null) as Array<Exclude<typeof filters[number], null>>;
		for (const [,...val] of f) val.forEach(v => v !== undefined && v !== null ? values.push(v) : null);
		return [`SELECT f.* FROM ${Favorite.TABLE} f${selectExtra.length === 0 ? "" : `, ${selectExtra.join(", ")}`}${statements.length === 0 ? "" : ` WHERE ${statements.join(" AND ")}`} ORDER BY id DESC LIMIT ${limit || Config.defaultPostLimit} OFFSET ${offset || 0}`, values];
	}
}
