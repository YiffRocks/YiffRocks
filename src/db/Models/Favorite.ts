import Post from "./Post";
import User from "./User";
import db from "..";
import Util from "../../util/Util";
import type { FavoriteSearchOptions } from "../../logic/search/FavoriteSearch";
import FavoriteSearch from "../../logic/search/FavoriteSearch";
import { assert } from "tsafe";

export interface FavoriteData {
	id: string;
	created_at: string;
	user_id: number;
	post_id: number;
}
export type FavoriteCreationRequired = Pick<FavoriteData, "user_id" | "post_id">;
export type FavoriteCreationIgnored = "id" | "created_at";
export type FavoriteCreationData = FavoriteCreationRequired & Partial<Omit<FavoriteData, keyof FavoriteCreationRequired | FavoriteCreationIgnored>>;

export default class Favorite implements FavoriteData {
	static TABLE = "favorites";
	id: string;
	created_at: string;
	user_id: number;
	post_id: number;
	constructor(data: FavoriteData) {
		this.id         = data.id;
		this.created_at = data.created_at;
		this.user_id    = data.user_id;
		this.post_id    = data.post_id;
	}

	static async get(id: string) {
		const { rows: [res] } = await db.query<FavoriteData>(`SELECT * FROM ${this.TABLE} WHERE id = $1`, [id]);
		if (!res) return null;
		return new Favorite(res);
	}

	static async getForUser(id: number) {
		const { rows: res } = await db.query<FavoriteData>(`SELECT * FROM ${this.TABLE} WHERE user_id = $1`, [id]);
		return res.map(r => new Favorite(r));
	}

	static async getForPost(id: number) {
		const { rows: res } = await db.query<FavoriteData>(`SELECT * FROM ${this.TABLE} WHERE post_id = $1`, [id]);
		return res.map(r => new Favorite(r));
	}

	static async getByUserAndPost(user: number, post: number) {
		const { rows: [res] } = await db.query<FavoriteData>(`SELECT * FROM ${this.TABLE} WHERE user_id = $1 AND post_id = $2`, [user, post]);
		if (!res) return null;
		return new Favorite(res);
	}

	static async delete(id: string) {
		return db.delete(this.TABLE, id);
	}

	static async create(data: FavoriteCreationData) {
		Util.removeUndefinedKeys(data);
		const res = await db.insert<string>(this.TABLE, data);
		const createdObject = await this.get(res);
		assert(createdObject !== null, "failed to create new Favorite object");
		return createdObject;
	}

	static async edit(id: string, data: Omit<Partial<FavoriteData>, "id">) {
		return Util.genericEdit(Favorite, this.TABLE, id, data);
	}

	static async search(query: FavoriteSearchOptions, limit?: number, offset?: number) {
		const [sql, values] = await FavoriteSearch.constructQuery(query, limit, offset);
		const { rows: res } = await db.query<FavoriteData>(sql, values);
		return res.map(r => new Favorite(r));
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
