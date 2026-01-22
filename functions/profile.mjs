// Handles methods related to seting up a profile

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { checkVis } from "./visibility.mjs";

initializeApp();
const db = getFirestore();

export const setup = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

    const def = data.def_vis;
    for (const [key, value] of data) {
        if (key.endsWith("_vis") && key != "def_vis" && value < def) {
            data.set(key, def);
        }
    }

    const res = await db.doc("users/" + uid).set(data);
    return res;
});

export const get = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    let out = res.data();
    out.delete("courses");
    out.delete("connections");
    return out;
});

export const visibleProfile = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    
    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    const other = await db.doc("users/" + data.id).get();
    if (!other.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    var out = {};
    const classes = res.get("classes");
    const connections = res.get("connections");
    for (const [key, value] of data.fields) {
        if (checkVis(connections, classes, uid, other.get("classes"), data.id, other.get(key + "_vis"), db.collection("groups"))) {
            out.set(key, other.get(key));
        } else {
            out.set(key, value);
        }
    }
    return out;
});
