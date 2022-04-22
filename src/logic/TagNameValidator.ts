import { MetaTags, TagCategoryNames } from "../db/Models/Tag";

/* class TagNameValidationError extends Error {
	name = "TagNameValidationError";
	failedExpression: string;
	tag: string;
	constructor(expression: string, message: string, tag: string) {
		super(message);
		this.failedExpression = expression;
		this.tag = tag;
	}
} */

export default class TagNameValidator {
	static validate(name: string) {
		const tag = name.toLowerCase();
		const errors: Array<string> = [];
		let match: RegExpMatchArray | null = null;
		// non-visible ascii characters
		if (/[^\x21-\x7E]/.test(tag)) errors.push("Tag names must be comprised of visible ascii characters.");
		// tags with just underscores (technically whitespace)
		if (/^_+$/.test(tag)) errors.push("Tag name cannot be empty.");
		// forbidden characters
		if ((match = /([*,#$%\\{}|@`[\]=%])/.exec(tag))) errors.push(`Tag names cannot contain ${!characterNames[match[1]] ? match[1] : `${characterNames[match[1]]} (${match[1]})`}`);
		// forbidden starting characters
		if ((match = /^([_~\-:+()])/.exec(tag))) errors.push(`Tag names cannot start with ${!characterNames[match[1]] ? match[1] : `${characterNames[match[1]]} (${match[1]})`}`);
		// forbidden ending characters
		if ((match = /([_\-:])$/.exec(tag))) errors.push(`Tag names cannot end with ${!characterNames[match[1]] ? match[1] : `${characterNames[match[1]]} (${match[1]})`}`);
		// forbidden consecutive characters
		if ((match = /([_\-~]{2,})/.exec(tag))) errors.push(`Tag cannot have consecutive ${!characterNames[match[1]] ? match[1] : `${characterNames[match[1]]} (${match[1]})`}`);
		// meta tags
		if ((match = new RegExp(`^(${MetaTags.join("|")}):(.+)$`).exec(tag))) errors.push(`Tag name cannot start with ${match[1]}:`);
		// categories
		if ((match = new RegExp(`^(${TagCategoryNames.map(k => k.toLowerCase()).join("|")}):(.+)$`).exec(tag))) errors.push(`Tag name cannot start with ${match[1]}:`);

		if (errors.length) return errors;
		return true;
	}
}

const characterNames: Record<string, string> = {
	"!":  "exclamation marks",
	"\"": "quotation marks",
	"#":  "pound signs",
	"$":  "dollar signs",
	"%":  "percent signs",
	"&":  "ampersands",
	"'":  "apostrophes",
	"(":  "left parentheses",
	")":  "right parentheses",
	"*":  "asterisks",
	"+":  "plus signs",
	",":  "commas",
	"-":  "hyphens",
	".":  "periods",
	"/":  "forward slashes",
	":":  "colons",
	";":  "semicolons",
	"<":  "less than symbols",
	"=":  "equals symbols",
	">":  "greater than symbols",
	"?":  "question marks",
	"@":  "at symbols",
	"[":  "left square brackets",
	"\\": "backslashes",
	"]":  "right square brackets",
	"^":  "carets",
	"_":  "underscores",
	"`":  "grave accents",
	"{":  "left curly braces",
	"|":  "vertical bars",
	"}":  "right curly braces",
	"~":  "tildes"
};
