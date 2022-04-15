/* eslint-disable @typescript-eslint/no-unused-vars */
import BaseStorageManager from "./Base";
import type File from "../../db/Models/File";
import type Post from "../../db/Models/Post";

/**
 * This manager should not realistically be used
 */
export default class VoidStorageManager extends BaseStorageManager {
	/**
	 * Create an instance of VoidStorageManager
	 *
	 * @param publicURL - the url where public posts are served from
	 * @param protectedURL - the url where protected (deletions, replacements) are served from
	 * @param heirarchical - if files should be stored in a heirarchical path structure (XX/YY/XXYY(..)) - XX and YY being part of the file md5 (protected files will never be heirarchical)
	 */
	constructor(publicURL: string, protectedURL: string, heirarchical = true) {
		super(publicURL, protectedURL, heirarchical);
	}

	override async store(data: Buffer, postID: number, flags?: number): Promise<Array<File>> {
		return [];
	}

	override async delete(file: File): Promise<boolean> {
		return true;
	}

	override async get(fileOrId: number | File): Promise<Buffer | null> {
		return null;
	}

	override async processPostDeletion(post: Post, undelete: boolean): Promise<void> {
		// ignore
	}

	override async processPostReplacement(post: Post, data: Buffer, direction: "to" | "from"): Promise<void> {
		// ignore
	}
}
