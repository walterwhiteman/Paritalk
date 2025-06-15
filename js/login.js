// js/login.js

// Import Firebase services and functions directly from their respective Firebase SDK modules
import { auth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from './firebase-init.js';
// Import get, ref directly from firebase-database
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { showModal, hideModal } from './modal.js';

// Supabase Configuration (REPLACE WITH YOUR ACTUAL KEYS)
const SUPABASE_URL = 'https://uokpkgybjzvpngoxasnm.supabase.co'; // e.g., 'https://xyzabcdef.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVva3BrZ3lianp2cG5nb3hhc25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MjE4NTcsImV4cCI6MjA2NTQ5Nzg1N30.FNv_13S3oj7fjartmY2PzKL25T3AWbMxP2KRI0rFU2E'; // e.g., 'eyJhbGciOiJIUzI1Ni...'

let supabaseClient;
try {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.warn('Supabase URL or Anon Key not set. Image/file uploads might not work.');
    } else {
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (error) {
    console.error('Failed to initialize Supabase:', error);
    supabaseClient = null; // Ensure supabase is null if initialization fails
}


// UI Elements (updated to match new index.html exact design)
const loginContainer = document.querySelector('.login-container'); // Select by class
const usernameInput = document.getElementById('username-input');
const roomcodeInput = document.getElementById('roomcode-input');
const joinChatButton = document.getElementById('join-chat-button');
const loginError = document.getElementById('login-error'); // Still 'login-error' ID

let currentUserId = null;
let db; // Declare db here, will be assigned after firebase-init.js is loaded and db is passed or retrieved

// Use onAuthStateChanged to ensure Firebase app and db are ready
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        // Access db AFTER Firebase is initialized, through initializeFirebase function or global setup
        // In a modular setup, db instance would ideally be passed or directly imported if initialized globally.
        // Assuming getDatabase is called in firebase-init.js and exported, or we call it here.
        // For simplicity, let's assume `db` instance will be available via the firebase-init.js exports.
        // For this specific error, we need `get` to work, which uses the `db` instance.
        // Let's get the db instance from firebase-init.js.
        const firebaseInit = await import('./firebase-init.js');
        db = firebaseInit.db;

        console.log("Authenticated with Firebase. User ID:", currentUserId);
        // Attempt to retrieve username/room from localStorage for auto-join
        const storedUsername = localStorage.getItem('paritalk_username');
        const storedRoomCode = localStorage.getItem('paritalk_roomcode');

        if (storedUsername && storedRoomCode) {
            usernameInput.value = storedUsername;
            roomcodeInput.value = storedRoomCode;
            await handleJoinChat(true); // Attempt to auto-join silently
        } else {
            // Show login screen if no stored info
            if (loginContainer) {
                // Ensure login form is visible by setting display style directly or removing a 'hidden' class
                loginContainer.style.display = 'flex'; // Assuming default display is flex in CSS
            }
        }
    } else {
        try {
            const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
                console.log("Signed in with custom token.");
            } else {
                await signInAnonymously(auth);
                console.log("Signed in anonymously.");
            }
        } catch (error) {
            console.error("Error signing in anonymously:", error.message);
            displayLoginError(`Authentication error: ${error.message}. Please try again.`);
        }
    }
});


// Helper to display login errors
function displayLoginError(message) {
    if (loginError) {
        loginError.textContent = message;
        loginError.classList.remove('hidden'); // Assuming 'hidden' class from CSS for error messages
    }
}

// Join Chat Logic
async function handleJoinChat(isAutoJoin = false) {
    if (!auth || !auth.currentUser || !currentUserId || !db) { // Ensure db is also initialized
        if (!isAutoJoin) {
            displayLoginError("App not ready. Please wait for authentication and database initialization.");
        }
        return;
    }

    const username = usernameInput.value.trim();
    const roomCode = roomcodeInput.value.trim();

    if (!username || !roomCode) {
        if (!isAutoJoin) {
            displayLoginError('Please enter both your name and room code.');
        }
        return;
    }

    const roomPresenceRef = ref(db, `rooms/${roomCode}/presence`);

    try {
        const snapshot = await get(roomPresenceRef); // `get` is now correctly imported
        let usersInRoomCount = 0;
        let currentUsers = {};
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                usersInRoomCount++;
                currentUsers[childSnapshot.key] = childSnapshot.val().username;
            });
        }

        const isCurrentUserAlreadyInRoom = currentUserId && currentUsers[currentUserId] === username;

        if (usersInRoomCount >= 2 && !isCurrentUserAlreadyInRoom) {
            displayLoginError('This room is currently full. Please try a different room code.');
            localStorage.removeItem('paritalk_username');
            localStorage.removeItem('paritalk_roomcode');
            return;
        }

        // Store current session info in localStorage for seamless re-entry
        localStorage.setItem('paritalk_username', username);
        localStorage.setItem('paritalk_roomcode', roomCode);

        // Redirect to chat.html with URL parameters
        window.location.href = `chat.html?room=${encodeURIComponent(roomCode)}&user=${encodeURIComponent(username)}`;

    } catch (error) {
        console.error("Error checking room presence or joining:", error);
        displayLoginError(`Failed to join room: ${error.message}. Please check your Firebase rules and internet connection.`);
    }
}

// Event Listeners
if (joinChatButton) {
    joinChatButton.addEventListener('click', () => handleJoinChat(false));
}

if (usernameInput) {
    usernameInput.addEventListener('focus', () => {
        if (loginError) loginError.classList.add('hidden');
    });
}
if (roomcodeInput) {
    roomcodeInput.addEventListener('focus', () => {
        if (loginError) loginError.classList.add('hidden');
    });
}

// If coming back from chat.html with an error
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
        displayLoginError(decodeURIComponent(errorParam));
    }
});
