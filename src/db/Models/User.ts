import db from "..";
import Util from "../../util/Util";
import Config from "../../config";
import { assert } from "tsafe";
import bcrypt from "bcrypt";
import { createHash } from "crypto";

export type UserStats = Record<
"artist_change_count" | "comment_count" | "flag_count" |
"note_change_count" | "pool_change_count" | "post_change_count" |
"post_approval_count" | "upload_count" | "favorite_count" |
"positive_feedback_count" | "neutral_feedback_count" | "negative_feedback_count",
number>;
interface UserData extends UserStats {
	id: number;
	name: string;
	password: string | null;
	email: string | null;
	email_verification: string | null;
	created_at: string;
	updated_at: string | null;
	last_login: string | null;
	flags: number;
	level: number;
	base_upload_limit: number;
	avatar_id: number | null;
	blacklist: string;
	profile: string;
	// settings
	settings: number;
	default_image_size: ImageSize;
	timezone: number;
	posts_per_page: number;
	comment_threshold: number;
	// internal
	ip_addresses: string;
}
export type UserCreationRequired = Pick<UserData, "name">;
export type UserCreationIgnored = "id" | "created_at" | "updated_at";
export type UserCreationData = UserCreationRequired & Partial<Omit<UserData, keyof UserCreationRequired | UserCreationIgnored>>;

export type ImageSize = "thumbnail" | "fitv" | "fith" | "original";

// we'll need bigints if we ever have more than 30 flags
export const UserFlags = {
	BANNED:            1 << 0,
	SYSTEM:            1 << 1,
	BOT:               1 << 2,
	APPROVER:          1 << 3,
	UNLIMITED_UPLOADS: 1 << 4,
	USE_GRAVATAR:      1 << 5,
	NO_FLAGGING:       1 << 6,
	NO_FEEDBACK:       1 << 7,
	HAS_MAIL:          1 << 8,
	VERIFIED:          1 << 9
} as const;
export const PrivateUserFlags = [
	"HAS_MAIL"
] as const;

export const UserSettings = {
	HIDE_AVATARS:             1 << 0,
	HIDE_BLACKLISTED_AVATARS: 1 << 1,
	COLLAPSE_DESCRIPTIONS:    1 << 2,
	HIDE_COMMENTS:            1 << 3,
	EMAIL_NOTIFICATIONS:      1 << 4,
	PRIVACY_MODE:             1 << 5,
	AUTOCOMPLETE:             1 << 6,
	SAFE_MODE:                1 << 7,
	DISABLE_PM:               1 << 8,
	COMPACT_UPLOADER:         1 << 9
} as const;

export enum UserLevels {
	// normal users
	ANONYMOUS = 1,
	MEMBER    = 2,

	// more advanced users
	PRIVILIGED   = 10,
	FORMER_STAFF = 11,

	// staff
	JANITOR   = 20,
	MODERATOR = 21,
	ADMIN     = 22
}

export default class User implements UserData {
	static TABLE = "users";
	id: number;
	name: string;
	password: string | null;
	email: string | null;
	email_verification: string | null;
	created_at: string;
	updated_at: string | null;
	last_login: string | null;
	flags: number;
	level: UserLevels;
	base_upload_limit: number;
	avatar_id: number | null;
	blacklist: string;
	profile: string;
	// stats
	artist_change_count: number;
	comment_count: number;
	flag_count: number;
	note_change_count: number;
	pool_change_count: number;
	post_change_count: number;
	post_approval_count: number;
	upload_count: number;
	favorite_count: number;
	positive_feedback_count: number;
	neutral_feedback_count: number;
	negative_feedback_count: number;
	// settings
	settings: number; // boolean settings
	/** default image size when viewing post */
	default_image_size: ImageSize;
	/** the users UTC offset */
	timezone: number;
	/** the number of posts to display per page */
	posts_per_page: number;
	/** the threshold under which to hide comments */
	comment_threshold: number;
	// internal
	ip_addresses: string;
	constructor(data: UserData) {
		this.id = data.id;
		this.name = data.name;
		this.password = data.password ?? null;
		this.email = data.email;
		this.email_verification = data.email_verification || null;
		this.created_at         = data.created_at;
		this.updated_at         = data.updated_at;
		this.last_login         = data.last_login;
		this.flags              = data.flags ?? 0;
		this.level              = data.level as UserLevels || UserLevels.ANONYMOUS;
		this.base_upload_limit  = data.base_upload_limit;
		this.avatar_id          = data.avatar_id || null;
		this.blacklist          = data.blacklist ?? "";
		this.profile            = data.profile ?? "";
		// stat
		this.artist_change_count     = data.artist_change_count ?? 0;
		this.comment_count           = data.comment_count ?? 0;
		this.flag_count              = data.flag_count ?? 0;
		this.note_change_count       = data.note_change_count ?? 0;
		this.pool_change_count       = data.pool_change_count ?? 0;
		this.post_change_count       = data.post_change_count ?? 0;
		this.post_approval_count     = data.post_approval_count ?? 0;
		this.upload_count            = data.upload_count ?? 0;
		this.favorite_count          = data.favorite_count ?? 0;
		this.positive_feedback_count = data.positive_feedback_count ?? 0;
		this.neutral_feedback_count  = data.neutral_feedback_count ?? 0;
		this.negative_feedback_count = data.negative_feedback_count ?? 0;
		// settings
		this.settings = data.settings || 0;
		this.default_image_size  = data.default_image_size || "fitv";
		this.timezone = data.timezone ?? 0;
		this.posts_per_page = data.posts_per_page ?? 75;
		this.comment_threshold = data.comment_threshold ?? 0;
		// internal
		this.ip_addresses = data.ip_addresses;
	}

