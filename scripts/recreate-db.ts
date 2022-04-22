process.env.YIFFROCKS_ENABLE_MULTISTATEMENTS = "1";
import "./create-db-if-not-exists";
import db from "../src/db";
import Config from "../src/config";
import { readdir, readFile } from "fs/promises";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tables = (await db.query<Array<{ TABLE_NAME: string; }>>("SELECT TABLE_NAME FROM information_schema.TABLES where TABLE_SCHEMA = ?", [Config.dbDatabase])).map(t => t.TABLE_NAME);
for (const t of tables) {
	console.log("Dropping table %s", t);
	await db.query(`SET foreign_key_checks = 0; DROP TABLE ${t}; SET foreign_key_checks = 0`);
}
const migrations = (await Promise.all((await readdir(`${__dirname}/../src/db/migrations`)).map(async(m) => [m, (await readFile(`${__dirname}/../src/db/migrations/${m}`)).toString()] as [string, string]))).sort((a,b) => Number(a[0].split("_")[0]) -  Number(b[0].split("_")[0]));
for (const [name, code] of migrations) {
	console.log("Executing migration %s", name);
	await db.query(code);
}

process.exit(0);
