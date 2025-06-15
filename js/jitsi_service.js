
// js/jitsi_service.js

let jitsiApi = null;
let currentRoomCode = '';
let currentUsername = '';
let jitsiIframeElement = null;
let jitsiContainerElement = null;
let chatScreenElement = null; // Element representing the main chat UI
let hangupButtonElement = null; // Reference to the hangup button

// Define a callback for when the Jitsi call ends from Jitsi's side
let onCallEndedCallback = null;

/**
 * Initializes the Jitsi Meet service with necessary DOM elements and current user/room info.
 * @param {string} roomCode - The current chat room code.
 * @param {string} username - The current user's display name.
 * @param {HTMLElement} iframeElement - The iframe where Jitsi will be loaded.
 * @param {HTMLElement} containerElement - The container div holding the iframe.
 * @param {HTMLElement} chatScreen - The main chat UI element to hide/show.
 * @param {HTMLElement} hangupBtn - The hangup button element.
 * @param {Function} endCallCb - Callback function to run when Jitsi disposes itself.
 */
export function initializeJitsiService(roomCode, username, iframeElement, containerElement, chatScreen, hangupBtn, endCallCb) {
    currentRoomCode = roomCode;
    currentUsername = username;
    jitsiIframeElement = iframeElement;
    jitsiContainerElement = containerElement;
    chatScreenElement = chatScreen;
    hangupButtonElement = hangupBtn;
    onCallEndedCallback = endCallCb;

    if (hangupButtonElement) {
        hangupButtonElement.onclick = endVideoCall;
    }
}

/**
 * Starts a Jitsi video call.
 * This function will hide the chat UI and display the Jitsi iframe.
 * @param {Function} showModalCb - Callback to show a modal for errors/messages.
 */
export function startVideoCall(showModalCb) {
    if (typeof JitsiMeetExternalAPI === 'undefined') {
        showModalCb("Jitsi Meet API is not loaded. Please ensure you have an internet connection and try again.", false);
        console.error("JitsiMeetExternalAPI is not defined. Jitsi script might not have loaded correctly.");
        return;
    }

    if (jitsiApi) {
        console.log("Jitsi call already active.");
        showModalCb("A call is already active. Please end the current call before starting a new one.", false);
        return;
    }
    if (!currentRoomCode || !currentUsername || !jitsiIframeElement || !jitsiContainerElement || !chatScreenElement) {
        console.error("Jitsi Service: Missing essential parameters for starting video call.", {
            currentRoomCode,
            currentUsername,
            jitsiIframeElement: !!jitsiIframeElement,
            jitsiContainerElement: !!jitsiContainerElement,
            chatScreenElement: !!chatScreenElement
        });
        showModalCb("Cannot start video call: Room or user information, or UI elements, are missing. Please try rejoining the chat.", false);
        return;
    }

    const domain = 'meet.jit.si'; // Using the public Jitsi Meet instance
    const options = {
        roomName: `Paritalk_${currentRoomCode}`, // Unique room name based on chat room
        width: '100%',
        height: '100%',
        parentNode: jitsiIframeElement.parentNode, // Parent where the iframe will be inserted
        userInfo: {
            displayName: currentUsername
        },
        configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            enableWelcomePage: false,
            prejoinPageEnabled: false,
            // Configure toolbar buttons for a clean UI
            toolbarButtons: [
                'microphone', 'camera', 'desktop', 'fullscreen', 'fodeviceselection',
                'hangup', 'profile', 'chat', 'raisehand', 'tileview',
                'mute-everyone', 'security', 'settings', 'shortcuts', 'subject', 'toggle-camera'
            ],
            // E2EE is NOT enabled here due to previous `membersOnly` error on meet.jit.si.
            // It requires JWT auth via a backend for custom rooms.
            // e2ee: { enabled: true } // Uncomment ONLY if using a Jitsi instance with JWT auth
        },
        interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            TILE_VIEW_MAX_COLUMNS: 2 // Example interface config
        }
    };

    try {
        jitsiApi = new JitsiMeetExternalAPI(domain, options);
        console.log("Jitsi API initialized for room:", `Paritalk_${currentRoomCode}`, "by user:", currentUsername);

        // Hide chat UI and display Jitsi container
        if (chatScreenElement) chatScreenElement.classList.add('hidden');
        if (jitsiContainerElement) jitsiContainerElement.style.display = 'flex';

        // Add Jitsi API event listeners
        jitsiApi.addEventListener('participantLeft', (participant) => {
            console.log('Jitsi Event: Participant Left:', participant);
        });

        jitsiApi.addEventListener('readyToClose', () => {
            console.log('Jitsi Event: readyToClose event fired. Calling endVideoCall.');
            // Jitsi itself triggered closure, call our local end handler
            if (onCallEndedCallback) {
                onCallEndedCallback();
            } else {
                endVideoCall();
            }
        });

    } catch (error) {
        console.error("Jitsi Service: Error initializing Jitsi Meet API:", error);
        showModalCb(`Failed to start video call: ${error.message}. Please check console for details.`, false);
        endVideoCall(); // Clean up UI even if initialization failed
    }
}

/**
 * Ends the Jitsi video call and restores the chat UI.
 */
export function endVideoCall() {
    if (jitsiApi) {
        try {
            jitsiApi.dispose(); // This closes the Jitsi meeting in the iframe
            jitsiApi = null;
            console.log("Jitsi Service: Jitsi API disposed.");
        } catch (error) {
            console.error("Jitsi Service: Error disposing Jitsi API:", error);
        }
    }
    // Restore chat UI
    if (jitsiContainerElement) jitsiContainerElement.style.display = 'none';
    if (chatScreenElement) chatScreenElement.classList.remove('hidden');
}

/**
 * Returns the current Jitsi API instance.
 * @returns {object|null} The JitsiMeetExternalAPI instance or null if not active.
 */
export function getJitsiApi() {
    return jitsiApi;
}
