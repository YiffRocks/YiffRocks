import Config from "../config";
import { request } from "undici";

export default class ProxyRequest {
	static async get(url: string) {
		return request(`${Config.proxyURL}?url=${encodeURIComponent(url)}`, { method: "GET", headers: { "User-Agent": Config.proxyAuth, "Authorization": Config.proxyAuth } });
	}
}
