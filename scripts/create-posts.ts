import Config from "../src/config";
import Post from "../src/db/Models/Post";
import User from "../src/db/Models/User";
import type { Ratings } from "e621";
import E621 from "e621";
import fetch from "node-fetch";
import { assert } from "tsafe";

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

const postsEach = 10;
const sharedTags = " order:random score:>300 male -female solo -rating:e";
const adminUser = await User.get(1);
assert(adminUser !== null, "null admin user");

const e6 = new E621({
	userAgent: Config.userAgent
});

const videoPosts = await e6.posts.search({
	tags:  `type:webm ${sharedTags}`,
	limit: postsEach
});
for (const post of videoPosts) {
	console.log("Pulling down post #%d for video (%s)", post.id, post.file.url);
	const p = await Post.create({
		uploader_id: adminUser.id,
		rating:      convertRating(post.rating)
	});
	await p.approve(adminUser.id);
	await p.setTags(adminUser, null, Object.entries(post.tags).map(([category, tags]) => tags.map(t => `${category}:${t}`)).reduce((a, b) => a.concat(b), []).join(" "));
	const file = await downloadFile(post.file.url);
	await p.addFile(file);
	console.log("Created post #%d", p.id);
}

const gifPosts = await e6.posts.search({
	tags:  `type:gif ${sharedTags}`,
	limit: postsEach
});
for (const post of gifPosts) {
	console.log("Pulling down post #%d for gif (%s)", post.id, post.file.url);
	const p = await Post.create({
		uploader_id: adminUser.id,
		rating:      convertRating(post.rating)
	});
	await p.approve(adminUser.id);
	await p.setTags(adminUser, null, Object.entries(post.tags).map(([category, tags]) => tags.map(t => `${category}:${t}`)).reduce((a, b) => a.concat(b), []).join(" "));
	const file = await downloadFile(post.file.url);
	await p.addFile(file);
	console.log("Created post #%d", p.id);
}

const apngPosts = await e6.posts.search({
	tags:  `type:png animated ${sharedTags}`,
	limit: postsEach
});
for (const post of apngPosts) {
	console.log("Pulling down post #%d for apng (%s)", post.id, post.file.url);
	const p = await Post.create({
		uploader_id: adminUser.id,
		rating:      convertRating(post.rating)
	});
	await p.approve(adminUser.id);
	await p.setTags(adminUser, null, Object.entries(post.tags).map(([category, tags]) => tags.map(t => `${category}:${t}`)).reduce((a, b) => a.concat(b), []).join(" "));
	const file = await downloadFile(post.file.url);
	await p.addFile(file);
	console.log("Created post #%d", p.id);
}

const pngPosts = await e6.posts.search({
	tags:  `type:png ${sharedTags}`,
	limit: postsEach
});
for (const post of pngPosts) {
	console.log("Pulling down post #%d for png (%s)", post.id, post.file.url);
	const p = await Post.create({
		uploader_id: adminUser.id,
		rating:      convertRating(post.rating)
	});
	await p.approve(adminUser.id);
	await p.setTags(adminUser, null, Object.entries(post.tags).map(([category, tags]) => tags.map(t => `${category}:${t}`)).reduce((a, b) => a.concat(b), []).join(" "));
	const file = await downloadFile(post.file.url);
	await p.addFile(file);
	console.log("Created post #%d", p.id);
}

const jpegPosts = await e6.posts.search({
	tags:  `type:jpg ${sharedTags}`,
	limit: postsEach
});
for (const post of jpegPosts) {
	console.log("Pulling down post #%d for jpeg (%s)", post.id, post.file.url);
	const p = await Post.create({
		uploader_id: adminUser.id,
		rating:      convertRating(post.rating)
	});
	await p.approve(adminUser.id);
	await p.setTags(adminUser, null, Object.entries(post.tags).map(([category, tags]) => tags.map(t => `${category}:${t}`)).reduce((a, b) => a.concat(b), []).join(" "));
	const file = await downloadFile(post.file.url);
	await p.addFile(file);
	console.log("Created post #%d", p.id);
}

process.exit(0);
