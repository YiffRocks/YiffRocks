import User from "./User";
import File from "./File";
import PostVersion from "./PostVersion";
import PostVote from "./PostVote";
import Favorite from "./Favorite";
import Tag, { FunctionalMetaTags, TagCategories, TagCategoryNames } from "./Tag";
import db from "..";
import Util from "../../util/Util";
import Config from "../../config";
import TagNameValidator from "../../logic/TagNameValidator";
import { assert } from "tsafe";

export type PostStats = Record<
"favorite_count" | "comment_count",
number>;
export interface PostData {
	id: number;
	uploader_id: number;
	approver_id: number | null;
	created_at: string;
	updated_at: string | null;
	/** overall version number, shared across all posts */
	version: number;
	/** local version number, for this post only */
	revision: number;
	/** all versions of this post */
	versions: string;
	score_up: number;
	score_down: number;
	sources: string;
	favorite_count: number;
	tags: string;
	locked_tags: string;
	flags: number;
	rating: Ratings;
	rating_lock: RatingLocks | null;
	/** array of file ids associated with this post */
	files: string;
	parent: number | null;
	childeren: string | null;
	pools: string | null;
	description: string;
	title: string;
	comment_count: number;
	duration: number | null;
	type: "png" | "apng" | "jpg" | "gif" | "video" | "unknown";
}
export type PostCreationRequired = Pick<PostData, "uploader_id">;
export type PostCreationIgnored = "id" | "created_at" | "updated_at" | "version" | "revision";
export type PostCreationData = PostCreationRequired & Partial<Omit<PostData, keyof PostCreationRequired | PostCreationIgnored>>;

export type Ratings =  typeof VALID_RATINGS[number];
export type RatingLocks = typeof VALID_RATING_LOCKS[number];

export const PostFlags = {
	PENDING:     1 << 0,
	FLAGGED:     1 << 1,
	NOTE_LOCKED: 1 << 2,
	DELETED:     1 << 3
};

export const VALID_RATINGS = ["safe", "questionable", "explicit"] as const;
export const VALID_RATING_LOCKS = ["minimum", "exact", "maximum"] as const;

export default class Post implements PostData {
	static TABLE = "posts";
	id: number;
	uploader_id: number;
	approver_id: number | null;
	created_at: string;
	updated_at: string | null;
	version: number;
	revision: number;
	versions: string;
	score_up: number;
	score_down: number;
	favorite_count: number;
	tags: string;
	locked_tags: string;
	sources: string;
	flags: number;
	rating: Ratings;
	rating_lock: RatingLocks | null;
	files: string;
	parent: number | null;
	childeren: string | null;
	pools: string | null;
	description: string;
	title: string;
	comment_count: number;
	duration: number | null;
	type: "png" | "apng" | "jpg" | "gif" | "video" | "unknown";
	constructor(data: PostData) {
		this.id = data.id;
		this.uploader_id = data.uploader_id;
		this.approver_id = data.approver_id;
		this.created_at = data.created_at;
		this.updated_at = data.updated_at;
		this.version = data.version;
		this.revision = data.revision ?? 0;
		this.versions = data.versions ?? "";
		this.score_up = data.score_up ?? 0;
		this.score_down = data.score_down ?? 0;
		this.favorite_count = data.favorite_count ?? 0;
		this.tags = data.tags;
		this.locked_tags = data.locked_tags ?? "";
		this.sources = data.sources ?? "";
		this.flags = data.flags ?? 0;
		this.rating = data.rating ?? "explicit";
		this.rating_lock = data.rating_lock;
		this.files = data.files ?? "";
		this.parent = data.parent;
		this.childeren = data.childeren;
		this.pools = data.pools;
		this.description = data.description;
		this.title = data.title;
		this.comment_count = data.comment_count;
		this.duration = data.duration;
		this.type = data.type;
	}

