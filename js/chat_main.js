
// js/chat_main.js

import {
    initializeFirebase,
    auth,
    db,
    onAuthStateChanged,
    ref,
    push,
    onChildAdded,
    onValue,
    set,
    remove,
    onDisconnect,
    serverTimestamp
} from './firebase_service.js';
import { createSupabaseClient, supabase } from './supabase_service.js';
import { showModal, hideModal } from './modal_service.js';
import { initializeJitsiService, startVideoCall, endVideoCall, getJitsiApi } from './jitsi_service.js';

// --- Firebase Configuration (YOUR ACTUAL CONFIG) ---
const firebaseConfig = {
    apiKey: "AIzaSyA8Yj1Z1Mpv2lyt9SRxJ_w4U04BXt8hajk",
    authDomain: "paritalk.firebaseapp.com",
    databaseURL: "https://paritalk-default-rtdb.firebaseio.com",
    projectId: "paritalk",
    storageBucket: "paritalk.firebasestorage.app",
    messagingSenderId: "441945619664",
    appId: "1:441945619664:web:045e0c872e67e0eb9fb2d5"
};
const initialAuthToken = null; // Used by Canvas; keep null for GitHub Pages

// Initialize Firebase services
try {
    initializeFirebase(firebaseConfig);
    console.log("Firebase services initialized in chat_main.js.");
} catch (error) {
    console.error("Error initializing Firebase services in chat_main.js:", error.message);
    showModal(`App config error: ${error.message}. Please check console.`, false).then(() => {
        window.location.href = `index.html?error=${encodeURIComponent('Firebase config error.')}`;
    });
}

// Supabase Configuration (Using your confirmed URL and provided Anon Key)
const SUPABASE_URL = 'https://uokpkgybjzvpngoxasnm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVva3BrZ3lianp2cG5nb3hhc25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MjE4NTcsImV4cCI6MjA2NTQ5Nzg1N30.FNv_13S3oj7fjartmY2PzKL25T3AWbMxP2KRI0rFU2E';

// Initialize Supabase client
let supabaseClientInstance; // Use a different name to avoid conflict with imported 'supabase'
try {
    supabaseClientInstance = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase client initialized in chat_main.js with URL:", SUPABASE_URL);
} catch (error) {
    console.error('Failed to initialize Supabase in chat_main.js:', error);
    // Optionally show a modal about file upload being disabled
    showModal('File uploads will not work: Supabase initialization failed. Check console for details.', false);
}


// Global variables for chat state
let currentUserId = null;
let currentUsername = '';
let currentRoomCode = '';
let roomRef = null;
let presenceRef = null;
let messagesRef = null;
let typingRef = null;
let typingTimeout = null;

// UI Elements
const chatScreen = document.getElementById('chat-screen');
const roomNameDisplay = document.getElementById('room-name');
const onlineUsersCountDisplay = document.getElementById('online-users-count');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const imageUploadInput = document.getElementById('image-upload');
const videoCallButton = document.getElementById('video-call-button');
const leaveRoomButton = document.getElementById('leave-room-button');
const jitsiContainer = document.getElementById('jitsi-container');
const jitsiIframe = document.getElementById('jitsi-iframe');
const hangupButton = document.getElementById('hangup-button');
const typingIndicator = document.getElementById('typing-indicator');


// --- Get Room Code and Username from URL ---
const urlParams = new URLSearchParams(window.location.search);
const urlRoomCode = urlParams.get('room');
const urlUsername = urlParams.get('user');

console.log("chat_main.js Init: Raw URL Room Code =", urlRoomCode);
console.log("chat_main.js Init: Raw URL Username =", urlUsername);


