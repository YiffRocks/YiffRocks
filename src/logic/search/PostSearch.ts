import Config from "../../config";
import File from "../../db/Models/File";
import type { RatingLocks, Ratings } from "../../db/Models/Post";
import { PostFlags, VALID_RATINGS, VALID_RATING_LOCKS } from "../../db/Models/Post";
import Tag, { SearchMetaTags, OrderTypes } from "../../db/Models/Tag";
import User from "../../db/Models/User";
import Util from "../../util/Util";

export default class PostSearch {

	private static searchUploaderID(value: number) { return this.searchUserID("uploader_id", value); }
	private static searchUploaderName(value: string) { return this.searchUserName("uploader_id", value); }
	private static searchApproverID(value: number) { return this.searchUserID("approver_id", value); }
	private static searchApproverName(value: string) { return this.searchUserName("approver_id", value); }
	private static searchUserID(name: string, value: number): [string, number] {
		return [`${name} = ?`, Number(value)];
	}

	private static async searchUserName(name: string, value: string): Promise<[string, string] | null> {
		const id = await User.nameToID(value);
		if (id !== null) return [`${name} = ?`, value];
		else return null;
	}

	private static searchSources(value: string, extraCB?: (val: string) => void) {
		const res: Array<[string, string]> = [];
		const all = value.split(" ");
		let extra = false;
		for (const source of all) {
			extra = true;
			res.push(["s LIKE ?", `%${Util.parseWildcards(source)}`]);
		}
		if (extra && extraCB) extraCB("unnest(locked_tags) l");
		return res;
	}

	private static formatOrder(type: string) {
		switch (type) {
			case "id": case "id_asc": return "ORDER BY id ASC";
			case "id_desc": return "ORDER BY id DESC";

			case "score": case "score_desc": return "ORDER BY score DESC";
			case "score_asc": return "ORDER BY score ASC";

			case "favcount": case "favcount_desc": return "ORDER BY favorite_count DESC";
			case "favcount_asc": return "ORDER BY favorite_count ASC";

			case "creation": case "creation_desc": return "ORDER BY created_at DESC";
			case "creation_asc": return "ORDER BY created_at ASC";

			case "update": case "update_desc": return "ORDER BY updated_at DESC";
			case "update_asc": return "ORDER BY updated_at ASC";

			case "comment_count": case "comment_count_desc": return "ORDER BY comment_count DESC";
			case "comment_count_asc": return "ORDER BY comment_count ASC";

			case "width": case "width_desc": return "ORDER BY width DESC";
			case "width_asc": return "ORDER BY width ASC";

			case "height": case "height_desc": return "ORDER BY height DESC";
			case "height_asc": return "ORDER BY height ASC";

			case "filesize": case "filesize_desc": return "ORDER BY filesize DESC";
			case "filesize_asc": return "ORDER BY filesize ASC";

			case "tagcount": case "tagcount_desc": return "ORDER BY tag_count DESC";
			case "tagcount_asc": return "ORDER BY tag_count ASC";

			case "tagcount_general": case "tagcount_general_desc": return "ORDER BY tag_count_general DESC";
			case "tagcount_general_asc": return "ORER BY tag_count_general ASC";

			case "tagcount_artist": case "tagcount_artist_desc": return "ORDER BY tag_count_artist DESC";
			case "tagcount_artist_asc": return "ORER BY tag_count_artist ASC";

			case "tagcount_copyright": case "tagcount_copyright_desc": return "ORDER BY tag_count_copyright DESC";
			case "tagcount_copyright_asc": return "ORER BY tag_count_copyright ASC";

			case "tagcount_character": case "tagcount_character_desc": return "ORDER BY tag_count_character DESC";
			case "tagcount_character_asc": return "ORER BY tag_count_character ASC";

			case "tagcount_species": case "tagcount_species_desc": return "ORDER BY tag_count_species DESC";
			case "tagcount_species_asc": return "ORER BY tag_count_species ASC";

			case "tagcount_invalid": case "tagcount_invalid_desc": return "ORDER BY tag_count_invalid DESC";
			case "tagcount_invalid_asc": return "ORER BY tag_count_invalid ASC";

			case "tagcount_lore": case "tagcount_lore_desc": return "ORDER BY tag_count_lore DESC";
			case "tagcount_lore_asc": return "ORER BY tag_count_lore ASC";

			case "tagcount_meta": case "tagcount_meta_desc": return "ORDER BY tag_count_meta DESC";
			case "tagcount_meta_asc": return "ORER BY tag_count_meta ASC";

			case "duration": case "duration_desc": return "ORDER BY duration DESC";
			case "duration_asc": return "ORDER BY duration ASC";

			case "popular": return "POPULAR";
			case "random": return "ORDER BY RANDOM()";
			default: return "INVALID;";
		}
	}

