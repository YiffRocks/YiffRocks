import User from "./User";
import Util from "../../util/Util";
import db from "..";
import { assert } from "tsafe";

export interface PostVersionData {
	id: number;
	created_at: string;
	// this shouldn't practically be null but db limitations require it to be nullable
	post_id: number | null;
	updater_id: number;
	updater_ip_address: string | null;
	revision: number;
	sources: string;
	old_sources: string;
	tags: string;
	old_tags: string;
	locked_tags: string;
	old_locked_tags: string;
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
	sources: string;
	old_sources: string;
	tags: string;
	old_tags: string;
	locked_tags: string;
	old_locked_tags: string;
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
		this.id                 = data.id;
		this.created_at         = data.created_at;
		this.post_id            = data.post_id;
		this.updater_id         = data.updater_id;
		this.updater_ip_address = data.updater_ip_address;
		this.revision           = data.revision;
		this.sources            = data.sources.trim();
		this.old_sources        = data.old_sources.trim();
		this.tags               = data.tags.trim();
		this.old_tags           = data.old_tags.trim();
		this.locked_tags        = data.locked_tags.trim();
		this.old_locked_tags    = data.old_locked_tags.trim();
		this.rating             = data.rating;
		this.old_rating         = data.old_rating;
		this.rating_lock        = data.rating_lock;
		this.old_rating_lock    = data.old_rating_lock;
		this.parent_id             = data.parent_id;
		this.old_parent_id         = data.old_parent_id;
		this.description        = data.description.trim();
		this.old_description    = data.old_description.trim();
		this.title              = data.title.trim();
		this.old_title          = data.old_title.trim();
	}

	static async get(id: number | bigint) {
		const [res] = await db.query<Array<PostVersionData>>(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
		if (!res) return null;
		return new PostVersion(res);
	}

	static async getForPostAndRevision(post: number, revision: number) {
		const [res] = await db.query<Array<PostVersionData>>(`SELECT * FROM ${this.TABLE} WHERE post_id = ? AND revision = ?`, [post, revision]);
		if (!res) return null;
		return new PostVersion(res);
	}

	static async getForPost(post: number) {
		const res = await db.query<Array<PostVersionData>>(`SELECT * FROM ${this.TABLE} WHERE post_id = ?`, [post]);
		return res.map(p => new PostVersion(p));
	}

	static async create(data: PostVersionCreationData, defer: true): Promise<number>;
	static async create(data: PostVersionCreationData, defer?: false): Promise<PostVersion>;
	static async create(data: PostVersionCreationData, defer = false) {
		Util.removeUndefinedKeys(data);
		const res = await db.insert(this.TABLE, data, true);
		if (defer) return res.insertId;
		const createdObject = await this.get(res.insertId);
		assert(createdObject !== null, "failed to create new post object");
		return createdObject;
	}

	static async delete(id: number | bigint) {
		const res = await db.delete(this.TABLE, id);
		return res.affectedRows > 0;
	}


	static async edit(id: number | bigint, data: Omit<Partial<PostVersionData>, "id">) {
		return Util.genericEdit(PostVersion, this.TABLE, id, data);
	}

	get sourcesChanged() { return Boolean(this.old_sources && this.sources !== this.old_sources); }
	get addedSources() { return this.sourcesChanged ? Util.findDifferences(this.old_sources, this.sources).added : []; }
	get removedSources() { return this.sourcesChanged ? Util.findDifferences(this.old_sources, this.sources).removed : []; }
	get tagsChanged() { return Boolean(this.old_tags && this.tags !== this.old_tags); }
	get addedTags() { return this.tagsChanged ? Util.findDifferences(this.old_tags, this.tags).added : []; }
	get removedTags() { return this.tagsChanged ? Util.findDifferences(this.old_tags, this.tags).removed : []; }

	get lockedTagsChanged() { return Boolean(this.old_locked_tags && this.locked_tags !== this.old_locked_tags); }
	get addedLockedTags() { return this.lockedTagsChanged ? Util.findDifferences(this.old_locked_tags, this.locked_tags).added : []; }
	get removedLockedTags() { return this.lockedTagsChanged ? Util.findDifferences(this.old_locked_tags, this.locked_tags).removed : []; }
	get ratingChanged() { return Boolean(this.old_rating && this.rating !== this.old_rating); }
	get ratingLockChanged() { return Boolean(this.old_rating_lock && this.rating_lock !== this.old_rating_lock); }
	get parentChanged() { return Boolean(this.old_parent_id && this.parent_id !== this.old_parent_id); }
	get descriptionChanged() { return Boolean(this.old_description && this.description !== this.old_description); }
	get titleChanged() { return Boolean(this.old_title && this.title !== this.old_title); }

	async delete() {
		return PostVersion.delete(this.id);
	}

	async edit(data: Omit<Partial<PostVersionData>, "id">) {
		Object.assign(this, Util.removeUndefinedKV(data));
		return PostVersion.edit(this.id, data);
	}


	async toJSON() {
		return {
			id:              this.id,
			post_id:         this.post_id,
			updater_id:      this.updater_id,
			updater_name:    await User.idToName(this.updater_id),
			revision:        this.revision,
			sources_changed: this.sourcesChanged,
			sources:         this.sources.split(" ").filter(Boolean),
			...(this.sourcesChanged ? {
				old_sources:     this.old_sources.split(" ").filter(Boolean),
				sources_added:   this.addedSources,
				sources_removed: this.removedSources
			} : {}),
			tags_changed: this.tagsChanged,
			tags:         this.tags.split(" ").filter(Boolean),
			...(this.tagsChanged ? {
				old_tags:       this.old_tags.split(" ").filter(Boolean),
				tags_added:     this.addedTags,
				tags_removed:   this.removedTags,
				unchanged_tags: this.tags.split(" ").filter(t => Boolean(t) && !this.addedTags.includes(t))
			} : {}),
			locked_tags_changed: this.lockedTagsChanged,
			locked_tags:         this.locked_tags.split(" ").filter(Boolean),
			...(this.lockedTagsChanged ? {
				old_tags:            this.old_tags.split(" ").filter(Boolean),
				locked_tags_added:   this.addedLockedTags,
				locked_tags_removed: this.removedLockedTags
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
