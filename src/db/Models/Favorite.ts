import Post from "./Post";
import User from "./User";
import db from "..";
import Util from "../../util/Util";
import { assert } from "tsafe";

export interface FavoriteData {
	id: bigint;
	created_at: string;
	user_id: number;
	post_id: number;
}
export type FavoriteCreationRequired = Pick<FavoriteData, "user_id" | "post_id">;
export type FavoriteCreationIgnored = "id" | "created_at";
export type FavoriteCreationData = FavoriteCreationRequired & Partial<Omit<FavoriteData, keyof FavoriteCreationRequired | FavoriteCreationIgnored>>;

export default class Favorite implements FavoriteData {
	static TABLE = "favorites";
	id: bigint;
	created_at: string;
	user_id: number;
	post_id: number;
	constructor(data: FavoriteData) {
		this.id         = data.id;
		this.created_at = data.created_at;
		this.user_id    = data.user_id;
		this.post_id    = data.post_id;
	}

	static async get(id: bigint) {
		const [res] = await db.query<Array<FavoriteData>>(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
		if (!res) return null;
		return new Favorite(res);
	}

	static async getForUser(id: number) {
		const res = await db.query<Array<FavoriteData>>(`SELECT * FROM ${this.TABLE} WHERE user_id = ?`, [id]);
		return res.map(r => new Favorite(r));
	}

	static async getForPost(id: number) {
		const res = await db.query<Array<FavoriteData>>(`SELECT * FROM ${this.TABLE} WHERE post_id = ?`, [id]);
		return res.map(r => new Favorite(r));
	}

	static async getByUserAndPost(user: number, post: number) {
		const [res] = await db.query<Array<FavoriteData>>(`SELECT * FROM ${this.TABLE} WHERE user_id = ? AND post_id = ?`, [user, post]);
		if (!res) return null;
		return new Favorite(res);
	}

	static async delete(id: bigint) {
		const res = await db.delete(this.TABLE, id);
		return res.affectedRows > 0;
	}

	static async create(data: FavoriteCreationData) {
		Util.removeUndefinedKeys(data);
		const res = await db.insert(this.TABLE, data);
		const createdObject = await this.get(res.insertId);
		assert(createdObject !== null, "failed to create new Favorite object");
		return createdObject;
	}

	static async edit(id: bigint, data: Omit<Partial<FavoriteData>, "id">) {
		return Util.genericEdit(Favorite, this.TABLE, id, data);
	}

	async edit(data: Omit<Partial<FavoriteData>, "id">) {
		Object.assign(this, Util.removeUndefinedKV(data));
		return Favorite.edit(this.id, data);
	}

	async getUser() { return User.get(this.user_id); }
	async getPost() { return Post.get(this.post_id); }

	async toJSON() {
		const post = await this.getPost();
		assert(post !== null, `null post for favorite #${this.id} (user: ${this.user_id}, post: ${this.post_id})`);
		return post.toJSON();
	}
}
