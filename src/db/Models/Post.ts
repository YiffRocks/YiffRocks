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
	versions: Array<number>;
	score_up: number;
	score_down: number;
	sources: Array<string>;
	favorite_count: number;
	tags: Array<string>;
	locked_tags: Array<string>;
	flags: number;
	rating: Ratings;
	rating_lock: RatingLocks | null;
	/** array of file ids associated with this post */
	files: Array<number>;
	parent_id: number | null;
	childeren: Array<number>;
	pools: Array<number>;
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
	versions: Array<number>;
	score_up: number;
	score_down: number;
	favorite_count: number;
	tags: Array<string>;
	locked_tags: Array<string>;
	sources: Array<string>;
	flags: number;
	rating: Ratings;
	rating_lock: RatingLocks | null;
	files: Array<number>;
	parent_id: number | null;
	childeren: Array<number>;
	pools: Array<number>;
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
		this.parent_id = data.parent_id;
		this.childeren = data.childeren;
		this.pools = data.pools;
		this.description = data.description;
		this.title = data.title;
		this.comment_count = data.comment_count;
		this.duration = data.duration;
		this.type = data.type;
	}

	static async get(id: number) {
		const { rows: [res] } = await db.query<PostData>(`SELECT * FROM ${this.TABLE} WHERE id = $1`, [id]);
		if (!res) return null;
		return new Post(res);
	}

	static async getRevisionNumber(id: number) {
		const { rows: res } = await db.query<{ revision: number; }>(`SELECT revision FROM ${this.TABLE} WHERE id = $1`, [id]);
		if (res.length === 0) return 1;
		return res.map(r => r.revision).sort((a, b) => a - b)[res.length - 1];
	}

	static async create(data: PostCreationData, ip_address = null) {
		Util.removeUndefinedKeys(data);
		const ver = await PostVersion.create({
			updater_id:         data.uploader_id,
			updater_ip_address: ip_address,
			revision:           1,
			sources:            data.sources,
			tags:               data.tags,
			locked_tags:        data.locked_tags,
			rating:             data.rating,
			rating_lock:        data.rating_lock,
			parent_id:          data.parent_id,
			description:        data.description,
			title:              data.title
		}, true);
		const res = await db.insert<number>(this.TABLE, {
			...data,
			version:  ver,
			revision: 1,
			versions: [ver]
		});
		const createdObject = await this.get(res);
		assert(createdObject !== null, "failed to create new post object");
		await PostVersion.edit(ver, { post_id: createdObject.id });
		return createdObject;
	}

	static async delete(id: number) {
		return db.delete(this.TABLE, id);
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
			parent_id:       data.parent_id || post.parent_id,
			old_parent_id:   data.parent_id === undefined ? undefined : post.parent_id,
			description:     data.description || post.description,
			old_description: data.description === undefined ? undefined : post.description,
			title:           data.title || post.title,
			old_title:       data.title === undefined ? undefined : post.title
		}, false);

		await post.edit({
			...data,
			version:  v.id,
			versions: [...post.versions, v.id],
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

	static async search(query: {
		uploader_id?: number;
		uploader_name?: string;
		approver_id?: number;
		approver_name?: string;
		sources?: string;
		tags?: string;
		locked_tags?: string;
		rating?: Ratings | "e" | "q" | "s";
		rating_lock?: RatingLocks | "none";
		parent_id?: number;
		childeren?: string;
		pools?: string;
		description?: string;
		title?: string;
	}, limit: number, offset: number) {
		const statements: Array<string> = [];
		const values: Array<unknown> = [];
		const selectExtra: Array<string> = [];
		if (query.uploader_id && !isNaN(query.uploader_id)) {
			values.push(Number(query.uploader_id));
			statements.push(`uploader_id = $${values.length}`);
		}
		if (query.uploader_name) {
			const id = await User.nameToID(query.uploader_name);
			if (id !== null) {
				values.push(id);
				statements.push(`uploader_id = $${values.length}`);
			}
		}
		if (query.approver_id && !isNaN(query.approver_id)) {
			statements.push(`approver_id = $${values.length}`);
			values.push(Number(query.approver_id));
		}
		if (query.approver_name) {
			const id = await User.nameToID(query.approver_name);
			if (id !== null) {
				values.push(id);
				statements.push(`approver_id = $${values.length}`);
			}
		}
		if (query.sources) {
			const all = query.sources.split(" ");
			for (const source of all) {
				selectExtra.push("unnest(sources) s");
				values.push(`%${Util.parseWildcards(source)}`);
				statements.push(`s LIKE $${values.length}`);
			}
		}
		if (query.tags) {
			const all = query.tags.split(" ");
			// @TODO revisit this as it might have some weird outcomes
			for (const tag of all) {

				if (tag.includes(Config.wildcardCharacter)) {
					selectExtra.push("unnest(tags) t");
					values.push(`${Util.parseWildcards(tag)}`);
					statements.push(`t LIKE $${values.length}`);
				} else {
					values.push(tag);
					statements.push(`tags @> ARRAY[$${values.length}]`);
				}
			}
		}
		if (query.locked_tags) {
			const all = query.locked_tags.split(" ");
			for (const tag of all) {
				if (tag.includes(Config.wildcardCharacter)) {
					selectExtra.push("unnest(locked_tags) l;");
					values.push(`${Util.parseWildcards(tag)}`);
					statements.push(`l LIKE $${values.length}`);
				} else {
					values.push(tag);
					statements.push(`locked_tags @> ARRAY[$${values.length}]`);
				}
			}
		}
		if (query.rating) {
			const r = query.rating === "e" ? "explicit" : query.rating === "q" ? "questionable" : query.rating === "s" ? "safe" : query.rating;
			if (VALID_RATINGS.includes(r)) {
				values.push(r);
				statements.push(`rating = $${values.length}`);
			}
		}
		if (query.rating_lock) {
			const r = query.rating_lock === "none" ? null : query.rating_lock;
			if (r === null || VALID_RATING_LOCKS.includes(r)) {
				values.push(r);
				statements.push(`rating_lock = $${values.length}`);
			}
		}
		if (query.parent_id && !isNaN(query.parent_id)) {
			values.push(query.parent_id);
			statements.push(`parent_id = $${values.length}`);
		}
		if (query.childeren) {
			const all = query.childeren.split(" ");
			for (const child of all) {
				values.push(child);
				statements.push(`childeren @> ARRAY[$${values.length}]`);
			}
		}
		if (query.pools) {
			const all = query.pools.split(" ");
			for (const pool of all) {
				values.push(pool);
				statements.push(`pools @> ARRAY[$${values.length}]`);
			}
		}
		if (query.description) {
			values.push(`%${Util.parseWildcards(query.description)}%`);
			statements.push(`description LIKE $${values.length}`);
		}
		if (query.title) {
			values.push(`%${Util.parseWildcards(query.title)}%`);
			statements.push(`title LIKE $${values.length}`);
		}

		console.log(`SELECT * FROM posts${selectExtra.length === 0 ? "" : `, ${selectExtra.join(", ")}`}${statements.length === 0 ? "" : ` WHERE ${statements.join(" AND ")}`} LIMIT ${limit} OFFSET ${offset}`, values);
		const { rows: res } = await db.query<PostData>(`SELECT * FROM posts${selectExtra.length === 0 ? "" : `, ${selectExtra.join(", ")}`}${statements.length === 0 ? "" : ` WHERE ${statements.join(" AND ")}`} LIMIT ${limit} OFFSET ${offset}`, values);
		return res.map(r => new Post(r));
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
							category:   TagCategories[(meta.toUpperCase()) as keyof typeof TagCategories],
							creator_id: user.id
						}, ipAddress);
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
					name,
					creator_id: user.id
				}, ipAddress);
				finalTags.push(name);
				continue;
			}
		}

		await this.editAsUser(user.id, ipAddress, {
			tags:        finalTags,
			rating:      newRating,
			rating_lock: newRatingLock
		});

		return errors;
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

	// child & parent
	// @TODO fix if possible, return post if fixed, null if not fixed
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async fixChild(id: number) {
		return Promise.resolve(null);
	}

	async getChildPosts() {
		return (await Promise.all(this.childeren.map(async(c) => {
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
			files: [...this.files, ...files.map(f => f.id)]
		});
		return {
			primary: files.find(f => f.is_primary === true),
			all:     files
		};
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
			score:         {
				up:    this.score_up,
				down:  this.score_down,
				total: this.score_up - this.score_down
			},
			favorite_count: this.favorite_count,
			// @TODO tag categories
			tags:           await Tag.parseTagTypes(this.tags),
			locked_tags:    this.locked_tags,
			sources:        this.sources,
			flags:          {
				...Util.lowercaseKeys(this.parsedFlags),
				rating_lock: this.rating_lock
			},
			rating:        this.rating,
			files:         (await this.getFiles()).map(f => f.toJSON()),
			relationships: {
				parent:    this.parent_id,
				childeren: await this.getChildPosts(),
				versions:  this.versions,
				pools:     this.pools
			},
			description:   this.description,
			title:         this.title,
			comment_count: this.comment_count,
			duration:      this.duration,
			type:          this.type
		};
	}
}
