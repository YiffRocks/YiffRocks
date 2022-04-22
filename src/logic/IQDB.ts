import ErrorHandler from "./ErrorHandler";
import NamedError from "./errors/NamedError";
import Config from "../config";
import fetch from "node-fetch";
import FormData from "form-data";

interface IQDBImage {
	hash: string;
	post_id: number;
	signature: {
		avglf: Array<number>;
		sig: Array<Array<number>>;
	};
}

export default class IQDB {
	static async add(id: number, data: Buffer) {
		const form = new FormData();
		form.append("file", data, {
			contentType: "image/jpeg",
			filename:    "image.jpg"
		});
		const res = await fetch(`${Config.iqdbInstance}/images/${id}`, {
			headers: {
				"User-Agent": Config.userAgent
			},
			method: "POST",
			body:   form
		});

		if (res.status !== 200) {
			const errorBody = await res.text();
			ErrorHandler.handle(`Non 200-OK response from iqdb server: ${res.status} ${res.statusText}`, errorBody, new NamedError("IQDBError"));
		} else return res.json() as Promise<IQDBImage>;
	}
}
