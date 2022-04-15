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
export default class S3StorageManager extends BaseStorageManager {
	private s3Client: AWS.S3;
	private publicBucket: string;
	private privateBucket: string;
	constructor(endpoint: string, region: string, credentials: AWS.Credentials, publicBucket: string, privateBucket: string, publicURL: string, protectedURL: string, heirarchical = true, extraOptions: AWS.S3.ClientConfiguration = {}) {
		super(publicURL, protectedURL, heirarchical);
		this.s3Client = new AWS.S3({
			endpoint,
			region,
			credentials,
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
						fileType.ext === "mp4" ? "video" : null);
		assert(type !== null, "unable to determine file type (internal)");
		const privateType = parsedFlags.REPLACEMENT ? "replacements" : parsedFlags.DELETED ? "deleted" : null;
		const isPrivate = parsedFlags.REPLACEMENT || parsedFlags.DELETED;
		const Bucket = isPrivate ? this.privateBucket : this.publicBucket;
		if (Config.allowedMimeTypes.includes(fileType.mime)) {
			const j = await Jimp.read(data);
			await this.s3Client.putObject({
				Bucket,
				ACL:         "public-read",
				Key:         this.key(isPrivate, privateType, hash, fileType.ext),
				Body:        data,
				ContentType: fileType.mime
			}).promise();
			const file = await File.create({
				post_id: postID,
				md5:     hash,
				type,
				mime:    fileType.mime,
				ext:     fileType.ext,
				width:   j.bitmap.width,
				height:  j.bitmap.height,
				flags
			});
			files.push(file);

			if (fileType.mime === "image/png") {
				const [info, jpeg] = await this.convertImage(j.clone(), "jpg");
				const hashJpeg = Util.md5(jpeg);
				await this.s3Client.putObject({
					Bucket,
					ACL:         "public-read",
					Key:         this.key(isPrivate, privateType, hashJpeg, "jpg"),
					Body:        jpeg,
					ContentType: fileType.mime
				}).promise();
				const jpegFile = await File.create({
					post_id: postID,
					md5:     hashJpeg,
					type,
					mime:    fileType.mime,
					ext:     "jpg",
					width:   info.bitmap.width,
					height:  info.bitmap.height,
					flags
				});
				files.push(jpegFile);
			} else if (fileType.mime === "image/jpeg") {
				const [info, png] = await this.convertImage(j.clone(), "png");
				const hashPng = Util.md5(png);
				await this.s3Client.putObject({
					Bucket,
					ACL:         "public-read",
					Key:         this.key(isPrivate, privateType, hashPng, "png"),
					Body:        png,
					ContentType: fileType.mime
				}).promise();
				const jpegFile = await File.create({
					post_id: postID,
					md5:     hashPng,
					type,
					mime:    fileType.mime,
					ext:     "png",
					width:   info.bitmap.width,
					height:  info.bitmap.height,
					flags
				});
				files.push(jpegFile);
			} else if (fileType.mime === "image/apng") {
				const [infoJpeg, jpeg] = await this.convertImage(j.clone(), "jpg");
				const hashJpeg = Util.md5(jpeg);
				await this.s3Client.putObject({
					Bucket,
					ACL:         "public-read",
					Key:         this.key(isPrivate, privateType, hashJpeg, "jpg"),
					Body:        jpeg,
					ContentType: fileType.mime
				}).promise();
				const jpegFile = await File.create({
					post_id: postID,
					md5:     hashJpeg,
					type,
					mime:    fileType.mime,
					ext:     "jpg",
					width:   infoJpeg.bitmap.width,
					height:  infoJpeg.bitmap.height,
					flags
				});
				files.push(jpegFile);

				const [infoPng, png] = await this.convertImage(j.clone(), "png");
				const hashPng = Util.md5(png);
				await this.s3Client.putObject({
					Bucket,
					ACL:         "public-read",
					Key:         this.key(isPrivate, privateType, hashPng, "png"),
					Body:        png,
					ContentType: fileType.mime
				}).promise();
				const pngFile = await File.create({
					post_id: postID,
					md5:     hashPng,
					type,
					mime:    fileType.mime,
					ext:     "jpg",
					width:   infoPng.bitmap.width,
					height:  infoPng.bitmap.height,
					flags
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
		const Bucket = file.isPrivate ? this.privateBucket : this.publicBucket;
		const Key = this.key(file.isPrivate, file.privateType, file.md5, file.ext);
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
			Bucket: file.isPrivate ? this.privateBucket : this.publicBucket,
			Key:    this.key(file.isPrivate, file.privateType, file.md5, file.ext)
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
