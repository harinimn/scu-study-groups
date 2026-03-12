/** Handles methods related to connections */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {visProfile, checkVis} from "./visibility.mjs";

initializeApp();
const db = getFirestore();

/** Sends a connection request
 * Only one of the params should be provided, with index taking priority
 * @param {number} index the uid of the person to send a request to
 * @param {string} email the email of the person to send a request to
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const send = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  let id = data.id;
  if (id === undefined) {
    const query = await db.collection("users")
        .where("email", "==", data.email).limit(1).get();
    logger.debug(query.empty);
    if (query.empty) {
      await db.doc("users/" + uid).update({
        outgoing: FieldValue.arrayUnion(data.email)});
      await db.doc("email/connection_request" + uid + data.email).set({
        to: data.email, message:
                {
                  subject: "New connection request!",
                  text: "You recieved a connection request on scu connections" +
                  "\nPlease create an account.",
                }});
      return;
    }
    id = query.docs[0].id;
  }

  await db.doc("users/" + id).update({
    pending: FieldValue.arrayUnion(uid)});
  await db.doc("users/" + uid).update({
    outgoing: FieldValue.arrayUnion(id)});
  await db.doc("email/connection_request" + uid + id).set({
    toUids: [id], message:
        {
          subject: "New connection request!",
          text: "You have recieved a new connection request.",
        }});
});

/** Accepts an incoming connection request
 * @param {number} index the request to accept (per @function pending )
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const accept = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  const ref = db.doc("users/" + uid);

  const pend = (await ref.get()).data().pending;
  await ref.update({
    pending: FieldValue.arrayRemove(pend[data.index]),
    connections: FieldValue.arrayUnion(pend[data.index])});
  await db.doc("users/" + pend[data.index]).update({
    outgoing: FieldValue.arrayRemove(uid),
    connections: FieldValue.arrayUnion(uid)});
  await db.doc("email/accepted_connection" + uid + pend[data.index]).set({
    toUids: [pend[data.index]], message:
        {
          subject: "Accepted connection!",
          text: "One of your connection requests has been approved.",
        }});
});

/** Denys an incoming connection request
 * @param {number} index the connection request to deny (per @function pending )
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const deny = onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = auth.uid;

  const ref = db.doc("users/" + uid);

  const pend = (await ref.get()).data().pending;
  await ref.update({pending: FieldValue.arrayRemove(pend[data.index])});
  await db.doc("users/" + pend[data.index]).update({
    outgoing: FieldValue.arrayRemove(uid)});
});

/** Withdraws an outgoing connection request
 * @param {number} index the request to withdraw (per @function outgoing )
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const withdraw = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  const ref = db.doc("users/" + uid);
  const out = (await ref.get()).data().outgoing;
  await ref.update({outgoing: FieldValue.arrayRemove(out[data.index])});
  const pend_ref = db.doc("users/" + out[data.index]);
  if ((await pend_ref.get()).exists) {
    await pend_ref.update({pending: FieldValue.arrayRemove(uid)});
  }
});

/** Deletes a connection
 * @param {number} index the connection to delete (per @function list )
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const del = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  const ref = db.doc("users/" + uid);
  const con = (await ref.get()).data().connections;
  await ref.update({connections: FieldValue.arrayRemove(con[data.index])});
  await db.doc("users/" + con[data.index]).update({
    connections: FieldValue.arrayRemove(uid)});
});

/** Lists connections
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Results of @function visProfile
 */
export const list = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  const res = (await db.doc("users/" + uid).get()).data();
  const classes = res.classes;
  const connections = res.connections;
  const groups = await db.collection("groups").where("count", "!=", 1)
      .where("members", "array-contains", uid).get();
  const out = [];
  if (connections == undefined) {
    return out;
  }
  for (const id of connections) {
    const ref = (await db.doc("users/" + id).get()).data();
    if (ref.def_vis != 5) {
      out.push(await visProfile(
          data.fields, classes, connections, id, ref, groups));
    }
  }
  return out;
});

/** Lists incoming connection requests
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Results of @function visProfile
 */
export const pending = onCall(async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  const res = (await db.doc("users/" + uid).get()).data();

  const classes = res.classes;
  const connections = res.connections;
  const groups = await db.collection("groups").where("count", "!=", 1)
      .where("members", "array-contains", uid).get();
  const out = [];
  if (res.pending == undefined) {
    return out;
  }
  for (const id of res.pending) {
    const ref = (await db.doc("users/" + id).get()).data();
    if (ref.def_vis != 5) {
      out.push(await visProfile(data.fields,
          classes, connections, id, ref, groups));
    }
  }
  return out;
});

/** Lists outgoing connection requests
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Results of @function visProfile
 */
export const outgoing = onCall(async (request) => {
  const fields = request.data.fields;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  const res = (await db.doc("users/" + uid).get()).data();

  const classes = res.classes;
  const connections = res.connections;
  const groups = await db.collection("groups").where("count", "!=", 1)
      .where("members", "array-contains", uid).get();
  const out = [];
  if (res.outgoing == undefined) {
    return out;
  }
  for (const id of res.outgoing) {
    const ref = await db.doc("users/" + id).get();
    logger.debug(id, ref.exists);
    if (ref.exists) {
      const data = ref.data();
      if (data.def_vis != 5) {
        out.push(await visProfile(fields,
            classes, connections, id, data, groups));
      }
    } else {
      out.push({id: null, email: id});
    }
  }
  logger.debug(out);
  return out;
});

/** Lists visible users with at least one common connections
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Results of @function visProfile ,
 *  with addition of "common" storing the number of common connections
 */
export const common = onCall(async (request) => {
  const fields = request.data.fields;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  const res = (await db.doc("users/" + uid).get()).data();

  const classes = res.classes;
  const connections = res.connections;
  if (!connections || connections.length == 0) return [];
  const set = new Set(connections);
  const groups = await db.collection("groups").where("count", "!=", 1)
      .where("members", "array-contains", uid).get();
  const query = await db.collection("users")
      .where("def_vis", "!=", 5)
      .where("connections", "array-contains-any", connections).get();
  const out = [];
  for (const ref of query.docs) {
    const data = ref.data();
    if (ref.id != uid && await checkVis(connections,
        classes, data.classes, ref.id, data.def_vis, groups)) {
      const cur = await visProfile(
          fields, classes, connections, ref.id, data, groups);
      cur.common = set.intersection(new Set(data.connections)).size;
      out.push(cur);
    }
  }
  return out;
});

/** Lists visible users with at least one common interest
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Results of @function visProfile ,
 *  with addition of "common" storing the number of common interests
 */
export const interests = onCall(async (request) => {
  const fields = request.data.fields;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = request.auth.uid;

  const res = (await db.doc("users/" + uid).get()).data();
  const classes = res.classes;
  const connections = res.connections;
  const interests = res.interests;
  if (!interests || interests.length == 0) return [];
  const set = new Set(interests);
  const groups = await db.collection("groups").where("count", "!=", 1)
      .where("members", "array-contains", uid).get();
  const query = await db.collection("users")
      .where("def_vis", "!=", 5)
      .where("interests", "array-contains-any", interests).get();
  const out = [];
  for (const ref of query.docs) {
    const data = ref.data();
    if (ref.id != uid && await checkVis(connections,
        classes, data.classes, ref.id, data.def_vis, groups)) {
      const cur = await visProfile(
          fields, classes, connections, ref.id, data, groups);
      cur.common = set.intersection(new Set(data.interests)).size;
      out.push(cur);
    }
  }
  return out;
});
