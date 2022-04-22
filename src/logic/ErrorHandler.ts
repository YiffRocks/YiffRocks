export default class ErrorHandler {
	static handle(shortDescription: string, fullError: string, error: Error) {
		const stack = this.prepareStackTrace(error);
		console.log(`ErrorHandler[${error.name}]: %s\n%s`, shortDescription, stack);
	}

	static prepareStackTrace(err: Error) {
		return err.stack?.split("\n").slice(1).join("\n");
	}
}
