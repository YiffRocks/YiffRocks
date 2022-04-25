/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../util/@types/Express.d.ts" />
/// <reference path="../util/@types/express-session.d.ts" />
import Config from "../config/index";
import User from "../db/Models/User";
import ErrorHandler from "../logic/ErrorHandler";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import morgan from "morgan";
import { format } from "util";
const app = express();

app
	.set("trust proxy", true)
	.set("x-powered-by", false)
	.use(express.json())
	.use(express.urlencoded({ extended: true }))
	.use(morgan("dev"))
	.use(Config.sharedSession)
	.use(async(req, res, next) => {
		if (!req.data) req.data = {};
		if (req.session && req.session.userID) {
			const user = await User.get(req.session.userID);
			if (user === null) req.session.userID = undefined;
			else req.data.user = user;
		}

		return next();
	})
	.use("/favorites", (await import("./routes/favorites")).default)
	.use("/files", (await import("./routes/files")).default)
	.use("/post_versions", (await import("./routes/post_versions")).default)
	.use("/posts", (await import("./routes/posts")).default)
	.use("/tag_versions", (await import("./routes/tag_versions")).default)
	.use("/tags", (await import("./routes/tags")).default)
	.use("/users", (await import("./routes/users")).default)
	.use(async(err: Error, req: Request, res: Response, next: NextFunction) => {
		const h = await ErrorHandler.handle("Router Error", err);
		if (res.headersSent) return next(err);
		return res.status(500).json({
			error: "Internal Server Error",
			code:  500,
			log:   h
		});
	});

if (Config.isDevelopment) app.use("/data", express.static(`${Config.tmpDir}/public`));

app.listen(Config.apiPort, Config.apiHost, () => console.log("Listening on http://%s:%s", Config.apiHost, Config.apiPort));

process
	.on("uncaughtException", (err) => ErrorHandler.handle("Uncaught Exception", err))
	.on("unhandledRejection", (err) => err instanceof Error ? ErrorHandler.handle("Unhandled Rejection", err) : ErrorHandler.handle("unhandledRejection", format(err), new Error()));
