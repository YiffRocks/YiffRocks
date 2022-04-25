import Post from "./Post";
import db from "..";
import Util from "../../util/Util";
import Config from "../../config";
import { assert } from "tsafe";

export interface FileData {
	id: number;
	created_at: string;
	updated_at: string | null;
	post_id: number;
	md5: string;
	// primary is reserved in sql
	is_primary: boolean;
	type: "png" | "apng" | "jpg" | "gif" | "video" | "unknown";
	mime: string;
	ext: string;
	width: number;
	height: number;
	flags: number;
	// the parent of this file, if not primary (typically conversions or previews)
	parent_id: number;
	size: number;
}
export type FileCreationRequired = Pick<FileData, "post_id" | "md5" | "type" | "mime" | "ext" | "width" | "height" | "size">;
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
	updated_at: string | null;
	post_id: number;
	md5: string;
	is_primary: boolean;
	type: "png" | "apng" | "jpg" | "gif" | "video" | "unknown";
	mime: string;
	ext: string;
	width: number;
	height: number;
	flags: number;
	parent_id: number;
	size: number;
	constructor(data: FileData) {
		this.id         = data.id;
		this.created_at = data.created_at;
		this.updated_at = data.updated_at;
		this.post_id    = data.post_id;
		this.md5        = data.md5;
		this.is_primary = Boolean(data.is_primary);
		this.type       = data.type;
		this.mime       = data.mime;
		this.ext        = data.ext;
		this.width      = data.width;
		this.height     = data.height;
		this.flags      = data.flags;
		this.parent_id  = data.parent_id;
		this.size       = data.size;
	}

	static async get(id: number) {
		const { rows: [res] } = await db.query<FileData>(`SELECT * FROM ${this.TABLE} WHERE id = $1`, [id]);
		if (!res) return null;
		return new File(res);
	}

	static async getByMD5(md5: string) {
		const { rows: [res] } = await db.query<FileData>(`SELECT * FROM ${this.TABLE} WHERE md5 = $1`, [md5]);
		console.log(res);
		if (!res) return null;
		return new File(res);
	}

	static async getBulk(files: Array<number>) {
		const { rows: res } = await db.query<FileData>(`SELECT * FROM ${this.TABLE} WHERE id = ANY(ARRAY[${files.join(",")}])`);
		return res.map(f => new File(f));
	}

	static async delete(id: number) {
		return db.delete(this.TABLE, id);
	}

	static async create(data: FileCreationData) {
		Util.removeUndefinedKeys(data);
		const res = await db.insert<number>(this.TABLE, data);
		const createdObject = await this.get(res);
		assert(createdObject !== null, "failed to create new file object");
		return createdObject;
	}

	static async edit(id: number, data: Omit<Partial<FileData>, "id">) {
		return Util.genericEdit(File, this.TABLE, id, data);
	}

	static async getFilesForPost(id: number) {
		const { rows: res } = await db.query<FileData>(`SELECT * FROM ${this.TABLE} WHERE post_id = $1`, [id]);
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

	// JSON.stringify uses toJSON if present
	getRawData() {
		return Object.entries(this).map(([key, value]) => ({ [key]: value as unknown })).reduce((a, b) => ({ ...a, ...b }), {});
	}

	toJSON() {
		return {
			id:        this.id,
			post_id:   this.post_id,
			parent_id: this.parent_id,
			md5:       this.md5,
			primary:   this.is_primary,
			type:      this.type,
			mime:      this.mime,
			ext:       this.ext,
			width:     this.width,
			height:    this.height,
			flags:     Util.lowercaseKeys(this.parsedFlags),
			url:       this.url
		};
	}
}
