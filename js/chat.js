// js/chat.js

import { auth, db, storage, onAuthStateChanged, ref, push, onChildAdded, onValue, set, remove, onDisconnect, serverTimestamp, runTransaction, child, storageRef, uploadBytes, getDownloadURL } from './firebase-init.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { showModal, hideModal } from './modal.js';
import { initializeJitsiService, startJitsiCall, endJitsiCall, getJitsiApi } from './videoCall.js';

// Supabase Configuration
const SUPABASE_URL = 'https://uokpkgybjzvpngoxasnm.supabase.co'; // Your confirmed Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVva3BrZ3lianp2cG5nb3hhc25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MjE4NTcsImV4cCI6MjA2NTQ5Nzg1N30.FNv_13S3oj7fjartmY2PzKL25T3AWbMxP2KRI0rFU2E';

let supabaseClientInstance;
try {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.warn('Supabase URL or Anon Key not set. Image/file uploads will not work.');
    } else {
        supabaseClientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (error) {
    console.error('Failed to initialize Supabase in chat.js:', error);
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

// UI Elements (updated to match new chat.html exact design)
const chatMainContainer = document.querySelector('.chat-main-container'); // Main app container
const roomNameValueDisplay = document.getElementById('room-name-value'); // Value inside "Room code : [ID]"
const connectedUsersCount = document.getElementById('connectedUsersCount');
const chatMessages = document.getElementById('chatMessages'); // The main messages area
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const imageUpload = document.getElementById('imageUpload');
const videoCallBtn = document.getElementById('videoCallBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

// Jitsi specific UI elements (updated IDs/classes to match new chat.html)
const jitsiContainer = document.getElementById('jitsi-container');
const jitsiIframe = document.getElementById('jitsi-iframe');
const hangupButton = document.getElementById('hangup-button'); // This button is inside jitsi-controls

// Get Room Code and Username from URL
const urlParams = new URLSearchParams(window.location.search);
const urlRoomCode = urlParams.get('room');
const urlUsername = urlParams.get('user');

// If not logged in, redirect to index.html
if (!urlRoomCode || !urlUsername) {
    window.location.href = 'index.html'; // Redirect to login
} else {
    currentRoomCode = decodeURIComponent(urlRoomCode);
    currentUsername = decodeURIComponent(urlUsername);
    roomNameValueDisplay.textContent = currentRoomCode; // Set only room code value
}

// --- Authentication & Initialization ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        if (!currentRoomCode || !currentUsername) {
            console.error("Room code or username missing after auth. Cannot set up Firebase refs.");
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

        try {
            // Set user presence
            await set(presenceRef, { username: currentUsername, lastSeen: serverTimestamp() });
            onDisconnect(presenceRef).remove(); // Remove user from presence when disconnected

            // Send "joined" message only if not already sent for this session
            if (!localStorage.getItem('paritalk_joined_message_sent_for_' + currentRoomCode + currentUsername)) {
                sendMessage(`**${currentUsername}** joined the chat.`, 'system');
                localStorage.setItem('paritalk_joined_message_sent_for_' + currentRoomCode + currentUsername, 'true');
            }

            // Start listeners
            listenForMessages();
            listenForPresence();
            listenForTyping();

            messageInput.focus();

            // Initialize Jitsi Service with all necessary elements and callback
            initializeJitsiService(currentRoomCode, currentUsername, jitsiIframe, jitsiContainer, hangupButton, () => {
                // Callback to handle when Jitsi's internal "readyToClose" fires
                endJitsiCall(); // Ensure UI is reset if call ends internally
            });

        } catch (error) {
            console.error("Error setting up chat listeners/presence:", error);
            // Clear relevant localStorage items for a clean retry
            localStorage.removeItem('paritalk_username');
            localStorage.removeItem('paritalk_roomcode');
            localStorage.removeItem('paritalk_joined_message_sent_for_' + currentRoomCode + currentUsername);
            showModal('Failed to set up chat. Please re-join. Error: ' + error.message, false).then(() => {
                window.location.href = 'index.html';
            });
        }
    } else {
        console.warn("User not authenticated in chat.js. Redirecting to login.");
        window.location.href = 'index.html?error=' + encodeURIComponent('Authentication failed. Please re-login.');
    }
});


// --- Helper Functions ---
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) { // Check if date is valid
        return '';
    }
    const options = { hour: 'numeric', minute: 'numeric', hour12: true };
    return date.toLocaleTimeString('en-US', options);
}

