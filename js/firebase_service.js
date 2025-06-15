
// js/firebase_service.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getDatabase,
    ref,
    push,
    onChildAdded,
    onValue,
    set,
    remove,
    onDisconnect,
    serverTimestamp,
    get // Added get for index.html
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let app;
let auth;
let db;

/**
 * Initializes Firebase with the provided configuration.
 * Must be called once before using other Firebase services.
 * @param {object} firebaseConfig - Your Firebase project configuration.
 */
export function initializeFirebase(firebaseConfig) {
    if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.databaseURL) {
        throw new Error("Firebase configuration is incomplete. Missing apiKey, projectId, or databaseURL.");
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
}

// Export core Firebase services and functions
export {
    app,
    auth,
    db,
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    getDatabase,
    ref,
    push,
    onChildAdded,
    onValue,
    set,
    remove,
    onDisconnect,
    serverTimestamp,
    get
};
