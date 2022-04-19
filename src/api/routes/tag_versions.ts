
import apiHeaders from "../../util/apiHeaders";
import { GeneralErrors, TagVersionErrors } from "../../logic/errors/API";
import TagVersion from "../../db/Models/TagVersion";
import { Router } from "express";

const app = Router();


app.route("/:id")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req, res) => {
		const id = Number(req.params.id);
		if (isNaN(id)) return res.status(400).json(GeneralErrors.INVALID_ID);
		const tagVersion = await TagVersion.get(id);
		if (tagVersion === null) return res.status(404).json(TagVersionErrors.INVALID.toJSON());

		return res.status(200).json(await tagVersion.toJSON());
	});

export default app;
