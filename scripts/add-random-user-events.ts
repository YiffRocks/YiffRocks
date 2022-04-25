import db from "../src/db";
import type { PostData } from "../src/db/Models/Post";
import Post from "../src/db/Models/Post";
import type { UserData } from "../src/db/Models/User";
import User, { UserLevels } from "../src/db/Models/User";
import Util from "../src/util/Util";

// assuming a default development setup, the first users are just example users for the given roles
const users = (await db.query<UserData>(`SELECT * FROM users ORDER BY id OFFSET ${Util.enumKeys(UserLevels).length - 1}`)).rows.map(r => new User(r));

const removeAllCurrent = true;
if (removeAllCurrent) await db.query("UPDATE posts SET favorite_count = 0, score_up = 0, score_down = 0, score = 0; UPDATE users SET favorite_count = 0; TRUNCATE favorites; TRUNCATE post_votes;");
let totalFav = 0, totalUp = 0, totalDown = 0;
for (const user of users) {
	// add random votes
	if (Math.random() > 0.5) {
		const posts = (await db.query<PostData>("SELECT * FROM posts ORDER BY RANDOM() LIMIT 100")).rows.map(r => new Post(r));
		for (const post of posts) {
			const val = Math.random();
			if (val <= 0.45) {
				totalDown++;
				console.log("Adding Downvote As @%s (%d) on post #%d", user.name, user.id, post.id);
				await post.vote(user.id, "down");
			} else if (val <= 0.90) {
				totalUp++;
				console.log("Adding Upvote As @%s (%d) on post #%d", user.name, user.id, post.id);
				await post.vote(user.id, "up");
			} else continue;
		}
	}

	// add random favorites
	if (Math.random() > 0.5) {
		const { rows: posts } = (await db.query<{ id: number; }>("SELECT id FROM posts ORDER BY RANDOM() LIMIT 100"));
		for (const post of posts) {
			const val = Math.random();
			if (val <= 0.60) {
				totalFav++;
				console.log("Adding Favorite As @%s (%d) on post #%d", user.name, user.id, post.id);
				await user.addFavorite(post.id);
			} else continue;
		}
	}
}

console.log("Total Favorites Added: %d", totalFav);
console.log("Total Upvotes Added: %d", totalDown);
console.log("Total Downvotes Added: %d", totalUp);

process.exit(0);
