import type File from "../../db/Models/File";
import { FileFlags } from "../../db/Models/File";
import type Post from "../../db/Models/Post";
import Jimp from "jimp";

export default abstract class BaseStorageManager {
	private publicURL: string;
	private protectedURL: string;
	protected heirarchical: boolean;
	constructor(publicURL: string, protectedURL: string, heirarchical = true) {
		this.publicURL = publicURL;
		this.protectedURL = protectedURL;
		this.heirarchical = heirarchical;
	}

	key(isPrivate: boolean, privateType: string | null, md5: string, ext: string) {
		return isPrivate ? `${privateType!}/${md5}.${ext}` : this.heirarchical ? `${md5.slice(0, 2)}/${md5.slice(2, 4)}/${md5}.${ext}` : `${md5}.${ext}`;
	}

	fileURL(isPrivate: boolean, privateType: string | null, md5: string, ext: string) {
		return `${isPrivate ? this.protectedURL : this.publicURL}/${this.key(isPrivate, privateType, md5, ext)}`;
	}

	// @TODO file previews
	abstract store(data: Buffer, postID: number, flags?: number): Promise<Array<File>>;
	abstract delete(file: File): Promise<boolean>;
	abstract get(fileOrId: File | number): Promise<Buffer | null>;
	abstract processPostDeletion(post: Post, undelete: boolean): Promise<void>;
	// to = replacement into post, from = post to replacement
	abstract processPostReplacement(post: Post, data: Buffer, direction: "to" | "from"): Promise<void>;

	protected parseFlags(flags: number) { return Object.entries(FileFlags).map(([key, value]) => ({ [key]: (flags & value) === value })).reduce((a, b) => ({ ...a, ...b }), {}) as Record<keyof typeof FileFlags, boolean>;}

	protected async convertImage(data: Buffer | Jimp, type: "png" | "jpg"): Promise<[Jimp, Buffer]> {
		const j = (Buffer.isBuffer(data) ? await Jimp.read(data) : data);
		return [j, await j.getBufferAsync(type === "png" ? Jimp.MIME_PNG : type === "jpg" ? Jimp.MIME_JPEG : "")];
	}
}
