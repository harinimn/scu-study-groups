/** Handles everything related to visibility */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

/**
 * Checks whether a user can see a specific field of another one
 * @param {Array<number>} connections the connections of the looker
 * @param {Map<any, Array<Map<string, any>>>} looker the classes of the looker
 * @param {number} lid the id of the looker
 * @param {Map<any, Array<Map<string, any>>>} seen the classes of the seen user
 * @param {number} sid the id of the seen
 * @param {number} field the visibility of the field.
 *  0: everyone
 *  1: people in the same course
 *  2: people in the same section
 *  3: people in study groups
 *  4: connections, 5: no one. If higher value permits, so does lower
 * @param {FirebaseFirestore.CollectionReference
 *  <FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData>} groups
 *  the reference to the groups collection
 * @return {boolean} whether the field is visible to the looker
 */
export async function checkVis(
    connections, looker, lid, seen, sid, field, groups) {
  if (field == 0) {
    return true;
  }
  if (field == 5) {
    return false;
  }

  if (connections.has(sid)) {
    return true;
  } if (field == 4) {
    return false;
  }

  const found = await groups.where("count", "!=", 1)
      .where("members", "array-contains", sid)
      .where("members", "array-contains", lid)
      .limit(1)
      .get();
  if (!found.empty) {
    return true;
  } if (field == 3) {
    return false;
  }

  for (const [quarter, classes] of seen) {
    const potential = looker[quarter];
    for (const c of classes) {
      if (potential.find((val) =>
        val.course == c.course && val.section == c.section)) {
        return true;
      }
      if (field == 1 && potential.find((val) => val.course == c.course)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns the visiblie profile of one user from another"s perspective
 * @param {Map<string, any>} fields map of fields with field:default
 * @param {Map<any, Array<Map<string, any>>>} classes the classes of the looker
 * @param {Array<number>} connections the connections of the looker
 * @param {number} looker the id of the looker
 * @param {number} seen the id of the seen
 * @param {Map<string, any>} other the data of the person being seen
 * @param {FirebaseFirestore.CollectionReference
 *  <FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData>} groups
 *  the reference to the groups collection
 * @return {Map<string, any>} visible profile, with "id" containing @param seen
 */
export async function visProfile(
    fields, classes, connections, looker, seen, other, groups) {
  const out = {id: seen};
  for (const [key, value] of fields) {
    out[key] = checkVis(connections,
        classes,
        looker,
        other.classes,
        seen,
        other[key + "_vis"],
        groups) ? other[key] : value;
  }
  return out;
}

/**
 * Returns the visiblie profile of someone from the current users's perspective
 * @param {Map<string, any>} fields profile fields with field:default
 * @param {number} id the id of the user beeing seen
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Map<string, any>} the visible profiles, see @function visProfile
 */
export const profile = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  const res = (await db.doc("users/" + uid).get()).data();
  const id = data.id;
  const classes = res.classes;
  const connections = res.connections;
  const groups = db.collection("groups");
  return visProfile(data.fields, classes, connections, uid, id,
      (await db.doc("users/" + data.id).get()).data(), groups);
});
