import type User from "../../db/Models/User";

declare global {
	namespace Express {
		interface Request {
			data: {
				user?: User;
			};
		}
	}
}
