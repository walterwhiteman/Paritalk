
// js/supabase_service.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

/**
 * Initializes the Supabase client.
 * @param {string} url - Your Supabase Project URL.
 * @param {string} anonKey - Your Supabase Anon Key.
 * @returns {object} The initialized Supabase client instance.
 */
export function createSupabaseClient(url, anonKey) {
    if (!url || !anonKey) {
        console.warn('Supabase URL or Anon Key not provided. Supabase client will not be initialized.');
        supabase = null; // Ensure supabase is null if keys are missing
        return null;
    }
    supabase = createClient(url, anonKey);
    return supabase;
}

// Export the supabase client instance (will be null if not initialized)
export { supabase };