if (!urlRoomCode || !urlUsername) {
    console.error("chat_main.js Init Error: Missing room code or username in URL. Redirecting to login.");
    window.location.href = 'index.html?error=' + encodeURIComponent('Missing room or user info for chat. Please re-login.');
} else {
    currentRoomCode = decodeURIComponent(urlRoomCode);
    currentUsername = decodeURIComponent(urlUsername);
    roomNameDisplay.textContent = currentRoomCode; // Set room name here
    console.log("chat_main.js Init: Decoded Room Code =", currentRoomCode);
    console.log("chat_main.js Init: Decoded Username =", currentUsername);

    chatScreen.classList.remove('hidden'); // Show chat screen

    // This localStorage item tracks if the "joined" message was sent for this session.
    // It's not for auto-rejoin.
    if (localStorage.getItem('paritalk_has_joined_session') !== currentRoomCode + currentUsername) {
        localStorage.setItem('paritalk_has_joined_session', currentRoomCode + currentUsername);
    }
}


// --- Firebase Authentication & Chat Setup ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        console.log("Firebase Auth Trace: Authenticated with User ID:", currentUserId);

        if (!currentRoomCode || !currentUsername) {
            console.error("Firebase Auth Error: Room code or username missing after auth. Cannot set up Firebase refs.");
            showModal('Critical Error: Room details missing. Please re-join.', false).then(() => {
                window.location.href = 'index.html';
            });
            return;
        }

        // Initialize Firebase Realtime Database references
        roomRef = ref(db, `rooms/${currentRoomCode}`);
        presenceRef = ref(db, `rooms/${currentRoomCode}/presence/${currentUserId}`);
        messagesRef = ref(db, `rooms/${currentRoomCode}/messages`);
        typingRef = ref(db, `rooms/${currentRoomCode}/typing/${currentUserId}`);

        console.log("Firebase Refs Trace: roomRef OK?", !!roomRef, "presenceRef OK?", !!presenceRef, "messagesRef OK?", !!messagesRef, "typingRef OK?", !!typingRef);


        try {
            // Set user presence
            if (presenceRef) {
                await set(presenceRef, { username: currentUsername, lastSeen: serverTimestamp() });
                // Ensure onDisconnect is set correctly to remove user
                onDisconnect(presenceRef).remove();
                console.log("Firebase Presence Trace: User presence set for path:", presenceRef.toString());
            } else {
                console.error("Firebase Presence Error: presenceRef is null. Cannot set user presence.");
            }

            // Send "joined" message only if it hasn't been sent for this specific session
            if (!localStorage.getItem('paritalk_joined_message_sent_for_' + currentRoomCode + currentUsername)) {
                sendMessage(`**${currentUsername}** joined the chat.`, 'system');
                localStorage.setItem('paritalk_joined_message_sent_for_' + currentRoomCode + currentUsername, 'true');
            }

            // Start listening for messages, presence, and typing
            listenForMessages();
            listenForPresence();
            listenForTyping();
            console.log("Firebase listeners started.");

            messageInput.focus();

            // Initialize Jitsi Service with all necessary elements
            initializeJitsiService(currentRoomCode, currentUsername, jitsiIframe, jitsiContainer, chatScreen, hangupButton, () => {
                // Callback for Jitsi's readyToClose event, if needed
                endVideoCall();
            });

        } catch (error) {
            console.error("Error setting up chat listeners/presence:", error);
            // Clear localStorage here to ensure clean state if setup fails
            localStorage.removeItem('paritalk_username');
            localStorage.removeItem('paritalk_roomcode');
            localStorage.removeItem('paritalk_has_joined_session');
            localStorage.removeItem('paritalk_joined_message_sent_for_' + currentRoomCode + currentUsername); // Clear specific flag

            showModal('Failed to set up chat. Please re-join. Error: ' + error.message, false).then(() => {
                window.location.href = 'index.html';
            });
        }
    } else {
        console.warn("Firebase Auth Warning: User not authenticated in chat.html. Redirecting to login.");
        window.location.href = 'index.html?error=' + encodeURIComponent('Authentication failed. Please re-login.');
    }
});


