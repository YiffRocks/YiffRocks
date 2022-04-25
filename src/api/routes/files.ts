
import apiHeaders from "../../util/apiHeaders";
import Post from "../../db/Models/Post";
import { GeneralErrors, FileErrors } from "../../logic/errors/API";
import Util from "../../util/Util";
import type { FileType } from "../../db/Models/File";
import File from "../../db/Models/File";
import type { Request } from "express";
import { Router } from "express";

const app = Router();

app.route("/")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req: Request<never, unknown, never, {
		post_id?: string;
		md5?: string;
		is_primary?: string;
		type?: FileType;
		width?: string;
		height?: string;
		parent_id?: string;
		size?: string;
		limit?: string;
		page?: string;
		id_only?: string;
	}>, res) => {
		const [limit, offset] = Util.parseLimit(req.query.limit, req.query.page);
		const idOnly = Util.parseBoolean(req.query.id_only);
		const searchResult = await File.search({
			post_id:    !req.query.post_id   ? undefined : Number(req.query.post_id),
			md5:        !req.query.md5   ? undefined : req.query.md5,
			is_primary: !req.query.is_primary   ? undefined : Util.parseBoolean(req.query.is_primary),
			type:       !req.query.type   ? undefined : req.query.type,
			width:      !req.query.width   ? undefined : req.query.width,
			height:     !req.query.height   ? undefined : req.query.height,
			parent_id:  !req.query.parent_id   ? undefined : Number(req.query.parent_id),
			size:       !req.query.size   ? undefined : req.query.size
		}, !req.query.limit ? undefined : limit, !req.query.page ? undefined : offset, idOnly as false);
		if (idOnly) return res.status(200).json(searchResult);
		return res.status(200).json(await Promise.all(searchResult.map(p => p.toJSON())));
	});


app
	.route("/:id")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req, res) => {
		const id = Number(req.params.id);
		if (isNaN(id)) return res.status(400).json(GeneralErrors.INVALID_ID);
		const file = await Post.get(id);
		if (file === null) return res.status(404).json(FileErrors.INVALID);

		return res.status(200).json(file.toJSON());
	});

export default app;
