import { getVideo } from '../lib/youtube.js';
import { parseOptions, infoPayload } from '../lib/service.js';
import { baseUrl, cors, preflight, query, sendError, sendJson } from '../lib/http.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  cors(res);
  try {
    const { id } = parseOptions(query(req));
    const video = await getVideo(id);
    sendJson(res, 200, infoPayload(baseUrl(req), video));
  } catch (err) {
    sendError(res, err);
  }
}