	// flags
	get parsedFlags() {
		return Object.entries(UserFlags).map(([key, value]) => ({ [key]: (this.flags & value) === value })).reduce((a, b) => ({ ...a, ...b }), {}) as Record<keyof typeof UserFlags, boolean>;
	}

	get parsedFlagsWithoutPrivate() {
		return Object.entries(UserFlags).filter(([key]) => !(PrivateUserFlags as ReadonlyArray<string>).includes(key)).map(([key, value]) => ({ [key]: (this.flags & value) === value })).reduce((a, b) => ({ ...a, ...b }), {}) as Record<Exclude<keyof typeof UserFlags, typeof PrivateUserFlags[number]>, boolean>;
	}

	get isBanned() { return Util.checkFlag(UserFlags.BANNED, this.flags); }
	get isSystemUser() { return Util.checkFlag(UserFlags.SYSTEM, this.flags); }
	get isBotUser() { return Util.checkFlag(UserFlags.BOT, this.flags); }
	get isApprover() { return Util.checkFlag(UserFlags.APPROVER, this.flags); }
	get hasUnlimitedUploads() { return Util.checkFlag(UserFlags.UNLIMITED_UPLOADS, this.flags); }
	get useGravatar() { return Util.checkFlag(UserFlags.USE_GRAVATAR, this.flags); }
	get isFlaggingDisabled() { return Util.checkFlag(UserFlags.NO_FLAGGING, this.flags); }
	get isFeedbackDisabled() { return Util.checkFlag(UserFlags.NO_FEEDBACK, this.flags); }
	get hasUnreadMail() { return Util.checkFlag(UserFlags.HAS_MAIL, this.flags); }
	get isVerified() { return Util.checkFlag(UserFlags.VERIFIED, this.flags); }

	async addFlag(flag: number) {
		if ((this.flags & flag) === 0) return this;
		await this.edit({
			flags: this.flags | flag
		});
		this.flags = this.flags | flag;
		return this;
	}

	async removeFlag(flag: number) {
		if ((this.flags & flag) !== 0) return this;
		await this.edit({
			flags: this.flags - flag
		});
		this.flags = this.flags - flag;
		return this;
	}

	// settings
	get parsedSettings() {
		return Object.entries(UserSettings).map(([key, value]) => ({ [key]: (this.settings & value) === value })).reduce((a, b) => ({ ...a, ...b }), {}) as Record<keyof typeof UserSettings, boolean>;
	}

	get getHideAvatars() { return Util.checkFlag(UserSettings.HIDE_AVATARS, this.settings); }
	get getHideBlacklistedAvatars() { return Util.checkFlag(UserSettings.HIDE_AVATARS, this.settings); }
	get getCollapsedDescriptions() { return Util.checkFlag(UserSettings.HIDE_AVATARS, this.settings); }
	get getHideComments() { return Util.checkFlag(UserSettings.HIDE_AVATARS, this.settings); }
	get getEmailNotifications() { return Util.checkFlag(UserSettings.HIDE_AVATARS, this.settings); }
	get getPrivacyMode() { return Util.checkFlag(UserSettings.HIDE_AVATARS, this.settings); }
	get getAutocomplete() { return Util.checkFlag(UserSettings.HIDE_AVATARS, this.settings); }
	get getSafeMode() { return Util.checkFlag(UserSettings.HIDE_AVATARS, this.settings); }
	get getDisablePM() { return Util.checkFlag(UserSettings.HIDE_AVATARS, this.settings); }
	get getCompactUploader() { return Util.checkFlag(UserSettings.HIDE_AVATARS, this.settings); }
	get getDefaultImageSize() { return this.default_image_size; }
	get getTimezone() { return this.timezone; }
	get getPostsPerPage() { return this.posts_per_page; }
	get getCommentThreshold() { return this.comment_threshold; }

