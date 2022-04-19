
import apiHeaders from "../../util/apiHeaders";
import { GeneralErrors, TagErrors } from "../../logic/errors/API";
import Tag from "../../db/Models/Tag";
import TagVersion from "../../db/Models/TagVersion";
import { Router } from "express";

const app = Router();


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
