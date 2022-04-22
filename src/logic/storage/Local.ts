import BaseStorageManager from "./Base";
import NotImplementedError from "../errors/NotImplementedError";
import File from "../../db/Models/File";
import type Post from "../../db/Models/Post";
import Util from "../../util/Util";
import Config from "../../config/index";
import { fileTypeFromBuffer } from "file-type";
import { assert } from "tsafe";
import Jimp from "jimp";
import ffmpeg from "fluent-ffmpeg";
import gm from "gm";
import {
	access,
	readFile,
	rename,
	unlink,
	writeFile
} from "fs/promises";
import { exec } from "child_process";
import { Readable } from "stream";
import { randomBytes } from "crypto";
import { tmpdir } from "os";

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
		if (!(await access(this.storageDir).then(() => true, () => false))) await new Promise<void>((resolve, reject) => exec(`mkdir -p ${this.storageDir}`, (err) => err ? reject(err) : resolve()));
		const fileType = await fileTypeFromBuffer(data);
		assert(fileType !== undefined, "unable to determine file type (mime)");
		const parsedFlags = this.parseFlags(flags);
		const files: Array<File> = [];
		const hash = Util.md5(data);
		const protectionType = parsedFlags.REPLACEMENT ? "replacements" : parsedFlags.DELETED ? "deleted" : null;
		const isProtected = parsedFlags.REPLACEMENT || parsedFlags.DELETED;
		if (Config.allowedMimeTypes.includes(fileType.mime)) {
			let width: number, height: number, j: Jimp | undefined;
			if (fileType.mime === "video/webm") {
				const rand = randomBytes(32).toString("hex");
				await writeFile(`${tmpdir()}/${rand}.webm`, data);
				const info = await new Promise<{ width: number; height: number; }>((resolve, reject) => exec(`ffprobe -v error -show_entries stream=width,height -of default=noprint_wrappers=1 ${tmpdir()}/${rand}.webm`, (err, stdout) => {
					if (err) return reject(err);
					const w = Number(stdout.match(/width=(\d+)/)?.[1] || 0);
					const h = Number(stdout.match(/height=(\d+)/)?.[1] || 0);
					resolve({
						width:  w,
						height: h
					});
				}));
				width = info.width;
				height = info.height;
				await unlink(`${tmpdir()}/${rand}.webm`);
			} else {
				j = await Jimp.read(data);
				width = j.bitmap.width;
				height = j.bitmap.height;
			}

			await writeFile(`${this.storageDir}/${this.key(isProtected, protectionType, hash, fileType.ext)}`, data);
			const file = await File.create({
				ext:        fileType.ext,
				flags,
				height,
				md5:        hash,
				is_primary: true,
				mime:       fileType.mime,
				post_id:    postID,
				type:       this.getFileType(fileType.ext),
				width
			});
			files.push(file);

			if (fileType.mime === "image/png") {
				assert(j !== undefined, "failed to retrieve jimp object");
				const [info, jpeg] = await this.convertImage(j.clone(), "jpg");
				const hashJpeg = Util.md5(jpeg);
				await writeFile(`${this.storageDir}/${this.key(isProtected, protectionType, hashJpeg, "jpg")}`, jpeg);
				const jpegFile = await File.create({
					ext:        "jpg",
					flags,
					height:     info.bitmap.height,
					md5:        hashJpeg,
					is_primary: false,
					mime:       "image/jpeg",
					post_id:    postID,
					type:       this.getFileType("jpg"),
					width:      info.bitmap.width,
					parent_id:  file.id
				});
				files.push(jpegFile);
				await this.addToIQDB(postID, jpeg);
			} else if (fileType.mime === "image/jpeg") {
				assert(j !== undefined, "failed to retrieve jimp object");
				const [info, png] = await this.convertImage(j.clone(), "png");
				const hashPng = Util.md5(png);
				await writeFile(`${this.storageDir}/${this.key(isProtected, protectionType, hashPng, "png")}`, png);
				const jpegFile = await File.create({
					ext:        "png",
					flags,
					height:     info.bitmap.height,
					md5:        hashPng,
					is_primary: false,
					mime:       "image/png",
					post_id:    postID,
					type:       this.getFileType("png"),
					width:      info.bitmap.width,
					parent_id:  file.id
				});
				files.push(jpegFile);
				await this.addToIQDB(postID, data); // yes, this is meant to use the provided jpeg
			} else if (fileType.mime === "image/apng") {
				assert(j !== undefined, "failed to retrieve jimp object");
				const [infoJpeg, jpeg] = await this.convertImage(j.clone(), "jpg");
				const hashJpeg = Util.md5(jpeg);
				await writeFile(`${this.storageDir}/${this.key(isProtected, protectionType, hashJpeg, "jpg")}`, jpeg);
				const jpegFile = await File.create({
					ext:        "jpg",
					flags,
					height:     infoJpeg.bitmap.height,
					md5:        hashJpeg,
					is_primary: false,
					mime:       "image/jpeg",
					post_id:    postID,
					type:       this.getFileType("jpg"),
					width:      infoJpeg.bitmap.width,
					parent_id:  file.id
				});
				files.push(jpegFile);
				await this.addToIQDB(postID, jpeg);

				const [infoPng, png] = await this.convertImage(j.clone(), "png");
				const hashPng = Util.md5(png);
				await writeFile(`${this.storageDir}/${this.key(isProtected, protectionType, hashPng, "png")}`, png);
				const pngFile = await File.create({
					ext:        "png",
					flags,
					height:     infoPng.bitmap.height,
					md5:        hashPng,
					is_primary: false,
					mime:       "image/png",
					post_id:    postID,
					type:       this.getFileType("png"),
					width:      infoPng.bitmap.width,
					parent_id:  file.id
				});
				files.push(pngFile);
			} else if (fileType.mime === "image/gif") {
				const fileJpeg = await new Promise<Buffer>((resolve, reject) => gm(data)
					.selectFrame(0)
					.toBuffer("jpg", (err, buf) => err ? reject(err) : resolve(buf)));
				const infoJpeg = await Jimp.read(fileJpeg);
				const hashJpeg = Util.md5(fileJpeg);
				await writeFile(`${this.storageDir}/${this.key(isProtected, protectionType, hashJpeg, "jpg")}`, fileJpeg);
				const jpegFile = await File.create({
					ext:        "jpg",
					flags,
					height:     infoJpeg.bitmap.height,
					md5:        hashJpeg,
					is_primary: false,
					mime:       "image/jpeg",
					post_id:    postID,
					type:       this.getFileType("jpg"),
					width:      infoJpeg.bitmap.width,
					parent_id:  file.id
				});
				files.push(jpegFile);
				// @TODO do we even want to bother uploading the previews of videos/gifs? it's possible for a lot
				// of their first frames to be pitch black so it may be more hassle than it's worth

				const filePng = await new Promise<Buffer>((resolve, reject) => gm(data)
					.selectFrame(0)
					.toBuffer("png", (err, buf) => err ? reject(err) : resolve(buf)));
				const infoPng = await Jimp.read(filePng);
				const hashPng = Util.md5(filePng);
				await writeFile(`${this.storageDir}/${this.key(isProtected, protectionType, hashPng, "png")}`, filePng);
				const pngFile = await File.create({
					ext:        "png",
					flags,
					height:     infoPng.bitmap.height,
					md5:        hashPng,
					is_primary: false,
					mime:       "image/png",
					post_id:    postID,
					type:       this.getFileType("png"),
					width:      infoPng.bitmap.width,
					parent_id:  file.id
				});
				files.push(pngFile);
			} else if (fileType.mime === "video/webm") {
				const rand = randomBytes(32).toString("hex");

				await new Promise<void>((resolve) => ffmpeg(Readable.from(data))
					.frames(1)
					.output(`${tmpdir()}/${rand}.jpg`)
					.on("end", resolve)
					.run()
				);
				const fileJpeg = await readFile(`${tmpdir()}/${rand}.jpg`);
				const infoJpeg = await Jimp.read(fileJpeg);
				const hashJpeg = Util.md5(fileJpeg);
				await rename(`${tmpdir()}/${rand}.jpg`, `${this.storageDir}/${this.key(isProtected, protectionType, hashJpeg, "jpg")}`);
				const jpegFile = await File.create({
					ext:        "jpg",
					flags,
					height:     infoJpeg.bitmap.height,
					md5:        hashJpeg,
					is_primary: false,
					mime:       "image/jpeg",
					post_id:    postID,
					type:       this.getFileType("jpg"),
					width:      infoJpeg.bitmap.width,
					parent_id:  file.id
				});
				files.push(jpegFile);
				// @TODO do we even want to bother uploading the previews of videos/gifs? it's possible for a lot
				// of their first frames to be pitch black so it may be more hassle than it's worth

				await new Promise<void>((resolve) => ffmpeg(Readable.from(data))
					.frames(1)
					.output(`${tmpdir()}/${rand}.png`)
					.on("end", resolve)
					.run()
				);

				const filePng = await readFile(`${tmpdir()}/${rand}.png`);
				const infoPng = await Jimp.read(filePng);
				const hashPng = Util.md5(filePng);
				await rename(`${tmpdir()}/${rand}.png`, `${this.storageDir}/${this.key(isProtected, protectionType, hashPng, "png")}`);
				const pngFile = await File.create({
					ext:        "png",
					flags,
					height:     infoPng.bitmap.height,
					md5:        hashPng,
					is_primary: false,
					mime:       "image/png",
					post_id:    postID,
					type:       this.getFileType("png"),
					width:      infoPng.bitmap.width,
					parent_id:  file.id
				});
				files.push(pngFile);
			} else throw new Error(`Unsupported File Type "${fileType.mime}"`);
		} else throw new Error(`Invalid File Type Recieved "${fileType.mime}"`);

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