// --- Helper Functions ---
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
        return '';
    }
    const options = { hour: 'numeric', minute: 'numeric', hour12: true };
    return date.toLocaleTimeString('en-US', options);
}

// --- Chat Logic ---
function listenForMessages() {
    if (!messagesRef) {
        console.error("listenForMessages: messagesRef is not initialized. Cannot listen for messages.");
        return;
    }
    onChildAdded(messagesRef, (snapshot) => {
        const message = snapshot.val();
        addMessageToChat(message);
    });
}

function addMessageToChat(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message-bubble', 'flex', 'flex-col', 'max-w-[75%]', 'p-2', 'rounded-xl', 'shadow-sm', 'relative');

    let contentHTML = '';

    if (message.type === 'system') {
        messageElement.classList.add('text-center', 'italic', 'text-gray-500', 'text-sm', 'w-full', 'py-1');
        messageElement.style.backgroundColor = 'transparent';
        messageElement.classList.remove('p-2', 'rounded-xl', 'shadow-sm');
        contentHTML = message.text;
        messageElement.textContent = message.text;
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return;
    }

    const isMine = message.sender === currentUsername;
    messageElement.classList.add(isMine ? 'mine' : 'other');

    if (message.type === 'text') {
        contentHTML += `<p class="text-gray-800">${message.text}</p>`;
    } else if (message.type === 'image') {
        contentHTML += `<img src="${message.imageUrl}" alt="Shared Image" class="message-image" onclick="window.open('${message.imageUrl}', '_blank')">`;
    } else if (message.type === 'file') {
        let fileIcon = 'fa-file';
        const fileExtension = message.fileName.split('.').pop().toLowerCase();
        if (['pdf'].includes(fileExtension)) fileIcon = 'fa-file-pdf';
        else if (['doc', 'docx'].includes(fileExtension)) fileIcon = 'fa-file-word';
        else if (['xls', 'xlsx'].includes(fileExtension)) fileIcon = 'fa-file-excel';
        else if (['ppt', 'pptx'].includes(fileExtension)) fileIcon = 'fa-file-powerpoint';
        else if (['zip', 'rar', '7z'].includes(fileExtension)) fileIcon = 'fa-file-archive';
        else if (['mp3', 'wav', 'ogg'].includes(fileExtension)) fileIcon = 'fa-file-audio';
        else if (['mp4', 'mov', 'avi'].includes(fileExtension)) fileIcon = 'fa-file-video';

        contentHTML += `
            <div class="message-file flex items-center text-blue-800">
                <i class="fa-solid ${fileIcon} text-2xl mr-2"></i>
                <a href="${message.fileUrl}" target="_blank" class="underline hover:text-blue-600">${message.fileName}</a>
            </div>
        `;
    }

    messageElement.innerHTML += contentHTML;

    const metaDiv = document.createElement('div');
    metaDiv.classList.add('message-meta');
    if (!isMine) {
        metaDiv.innerHTML += `<span class="font-bold text-blue-700">${message.sender}</span>`;
    }
    metaDiv.innerHTML += `<span>${formatTimestamp(message.timestamp)}</span>`;
    messageElement.appendChild(metaDiv);

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage(text, type = 'text', imageUrl = null, fileUrl = null, fileName = null) {
    console.log("sendMessage called. Type:", type, "Text:", text);
    if (!currentUserId || !currentRoomCode || !messagesRef) {
        console.error("sendMessage: Chat references not initialized. Cannot send message.");
        return;
    }

    const message = {
        sender: currentUsername,
        timestamp: serverTimestamp(),
        type: type,
    };

    if (type === 'text') {
        message.text = text;
    } else if (type === 'image') {
        message.imageUrl = imageUrl;
        message.text = 'Image';
    } else if (type === 'file') {
        message.fileUrl = fileUrl;
        message.fileName = fileName;
        message.text = 'File';
    }

    try {
        await push(messagesRef, message);
        messageInput.value = '';
        if (typingRef) {
            set(typingRef, false); // Ensure typingRef is initialized before setting
        }
    } catch (error) {
        console.error("Error sending message to Firebase:", error);
    }
}

async function handleFileUpload(event) {
    console.log("handleFileUpload called.");
    const file = event.target.files[0];
    if (!file) return;

    if (!supabaseClientInstance) { // Use the instance name here
        showModal('Supabase is not configured. File uploads are disabled.', false);
        console.error('handleFileUpload: Supabase client is not initialized.');
        return;
    }
    if (!currentRoomCode || !currentUserId) {
        console.error("handleFileUpload: Room code or user ID is missing. Cannot upload file. currentRoomCode:", currentRoomCode, "currentUserId:", currentUserId);
        showModal('Cannot upload file: Room information missing. Please rejoin chat.', false);
        return;
    }

    const fileName = `${currentRoomCode}/${currentUserId}/${Date.now()}_${file.name}`;
    const fileType = file.type;

    try {
        addMessageToChat({
            sender: 'System',
            text: `Uploading "${file.name}"...`,
            type: 'system',
            timestamp: Date.now()
        });

        console.log(`Attempting Supabase upload to bucket 'parichat-files' with path: ${fileName}`);
        const { data, error } = await supabaseClientInstance.storage // Use the instance name here
            .from('parichat-files')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error("Supabase upload error:", error);
            throw error;
        }
        console.log("Supabase upload data:", data);

        const { data: publicUrlData, error: publicUrlError } = supabaseClientInstance.storage // Use the instance name here
            .from('parichat-files')
            .getPublicUrl(fileName);

        if (publicUrlError) {
            console.error("Supabase getPublicUrl error:", publicUrlError);
            throw publicUrlError;
        }
        if (!publicUrlData || !publicUrlData.publicUrl) {
            throw new Error('Failed to get public URL for the uploaded file.');
        }
        console.log("Public URL obtained:", publicUrlData.publicUrl);

        if (fileType.startsWith('image/')) {
            await sendMessage('', 'image', publicUrlData.publicUrl, null, file.name);
        } else {
            await sendMessage('', 'file', null, publicUrlData.publicUrl, file.name);
        }

    } catch (error) {
        console.error("Final Error in handleFileUpload:", error);
        addMessageToChat({
            sender: 'System',
            text: `Failed to upload "${file.name}": ${error.message}. Please check Supabase URL, Anon Key, and Storage Bucket/Policies.`,
            type: 'system',
            timestamp: Date.now()
        });
    } finally {
        imageUploadInput.value = '';
    }
}

