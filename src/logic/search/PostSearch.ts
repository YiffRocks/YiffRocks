import GenericSearch from "./GenericSearch";
import Config from "../../config";
import type { AllRatings, RatingLocks, Ratings } from "../../db/Models/Post";
import Post, { PostFlags, VALID_RATINGS, VALID_RATING_LOCKS } from "../../db/Models/Post";
import Util from "../../util/Util";
import Tag, { OrderTypes, SearchMetaTags } from "../../db/Models/Tag";
import File from "../../db/Models/File";

export interface PostSearchOptions {
	uploader_id?: number;
	uploader_name?: string;
	approver_id?: number;
	approver_name?: string;
	sources?: string;
	tags?: string;
	locked_tags?: string;
	rating?: AllRatings;
	rating_lock?: RatingLocks | "none";
	parent_id?: number;
	children?: string;
	pools?: string;
	description?: string;
	title?: string;
}
export default class PostSearch extends GenericSearch {
	protected static searchUploaderID(value: number) { return this.genericSearch("uploader_id", value); }
	protected static searchUploaderName(value: string) { return this.searchUserName("uploader_id", value); }
	protected static searchApproverID(value: number) { return this.genericSearch("approver_id", value); }
	protected static searchApproverName(value: string) { return this.searchUserName("approver_id", value); }

	protected static searchSources(value: string, name = "sources") {
		const n = name === "sources" ? "s" : `${name.slice(0, 1)}s`;
		const res: Array<[string, string]> = [];
		const all = value.split(" ");
		let extra = false;
		for (const source of all) {
			extra = true;
			res.push([`${n} LIKE ?`, `%${Util.parseWildcards(source)}`]);
		}
		return {
			results: res,
			extra:   !extra ? [] : [`unnest(${name}) ${n}`]
		};
	}

	protected static async searchTags(value: string, initialLimit: [limit: number, offset: number], enableMeta = true, dbName = "tags") {
		const n = dbName === "tags" ? "t" : `${dbName.slice(0, 1)}t`;
		const res: Array<[string, unknown?, unknown?] | null> = [];
		const all = value.split(" ");
		let extra = false, limit: number | undefined, offset: number | undefined, order: ReturnType<typeof PostSearch["formatOrder"]> | undefined;
		const usedExtra: Array<string> = [];
		// @TODO revisit this as it might have some weird outcomes
		// @TODO negations
		for (const tag of all) {
			const [meta, name] = Tag.parseMetaTag(tag, SearchMetaTags);
			let num: number | false;
			if (meta && enableMeta) {
				switch (meta) {
					case "hassources": res.push([`array_dims(sources) IS ${name === "true" ? "NOT " : ""}NULL`]); break;
					case "hasdescription": res.push([`description ${name === "true" ? "!" : ""}= ''`]); break;
					case "hastitle": res.push([`title ${name === "true" ? "!" : ""}= ''`]); break;
					case "haslockedtags": res.push([`array_dims(locked_tags) IS ${name === "true" ? "NOT " : ""}NULL`]); break;
					case "isparent": res.push([`array_dims(children) IS ${name === "true" ? "NOT " : ""}NULL`]); break;
					case "ischild": res.push([`parent_id IS ${name === "true" ? "NOT " : ""}NULL`]); break;
					case "inpool": res.push([`array_dims(pools) IS ${name === "true" ? "NOT " : ""}NULL`]); break;
					case "approved": res.push([`(flags & ${PostFlags.PENDING}) ${name === "true" ? "!" : ""}= ${PostFlags.PENDING}`]); break;
					case "deleted": res.push([`(flags & ${PostFlags.DELETED}) ${name === "true" ? "!" : ""}= ${PostFlags.DELETED}`]); break;
					case "pending": res.push([`(flags & ${PostFlags.PENDING}) ${name === "true" ? "" : "!"}= ${PostFlags.PENDING}`]); break;
					// @TODO support operators for numbers like lt/gt/range
					case "user": res.push(await this.searchUploaderName(name)); break;
					case "user_id": if ((num = Util.isValidNum(name))) res.push(this.searchUploaderID(num)); break;
					case "approver": res.push(await this.searchApproverName(name)); break;
					case "approver_id": if ((num = Util.isValidNum(name))) res.push(this.searchApproverID(num)); break;
					case "id": res.push(this.searchWithOperator("id", name)); break;
					case "parent":  if ((num = Util.isValidNum(name))) res.push(this.searchParentID(num)); break;
					case "child": res.push(...this.searchChildren(name)); break;
					case "rating": res.push(this.searchRatings(name as Ratings)); break;
					case "lock": case "locked": res.push(this.searchRatingLocks(name as RatingLocks)); break;
					case "score": res.push(this.searchWithOperator("score", name)); break;
					case "favcount": res.push(this.searchWithOperator("favorite_count", name)); break;
					case "commentcount": res.push(this.searchWithOperator("comment_count", name)); break;
					case "filesize": res.push(this.searchWithOperator("filesize", name)); break;
					case "duration": res.push(this.searchWithOperator("duration", name)); break;
					case "type": res.push(["type = ?", name]); break;
					case "description": res.push(this.searchDescription(name)); break;
					case "title": res.push(this.searchTitle(name)); break;
					case "source": {
						const s = this.searchSources(name);
						if (s.results.length > 0) {
							res.push(...s.results);
							s.extra.forEach(e => !usedExtra.includes(e) ? usedExtra.push(e) : null);
						}
						break;
					}
					case "order": if (OrderTypes.includes(name)) order = this.formatOrder(name); break;
					case "limit": if ((num = Util.isValidNum(name))) limit = Util.parseLimit(num)[0]; break;
					case "page": offset = Util.parseLimit(limit || initialLimit[0], name)[0]; break;
					case "md5": {
						const file = await File.getByMD5(name);
						if (file) res.push(["id = ?", file.post_id]);
						break;
					}
				}
			} else {
				if (tag.includes(Config.wildcardCharacter)) {
					extra = true;
					res.push([`${n} LIKE ?`, Util.parseWildcards(tag)]);
				} else res.push([`${dbName} @> ARRAY[?]`, tag]);
			}
		}
		if (extra) usedExtra.push(`unnest(${dbName}) ${n}`);
		return {
			limit,
			offset,
			order,
			results: res,
			extra:   usedExtra
		};
	}

