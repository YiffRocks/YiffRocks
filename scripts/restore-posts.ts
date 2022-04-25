import Post from "../src/db/Models/Post";
import User from "../src/db/Models/User";
import type { Ratings , PostProperties } from "e621";
import { assert } from "tsafe";
import { access, mkdir, readFile } from "fs/promises";

const __dirname = new URL(".", import.meta.url).pathname;
const { posts, child: childPosts, parent: parentPosts } = JSON.parse((await readFile(`${__dirname}/../test/posts.json`)).toString()) as {
	posts: Array<PostProperties>;
	child: Record<number, PostProperties>;
	parent: Record<number, PostProperties>;
}
;
const convertRating = (r: Ratings) => r === "s" ? "safe" : r === "q" ? "questionable" : r === "e" ? "explicit" : "unknown" as never;

const adminUser = await User.get(1);
assert(adminUser !== null, "null admin user");

const saveResults = true;
if (saveResults) if (!await access(`${__dirname}/../test/post_files`).then(() => true, () => false)) await mkdir(`${__dirname}/../test/post_files`);
const downloadedPosts: Array<number> = [];
async function addPost(type: string, post: PostProperties) {
	if (!downloadedPosts.includes(post.id)) {
		console.log("Restoring post #%d for %s (%s)", post.id, type, post.file.url);
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
		const file = await readFile(`${__dirname}/../test/post_files/${Buffer.from(post.file.url).toString("base64")}`);
		await p.setFile(file);
		downloadedPosts.push(post.id);
		console.log("Restored post #%d", p.id);
		if (post.relationships.children.length > 0) {
			for (const child of post.relationships.children) {
				const childPost = childPosts[child];
				if (childPost && childPost.file.ext !== "swf" && !downloadedPosts.includes(childPost.id) && !childPost.flags.deleted) {
					const { id } = await addPost(`${type} (child of #${p.id})`, childPost);
					await p.addChild(id);
				}
			}
		}
		if (post.relationships.parent_id) {
			const parent = parentPosts[post.relationships.parent_id];
			if (parent && parent.file.ext !== "swf" && !downloadedPosts.includes(parent.id) && !parent.flags.deleted) {
				const { id } = await addPost(`${type} (parent of #${p.id})`, parent);
				await p.setParent(id, adminUser!.id, null, true);
			}
		}
		return p;
	} else return { id: 0 };
}

const videoPosts = posts.filter(p => p.file.ext === "webm");
for (const post of videoPosts) await addPost("video", post);

const gifPosts = posts.filter(p => p.file.ext === "gif");
for (const post of gifPosts)  await addPost("gif", post);

const apngPosts = posts.filter(p => p.file.ext === "apng");
for (const post of apngPosts) await addPost("apng", post);

const pngPosts = posts.filter(p => p.file.ext === "png");
for (const post of pngPosts) await addPost("png", post);

const jpegPosts = posts.filter(p => p.file.ext === "jpg");
for (const post of jpegPosts) await addPost("jpeg", post);

process.exit(0);
