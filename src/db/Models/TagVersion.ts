import User from "./User";
import Util from "../../util/Util";
import db from "..";
import { assert } from "tsafe";

export interface TagVersionData {
	id: number;
	// this shouldn't practically be null but db limitations require it to be nullable
	tag_id: number;
	name: string;
	created_at: string;
	updater_id: number;
	updater_ip_address: string | null;
	revision: number;
	category: number;
	old_category: number | null;
	locked: boolean;
	old_locked: boolean | null;
}
export type TagVersionCreationRequired = Pick<TagVersionData, "updater_id" | "updater_ip_address">;
export type TagVersionCreationIgnored = "id" | "created_at";
export type TagVersionCreationData = TagVersionCreationRequired & Partial<Omit<TagVersionData, keyof TagVersionCreationRequired | TagVersionCreationIgnored>>;

export default class TagVersion implements TagVersionData {
	static TABLE = "tag_versions";
	id: number;
	name: string;
	tag_id: number;
	created_at: string;
	updater_id: number;
	updater_ip_address: string | null;
	revision: number;
	category: number;
	old_category: number | null;
	locked: boolean;
	old_locked: boolean | null;
	constructor(data: TagVersionData) {
		assert(data.tag_id !== null, `received null tag id in tag version #${data.id}`);
		this.id                 = data.id;
		this.name               = data.name;
		this.tag_id             = data.tag_id;
		this.created_at         = data.created_at;
		this.updater_id         = data.updater_id;
		this.updater_ip_address = data.updater_ip_address;
		this.revision           = data.revision;
		this.category           = data.category;
		this.old_category       = data.old_category;
		this.locked             = data.locked;
		this.old_locked         = data.old_locked;
	}

	static async get(id: number | bigint) {
		const [res] = await db.query<Array<TagVersionData>>(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
		if (!res) return null;
		return new TagVersion(res);
	}

	static async getForTagAndRevision(tag: number, revision: number) {

		const [res] = await db.query<Array<TagVersionData>>(`SELECT * FROM ${this.TABLE} WHERE tag_id = ? AND revision = ?`, [tag, revision]);
		if (!res) return null;
		return new TagVersion(res);
	}

	static async getForTagNameAndRevision(tag: string, revision: number) {

		const [res] = await db.query<Array<TagVersionData>>(`SELECT * FROM ${this.TABLE} WHERE name = ? AND revision = ?`, [tag, revision]);
		if (!res) return null;
		return new TagVersion(res);
	}

	static async getForTag(tag: number) {
		const res = await db.query<Array<TagVersionData>>(`SELECT * FROM ${this.TABLE} WHERE tag_id = ?`, [tag]);
		return res.map(p => new TagVersion(p));
	}

	static async getForTagName(tag: string) {
		const res = await db.query<Array<TagVersionData>>(`SELECT * FROM ${this.TABLE} WHERE name = ?`, [tag]);
		return res.map(p => new TagVersion(p));
	}

	static async create(data: TagVersionCreationData, defer: true): Promise<number>;
	static async create(data: TagVersionCreationData, defer?: false): Promise<TagVersion>;
	static async create(data: TagVersionCreationData, defer = false) {
		Util.removeUndefinedKeys(data);
		const res = await db.insert(this.TABLE, data, true);
		if (defer) return res.insertId;
		const createdObject = await this.get(res.insertId);
		assert(createdObject !== null, "failed to create new Tag object");
		return createdObject;
	}

	static async delete(id: number | bigint) {
		const res = await db.delete(this.TABLE, id);
		return res.affectedRows > 0;
	}


	static async edit(id: number | bigint, data: Omit<Partial<TagVersionData>, "id">) {
		return Util.genericEdit(TagVersion, this.TABLE, id, data);
	}

	get categoryChanged() { return Boolean(this.old_category && this.category !== this.old_category); }
	get lockedChanged() { return Boolean(this.old_locked && this.locked !== this.old_locked); }

	async delete() {
		return TagVersion.delete(this.id);
	}

	async edit(data: Omit<Partial<TagVersionData>, "id">) {
		Object.assign(this, Util.removeUndefinedKV(data));
		return TagVersion.edit(this.id, data);
	}


	async toJSON() {
		return {
			id:               this.id,
			tag_id:           this.tag_id,
			updater_id:       this.updater_id,
			updater_name:     await User.idToName(this.updater_id),
			category_changed: this.categoryChanged,
			category:         this.category,
			...(this.categoryChanged ? {
				old_category: this.old_category
			} : {}),
			locked_changed: this.lockedChanged,
			locked:         this.locked,
			...(this.lockedChanged ? {
				old_locked: this.old_locked
			} : {})
		};
	}
}
