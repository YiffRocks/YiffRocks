
import apiHeaders from "../../util/apiHeaders";
import Post from "../../db/Models/Post";
import { FileErros, GeneralErrors } from "../../logic/errors/API";
import { Router } from "express";

const app = Router();


app
	.route("/:id")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req, res) => {
		const id = Number(req.params.id);
		if (isNaN(id)) return res.status(400).json(GeneralErrors.INVALID_ID);
		const file = await Post.get(id);
		if (file === null) return res.status(404).json(FileErros.INVALID);

		return res.status(200).json(file.toJSON());
	});

export default app;