// --- Presence and Room Logic ---
function listenForPresence() {
    if (!currentRoomCode || !db) {
        console.error("listenForPresence: Room code or DB not initialized. Cannot listen for presence.");
        return;
    }
    const roomPresenceRef = ref(db, `rooms/${currentRoomCode}/presence`);
    onValue(roomPresenceRef, (snapshot) => {
        const users = [];
        snapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val();
            if (userData.username) {
                users.push(userData.username);
            }
        });

        onlineUsersCountDisplay.textContent = `Online: ${users.length}`;
        console.log("Online users updated:", users.length);

        const jitsiApiInstance = getJitsiApi();
        if (jitsiApiInstance) {
            const jitsiParticipantsCount = jitsiApiInstance.getNumberOfParticipants ? jitsiApiInstance.getNumberOfParticipants() : 0;
            // If Firebase indicates only 1 user (current user) AND Jitsi also indicates 1 participant
            // This is a simple heuristic to detect if the other person left the video call.
            if (users.length <= 1 && users.some(user => user === currentUsername) && jitsiParticipantsCount <= 1) {
                console.log("Other user left room (Firebase) and Jitsi. Ending call.");
                endVideoCall(); // Call the Jitsi service end call
                addMessageToChat({
                    sender: 'System',
                    text: 'The other user has left the room, ending the video call.',
                    type: 'system',
                    timestamp: Date.now()
                });
            }
        }
    });
}

