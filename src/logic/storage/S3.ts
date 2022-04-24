import BaseStorageManager from "./Base";
import NotImplementedError from "../errors/NotImplementedError";
import File from "../../db/Models/File";
import type Post from "../../db/Models/Post";
import Util from "../../util/Util";
import Config from "../../config/index";
import AWS from "aws-sdk";
import { fileTypeFromBuffer } from "file-type";
import { assert } from "tsafe";
import Jimp from "jimp";
import ffmpeg from "fluent-ffmpeg";
import gm from "gm";
import { randomBytes } from "crypto";
import { tmpdir } from "os";
import { readFile, unlink, writeFile } from "fs/promises";
import { Readable } from "stream";
import { exec } from "child_process";
export default class S3StorageManager extends BaseStorageManager {
	private s3Client: AWS.S3;
	private publicBucket: string;
	private privateBucket: string;

	/**
	 * Create an instance of S3StorageManager
	 *
	 * @param endpoint - the s3 endpoint to store files on
	 * @param region - the region of your s3 bucket
	 * @param credentials - your s3 credentials
	 * @param publicBucket - the name of the bucket to store public files in
	 * @param privateBucket - the name of the bucket to store private files in
	 * @param publicURL - the url where public posts are served from
	 * @param protectedURL - the url where protected (deleted, replacements) are served from
	 * @param heirarchical - if files should be stored in a heirarchical path structure (XX/YY/XXYY(..)) - XX and YY being part of the file md5 (protected files will never be heirarchical)
	 * @param extraOptions - extra options to pass to the s3 client
	 */
	constructor(endpoint: string, region: string, credentials: AWS.Credentials, publicBucket: string, privateBucket: string, publicURL: string, protectedURL: string, heirarchical = true, extraOptions: AWS.S3.ClientConfiguration = {}) {
		super(publicURL, protectedURL, heirarchical);
		this.s3Client = new AWS.S3({
			credentials,
			endpoint,
			region,
			...extraOptions
		});
		this.publicBucket = publicBucket;
		this.privateBucket = privateBucket;
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
						fileType.ext === "webm" ? "video" : null);
		assert(type !== null, "unable to determine file type (internal)");
		const protectionType = parsedFlags.REPLACEMENT ? "replacements" : parsedFlags.DELETED ? "deleted" : null;
		const isProtected = parsedFlags.REPLACEMENT || parsedFlags.DELETED;
		const Bucket = isProtected ? this.privateBucket : this.publicBucket;
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

			await this.s3Client.putObject({
				ACL:         "public-read",
				Body:        data,
				Bucket,
				ContentType: fileType.mime,
				Key:         this.key(isProtected, protectionType, hash, fileType.ext)
			}).promise();
			const file = await File.create({
				ext:        fileType.ext,
				flags,
				height,
				md5:        hash,
				is_primary: true,
				mime:       fileType.mime,
				post_id:    postID,
				type:       this.getFileType(fileType.ext),
				width,
				size:       data.length
			});
			files.push(file);