	private static async searchTags(value: string, initialLimit: [limit: number, offset: number], extraCB?: (val: string) => void) {
		const res: Array<[string, unknown?] | null> = [];
		const all = value.split(" ");
		let extra = false, limit: number | undefined, offset: number | undefined, order: ReturnType<typeof PostSearch["formatOrder"]> | undefined;
		// @TODO revisit this as it might have some weird outcomes
		for (const tag of all) {
			const [meta, name] = Tag.parseMetaTag(tag, SearchMetaTags);
			let num: number | false;
			if (meta) {
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
					case "id": if ((num = Util.isValidNum(name))) res.push(["id = ?", num]); break;
					case "parent": if ((num = Util.isValidNum(name))) res.push(["parent_id = ?", num]); break;
					case "child": if ((num = Util.isValidNum(name))) res.push(["children @> ARRAY[?]", num]); break;
					case "rating": res.push(this.searchRatings(name as Ratings)); break;
					case "lock": case "locked": res.push(this.searchRatingLocks(name as RatingLocks)); break;
					case "score": if ((num = Util.isValidNum(name))) res.push(["score = ?", num]); break;
					case "favcount": if ((num = Util.isValidNum(name))) res.push(["favorite_count = ?", num]); break;
					case "commentcount": if ((num = Util.isValidNum(name))) res.push(["comment_count = ?", num]); break;
					case "filesize": if ((num = Util.isValidNum(name))) res.push(["filesize = ?", num]); break;
					case "duration": if ((num = Util.isValidNum(name))) res.push(["duration = ?", num]); break;
					case "type": res.push(["type = ?", name]); break;
					case "description": res.push(this.searchDescription(name)); break;
					case "title": res.push(this.searchTitle(name)); break;
					case "source": res.push(...this.searchSources(name)); break;
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
					res.push(["t LIKE ?", Util.parseWildcards(tag)]);
				} else res.push(["tags @> ARRAY[?]", tag]);
			}
		}
		if (extra && extraCB) extraCB("unnest(tags) t");
		return {
			limit,
			offset,
			order,
			results: res
		};
	}

	private static searchLockedTags(value: string, extraCB?: (val: string) => void) {
		const res: Array<[string, string]> = [];
		const all = value.split(" ");
		let extra = false;
		for (const tag of all) {
			if (tag.includes(Config.wildcardCharacter)) {
				extra = true;
				res.push(["l LIKE ?", `${Util.parseWildcards(tag)}`]);
			} else res.push(["locked_tags @> ARRAY[?]", tag]);
		}
		if (extra && extraCB) extraCB("unnest(locked_tags) l");

		return res;
	}

	private static searchRatings(value: Ratings | "e" | "q" | "s"): [string, string] | null {
		const r = value === "e" ? "explicit" : value === "q" ? "questionable" : value === "s" ? "safe" : value;
		if (VALID_RATINGS.includes(r)) return ["rating = ?", r];
		else return null;
	}

	private static searchRatingLocks(value: RatingLocks | "none"): [string, string | null] | null {
		const r = value === "none" ? null : value;
		if (r === null || VALID_RATING_LOCKS.includes(r)) return ["rating_lock = ?", r];
		else return null;
	}

	private static searchParentID(value: number): [string, number] {
		return ["parent_id = ?", value];
	}

	private static searchchildren(value: string) {
		const res: Array<[string, number]> = [];
		const all = value.split(" ");
		for (const child of all) {
			if (isNaN(Number(child))) continue;
			res.push(["children @> ARRAY[?]", Number(child)]);
		}
		return res;
	}

	private static searchPools(value: string) {
		const res: Array<[string, number]> = [];
		const all = value.split(" ");
		for (const pool of all) {
			if (isNaN(Number(pool))) continue;
			res.push(["pools @> ARRAY[?]", Number(pool)]);
		}
		return res;
	}

	private static searchLike(name: string, value: string): [string, string] { return [`${name} LIKE ?`, `%${Util.parseWildcards(value)}%`]; }
	private static searchDescription(value: string) { return this.searchLike("description", value); }
	private static searchTitle(value: string) { return this.searchLike("title", value); }

	static async constructQuery(query: {
		uploader_id?: number;
		uploader_name?: string;
		approver_id?: number;
		approver_name?: string;
		sources?: string;
		tags?: string;
		locked_tags?: string;
		rating?: Ratings | "e" | "q" | "s";
		rating_lock?: RatingLocks | "none";
		parent_id?: number;
		children?: string;
		pools?: string;
		description?: string;
		title?: string;
	}, limit?: number, offset?: number): Promise<[query: string, values: Array<unknown>, order?: string]> {
		const filters: Array<[string, unknown?] | null> = [];
		const selectExtra: Array<string> = [];
		const addExtra = (val: string) => selectExtra.includes(val) ? null : selectExtra.push(val);
		let order: string | undefined;
		if (query.uploader_id && !isNaN(query.uploader_id)) filters.push(this.searchUploaderID(query.uploader_id));
		if (query.approver_id && !isNaN(query.approver_id)) filters.push(this.searchApproverID(query.approver_id));
		if (query.parent_id && !isNaN(query.parent_id))     filters.push(this.searchParentID(query.parent_id));
		if (query.uploader_name) filters.push(await this.searchUploaderName(query.uploader_name));
		if (query.approver_name) filters.push(await this.searchApproverName(query.approver_name));
		if (query.sources)       filters.push(...this.searchSources(query.sources, addExtra));
		if (query.tags) {
			const t = await this.searchTags(query.tags, [limit || Config.defaultPostLimit, offset || 0], addExtra);
			if (t.limit) limit = t.limit;
			if (t.offset) offset = t.offset;
			if (t.order) {
				if (t.order === "POPULAR") {
					// @TODO
				} else if (t.order === "INVALID") {
					// ignore
				} else order = t.order;
			}
			filters.push(...t.results);
		}
		if (query.locked_tags)   filters.push(...this.searchLockedTags(query.locked_tags, addExtra));
		if (query.rating)        filters.push(this.searchRatings(query.rating));
		if (query.rating_lock)   filters.push(this.searchRatingLocks(query.rating_lock));
		if (query.children)     filters.push(...this.searchchildren(query.children));
		if (query.pools)         filters.push(...this.searchPools(query.pools));
		if (query.description)   filters.push(this.searchDescription(query.description));
		if (query.title)         filters.push(this.searchTitle(query.title));
		let index = 0;
		const statements = filters.filter(Boolean).map(f => f![0].replace(/\?/g, () => `$${++index}`));
		const values = filters.filter((v) => Boolean(v && v[1])).map(f => f![1]);

		if (!order) order = "ORDER BY id DESC";
		return [`SELECT p.* FROM posts p${selectExtra.length === 0 ? "" : `, ${selectExtra.join(", ")}`}${statements.length === 0 ? "" : ` WHERE ${statements.join(" AND ")}`}${!order ? "" : ` ${order}`} LIMIT ${limit || Config.defaultPostLimit} OFFSET ${offset || 0}`, values];
	}
}
