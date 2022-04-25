import User from "./User";
import Util from "../../util/Util";
import db from "..";
import type { PostVersionSearchOptions } from "../../logic/search/PostVersionSearch";
import PostVersionSearch from "../../logic/search/PostVersionSearch";
import { assert } from "tsafe";

export interface PostVersionData {
	id: number;
	created_at: string;
	// this shouldn't practically be null but db limitations require it to be nullable
	post_id: number | null;
	updater_id: number;
	updater_ip_address: string | null;
	revision: number;
	sources: Array<string>;
	old_sources: Array<string>;
	tags: Array<string>;
	added_tags: Array<string>;
	removed_tags: Array<string>;
	locked_tags: Array<string>;
	added_locked_tags: Array<string>;
	removed_locked_tags: Array<string>;
	rating: "safe" | "questionable" | "explicit";
	old_rating: "safe" | "questionable" | "explicit";
	rating_lock: "minimum" | "exact" | "maximum" | null;
	old_rating_lock: "minimum" | "exact" | "maximum" | null;
	parent_id: number | null;
	old_parent_id: number | null;
	description: string;
	old_description: string;
	title: string;
	old_title: string;
}
export type PostVersionCreationRequired = Pick<PostVersionData, "updater_id" | "updater_ip_address">;
export type PostVersionCreationIgnored = "id" | "created_at";
export type PostVersionCreationData = PostVersionCreationRequired & Partial<Omit<PostVersionData, keyof PostVersionCreationRequired | PostVersionCreationIgnored>>;

export default class PostVersion implements PostVersionData {
	static TABLE = "post_versions";
	id: number;
	created_at: string;
	post_id: number;
	updater_id: number;
	updater_ip_address: string | null;
	revision: number;
	sources: Array<string>;
	old_sources: Array<string>;
	tags: Array<string>;
	added_tags: Array<string>;
	removed_tags: Array<string>;
	locked_tags: Array<string>;
	added_locked_tags: Array<string>;
	removed_locked_tags: Array<string>;
	rating: "safe" | "questionable" | "explicit";
	old_rating: "safe" | "questionable" | "explicit";
	rating_lock: "minimum" | "exact" | "maximum" | null;
	old_rating_lock: "minimum" | "exact" | "maximum" | null;
	parent_id: number | null;
	old_parent_id: number | null;
	description: string;
	old_description: string;
	title: string;
	old_title: string;
	constructor(data: PostVersionData) {
		assert(data.post_id !== null, `received null post id in post version #${data.id}`);
		this.id                  = data.id;
		this.created_at          = data.created_at;
		this.post_id             = data.post_id;
		this.updater_id          = data.updater_id;
		this.updater_ip_address  = data.updater_ip_address;
		this.revision            = data.revision;
		this.sources             = data.sources;
		this.old_sources         = data.old_sources;
		this.tags                = data.tags;
		this.added_tags          = data.added_tags;
		this.removed_tags        = data.removed_tags;
		this.locked_tags         = data.locked_tags;
		this.added_locked_tags   = data.added_locked_tags;
		this.removed_locked_tags = data.removed_locked_tags;
		this.rating              = data.rating;
		this.old_rating          = data.old_rating;
		this.rating_lock         = data.rating_lock;
		this.old_rating_lock     = data.old_rating_lock;
		this.parent_id           = data.parent_id;
		this.old_parent_id       = data.old_parent_id;
		this.description         = data.description.trim();
		this.old_description     = data.old_description.trim();
		this.title               = data.title.trim();
		this.old_title           = data.old_title.trim();
	}

	static async get(id: number) {
		const { rows: [res] } = await db.query<PostVersionData>(`SELECT * FROM ${this.TABLE} WHERE id = $1`, [id]);
		if (!res) return null;
		return new PostVersion(res);
	}

	static async getForPostAndRevision(post: number, revision: number) {
		const { rows: [res] } = await db.query<PostVersionData>(`SELECT * FROM ${this.TABLE} WHERE post_id = $1 AND revision = $2`, [post, revision]);
		if (!res) return null;
		return new PostVersion(res);
	}

	static async getForPost(post: number) {
		const { rows: res } = await db.query<PostVersionData>(`SELECT * FROM ${this.TABLE} WHERE post_id = ?`, [post]);
		return res.map(p => new PostVersion(p));
	}

