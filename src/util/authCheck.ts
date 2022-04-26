import Util from "./Util";
import { GeneralErrors, UserErrors } from "../logic/errors/API";
import User, { UserLevels } from "../db/Models/User";
import Config from "../config";
import type { NextFunction, Request, Response } from "express";

export default function authCheck(responseType: "json" | "html", requiredLevel = UserLevels.MEMBER) {
	return (async (req: Request, res: Response, next: NextFunction) => {
		if (!req.data.user.isPresent && Config.isDevelopment) req.data.user.setUser(await User.get(1) as User);

		if (!req.data.user.isPresent) {
			if (responseType === "json") return res.status(401).json(GeneralErrors.AUTH_REQUIRED);
			else return res.redirect(`/login?url=${req.originalUrl}&authFail=true`);
		} else if (!req.data.user.isLevelAtLeast(requiredLevel)) {
			if (responseType === "json") return res.status(403).json(UserErrors.HIGHER_LEVEL_REQUIRED.withExtra({ current: req.data.user.level, required: requiredLevel }, `${req.method} ${req.originalUrl.split("?")[0]}`, req.data.user.level, requiredLevel));
			// @TODO proper error page
			else return res.status(403).end(`You must be at least ${Util.normalizeConstant(UserLevels[requiredLevel])}, but you're only ${Util.normalizeConstant(UserLevels[req.data.user.level])}.`);
		}

		return next();
	});
}
