import TagVersion from "./TagVersion";
import type { CountResult } from "..";
import db from "..";
import Util from "../../util/Util";
import { assert } from "tsafe";

export interface TagData {
	id: number;
	name: string;
	category: number;
	creator_id: number;
	created_at: string;
	updated_at: string;
	version: number;
	versions: Array<number>;
	revision: number;
	post_count: number;
	locked: boolean;
}
export type TagCreationRequired = Pick<TagData, "name" | "creator_id">;
export type TagCreationIgnored = "id" | "created_at" | "updated_at";
export type TagCreationData = TagCreationRequired & Partial<Omit<TagData, keyof TagCreationRequired | TagCreationIgnored>>;

// @TODO tag revision and proper versioning

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
	"hassource", "hasdescription", "tagslocked", "isparent", "ischild", "inpool",
	"approved", "deleted", "pending"
] as Array<string>;
export const FunctionalMetaTags = [
	"newpool", "pool", "set", "vote", "fav", "lock", "locked", "rating"
];
export const SearchMetaTags = [
	...BooleanMetaTags,
	"user", "user_id", "approver", "commenter", "flagger", "del",
	"id", "pool", "parent", "child",
	"lock", "locked", "score", "favcount", "filesize", "filetype", "duration",
	"description", "delreason", "title", "source",
	"votedup", "voteddown",
	"order", "limit"
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
		`${key}_tags`, `${key}_tags_desc`, `${key}_tags_asc` // default: desc
	])).reduce((a, b) => a.concat(b), []),
	"popular", "random"
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
	updated_at: string;
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

	static async getTagType(name: string) {
		const { rows: [res] } = await db.query<{ category: number; }>(`SELECT category FROM ${this.TABLE} WHERE name = $1`, [name]);
		if (!res) return null;
		return res.category;
	}

	static async parseTagTypes(tags: Array<string>) {
		const types = TagCategoryNames.map(t => ({ [t]: [] as Array<string> })).reduce((a, b) => ({ ...a, ...b }), {});
		for (const tag of tags) {
			const type = await this.getTagType(tag);
			if (type === null) {
				if (!types.unknown) types.unknown = [];
				types.unknown.push(tag);
			} else types[TagCategories[type].toLowerCase()].push(tag);
		}
		return types;
	}

	static parseMetaTag(tag: string, validMeta = [...MetaTags, ...TagCategoryNames]): [metatag: string | null, name: string] {
		validMeta = validMeta.map(m => m.toLowerCase());
		if (!tag.includes(":")) return [null, tag];
		const [meta, ...n] = tag.split(":");
		const name = n.join(":");
		if (validMeta.includes(meta)) return [meta, name];
		else return [null, tag];
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
