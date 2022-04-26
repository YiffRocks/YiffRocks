import Config from "../config";
import type { UserStats } from "../db/Models/User";
import User, { PrivateUserFlags, UserFlags, UserSettings, UserLevels } from "../db/Models/User";
import type IHasStats from "../util/@types/IHasStats";
import Util from "../util/Util";
import type Favorite from "../db/Models/Favorite";
import type PostVote from "../db/Models/PostVote";
import bcrypt from "bcrypt";
import { createHash } from "crypto";

export default class CurrentUser implements User, IHasStats<keyof UserStats> {
	private user: User | null = null;

	get id() { return this.user?.id ?? 0; }
	get name() { return this.user?.name ?? "Anonymous"; }
	get password() { return this.user?.password ?? null; }
	get email() { return this.user?.email ?? null; }
	get email_verification() { return this.user?.email_verification ?? null; }
	get created_at() { return this.user === null ? new Date().toISOString() : this.user.created_at; }
	get updated_at() { return this.user?.updated_at ?? null; }
	get last_login() { return this.user?.last_login ?? null; }
	get flags() { return this.user?.flags ?? 0; }
	// not logged in = anonymous
	get level() { return this.user?.level ?? UserLevels.ANONYMOUS; }
	get base_upload_limit() { return this.user?.base_upload_limit ?? Config.defaultUploadBase; }
	get avatar_id() { return this.user?.avatar_id ?? null; }
	get blacklist() { return this.user?.blacklist ?? Config.defaultBlacklist; }
	get profile() { return this.user?.profile ?? ""; }
	get artist_change_count() { return this.user?.artist_change_count ?? 0; }
	get comment_count() { return this.user?.comment_count ?? 0; }
	get flag_count() { return this.user?.flag_count ?? 0; }
	get note_change_count() { return this.user?.note_change_count ?? 0; }
	get pool_change_count() { return this.user?.pool_change_count ?? 0; }
	get post_change_count() { return this.user?.post_change_count ?? 0; }
	get post_approval_count() { return this.user?.post_approval_count ?? 0; }
	get upload_count() { return this.user?.upload_count ?? 0; }
	get favorite_count() { return this.user?.favorite_count ?? 0; }
	get positive_feedback_count() { return this.user?.positive_feedback_count ?? 0; }
	get neutral_feedback_count() { return this.user?.neutral_feedback_count ?? 0; }
	get negative_feedback_count() { return this.user?.negative_feedback_count ?? 0; }
	get settings() { return this.user?.settings ?? Config.defaultSettings; }
	get default_image_size() { return this.user?.default_image_size ?? Config.defaultImageSize; }
	get timezone() { return this.user?.timezone ?? 0; }
	get posts_per_page() { return this.user?.posts_per_page ?? Config.defaultPostLimit; }
	get comment_threshold() { return this.user?.comment_threshold ?? Config.defaultCommentThreshold; }
	get last_ip_address() { return this.user?.last_ip_address ?? null; }
	constructor(user?: User) {
		if (user) this.user = user;
	}

	get isPresent(){ return this.user !== null; }
	get getUser() { return this.user; }
	setUser(user: User) { this.user = user; return this; }

	// levels
	get levelName() {
		return Util.normalizeConstant(UserLevels[this.level]);
	}
	get isLevel() { return User.isLevel.bind(User, this.id); }
	get isLevelAtLeast() { return User.isLevelAtLeast.bind(User, this.id); }
	get isLevelAtMost() { return User.isLevelAtMost.bind(User, this.id); }

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

	get addFlag() { return User.addFlag.bind(this.id); }
	get removeFlag() { return User.removeFlag.bind(this.id); }

	get apiBurstLimit() { return Config.apiBurstLimit(this); }
	get apiRegenMultiplier() { return Config.apiRegenMultiplier(this); }
	get statementTimeout() { return Config.statementTimeout(this); }
	get tagQueryLimit() { return Config.tagQueryLimit(this); }

	get gravatarHash() {
		return this.email === null ? null : createHash("md5").update(this.email).digest("hex");
	}

	get avatarURL() {
		return this.parsedFlags.USE_GRAVATAR && this.gravatarHash !== null ? `https://gravatar.com/avatar/${this.gravatarHash}.jpg?d=identicon` : "";
	}

	// stats

	async incrementStat(type: keyof UserStats) { return User.incrementStat.call(User, this.id, this[type], type); }
	async decrementStat(type: keyof UserStats) { return User.decrementStat.call(User, this.id, this[type], type); }
	get setStat() { return User.setStat.bind(User, this.id); }

	// other
	async trackIPAddress(address: string) { return this.user !== null ? this.user.trackIPAddress(address) : void 0; }

	async checkPassword(pwd: string) {
		if (this.password === null) return false;
		return bcrypt.compare(pwd, this.password);
	}

	async setPassword(pwd: string) { return this.user !== null ? this.user.setPassword(pwd) : this as User; }

	// favorites
	get favoriteLimit() { return Config.favoriteLimit(this); }

	async getFavorites() { return this.user?.getFavorites() ?? [] as Array<Favorite>; }
	async addFavorite(id: number) { return this.user?.addFavorite(id) ?? null; }
	async removeFavorite(id: number) { return this.user?.removeFavorite(id) ?? false; }
	async getPostVotes() { return this.user?.getPostVotes() ?? [] as Array<PostVote>; }

	// no-op if no user present
	get edit() { return this.user !== null ? this.user.edit.bind(this.user) : () => Promise.resolve(false); }
}
