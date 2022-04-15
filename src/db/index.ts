import Config from "../config/index";
import type { Pool, QueryOptions } from "mariadb";
import { createPool } from "mariadb";
import Redis from "ioredis";

export interface OkPacket<T extends bigint | number = bigint> {
	affectedRows: number;
	insertId: T;
	warningStatus: number;
}
export default class db {
	static pool: Pool;
	static redis: Redis;
	static {
		this.pool = createPool({
			host:             Config.dbHost,
			port:             Config.dbPort,
			user:             Config.dbUser,
			password:         Config.dbPassword,
			ssl:              Config.dbSSL,
			database:         Config.dbDatabase,
			insertIdAsNumber: false
		});
		this.redis = new Redis(Config.redisPort, Config.redisHost, {
			username:         Config.redisUser,
			password:         Config.redisPassword,
			db:               Config.redisDb,
			connectionName:   "YiffRocks",
			enableReadyCheck: true
		});
	}

	static async insert(table: string, data: Record<string, unknown>, convertBigInt: true): Promise<OkPacket<number>>;
	static async insert(table: string, data: Record<string, unknown>, convertBigInt?: false): Promise<OkPacket<bigint>>;
	static async insert(table: string, data: Record<string, unknown>, convertBigInt = false) {
		const keys = Object.keys(data);
		const values = Object.values(data);
		const ok = await this.query<OkPacket<bigint | number>>(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${values.map(() => "?").join(", ")})`, values);
		if (convertBigInt) ok.insertId = Number(ok.insertId.toString());
		return ok;
	}

	static async delete(table: string, id: number | bigint, convertBigInt: true): Promise<OkPacket<number>>;
	static async delete(table: string, id: number | bigint, convertBigInt?: false): Promise<OkPacket<bigint>>;
	static async delete(table: string, id: number | bigint, convertBigInt = false) {
		const ok = await this.query<OkPacket<bigint | number>>(`DELETE FROM ${table} WHERE id = ?`, [id]);
		if (convertBigInt) ok.insertId = Number(ok.insertId.toString());
		return ok;
	}

	static async query<T = unknown>(sql: string | QueryOptions, values?: Array<unknown>) { return this.pool.query.call(this.pool, sql, values) as Promise<T>; }
}
