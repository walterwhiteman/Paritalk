// js/modal.js

// UI Elements for the modal (updated to match new chat.html exact design)
const confirmationModal = document.getElementById('confirmationModal');
const modalMessage = document.getElementById('modalMessage');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

let resolveModalPromise;

/**
 * Displays a custom modal with a message and optional confirm/cancel buttons.
 * @param {string} message - The message to display in the modal.
 * @param {boolean} isConfirm - If true, shows 'Confirm'/'Cancel' buttons; otherwise, shows only 'OK'.
 * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false if cancelled/OK.
 */
export function showModal(message, isConfirm = true) {
    if (!confirmationModal || !modalMessage || !modalConfirmBtn || !modalCancelBtn) {
        console.error("Modal elements not found. Cannot show modal.");
        return Promise.resolve(false); // Fail gracefully
    }

    modalMessage.textContent = message;

    // Reset button text and visibility
    modalConfirmBtn.style.display = 'inline-flex';
    modalCancelBtn.style.display = 'inline-flex'; // Always set, then hide if not needed

    if (isConfirm) {
        modalConfirmBtn.querySelector('.material-symbols-outlined').textContent = 'check_circle';
        modalConfirmBtn.querySelector('span:last-child').textContent = 'Confirm';
        modalCancelBtn.querySelector('.material-symbols-outlined').textContent = 'cancel';
        modalCancelBtn.querySelector('span:last-child').textContent = 'Cancel';
    } else {
        modalConfirmBtn.querySelector('.material-symbols-outlined').textContent = 'check_circle';
        modalConfirmBtn.querySelector('span:last-child').textContent = 'OK';
        modalCancelBtn.style.display = 'none'; // Hide cancel button for 'OK' mode
    }

    confirmationModal.style.display = 'flex'; // Show the modal using flex display

    return new Promise(resolve => {
        resolveModalPromise = resolve;
    });
}

/**
 * Hides the custom modal.
 */
export function hideModal() {
    if (confirmationModal) {
        confirmationModal.style.display = 'none';
    }
}

// Attach event listeners to modal buttons once
if (modalConfirmBtn) {
    modalConfirmBtn.addEventListener('click', () => {
        if (resolveModalPromise) resolveModalPromise(true);
        hideModal();
    });
}
if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', () => {
        if (resolveModalPromise) resolveModalPromise(false);
        hideModal();
    });
}
