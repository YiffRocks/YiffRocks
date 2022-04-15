import Config from "../config";
import { request } from "undici";

export default class ProxyRequest {
	static async get(url: string) {
		return request(`${Config.proxyURL}?url=${encodeURIComponent(url)}`, { headers: { "Authorization": Config.proxyAuth, "User-Agent": Config.proxyAuth }, method: "GET" });
	}
}
