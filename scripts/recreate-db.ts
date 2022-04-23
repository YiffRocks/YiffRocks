process.env.YIFFROCKS_ENABLE_MULTISTATEMENTS = "1";
import db from "../src/db";
import { readdir, readFile } from "fs/promises";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tables = (await db.query<{ tablename: string; }>("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'")).rows.map(t => t.tablename);
const types = (await db.query<{ typname: string; }>("SELECT t.typname FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid")).rows.map(t => t.typname);
for (const t of tables) {
	console.log("Dropping table %s", t);
	await db.query(`DROP TABLE ${t} CASCADE`);
}

const dropped: Array<string> = [];
for (const t of types) {
	if (dropped.includes(t)) continue;
	dropped.push(t);
	console.log("Dropping type %s", t);
	await db.query(`DROP TYPE ${t}`);
}
const migrations = (await Promise.all((await readdir(`${__dirname}/../src/db/migrations`)).map(async(m) => [m, (await readFile(`${__dirname}/../src/db/migrations/${m}`)).toString()] as [string, string]))).sort((a,b) => Number(a[0].split("_")[0]) -  Number(b[0].split("_")[0]));
for (const [name, code] of migrations) {
	console.log("Executing migration %s", name);
	await db.query(code);
}

process.exit(0);
