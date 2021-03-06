import Favorite from "./Favorite";
import PostVote from "./PostVote";
import Post from "./Post";
import db from "..";
import Util from "../../util/Util";
import Config from "../../config";
import type IHasStats from "../../util/@types/IHasStats";
import type CurrentUser from "../../logic/CurrentUser";
import { assert } from "tsafe";
import bcrypt from "bcrypt";
import { createHash } from "crypto";

export type UserLike = User | CurrentUser;
export type UserStats = Record<
"artist_change_count" | "comment_count" | "flag_count" |
"note_change_count" | "pool_change_count" | "post_change_count" |
"post_approval_count" | "upload_count" | "favorite_count" |
"positive_feedback_count" | "neutral_feedback_count" | "negative_feedback_count",
number>;
export interface UserData extends UserStats {
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
	last_ip_address: string | null;
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
	PRIVILEGED   = 10,
	FORMER_STAFF = 11,

	// staff
	JANITOR   = 20,
	MODERATOR = 21,
	ADMIN     = 22
}

export default class User implements UserData, IHasStats<keyof UserStats> {
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
	last_ip_address: string | null;
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
		this.last_ip_address = data.last_ip_address;
	}

	static async get(id: number) {
		const { rows: [res] } = await db.query<UserData>(`SELECT * FROM ${this.TABLE} WHERE id = $1`, [id]);
		if (!res) return null;
		return new User(res);
	}

	static async getByName(name: string) {
		const { rows: [res] } = await db.query<UserData>(`SELECT * FROM ${this.TABLE} WHERE name = $1`, [name]);
		if (!res) return null;
		return new User(res);
	}

	static async create(data: UserCreationData) {
		Util.removeUndefinedKeys(data);
		if (!("flags" in data) && data.level && data.level >= UserLevels.JANITOR) data.flags = UserFlags.APPROVER;
		const res = await db.insert<number>(this.TABLE, data);
		const createdObject = await this.get(res);
		assert(createdObject !== null, "failed to create new post object");
		return createdObject;
	}

	static async delete(id: number) {
		return db.delete(this.TABLE, id);
	}

	static async edit(id: number, data: Omit<Partial<UserData>, "id">) {
		return Util.genericEdit(User, this.TABLE, id, data);
	}

	static async idToName(id: number) {
		// @TODO caching
		const { rows: [res] } = await db.query<{ name: string; }>(`SELECT name FROM ${this.TABLE} WHERE id = $1`, [id]);
		return !res ? null : res.name;
	}

	static async nameToID(name: string) {
		// @TODO caching
		const { rows: [res] } = await db.query<{ id: number; }>(`SELECT id FROM ${this.TABLE} WHERE name = $1`, [name]);
		return !res ? null : res.id;
	}

	static async addFlag(user: number, current: number, flag: number) {
		await User.edit(user, { flags: current | flag });
		return current | flag;
	}

	static async removeFlag(user: number, current: number, flag: number) {
		await User.edit(user, { flags: current & ~flag });
		return current & ~flag;
	}

	static async incrementStat(user: number, current: number, type: keyof UserStats) { return this.setStat(user, type, current + 1); }
	static async decrementStat(user: number, current: number, type: keyof UserStats) { return this.setStat(user, type, current - 1); }
	static async setStat(user: number, type: keyof UserStats, value: number) {
		await User.edit(user, { [type]: value });
		return value;
	}

	static isLevel(current: UserLevels, level: UserLevels) {
		return current === level;
	}
	static isLevelAtLeast(current: UserLevels, level: UserLevels, inclusive = true) {
		return inclusive ? current >= level : current > level;
	}
	static isLevelAtMost(current: UserLevels, level: UserLevels, inclusive = true) {
		return inclusive ? current <= level : current < level;
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

	// settings
	get parsedSettings() {
		return Object.entries(UserSettings).map(([key, value]) => ({ [key]: (this.settings & value) === value })).reduce((a, b) => ({ ...a, ...b }), {}) as Record<keyof typeof UserSettings, boolean>;
	}

	get hideAvatars() { return Util.checkFlag(UserSettings.HIDE_AVATARS, this.settings); }
	get hideBlacklistedAvatars() { return Util.checkFlag(UserSettings.HIDE_BLACKLISTED_AVATARS, this.settings); }
	get collapsedDescriptions() { return Util.checkFlag(UserSettings.COLLAPSE_DESCRIPTIONS, this.settings); }
	get hideComments() { return Util.checkFlag(UserSettings.HIDE_COMMENTS, this.settings); }
	get emailNotifications() { return Util.checkFlag(UserSettings.EMAIL_NOTIFICATIONS, this.settings); }
	get privacyMode() { return Util.checkFlag(UserSettings.PRIVACY_MODE, this.settings); }
	get autocomplete() { return Util.checkFlag(UserSettings.AUTOCOMPLETE, this.settings); }
	get safeMode() { return Util.checkFlag(UserSettings.SAFE_MODE, this.settings); }
	get disablePM() { return Util.checkFlag(UserSettings.DISABLE_PM, this.settings); }
	get compactUploaderE() { return Util.checkFlag(UserSettings.COMPACT_UPLOADER, this.settings); }
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

	get isAtLeastPrivileged() { return this.isLevelAtLeast(UserLevels.PRIVILEGED); }
	get isPrivileged() { return this.isLevel(UserLevels.PRIVILEGED); }
	get isAtMostPrivileged() { return this.isLevelAtMost(UserLevels.PRIVILEGED); }
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

	get isLevel() { return User.isLevel.bind(User, this.id); }
	get isLevelAtLeast() { return User.isLevelAtLeast.bind(User, this.id); }
	get isLevelAtMost() { return User.isLevelAtMost.bind(User, this.id); }

	// other
	async trackIPAddress(address: string) {
		if (this.last_ip_address !== address) {
			await this.edit({
				last_ip_address: address
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

	async incrementStat(type: keyof UserStats) { return User.incrementStat.call(User, this.id, this[type], type); }
	async decrementStat(type: keyof UserStats) { return User.decrementStat.call(User, this.id, this[type], type); }
	get setStat() { return User.setStat.bind(User, this.id); }

	get apiBurstLimit() { return Config.apiBurstLimit(this); }
	get apiRegenMultiplier() { return Config.apiRegenMultiplier(this); }
	get statementTimeout() { return Config.statementTimeout(this); }
	get tagQueryLimit() { return Config.tagQueryLimit(this); }

	get gravatarHash() {
		return this.email === null ? null : createHash("md5").update(this.email).digest("hex");
	}

	// @TODO post avatars
	// @TODO avatar caching?
	get avatarURL() {
		return this.parsedFlags.USE_GRAVATAR && this.gravatarHash !== null ? `https://gravatar.com/avatar/${this.gravatarHash}.jpg?d=identicon` : "";
	}


	async edit(data: Omit<Partial<UserData>, "id">) {
		Object.assign(this, Util.removeUndefinedKV(data));
		return User.edit(this.id, data);
	}

	// favorites
	get favoriteLimit() { return Config.favoriteLimit(this); }

	async getFavorites() { return Favorite.getForUser(this.id); }

	async addFavorite(id: number) {
		const post = await Post.get(id);
		assert(post !== null, "null post in addFavorite");
		const prev = await Favorite.getByUserAndPost(this.id, id);
		if (prev !== null) return null;
		await post.incrementStat("favorite_count");
		await this.incrementStat("favorite_count");
		const fav = await Favorite.create({
			user_id: this.id,
			post_id: id
		});
		return fav;
	}

	async removeFavorite(id: number) {
		const post = await Post.get(id);
		assert(post !== null, "null post in removeFavorite");
		const prev = await Favorite.getByUserAndPost(this.id, id);
		if (prev === null) return false;
		await post.decrementStat("favorite_count");
		await this.decrementStat("favorite_count");
		return Favorite.delete(prev.id);
	}

	async getPostVotes() { return PostVote.getForUser(this.id); }

	get addFlag() { return User.addFlag.bind(this.id); }
	get removeFlag() { return User.removeFlag.bind(this.id); }

	toJSON(type?: "public" | "self") {
		const publicInfo = {
			id:                this.id,
			name:              this.name,
			created_at:        this.created_at,
			updated_at:        this.updated_at,
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
