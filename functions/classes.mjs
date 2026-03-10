/** Handles methods related the classes screen */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";

import {checkVis, visProfile} from "./visibility.mjs";
import {logger} from "firebase-functions";

initializeApp();
const db = getFirestore();

/** Lists the users's classes
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} array containing the classes,
 *  see @function add , @function setVis , and @function groups-set
 */
export const get = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const classes = (await db.doc("users/" + request.auth.uid).get())
      .data().classes[request.data.quarter];
  if (!classes) {
    return [];
  }
  return classes;
});

/** Adds a class to the user
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @param {Map<string, any>} class the class to add, see @function setup
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const add = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  const uid = request.auth.uid;

  data.class.vis = 0;
  data.class.slots = 0;
  data.class.times = [];
  data.class.same_section = false;
  data.class.gender = false;
  await db.doc("users/" + uid).update({
    ["classes." + data.quarter]: FieldValue.arrayUnion(data.class),
  });
});

/** Removes one of the users's classes
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @param {number} class the index of the class to remove, per @function get
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const del = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const ref = db.doc("users/" + request.auth.uid);
  const classes = (await ref.get()).data().classes[data.quarter];
  classes.splice(data.class, 1);
  await ref.update({["classes." + data.quarter]: classes});
});

/** Sets class visiblity (all interacting methods ensure it fits with period)
 * @param {any} quarter the quarter to the class is in, see @function setup
 * @param {number} class the index of the class, per @function get
 * @param {number} vis the new visibility of the class
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const setVis = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const ref = db.doc("users/" + request.auth.uid);
  const doc = (await ref.get()).data().classes[data.quarter];
  doc[data.class].vis = data.vis;
  await ref.update({["classes." + data.quarter]: doc});
});

/** Shows the usesrs in the same section of a class
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @param {any} cur the current quarter to determine time, see @function setup
 * @param {number} class the index of the class, per @function get
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Results of @function visProfile
 */
export const listSection = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  const uid = request.auth.uid;

  const res = (await db.doc("users/" + uid).get()).data();
  const def = res[(data.quarter < data.cur ? "past" :
    (data.quarter == data.cur ? "cur" : "future")) + "_classes_vis"];
  const query = await db.collection("users").get();
  const classes = res.classes;
  const search = classes[data.quarter][data.class];
  const connections = res.connections;
  const groups = await db.collection("groups").where("count", "!=", 1)
      .where("members", "array-contains", uid).get();
  const out = [];
  for (const ref of query.docs) {
    const ref_data = ref.data();
    if (ref.id == uid || !ref_data.classes[data.quarter]) continue;
    const section = ref_data.classes[data.quarter].find((val) =>
      val.course == search.course && val.section == search.section);
    const vis = Math.min(def, section.vis);
    if (section && (vis <= 2 || await checkVis(
        connections, classes, ref_data.classes, ref.id, vis, groups))) {
      out.push(await visProfile(
          data.fields, classes, connections, ref.id, ref_data, groups));
    }
  }
  return out;
});

/** Shows the usesrs in a different section of the same class
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @param {any} cur the current quarter, see @function setup
 * @param {number} class the index of the class, per @function get
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Results of @function visProfile
 */
export const listCourse = onCall(async (request) => {
  logger.debug(request);
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  const uid = request.auth.uid;

  const res = (await db.doc("users/" + uid).get()).data();
  const def = res[(data.quarter < data.cur ? "past" :
    (data.quarter == data.cur ? "cur" : "future")) + "_classes_vis"];
  const query = await db.collection("users").get();
  const classes = res.classes;
  const search = classes[data.quarter][data.class];
  const connections = res.connections;
  const groups = await db.collection("groups").where("count", "!=", 1)
      .where("members", "array-contains", uid).get();
  const out = [];
  for (const ref of query.docs) {
    const ref_data = ref.data();
    if (ref.id == uid || !ref_data.classes[data.quarter]) continue;
    const section = ref_data.classes[data.quarter].find((val) =>
      val.course == search.course && val.section != search.section);
    const vis = Math.min(def, section.vis);
    if (section && (vis <= 1 || await checkVis(
        connections, classes, ref_data.classes, ref.id, vis, groups))) {
      out.push(await visProfile(
          data.fields, classes, connections, ref.id, ref_data, groups));
    }
  }
  return out;
});
