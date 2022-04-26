import type { UserLike } from "./User";
import User from "./User";
import PostVersion from "./PostVersion";
import PostVote from "./PostVote";
import Favorite from "./Favorite";
import Tag, { FunctionalMetaTags, TagCategories, TagCategoryNames } from "./Tag";
import type { FileType } from "./File";
import File from "./File";
import db from "..";
import Util from "../../util/Util";
import Config from "../../config";
import TagNameValidator from "../../logic/TagNameValidator";
import type { PostSearchOptions } from "../../logic/search/PostSearch";
import PostSearch from "../../logic/search/PostSearch";
import { assert } from "tsafe";

export type PostStats = Record<
"favorite_count" | "comment_count" |
"tag_count_general" | "tag_count_artist" | "tag_count_copyright" | "tag_count_character" |
"tag_count_species" | "tag_count_invalid" | "tag_count_lore" | "tag_count_meta",
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
	sources: Array<string>;
	tags: Array<string>;
	locked_tags: Array<string>;
	flags: number;
	rating: Ratings;
	rating_lock: RatingLocks | null;
	/** array of file ids associated with this post */
	files: Array<number>;
	filesize: number; // 0 if no associated files, this is the size of the primary file
	parent_id: number | null;
	children: Array<number>;
	pools: Array<number>;
	description: string;
	title: string;
	duration: number | null;
	type: FileType;
	// stats
	score_up: number;
	score_down: number;
	score: number;
	favorite_count: number;
	comment_count: number;
	tag_count: number;
	tag_count_general: number;
	tag_count_artist: number;
	tag_count_copyright: number;
	tag_count_character: number;
	tag_count_species: number;
	tag_count_invalid: number;
	tag_count_lore: number;
	tag_count_meta: number;
}
export type PostCreationRequired = Pick<PostData, "uploader_id">;
export type PostCreationIgnored = "id" | "created_at" | "updated_at" | "version" | "revision";
export type PostCreationData = PostCreationRequired & Partial<Omit<PostData, keyof PostCreationRequired | PostCreationIgnored>>;

export type Ratings =  typeof VALID_RATINGS[number];
export type ShortRatings =  typeof VALID_SHORT_RATINGS[number];
export type AllRatings =  typeof ALL_RATINGS[number];
export type RatingLocks = typeof VALID_RATING_LOCKS[number];

export const PostFlags = {
	PENDING:     1 << 0,
	FLAGGED:     1 << 1,
	NOTE_LOCKED: 1 << 2,
	DELETED:     1 << 3
};

