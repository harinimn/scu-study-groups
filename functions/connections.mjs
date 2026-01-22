/** Handles methods related to connections */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

/** Sends a connection request
 * Only one of the params should be provided, with index taking priority
 * @param {number} index the uid of the person to send a request to
 * @param {string} email the email of the person to send a request to
 * @throws {HttpsError<not-found>} if one of the users does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const sendConnection = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

    var id = data.id;
    if (id === undefined) {
        const query = await db.collection("users").where("main", "==", data.email).limit(1).get();
        id = query.docs[0].id;
    }

    const ref = db.doc("users/" + data.id);
    const res = await ref.get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    var pend = res.get("pending");
    pend.push(uid);
    ref.set({pending: pend});

    const sref = db.doc("users/" + uid);
    const sres = await sref.get();
    if (!sres.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    var out = sres.get("outgoing");
    out.push(uid);
    sref.set({outgoing: data.id});
    //TODO send an email notification
});

/** Accepts an incoming connection request
 * @param {number} index the index of the connection request to accept (per @function listPending )
 * @throws {HttpsError<not-found>} if one of the users does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const acceptConnection = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

    const ref = db.doc("users/" + uid);
    const res = await ref.get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    var pend = res.get("pending");
    const id = pend.splice(data.index, 1)[0];
    var connections = res.get("connections");
    connections.push(id);
    ref.set({pending: pend, connections: connections});

    const oref = db.doc("users/" + id);
    const other = await oref.get();
    if (!other.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    var out = other.get("outgoing");
    out.splice(out.indexOf(uid), 1);
    connections = other.get("connections");
    connections.push(uid);
    oref.set({connections: connections, outgoing: out});
    //TODO send an email notification
});

/** Denys an incoming connection request
 * @param {number} index the index of the connection request to deny (per @function listPending )
 */
export const denyConnection = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

    const ref = db.doc("users/" + uid);
    const res = await ref.get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    var pend = res.get("pending");
    const id = pend.splice(data.index, 1)[0];
    ref.set({pending: pend});

    const oref = db.doc("users/" + id);
    const other = await oref.get();
    if (!other.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    var out = other.get("outgoing");
    out.splice(out.indexOf(uid), 1);
    oref.set({outgoing: out});
    //TODO send an email notification
});

/** Withdraws an outgoing connection request
 * @param {number} index the index of the connection request to withdraw (per @function listOutgoing )
 * @throws {HttpsError<not-found>} if one of the users does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const withdrawConnection = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

    const ref = db.doc("users/" + uid);
    const res = await ref.get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    var out = res.get("outgoing");
    const id = out.splice(data.index, 1)[0];
    ref.set({outgoing: out});

    const oref = db.doc("users/" + id);
    const other = await oref.get();
    if (!other.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    var pend = other.get("pending");
    pend.splice(pend.indexOf(uid), 1);
    oref.set({pending: pend});
    //TODO send an email notification
});

/** Deletes a connection
 * @param {number} index the index of the connection to delete (per @function listConnections )
 * @throws {HttpsError<not-found>} if one of the users does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const deleteConnection = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

    const ref = db.doc("users/" + uid);
    const res = await ref.get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    var con = res.get("connections");
    const id = con.splice(data.index, 1)[0];
    ref.set({connections: con});

    const oref = db.doc("users/" + id);
    const other = await oref.get();
    if (!other.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    con = other.get("connections");
    con.splice(con.indexOf(uid), 1);
    oref.set({connections: con});
    //TODO send an email notification
});

/** Lists connections
 * @param {Map<string, any>} fields map of profile fields with key for the field and value for default, see @function visProfile
 * @throws {HttpsError<not-found>} if one of the users does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const listConnections = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

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
export const listPending = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

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
export const listOutgoing = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

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
export const commonConnections = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

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
export const commonInterests = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

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
