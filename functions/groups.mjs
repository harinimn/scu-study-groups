/** Handles methods related to study groups */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { visProfile } from "./visibility.mjs";

initializeApp();
const db = getFirestore();

/** Fills user data related to study groups
 * @param {any} quarter the quarter to the class is in, see @function setup
 * @param {number} class the index of the class to set times for, per @function classes-get
 * @param {number} slots the number of time slots the user wants to study for, defaults to 0
 * @param {Array[any]} times an array of times when the user wants to study, times must adhere to ==, with one entry representing one slot, defaults to empty array
 * @param {boolean} section whether the user wants to study with students in other sections, defaults to false
 * @param {boolean} gender whether the user wants to study exclusively with non-male students, defaults to true
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const set = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid)  throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    
    const ref = db.doc("users/" + uid);
    const res = await ref.get();
    if (!res.exists)  throw new HttpsError('not-found', 'This user doesn\'t have any data.');
        
    await ref.update({[`classes.${data.quarter}.${data.class}.slots`]: data.slots,
                    [`classes.${data.quarter}.${data.class}.times`]: data.times,
                    [`classes.${data.quarter}.${data.class}.section`]: data.section,
                    [`classes.${data.quarter}.${data.class}.gender`]: data.gender});
    
    const groups = db.collection("groups");
    var found = groups.where("quarter", "==", data.quarter).where("course", "==", period[data.class].course);
    const inside = await found.where("members", "array-contains", uid).get();
    var num = inside.size;
    inside.forEach(ref => num -= Number(ref.get("size") == 1));
    if (num >= data.slots) return;

    var exclude = [];
    inside.forEach(ref => {
        exclude.push(ref.id);
        var t = data.times.indexOf(ref.get("time"));
        if (t != -1) data.times.splice(t, 1);
    });
    found = found.where(documentId(), "not-in", exclude);

    if (data.section) found = found.where("section", "==", period[data.class].section);
    if (data.gender) found = found.where("gender", "==", true);
    else if (res.get("gender") == 0) found = found.where("gender", "==", false);
    found = await found.where("time", "in", data.times).get();

    if (found.size > 1) {
        data.times.splice(data.times.indexOf(found.docs[0].get("time")), 1);
        await groups.doc(found.docs[0].id).update({members: FieldValue.arrayUnion(uid), count: FieldValue.increment(1)});
        ++num;
        for (var i = 1; i < found.size && num < data.slots; ++i) {
            var t = data.times.indexOf(found.docs[i].get(time));
            if (t != -1) {
                data.times.splice(t, 1);
                await groups.doc(found.docs[i].id).update({members: FieldValue.arrayUnion(uid), count: FieldValue.increment(1)});
                ++num;
            }
        }

        if (num == data.slots)
            inside.forEach(async ref => {
                if (ref.get(size) == 1) await groups.doc(ref.id).delete();
            });
    }

    if (num < data.slots)
        data.times.forEach(async val => await groups.add({
            quarter: data.quarter,
            course: period[data.class].course,
            section: data.section?period[data.class].section:null,
            members: [uid],
            count: 1,
            gender: data.gender,
            time: val
        }));
});

/** Returns information about the user's groups
 * @param {any} quarter the quarter to the class is in, see @function setup
 * @param {number} class the index of the class to set times for, per @function classes-get
 * @param {Map<string, any>} fields map of profile fields with key for the field and value for default, see @function visProfile
 * @throws {HttpsError<not-found>} if current user does not exist
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 * @returns {Array<Map<string, any>>} all the groups, with an id field, time field (see @function set ), and a members field containing results of @function visProfile
 */
export const get = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid)  throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    
    const res = await db.doc("users/" + uid).get();
    if (!res.exists)  throw new HttpsError('not-found', 'This user doesn\'t have any data.');
        
    const classes = res.get("classes");
    const period = classes.get(data.quarter);
    if (period !== undefined) {
        const groups = db.collection("groups");
        const inside = await groups.where("quarter", "==", data.quarter).where("course", "==", period[data.class].course).where("size", "!=", 1).where("members", "array-contains", uid).get();

        var out = [];
        const connections = res.get("connections");
        inside.forEach(async ref => {
            var add = {id: ref.id, time: ref.time, members: []};
            ref.members.forEach(async id => add.members.push(visProfile(fields, classes, connections, uid, id, await ref.get("users/" + id), groups)));
            out.push(add);
        });
        return out;
    }
});

/** Removes the user from a group
 * @param {number} group the id of the group to leave
 * @throws {HttpsError<unauthenticated>} if current user is unauthenticated
 */
export const leave = onCall(async (data, context) => {
    const uid = context.auth.uid;
    if (!uid)  throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    await db.doc("groups/" + data.group).update({members: FieldValue.arrayRemove(uid)});
});
