import User from "../../db/Models/User";
import apiHeaders from "../../util/apiHeaders";
import { UserErrors } from "../../logic/errors/API";
import { Router } from "express";

const app = Router();


app
	.route("/:idOrName")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req, res) => {
		let user: User | null;
		const n = Number(req.params.idOrName);
		if (isNaN(n)) user = await User.getByName(req.params.idOrName);
		else user = await User.get(n);
		if (user === null) return res.status(404).json(UserErrors.INVALID);

		return res.status(200).json(req.data.user?.id === user.id ? user.toJSON("self") : user.toJSON());
	});

export default app;