	static async create(data: PostVersionCreationData, defer: true): Promise<number>;
	static async create(data: PostVersionCreationData, defer?: false): Promise<PostVersion>;
	static async create(data: PostVersionCreationData, defer = false) {
		// console.log("create called", data.post_id, new Error());
		Util.removeUndefinedKeys(data);
		const res = await db.insert<number>(this.TABLE, data);
		if (defer) return res;
		const createdObject = await this.get(res);
		assert(createdObject !== null, "failed to create new post object");
		return createdObject;
	}

	static async delete(id: number) {
		return db.delete(this.TABLE, id);
	}

	static async edit(id: number, data: Omit<Partial<PostVersionData>, "id">) {
		return Util.genericEdit(PostVersion, this.TABLE, id, data);
	}

	get sourcesChanged() { return this.sources !== this.old_sources; }
	get addedSources() { return this.sourcesChanged ? Util.findDifferences(this.old_sources, this.sources).added : []; }
	get removedSources() { return this.sourcesChanged ? Util.findDifferences(this.old_sources, this.sources).removed : []; }
	get tagsChanged() { return JSON.stringify(this.oldTags) !== JSON.stringify(this.tags); }
	get oldTags() { return [...this.tags.filter(t => !this.added_tags.includes(t)), ...this.removed_tags]; }

	get lockedTagsChanged() { return JSON.stringify(this.oldLockedTags) !== JSON.stringify(this.locked_tags); }
	get oldLockedTags() { return [...this.locked_tags.filter(t => !this.added_locked_tags.includes(t)), ...this.removed_locked_tags]; }
	get ratingChanged() { return Boolean(this.old_rating && this.rating !== this.old_rating); }
	get ratingLockChanged() { return this.old_rating_lock !== this.rating_lock; }
	get parentChanged() { return this.old_parent_id !== this.parent_id; }
	get descriptionChanged() { return this.old_description !== this.description; }
	get titleChanged() { return this.old_title !== this.title; }

	async delete() {
		return PostVersion.delete(this.id);
	}

	async edit(data: Omit<Partial<PostVersionData>, "id">) {
		Object.assign(this, Util.removeUndefinedKV(data));
		return PostVersion.edit(this.id, data);
	}

	static async search(query: PostVersionSearchOptions, limit?: number, offset?: number) {
		const [sql, values] = await PostVersionSearch.constructQuery(query, limit, offset);
		const { rows: res } = await db.query<PostVersionData>(sql, values);
		return res.map(r => new PostVersion(r));
	}

	async toJSON() {
		return {
			id:              this.id,
			post_id:         this.post_id,
			updater_id:      this.updater_id,
			updater_name:    await User.idToName(this.updater_id),
			revision:        this.revision,
			sources_changed: this.sourcesChanged,
			sources:         this.sources,
			...(this.sourcesChanged ? {
				old_sources:     this.old_sources,
				added_sources:   this.addedSources,
				removed_sources: this.removedSources
			} : {}),
			tags_changed: this.tagsChanged,
			tags:         this.tags,
			...(this.tagsChanged ? {
				old_tags:       [...this.removed_tags, ...this.tags.filter(t => !this.added_tags.includes(t))],
				added_tags:     this.added_tags,
				removed_tags:   this.removed_tags,
				unchanged_tags: this.tags.filter(t => !this.added_tags.includes(t))
			} : {}),
			locked_tags_changed: this.lockedTagsChanged,
			locked_tags:         this.locked_tags,
			...(this.lockedTagsChanged ? {
				old_tags:              [...this.removed_tags, ...this.tags.filter(t => !this.added_tags.includes(t))],
				added_locked_tags:     this.added_locked_tags,
				removed_locked_tags:   this.removed_locked_tags,
				unchanged_locked_tags: this.locked_tags.filter(t => !this.added_locked_tags.includes(t))
			} : {}),
			rating_changed: this.ratingChanged,
			rating:         this.rating,
			...(this.ratingChanged ? {
				old_rating: this.old_rating
			} : {}),
			rating_lock_changed: this.ratingLockChanged,
			rating_lock:         this.rating_lock,
			...(this.ratingLockChanged ? {
				old_rating_lock: this.old_rating_lock
			} : {}),
			parent_changed: this.parentChanged,
			parent:         this.parent_id,
			...(this.parentChanged ? {
				old_parent: this.old_parent_id
			} : {}),
			description_changed: this.descriptionChanged,
			description:         this.description,
			...(this.descriptionChanged ? {
				old_description: this.old_description
			} : {}),
			title_changed: this.titleChanged,
			title:         this.title,
			...(this.titleChanged ? {
				old_title: this.old_title
			} : {})
		};
	}
}
