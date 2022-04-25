import ErrorHandler from "./ErrorHandler";
import NamedError from "./errors/NamedError";
import Config from "../config";
import fetch from "node-fetch";
import FormData from "form-data";
import { fileTypeFromBuffer } from "file-type";
import { assert } from "tsafe";

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

	static async delete(id: number) {
		const res = await fetch(`${Config.iqdbInstance}/images/${id}`, {
			headers: {
				"User-Agent": Config.userAgent
			},
			method: "DELETE"
		});

		if (res.status !== 200) {
			const errorBody = await res.text();
			ErrorHandler.handle(`Non 200-OK response from iqdb server: ${res.status} ${res.statusText}`, errorBody, new NamedError("IQDBError"));
		} else return null;
	}

	static async query(data: Buffer, limit?: number) {
		const form = new FormData();
		const type = await fileTypeFromBuffer(data);
		assert(type !== undefined, "failed to determine file type");
		form.append("file", data, {
			contentType: type.mime,
			filename:    `image.${type.ext}`
		});
		const res = await fetch(`${Config.iqdbInstance}/query${limit ? `?limit=${limit}` : ""}`, {
			headers: {
				"User-Agent": Config.userAgent
			},
			method: "POST",
			body:   form
		});

		if (res.status !== 200) {
			const errorBody = await res.text();
			ErrorHandler.handle(`Non 200-OK response from iqdb server: ${res.status} ${res.statusText}`, errorBody, new NamedError("IQDBError"));
			return "ERROR";
		} else return res.json() as Promise<Array<IQDBImage& { score: number; }>>;
	}
}
