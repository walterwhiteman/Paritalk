// js/firebase-init.js

// Firebase SDK (modular imports)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded, onValue, set, remove, onDisconnect, serverTimestamp, runTransaction, child } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";


let app;
let auth;
let db;
let storage; // Declare storage variable

export function initializeFirebase(firebaseConfig) {
    if (!app) { // Initialize only once
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getDatabase(app);
        storage = getStorage(app); // Initialize storage here
    }
}

// Export initialized services and other Firebase functions
export { app, auth, db, storage,
         signInAnonymously, signInWithCustomToken, onAuthStateChanged,
         ref, push, onChildAdded, onValue, set, remove, onDisconnect, serverTimestamp, runTransaction, child,
         storageRef, uploadBytes, getDownloadURL
       };
