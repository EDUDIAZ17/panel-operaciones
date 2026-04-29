import { supabase } from './supabaseClient.js';

/**
 * Fetches data from the Samsara API via a secure Supabase Edge Function to prevent exposing the API token.
 * @param {string} endpoint The Samsara API endpoint (e.g., '/fleet/vehicles')
 */
async function fetchFromEdgeFunction(endpoint) {
    try {
        const { data, error } = await supabase.functions.invoke('samsara-proxy', {
            body: { endpoint }
        });

        if (error) {
            console.error('Error invoking Samsara proxy:', error);
            throw error;
        }

        return data?.data || [];
    } catch (error) {
        console.error('Failed to fetch from Samsara Edge Function:', error);
        return [];
    }
}

export async function fetchSamsaraLocations() {
    return await fetchFromEdgeFunction('/fleet/vehicles/locations');
}

export async function fetchSamsaraVehicles() {
    return await fetchFromEdgeFunction('/fleet/vehicles');
}

export async function fetchSamsaraDrivers() {
    return await fetchFromEdgeFunction('/fleet/drivers');
}

export async function fetchSamsaraStats(vehicleIds) {
    // Note: If you need to pass specific vehicle IDs, you can append query params
    // to the endpoint string here or modify the edge function to accept a complete URL payload.
    const endpoint = '/fleet/vehicles/stats?types=obdOdometerMeters,gpsOdometerMeters,gps';
    return await fetchFromEdgeFunction(endpoint);
}