	static async get(id: number) {
		const [res] = await db.query<Array<PostData>>(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
		if (!res) return null;
		return new Post(res);
	}

	static async getRevisionNumber(id: number) {
		const res = await db.query<Array<{ revision: number; }>>(`SELECT revision FROM ${this.TABLE} WHERE id = ?`, [id]);
		if (res.length === 0) return 1;
		return res.map(r => r.revision).sort((a, b) => a - b)[res.length - 1];
	}

	static async create(data: PostCreationData, ip_address = null) {
		Util.removeUndefinedKeys(data);
		const v = await PostVersion.create({
			updater_id:         data.uploader_id,
			updater_ip_address: ip_address,
			revision:           1,
			sources:            data.sources,
			tags:               data.tags,
			locked_tags:        data.locked_tags,
			rating:             data.rating,
			rating_lock:        data.rating_lock,
			parent:             data.parent,
			description:        data.description,
			title:              data.title
		}, true);
		const res = await db.insert(this.TABLE, {
			...data,
			version:  v,
			revision: 1,
			versions: v.toString()
		}, true);
		const createdObject = await this.get(res.insertId);
		assert(createdObject !== null, "failed to create new post object");
		await PostVersion.edit(v, { post_id: createdObject.id });
		return createdObject;
	}

	static async delete(id: number) {
		const res = await db.delete(this.TABLE, id);
		return res.affectedRows > 0;
	}

	static async edit(id: number, data: Omit<Partial<PostData>, "id">) {
		return Util.genericEdit(Post, this.TABLE, id, Util.removeUndefinedKV(data));
	}

	static async editAsUser(id: number, updater_id: number, updater_ip_address: string | null, data: Omit<Partial<PostData>, "id">) {
		const post = await Post.get(id);
		assert(post !== null, "[Post#editAsUser]: failed to get post");
		const v = await PostVersion.create({
			post_id:         id,
			updater_id,
			updater_ip_address,
			revision:        (await Post.getRevisionNumber(id)) + 1,
			sources:         data.sources || post.sources,
			old_sources:     data.sources === undefined ? undefined : post.sources,
			tags:            data.tags || post.tags,
			old_tags:        data.tags === undefined ? undefined : post.tags,
			locked_tags:     data.locked_tags || post.locked_tags,
			old_locked_tags: data.locked_tags === undefined ? undefined : post.locked_tags,
			rating:          data.rating || post.rating,
			old_rating:      data.rating === undefined ? undefined : post.rating,
			rating_lock:     data.rating_lock || post.rating_lock,
			old_rating_lock: data.rating_lock === undefined ? undefined : post.rating_lock,
			parent:          data.parent || post.parent,
			old_parent:      data.parent === undefined ? undefined : post.parent,
			description:     data.description || post.description,
			old_description: data.description === undefined ? undefined : post.description,
			title:           data.title || post.title,
			old_title:       data.title === undefined ? undefined : post.title
		}, false);

		await post.edit({
			...data,
			version:  v.id,
			versions: `${post.versions} ${v.id}`,
			revision: v.revision
		});

		return Post.get(id);
	}

	static async vote(post: number, user: number, type: "down" | "none" | "up", ip_address: string | null = null) {
		const currentVote = await PostVote.getForPostAndUser(post, user);
		if (currentVote) {
			if (currentVote.type === "none" && type === "none") return currentVote;
			if (type === currentVote.type) type = "none";
			const r = await currentVote.edit({ type, ip_address });
			if (!r) process.emitWarning(`Post#vote modification changed 0 rows. (post: ${post}, user: ${user}, vote: ${currentVote.id} -  ${currentVote.type} -> ${type})`);
			return currentVote;
		} else {
			return PostVote.create({
				post_id: post,
				user_id: user,
				type,
				ip_address
			});
		}
	}

	async setTags(user: User, ipAddress: string | null, data: string) {
		const tags = data.split(" ");
		const finalTags: Array<string> = [];
		const errors: Array<string> = [];
		let newRating: Post["rating"] | undefined;
		let newRatingLock: Post["rating_lock"] | undefined;
		for (const tag of tags) {
			const [meta, name] = Tag.parseMetaTag(tag, [...FunctionalMetaTags, ...TagCategoryNames]);
			const exists = await Tag.doesExist(name);
			const validationCheck = TagNameValidator.validate(name);
			if (validationCheck !== true) {
				errors.push(...validationCheck.map(e => `${e} (${name})`));
				continue;
			}
			if (meta) {
				if (TagCategoryNames.includes(meta)) {
					if (exists) {
						errors.push(`Tag categories cannot be changed with a meta prefix if they already exist. (${name})`);
						finalTags.push(name);
						continue;
					} else {
						await Tag.create({
							name,
							category: TagCategories[meta as keyof typeof TagCategories]
						});
						finalTags.push(name);
						continue;
					}
				} else {
					if (FunctionalMetaTags.includes(meta)) {
						switch (meta) {
							// @TODO pools
							case "pool": {
								continue;
							}
							case "newpool": {
								continue;
							}

							// @TODO post sets
							case "set": {
								continue;
							}
							case "newset": {
								continue;
							}

							case "vote": {
								if (!["down", "none", "up"].includes(name)) {
									errors.push(`Invalid vote type "${name}" (${tag})`);
									continue;
								}
								// yes, we're ignoring duplicate votes
								await this.vote(user.id, name as "down" | "none" | "up");
								continue;
							}

							case "fav": {
								const parse = Util.parseBoolean(name, true);
								if (parse === null) {
									errors.push(`Invalid favorite value "${name}", looking for true/false. (${tag})`);
								}
								// yes, we're ignoring duplicate favorites
								await user.addFavorite(this.id);
								continue;
							}

							case "lock": case "locked": {
								const rl = name as typeof VALID_RATING_LOCKS[number] | "none";
								if (!user.isAtLeastPrivileged) {
									errors.push("You cannot modify rating locks, you must be at least Privileged.");
									continue;
								} else {
									if (![...VALID_RATING_LOCKS, "none"].includes(rl)) {
										errors.push(`Invalid rating lock "${rl}", looking for ${VALID_RATING_LOCKS.join("/")}/none. (${tag})`);
										continue;
									}
									newRatingLock = rl === "none" ? null : rl;
									continue;
								}
							}

							case "rating": {
								const r = name as Post["rating"];
								if (this.isRatingLocked) {
									if (!user.isAtLeastPrivileged) {
										errors.push(`This post is rating locked, and you cannot change it. (${tag})`);
										continue;
									} else {
										if (!VALID_RATINGS.includes(r)) {
											errors.push(`Invalid rating "${r}", looking for ${VALID_RATINGS.join("/")}. (${tag})`);
											continue;
										}
									}
								}

								if (this.rating === r) continue;
								else newRating = r;
							}
						}
					} else {
						errors.push(`Unknown error when parsing tag. (${tag})`);
					}
				}
			} else {
				if (!exists) await Tag.create({
					name
				});
				finalTags.push(name);
				continue;
			}
		}

		await this.editAsUser(user.id, ipAddress, {
			tags:        finalTags.join(" "),
			rating:      newRating,
			rating_lock: newRatingLock
		});
	}

	async delete() {
		return Post.delete(this.id);
	}

	async edit(data: Omit<Partial<PostData>, "id">) {
		Object.assign(this, Util.removeUndefinedKV(data));
		return Post.edit(this.id, data);
	}

	async editAsUser(updater: number, ipAddress: string | null, data: Omit<Partial<PostData>, "id">) {
		return Post.editAsUser(this.id, updater, ipAddress, data);
	}

	async vote(user: number, type: "down" | "none" | "up") {
		return Post.vote(this.id, user, type);
	}

	// flags
	get parsedFlags() {
		return Object.entries(PostFlags).map(([key, value]) => ({ [key]: (this.flags & value) === value })).reduce((a, b) => ({ ...a, ...b }), {}) as Record<keyof typeof PostFlags, boolean>;
	}

	get isPending() { return Util.checkFlag(PostFlags.PENDING, this.flags); }
	get isFlagged() { return Util.checkFlag(PostFlags.PENDING, this.flags); }
	get isNoteLocked() { return Util.checkFlag(PostFlags.PENDING, this.flags); }
	get isDeleted() { return Util.checkFlag(PostFlags.PENDING, this.flags); }
	get isRatingLocked() { return this.rating_lock !== null; }

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

	// approval
	async approve(id: number) {
		if (!this.isPending) return false;
		if (this.approver_id !== null) {
			await this.removeFlag(PostFlags.PENDING);
			return false;
		}

		const user = await User.get(id);
		assert(user !== null, "null user in Post#approve");
		assert(user.isApprover, `user ${user.id} cannot approve posts in Post#approve`);

		await this.edit({
			flags:       this.flags - PostFlags.PENDING,
			approver_id: id
		});
		await user.incrementStat("post_approval_count");
		return true;
	}

	async getApprover() { return this.approver_id === null ? null : User.get(this.approver_id); }

	// pools
	get poolIDs() { return this.pools === null ? [] : this.pools.split(" ").map(c => Number(c)); }

	// child & parent
	// @TODO fix if possible, return post if fixed, null if not fixed
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async fixChild(id: number) {
		return Promise.resolve(null);
	}

	get childPosts() { return this.childeren === null ? [] : this.childeren.split(" ").map(c => Number(c)); }
	async getChildPosts() {
		return (await Promise.all(this.childPosts.map(async(c) => {
			const post = await Post.get(c);
			if (post === null) return this.fixChild(c);
			return post;
		}))).filter(Boolean) as Array<Post>;
	}

	// files
	async getFiles() { return File.getFilesForPost(this.id); }

	async addFile(data: Buffer, flags = 0) {
		const files = await Config.storageManager.store(data, this.id, flags);
		await this.edit({
			files: `${this.files} ${files.join(" ")}`
		});
	}

	// stats
	async incrementStat(type: keyof PostStats) {
		this[type] = this[type] + 1;
		await this.edit({ [type]: this[type] });
		return this[type];
	}

	async decrementStat(type: keyof PostStats) {
		this[type] = this[type] - 1;
		await this.edit({ [type]: this[type] });
		return this[type];
	}

	// misc
	async getUploader() { return User.get(this.uploader_id); }
	async getFavorites() { return Favorite.getForPost(this.id); }
	async getPostVotes() { return PostVote.getForPost(this.id); }

	async toJSON() {
		return {
			id:            this.id,
			uploader_id:   this.uploader_id,
			uploader_name: await User.idToName(this.uploader_id),
			approver_id:   this.approver_id,
			approver_name: this.approver_id === null ? null : await User.idToName(this.approver_id),
			created_at:    this.created_at,
			updated_at:    this.updated_at,
			version:       this.version,
			revision:      this.revision,
			versions:      this.versions.split(" ").map(v => Number(v)),
			score:         {
				up:    this.score_up,
				down:  this.score_down,
				total: this.score_up - this.score_down
			},
			favorite_count: this.favorite_count,
			// @TODO tag categories
			tags:           {
				general: this.tags.split(" ")
			},
			locked_tags: this.locked_tags.split(" "),
			sources:     this.sources.split(" "),
			flags:       {
				...Util.lowercaseKeys(this.parsedFlags),
				rating_lock: this.rating_lock
			},
			rating:        this.rating,
			files:         (await this.getFiles()).map(f => f.toJSON()),
			relationships: {
				parent:    this.parent,
				childeren: await this.getChildPosts(),
				pools:     this.poolIDs
			},
			description:   this.description,
			title:         this.title,
			comment_count: this.comment_count,
			duration:      this.duration,
			type:          this.type
		};
	}
}
