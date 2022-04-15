/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../util/@types/Express.d.ts" />
/// <reference path="../util/@types/express-session.d.ts" />
import Config from "../config/index";
import User from "../db/Models/User";
import express from "express";
import morgan from "morgan";
const app = express();

app
	.set("trust proxy", true)
	.set("x-powered-by", false)
	.use(express.json())
	.use(express.urlencoded({ extended: true }))
	.use(morgan("dev"))
	.use(Config.sharedSession)
	.use(async(req, res, next) => {
		if (req.session && req.session.userID) {
			const user = await User.get(req.session.userID);
			if (user === null) req.session.userID = undefined;
			else req.data.user = user;
		}

		return next();
	})
	.use("/files", (await import("./routes/files")).default)
	.use("/post_versions", (await import("./routes/post_versions")).default)
	.use("/posts", (await import("./routes/posts")).default)
	.use("/users", (await import("./routes/users")).default);


app.listen(Config.apiPort, Config.apiHost, () => console.log("Listening on http://%s:%s", Config.apiHost, Config.apiPort));