			if (fileType.mime === "image/png") {
				assert(j !== undefined, "failed to retrieve jimp object");
				const [info, jpeg] = await this.convertImage(j.clone(), "jpg");
				const hashJpeg = Util.md5(jpeg);
				await this.s3Client.putObject({
					ACL:         "public-read",
					Body:        jpeg,
					Bucket,
					ContentType: fileType.mime,
					Key:         this.key(isProtected, protectionType, hashJpeg, "jpg")
				}).promise();
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
					parent_id:  file.id,
					size:       jpeg.length
				});
				files.push(jpegFile);
				await this.addToIQDB(postID, jpeg);
			} else if (fileType.mime === "image/jpeg") {
				assert(j !== undefined, "failed to retrieve jimp object");
				const [info, png] = await this.convertImage(j.clone(), "png");
				const hashPng = Util.md5(png);
				await this.s3Client.putObject({
					ACL:         "public-read",
					Body:        png,
					Bucket,
					ContentType: fileType.mime,
					Key:         this.key(isProtected, protectionType, hashPng, "png")
				}).promise();
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
					parent_id:  file.id,
					size:       png.length
				});
				files.push(jpegFile);
				await this.addToIQDB(postID, data); // yes, this is meant to use the provided jpeg
			} else if (fileType.mime === "image/apng") {
				assert(j !== undefined, "failed to retrieve jimp object");
				const [infoJpeg, jpeg] = await this.convertImage(j.clone(), "jpg");
				const hashJpeg = Util.md5(jpeg);
				await this.s3Client.putObject({
					ACL:         "public-read",
					Body:        jpeg,
					Bucket,
					ContentType: fileType.mime,
					Key:         this.key(isProtected, protectionType, hashJpeg, "jpg")
				}).promise();
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
					parent_id:  file.id,
					size:       jpeg.length
				});
				files.push(jpegFile);
				await this.addToIQDB(postID, jpeg);

				const [infoPng, png] = await this.convertImage(j.clone(), "png");
				const hashPng = Util.md5(png);
				await this.s3Client.putObject({
					ACL:         "public-read",
					Body:        png,
					Bucket,
					ContentType: fileType.mime,
					Key:         this.key(isProtected, protectionType, hashPng, "png")
				}).promise();
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
					parent_id:  file.id,
					size:       png.length
				});
				files.push(pngFile);
			} else if (fileType.mime === "image/gif") {
				const fileJpeg = await new Promise<Buffer>((resolve, reject) => gm(data)
					.selectFrame(0)
					.toBuffer("jpg", (err, buf) => err ? reject(err) : resolve(buf)));
				const infoJpeg = await Jimp.read(fileJpeg);
				const hashJpeg = Util.md5(fileJpeg);
				await this.s3Client.putObject({
					ACL:         "public-read",
					Body:        fileJpeg,
					Bucket,
					ContentType: fileType.mime,
					Key:         this.key(isProtected, protectionType, hashJpeg, "jpg")
				}).promise();
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
					parent_id:  file.id,
					size:       fileJpeg.length
				});
				files.push(jpegFile);
				// @TODO do we even want to bother uploading the previews of videos/gifs? it's possible for a lot
				// of their first frames to be pitch black so it may be more hassle than it's worth


				const filePng = await new Promise<Buffer>((resolve, reject) => gm(data)
					.selectFrame(0)
					.toBuffer("png", (err, buf) => err ? reject(err) : resolve(buf)));
				const infoPng = await Jimp.read(filePng);
				const hashPng = Util.md5(filePng);
				await this.s3Client.putObject({
					ACL:         "public-read",
					Body:        filePng,
					Bucket,
					ContentType: fileType.mime,
					Key:         this.key(isProtected, protectionType, hashJpeg, "png")
				}).promise();
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
					parent_id:  file.id,
					size:       filePng.length
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
				await this.s3Client.putObject({
					ACL:         "public-read",
					Body:        fileJpeg,
					Bucket,
					ContentType: fileType.mime,
					Key:         this.key(isProtected, protectionType, hashJpeg, "jpg")
				}).promise();
				await unlink(`${tmpdir()}/${rand}.jpg`);
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
					parent_id:  file.id,
					size:       fileJpeg.length
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
				await this.s3Client.putObject({
					ACL:         "public-read",
					Body:        filePng,
					Bucket,
					ContentType: fileType.mime,
					Key:         this.key(isProtected, protectionType, hashJpeg, "png")
				}).promise();
				await unlink(`${tmpdir()}/${rand}.png`);
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
					parent_id:  file.id,
					size:       filePng.length
				});
				files.push(pngFile);
			} else throw new Error(`Unsupported File Type "${fileType.mime}"`);
		} else throw new Error(`Invalid File Type Recieved "${fileType.mime}"`);

		// @TODO primary flag & generating previews

		return files;
	}

	override async delete(file: File): Promise<boolean> {
		const Bucket = file.isProtected ? this.privateBucket : this.publicBucket;
		const Key = this.key(file.isProtected, file.protectionType, file.md5, file.ext);
		const head = await this.s3Client.headObject({
			Bucket,
			Key
		}).promise().catch(() => null);
		if (head === null) return false;
		await this.s3Client.deleteObject({
			Bucket,
			Key
		}).promise();
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
		return this.s3Client.getObject({
			Bucket: file.isProtected ? this.privateBucket : this.publicBucket,
			Key:    this.key(file.isProtected, file.protectionType, file.md5, file.ext)
		}).promise().then(d => d.Body as Buffer).catch(() => null);
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