	protected static searchLockedTags(value: string, name = "locked_tags") {
		const n = name === "locked_tags" ? "l" : `${name.slice(0, 1)}l`;
		const res: Array<[string, string]> = [];
		const all = value.split(" ");
		let extra = false;
		for (const tag of all) {
			if (tag.includes(Config.wildcardCharacter)) {
				extra = true;
				res.push([`${n} LIKE ?`, `${Util.parseWildcards(tag)}`]);
			} else res.push([`${name} @> ARRAY[?]`, tag]);
		}

		return {
			results: res,
			extra:   !extra ? [] : [`unnest(${name}) ${n}`]
		};
	}

	protected static searchRatings(value: AllRatings, name = "rating") {
		const r = value === "e" ? "explicit" : value === "q" ? "questionable" : value === "s" ? "safe" : value;
		if (VALID_RATINGS.includes(r)) return this.genericSearch(name, r);
		else return null;
	}

	protected static searchRatingLocks(value: RatingLocks | "none", name = "rating_lock") {
		const r = value === "none" ? null : value;
		if (r === null || VALID_RATING_LOCKS.includes(r)) return this.genericSearch(name, r);
		else return null;
	}

	protected static searchParentID(value: number, name = "parent_id") {
		return this.genericSearch(name, value);
	}

	protected static searchChildren(value: string) {
		const res: Array<[string, number]> = [];
		const all = value.split(" ");
		for (const child of all) {
			if (isNaN(Number(child))) continue;
			res.push(["children @> ARRAY[?]", Number(child)]);
		}
		return res;
	}
	protected static searchPools(value: string) {
		const res: Array<[string, number]> = [];
		const all = value.split(" ");
		for (const pool of all) {
			if (isNaN(Number(pool))) continue;
			res.push(["pools @> ARRAY[?]", Number(pool)]);
		}
		return res;
	}

	protected static searchDescription(value: string, name = "description") { return this.searchLike(name, value); }
	protected static searchTitle(value: string, name = "title") { return this.searchLike(name, value); }

	static override async constructQuery(query: PostSearchOptions, limit?: number, offset?: number): Promise<[query: string, values: Array<unknown>]> {
		const filters: Array<[sql: string, ...values: Array<unknown>] | null> = [];
		const selectExtra: Array<string> = [];
		let order: string | undefined;
		if (query.uploader_id && !isNaN(query.uploader_id)) filters.push(this.searchUploaderID(query.uploader_id));
		if (query.approver_id && !isNaN(query.approver_id)) filters.push(this.searchApproverID(query.approver_id));
		if (query.parent_id && !isNaN(query.parent_id))     filters.push(this.searchParentID(query.parent_id));
		if (query.uploader_name) filters.push(await this.searchUploaderName(query.uploader_name));
		if (query.approver_name) filters.push(await this.searchApproverName(query.approver_name));
		if (query.sources) {
			const s = this.searchSources(query.sources);
			if (s.extra) s.extra.forEach(e => !selectExtra.includes(e) ? selectExtra.push(e) : null);
			filters.push(...s.results);
		}
		if (query.tags) {
			const t = await this.searchTags(query.tags, [limit || Config.defaultPostLimit, offset || 0]);
			if (t.limit) limit = t.limit;
			if (t.offset) offset = t.offset;
			if (t.order) {
				if (t.order === "POPULAR") {
					// @TODO
				} else if (t.order === "INVALID") {
					// ignore
				} else order = t.order;
			}
			if (t.extra) t.extra.forEach(e => !selectExtra.includes(e) ? selectExtra.push(e) : null);
			filters.push(...t.results);
		}
		if (query.locked_tags) {
			const lt = this.searchLockedTags(query.locked_tags);
			if (lt.extra) lt.extra.forEach(e => !selectExtra.includes(e) ? selectExtra.push(e) : null);
			filters.push(...lt.results);
		}
		if (query.rating)        filters.push(this.searchRatings(query.rating));
		if (query.rating_lock)   filters.push(this.searchRatingLocks(query.rating_lock));
		if (query.children)     filters.push(...this.searchChildren(query.children));
		if (query.pools)         filters.push(...this.searchPools(query.pools));
		if (query.description)   filters.push(this.searchDescription(query.description));
		if (query.title)         filters.push(this.searchTitle(query.title));
		let index = 0;
		const statements = filters.filter(Boolean).map(f => f![0].replace(/\?/g, () => `$${++index}`));
		const values: Array<unknown> = [];
		const f = filters.filter(v => v !== null) as Array<Exclude<typeof filters[number], null>>;
		for (const [,...val] of f) val.forEach(v => v !== undefined && v !== null ? values.push(v) : null);

		if (!order) order = "ORDER BY id DESC";
		return [`SELECT p.* FROM ${Post.TABLE} p${selectExtra.length === 0 ? "" : `, ${selectExtra.join(", ")}`}${statements.length === 0 ? "" : ` WHERE ${statements.join(" AND ")}`}${!order ? "" : ` ${order}`} LIMIT ${limit || Config.defaultPostLimit} OFFSET ${offset || 0}`, values];
	}
}
