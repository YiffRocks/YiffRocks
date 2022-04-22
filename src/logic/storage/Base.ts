import type File from "../../db/Models/File";
import { FileFlags } from "../../db/Models/File";
import type Post from "../../db/Models/Post";
import IQDB from "../IQDB";
import Jimp from "jimp";

/** Storage managers should extend this. */
export default abstract class BaseStorageManager {
	private publicURL: string;
	private protectedURL: string;
	protected heirarchical: boolean;
	/**
	 * Create an instance of BaseStorageManager
	 *
	 * @param publicURL - the url where public posts are served from
	 * @param protectedURL - the url where protected (deleted, replacements) are served from
	 * @param heirarchical - if files should be stored in a heirarchical path structure (XX/YY/XXYY(..)) - XX and YY being part of the file md5 (protected files will never be heirarchical)
	 */
	constructor(publicURL: string, protectedURL: string, heirarchical = true) {
		this.publicURL = publicURL;
		this.protectedURL = protectedURL;
		this.heirarchical = heirarchical;
	}

	/**
	 * Get the "key" or location where a specific file will be stored
	 *
	 * @param isProtected - if this file is protected (deletion, replacement)
	 * @param protectionType - the type of protection for this file (null, deleted, replacement)
	 * @param md5 - the md5 hash of the file
	 * @param ext - the extension of the file
	 * @returns
	 */
	key(isProtected: boolean, protectionType: string | null, md5: string, ext: string) {
		return isProtected ? `${protectionType!}/${md5}.${ext}` : this.heirarchical ? `${md5.slice(0, 2)}/${md5.slice(2, 4)}/${md5}.${ext}` : `${md5}.${ext}`;
	}

	/**
	 * Get a full url to a file
	 *
	 * @param isProtected - if this file is protected (deletion, replacement)
	 * @param protectionType - the type of protection for this file (null, deleted, replacement)
	 * @param md5 - the md5 hash of the file
	 * @param ext - the extension of the file
	 * @returns
	 */
	fileURL(isProtected: boolean, protectionType: string | null, md5: string, ext: string) {
		return `${isProtected ? this.protectedURL : this.publicURL}/${this.key(isProtected, protectionType, md5, ext)}`;
	}

	// @TODO file previews
	/**
	 * put a file into storage
	 *
	 * @param data - the raw file
	 * @param postID - the post id this file is related to
	 * @param flags - the flags of this file - preview, deleted, replacement, etc
	 */
	abstract store(data: Buffer, postID: number, flags?: number): Promise<Array<File>>;

	/**
	 * remove a file from storage
	 *
	 * @param file - the file to delete
	 */
	abstract delete(file: File): Promise<boolean>;

	/**
	 * Get a raw file
	 *
	 * @param fileOrId - the file or id to get
	 */
	abstract get(fileOrId: File | number): Promise<Buffer | null>;

	/**
	 * Process a post deletion (UNFINISHED)
	 *
	 * @param post - the post to process
	 * @param undelete - if we're deleting or undeleting
	 */
	abstract processPostDeletion(post: Post, undelete: boolean): Promise<void>;

	/**
	 * Process a post replacement (UNFINISHED)
	 *
	 * @param post - the post to process
	 * @param data - the new file
	 * @param direction - the direction we're making the replacement, to = replacement into post, from = post to replacement
	 */
	abstract processPostReplacement(post: Post, data: Buffer, direction: "to" | "from"): Promise<void>;

	/**
	 * parse a file's flags into an object form
	 *
	 * @param flags - the flags to parse
	 * @returns
	 */
	protected parseFlags(flags: number) { return Object.entries(FileFlags).map(([key, value]) => ({ [key]: (flags & value) === value })).reduce((a, b) => ({ ...a, ...b }), {}) as Record<keyof typeof FileFlags, boolean>;}

	/**
	 * convert an image into various formats
	 *
	 * @param data - the image data to convert
	 * @param type - the type to convert into
	 * @returns
	 */
	protected async convertImage(data: Buffer | Jimp, type: "png" | "jpg"): Promise<[Jimp, Buffer]> {
		const j = (Buffer.isBuffer(data) ? await Jimp.read(data) : data);
		return [j, await j.getBufferAsync(type === "png" ? Jimp.MIME_PNG : type === "jpg" ? Jimp.MIME_JPEG : "")];
	}

	protected getFileType(ext: string) {
		return (
			ext === "png" ? "png" :
				ext === "apng" ? "apng" :
					ext === "jpg" ? "jpg" :
						ext === "gif" ? "gif" :
							ext === "webm" ? "video" : "unknown");
	}

	protected async addToIQDB(post_id: number, data: Buffer) {
		return IQDB.add(post_id, data);
	}
}