export const VALID_RATINGS = ["safe", "questionable", "explicit"] as const;
export const VALID_SHORT_RATINGS = ["s", "q", "e"] as const;
export const ALL_RATINGS = [...VALID_RATINGS, ...VALID_SHORT_RATINGS];
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
	tags: Array<string>;
	locked_tags: Array<string>;
	sources: Array<string>;
	flags: number;
	rating: Ratings;
	rating_lock: RatingLocks | null;
	files: Array<number>;
	filesize: number;
	parent_id: number | null;
	children: Array<number>;
	pools: Array<number>;
	description: string;
	title: string;
	comment_count: number;
	duration: number | null;
	type: FileType;
	// stats
	score_up: number;
	score_down: number;
	score: number;
	favorite_count: number;
	tag_count: number;
	tag_count_general: number;
	tag_count_artist: number;
	tag_count_copyright: number;
	tag_count_character: number;
	tag_count_species: number;
	tag_count_invalid: number;
	tag_count_lore: number;
	tag_count_meta: number;
	constructor(data: PostData) {
		this.id = data.id;
		this.uploader_id        = data.uploader_id;
		this.approver_id         = data.approver_id;
		this.created_at          = data.created_at;
		this.updated_at          = data.updated_at;
		this.version             = data.version;
		this.revision            = data.revision;
		this.versions            = data.versions;
		this.tags                = data.tags;
		this.locked_tags         = data.locked_tags;
		this.sources             = data.sources;
		this.flags               = data.flags;
		this.rating              = data.rating;
		this.rating_lock         = data.rating_lock;
		this.files               = data.files;
		this.filesize            = data.filesize;
		this.parent_id           = data.parent_id;
		this.children           = data.children;
		this.pools               = data.pools;
		this.description         = data.description;
		this.title               = data.title;
		this.comment_count       = data.comment_count;
		this.duration            = data.duration;
		this.type                = data.type;
		this.score_up            = data.score_up;
		this.score_down          = data.score_down;
		this.score               = data.score;
		this.favorite_count      = data.favorite_count;
		this.tag_count           = data.tag_count;
		this.tag_count_general   = data.tag_count_general;
		this.tag_count_artist    = data.tag_count_artist;
		this.tag_count_copyright = data.tag_count_copyright;
		this.tag_count_character = data.tag_count_character;
		this.tag_count_species   = data.tag_count_species;
		this.tag_count_invalid   = data.tag_count_invalid;
		this.tag_count_lore      = data.tag_count_lore;
		this.tag_count_meta      = data.tag_count_meta;
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

	static async getBulk(posts: Array<number>) {
		const { rows: res } = await db.query<PostData>(`SELECT * FROM ${this.TABLE} WHERE id = ANY(ARRAY[${posts.join(",")}])`);
		return res.map(p => new Post(p));
	}

	static async create(data: PostCreationData, ip_address = null) {
		Util.removeUndefinedKeys(data);
		const ver = await PostVersion.create({
			updater_id:         data.uploader_id,
			updater_ip_address: ip_address,
			revision:           1,
			sources:            data.sources,
			tags:               data.tags,
			added_tags:         data.tags,
			locked_tags:        data.locked_tags,
			added_locked_tags:  data.locked_tags,
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
			post_id:             id,
			updater_id,
			updater_ip_address,
			revision:            (await Post.getRevisionNumber(id)) + 1,
			sources:             data.sources || post.sources,
			old_sources:         data.sources === undefined ? undefined : post.sources,
			tags:                data.tags || post.tags,
			added_tags:          data.tags === undefined ? undefined : data.tags.filter(t => !post.tags.includes(t)),
			removed_tags:        data.tags === undefined ? undefined :  post.tags.filter(t => !data.tags!.includes(t)),
			locked_tags:         data.locked_tags || post.locked_tags,
			added_locked_tags:   data.locked_tags === undefined ? undefined : data.locked_tags.filter(t => !post.locked_tags.includes(t)),
			removed_locked_tags: data.locked_tags === undefined ? undefined :  post.locked_tags.filter(t => !data.locked_tags!.includes(t)),
			rating:              data.rating || post.rating,
			old_rating:          data.rating === undefined ? undefined : post.rating,
			rating_lock:         data.rating_lock || post.rating_lock,
			old_rating_lock:     data.rating_lock === undefined ? undefined : post.rating_lock,
			parent_id:           data.parent_id || post.parent_id,
			old_parent_id:       data.parent_id === undefined ? undefined : post.parent_id,
			description:         data.description || post.description,
			old_description:     data.description === undefined ? undefined : post.description,
			title:               data.title || post.title,
			old_title:           data.title === undefined ? undefined : post.title
		}, false);

		await post.edit({
			...data,
			version:  v.id,
			versions: [...post.versions, v.id],
			revision: v.revision
		});

		return Post.get(id);
	}

	/**
	 * Create a vote on a post
	 *
	 * @param id - the id of the post
	 * @param user - the id of the user
	 * @param type - the type of vote (duplicates will convert to none)
	 * @param ip_address - the ip address of the user
	 * @returns null if type is "none" & no previous, PostVote instance otherwise
	 */
	static async vote(id: number, user: number, type: "down" | "none" | "up", ip_address: string | null = null) {
		// @TODO refactor to either do this without fetching or some other way that's less clunky
		const post = await Post.get(id);
		assert(post !== null);
		const currentVote = await PostVote.getForPostAndUser(id, user);
		if (currentVote) {
			if (currentVote.type === "none" && type === "none") return currentVote;
			if (type === "up") {
				if (currentVote.type === "up") {
					post.score_up--;
					post.score--;
				} else {
					if (currentVote.type === "down") {
						post.score_down++;
						post.score++;
					}
					post.score_up++;
					post.score++;
				}

				await post.edit({
					score_up:   post.score_up,
					score_down: post.score_down,
					score:      post.score
				});
			} else if (type === "down") {
				if (currentVote.type === "down") {
					post.score_down++;
					post.score++;
				} else {
					if (currentVote.type === "up") {
						post.score_up--;
						post.score--;
					}
					post.score_down--;
					post.score--;
				}

				await post.edit({
					score_up:   post.score_up,
					score_down: post.score_down,
					score:      post.score
				});
			}
			const r = await currentVote.edit({ type: currentVote.type === type ? "none" : type, ip_address });
			if (!r) process.emitWarning(`Post#vote modification changed 0 rows. (post: ${post.id}, user: ${user}, vote: ${currentVote.id} -  ${currentVote.type} -> ${type})`);
			return currentVote;
		} else {
			if (type === "none") return null;
			if (type === "up") {
				await post.edit({
					score_up: ++post.score_up,
					score:    ++post.score
				});
			} else if (type === "down") {
				await post.edit({
					score_down: --post.score_down,
					score:      --post.score
				});
			}
			return PostVote.create({
				post_id: post.id,
				user_id: user,
				type,
				ip_address
			});
		}
	}

	static async setParent(post: number, parent: number, blame: number, ipAddress: string | null = null, initial = false) {
		// if this is on initial upload, we don't want to make multiple post version entries
		if (initial) await Post.edit(post, { parent_id: parent });
		else await Post.editAsUser(post, blame, ipAddress, { parent_id: parent });
		await Post.addChild(parent, post);
	}

	static async addChild(post: number, child: number) {
		const { rows: [{ children }] } = await db.query<{ children: Array<number>; }>(`SELECT children FROM ${this.TABLE} WHERE id = $1`, [post]);
		await Post.edit(post, {
			children: [...children, child]
		});
	}

	static async search(query: PostSearchOptions, limit: number | undefined, offset: number | undefined, idOnly: true): Promise<Array<number>>;
	static async search(query: PostSearchOptions, limit?: number, offset?: number, idOnly?: false): Promise<Array<Post>>;
	static async search(query: PostSearchOptions, limit?: number, offset?: number, idOnly = false) {
		const [sql, values] = await PostSearch.constructQuery(query, limit, offset);
		const { rows: res } = await db.query<PostData>(idOnly ? sql.replace(/p\.\*/, "p.id") : sql, values);
		if (idOnly) return res.map(r => r.id);
		return res.map(r => new Post(r));
	}

	async setTags(user: UserLike, ipAddress: string | null, data: string, initial = false) {
		const tags = data.split(" ");
		const finalTags: Array<string> = [], negatedTags: Array<string> = [];
		const errors: Array<string> = [];
		let newRating: Post["rating"] | undefined, newRatingLock: Post["rating_lock"] | undefined;
		for (let tag of tags) {
			let negated = false;
			if (tag.startsWith("-")) {
				negated = true;
				tag = tag.slice(1);
			}
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
						// @TODO functional meta tags
						// @TODO negated meta tags
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
				if (negatedTags.includes(name)) continue;
				if (negated) {
					negatedTags.push(tag);
					continue;
				}
				if (!exists) await Tag.create({
					name,
					creator_id: user.id
				}, ipAddress);
				finalTags.push(name);
				continue;
			}
		}

		const categorized = await Tag.parseTagTypes(finalTags);
		if (initial) {
			// initially setting the tags shouldn't create an entirely new post version
			await this.edit({
				tags:                finalTags,
				tag_count:           Object.values(categorized).reduce((a, b) => a + b.length, 0),
				tag_count_general:   categorized.general.length,
				tag_count_artist:    categorized.artist.length,
				tag_count_copyright: categorized.copyright.length,
				tag_count_character: categorized.character.length,
				tag_count_species:   categorized.species.length,
				tag_count_invalid:   categorized.invalid.length,
				tag_count_lore:      categorized.lore.length,
				tag_count_meta:      categorized.meta.length
			});
			const v = await PostVersion.get(this.version);
			assert(v !== null, `failed to find post version for post # ${this.id}`);
			await v.edit({
				tags:       finalTags,
				added_tags: finalTags
			});
			if (newRating || newRatingLock) await this.editAsUser(user.id, ipAddress, {
				rating:      newRating,
				rating_lock: newRatingLock
			});
		} else {
			await this.editAsUser(user.id, ipAddress, {
				rating:              newRating,
				rating_lock:         newRatingLock,
				tags:                finalTags,
				tag_count:           Object.values(categorized).reduce((a, b) => a + b.length, 0),
				tag_count_general:   categorized.general.length,
				tag_count_artist:    categorized.artist.length,
				tag_count_copyright: categorized.copyright.length,
				tag_count_character: categorized.character.length,
				tag_count_species:   categorized.species.length,
				tag_count_invalid:   categorized.invalid.length,
				tag_count_lore:      categorized.lore.length,
				tag_count_meta:      categorized.meta.length
			});
		}

		return errors;
	}

	async setLockedTags(user: User, ipAddress: string | null, data: string, initial = false) {
		const tags = data.split(" ");
		const finalTags: Array<string> = [];
		const errors: Array<string> = [];
		let newRating: Post["rating"] | undefined, newRatingLock: Post["rating_lock"] | undefined;
		for (const tag of tags) {
			const [meta, name] = Tag.parseMetaTag(tag, [...FunctionalMetaTags, ...TagCategoryNames]);
			const exists = await Tag.doesExist(name);
			const validationCheck = TagNameValidator.validate(name);
			if (validationCheck !== true) {
				errors.push(...validationCheck.map(e => `${e} (${name})`));
				continue;
			}
			if (meta) errors.push(`meta cannot be used within locked tags (${tag})`);
			else {
				if (!exists) await Tag.create({
					name,
					creator_id: user.id
				}, ipAddress);
				finalTags.push(name);
				continue;
			}
		}

		const final = [...this.tags, ...finalTags];
		const categorized = await Tag.parseTagTypes(final);
		if (initial) {
			// initially setting the tags shouldn't create an entirely new post version
			await this.edit({
				tags:                final,
				tag_count:           Object.values(categorized).reduce((a, b) => a + b.length, 0),
				tag_count_general:   categorized.general.length,
				tag_count_artist:    categorized.artist.length,
				tag_count_copyright: categorized.copyright.length,
				tag_count_character: categorized.character.length,
				tag_count_species:   categorized.species.length,
				tag_count_invalid:   categorized.invalid.length,
				tag_count_lore:      categorized.lore.length,
				tag_count_meta:      categorized.meta.length,
				locked_tags:         finalTags
			});
			const v = await PostVersion.get(this.version);
			assert(v !== null, `failed to find post version for post # ${this.id}`);
			await v.edit({
				tags:              final,
				added_tags:        final,
				locked_tags:       finalTags,
				added_locked_tags: finalTags
			});
			if (newRating || newRatingLock) await this.editAsUser(user.id, ipAddress, {
				rating:      newRating,
				rating_lock: newRatingLock
			});
		} else {
			await this.editAsUser(user.id, ipAddress, {
				rating:              newRating,
				rating_lock:         newRatingLock,
				tags:                finalTags,
				tag_count:           Object.values(categorized).reduce((a, b) => a + b.length, 0),
				tag_count_general:   categorized.general.length,
				tag_count_artist:    categorized.artist.length,
				tag_count_copyright: categorized.copyright.length,
				tag_count_character: categorized.character.length,
				tag_count_species:   categorized.species.length,
				tag_count_invalid:   categorized.invalid.length,
				tag_count_lore:      categorized.lore.length,
				tag_count_meta:      categorized.meta.length
			});
		}

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

	async vote(user: number, type: "down" | "none" | "up", ipAddress: string | null = null) {
		return Post.vote(this.id, user, type, ipAddress);
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
		return (await Promise.all(this.children.map(async(c) => {
			const post = await Post.get(c);
			if (post === null) return this.fixChild(c);
			return post;
		}))).filter(Boolean) as Array<Post>;
	}

	async setParent(parent: number, blame: number, ipAddress: string | null = null, initial = false) { return Post.setParent(this.id, parent, blame, ipAddress, initial); }
	async addChild(child: number) { return Post.addChild(this.id, child); }

	// files
	async getFiles() { return File.getBulk(this.files); }

	/** previous file deletion should be handled outside of this! */
	async setFile(data: Buffer, flags = 0) {
		const files = await Config.storageManager.store(data, this.id, flags);
		const primary = files.find(f => f.is_primary === true);
		assert(primary !== undefined, "failed to create primary file");
		await this.edit({
			files:    files.map(f => f.id),
			type:     primary.type,
			filesize: primary.size
		});
		return {
			primary,
			all: files
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

	async setStat(type: keyof PostStats, value: number) {
		this[type] = value;
		await this.edit({ [type]: this[type] });
		return this[type];
	}

	// misc
	async getUploader() { return User.get(this.uploader_id); }
	async getFavorites() { return Favorite.getForPost(this.id); }
	async getPostVotes() { return PostVote.getForPost(this.id); }

	async toJSON(getFiles = true) {
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
				total: this.score
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
			files:         !getFiles ? this.files : (await this.getFiles()).map(f => f.toJSON()),
			relationships: {
				parent:   this.parent_id,
				children: await this.getChildPosts(),
				versions: this.versions,
				pools:    this.pools
			},
			description:   this.description,
			title:         this.title,
			comment_count: this.comment_count,
			duration:      this.duration,
			type:          this.type
		};
	}
}
