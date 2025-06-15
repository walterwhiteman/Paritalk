// js/videoCall.js

// JitsiMeetExternalAPI is globally available once loaded in HTML
let jitsiApi = null;
let currentJitsiRoomName = '';
let currentUsername = ''; // To pass to Jitsi userInfo
let jitsiIframeElement = null;
let jitsiContainerElement = null;
// References to chat UI elements to show/hide when video call is active
let chatMessagesElement = null;
let chatHeaderElement = null;
let chatFooterElement = null;


/**
 * Initializes Jitsi service with necessary elements and callback.
 * This should be called once when the chat page loads.
 * @param {string} roomCode - The room code for Jitsi.
 * @param {string} username - The display name for the user in Jitsi.
 * @param {HTMLElement} iframeElement - The iframe element to embed Jitsi into.
 * @param {HTMLElement} containerElement - The container element that holds the Jitsi iframe and controls.
 * @param {HTMLElement} hangupBtnElement - The button element that hangs up the Jitsi call.
 * @param {Function} onJitsiCloseCallback - A callback function to run when Jitsi indicates it's ready to close.
 */
export function initializeJitsiService(roomCode, username, iframeElement, containerElement, hangupBtnElement, onJitsiCloseCallback) {
    currentJitsiRoomName = `Paritalk_${roomCode}`; // Jitsi room names often benefit from a prefix
    currentUsername = username;
    jitsiIframeElement = iframeElement;
    jitsiContainerElement = containerElement;
    hangupButtonElement = hangupBtnElement;

    // Get references to chat UI elements for showing/hiding (updated to new classes/IDs)
    chatMessagesElement = document.getElementById('chatMessages');
    chatHeaderElement = document.querySelector('.chat-header-exact'); // Select by new class
    chatFooterElement = document.querySelector('.chat-footer-exact'); // Select by new class

    // Attach click listener for our custom hangup button
    if (hangupButtonElement) {
        hangupButtonElement.onclick = () => {
            endJitsiCall(); // Call our wrapper function
            if (onJitsiCloseCallback) onJitsiCloseCallback(); // Also call the external callback
        };
    }
}

/**
 * Starts the Jitsi video call.
 */
export function startJitsiCall() {
    if (jitsiApi) {
        console.log("Jitsi call already active.");
        return;
    }

    const domain = 'meet.jit.si'; // Public Jitsi Meet instance
    const options = {
        roomName: currentJitsiRoomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiIframeElement.parentNode, // This places the Jitsi iframe within its container
        userInfo: {
            displayName: currentUsername
        },
        configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            enableWelcomePage: false, // Prevents Jitsi's welcome screen
            prejoinPageEnabled: false, // Disables the prejoin screen
            // Add other configurations as needed, e.g., toolbar buttons
            toolbarButtons: ['microphone', 'camera', 'desktop', 'fullscreen', 'fodeviceselection', 'hangup', 'profile', 'chat', 'raisehand', 'tileview', 'mute-everyone', 'security', 'settings', 'shortcuts', 'subject', 'toggle-camera']
        },
        interfaceConfigOverwrite: {
            APP_NAME: 'Paritalk Video Call',
            HIDE_INVITE_MORE_TOOLBAR_BUTTON: true, // Hide the invite more people button
            SHOW_JITSI_WATERMARK: false, // Hide Jitsi watermark
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_CHROME_EXTENSION_BANNER: false, // Hide "Install extension" banner
            TOOLBAR_ALWAYS_VISIBLE: true, // Keep toolbar visible
            // More UI customization options: https://jitsi.github.io/handbook/docs/dev-guide/enable-and-configure-features/
        }
    };

    // Create a new JitsiMeetExternalAPI instance
    jitsiApi = new JitsiMeetExternalAPI(domain, options);

    // Add Jitsi event listeners (optional, but good for robust handling)
    jitsiApi.addEventListener('readyToClose', () => {
        console.log('Jitsi API ready to close event fired.');
        // This fires when Jitsi's internal "end meeting" button is clicked
        endJitsiCall(); // Call our wrapper function to hide Jitsi UI
    });
    jitsiApi.addEventListener('participantLeft', (participant) => {
        console.log('Jitsi Participant Left:', participant);
        // The Firebase presence listener in chat.js will also detect this,
        // so we primarily rely on that for overall room state changes.
    });

    // Show Jitsi container and hide chat screen
    if (jitsiContainerElement) {
        jitsiContainerElement.style.display = 'flex'; // Use flex to ensure Jitsi iframe fills container
    }
    // Hide chat UI elements (updated to new classes/IDs)
    if (chatMessagesElement) chatMessagesElement.style.display = 'none';
    if (chatHeaderElement) chatHeaderElement.style.display = 'none';
    if (chatFooterElement) chatFooterElement.style.display = 'none';
}

/**
 * Ends the Jitsi video call and cleans up.
 */
export function endJitsiCall() {
    if (jitsiApi) {
        jitsiApi.dispose(); // Dispose of the Jitsi API instance
        jitsiApi = null;
    }

    // Hide Jitsi container and show chat screen
    if (jitsiContainerElement) {
        jitsiContainerElement.style.display = 'none';
    }
    // Restore chat UI elements display to their default/expected value (flex in this case)
    if (chatMessagesElement) chatMessagesElement.style.display = 'flex';
    if (chatHeaderElement) chatHeaderElement.style.display = 'flex';
    if (chatFooterElement) chatFooterElement.style.display = 'flex';
}

/**
 * Returns the current Jitsi API instance.
 * @returns {Object|null} The Jitsi API instance or null if no call is active.
 */
export function getJitsiApi() {
    return jitsiApi;
}
