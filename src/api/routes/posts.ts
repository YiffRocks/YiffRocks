
import apiHeaders from "../../util/apiHeaders";
import type { RatingLocks, Ratings } from "../../db/Models/Post";
import Post, { PostFlags, VALID_RATINGS, VALID_RATING_LOCKS } from "../../db/Models/Post";
import { GeneralErrors, PostErrors, UserErrors } from "../../logic/errors/API";
import PostVersion from "../../db/Models/PostVersion";
import Config from "../../config/index";
import ProxyRequest from "../../util/ProxyRequest";
import Util from "../../util/Util";
import File from "../../db/Models/File";
import authCheck from "../../util/authCheck";
import PostVote from "../../db/Models/PostVote";
import { UserLevels } from "../../db/Models/User";
import type { Request } from "express";
import { Router } from "express";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { assert } from "tsafe";
import { existsSync } from "fs";
import { execSync } from "child_process";

const app = Router();


app.route("/:id")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req, res) => {
		const id = Number(req.params.id);
		if (isNaN(id)) return res.status(400).json(GeneralErrors.INVALID_ID);
		const post = await Post.get(id);
		if (post === null) return res.status(404).json(PostErrors.INVALID);

		return res.status(200).json(await post.toJSON());
	});

app.route("/:id/version/:revision")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req, res) => {
		const id = Number(req.params.id);
		if (isNaN(id)) return res.status(400).json(GeneralErrors.INVALID_ID);
		const revision = Number(req.params.revision);
		if (isNaN(revision)) return res.status(400).json(GeneralErrors.INVALID_ID);
		const postVersion = await PostVersion.getByPostAndRevision(id, revision);
		if (postVersion === null) return res.status(404).json(PostErrors.INVALID_REVISION);

		return res.status(200).json(await postVersion.toJSON());
	});

app.route("/:id/votes")
	.all(apiHeaders(["OPTIONS", "PUT"]), authCheck("json"))
	.put(async(req: Request<{ id: string; }, unknown, { type: PostVote["type"]; }>, res) => {
		assert(req.data.user !== undefined, "undefined user");
		const type = req.body.type;
		if (!["down", "none", "up"].includes(type)) return res.status(400).json(PostErrors.INVALID_VOTE_TYPE);
		const id = Number(req.params.id);
		if (isNaN(id)) return res.status(400).json(GeneralErrors.INVALID_ID);
		const post = await Post.get(id);
		if (post === null) return res.status(404).json(PostErrors.INVALID);
		const prev = await PostVote.getForPostAndUser(req.data.user.id, post.id);
		if (prev === null) {
			if (type === "none") return res.status(204).end();
			const vote = await PostVote.create({
				user_id:    req.data.user.id,
				post_id:    post.id,
				type,
				ip_address: req.ip
			});
			return res.status(201).json(await vote.toJSON(true));
		} else {
			await prev.edit({
				type: type === prev.type ? "none" : type
			});
			return res.status(200).json(await prev.toJSON(true));
		}
	});


// @TODO auth
if (!existsSync(Config.uploadDir)) execSync(`mkdir -p ${Config.uploadDir}`);
const uploader = multer({ dest: Config.uploadDir });
app.route("/upload")
	.all(apiHeaders(["OPTIONS", "POST"]), authCheck("json"))
	.post(uploader.single("image"), async(req: Request<never, unknown, {
		url?: string;
		tags: string;
		sources?: string;
		rating: Ratings;
		rating_lock?: RatingLocks;
		parent?: number;
		title?: string;
		description?: string;
		upload_as_approved?: boolean;
	}>, res) => {
		assert(req.data.user !== undefined, "undefined user");
		let file: Buffer;
		if (req.file) file = req.file.buffer;
		else if (req.body.url) {
			if (!Config.urlRegex.test(req.body.url)) return res.status(400).json(GeneralErrors.INVALID_URL);
			const img = await ProxyRequest.get(req.body.url);
			file = Buffer.from(await img.body.arrayBuffer());
		} else return res.status(400).json(PostErrors.UPLOAD_NO_FILE_OR_URL);
		const type = await fileTypeFromBuffer(file);
		if (!type) return res.status(400).json(GeneralErrors.CORRUPT_FILE);
		if (!Config.allowedMimeTypes.includes(type.mime)) return res.status(400).json(PostErrors.INVALID_FILE_TYPE.format(type.mime));
		const hash = Util.md5(file);
		const exists = await File.getByMD5(hash);
		if (exists !== null) return res.status(400).json(PostErrors.DUPLICATE_UPLOAD.withExtra({ post: exists.id }));

		const tags = req.body.tags?.split(" ");
		if (!tags || tags.length === 0) return res.status(400).json(PostErrors.NO_TAGS);
		// @TODO maximum physical tag length so they can't just make tags with 100,000 characters
		if (tags.length < Config.minPostTags) return res.status(400).json(PostErrors.MINIMUM_TAGS);
		if (tags.length > Config.maxPostTags) return res.status(400).json(PostErrors.MAXIMUM_TAGS);
		// @TODO create tags, update tag categories, change aliases, apply implications

		let sources: Array<string> = [];
		if (req.body.sources) {
			sources = req.body.sources.split("\n");
			// @TODO maximum source length (individual & total)
			sources.forEach(s => {
				if (!Config.urlRegex.test(s)) return res.status(400).json(PostErrors.INVALID_SOURCE.format(s));
			});
		}
		if (!VALID_RATINGS.includes(req.body.rating)) return res.status(400).json(PostErrors.INVALID_RATING.format(req.body.rating));
		if (req.body.rating_lock && !req.data.user.isAtLeastPrivileged) return res.status(403).json(UserErrors.HIGHER_LEVEL_REQUIRED.withExtra({ current: req.data.user.level, required: UserLevels.PRIVILEGED }, "use rating locks", req.data.user.level, UserLevels.PRIVILEGED));
		if (req.body.rating_lock && !VALID_RATING_LOCKS.includes(req.body.rating_lock)) return res.status(400).json(PostErrors.INVALID_RATING_LOCK.format(req.body.rating_lock));
		let parent: Post | null = null;
		if (req.body.parent) {
			const id = Number(req.body.parent);
			if (isNaN(id)) return res.status(400).json(GeneralErrors.INVALID_ID);
			const parentPost = await Post.get(id);
			if (parentPost === null) return res.status(400).json(PostErrors.INVALID_PARENT.format(String(req.body.parent)));
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			parent = parentPost;
		}

		if (req.body.upload_as_approved && !req.data.user.isApprover) return res.status(403).json(UserErrors.HIGHER_LEVEL_REQUIRED.withExtra({ current: req.data.user.level, required: UserLevels.PRIVILEGED }, "approve posts", req.data.user.level, UserLevels.PRIVILEGED));

		// @TODO title & description max size

		// @TODO parenting posts, set as parent on current post and tell other post it's a parent now
		const post = await Post.create({
			uploader_id: req.data.user.id,
			tags:        "",
			sources:     [
				...sources,
				...(req.body.url ? [req.body.url] : [])
			].join("\n"),
			rating:      req.body.rating,
			rating_lock: req.body.rating_lock || null,
			// parent:      parent === null ? null : parent.id,
			title:       req.body.title || "",
			description: req.body.description || "",
			flags:       req.body.upload_as_approved ? 0 : PostFlags.PENDING
		});
		await post.setTags(req.data.user, req.ip, req.body.tags);
		await req.data.user.incrementStat("upload_count");

		return res.status(201).json(await post.toJSON());
	});

export default app;
