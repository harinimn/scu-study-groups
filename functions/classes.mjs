/** Handles methods related the classes screen */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

import { checkVis, visProfile } from "./visibility.mjs";

import { logger } from "firebase-functions";

initializeApp();
const db = getFirestore();

/** Lists the user"s classes
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} array containing the classes, see @function add , @function setVis , and @function groups-set
 */
export const get = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to call this function.");
    }
    const uid = request.auth.uid;
    
    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError("not-found", "This user doesn\"t have any data.");
    }
    
    const classes = await res.get("classes." + data.quarter);
    if (!classes) {
        return [];
    }
    let out = [];
    for (const c of classes) {
        const {slots, times, same_section, gender, ...ins} = c;
        out.push(ins);
    }
    return out;
});
  
/** Adds a class to the user
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @param {Map<string, any>} class the class to add, see @function setup
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const add = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to call this function.");
    }
    const uid = request.auth.uid;
    
    data.class.vis = 0;
    data.class.slots = 0;
    data.class.times = [];
    data.class.same_section = false;
    data.class.gender = false;
    await db.doc("users/" + uid).update({["classes." + data.quarter]: FieldValue.arrayUnion(data.class)});
});

/** Removes one of the user"s classes
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @param {number} class the index of the class to remove, per @function get
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const del = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to call this function.");
    }
    const uid = request.auth.uid;

    const ref =  db.doc("users/" + uid);
    const res = await ref.get();
    if (!res.exists) {
        throw new HttpsError("not-found", "This user doesn\"t have any data.");
    }

    let classes = res.data().classes[data.quarter];
    classes.splice(data.class, 1);
    await ref.update({["classes." + data.quarter]: classes});
});

/** Sets the visiblity of a class (all interacting methods ensure it fits with the period modifier)
 * @param {any} quarter the quarter to the class is in, see @function setup
 * @param {number} class the index of the class to set visibility for, per @function get
 * @param {number} vis the new visibility of the class
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const setVis = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to call this function.");
    }
    const uid = request.auth.uid;
    
    await db.doc("users/" + uid).update({["classes." + data.quarter + "[" + data.class + "].vis"]: data.vis})
});

/** Shows the usesrs in the same section of a class
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @param {any} cur the current quarter to determine time based off of, see @function setup
 * @param {number} class the index of the class to see users from, per @function get
 * @param {Map<string, any>} fields map of profile fields with key for the field and value for default, see @function visProfile
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Array containing results of @function visProfile
 */
export const listSection = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to call this function.");
    }
    const uid = request.auth.uid;

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError("not-found", "This user doesn\"t have any data.");
    }
    
    const def = await db.get((data.quarter < data.cur ? "past" : (data.quarter == data.cur ? "cur" : "future")) + "_classes_vis");
    const query = await db.collection("users").get();
    const classes = res.get("classes");
    const search = classes.get(data.quarter)[data.class];
    const connections = res.get("connections");
    const groups = db.collection("groups");
    var out = [];
    query.forEach(async ref => {
        const section = ref.get("classes").get(data.quarter).find(val => val.course == search.course && val.section == search.section);
        const vis = min(def, section.get("vis"));
        if (section && (vis <= 2 || checkVis(connections, classes, uid, ref.get("classes"), ref.id, vis, groups))) {
            out.push(visProfile(data.fields, classes, connections, uid, ref.id, ref.data(), groups));
        }
    });
    return out;
});

/** Shows the usesrs in a different section of the same class
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @param {any} cur the current quarter to determine time based off of, see @function setup
 * @param {number} class the index of the class to see users from, per @function get
 * @param {Map<string, any>} fields map of profile fields with key for the field and value for default, see @function visProfile
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Array containing results of @function visProfile
 */
export const listCourse = onCall(async (request) => {
    const data = request.data;
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to call this function.");
    }
    const uid = request.auth.uid;

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError("not-found", "This user doesn\"t have any data.");
    }
    
    const def = await db.get((data.quarter < data.cur ? "past" : (data.quarter == data.cur ? "cur" : "future")) + "_classes_vis");
    const query = await db.collection("users").get();
    const classes = res.get("classes");
    const search = classes.get(data.quarter)[data.class];
    const connections = res.get("connections");
    const groups = db.collection("groups");
    var out = [];
    query.forEach(async ref => {
        const section = ref.get("classes").get(data.quarter).find(val => val.course == search.course && val.section != search.section);
        const vis = min(def, section.get("vis"));
        if (section && (vis <= 1 || checkVis(connections, classes, uid, ref.get("classes"), ref.id, vis, groups))) {
            out.push(visProfile(data.fields, classes, connections, uid, ref.id, ref.data(), groups));
        }
    });
    return out;
});
