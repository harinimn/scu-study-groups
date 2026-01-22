//Handles everything related to visibility
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

export async function checkVis(connections, looker, lid, seen, sid, field, groups) {
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

    const found = await groups.where("members", "contains", sid).where("members", "contains", lid).limit(1).get();
    if (!found.empty) {
        return true;
    } if (field == 3) {
        return false;
    }

    for (const [quarter, classes] of seen) {
        potential = looker.get(quarter);
        for (c in classes) {
            if (potential.contains(c)) {
                return true;
            }
            if (field == 1 && potential.find(val => val.course == c.course)) {
                return true;
            }
        }
    }

    return false;
}

export async function visProfile(fields, classes, connections, looker, seen, other, groups) {
    var out = {id: seen};
    for (const [key, value] of fields) {
        if (await checkVis(connections, classes, looker, other.get("classes"), seen, other.get(key + "_vis"), groups)) {
            out.set(key, other.get(key));
        } else {
            out.set(key, value);
        }
    }
    return out;
}

export const profile = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    const ref = await db.doc("users/" + data.id).get();
    if (!ref.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }

    const classes = res.get("classes");
    const connections = res.get("connections");
    const groups = db.collection("groups");
    return await visProfile(data.fields, classes, connections, uid, ref.id, ref.data(), groups);
});
