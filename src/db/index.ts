import Config from "../config";
import type { QueryConfig, QueryResultRow } from "pg";
import pg from "pg";
import Redis from "ioredis";
import debug from "debug";

const dbLog = debug("yiff-rocks:db:postgres:query");
const redisLog = debug("yiff-rocks:db:redis");
export interface OkPacket<T extends bigint | number = bigint> {
	affectedRows: number;
	insertId: T;
	warningStatus: number;
}

export interface CountResult { count: string; }


export default class db {
	static dbClient: pg.Client;
	static redis: Redis;
	private static ready = false;
	// because of some weird circular import nonsense this has to be done this way
	static async initIfNotReady() {
		if (this.ready) return;

		this.dbClient = new pg.Client({
			host:             Config.dbHost,
			port:             Config.dbPort,
			user:             Config.dbUser,
			password:         Config.dbPassword,
			database:         Config.dbDatabase,
			ssl:              Config.dbSSL,
			application_name: "Yiff Rocks"
		});
		debug("yiff-rocks:db:postgres:connect")("Connecting...");
		const dbStart = process.hrtime.bigint();
		await this.dbClient.connect();
		const dbEnd = process.hrtime.bigint();
		debug("yiff-rocks:db:postgres:connected")("Connected in %sms.", ((dbEnd - dbStart) / 100000n).toString());
		this.redis = new Redis(Config.redisPort, Config.redisHost, {
			username:         Config.redisUser,
			password:         Config.redisPassword,
			db:               Config.redisDb,
			connectionName:   "YiffRocks",
			enableReadyCheck: true
		});
		this.ready = true;
	}

	static async insert<T extends number | string = number | string>(table: string, data: Record<string, unknown>) {
		await this.initIfNotReady();
		const keys = Object.keys(data);
		const values = Object.values(data);
		const { rows: [res] } = await this.query<{ id: T; }>(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${values.map((val, index) => `$${index + 1}`).join(", ")}) RETURNING id`, values);
		return res.id;
	}

	static async delete(table: string, id: number | string) {
		await this.initIfNotReady();
		const res = await this.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
		return res.rowCount >= 1;
	}

	static async query<R extends QueryResultRow, I extends Array<unknown> = Array<unknown>>(queryTextOrConfig: string | QueryConfig<I>, values?: I | undefined) {
		void this.initIfNotReady();
		dbLog(queryTextOrConfig);
		return this.dbClient.query<R, I>(queryTextOrConfig, values);
	}
}
