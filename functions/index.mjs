/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();
setGlobalOptions({maxInstances: 10});

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

  const res = await db.doc(uid).set(data);
  return res;
});

export const getProf = onCall(async (data, context) => {
  const uid = context.auth.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
  }

  const res = await db.doc(uid).get();
  if (!res.exists) {
    throw new HttpsError('not-found', 'This user  doesn\'t have any data.');
  }

  let out = res.data();
  await out.delete("courses");
  return out;
});

export const getClasses = onCall(async (data, context) => {
  const uid = context.auth.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
  }

  const res = await db.doc(uid).get();
  if (!res.exists) {
    throw new HttpsError('not-found', 'This user  doesn\'t have any data.');
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

  const ref = db.doc(uid);
  const doc = await ref.get();
  if (!res.exists) {
    throw new HttpsError('not-found', 'This user  doesn\'t have any data.');
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

  const ref = db.doc(uid);
  const res = await ref.get();
  if (!res.exists) {
    throw new HttpsError('not-found', 'This user  doesn\'t have any data.');
  }
  
  var classes = doc.get("classes");
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
