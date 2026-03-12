/** Handles methods related to seting up a profile */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore} from "firebase-admin/firestore";

initializeApp();
const auth = getAuth();
const db = getFirestore();

/** Sets this users's profile information (main user visible info)
 * @param {number} def_vis the default visibility, see @function checkVis
 * @param {number} <field>_vis visibility of <field>
 * @param {number} past_classes_vis visibility of past classes
 * @param {number} cur_classes_vis the visibility setting for current classes
 * @param {number} future_classes_vis the visibility setting for future classes
 * @param {Array<any>} interests the user's interests, have to comply with ==
 * @param {Any} gender the users's gender, with a falsy value for male
 * @param {string} email the user's main email, used for connections and groups
 * @param {Map<any, Array<Map<string, any>>>} classes keyed by ordered quarters;
 *  with values containing a map of course, section, and vis
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const setup = onCall(async (request) => {
  const data = request.data;
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
  } else {
    const requested = await db.collection("users")
        .where("pending", "array-contains", data.email).get();
    for (const doc of requested.docs) {
      await doc.ref.update({
        pending: FieldValue.arrayUnion(uid)});
      await doc.ref.update({
        pending: FieldValue.arrayRemove(data.email)});
      data.pending.push(doc.id);
    }
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

  const ref = await db.doc("users/" + request.auth.uid).get();
  if (!ref.exists) {
    return [];
  }

  // eslint-disable-next-line no-unused-vars
  const {classes, courses, connections, pending, outgoing, ...out} = ref.data();
  return out;
});

/** Deletes this users's profile
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const remove = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const uid = request.auth.uid;
  const ref = db.doc("users/" + uid);
  const profile = (await ref.get()).data();
  for (const id of profile.connections) {
    await db.doc("users/" + id).update({
      connections: FieldValue.arrayRemove(uid)});
  }
  for (const id of profile.outgoing) {
    await db.doc("users/" + id).update({
      pending: FieldValue.arrayRemove(uid)});
  }
  for (const id of profile.pending) {
    await db.doc("users/" + id).update({
      outgoing: FieldValue.arrayRemove(uid)});
  }

  const groups = await db.collection("groups")
      .where("members", "array-contains", uid).get();
  for (const group of groups.docs) {
    await db.doc("groups/" + group.id).update({
      members: FieldValue.arrayRemove(uid)});
  }

  await ref.delete();
  await auth.deleteUser(uid);
});
