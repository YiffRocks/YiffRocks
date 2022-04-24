import Config from "../src/config";
import Post from "../src/db/Models/Post";
import User from "../src/db/Models/User";
import E621 from "e621";
import type { Ratings } from "e621";
import { assert } from "tsafe";
import fetch from "node-fetch";
async function downloadFile(url: string): Promise<Buffer> {
	try {
		const c = new AbortController();
		const t = setTimeout(() => c.abort(), 1e4);
		return fetch(url, { signal: c.signal }).then(async(res) => {
			clearTimeout(t);
			return Buffer.from(await res.arrayBuffer());
		}).catch(() => downloadFile(url));
	} catch {
		return downloadFile(url);
	}
}
const convertRating = (r: Ratings) => r === "s" ? "safe" : r === "q" ? "questionable" : r === "e" ? "explicit" : "unknown" as never;

const adminUser = await User.get(1);
assert(adminUser !== null, "null admin user");

const e6 = new E621({
	userAgent: Config.userAgent
});

const posts = (await (await e6.pools.get(8368))!.getPosts());
console.log(posts);
let lastPost: number | undefined;
for (const post of posts) {
	console.log("Importing post #%d (%s)", post.id, post.file.url);
	const p = await Post.create({
		uploader_id: adminUser.id,
		rating:      convertRating(post.rating),
		sources:     [...post.sources, `https://e621.net/posts/${post.id}`, post.file.url],
		description: post.description
	});
	await p.approve(adminUser.id);
	await p.setTags(adminUser, null, Object.entries(post.tags).map(([category, tags]) => tags.map(t => `${category}:${t}`)).reduce((a, b) => a.concat(b), []).join(" "));
	const file = await downloadFile(post.file.url);
	await p.setFile(file);
	if (lastPost) await p.setParent(lastPost, adminUser.id);
	lastPost = p.id;
	console.log("Created post #%d", p.id);
}

process.exit(0);
