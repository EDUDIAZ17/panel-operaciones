// assets/js/services/samsara.js

const SAMSARA_API_TOKEN = 'samsara_api_zrL4tdybycczdsflQyxe1AQCadm9ay';
const SAMSARA_BASE_URL = 'https://api.samsara.com';

// Helpful for local development CORS issues (allorigins usually blocks custom headers in some configs)
// Using corsproxy.io as it handles headers more transparently for preflights
const SAM_CORS_PROXY = 'https://corsproxy.io/?';

export async function fetchSamsaraLocations() {
    let url = `${SAMSARA_BASE_URL}/fleet/vehicles/locations`;
    
    try {
        // Try direct first
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${SAMSARA_API_TOKEN}` }
        });

        if (response.ok) {
            const data = await response.json();
            return data.data || [];
        }
        throw new Error('Direct fetch failed');
    } catch (error) {
        console.warn('Direct Samsara fetch failed, attempting proxy fallback...');
        
        try {
            const proxyUrl = `${SAM_CORS_PROXY}${encodeURIComponent(url)}`;
            const proxyResponse = await fetch(proxyUrl, {
                headers: { 'Authorization': `Bearer ${SAMSARA_API_TOKEN}` }
            });
            
            if (!proxyResponse.ok) throw new Error('Proxy fetch failed');
            const data = await proxyResponse.json();
            return data.data || [];
        } catch (proxyError) {
            console.error('⛔ CORS BLOCK: No se puede acceder a Samsara.');
            return [];
        }
    }
}

export async function fetchSamsaraVehicles() {
    let url = `${SAMSARA_BASE_URL}/fleet/vehicles`;
    try {
        const proxyUrl = `${SAM_CORS_PROXY}${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, {
            headers: { 'Authorization': `Bearer ${SAMSARA_API_TOKEN}` }
        });
        if (!response.ok) throw new Error('Samsara API error');
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('Error fetching Samsara vehicles:', error);
        return [];
    }
}

export async function fetchSamsaraDrivers() {
    let url = `${SAMSARA_BASE_URL}/fleet/drivers`;
    try {
        const proxyUrl = `${SAM_CORS_PROXY}${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, {
            headers: { 'Authorization': `Bearer ${SAMSARA_API_TOKEN}` }
        });
        if (!response.ok) throw new Error('Samsara API error');
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('Error fetching Samsara drivers:', error);
        return [];
    }
}

export async function fetchSamsaraStats(vehicleIds) {
    try {
        const end = new Date();
        const start = new Date(end.getTime() - 5 * 60 * 1000); 

        const url = new URL(`${SAMSARA_BASE_URL}/fleet/vehicles/stats`);
        url.searchParams.append('types', 'gps');
        url.searchParams.append('startTime', start.toISOString());
        url.searchParams.append('endTime', end.toISOString());
        if (vehicleIds && vehicleIds.length > 0) {
            url.searchParams.append('vehicleIds', vehicleIds.join(','));
        }

        const proxyUrl = `${SAM_CORS_PROXY}${encodeURIComponent(url.toString())}`;
        const response = await fetch(proxyUrl, {
            headers: { 'Authorization': `Bearer ${SAMSARA_API_TOKEN}` }
        });
        if (!response.ok) throw new Error('Samsara API error');
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('Error fetching Samsara stats:', error);
        return [];
    }
}

