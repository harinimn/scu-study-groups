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

  const res = await db.collection('users').doc(uid).set(data);
  return res;
});

export const getProf = onCall(async (data, context) => {
  const uid = context.auth.uid;

  if (!uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
  }

  const res = await db.collection('users').doc(uid).get();
  let out = res.data();
  
  if (out == undefined) {
    throw new HttpsError('not-found', 'This user  doesn\'t have any data.');
  }

  await out.delete("courses");
  return out;
});
