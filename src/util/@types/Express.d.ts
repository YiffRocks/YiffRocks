import type CurrentUser from "../../logic/CurrentUser";

declare global {
	namespace Express {
		interface Request {
			data: {
				user: CurrentUser;
			};
		}
	}
}
