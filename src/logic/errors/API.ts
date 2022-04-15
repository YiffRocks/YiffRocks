import Config from "../../config/index";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class APIError<T extends string | ((... args: Array<any>) => string)> extends Error {
	name = "APIError";
	code: number;
	msg: T;
	constructor(code: number, msg: T) {
		super(typeof msg === "string" ? msg : "functional message");
		this.name = `APIError[${code}]`;
		this.code = code;
		this.msg = msg;
	}

	toJSON() {
		return {
			code:    this.code,
			message: this.message
		};
	}

	format(...args: T extends string ? [] : Parameters<Exclude<T, string>>) {
		return {
			code:    this.code,
			message: typeof this.msg === "string" ? this.msg : this.msg(...args)
		};
	}

	withExtra(extra: Record<string, unknown>, ...args: T extends string ? [] : Parameters<Exclude<T, string>>) {
		return {
			...extra,
			code:    this.code,
			message: typeof this.msg === "string" ? this.msg : this.msg(...args)
		};
	}
}

export const GeneralErrors = {
	AUTH_REQUIRED:      new APIError(1000, "Authentication is required to do that."),
	INVALID_ID:         new APIError(1001, "You provided an invalid id."),
	METHOD_NOT_ALLOWED: new APIError(1002, "The method you attempted to use is not allowed for this route."),
	INVALID_URL:        new APIError(1003, "You provided an invalid url."),
	CORRUPT_FILE:       new APIError(1004, "The provided file is corrupt.")
};

export const UserErrors = {
	INVALID: new APIError(1100, "The specified user does not exist.")
};

export const PostErrors = {
	INVALID:               new APIError(1200, "The specified post does not exist."),
	INVALID_REVISION:      new APIError(1201, "The specified revision does not exist on this post."),
	NO_TAGS:               new APIError(1202, "You didn't specify any tags."),
	MINIMUM_TAGS:          new APIError(1203, `You must have at least ${Config.minimumPostTags} tags.`),
	MAXIMUM_TAGS:          new APIError(1204, `You cannot have more than ${Config.maximumPostTags} tags.`),
	INVALID_RATING:        new APIError(1205, (rating: string) => `The rating "${rating}" is invalid.`),
	INVALID_RATING_LOCK:   new APIError(1206, (rating_lock: string) => `The rating lock "${rating_lock}" is invalid.`),
	INVALID_PARENT:        new APIError(1207, (parent: string) => `The parent "${parent}" is invalid.`),
	INVALID_FILE_TYPE:     new APIError(1208, (mime: string) => `We don't accept "${mime}" files.`),
	DUPLICATE_UPLOAD:      new APIError(1209, "A post already exists with that file."),
	UPLOAD_NO_FILE_OR_URL: new APIError(1210, "You didn't upload a file or url..?"),
	INVALID_SOURCE:        new APIError(1211, (source: string) => `The source "${source}" is invalid.`)
};

export const PostVersionErrors = {
	INVALID: new APIError(1300, "The specified post version does not exist.")
};

export const FileErros = {
	INVALID: new APIError(1400, "The specified file does not exist.")
};
