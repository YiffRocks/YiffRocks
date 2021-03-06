import type { TransformKeysToLowerCase } from "./@types/types";
import type { OkPacket } from "../db";
import db from "../db";
import type { FileData } from "../db/Models/File";
import File from "../db/Models/File";
import Config from "../config";
import type User from "../db/Models/User";
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
		const { rows: res } = await db.query<FileData>(`SELECT * FROM ${File.TABLE} WHERE post_id = ?`, [id]);
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
		return Object.entries(data).filter(([key, value]) => key !== undefined && key !== null && value !== undefined && value !== null).map(([key, value]) => ({ [key]: value })).reduce((a, b) => ({ ...a, ...b }), {});
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	static async genericEdit<T extends { get(id: number | string): Promise<any>; }, D extends Record<string, unknown>>(type: T, table: string, id: number | string, data: D): Promise<boolean> {
		if (Object.hasOwn(data, "updated_at")) delete data.updated_at;
		const keys = Object.keys(data).filter(val => val !== undefined && val !== null);
		const values = Object.values(data).filter(val => val !== undefined && val !== null);
		const res = await db.query<OkPacket>(`UPDATE ${table} SET ${keys.map((j, index) => `${j}=$${index + 2}`).join(", ")}, updated_at=CURRENT_TIMESTAMP(3) WHERE id = $1`, [id, ...values]);
		return res.rowCount >= 1;
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

	static parseBoolean(str: string, exact: true, def?: boolean): boolean | null;
	static parseBoolean(str?: string, exact?: false, def?: boolean): boolean;
	static parseBoolean(str?: string, exact = true, def = false) {
		return str === undefined || str === null ? def : ["true", "yes", "y"].includes(str) ? true : !exact ? false : ["false", "no", "n"].includes(str) ? false : null;
	}

	static parseWildcards(str: string) {
		return str.replace(/%/g, "\\%").replace(Config.wildcardCharacterRegex, "%");
	}

	static parseLimit(limit?: string | number, page: number | string = 1, user?: User): [limit: number, offset: number] {
		if (typeof limit !== "number") limit = Number(limit);
		if (isNaN(limit)) limit = user?.posts_per_page || Config.defaultPostLimit;
		if (limit === 0) limit = user?.posts_per_page || Config.defaultPostLimit;
		if (limit < Config.minPostLimit) limit = Config.minPostLimit;
		if (limit > Config.maxPostLimit) limit = Config.maxPostLimit;

		let offset = 0;
		if (typeof page === "string") {
			const [,type,num] = /^(a|b)(\d+)$/.exec(page) || [];
			switch (type) {
				case "a": offset = Number(num); break;
				case "b": offset = Number(num) - limit; break;
			}
		} else offset = (page - 1) * limit;

		return [limit, offset];
	}

	static toPGArray(values: Array<unknown>) {
		return `{${values.map(v => typeof v === "string" && (v.includes(",") || v.includes("}") ? `"${v}"` : v)).join(",")}}`;
	}

	static isValidNum(val: string) {
		const n = Number(val);
		return isNaN(n) ? false : n;
	}

	static parseOperator(str: string) {
		if (str.startsWith(">=")) return ["gteq", str.slice(2)] as const;
		if (str.startsWith("<=")) return ["lteq", str.slice(2)] as const;
		if (str.startsWith(">")) return ["gt", str.slice(1)] as const;
		if (str.startsWith("<")) return ["lt", str.slice(1)] as const;
		if (str.startsWith("=")) return ["eq", str.slice(1)] as const;
		let match: RegExpMatchArray | null;
		if ((match = /(\d+)\.\.(\d+)/.exec(str))) return ["range", match[1], match[2]] as const;
		return ["eq", str] as const;
	}
}
