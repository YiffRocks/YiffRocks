import GenericSearch from "./GenericSearch";
import Config from "../../config";
import type { FileType } from "../../db/Models/File";
import File from "../../db/Models/File";

export interface FileSearchOptions {
	post_id?: number;
	md5?: string;
	is_primary?: boolean;
	type?: FileType;
	width?: number | string;
	height?: number | string;
	parent_id?: number;
	size?: number | string;
}
export default class FileSearch extends GenericSearch {
	protected static searchPostID(value: number) {
		return this.genericSearch("post_id", value);
	}

	protected static searchMD5(value: string) {
		return this.genericSearch("md5", value);
	}

	protected static searchPrimary(value: boolean) {
		return this.genericSearch("is_primary", value);
	}

	protected static searchType(value: string) {
		return this.genericSearch("type", value);
	}

	protected static searchWidth(value: string) {
		return this.searchWithOperator("width", value);
	}

	protected static searchHeight(value: string) {
		return this.searchWithOperator("height", value);
	}

	protected static searchParentID(value: number) {
		return this.genericSearch("parent_id", value);
	}

	protected static searchSize(value: string) {
		return this.searchWithOperator("size", value);
	}

	static override async constructQuery(query: FileSearchOptions, limit?: number, offset?: number): Promise<[query: string, values: Array<unknown>]> {
		const filters: Array<[sql: string, ...values: Array<unknown>] | null> = [];
		const selectExtra: Array<string> = [];
		if (query.post_id && !isNaN(query.post_id)) filters.push(this.searchPostID(query.post_id));
		if (query.md5) filters.push(this.searchMD5(query.md5));
		if (query.is_primary) filters.push(this.searchPrimary(query.is_primary));
		if (query.type) filters.push(this.searchType(query.type));
		if (query.width) filters.push(this.searchWidth(String(query.width)));
		if (query.height) filters.push(this.searchHeight(String(query.height)));
		if (query.parent_id) filters.push(this.searchParentID(query.parent_id));
		if (query.size) filters.push(this.searchSize(String(query.size)));
		let index = 0;
		const statements = filters.filter(Boolean).map(f => f![0].replace(/\?/g, () => `$${++index}`));
		const values: Array<unknown> = [];
		const f = filters.filter(v => v !== null) as Array<Exclude<typeof filters[number], null>>;
		for (const [,...val] of f) val.forEach(v => v !== undefined && v !== null ? values.push(v) : null);
		return [`SELECT f.* FROM ${File.TABLE} f${selectExtra.length === 0 ? "" : `, ${selectExtra.join(", ")}`}${statements.length === 0 ? "" : ` WHERE ${statements.join(" AND ")}`} ORDER BY id DESC LIMIT ${limit || Config.defaultPostLimit} OFFSET ${offset || 0}`, values];
	}
}