	// level
	get levelName() {
		return Util.normalizeConstant(UserLevels[this.level]);
	}

	// for the love of god find a way to make this dynamic
	// (I know how to do the code, the types are just complicared af)
	get isAtLeastAnonymous() { return this.isLevelAtLeast(UserLevels.ANONYMOUS); }
	get isAnonymous() { return this.isLevel(UserLevels.ANONYMOUS); }
	get isAtMostAnonymous() { return this.isLevelAtMost(UserLevels.ANONYMOUS); }
	get isAtLeastMember() { return this.isLevelAtLeast(UserLevels.MEMBER); }
	get isMember() { return this.isLevel(UserLevels.MEMBER); }
	get isAtMostMember() { return this.isLevelAtMost(UserLevels.MEMBER); }

	get isAtLeastPriviliged() { return this.isLevelAtLeast(UserLevels.PRIVILIGED); }
	get isPriviliged() { return this.isLevel(UserLevels.PRIVILIGED); }
	get isAtMostPriviliged() { return this.isLevelAtMost(UserLevels.PRIVILIGED); }
	get isAtLeastFormerStaff() { return this.isLevelAtLeast(UserLevels.FORMER_STAFF); }
	get isFormerStaff() { return this.isLevel(UserLevels.FORMER_STAFF); }
	get isAtMostFormerStaff() { return this.isLevelAtMost(UserLevels.FORMER_STAFF); }

	get isStaff() { return this.isAtLeastJanitor; }
	get isAtLeastJanitor() { return this.isLevelAtLeast(UserLevels.JANITOR); }
	get isJanitor() { return this.isLevel(UserLevels.JANITOR); }
	get isAtMostJanitor() { return this.isLevelAtMost(UserLevels.JANITOR); }
	get isAtLeastModerator() { return this.isLevelAtLeast(UserLevels.MODERATOR); }
	get isModerator() { return this.isLevel(UserLevels.MODERATOR); }
	get isAtMostModerator() { return this.isLevelAtMost(UserLevels.MODERATOR); }
	get isAtLeastAdmin() { return this.isLevelAtLeast(UserLevels.ADMIN); }
	get isAdmin() { return this.isLevel(UserLevels.ADMIN); }
	get isAtMostAdmin() { return this.isLevelAtMost(UserLevels.ADMIN); }

	isLevel(level: UserLevels) {
		return this.level === level;
	}

	isLevelAtLeast(level: UserLevels, inclusive = true) {
		return inclusive ? this.level >= level : this.level > level;
	}

	isLevelAtMost(level: UserLevels, inclusive = true) {
		return inclusive ? this.level <= level : this.level < level;
	}

	// other
	get knownIPAddresses() {
		return Array.from(new Set(this.ip_addresses.split(" ")));
	}

	async trackIPAddress(address: string) {
		if (!this.knownIPAddresses.includes(address)) {
			this.ip_addresses += ` ${address}`;
			await this.edit({
				ip_addresses: this.ip_addresses
			});
		}
	}

	async checkPassword(pwd: string) {
		if (this.password === null) return false;
		return bcrypt.compare(pwd, this.password);
	}

	async setPassword(pwd: string) {
		assert(!this.parsedFlags.SYSTEM, "Cannot set password for system user.");
		assert(!this.parsedFlags.BOT, "Cannot set password for bot user.");
		const hashed = await bcrypt.hash(pwd, Config.bcryptRounds);
		await this.edit({
			password: hashed
		});
		this.password = hashed;
		return this;
	}

	async incrementStat(type: keyof UserStats) {
		this[type] = this[type] + 1;
		await this.edit({ [type]: this[type] });
		return this[type];
	}

	get favoriteLimit() {
		if (this.isLevelAtLeast(UserLevels.JANITOR)) return 150_000;
		else if (this.isLevelAtLeast(UserLevels.FORMER_STAFF)) return 100_000;
		else if (this.isLevelAtLeast(UserLevels.PRIVILIGED)) return 75_000;
		else if (this.isLevelAtLeast(UserLevels.MEMBER)) return 50_000;
		else return 0;
	}

	get apiBurstLimit() {
		if (this.isLevelAtLeast(UserLevels.JANITOR)) return 120;
		else if (this.isLevelAtLeast(UserLevels.PRIVILIGED)) return 90;
		else return 60;
	}

