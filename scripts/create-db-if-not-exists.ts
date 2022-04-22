import Config from "../src/config";
import { createConnection } from "mariadb";

const conn = await createConnection({
	host:               Config.dbHost,
	port:               Config.dbPort,
	user:               Config.dbUser,
	password:           Config.dbPassword,
	multipleStatements: true
});
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${Config.dbDatabase}\``);
await conn.end();
