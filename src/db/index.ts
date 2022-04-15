import Config from "../config/index";
import type { Pool, QueryOptions } from "mariadb";
import { createPool } from "mariadb";
import Redis from "ioredis";

export interface OkPacket {
	affectedRows: number;
	insertId: number;
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
			insertIdAsNumber: true
		});
		this.redis = new Redis(Config.redisPort, Config.redisHost, {
			username:         Config.redisUser,
			password:         Config.redisPassword,
			db:               Config.redisDb,
			connectionName:   "YiffRocks",
			enableReadyCheck: true
		});
	}

	static async insert(table: string, data: Record<string, unknown>) {
		const keys = Object.keys(data);
		const values = Object.values(data);
		return this.query<OkPacket>(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${values.map(() => "?").join(", ")})`, values);
	}

	static async delete(table: string, id: number) {
		return this.query<OkPacket>(`DELETE FROM ${table} WHERE id = ?`, [id]);
	}

	static async query<T = unknown>(sql: string | QueryOptions, values?: Array<unknown>) { return this.pool.query.call(this.pool, sql, values) as Promise<T>; }
}