async function handleLeaveRoom() {
    console.log("handleLeaveRoom called.");
    try {
        const confirmed = await showModal('Are you sure you want to leave the chat?', true);
        console.log("Modal confirmed status:", confirmed);

        if (confirmed) {
            // End Jitsi call if active
            const jitsiApiInstance = getJitsiApi();
            if (jitsiApiInstance) {
                endVideoCall();
                console.log("Jitsi API ended.");
            }

            // Remove user presence from Firebase
            if (presenceRef) {
                console.log("Removing user presence from Firebase at path:", presenceRef.toString());
                await remove(presenceRef);
                console.log("User presence removed from Firebase.");
                sendMessage(`**${currentUsername}** left the chat.`, 'system');
            } else {
                console.warn("presenceRef was null when attempting to leave room. User might not have fully connected.");
            }

            // Clear localStorage to force re-login on next visit
            localStorage.removeItem('paritalk_username');
            localStorage.removeItem('paritalk_roomcode');
            localStorage.removeItem('paritalk_has_joined_session');
            localStorage.removeItem('paritalk_joined_message_sent_for_' + currentRoomCode + currentUsername);
            console.log("LocalStorage cleared.");

            console.log("Attempting redirect to index.html...");
            window.location.href = 'index.html';
            return; // Prevent further execution
        }
    } catch (error) {
        console.error("Error during handleLeaveRoom:", error);
        showModal(`Error leaving room: ${error.message}`, false);
    } finally {
        hideModal();
    }
}

// --- Typing Indicator Logic ---
function setTypingStatus(isTyping) {
    if (typingRef) {
        set(typingRef, isTyping);
    } else {
        console.warn("typingRef not initialized. Cannot set typing status.");
    }
}

function listenForTyping() {
    if (!currentRoomCode || !db) {
        console.error("listenForTyping: Room code or DB not initialized. Cannot listen for typing.");
        return;
    }
    const allTypingRef = ref(db, `rooms/${currentRoomCode}/typing`);
    onValue(allTypingRef, (snapshot) => {
        const typingUsers = [];
        snapshot.forEach((childSnapshot) => {
            if (childSnapshot.key !== currentUserId && childSnapshot.val() === true) {
                typingUsers.push(childSnapshot.key);
            }
        });

        if (typingUsers.length > 0) {
            typingIndicator.textContent = 'Typing...';
            typingIndicator.classList.remove('hidden');
        } else {
            typingIndicator.classList.add('hidden');
        }
    });
}

// --- Event Listeners ---
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const messageText = messageInput.value.trim();
        if (messageText) {
            sendMessage(messageText, 'text');
        }
    }
    setTypingStatus(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        setTypingStatus(false);
    }, 2000);
});

messageInput.addEventListener('blur', () => {
    setTypingStatus(false);
    clearTimeout(typingTimeout);
});

sendButton.addEventListener('click', () => {
    const messageText = messageInput.value.trim();
    if (messageText) {
        sendMessage(messageText, 'text');
    }
});

imageUploadInput.addEventListener('change', handleFileUpload);
videoCallButton.addEventListener('click', () => startVideoCall(showModal)); // Pass showModal to Jitsi service
leaveRoomButton.addEventListener('click', handleLeaveRoom);

// Event listeners for modal buttons (handled in modal_service.js)
// window.addEventListener('beforeunload', async (e) => {
//     // This often doesn't complete reliably as the page is closing, but included for best effort.
//     if (presenceRef) {
//         console.log("Beforeunload: Attempting to remove user presence.");
//         await remove(presenceRef);
//         // No need to dispose Jitsi API here, as beforeunload will destroy the iframe anyway.
//     }
// });
