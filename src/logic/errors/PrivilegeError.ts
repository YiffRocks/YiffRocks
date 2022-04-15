import { UserLevels } from "../../db/Models/User";
import Util from "../../util/Util";

export default class PrivilegeError extends Error {
	name = "PrivilegeError";
	current: UserLevels;
	required: UserLevels;
	constructor(action: string, description: string, current: UserLevels, required: UserLevels) {
		super(`You do not have permission to perform "${action}" on "${description}". You are ${Util.normalizeConstant(UserLevels[current])}, and you need to be at least ${Util.normalizeConstant(UserLevels[required])}.`);
		this.current = current;
		this.required = required;
	}
}
