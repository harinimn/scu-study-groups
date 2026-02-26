/** Handles methods related to seting up a profile */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {logger} from "firebase-functions";

initializeApp();
const db = getFirestore();

/** Sets this user"s profile information (main user visible info)
 * @param {number} def_vis the default visibility setting, 0 for everyone, 5 for no one, see @function checkVis for more info
 * @param {number} <field>_vis the visibility setting for <field>, same format as @param def_vis
 * @param {number} past_classes_vis the visibility setting for past classes, same format as @param def_vis
 * @param {number} cur_classes_vis the visibility setting for current classes, same format as @param def_vis
 * @param {number} future_classes_vis the visibility setting for future classes, same format as @param def_vis
 * @param {Array<any>} interests an array containing the user"s interests, have to comply with ==
 * @param {Any} gender the user"s gender, with a falsy value for male
 * @param {Map<any, Array<Map<string, any>>>} classes a map keyed by quarters, which have to hold <, ==, and > for earlier, same, and newer; with array values containing a map of course, section, and vis
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const setup = onCall(async (request) => {
    var data = request.data;
    logger.debug(request.auth);
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to call this function.");
    }
    const uid = request.auth.uid;

    const def = data.def_vis;
    for (const [key, value] of Object.entries(data)) {
        if (key.endsWith("_vis") && key != "def_vis" && value < def) {
            data[key] = def;
        }
    }
    const ref = db.doc("users/" + uid);
    if (!(await ref.get()).exists) {
        if (!("email" in data)) {
            data.email = request.auth.token.email;
        }
        data.classes = {};
        data.pending = [];
        data.outgoing = [];
        data.connections = [];
    }

    await ref.set(data);
});

/** Retrieves this user"s profile information (main user visible info)
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Map<string, any>} the information used for the main settings page
 */
export const get = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to call this function.");
    }
    const uid = request.auth.uid;

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError("not-found", "This user doesn\"t have any data.");
    }

    let out = res.data();
    out.delete("courses");
    out.delete("connections");
    out.delete("pending");
    out.delete("outgoing");
    return out;
});
