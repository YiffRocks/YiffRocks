
import apiHeaders from "../../util/apiHeaders";
import authCheck from "../../util/authCheck";
import { GeneralErrors, PostErrors, UserErrors } from "../../logic/errors/API";
import User from "../../db/Models/User";
import Post from "../../db/Models/Post";
import { Router } from "express";
import { assert } from "tsafe";

const app = Router();


app.route("/")
	.all(apiHeaders(["OPTIONS", "GET"]), authCheck("json"))
	.get(async(req, res) => {
		assert(req.data.user !== undefined, "undefined user");
		return res.status(200).json((await req.data.user.getFavorites()).map(v => v.toJSON()));
	});

app.route("/:id")
	.all(apiHeaders(["OPTIONS", "GET"]), authCheck("json"))
	.get(async(req, res) => {
		assert(req.data.user !== undefined, "undefined user");
		const id = Number(req.params.id);
		if (isNaN(id)) return res.status(400).json(GeneralErrors.INVALID_ID);
		if (req.data.user.id === id) return res.status(200).json((await req.data.user.getFavorites()).map(v => v.toJSON()));
		const user = await User.get(id);
		if (user === null) return res.status(404).json(UserErrors.INVALID);
		if (user.privacyMode) return res.status(403).json(UserErrors.PRIVACY_MODE);
		return res.status(200).json((await user.getFavorites()).map(v => v.toJSON()));
	});

app.route("/add/:id")
	.all(apiHeaders(["OPTIONS", "PUT"]), authCheck("json"))
	.put(async(req, res) => {
		assert(req.data.user !== undefined, "undefined user");
		const id = Number(req.params.id);
		if (isNaN(id)) return res.status(400).json(GeneralErrors.INVALID_ID);
		const post = await Post.get(id);
		if (post === null) return res.status(404).json(PostErrors.INVALID);
		const fav = await req.data.user.addFavorite(id);
		if (fav === null) return res.status(400).json(UserErrors.ALREADY_FAVORITED);
		return res.status(201).json(await fav.toJSON());
	});

app.route("/remove/:id")
	.all(apiHeaders(["OPTIONS", "PUT"]), authCheck("json"))
	.put(async(req, res) => {
		assert(req.data.user !== undefined, "undefined user");
		const id = Number(req.params.id);
		if (isNaN(id)) return res.status(400).json(GeneralErrors.INVALID_ID);
		const post = await Post.get(id);
		if (post === null) return res.status(404).json(PostErrors.INVALID);
		const fav = await req.data.user.removeFavorite(id);
		if (fav) return res.status(204).end();
		return res.status(400).json(UserErrors.NOT_FAVORITED);
	});

export default app;
