
import apiHeaders from "../../util/apiHeaders";
import { GeneralErrors, PostVersionErrors } from "../../logic/errors/API";
import PostVersion from "../../db/Models/PostVersion";
import { Router } from "express";

const app = Router();


app.route("/:id")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req, res) => {
		const id = Number(req.params.id);
		if (isNaN(id)) return res.status(400).json(GeneralErrors.INVALID_ID);
		const postVersion = await PostVersion.get(id);
		if (postVersion === null) return res.status(404).json(PostVersionErrors.INVALID);

		return res.status(200).json(await postVersion.toJSON());
	});

export default app;
