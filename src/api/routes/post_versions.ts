
import apiHeaders from "../../util/apiHeaders";
import { GeneralErrors, PostVersionErrors } from "../../logic/errors/API";
import PostVersion from "../../db/Models/PostVersion";
import type { AllRatings, RatingLocks } from "../../db/Models/Post";
import Util from "../../util/Util";
import type { Request } from "express";
import { Router } from "express";

const app = Router();

app.route("/")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req: Request<never, unknown, never, {
		post_id?: string;
		uploader_id?: string;
		uploader_name?: string;
		approver_id?: string;
		approver_name?: string;
		sources?: string;
		old_sources?: string;
		tags?: string;
		added_tags?: string;
		removed_tags?: string;
		locked_tags?: string;
		added_locked_tags?: string;
		removed_locked_tags?: string;
		rating?: AllRatings;
		old_rating?: AllRatings;
		rating_lock?: RatingLocks | "none";
		old_rating_lock?: RatingLocks | "none";
		parent_id?: string;
		old_parent_id?: string;
		description?: string;
		old_description?: string;
		title?: string;
		old_title?: string;
		reason?: string;
		limit?: string;
		page?: string;
	}>, res) => {
		const [limit, offset] = Util.parseLimit(req.query.limit, req.query.page);
		const searchResult = await PostVersion.search({
			post_id:             !req.query.post_id   ? undefined : Number(req.query.post_id),
			uploader_id:         !req.query.uploader_id   ? undefined : Number(req.query.uploader_id),
			uploader_name:       !req.query.uploader_name ? undefined : req.query.uploader_name,
			approver_id:         !req.query.approver_id   ? undefined : Number(req.query.approver_id),
			approver_name:       !req.query.approver_name ? undefined : req.query.approver_name,
			sources:             !req.query.sources ? undefined : req.query.sources,
			old_sources:         !req.query.old_sources ? undefined : req.query.old_sources,
			tags:                !req.query.tags ? undefined : req.query.tags,
			added_tags:          !req.query.added_tags ? undefined : req.query.added_tags,
			removed_tags:        !req.query.removed_tags ? undefined : req.query.removed_tags,
			locked_tags:         !req.query.locked_tags ? undefined : req.query.locked_tags,
			added_locked_tags:   !req.query.added_locked_tags ? undefined : req.query.added_locked_tags,
			removed_locked_tags: !req.query.removed_locked_tags ? undefined : req.query.removed_locked_tags,
			rating:              !req.query.rating ? undefined : req.query.rating,
			old_rating:          !req.query.old_rating ? undefined : req.query.old_rating,
			rating_lock:         !req.query.rating_lock ? undefined : req.query.rating_lock,
			old_rating_lock:     !req.query.old_rating_lock ? undefined : req.query.old_rating_lock,
			parent_id:           !req.query.parent_id ? undefined : Number(req.query.parent_id),
			old_parent_id:       !req.query.old_parent_id ? undefined : Number(req.query.old_parent_id),
			description:         !req.query.description ? undefined : req.query.description,
			old_description:     !req.query.old_description ? undefined : req.query.old_description,
			title:               !req.query.title ? undefined : req.query.title,
			old_title:           !req.query.old_title ? undefined : req.query.old_title,
			reason:              !req.query.reason ? undefined : req.query.reason
		}, !req.query.limit ? undefined : limit, !req.query.page ? undefined : offset);
		return res.status(200).json(await Promise.all(searchResult.map(p => p.toJSON())));
	});

app.route("/:id")
	.all(apiHeaders(["OPTIONS", "GET"]))
	.get(async(req, res) => {
		const id = Number(req.params.id);
		if (isNaN(id)) return res.status(400).json(GeneralErrors.INVALID_ID);
		const postVersion = await PostVersion.get(id);
		if (postVersion === null) return res.status(404).json(PostVersionErrors.INVALID);

		return res.status(200).json(await postVersion.toJSON());
	});

export default app;
