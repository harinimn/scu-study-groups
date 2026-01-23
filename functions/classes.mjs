/** Handles methods related the classes screen */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

import { checkVis, visProfile } from "./visibility.mjs";

initializeApp();
const db = getFirestore();

/** Lists the user's classes
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} array containing the classes, see @function addClass , @function setVis , and @function fillGroups
 */
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
    if (classes === null) {
        return [];
    }
    for (c in classes) {
        c.delete("hours");
        c.delete("times");
        c.delete("section");
        c.delete("gender");
    }
    return classes;
});
  
/** Adds a class to the user
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @param {any} cur the current quarter to determine time based off of, see @function setup
 * @param {Array<Map<string, any>>} class the class to add, see @function setup
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
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
    data.class.set("vis", doc.get((data.quarter < data.cur ? "past" : (data.quarter == data.cur ? "cur" : "future")) + "_classes_vis"));
    data.class.set("hours", 0);
    data.class.set("times", null);
    data.class.set("section", false);
    data.class.set("gender", false);
    if (classes === undefined) {
        ins = {classes: {}};
        ins.classes.set(data.quarter, [data.class]);
        await ref.set(ins);
    } else {
        var period = classes.get(data.quarter);
        if (period === undefined) {
            classes.set(data.quarter, [data.class]);
        } else {
            period.push(data.class);
        }
        await ref.set({classes: classes});
    }
});

/** Removes one of the user's classes
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @param {number} class the index of the class to remove, per @function getClasses
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
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
    if (classes !== undefined) {
        var period = classes.get(data.quarter);
        if (period !== undefined) {
            period.splice(data.class, 1);
            await ref.set({classes: classes});
        }
    }
});

/** Sets the visiblity of a class (all interacting methods ensure it fits with the period modifier)
 * @param {any} quarter the quarter to the class is in, see @function setup
 * @param {number} class the index of the class to set visibility for, per @function getClasses
 * @param {number} vis the new visibility of the class
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const setVis = onCall(async (data, context) => {
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
    if (classes !== undefined) {
        var period = classes.get(data.quarter);
        if (period !== undefined) {
            period[data.class].vis = data.vis;
            await ref.set({classes: classes});
        }
    }
});

/** Shows the usesrs in the same section of a class
 * @param {any} quarter the quarter to list classes in, see @function setup
 * @param {any} cur the current quarter to determine time based off of, see @function setup
 * @param {Array<Map<string, any>>} class the class to see users from, see @function setup
 * @param {Map<string, any>} fields map of profile fields with key for the field and value for default, see @function visProfile
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Array containing results of @function visProfile
 */
export const listSection = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    const def = await db.get((data.quarter < data.cur ? "past" : (data.quarter == data.cur ? "cur" : "future")) + "_classes_vis");
    const query = await db.collection("users").get();
    const classes = res.get("classes");
    const connections = res.get("connections");
    const groups = db.collection("groups");
    var out = [];
    query.forEach(async ref => {
        const section = ref.get("classes").get(data.quarter)?.find(val => val.course == data.class.course && val.section == data.class.section);
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
 * @param {Array<Map<string, any>>} class the class to see users from, see @function setup
 * @param {Map<string, any>} fields map of profile fields with key for the field and value for default, see @function visProfile
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} Array containing results of @function visProfile
 */
export const listCourse = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }

    const res = await db.doc("users/" + uid).get();
    if (!res.exists) {
        throw new HttpsError('not-found', 'This user doesn\'t have any data.');
    }
    
    const def = await db.get((data.quarter < data.cur ? "past" : (data.quarter == data.cur ? "cur" : "future")) + "_classes_vis");
    const query = await db.collection("users").get();
    const classes = res.get("classes");
    const connections = res.get("connections");
    const groups = db.collection("groups");
    var out = [];
    query.forEach(async ref => {
        const section = ref.get("classes").get(data.quarter)?.find(val => val.course == data.class.course && val.section != data.class.section);
        const vis = min(def, section.get("vis"));
        if (section && (vis <= 1 || checkVis(connections, classes, uid, ref.get("classes"), ref.id, vis, groups))) {
            out.push(visProfile(data.fields, classes, connections, uid, ref.id, ref.data(), groups));
        }
    });
    return out;
});
