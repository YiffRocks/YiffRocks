import PostSearch from "./PostSearch";
import Config from "../../config";
import type { AllRatings, RatingLocks } from "../../db/Models/Post";
import PostVersion from "../../db/Models/PostVersion";

export interface PostVersionSearchOptions {
	post_id?: number;
	uploader_id?: number;
	uploader_name?: string;
	approver_id?: number;
	approver_name?: string;
	sources?: string;
	old_sources?: string;
	tags?: string;
	added_tags?: string;
	removed_tags?: string;
	locked_tags?: string;
	added_locked_tags?: string;
	removed_locked_tags?: string;
	rating?: AllRatings;
	old_rating?: AllRatings;
	rating_lock?: RatingLocks | "none";
	old_rating_lock?: RatingLocks | "none";
	parent_id?: number;
	old_parent_id?: number;
	description?: string;
	old_description?: string;
	title?: string;
	old_title?: string;
	reason?: string;
}
export default class PostVersionSearch extends PostSearch {
	protected static searchReason(value: string) {
		return this.searchLike("reason", value);
	}
	protected static searchPostID(value: number) {
		return this.genericSearch("post_id", value);
	}

	static override async constructQuery(query: PostVersionSearchOptions, limit?: number, offset?: number): Promise<[query: string, values: Array<unknown>]> {
		const filters: Array<[string, unknown?] | null> = [];
		const selectExtra: Array<string> = [];
		let order: string | undefined;
		if (query.post_id && !isNaN(query.post_id)) filters.push(this.searchPostID(query.post_id));
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
		if (query.old_sources) {
			const s = this.searchSources(query.old_sources, "old_sources");
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
		if (query.added_tags) {
			const t = await this.searchTags(query.added_tags, [0, 0], false, "added_tags");
			if (t.extra) t.extra.forEach(e => !selectExtra.includes(e) ? selectExtra.push(e) : null);
			filters.push(...t.results);
		}
		if (query.removed_tags) {
			const t = await this.searchTags(query.removed_tags, [0, 0], false, "removed_tags");
			if (t.extra) t.extra.forEach(e => !selectExtra.includes(e) ? selectExtra.push(e) : null);
			filters.push(...t.results);
		}
		if (query.locked_tags) {
			const lt = this.searchLockedTags(query.locked_tags);
			if (lt.extra) lt.extra.forEach(e => !selectExtra.includes(e) ? selectExtra.push(e) : null);
			filters.push(...lt.results);
		}
		if (query.added_locked_tags) {
			const lt = this.searchLockedTags(query.added_locked_tags, "added_locked_tags");
			if (lt.extra) lt.extra.forEach(e => !selectExtra.includes(e) ? selectExtra.push(e) : null);
			filters.push(...lt.results);
		}
		if (query.removed_locked_tags) {
			const lt = this.searchLockedTags(query.removed_locked_tags, "removed_locked_tags");
			if (lt.extra) lt.extra.forEach(e => !selectExtra.includes(e) ? selectExtra.push(e) : null);
			filters.push(...lt.results);
		}
		if (query.rating) filters.push(this.searchRatings(query.rating));
		if (query.old_rating) filters.push(this.searchRatings(query.old_rating, "old_rating"));
		if (query.rating_lock) filters.push(this.searchRatingLocks(query.rating_lock));
		if (query.old_rating_lock) filters.push(this.searchRatingLocks(query.old_rating_lock));
		if (query.parent_id && !isNaN(query.parent_id)) filters.push(this.searchParentID(query.parent_id));
		if (query.old_parent_id && !isNaN(query.old_parent_id)) filters.push(this.searchParentID(query.old_parent_id, "old_parent_id"));
		if (query.description) filters.push(this.searchDescription(query.description));
		if (query.old_description) filters.push(this.searchDescription(query.old_description, "old_description"));
		if (query.title) filters.push(this.searchTitle(query.title));
		if (query.old_title) filters.push(this.searchTitle(query.old_title, "old_title"));
		if (query.reason) filters.push(this.searchReason(query.reason));
		let index = 0;
		const statements = filters.filter(Boolean).map(f => f![0].replace(/\?/g, () => `$${++index}`));
		const values = filters.filter((v) => Boolean(v && v[1])).map(f => f![1]);

		if (!order) order = "ORDER BY id DESC";
		return [`SELECT p.* FROM ${PostVersion.TABLE} p${selectExtra.length === 0 ? "" : `, ${selectExtra.join(", ")}`}${statements.length === 0 ? "" : ` WHERE ${statements.join(" AND ")}`}${!order ? "" : ` ${order}`} LIMIT ${limit || Config.defaultPostLimit} OFFSET ${offset || 0}`, values];
	}
}
