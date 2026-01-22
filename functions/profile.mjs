// Handles methods related to seting up a profile

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
    out.delete("pending");
    return out;
});

export const sendConnection = onCall(async (data, context) => {
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
    pend.push(uid);
    ref.set({pending: pend});
    //TODO send an email notification
});
