// Handles methods related the classes screen

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

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
