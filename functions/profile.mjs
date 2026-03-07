/** Handles methods related to seting up a profile */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {logger} from "firebase-functions";

initializeApp();
const db = getFirestore();

/** Sets this users's profile information (main user visible info)
 * @param {number} def_vis the default visibility, see @function checkVis
 * @param {number} <field>_vis visibility of <field>
 * @param {number} past_classes_vis visibility of past classes
 * @param {number} cur_classes_vis the visibility setting for current classes
 * @param {number} future_classes_vis the visibility setting for future classes
 * @param {Array<any>} interests the user's interests, have to comply with ==
 * @param {Any} gender the users's gender, with a falsy value for male
 * @param {Map<any, Array<Map<string, any>>>} classes keyed by ordered quarters;
 *  with values containing a map of course, section, and vis
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const setup = onCall(async (request) => {
  const data = request.data;
  logger.debug(request.auth);
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  const def = data.def_vis;
  for (const [key, value] of Object.entries(data)) {
    if (key.endsWith("_vis") && key != "def_vis" && value < def) {
      data[key] = def;
    }
  }
  const ref = db.doc("users/" + uid);
  data.classes = {};
  data.pending = [];
  data.outgoing = [];
  data.connections = [];
  const res = await ref.get();
  if (res.exists) {
    const existingData = res.data();
    data.classes = existingData.classes ?? {};
    data.pending = existingData.pending ?? [];
    data.outgoing = existingData.outgoing ?? [];
    data.connections = existingData.connections ?? [];
  }

  await ref.set(data);
});

/** Retrieves this users's profile information (main user visible info)
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Map<string, any>} the information used for the main settings page
 */
export const get = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  // eslint-disable-next-line no-unused-vars
  const {classes, courses, connections, pending, outgoing, ...out} =
    (await db.doc("users/" + request.auth.uid).get()).data();
  logger.debug(out);
  return out;
});
