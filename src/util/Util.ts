import type { TransformKeysToLowerCase } from "./@types/types";
import type { OkPacket } from "../db";
import db from "../db";
import type { FileData } from "../db/Models/File";
import File from "../db/Models/File";
import type { BinaryLike } from "crypto";
import { createHash } from "crypto";

export default class Util {
	private constructor() {
		throw new Error("use static methods");
	}

	static normalizeConstant(str: string, firstLower = false) {
		return str.toLowerCase().split(/_/g).map(p => `${firstLower ? p.charAt(0) : p.charAt(0).toUpperCase()}${p.slice(1)}`).join(" ");
	}

	static defineIsGetters<T extends { flags: number; }>(obj: T, values: Record<string, number>) {
		Object.entries(values).forEach(([key, value]) =>
			Object.defineProperty(this, `is${Util.normalizeConstant(key)}`, {
				get(this: typeof obj) { return (this.flags & value) === value; }
			})
		);
	}

	static checkFlag(flag: number, total: number) { return (total & flag) === flag; }

	static async getFilesForPost(id: number) {
		const res = await db.query<Array<FileData>>(`SELECT * FROM ${File.TABLE} WHERE post_id = ?`, [id]);
		return res.map(r => new File(r));
	}

	static findDifferences(oldVersion: string | Array<string>, newVersion: string | Array<string>) {
		if (!Array.isArray(oldVersion)) oldVersion = oldVersion.split(" ");
		if (!Array.isArray(newVersion)) newVersion = newVersion.split(" ");
		const added: Array<string> = [];
		const removed: Array<string> = [];

		newVersion.forEach(entry => {
			if (!oldVersion.includes(entry)) added.push(entry);
		});
		oldVersion.forEach(entry => {
			if (!newVersion.includes(entry)) removed.push(entry);
		});

		return {
			added,
			removed
		};
	}

	static removeUndefinedKeys(data: Record<string, unknown>) {
		Object.entries(data).forEach(([key, value]) => {
			if (value === undefined) delete data[key];
		});
	}

	static lowercaseKeys<T extends Record<string, unknown>>(data: T) {
		return Object.entries(data).map(([key, value]) => ({ [key.toLowerCase()]: value })).reduce((a, b) => ({ ...a, ...b }), {}) as TransformKeysToLowerCase<T>;
	}

	static removeUndefinedKV<T extends Record<string, unknown>>(data: T) {
		return Object.entries(data).filter(([key, value]) => Boolean(key) && Boolean(value)).reduce((a, b) => ({ ...a, ...b }), {});
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	static async genericEdit<T extends { get(id: number | bigint): Promise<any>; }, D extends Record<string, unknown>>(type: T, table: string, id: number | bigint, data: D): Promise<boolean> {
		if (Object.hasOwn(data, "updated_at")) delete data.updated_at;
		const keys = Object.keys(data);
		const values = Object.values(data).filter(Boolean) ;
		const res = await db.query<OkPacket>(`UPDATE ${table} SET ${keys.map(j => `${j}=?`).join(", ")}, updated_at=CURRENT_TIMESTAMP(3) WHERE id = ?`, [...values, id]);
		return res.affectedRows > 0;
	}

	static md5(data: BinaryLike) {
		return createHash("md5").update(data).digest("hex");
	}

	static enumEntries<T extends Record<string, unknown>>(value: T) {
		return Object.entries(value).filter(([key]) => (!~~key && key !== "0"));
	}

	static enumValues<T extends Record<string, unknown>>(value: T) {
		return this.enumEntries<T>(value).map(v => v[1]);
	}

	static enumKeys<T extends Record<string, unknown>>(value: T) {
		return Object.keys(value).filter((key) => (!~~key && key !== "0"));
	}

	static parseBoolean(str: string, exact: true): boolean | null;
	static parseBoolean(str: string, exact?: false): boolean;
	static parseBoolean(str: string, exact = true) {
		return ["true", "yes", "y"].includes(str) ? true : !exact ? false : ["false", "no", "n"].includes(str) ? false : null;
	}
}
