import User from "../../db/Models/User";
import Util from "../../util/Util";

export default abstract class GenericSearch {
	protected static genericSearch<T extends string | number | boolean | null>(name: string, value: T): [string, T] {
		return [`${name} = ?`, value];
	}

	protected static async searchUserName(name: string, value: string): Promise<[string, string] | null> {
		const id = await User.nameToID(value);
		if (id !== null) return [`${name} = ?`, value];
		else return null;
	}
	protected static searchLike(name: string, value: string): [string, string] { return [`${name} LIKE ?`, `%${Util.parseWildcards(value)}%`]; }

	protected static formatOrder(type: string) {
		switch (type) {
			case "id": case "id_asc": return "ORDER BY id ASC";
			case "id_desc": return "ORDER BY id DESC";

			case "score": case "score_desc": return "ORDER BY score DESC";
			case "score_asc": return "ORDER BY score ASC";

			case "favcount": case "favcount_desc": return "ORDER BY favorite_count DESC";
			case "favcount_asc": return "ORDER BY favorite_count ASC";

			case "creation": case "creation_desc": return "ORDER BY created_at DESC";
			case "creation_asc": return "ORDER BY created_at ASC";

			case "update": case "update_desc": return "ORDER BY updated_at DESC";
			case "update_asc": return "ORDER BY updated_at ASC";

			case "comment_count": case "comment_count_desc": return "ORDER BY comment_count DESC";
			case "comment_count_asc": return "ORDER BY comment_count ASC";

			case "width": case "width_desc": return "ORDER BY width DESC";
			case "width_asc": return "ORDER BY width ASC";

			case "height": case "height_desc": return "ORDER BY height DESC";
			case "height_asc": return "ORDER BY height ASC";

			case "filesize": case "filesize_desc": return "ORDER BY filesize DESC";
			case "filesize_asc": return "ORDER BY filesize ASC";

			case "tagcount": case "tagcount_desc": return "ORDER BY tag_count DESC";
			case "tagcount_asc": return "ORDER BY tag_count ASC";

			case "tagcount_general": case "tagcount_general_desc": return "ORDER BY tag_count_general DESC";
			case "tagcount_general_asc": return "ORER BY tag_count_general ASC";

			case "tagcount_artist": case "tagcount_artist_desc": return "ORDER BY tag_count_artist DESC";
			case "tagcount_artist_asc": return "ORER BY tag_count_artist ASC";

			case "tagcount_copyright": case "tagcount_copyright_desc": return "ORDER BY tag_count_copyright DESC";
			case "tagcount_copyright_asc": return "ORER BY tag_count_copyright ASC";

			case "tagcount_character": case "tagcount_character_desc": return "ORDER BY tag_count_character DESC";
			case "tagcount_character_asc": return "ORER BY tag_count_character ASC";

			case "tagcount_species": case "tagcount_species_desc": return "ORDER BY tag_count_species DESC";
			case "tagcount_species_asc": return "ORER BY tag_count_species ASC";

			case "tagcount_invalid": case "tagcount_invalid_desc": return "ORDER BY tag_count_invalid DESC";
			case "tagcount_invalid_asc": return "ORER BY tag_count_invalid ASC";

			case "tagcount_lore": case "tagcount_lore_desc": return "ORDER BY tag_count_lore DESC";
			case "tagcount_lore_asc": return "ORER BY tag_count_lore ASC";

			case "tagcount_meta": case "tagcount_meta_desc": return "ORDER BY tag_count_meta DESC";
			case "tagcount_meta_asc": return "ORER BY tag_count_meta ASC";

			case "duration": case "duration_desc": return "ORDER BY duration DESC";
			case "duration_asc": return "ORDER BY duration ASC";

			case "popular": return "POPULAR";
			case "random": return "ORDER BY RANDOM()";
			default: return "INVALID;";
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	static constructQuery(query: Record<string, unknown>, limit?: number, offset?: number): Promise<[query: string, values: Array<unknown>]> {
		throw new Error("Missing implementation of constructQuery.");
	}
}
