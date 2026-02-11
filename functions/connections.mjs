/** Handles methods related to connections */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

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
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    const uid = request.auth.uid;

    var id = data.id;
    if (id === undefined) {
        const query = await db.collection("users").where("main", "==", data.email).limit(1).get();
        id = query.docs[0].id;
    }

    await db.doc("users/" + data.id).update({pending: FieldValue.arrayUnion(uid)});
    await db.doc("users/" + uid).update({outgoing: arrayUnion(data.id)});
    //TODO send an email notification
});

/** Accepts an incoming connection request
 * @param {number} index the index of the connection request to accept (per @function pending )
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const accept = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    const uid = request.auth.uid;

    const ref = db.doc("users/" + uid);
    const res = await ref.get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    var pend = res.get("pending");
    await ref.update({pending: FieldValue.arrayRemove(pend[data.index]), connections: FieldValue.arrayUnion(pend[data.index])});
    await db.doc("users/" + pend[data.index]).update({pending: FieldValue.arrayRemove(uid), connections: FieldValue.arrayUnion(uid)});
    //TODO send an email notification
});

/** Denys an incoming connection request
 * @param {number} index the index of the connection request to deny (per @function pending )
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const deny = onCall(async (request) => {
    const data = request.data;
    const auth = request.auth;
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    const uid = auth.uid;

    const ref = db.doc("users/" + uid);
    const res = await ref.get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    var pend = res.get("pending");
    await ref.update({pending: FieldValue.arrayRemove(pend[data.index])});
    await db.doc("users/" + pend[data.index]).update({outgoing: FieldValue.arrayRemove(uid)});
    //TODO send an email notification
});

/** Withdraws an outgoing connection request
 * @param {number} index the index of the connection request to withdraw (per @function outgoing )
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const withdraw = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    const uid = request.auth.uid;

    const ref = db.doc("users/" + uid);
    const res = await ref.get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    var out = res.get("outgoing");
    await ref.update({outgoing: FieldValue.arrayRemove(out[data.index])});
    await db.doc("users/" + out[data.index]).update({pending: FieldValue.arrayRemove(uid)});
    //TODO send an email notification
});

/** Deletes a connection
 * @param {number} index the index of the connection to delete (per @function list )
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const del = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    const uid = request.auth.uid;

    const ref = db.doc("users/" + uid);
    const res = await ref.get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    var con = res.get("connections");
    await ref.update({connections: FieldValue.arrayRemove(con[data.index])});
    await db.doc("users/" + con[data.index]).update({connections: FieldValue.arrayRemove(uid)});
    //TODO send an email notification
});

/** Lists connections
 * @param {Map<string, any>} fields map of profile fields with key for the field and value for default, see @function visProfile
 * @throws {HttpsError<not-found>} if one of the users does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const list = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    const uid = request.auth.uid;

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    const classes = res.get("classes");
    const connections = res.get("connections");
    const groups = db.collection("groups");
    var out = [];
    connections.forEach(async id => {
        const ref = await db.doc("users/" + id).get();
        if (!ref.exists) {
            throw new HttpsError('not-found', 'This user doesn\'t have any data.');
        }
        if (ref.get("def_vis") != 5) {
            out.push(await visProfile(data.fields, classes, connections, uid, id, ref.data(), groups));
        }
    });
    return out;
});

/** Lists incoming connection requests
 * @param {Map<string, any>} fields map of profile fields with key for the field and value for default, see @function visProfile
 * @throws {HttpsError<not-found>} if one of the user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Array containing results of @function visProfile
 */
export const pending = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    const uid = request.auth.uid;

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    const classes = res.get("classes");
    const connections = res.get("connections");
    const groups = db.collection("groups");
    var out = [];
    res.get("pending").forEach(async id => {
        const ref = await db.doc("users/" + id).get();
        if (!ref.exists) {
            throw new HttpsError('not-found', 'This user doesn\'t have any data.');
        }
        if (ref.get("def_vis") != 5) {
            out.push(await visProfile(data.fields, classes, connections, uid, id, ref.data(), groups));
        }
    });
    return out;
});

/** Lists outgoing connection requests
 * @param {Map<string, any>} fields map of profile fields with key for the field and value for default, see @function visProfile
 * @throws {HttpsError<not-found>} if one of the user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Array containing results of @function visProfile
 */
export const outgoing = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    const uid = request.auth.uid;

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    const classes = res.get("classes");
    const connections = res.get("connections");
    const groups = db.collection("groups");
    var out = [];
    res.get("outgoing").forEach(async id => {
        const ref = await db.doc("users/" + id).get();
        if (!ref.exists) {
            throw new HttpsError('not-found', 'This user doesn\'t have any data.');
        }
        if (ref.get("def_vis") != 5) {
            out.push(await visProfile(data.fields, classes, connections, uid, id, ref.data(), groups));
        }
    });
    return out;
});

/** Lists visible users with at least one common connections
 * @param {Map<string, any>} fields map of profile fields with key for the field and value for default, see @function visProfile
 * @throws {HttpsError<not-found>} if one of the user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Array containing results of @function visProfile , with an additional "common" field in each storing the number of common connections
 */
export const common = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    const uid = request.auth.uid;

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    const classes = res.get("classes");
    const connections = res.get("connections");
    const set = new Set(connections);
    const groups = db.collection("groups");
    const query = await db.collection("users").where("def_vis", "!=", 5).where("connections", "array-contains-any", connections).get();
    var out = [];
    query.forEach(async ref => {
        if (checkVis(connections, classes, uid, ref.get("classes"), ref.id, ref.get("def_vis"), groups)) {
            var cur = await visProfile(data.fields, classes, connections, uid, ref.id, ref.data(), groups);
            var common = new Set(ref.get("connections"));
            cur.set("common", common.intersection(set).size);
            out.push(cur);
        }
    });
    return out;
});

/** Lists visible users with at least one common interest
 * @param {Map<string, any>} fields map of profile fields with key for the field and value for default, see @function visProfile
 * @throws {HttpsError<not-found>} if one of the user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Array containing results of @function visProfile , with an additional "common" field in each storing the number of common interests
 */
export const interests = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    const uid = request.auth.uid;

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    const classes = res.get("classes");
    const connections = res.get("connections");
    const interests = res.get("interests");
    const set = new Set(interests);
    const groups = db.collection("groups");
    const query = await db.collection("users").where("def_vis", "!=", 5).where("interests", "array-contains-any", interests).get();
    var out = [];
    query.forEach(async ref => {
        if (checkVis(connections, classes, uid, ref.get("classes"), ref.id, ref.get("def_vis"), groups)) {
            var cur = await visProfile(data.fields, classes, connections, uid, ref.id, ref.data(), groups);
            var common = new Set(ref.get("interests"));
            cur.set("common", common.intersection(set).size);
            out.push(cur);
        }
    });
    return out;
});
