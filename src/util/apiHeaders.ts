import  { GeneralErrors } from "../logic/errors/API";
import type { NextFunction, Request, Response } from "express";

export default function apiHeaders(allowedMethods: Array<string>, allowedHeaders?: Array<string>, extraHeaders?: Record<string, string | Array<string>>) {
	return ((req: Request, res: Response, next: NextFunction) => {
		if (!res.headersSent) res.header({
			"Access-Control-Allow-Headers": [
				...(allowedHeaders ?? []),
				"Content-Type",
				"Authorization"
			].join(", "),
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": allowedMethods.join(", "),
			...(extraHeaders ?? {})
		});

		if (req.method === "OPTIONS") return res.status(204).end();
		if (!allowedMethods.includes(req.method)) return res.status(405).json(GeneralErrors.METHOD_NOT_ALLOWED);

		return next();
	});
}
