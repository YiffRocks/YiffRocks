import { GeneralErrors } from "../logic/errors/API";
import type { NextFunction, Request, Response } from "express";

export default function authCheck(responseType: "json" | "html") {
	return (async (req: Request, res: Response, next: NextFunction) => {
		// @TODO auth checks
		// eslint-disable-next-line no-constant-condition
		if (false) {
			if (responseType === "json") return res.status(401).json(GeneralErrors.AUTH_REQUIRED);
			else return res.redirect(`/login?url=${req.originalUrl}&authFail=true`);
		} else return next();
	});
}
