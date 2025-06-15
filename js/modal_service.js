
// js/modal_service.js

const confirmationModal = document.getElementById('confirmation-modal');
const modalMessage = document.getElementById('modal-message');
const modalConfirm = document.getElementById('modal-confirm');
const modalCancel = document.getElementById('modal-cancel');
let resolveModalPromise;

/**
 * Displays a modal with a message and optional confirmation buttons.
 * @param {string} message - The message to display in the modal.
 * @param {boolean} isConfirm - If true, displays Yes/No buttons. If false, displays an OK button.
 * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled/OK.
 */
export function showModal(message, isConfirm = true) {
    console.log("Modal Service: showModal called with message:", message, "isConfirm:", isConfirm);
    modalMessage.textContent = message;

    if (isConfirm) {
        modalConfirm.style.display = 'inline-block';
        modalCancel.style.display = 'inline-block';
        modalConfirm.textContent = 'Yes';
        modalCancel.textContent = 'No';
    } else {
        modalConfirm.style.display = 'inline-block';
        modalCancel.style.display = 'none'; // Hide cancel for alerts
        modalConfirm.textContent = 'OK';
    }

    confirmationModal.style.display = 'flex'; // Use flex to center content
    return new Promise(resolve => {
        resolveModalPromise = resolve;
    });
}

/**
 * Hides the currently displayed modal.
 */
export function hideModal() {
    console.log("Modal Service: hideModal called.");
    confirmationModal.style.display = 'none';
}

// Attach event listeners to modal buttons when the module loads
// (Assumes modal buttons exist in chat.html or the page importing this)
if (modalConfirm) {
    modalConfirm.addEventListener('click', () => {
        if (resolveModalPromise) resolveModalPromise(true);
        hideModal();
    });
}
if (modalCancel) {
    modalCancel.addEventListener('click', () => {
        if (resolveModalPromise) resolveModalPromise(false);
        hideModal();
    });
}