// Function to add a message to the chat UI
function addMessageToChat(message, messageId = null) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message-bubble-exact'); // Use new class
    if (messageId) messageElement.dataset.messageId = messageId; // Store message ID for reactions

    let contentHTML = '';

    if (message.type === 'system') {
        messageElement.classList.add('system'); // Keep 'system' class
        messageElement.textContent = message.text;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return; // System messages don't need sender/timestamp/reactions
    }

    const isMine = message.sender === currentUsername;
    messageElement.classList.add(isMine ? 'mine' : 'other');

    if (!isMine && message.sender) { // Only show sender's name for 'other' messages if sender exists
        contentHTML += `<p class="message-sender-exact">${message.sender}</p>`; // Use new class
    }

    if (message.type === 'text') {
        contentHTML += `<p class="message-content-exact">${message.text}</p>`; // Use new class
    } else if (message.type === 'image') {
        contentHTML += `<img src="${message.imageUrl}" alt="Shared Image" class="message-image-exact" onerror="this.onerror=null;this.src='https://placehold.co/150x100/eeeeee/aaaaaa?text=Image+Load+Failed';">`; // Use new class
    } else if (message.type === 'file') {
        let fileIcon = 'description'; // Default Material Symbol for file
        const fileExtension = message.fileName.split('.').pop().toLowerCase();
        if (['pdf'].includes(fileExtension)) fileIcon = 'picture_as_pdf';
        else if (['doc', 'docx'].includes(fileExtension)) fileIcon = 'article';
        else if (['xls', 'xlsx'].includes(fileExtension)) fileIcon = 'grid_on';
        else if (['ppt', 'pptx'].includes(fileExtension)) fileIcon = 'slideshow';
        else if (['zip', 'rar', '7z'].includes(fileExtension)) fileIcon = 'folder_zip';
        else if (['mp3', 'wav', 'ogg'].includes(fileExtension)) fileIcon = 'audio_file';
        else if (['mp4', 'mov', 'avi'].includes(fileExtension)) fileIcon = 'videocam';

        contentHTML += `
            <div class="message-file-exact">
                <span class="material-symbols-outlined">${fileIcon}</span>
                <a href="${message.fileUrl}" target="_blank">${message.fileName}</a>
            </div>
        `; // Use new class
    }

    messageElement.innerHTML += contentHTML;
    messageElement.innerHTML += `<p class="message-timestamp-exact">${formatTimestamp(message.timestamp)}</p>`; // Use new class

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
}

// Function to send a message to Firebase Realtime Database
async function sendMessage(text, type = 'text', imageUrl = null, fileUrl = null, fileName = null) {
    if (!currentUserId || !currentRoomCode || !messagesRef) {
        console.error("Chat references not initialized. Cannot send message.");
        return;
    }

    const message = {
        sender: currentUsername,
        timestamp: serverTimestamp(), // Firebase server timestamp
        type: type,
    };

    if (type === 'text') {
        message.text = text;
    } else if (type === 'image') {
        message.imageUrl = imageUrl;
        message.text = 'Image'; // Placeholder text for display in chat list if needed
    } else if (type === 'file') {
        message.fileUrl = fileUrl;
        message.fileName = fileName;
        message.text = 'File'; // Placeholder text
    }

    try {
        await push(messagesRef, message);
        messageInput.value = ''; // Clear input after sending
        // Also clear typing indicator for self
        if (typingRef) {
            set(typingRef, false);
        }
    } catch (error) {
        console.error("Error sending message to Firebase:", error);
        showModal('Failed to send message: ' + error.message, false);
    }
}

// Function to handle file uploads to Supabase Storage
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!supabaseClientInstance) {
        showModal('Supabase is not configured. File uploads are disabled.', false);
        console.error('Supabase client is not initialized. Please configure SUPABASE_URL and SUPABASE_ANON_KEY.');
        return;
    }
    if (!currentRoomCode || !currentUserId) {
        console.error("Room code or user ID is missing. Cannot upload file. currentRoomCode:", currentRoomCode, "currentUserId:", currentUserId);
        showModal('Cannot upload file: Room information missing. Please rejoin chat.', false);
        return;
    }

    const filePath = `${currentRoomCode}/${currentUserId}/${Date.now()}_${file.name}`;
    const fileType = file.type;

    try {
        // Show a temporary message indicating upload
        addMessageToChat({
            sender: 'System',
            text: `Uploading "${file.name}"...`,
            type: 'system',
            timestamp: Date.now() // Use client timestamp for system messages
        });

        const { data, error } = await supabaseClientInstance.storage
            .from('parichat-files') // Ensure this bucket exists in your Supabase project
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false // Do not update existing file if name conflicts
            });

        if (error) {
            console.error("Supabase upload error:", error);
            throw error;
        }

        // Get public URL for the uploaded file
        const { data: publicUrlData, error: publicUrlError } = supabaseClientInstance.storage
            .from('parichat-files')
            .getPublicUrl(filePath);

        if (publicUrlError) {
            console.error("Supabase getPublicUrl error:", publicUrlError);
            throw publicUrlError;
        }
        if (!publicUrlData || !publicUrlData.publicUrl) {
            throw new Error('Failed to get public URL for the uploaded file.');
        }

        // Send chat message with file/image URL
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
        imageUpload.value = ''; // Clear the file input so the same file can be selected again
    }
}

