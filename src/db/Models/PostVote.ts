import Post from "./Post";
import User from "./User";
import db from "..";
import Util from "../../util/Util";
import { assert } from "tsafe";

export interface PostVoteData {
	id: bigint;
	created_at: string;
	updated_at: string;
	user_id: number;
	post_id: number;
	type: "down" | "none" | "up";
	ip_address: string;
}
export type PostVoteCreationRequired = Pick<PostVoteData, "user_id" | "post_id" | "type" | "ip_address">;
export type PostVoteCreationIgnored = "id" | "created_at" | "updated_at";
export type PostVoteCreationData = PostVoteCreationRequired & Partial<Omit<PostVoteData, keyof PostVoteCreationRequired | PostVoteCreationIgnored>>;

export default class PostVote implements PostVoteData {
	static TABLE = "post_votes";
	id: bigint;
	created_at: string;
	updated_at: string;
	user_id: number;
	post_id: number;
	type: "down" | "none" | "up";
	ip_address: string;
	constructor(data: PostVoteData) {
		this.id         = data.id;
		this.created_at = data.created_at;
		this.updated_at = data.updated_at;
		this.user_id    = data.user_id;
		this.post_id    = data.post_id;
		this.type       = data.type;
		this.ip_address = data.ip_address;
	}

	static async get(id: bigint) {
		const [res] = await db.query<Array<PostVoteData>>(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
		if (!res) return null;
		return new PostVote(res);
	}

	static async getForUser(id: number) {
		const res = await db.query<Array<PostVoteData>>(`SELECT * FROM ${this.TABLE} WHERE user_id = ?`, [id]);
		return res.map(r => new PostVote(r));
	}

	static async getForPost(id: number) {
		const res = await db.query<Array<PostVoteData>>(`SELECT * FROM ${this.TABLE} WHERE post_id = ?`, [id]);
		return res.map(r => new PostVote(r));
	}

	static async getForPostAndUser(user: number, post: number) {
		const [res] = await db.query<Array<PostVoteData>>(`SELECT * FROM ${this.TABLE} WHERE user_id = ? AND post_id = ?`, [user, post]);
		if (!res) return null;
		return new PostVote(res);
	}

	static async delete(id: bigint) {
		const res = await db.delete(this.TABLE, id);
		return res.affectedRows > 0;
	}

	static async create(data: PostVoteCreationData) {
		Util.removeUndefinedKeys(data);
		const res = await db.insert(this.TABLE, data);
		const createdObject = await this.get(res.insertId);
		assert(createdObject !== null, "failed to create new PostVote object");
		return createdObject;
	}

	static async edit(id: bigint, data: Omit<Partial<PostVoteData>, "id">) {
		return Util.genericEdit(PostVote, this.TABLE, id, data);
	}

	async edit(data: Omit<Partial<PostVoteData>, "id">) {
		Object.assign(this, Util.removeUndefinedKV(data));
		return PostVote.edit(this.id, data);
	}

	async getUser() { return User.get(this.user_id); }
	async getPost() { return Post.get(this.post_id); }

	async toJSON(includeVoteInfo = true) {
		const post = await this.getPost();
		assert(post !== null, `null post for PostVote #${this.id} (user: ${this.user_id}, post: ${this.post_id})`);
		return includeVoteInfo ? post.toJSON() : {
			created_at: this.created_at,
			updated_at: this.updated_at,
			user_id:    this.user_id,
			post_id:    this.post_id,
			post
		};
	}
}
