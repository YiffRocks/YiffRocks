import db from "../src/db";
import User, { UserLevels } from "../src/db/Models/User";
import Util from "../src/util/Util";

const currentUsers = (await db.query<{ name: string; }>("SELECT name from users")).rows.reduce((a, b) => a.concat(b.name), [] as Array<string>);
const levels = Util.enumKeys(UserLevels).reverse().map(lvl => lvl.toLowerCase());
for (const level of levels) {
	if (currentUsers.includes(level)) continue;
	const user = await User.create({
		name:  level,
		level: UserLevels[level.toUpperCase() as keyof typeof UserLevels]
	});
	console.log(`Created ${level} user: ${level} (${user.id})`);
}

console.log("\n\n");

for (let i = 0; i < 25; i++) {
	const name = Math.random().toString(36).slice(2, (Math.random() * 6) + 7);
	const user = await User.create({
		name,
		level: UserLevels.MEMBER
	});
	console.log(`Created random user #${i + 1}: ${name} (${user.id})`);
}

process.exit(0);
