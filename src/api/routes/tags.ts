
import apiHeaders from "../../util/apiHeaders";
import { GeneralErrors, TagErrors } from "../../logic/errors/API";
import Tag from "../../db/Models/Tag";
import TagVersion from "../../db/Models/TagVersion";
import Util from "../../util/Util";
import type { Request } from "express";
import { Router } from "express";

const app = Router();

app.route("/")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req: Request<never, unknown, never, {
		name?: string;
		category?: string;
		post_count?: string;
		locked?: string;
		limit?: string;
		page?: string;
		id_only?: string;
	}>, res) => {
		const idOnly = Util.parseBoolean(req.query.id_only);
		const [limit, offset] = Util.parseLimit(req.query.limit, req.query.page);
		const searchResult = await Tag.search({
			name:       !req.query.name         ? undefined : req.query.name,
			category:   !req.query.category     ? undefined : Number(req.query.category),
			post_count: !req.query.post_count   ? undefined : req.query.post_count,
			locked:     !req.query.locked       ? undefined : Util.parseBoolean(req.query.locked)
		}, !req.query.limit ? undefined : limit, !req.query.page ? undefined : offset, idOnly as false);
		if (idOnly) return res.status(200).json(searchResult);
		const tags = await Promise.all(searchResult.map(p => p.toJSON()));
		if (tags.length === 0) return res.status(200).json([]);
		return res.status(200).json(tags);
	});

app
	.route("/:idOrName")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req, res) => {
		let tag: Tag | null;
		const n = Number(req.params.idOrName);
		if (isNaN(n)) tag = await Tag.getByName(req.params.idOrName);
		else tag = await Tag.get(n);
		if (tag === null) return res.status(404).json(TagErrors.INVALID);

		return res.status(200).json(tag.toJSON());
	});

app.route("/:idOrName/versions")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req, res) => {
		let tagVersions: Array<TagVersion>;
		const n = Number(req.params.idOrName);
		if (isNaN(n)) tagVersions = tagVersions = await TagVersion.getForTagName(req.params.idOrName);
		else tagVersions = await TagVersion.getForTag(Number(req.params.idOrName));
		if (!tagVersions || tagVersions.length === 0) return res.status(404).json(TagErrors.INVALID);
		return res.status(200).json(await Promise.all(tagVersions.map(async(v) => v.toJSON())));
	});

app.route("/:idOrName/versions/:revision")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req, res) => {
		const revision = Number(req.params.revision);
		if (isNaN(revision)) return res.status(400).json(GeneralErrors.INVALID_ID);
		let tagVersion: TagVersion | null;
		const n = Number(req.params.idOrName);
		if (isNaN(n)) tagVersion = await TagVersion.getForTagNameAndRevision(req.params.idOrName, revision);
		else tagVersion = await TagVersion.getForTagAndRevision(Number(req.params.idOrName), revision);
		if (tagVersion === null) return res.status(404).json(TagErrors.INVALID);
		return res.status(200).json(await tagVersion.toJSON());
	});

export default app;
