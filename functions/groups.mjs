/** Handles methods related to study groups */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue, FieldPath} from "firebase-admin/firestore";
import {visProfile} from "./visibility.mjs";

initializeApp();
const db = getFirestore();

/** Fills user data related to study groups
 * @param {any} quarter the quarter to the class is in, see @function setup
 * @param {number} class the index of the class, per @function classes-get
 * @param {number} slots the number of time slots the user wants, default 0
 * @param {Array[any]} times when the user wants to study,
 *  must have ==, one entry per slot, default empty
 * @param {boolean} same_section can the user study with other sections
 * @param {boolean} gender does the user restrict to non-male students
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const set = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  const ref = db.doc("users/" + uid);
  const res = await ref.get();
  if (!res.exists) {
    throw new HttpsError("not-found", "This user doesn\"t have any data.");
  }

  const quarter = await ref.get("classes." + data.quarter);
  const period = quarter[data.class];

  period.vis = 0;
  period.slots = data.slots;
  period.times = data.times;
  period.same_section = data.same_section;
  period.gender = data.gender;
  await ref.update({["classes." + data.quarter]: quarter});

  const groups = db.collection("groups");
  let found = groups.where("quarter", "==", data.quarter)
      .where("course", "==", period.course)
      .where("gender", "==", !!data.gender);
  const inside = await found.where("members", "array-contains", uid).get();
  let num = inside.size;
  inside.forEach((ref) => num -= Number(ref.get("size") == 1));
  if (num >= data.slots) return;

  const exclude = [];
  inside.forEach((ref) => {
    exclude.push(ref.id);
    const t = data.times.indexOf(ref.get("time"));
    if (t != -1) data.times.splice(t, 1);
  });
  found = found.where(FieldPath.documentId(), "not-in", exclude);

  if (data.same_section) found = found.where("section", "==", period.section);
  found = await found.where("time", "in", data.times).get();

  if (found.size > 1) {
    data.times.splice(data.times.indexOf(found.docs[0].get("time")), 1);
    await groups.doc(found.docs[0].id).update({
      members: FieldValue.arrayUnion(uid), count: FieldValue.increment(1)});
    ++num;
    for (let i = 1; i < found.size && num < data.slots; ++i) {
      const t = data.times.indexOf(found.docs[i].get("time"));
      if (t != -1) {
        data.times.splice(t, 1);
        await groups.doc(found.docs[i].id).update({
          members: FieldValue.arrayUnion(uid), count: FieldValue.increment(1)});
        ++num;
      }
    }

    if (num == data.slots) {
      inside.forEach(async (ref) => {
        if (ref.get("size") == 1) await groups.doc(ref.id).delete();
      });
    }
  }

  if (num < data.slots) {
    data.times.forEach(async (val) => await groups.add({
      quarter: data.quarter,
      course: period.course,
      section: data.same_section?period.section:null,
      members: [uid],
      count: 1,
      gender: data.gender,
      time: val,
    }));
  }
});

/** Returns information about the user"s groups
 * @param {any} quarter the quarter to the class is in, see @function setup
 * @param {number} class the index of the class, per @function classes-get
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} the groups, with id,
 *  time (see @function set ),and members (containing @function visProfile )
 */
export const get = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  let res = await db.doc("users/" + uid).get();
  if (!res.exists) {
    throw new HttpsError("not-found", "This user doesn\"t have any data.");
  }
  res = res.data();

  const classes = res.classes;
  if (classes[data.quarter]) {
    const groups = db.collection("groups");
    const inside = await groups.where("quarter", "==", data.quarter)
        .where("course", "==", classes[data.quarter][data.class].course)
        .where("size", "!=", 1).where("members", "array-contains", uid).get();

    const out = [];
    const connections = res.connections;
    inside.forEach(async (ref) => {
      const add = {id: ref.id, time: ref.time, members: []};
      ref.members.forEach(async (id) =>
        add.members.push(visProfile(data.fields,
            classes, connections, uid,
            id, await ref.get("users/" + id), groups)));
      out.push(add);
    });
    return out;
  }
});

/** Removes the user from a group
 * @param {number} group the id of the group to leave
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const leave = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;
  await db.doc("groups/" + data.group).update({
    members: FieldValue.arrayRemove(uid)});
});
