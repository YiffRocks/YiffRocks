import TagVersion from "./TagVersion";
import type { CountResult } from "..";
import db from "..";
import Util from "../../util/Util";
import type { TagSearchOptions } from "../../logic/search/TagSearch";
import TagSearch from "../../logic/search/TagSearch";
import { assert } from "tsafe";

export interface TagData {
	id: number;
	name: string;
	category: number;
	creator_id: number;
	created_at: string;
	updated_at: string | null;
	version: number;
	versions: Array<number>;
	revision: number;
	post_count: number;
	locked: boolean;
}
export type TagCreationRequired = Pick<TagData, "name" | "creator_id">;
export type TagCreationIgnored = "id" | "created_at" | "updated_at";
export type TagCreationData = TagCreationRequired & Partial<Omit<TagData, keyof TagCreationRequired | TagCreationIgnored>>;


// if you add a type, make sure to add it to the static things like setTags for stats, and formatOrder for ordering
export enum TagCategories {
	GENERAL   = 0,
	ARTIST    = 1,
	COPYRIGHT = 2,
	CHARACTER = 3,
	SPECIES   = 4,
	INVALID   = 5,
	LORE      = 6,
	META      = 7
}
export const TagCategoryNames = Util.enumKeys(TagCategories).map(k => k.toLowerCase());

// future proofing
export enum TagRestrictions {
	RESTRICT_CREATE = 1 << 0
}

export const BooleanMetaTags = [
	"hassources", "hasdescription", "hastitle", "haslockedtags", "isparent", "ischild", "inpool",
	"approved", "deleted", "pending"
] as Array<string>;
export const FunctionalMetaTags = [
	"newpool", "pool", "set", "vote", "fav", "lock", "locked", "rating"
];
// @TODO (search): commenter, commenter_id, flagger, flagger_id, del, del_id, delreason
export const SearchMetaTags = [
	...BooleanMetaTags,
	"user", "user_id", "approver", "approver_id", "commenter", "commenter_id", "flagger", "flagger_id", "del", "del_id",
	"id", "pool", "parent", "child",
	"rating", "lock", "locked", "score", "favcount", "commentcount", "filesize", "duration", "type",
	"delreason", "description", "title", "source",
	"votedup", "voteddown",
	"order", "limit", "page", "md5"
];
export const OrderTypes = [
	"id",            "id_desc",             "id_asc",             // default: asc
	"score",         "score_desc",         "score_asc",           // default: desc
	"favcount",      "favcount_desc",      "favcount_asc",        // default: desc
	"creation",      "creation_desc",      "creation_asc",        // default: desc
	"update",        "update_desc",        "update_asc",          // default: desc
	"comment_count", "comment_count_desc", "comment_count_desc",  // default: desc
	"mpixels",       "mpixels_desc",       "mpixels_asc",         // default: desc
	"width",         "width_desc",         "width_asc",           // default: desc
	"height",        "height_desc",        "height_asc",          // default: desc
	"filesize",      "filesize_desc",      "filesize_asc",        // default: desc
	"tagcount",      "tagcount_desc",      "tagcount_asc",        // default: desc
	"duration",      "duration_desc",      "duration_asc",        // default: desc
	...(TagCategoryNames.map(key => [
		`tagcount_${key}`, `tagcount_${key}_desc`, `tagcount_${key}_asc` // default: desc
	])).reduce((a, b) => a.concat(b), []),
	"popular", "random" // @TODO popular
].map(v => v.toLowerCase());
export const MetaTags = Array.from(new Set([
	...FunctionalMetaTags,
	...SearchMetaTags
]));
export default class Tag implements TagData {
	static TABLE = "tags";
	id: number;
	name: string;
	category: number;
	creator_id: number;
	created_at: string;
	updated_at: string | null;
	version: number;
	versions: Array<number>;
	revision: number;
	post_count: number;
	locked: boolean;
	constructor(data: TagData) {
		this.id         = data.id;
		this.name       = data.name;
		this.category   = data.category;
		this.creator_id = data.creator_id;
		this.created_at = data.created_at;
		this.updated_at = data.updated_at;
		this.version    = data.version;
		this.versions   = data.versions;
		this.revision   = data.revision;
		this.post_count = data.post_count;
		this.locked     = data.locked;
	}

	get categoryName() { return Util.normalizeConstant(TagCategories[this.category]); }

