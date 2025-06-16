// js/jitsi_video_call.js

// Global variable to hold the JitsiMeetExternalAPI instance
let jitsiApi = null;
let jitsiScriptLoaded = false;

// Function to load the Jitsi Meet external API script
export function loadJitsiScript() {
    return new Promise((resolve, reject) => {
        if (jitsiScriptLoaded && window.JitsiMeetExternalAPI) {
            console.log("Jitsi script already loaded.");
            return resolve();
        }

        const existingScript = document.querySelector('script[src="https://meet.jit.si/external_api.js"]');
        if (existingScript) {
            if (window.JitsiMeetExternalAPI) {
                jitsiScriptLoaded = true;
                return resolve();
            } else {
                console.warn("Jitsi script element found but JitsiMeetExternalAPI not ready. Re-attempting load.");
                existingScript.remove(); // Remove the old one to ensure a fresh load
            }
        }

        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = () => {
            console.log("Jitsi external_api.js loaded successfully.");
            jitsiScriptLoaded = true;
            resolve();
        };
        script.onerror = (e) => {
            console.error('Failed to load Jitsi API script:', e);
            jitsiScriptLoaded = false;
            reject(new Error('Failed to load Jitsi API script.'));
        };
        document.body.appendChild(script);
    });
}

/**
 * Initializes the Jitsi Meet instance within the provided container.
 * @param {string} roomCode The unique room code for the Jitsi conference.
 * @param {string} username The display name for the user in the conference.
 * @param {HTMLElement} jitsiContainerElement The DOM element where the Jitsi iframe will be rendered.
 * @param {Function} onConferenceEndedCallback Callback to run when the conference ends (e.g., to hide Jitsi UI).
 * @param {Function} onConferenceErrorCallback Callback to run when a Jitsi conference error occurs.
 */
export async function initializeJitsiInstance(roomCode, username, jitsiContainerElement, onConferenceEndedCallback, onConferenceErrorCallback) {
    const jitsiRoomName = `SecureCall_${roomCode}`; // Using the same prefix as your .tsx code
    console.log("Attempting to initialize Jitsi with room name:", jitsiRoomName);

    if (!window.JitsiMeetExternalAPI) {
        console.error('JitsiMeetExternalAPI not found. Jitsi script might not have loaded correctly.');
        onConferenceErrorCallback('Jitsi video call service not ready. Please try again.');
        return;
    }

    if (jitsiApi) {
        console.log("Jitsi API already initialized. Disposing existing instance.");
        jitsiApi.dispose(); // Dispose existing instance before creating a new one
        jitsiApi = null;
    }

    // Ensure the container is visible
    if (jitsiContainerElement) {
        jitsiContainerElement.classList.remove('hidden');
        jitsiContainerElement.style.display = 'flex';
    } else {
        console.error("Jitsi container element not provided or is null.");
        onConferenceErrorCallback('Jitsi UI container missing.');
        return;
    }

    const domain = 'meet.jit.si'; // Jitsi public instance
    const options = {
        roomName: jitsiRoomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerElement.querySelector('#jitsi-meet-api'), // Ensure this points to the internal div
        userInfo: {
            displayName: username
        },
        configOverwrite: {
            // Core settings (from your .tsx and previous versions)
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableSelfView: false,
            enableClosePage: false,
            enableWelcomePage: false,
            prejoinPageEnabled: false,
            startSilent: false,

            // AGGRESSIVE SETTINGS TO BYPASS AUTHENTICATION/LOBBY (from your .tsx)
            enableUserRolesBasedOnToken: false, // CRUCIAL: Tell Jitsi not to expect/enforce JWT roles
            enableInsecureRoomNameWarning: false,
            requireDisplayName: false,
            enableLobbyChat: false,
            enableNoisyMicDetection: false,
            disableInviteFunctions: true,
            doNotStoreRoom: true,
            disableProfile: true,
            hideConferenceSubject: true,
            hideConferenceTimer: true,
            hideParticipantsStats: true,
            disableRemoteMute: true,
            remoteVideoMenu: {
                disableKick: true,
                disableGrantModerator: true,
                disablePrivateChat: true // Added from your .tsx
            },
            toolbarButtons: [
                'microphone', 'camera', 'hangup', 'desktop', 'fullscreen',
                'fodeviceselection', 'stats' // 'stats' added from .tsx
            ],
            disableDeepLinking: true,
            disableAddingBackgroundImages: true,
            disableVirtualBackground: true,
            roomPasswordNumberOfDigits: false, // From .tsx
            enableRoomPasswordGeneration: false, // From .tsx
            p2p: {
                enabled: true,
                stunServers: [ // From .tsx
                    { urls: 'stun:meet-jit-si-turnrelay.jitsi.net:443' }
        // Event listeners
        jitsiApi.addEventListener('videoConferenceJoined', () => {
            console.log('Successfully joined the conference');
            // Assuming the parent component will handle isLoading state
        });

        jitsiApi.addEventListener('videoConferenceLeft', () => {
            console.log('Left the conference');
            onConferenceEndedCallback();
        });

        jitsiApi.addEventListener('readyToClose', () => {
            console.log('Ready to close');
            onConferenceEndedCallback();
        });

        jitsiApi.addEventListener('videoConferenceError', (error) => {
            console.error('Jitsi conference error:', error);
            onConferenceErrorCallback('Connection error. Please try again.');
        });

        // Participant management - limit to 2 people as per .tsx logic
        jitsiApi.addEventListener('participantJoined', (participant) => {
            console.log('Participant joined:', participant);
            jitsiApi.executeCommand('getParticipantsInfo').then((participantsArray) => {
                console.log('Current participants:', participantsArray.length);
                if (participantsArray.length > 2) {
                    console.log('Too many participants, cannot kick as guest. Notifying user.');
                    onConferenceErrorCallback('Room is full. Only 2 people can join this call.');
                }
            }).catch((err) => {
                console.warn('Could not get participants info (this is expected if guest mode is too restricted):', err);
            });
        });

        jitsiApi.addEventListener('participantLeft', (participant) => {
            console.log('Participant left:', participant);
            // Clear errors if room becomes not full
            jitsiApi.executeCommand('getParticipantsInfo').then((participantsArray) => {
                if (participantsArray.length <= 2) {
                    onConferenceErrorCallback(null); // Clear error message if room is no longer full
                }
            }).catch((err) => {
                 console.warn('Could not get participants info after left (expected for guest):', err);
            });
        });

        console.log("Jitsi API initialized and event listeners attached.");

    } catch (error) {
        console.error("Error initializing Jitsi API:", error);
        onConferenceErrorCallback('Failed to initialize video call. Please check console for details.');
        hangUpCall(); // Ensure cleanup if initialization failed
    }
}

// Function to hang up the Jitsi video call
export function hangUpCall(onConferenceEndedCallback) {
    if (jitsiApi) {
        try {
            jitsiApi.dispose(); // This closes the Jitsi meeting in the iframe
            jitsiApi = null;
            console.log("Jitsi API disposed.");
        } catch (error) {
            console.error("Error disposing Jitsi API:", error);
        }
    }
    jitsiScriptLoaded = false; // Reset flag to allow re-loading script

    // Call the provided callback to handle UI cleanup in chat.html
    if (onConferenceEndedCallback) {
        onConferenceEndedCallback();
    }
}