// --- Presence and Room Limit Logic ---
function listenForPresence() {
    const roomPresenceRef = ref(db, `rooms/${currentRoomCode}/presence`);
    onValue(roomPresenceRef, (snapshot) => {
        const users = [];
        snapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val();
            if (userData.username) {
                users.push(userData.username);
            }
        });

        // Update the connected users count display
        if (connectedUsersCount) {
            connectedUsersCount.textContent = users.length;
        }

        // Check for 2-user limit. If the current user is not in the list (e.g., kicked, or room full),
        // or if there are more than 2 users and current user is not part of the first 2.
        if (users.length > 2 || (users.length === 2 && !users.includes(currentUserId))) {
             showModal('This room is now full or you have been disconnected. You will be redirected to the login screen.', false).then(() => {
                 handleLeaveRoom(false); // Force leave without confirmation
             });
             return;
        }

        // Jitsi call state management based on Firebase presence
        const jitsiApiInstance = getJitsiApi(); // Get current Jitsi API instance
        if (jitsiApiInstance) {
            const jitsiParticipantsCount = jitsiApiInstance.getNumberOfParticipants ? jitsiApiInstance.getNumberOfParticipants() : 0;
            const firebaseOtherUsersCount = users.filter(u => u !== currentUsername).length;

            if (firebaseOtherUsersCount === 0 && jitsiParticipantsCount <= 1 && users.includes(currentUsername)) {
                console.log("Other user left room (Firebase) and Jitsi, ending call.");
                endJitsiCall(); // End the Jitsi call
                addMessageToChat({
                    sender: 'System',
                    text: 'The other user has left the call, ending the video session.',
                    type: 'system',
                    timestamp: Date.now()
                });
            }
        }
    });
}

// Handle leaving the room
async function handleLeaveRoom(showConfirmation = true) {
    let confirmed = true;
    if (showConfirmation) {
        confirmed = await showModal('Are you sure you want to leave the chat?', true);
    }
    
    if (confirmed) {
        const jitsiApiInstance = getJitsiApi();
        if (jitsiApiInstance) {
            endJitsiCall(); // End Jitsi call if active
        }
        if (presenceRef) {
            await remove(presenceRef); // Remove user from presence
            sendMessage(`**${currentUsername}** left the chat.`, 'system'); // Send "left" message
        }
        // Clear localStorage for a clean exit
        localStorage.removeItem('paritalk_username');
        localStorage.removeItem('paritalk_roomcode');
        localStorage.removeItem('paritalk_joined_message_sent_for_' + currentRoomCode + currentUsername);

        // Redirect to login page
        window.location.href = 'index.html';
    }
    hideModal(); // Ensure modal is hidden even if not confirmed
}

// --- Typing Indicator Logic ---
function setTypingStatus(isTyping) {
    if (typingRef) {
        set(typingRef, isTyping);
    }
}

function listenForTyping() {
    const allTypingRef = ref(db, `rooms/${currentRoomCode}/typing`);
    const typingIndicatorElement = document.querySelector('.typing-indicator-exact'); // Get the element with new class

    onValue(allTypingRef, (snapshot) => {
        const typingUsers = [];
        snapshot.forEach((childSnapshot) => {
            if (childSnapshot.key !== currentUserId && childSnapshot.val() === true) {
                // Assuming childSnapshot.val() contains the username or we get it from presence list
                typingUsers.push(childSnapshot.val().username || 'Someone'); // Fallback to 'Someone' if username not directly stored in typing status
            }
        });

        if (typingUsers.length > 0) {
            if (typingIndicatorElement) {
                typingIndicatorElement.textContent = `${typingUsers[0]} is typing...`; // Show name of first typing user
                typingIndicatorElement.style.display = 'block'; // Show element
            }
        } else {
            if (typingIndicatorElement) {
                typingIndicatorElement.style.display = 'none'; // Hide element
            }
        }
    });
}

// --- Event Listeners ---
messageInput.addEventListener('input', () => {
    setTypingStatus(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        setTypingStatus(false);
    }, 2000); // Set false after 2 seconds of inactivity
});

messageInput.addEventListener('blur', () => {
    setTypingStatus(false);
    clearTimeout(typingTimeout);
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const messageText = messageInput.value.trim();
        if (messageText) {
            sendMessage(messageText, 'text');
        }
    }
});

sendMessageBtn.addEventListener('click', () => {
    const messageText = messageInput.value.trim();
    if (messageText) {
        sendMessage(messageText, 'text');
    }
});

imageUpload.addEventListener('change', handleFileUpload);
videoCallBtn.addEventListener('click', () => startJitsiCall()); // Call Jitsi start function
leaveRoomBtn.addEventListener('click', () => handleLeaveRoom(true)); // Pass true for confirmation


// Handle browser window close/reload
window.addEventListener('beforeunload', async (e) => {
    // Firebase onDisconnect is usually sufficient, but explicitly setting offline status
    // and ending Jitsi can provide a more immediate cleanup.
    if (presenceRef) {
        await remove(presenceRef); // Explicitly remove presence
    }
    const jitsiApiInstance = getJitsiApi();
    if (jitsiApiInstance) {
        jitsiApiInstance.dispose(); // Dispose Jitsi API
    }
    // No e.preventDefault() to allow the browser to close without prompt
});