	static async get(id: number) {
		const { rows: [res] } = await db.query<TagData>(`SELECT * FROM ${this.TABLE} WHERE id = $1`, [id]);
		if (!res) return null;
		return new Tag(res);
	}

	static async getByName(name: string) {
		const { rows: [res] } = await db.query<TagData>(`SELECT * FROM ${this.TABLE} WHERE name = $1`, [name]);
		if (!res) return null;
		return new Tag(res);
	}

	static async getCategory(name: string) {
		const { rows: [res] } = await db.query<{ category: number; }>(`SELECT category FROM ${this.TABLE} WHERE name = $1`, [name]);
		if (!res) return null;
		return res.category;
	}

	static async getCategories(names: Array<string>) {
		const { rows: res } = await db.query<{ name: string; category: number; }>(`SELECT name, category FROM tags WHERE name = ANY(ARRAY[${names.map((n, index) => `$${index + 1}`).join(", ")}])`, [...names]);
		return res.map(r => ({ [r.name]: r.category })).reduce((a, b) => ({ ...a, ...b }), {});
	}

	static async create(data: TagCreationData, ip_address: string | null = null) {
		Util.removeUndefinedKeys(data);
		const ver = await TagVersion.create({
			name:               data.name,
			updater_id:         data.creator_id,
			updater_ip_address: ip_address,
			category:           data.category,
			locked:             data.locked
		}, true);
		const res = await db.insert<number>(this.TABLE, {
			...data,
			version:  ver,
			revision: 1,
			versions: [ver]
		});
		const createdObject = await this.get(res);
		assert(createdObject !== null, "failed to create new Tag object");
		await TagVersion.edit(ver, { tag_id: createdObject.id });
		return createdObject;
	}

	static async doesExist(name: string) {
		const { rows: [res] } = await db.query<CountResult>(`SELECT COUNT(name) FROM ${this.TABLE} WHERE name = $1`, [name]);
		return Number(res.count) > 0;
	}

	static async delete(id: number) {
		return db.delete(this.TABLE, id);
	}

	static async edit(id: number, data: Omit<Partial<TagData>, "id">) {
		return Util.genericEdit(Tag, this.TABLE, id, data);
	}

	static async parseTagTypes(tags: Array<string>) {
		const types = await this.getCategories(tags);
		const res = Util.enumKeys(TagCategories).map(key => ({
			[key.toLowerCase()]: [] as Array<string>
		})).reduce((a, b) => ({ ...a, ...b }), {});
		for (const tag of tags) {
			if (typeof types[tag] !== "number") {
				if (!types.unknown) res.unknown = [];
				res.unknown.push(tag);
			} else res[TagCategories[types[tag]].toLowerCase()].push(tag);
		}
		return res as Record<Lowercase<keyof typeof TagCategories>, Array<string>>;
	}

	static parseMetaTag(tag: string, validMeta = [...MetaTags, ...TagCategoryNames]): [metatag: string | null, name: string] {
		validMeta = validMeta.map(m => m.toLowerCase());
		if (!tag.includes(":")) return [null, tag];
		const [meta, ...n] = tag.split(":");
		const name = n.join(":");
		if (validMeta.includes(meta)) return [meta, name];
		else return [null, tag];
	}

	static async search(query: TagSearchOptions, limit: number | undefined, offset: number | undefined, idOnly: true): Promise<Array<number>>;
	static async search(query: TagSearchOptions, limit?: number, offset?: number, idOnly?: false): Promise<Array<Tag>>;
	static async search(query: TagSearchOptions, limit?: number, offset?: number, idOnly = false) {
		const [sql, values] = await TagSearch.constructQuery(query, limit, offset);
		const { rows: res } = await db.query<TagData>(idOnly ? sql.replace(/t\.\*/, "t.id") : sql, values);
		if (idOnly) return res.map(r => r.id);
		return res.map(r => new Tag(r));
	}

	async edit(data: Omit<Partial<TagData>, "id">) {
		Object.assign(this, Util.removeUndefinedKV(data));
		return Tag.edit(this.id, data);
	}

	toJSON() {
		return {
			id:         this.id,
			name:       this.name,
			created_at: this.created_at,
			updated_at: this.updated_at,
			post_count: this.post_count,
			category:   this.category,
			locked:     this.locked
		};
	}
}
