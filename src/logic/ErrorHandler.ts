import { assert } from "tsafe";

export default class ErrorHandler {
	static async handle(shortDescription: string,  error: Error): Promise<string>;
	static async handle(shortDescription: string,  fullError: string, error?: Error): Promise<string>;
	static async handle(shortDescription: string,  errorOrFull: Error | string, error?: Error): Promise<string> {
		const err = errorOrFull instanceof Error ? errorOrFull : error;
		assert(err, "missing error in error handler");
		const stack = this.prepareStackTrace(err);
		console.log(`ErrorHandler[${err.name}]: %s\n%s`, shortDescription, stack);
		return Promise.resolve("No Log ID");
	}

	static prepareStackTrace(err: Error) {
		return err.stack?.split("\n").slice(1).join("\n");
	}
}
