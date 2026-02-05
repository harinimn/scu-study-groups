import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { getAuth } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { getFunctions } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIaMeKSlCpKP8MMnutt6fmnIW8LOC_0y0",
  authDomain: "scu-study-groups.firebaseapp.com",
  databaseURL: "https://scu-study-groups-default-rtdb.firebaseio.com",
  projectId: "scu-study-groups",
  storageBucket: "scu-study-groups.firebasestorage.app",
  messagingSenderId: "692784233400",
  appId: "1:692784233400:web:565c5caf394e10b7bd6d4d",
  measurementId: "G-9K4GE7WSK6"
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
