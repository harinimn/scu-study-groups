// Handles methods related the classes screen

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

import { checkVis, visProfile } from "./visibility.mjs";

initializeApp();
const db = getFirestore();

export const getClasses = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    
    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    let store = res.get("classes");
    let classes = await store.get(data.quarter);
    if (classes == null) {
        return [];
    }
    return classes;
});
  
  
export const addClass = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    
    const ref = db.doc("users/" + uid);
    const doc = await ref.get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    var classes = doc.get("classes");
    if (classes == undefined) {
        ins = {classes: {}};
        ins.classes.set(data.quarter, [data.class]);
        await ref.set(ins);
    } else {
        var period = classes.get(data.quarter);
        if (period == undefined) {
            classes.set(data.quarter, [data.class]);
        } else {
            period.push(data.class);
        }
        await ref.set({classes: classes});
    }
});
  
export const delClass = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
    
    const ref = db.doc("users/" + uid);
    const res = await ref.get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
        
    var classes = res.get("classes");
    if (classes != undefined) {
        var period = classes.get(data.quarter);
        if (period != undefined) {
            var loc = period.indexOf(data.class);
            if (loc != -1) {
                period.splice(loc, 1);
                await ref.set({classes: classes});
            }
        }
    }
});

export const listSection = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    const modifier = (data.quarter < data.cur ? "past" : (data.quarter == data.cur ? "cur" : "future")) + "_classes_vis";
    const query = await db.collection("users").where(modifier, "!=", 0).where(new FieldPath('classes', data.quarter), "array-contains", data.class).get();
    const classes = res.get("classes");
    const connections = res.get("connections");
    const groups = db.collection("groups");
    var out = [];
    query.forEach(async ref => {
        const vis = ref.get(modifier);
        if (vis <= 2 || checkVis(connections, classes, uid, ref.get("classes"), ref.id, vis, groups)) {
            out.push(await visProfile(data.fields, classes, connections, uid, ref.id, ref.data(), groups));
        }
    });
    return out;
});

export const listCourse = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    const modifier = (data.quarter < data.cur ? "past" : (data.quarter == data.cur ? "cur" : "future")) + "_classes_vis";
    const query = await db.collection("users").where(modifier, "!=", 0).get();
    const classes = res.get("classes");
    const connections = res.get("connections");
    const groups = db.collection("groups");
    var out = [];
    query.forEach(async ref => {
        const vis = ref.get(modifier);
        if (ref.get("classes").get(data.quarter)?.find(val => val.class == data.class.course) && (vis <= 1 || checkVis(connections, classes, uid, ref.get("classes"), ref.id, vis, groups))) {
            out.push(await visProfile(data.fields, classes, connections, uid, ref.id, ref.data(), groups));
        }
    });
    return out;
});
