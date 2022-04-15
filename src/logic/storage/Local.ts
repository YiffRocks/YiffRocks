import BaseStorageManager from "./Base";
import NotImplementedError from "../errors/NotImplementedError";
import File from "../../db/Models/File";
import type Post from "../../db/Models/Post";
import Util from "../../util/Util";
import Config from "../../config/index";
import { fileTypeFromBuffer } from "file-type";
import { assert } from "tsafe";
import Jimp from "jimp";
import { access, readFile, unlink, writeFile } from "fs/promises";

export default class LocalStorageManager extends BaseStorageManager {
	protected storageDir: string;
	/**
	 * Create an instance of LocalStorageManager
	 *
	 * @param storageDir - the base directory to store files in
	 * @param publicURL - the url where public posts are served from
	 * @param protectedURL - the url where protected (deleted, replacements) are served from
	 * @param heirarchical - if files should be stored in a heirarchical path structure (XX/YY/XXYY(..)) - XX and YY being part of the file md5 (protected files will never be heirarchical)
	 */
	constructor(storageDir: string, publicURL: string, protectedURL: string, heirarchical = true) {
		super(publicURL, protectedURL, heirarchical);
		this.storageDir = storageDir;
		this.heirarchical = heirarchical;
	}

	override async store(data: Buffer, postID: number, flags = 0) {
		const fileType = await fileTypeFromBuffer(data);
		assert(fileType !== undefined, "unable to determine file type (mime)");
		const parsedFlags = this.parseFlags(flags);
		const files: Array<File> = [];
		const hash = Util.md5(data);
		const type = (fileType.ext === "png" ? "png" :
			fileType.ext === "apng" ? "apng" :
				fileType.ext === "jpg" ? "jpg" :
					fileType.ext === "gif" ? "gif" :
						fileType.ext === "mp4" ? "video" : null);
		assert(type !== null, "unable to determine file type (internal)");
		const protectionType = parsedFlags.REPLACEMENT ? "replacements" : parsedFlags.DELETED ? "deleted" : null;
		const isProtected = parsedFlags.REPLACEMENT || parsedFlags.DELETED;
		if (Config.allowedMimeTypes.includes(fileType.mime)) {
			const j = await Jimp.read(data);
			await writeFile(`${this.storageDir}/${this.key(isProtected, protectionType, hash, fileType.ext)}`, data);
			const file = await File.create({
				ext:     fileType.ext,
				flags,
				height:  j.bitmap.height,
				md5:     hash,
				mime:    fileType.mime,
				post_id: postID,
				type,
				width:   j.bitmap.width
			});
			files.push(file);

			if (fileType.mime === "image/png") {
				const [info, jpeg] = await this.convertImage(j.clone(), "jpg");
				const hashJpeg = Util.md5(jpeg);
				await writeFile(`${this.storageDir}/${this.key(isProtected, protectionType, hashJpeg, "jpg")}`, data);
				const jpegFile = await File.create({
					ext:     info.getExtension(),
					flags,
					height:  info.bitmap.height,
					md5:     hashJpeg,
					mime:    info.getMIME(),
					post_id: postID,
					type,
					width:   info.bitmap.width,
					parent:  file.id
				});
				files.push(jpegFile);
			} else if (fileType.mime === "image/jpeg") {
				const [info, png] = await this.convertImage(j.clone(), "png");
				const hashPng = Util.md5(png);
				await writeFile(`${this.storageDir}/${this.key(isProtected, protectionType, hashPng, "png")}`, data);
				const jpegFile = await File.create({
					ext:     info.getExtension(),
					flags,
					height:  info.bitmap.height,
					md5:     hashPng,
					mime:    info.getMIME(),
					post_id: postID,
					type,
					width:   info.bitmap.width,
					parent:  file.id
				});
				files.push(jpegFile);
			} else if (fileType.mime === "image/apng") {
				const [infoJpeg, jpeg] = await this.convertImage(j.clone(), "jpg");
				const hashJpeg = Util.md5(jpeg);
				await writeFile(`${this.storageDir}/${this.key(isProtected, protectionType, hashJpeg, infoJpeg.getExtension())}`, data);
				const jpegFile = await File.create({
					ext:     infoJpeg.getExtension(),
					flags,
					height:  infoJpeg.bitmap.height,
					md5:     hashJpeg,
					mime:    infoJpeg.getMIME(),
					post_id: postID,
					type,
					width:   infoJpeg.bitmap.width,
					parent:  file.id
				});
				files.push(jpegFile);

				const [infoPng, png] = await this.convertImage(j.clone(), "png");
				const hashPng = Util.md5(png);
				await writeFile(`${this.storageDir}/${this.key(isProtected, protectionType, hashPng, infoJpeg.getExtension())}`, data);
				const pngFile = await File.create({
					ext:     infoPng.getExtension(),
					flags,
					height:  infoPng.bitmap.height,
					md5:     hashJpeg,
					mime:    infoPng.getMIME(),
					post_id: postID,
					type,
					width:   infoPng.bitmap.width,
					parent:  file.id
				});
				files.push(pngFile);
			} else throw new Error(`Unknown Image Type "${fileType.mime}"`);
		} else {
			// @TODO videos
		}

		// @TODO primary flag & generating previews

		return files;
	}

	override async delete(file: File): Promise<boolean> {
		const key = this.key(file.isProtected, file.protectionType, file.md5, file.ext);
		const exists = await access(`${this.storageDir}/${key}`).then(() => true, () => false);
		if (!exists) return false;
		await unlink(`${this.storageDir}/${key}`);
		return true;
	}

	override async get(fileOrID: File | number) {
		let file: File | undefined;
		if (typeof fileOrID === "number") {
			const getFile = await File.get(fileOrID);
			assert(getFile !== null, "Invalid file id provided.");
			file = getFile;
		} else file = fileOrID;
		assert(file !== undefined, "failed to recognize a valid file.");
		const key = this.key(file.isProtected, file.protectionType, file.md5, file.ext);
		const exists = await access(`${this.storageDir}/${key}`).then(() => true, () => false);
		if (!exists) return null;
		return readFile(`${this.storageDir}/${key}`);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	override async processPostDeletion(post: Post, undelete: boolean) {
		throw new NotImplementedError("S3#processPostDeletion");
	}

	// to = replacement into post, from = post to replacement
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	override async processPostReplacement(post: Post, data: Buffer, direction: "to" | "from") {
		throw new NotImplementedError("S3#processPostReplacement");
	}
}
