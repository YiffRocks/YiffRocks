import PrivateConfig from "./private";
import pkg from "../../package.json";
import S3StorageManager from "../logic/storage/S3";
import type BaseStorageManager from "../logic/storage/Base";
import LocalStorageManager from "../logic/storage/Local";
import { TagCategories, TagRestrictions } from "../db/Models/Tag";
import AWS from "aws-sdk";
import session from "express-session";
import { tmpdir } from "os";

// put values that should be hidden in private.ts, you can either add a getter here that returns the super value, or just keep it entirely hidden

export default class Config extends PrivateConfig {
	static get isDevelopment() {
		return true;
	}

	static get siteName() {
		return "Yiff Rocks";
	}

	static get siteDescription() {
		return "An image board made by furries, for furries.";
	}

	/* api */
	static get apiHost() {
		return "127.0.0.1";
	}

	static get apiPort() {
		return 3333;
	}

	static get apiPublicSecure() {
		return true;
	}

	static get apiPublicHost() {
		return "localhost";
	}

	static get apiPublicPort() {
		return 3333;
	}

	static get cookieSecret() {
		return super.cookieSecret;
	}

	/* storage */
	static get tmpDir() {
		return tmpdir();
	}

	static get uploadDir() {
		return `${this.tmpDir}/uploads`;
	}

	static get storageManager(): BaseStorageManager {
		if (this.isDevelopment) return new LocalStorageManager(`${this.tmpDir}/public`, this.cdnPublicURL, this.cdnProtectedURL, false);
		else return new S3StorageManager(this.s3EndpointURL, this.s3Region, new AWS.Credentials({
			accessKeyId:     this.s3AccesskeyID,
			secretAccessKey: this.s3SecretAccessKey
		}), this.s3Bucket, this.s3ProtectedBucket, this.cdnPublicURL, this.cdnProtectedURL, true);
	}

	static get constructFileURL() { return this.storageManager.fileURL.bind(this.storageManager); }

	static get cdnPublicURL() {
		return "https://cdn.yiff.rocks";
	}

	static get cdnProtectedURL() {
		return "https://protected.cdn.yiff.rocks";
	}

	static get fileTypes(): Array<[mime: string, ext: string]> {
		return [
			["image/png", "png"],
			["image/jpeg", "jpg"],
			["image/apng", "apng"],
			["image/gif", "gif"],
			["video/webm", "webm"]
		];
	}

	static get allowedMimeTypes() { return this.fileTypes.map(f => f[0]); }
	static get allowedFileExtensions() { return this.fileTypes.map(f => f[1]); }

	static get userAgent() {
		return `YiffRocks/${pkg.version} (https://yiff.rocks)`;
	}

	// defaults
	static get bcryptRounds() { return 12; }

	// limitations
	static get minPostTags() { return 10; }
	static get maxPostTags() { return 250; }
	static get maxDescriptionLength() { return 5000; }
	static get maxTitleLength() { return 100; }
	static get maxSourceLength() { return 256; }
	static get maxSources() { return 10; }
	static get maxTotalSourcesLength() { return (this.maxSourceLength * this.maxSources) + 50; }

	// services
	// s3
	static get s3EndpointURL() { return super.s3EndpointURL; 	}
	static get s3Region() { return super.s3Region; }
	static get s3AccesskeyID() { return super.s3AccesskeyID; }
	static get s3SecretAccessKey() { return super.s3SecretAccessKey; }
	static get s3Bucket() { return super.s3Bucket; }
	static get s3ProtectedBucket() { return super.s3ProtectedBucket; }

	// db
	static get dbHost() { return super.dbHost; }
	static get dbPort() { return super.dbPort; }
	static get dbUser() { return super.dbUser; }
	static get dbPassword() { return super.dbPassword; }
	static get dbSSL() { return super.dbSSL; }
	static get dbDatabase() { return super.dbDatabase; }

	// redis
	static get redisHost() { return super.redisHost; }
	static get redisPort() { return super.redisPort; }
	static get redisUser() { return super.redisUser; }
	static get redisPassword() { return super.redisPassword; }
	static get redisDb() { return super.redisDb; }

	// image proxy
	static get proxyURL() { return super.proxyURL; }
	static get proxyAuth() { return super.proxyAuth; }

	static get sharedSession() {
		return session({
			name:   "yiff-rocks",
			secret: this.cookieSecret,
			cookie: {
				maxAge:   8.64e7,
				secure:   true,
				httpOnly: true,
				domain:   `.${this.apiPublicHost}`
			},
			resave:            false,
			saveUninitialized: true
		});
	}

	// tags
	static get tagMap(): Array<{ id: number; retrictions: number; }> {
		// naming is automatic, pascal case splitting by underscores
		// TagRestrctions can be used for restrictions, a bitfield is expected
		return [
			{ id: TagCategories.GENERAL,   retrictions: 0 },
			{ id: TagCategories.ARTIST,    retrictions: 0 },
			{ id: TagCategories.COPYRIGHT, retrictions: 0 },
			{ id: TagCategories.CHARACTER, retrictions: 0 },
			{ id: TagCategories.SPECIES,   retrictions: 0 },
			{ id: TagCategories.INVALID,   retrictions: TagRestrictions.RESTRICT_CREATE },
			{ id: TagCategories.LORE,      retrictions: TagRestrictions.RESTRICT_CREATE },
			{ id: TagCategories.META,      retrictions: TagRestrictions.RESTRICT_CREATE }
		];
	}

	static get tagOrder() {
		return [TagCategories.INVALID, TagCategories.ARTIST, TagCategories.COPYRIGHT, TagCategories.SPECIES, TagCategories.GENERAL, TagCategories.META, TagCategories.LORE];
	}

	// users
	static get enableEmailVerification() {
		return !this.isDevelopment;
	}

	static enableRegistrations() {
		return true;
	}

	// regex
	static get urlRegex() {
		return /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;
	}
}