	get apiRegenMultiplier() {
		return 1;
	}

	get statementTimeout() {
		if (this.isLevelAtLeast(UserLevels.JANITOR)) return 9_000;
		else if (this.isLevelAtLeast(UserLevels.PRIVILIGED)) return 6_000;
		else return 3_000;
	}

	get tagQueryLimit() {
		if (this.isLevelAtLeast(UserLevels.JANITOR)) return 60;
		else if (this.isLevelAtLeast(UserLevels.PRIVILIGED)) return 50;
		else if (this.isLevelAtLeast(UserLevels.MEMBER)) return 40;
		else return 20;
	}

	get gravatarHash() {
		return this.email === null ? null : createHash("md5").update(this.email).digest("hex");
	}

	// @TODO post avatars
	// @TODO avatar caching?
	get avatarURL() {
		return this.parsedFlags.USE_GRAVATAR && this.gravatarHash !== null ? `https://gravatar.com/avatar/${this.gravatarHash}.jpg?d=identicon` : "";
	}

	static async get(id: number) {
		const [res] = await db.query<Array<UserData>>(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
		if (!res) return null;
		return new User(res);
	}

	static async getByName(name: string) {
		const [res] = await db.query<Array<UserData>>(`SELECT * FROM ${this.TABLE} WHERE name = ?`, [name]);
		if (!res) return null;
		return new User(res);
	}

	static async delete(id: number) {
		const res = await db.delete(this.TABLE, id);
		return res.affectedRows > 0;
	}

	static async create(data: UserCreationData) {
		Util.removeUndefinedKeys(data);
		const res = await db.insert(this.TABLE, data);
		const createdObject = await this.get(res.insertId);
		assert(createdObject !== null, "failed to create new post object");
		return createdObject;
	}

	static async edit(id: number, data: Omit<Partial<UserData>, "id">) {
		return Util.genericEdit(User, this.TABLE, id, data);
	}

	async edit(data: Omit<Partial<UserData>, "id">) {
		Object.assign(this, Util.removeUndefinedKV(data));
		return User.edit(this.id, data);
	}


	static async idToName(id: number) {
		// @TODO caching
		const [res] = await db.query<Array<{ name: string; }>>(`SELECT name FROM ${this.TABLE} WHERE id = ?`, [id]);
		return !res ? null : res.name;
	}

	static async nameToID(name: string) {
		// @TODO caching
		const [res] = await db.query<Array<{ name: string; }>>(`SELECT id FROM ${this.TABLE} WHERE name = ?`, [name]);
		return !res ? null : res.name;
	}

	toJSON(type?: "public" | "self") {
		const publicInfo = {
			id:                this.id,
			name:              this.name,
			created_at:        this.created_at,
			updated_at:        this.updated_at,
			last_login:        this.last_login,
			flags:             Util.lowercaseKeys(this.parsedFlagsWithoutPrivate),
			level:             this.level,
			levelName:         this.levelName,
			base_upload_limit: this.base_upload_limit,
			avatar_id:         this.avatar_id,
			// this shouldn't be exposing their email due to it being hashed, but associations can still be made
			gravatar_hash:     this.parsedFlags.USE_GRAVATAR ? this.gravatarHash : null,
			profile:           this.profile,
			stats:             {
				artist_change_count: this.artist_change_count,
				comment_count:       this.comment_count,
				flag_count:          this.flag_count,
				note_change_count:   this.note_change_count,
				pool_change_count:   this.pool_change_count,
				post_change_count:   this.post_change_count,
				upload_count:        this.upload_count,
				favorite_count:      this.favorite_count
			},
			feedback: {
				positive: this.positive_feedback_count,
				neutral:  this.neutral_feedback_count,
				negative: this.negative_feedback_count,
				total:    this.positive_feedback_count - this.negative_feedback_count
			}
		};
		switch (type) {
			default:
			case "public": return publicInfo;

			case "self": return {
				...publicInfo,
				flags:          Util.lowercaseKeys(this.parsedFlags),
				email:          this.email,
				email_verified: this.email_verification === null,
				blacklist:      this.blacklist,
				settings:       {
					...Util.lowercaseKeys(this.parsedSettings),
					default_image_size: this.default_image_size,
					timezone:           this.timezone,
					posts_per_page:     this.posts_per_page,
					comment_threshold:  this.comment_threshold
				}
			};
		}
	}
}


// @TODO ??
/* Util.defineIsGetters(User.prototype, UserFlags);
type IsGetters<T extends Record<string, unknown>> = {
	readonly [K in `is${ToPascalCase<keyof T>}`]: boolean;
};
type V = IsGetters<typeof UserFlags>; */
