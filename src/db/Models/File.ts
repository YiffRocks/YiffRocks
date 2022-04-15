import Post from "./Post";
import db from "..";
import Util from "../../util/Util";
import Config from "../../config";
import { assert } from "tsafe";

export interface FileData {
	id: number;
	created_at: string;
	updated_at: string;
	post_id: number;
	md5: string;
	primary: boolean;
	type: "png" | "apng" | "jpg" | "gif" | "video" | "unknown";
	mime: string;
	ext: string;
	width: number;
	height: number;
	flags: number;
	// the parent of this file, if not primary (typically conversions or previews)
	parent: number;
}
export type FileCreationRequired = Pick<FileData, "post_id" | "md5" | "type" | "mime" | "ext" | "width" | "height">;
export type FileCreationIgnored = "id" | "created_at" | "updated_at";
export type FileCreationData = FileCreationRequired & Partial<Omit<FileData, keyof FileCreationRequired | FileCreationIgnored>>;


export const FileFlags = {
	PREVIEW:     1 << 0,
	REPLACEMENT: 1 << 1,
	DELETED:     1 << 2
};

export default class File implements FileData {
	static TABLE = "files";
	id: number;
	created_at: string;
	updated_at: string;
	post_id: number;
	md5: string;
	primary: boolean;
	type: "png" | "apng" | "jpg" | "gif" | "video" | "unknown";
	mime: string;
	ext: string;
	width: number;
	height: number;
	flags: number;
	parent: number;
	constructor(data: FileData) {
		this.id         = data.id;
		this.created_at = data.created_at;
		this.updated_at = data.updated_at;
		this.post_id    = data.post_id;
		this.md5        = data.md5;
		this.primary    = data.primary;
		this.type       = data.type;
		this.mime       = data.mime;
		this.ext        = data.ext;
		this.width      = data.width;
		this.height     = data.height;
		this.flags      = data.flags;
		this.parent     = data.parent;
	}

	static async get(id: number) {
		const [res] = await db.query<Array<FileData>>(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
		if (!res) return null;
		return new File(res);
	}

	static async getByMD5(md5: string) {
		const [res] = await db.query<Array<FileData>>(`SELECT * FROM ${this.TABLE} WHERE md5 = ?`, [md5]);
		if (!res) return null;
		return new File(res);
	}

	static async delete(id: number) {
		const res = await db.delete(this.TABLE, id);
		return res.affectedRows > 0;
	}

	static async create(data: FileCreationData) {
		Util.removeUndefinedKeys(data);
		const res = await db.insert(this.TABLE, data, true);
		const createdObject = await this.get(res.insertId);
		assert(createdObject !== null, "failed to create new file object");
		return createdObject;
	}

	static async edit(id: number, data: Omit<Partial<FileData>, "id">) {
		return Util.genericEdit(File, this.TABLE, id, data);
	}

	static async getFilesForPost(id: number) {
		const res = await db.query<Array<FileData>>(`SELECT * FROM ${this.TABLE} WHERE post_id = ?`, [id]);
		return res.map(r => new File(r));
	}
	async edit(data: Omit<Partial<FileData>, "id">) {
		Object.assign(this, Util.removeUndefinedKV(data));
		return File.edit(this.id, data);
	}


	get parsedFlags() {
		return Object.entries(FileFlags).map(([key, value]) => ({ [key]: (this.flags & value) === value })).reduce((a, b) => ({ ...a, ...b }), {}) as Record<keyof typeof FileFlags, boolean>;
	}

	get isProtected() {
		return this.isReplacement || this.isDeleted;
	}

	get isPreview() { return Util.checkFlag(FileFlags.PREVIEW, this.flags); }
	get isReplacement() { return Util.checkFlag(FileFlags.REPLACEMENT, this.flags); }
	get isDeleted() { return Util.checkFlag(FileFlags.DELETED, this.flags); }
	get protectionType() { return this.isReplacement ? "replacements" : this.isDeleted ? "deleted" : null; }

	get url() {
		return Config.constructFileURL(this.isProtected, this.protectionType, this.md5, this.ext);
	}

	async getPost() {
		return Post.get(this.post_id);
	}


	toJSON() {
		return {
			id:      this.id,
			post_id: this.post_id,
			md5:     this.md5,
			primary: this.primary,
			type:    this.type,
			mime:    this.mime,
			ext:     this.ext,
			width:   this.width,
			height:  this.height,
			file:    Util.lowercaseKeys(this.parsedFlags)
		};
	}
}
