/** Defines global options and adds the other files */

import {setGlobalOptions} from "firebase-functions";

setGlobalOptions({maxInstances: 10});

export * as profile from "./profile.mjs";
export * as classes from "./classes.mjs";
export * as visible from "./visibility.mjs";
export * as connections from "./connections.mjs";
export * as groups from "./groups.mjs";
