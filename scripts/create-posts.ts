import Config from "../src/config";
import Post from "../src/db/Models/Post";
import User from "../src/db/Models/User";
import type { Ratings , Post as E621Post, PostProperties } from "e621";
import E621 from "e621";
import fetch from "node-fetch";
import { assert } from "tsafe";
import { access, mkdir, writeFile } from "fs/promises";

async function downloadFile(url: string): Promise<Buffer> {
	try {
		const c = new AbortController();
		const t = setTimeout(() => c.abort(), 1e4);
		return fetch(url, { signal: c.signal }).then(async(res) => {
			clearTimeout(t);
			const buf = Buffer.from(await res.arrayBuffer());
			if (saveResults) await writeFile(`${__dirname}/../test/post_files/${Buffer.from(url).toString("base64")}`, buf);
			return buf;
		}).catch(() => downloadFile(url));
	} catch {
		return downloadFile(url);
	}
}
const convertRating = (r: Ratings) => r === "s" ? "safe" : r === "q" ? "questionable" : r === "e" ? "explicit" : "unknown" as never;
const __dirname = new URL(".", import.meta.url).pathname;

const postsEach = 25;
const sharedTags = " order:random score:>300 male -female solo -young -scat -watersports -vore -gore -diaper";
const adminUser = await User.get(1);
assert(adminUser !== null, "null admin user");

const e6 = new E621({
	userAgent:      Config.userAgent,
	requestTimeout: 300
});

const saveResults = true;
if (saveResults) if (!await access(`${__dirname}/../test/post_files`).then(() => true, () => false)) await mkdir(`${__dirname}/../test/post_files`);
const rawPosts = {
	posts:  [] as Array<PostProperties>,
	child:  {} as Record<number, PostProperties>,
	parent: {} as Record<number, PostProperties>
};
// this will download and add all parent & child posts, even nested ones, so post numbers can easily multiply from 2 or 3x
const downloadedPosts: Array<number> = [];
async function addPost(type: string, post: E621Post, noSave = false) {
	if (!downloadedPosts.includes(post.id)) {
		console.log("Pulling down post #%d for %s (%s)", post.id, type, post.file.url);
		const p = await Post.create({
			uploader_id: adminUser!.id,
			rating:      convertRating(post.rating),
			sources:     [...post.sources, `https://e621.net/posts/${post.id}`, post.file.url],
			description: post.description,
			title:       `Post #${post.id} - Imported From E621`
		});
		await p.approve(adminUser!.id);
		await p.setTags(adminUser!, null, Object.entries(post.tags).map(([category, tags]) => tags.map(t => `${category}:${t}`)).reduce((a, b) => a.concat(b), []).join(" "), true);
		if (post.locked_tags.length > 0) await p.setLockedTags(adminUser!, null, post.locked_tags.join(" "), true);
		const file = await downloadFile(post.file.url);
		await p.setFile(file);
		if (saveResults && !noSave) rawPosts.posts.push(post);
		downloadedPosts.push(post.id);
		console.log("Created post #%d", p.id);
		if (post.relationships.children.length > 0) {
			const childPosts = await e6.posts.search({ tags: `parent:${post.id}` });
			for (const child of childPosts) {
				if (child.file.ext !== "swf" && !downloadedPosts.includes(child.id) && !child.flags.deleted) {
					if (saveResults) rawPosts.child[child.id] = child;
					const { id } = await addPost(`${type} (child of #${p.id})`, child, true);
					await p.addChild(id);
				}
			}
		}
		if (post.relationships.parent_id) {
			const parent = await e6.posts.get(post.relationships.parent_id);
			if (parent && parent.file.ext !== "swf" && !downloadedPosts.includes(parent.id) && !parent.flags.deleted) {
				rawPosts.parent[post.id] = parent;
				const { id } = await addPost(`${type} (parent of #${p.id})`, parent, true);
				await p.setParent(id, adminUser!.id, null, true);
			}
		}
		return p;
	} else return { id: 0 };
}

const videoPosts = await e6.posts.search({
	tags:  `type:webm ${sharedTags}`,
	limit: postsEach
});
for (const post of videoPosts) await addPost("video", post);

const gifPosts = await e6.posts.search({
	tags:  `type:gif ${sharedTags}`,
	limit: postsEach
});
for (const post of gifPosts)  await addPost("gif", post);

const apngPosts = await e6.posts.search({
	// we can't really filter much here because e621 has less than 50 of these
	tags:  "type:png animated order:random male -female solo",
	limit: postsEach
});
for (const post of apngPosts) await addPost("apng", post);

const pngPosts = await e6.posts.search({
	tags:  `type:png ${sharedTags}`,
	limit: postsEach
});
for (const post of pngPosts) await addPost("png", post);

const jpegPosts = await e6.posts.search({
	tags:  `type:jpg ${sharedTags}`,
	limit: postsEach
});
for (const post of jpegPosts) await addPost("jpeg", post);

if (saveResults) await writeFile(`${__dirname}/../test/posts.json`, JSON.stringify(rawPosts));

process.exit(0);
