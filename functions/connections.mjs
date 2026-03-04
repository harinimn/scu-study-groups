/** Handles methods related to connections */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {visProfile, checkVis} from "./visibility.mjs";

initializeApp();
const db = getFirestore();

/** Sends a connection request
 * Only one of the params should be provided, with index taking priority
 * @param {number} index the uid of the person to send a request to
 * @param {string} email the email of the person to send a request to
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @throws {HttpsError<not-found>} if target user doesn"t exist
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
        .where("main", "==", data.email).limit(1).get();
    if (query.empty) {
      throw new HttpsError("not-found", "The target user doesn\" exist.");
    }
    id = query.docs[0].id;
  }

  await db.doc("users/" + data.id).update({
    pending: FieldValue.arrayUnion(uid)});
  await db.doc("users/" + uid).update({
    outgoing: FieldValue.arrayUnion(data.id)});
  await db.doc("email/connection_request").update({
    toUids: [id], delivery: FieldValue.delete(), message:
        {
          subject: "New connection request!",
          text: "You have recieved a new connection request.",
        }});
});

/** Accepts an incoming connection request
 * @param {number} index the request to accept (per @function pending )
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const accept = onCall(async (request) => {
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

  const pend = res.get("pending");
  await ref.update({
    pending: FieldValue.arrayRemove(pend[data.index]),
    connections: FieldValue.arrayUnion(pend[data.index])});
  await db.doc("users/" + pend[data.index]).update({
    pending: FieldValue.arrayRemove(uid),
    connections: FieldValue.arrayUnion(uid)});
  await db.doc("email/connection_request").update({
    toUids: [pend[data.index]], delivery: FieldValue.delete(), message:
        {
          subject: "Accepted connection!",
          text: "One of your connection requests has been approved.",
        }});
});

/** Denys an incoming connection request
 * @param {number} index the connection request to deny (per @function pending )
 * @throws {HttpsError<not-found>} if current user does not exist
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
  const res = await ref.get();
  if (!res.exists) {
    throw new HttpsError("not-found", "This user doesn\"t have any data.");
  }

  const pend = res.get("pending");
  await ref.update({pending: FieldValue.arrayRemove(pend[data.index])});
  await db.doc("users/" + pend[data.index]).update({
    outgoing: FieldValue.arrayRemove(uid)});
});

/** Withdraws an outgoing connection request
 * @param {number} index the request to withdraw (per @function outgoing )
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const withdraw = onCall(async (request) => {
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

  const out = res.get("outgoing");
  await ref.update({outgoing: FieldValue.arrayRemove(out[data.index])});
  await db.doc("users/" + out[data.index]).update({
    pending: FieldValue.arrayRemove(uid)});
});

/** Deletes a connection
 * @param {number} index the connection to delete (per @function list )
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const del = onCall(async (request) => {
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

  const con = res.get("connections");
  await ref.update({connections: FieldValue.arrayRemove(con[data.index])});
  await db.doc("users/" + con[data.index]).update({
    connections: FieldValue.arrayRemove(uid)});
});

/** Lists connections
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<not-found>} if one of the users does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const list = onCall(async (request) => {
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
  const connections = res.connections;
  const groups = db.collection("groups");
  const out = [];
  connections.forEach(async (id) => {
    const ref = await db.doc("users/" + id).get();
    if (!ref.exists) {
      throw new HttpsError("not-found", "This user doesn\"t have any data.");
    }
    if (ref.get("def_vis") != 5) {
      out.push(visProfile(
          data.fields, classes, connections, uid, id, ref.data(), groups));
    }
  });
  return out;
});

/** Lists incoming connection requests
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<not-found>} if one of the user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Results of @function visProfile
 */
export const pending = onCall(async (request) => {
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
  const connections = res.connections;
  const groups = db.collection("groups");
  const out = [];
  res.pending.forEach(async (id) => {
    const ref = await db.doc("users/" + id).get();
    if (!ref.exists) {
      throw new HttpsError("not-found", "This user doesn\"t have any data.");
    }
    if (ref.get("def_vis") != 5) {
      out.push(visProfile(data.fields,
          classes, connections, uid, id, ref.data(), groups));
    }
  });
  return out;
});

/** Lists outgoing connection requests
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<not-found>} if one of the user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Results of @function visProfile
 */
export const outgoing = onCall(async (request) => {
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
  const connections = res.connections;
  const groups = db.collection("groups");
  const out = [];
  res.outgoing.forEach(async (id) => {
    const ref = await db.doc("users/" + id).get();
    if (!ref.exists) {
      throw new HttpsError("not-found", "This user doesn\"t have any data.");
    }
    if (ref.get("def_vis") != 5) {
      out.push(visProfile(
          data.fields, classes, connections, uid, id, ref.data(), groups));
    }
  });
  return out;
});

/** Lists visible users with at least one common connections
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<not-found>} if one of the user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Results of @function visProfile ,
 *  with addition of "common" storing the number of common connections
 */
export const common = onCall(async (request) => {
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
  const connections = res.connections;
  const set = new Set(connections);
  const groups = db.collection("groups");
  const query = await db.collection("users")
      .where("def_vis", "!=", 5)
      .where("connections", "array-contains-any", connections).get();
  const out = [];
  query.forEach(async (ref) => {
    if (checkVis(
        connections, classes, uid, ref.classes, ref.id, ref.def_vis, groups)) {
      const cur = visProfile(
          data.fields, classes, connections, uid, ref.id, ref.data(), groups);
      const common = new Set(ref.connections);
      cur.update("common", common.intersection(set).size);
      out.push(cur);
    }
  });
  return out;
});

/** Lists visible users with at least one common interest
 * @param {Map<string, any>} fields profile fields with field:default
 * @throws {HttpsError<not-found>} if one of the user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Results of @function visProfile ,
 *  with addition of "common" storing the number of common interests
 */
export const interests = onCall(async (request) => {
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
  const connections = res.connections;
  const interests = res.interests;
  const set = new Set(interests);
  const groups = db.collection("groups");
  const query = await db.collection("users")
      .where("def_vis", "!=", 5)
      .where("interests", "array-contains-any", interests).get();
  const out = [];
  query.forEach(async (ref) => {
    if (checkVis(connections,
        classes, uid, ref.classes, ref.id, ref.def_vis, groups)) {
      const cur = visProfile(
          data.fields, classes, connections, uid, ref.id, ref.data(), groups);
      const common = new Set(ref.interests);
      cur.update("common", common.intersection(set).size);
      out.push(cur);
    }
  });
  return out;
});
