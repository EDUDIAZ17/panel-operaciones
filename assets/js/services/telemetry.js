// assets/js/services/telemetry.js
import { supabase } from './supabaseClient.js';

/**
 * Invoke a Supabase Edge Function by name
 */
async function invokeProxy(functionName, body) {
    if (!supabase) {
        console.warn('Supabase not initialized');
        return null;
    }
    try {
        const { data, error } = await supabase.functions.invoke(functionName, { body });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Failed to invoke Edge Function ${functionName}:`, error);
        return null;
    }
}

/**
 * Fetch Samsara vehicles
 */
export async function getSamsaraVehicles() {
    const data = await invokeProxy('samsara-proxy', { endpoint: '/fleet/vehicles' });
    return data?.data || [];
}

/**
 * Fetch Samsara drivers
 */
export async function getSamsaraDrivers() {
    const data = await invokeProxy('samsara-proxy', { endpoint: '/fleet/drivers' });
    return data?.data || [];
}

/**
 * Fetch Enlace vehicles
 */
export async function getEnlaceVehicles() {
    const data = await invokeProxy('enlace-proxy', { endpoint: '/assets/current-position' });
    return data?.data || [];
}

/**
 * Fetch Samsara safety events
 */
async function getSamsaraSafetyEvents(startIso, endIso) {
    const formattedStart = startIso.split('.')[0] + 'Z';
    const formattedEnd = endIso.split('.')[0] + 'Z';
    const endpoint = `/fleet/safety-events?startTime=${formattedStart}&endTime=${formattedEnd}`;
    const data = await invokeProxy('samsara-proxy', { endpoint });
    return data?.events || data?.data || [];
}

/**
 * Fetch Samsara speeding intervals
 */
async function getSamsaraSpeedingIntervals(startIso, endIso, vehicleIds = []) {
    let targetIds = vehicleIds;
    if (!targetIds || targetIds.length === 0) {
        const vehicles = await getSamsaraVehicles();
        targetIds = vehicles.map(v => v.id);
    }
    
    if (targetIds.length === 0) return [];

    const allIntervals = [];
    const BATCH_SIZE = 40; // Max 50 per request
    for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
        const batch = targetIds.slice(i, i + BATCH_SIZE);
        const assetIds = batch.join(',');
        const endpoint = `/fleet/vehicles/driver_speeding_intervals?startTime=${startIso}&endTime=${endIso}&assetIds=${assetIds}&queryBy=tripStartTime`;
        const res = await invokeProxy('samsara-proxy', { endpoint });
        const intervals = res?.data || [];
        allIntervals.push(...intervals);
    }
    return allIntervals;
}

/**
 * Fetch Samsara trips
 */
async function getSamsaraTrips(startIso, endIso, vehicleIds = []) {
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    
    let targetIds = vehicleIds;
    if (!targetIds || targetIds.length === 0) {
        const vehicles = await getSamsaraVehicles();
        targetIds = vehicles.slice(0, 20).map(v => v.id); // Limit to 20 vehicles to prevent rate limits
    }

    const allTrips = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
        const batch = targetIds.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (vId) => {
            const endpoint = `/v1/fleet/trips?vehicleId=${vId}&startMs=${startMs}&endMs=${endMs}`;
            const res = await invokeProxy('samsara-proxy', { endpoint });
            const trips = res?.trips || [];
            return trips.map(t => ({ ...t, vehicleId: vId }));
        });
        const results = await Promise.all(promises);
        results.forEach(tList => allTrips.push(...tList));
    }
    return allTrips;
}

/**
 * Fetch Enlace positions history
 */
async function getEnlacePositionHistory(startIso, endIso) {
    const formattedStart = startIso.split('.')[0] + 'Z';
    const formattedEnd = endIso.split('.')[0] + 'Z';
    const endpoint = `/assets/position-history?startDate=${formattedStart}&endDate=${formattedEnd}`;
    const data = await invokeProxy('enlace-proxy', { endpoint });
    return data?.data || [];
}

/**
 * Haversine formula to calculate distance in km between two coordinates
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // in km
}

/**
 * Calculate total path distance using coordinate history
 */
function calculatePathDistance(points) {
    let totalDist = 0;
    for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        if (p1.latitude && p1.longitude && p2.latitude && p2.longitude) {
            totalDist += haversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
        }
    }
    return parseFloat(totalDist.toFixed(1));
}

/**
 * Speeding Severity Classifier
 */
function classifySpeeding(speed) {
    if (speed <= 105) return 'leve';
    if (speed <= 110) return 'moderado';
    if (speed <= 120) return 'grave';
    return 'muy_grave';
}

/**
 * Main function to fetch telemetry from BOTH systems, process calculations on the fly, and return a clean report
 */
export async function getTelemetryReport(startDate, endDate) {
    const startIso = new Date(startDate).toISOString();
    const endIso = new Date(endDate).toISOString();

    console.log(`📡 [Telemetry Service] Fetching reports from ${startIso} to ${endIso}`);

    // Call APIs in parallel
    const [samsaraEvents, samsaraIntervals, samsaraTrips, enlaceHistory, samsaraVehicles, samsaraDrivers] = await Promise.all([
        getSamsaraSafetyEvents(startIso, endIso).catch(() => []),
        getSamsaraSpeedingIntervals(startIso, endIso).catch(() => []),
        getSamsaraTrips(startIso, endIso).catch(() => []),
        getEnlacePositionHistory(startIso, endIso).catch(() => []),
        getSamsaraVehicles().catch(() => []),
        getSamsaraDrivers().catch(() => [])
    ]);

    const report = {
        summary: {
            samsara: {
                totalSafetyEvents: 0,
                totalSpeedingEvents: 0,
                averageFleetSpeed: 0,
                monitoredVehicles: 0
            },
            enlace: {
                totalSafetyEvents: 0,
                totalSpeedingEvents: 0,
                averageFleetSpeed: 0,
                monitoredVehicles: 0
            }
        },
        samsara: {
            speedingEvents: [], // { vehicle, driver, time, duration, maxSpeed, severity, lat, lng, address }
            safetyEvents: [],    // { time, type, vehicle, driver, lat, lng }
            averageSpeeds: []   // { vehicle, avgSpeed, distanceKm, hours }
        },
        enlace: {
            speedingEvents: [], // { vehicle, driver, time, duration, maxSpeed, severity, lat, lng, address }
            safetyEvents: [],    // { time, type, vehicle, driver, lat, lng }
            averageSpeeds: []   // { vehicle, avgSpeed, distanceKm, hours }
        }
    };

    // Helper maps to resolve Samsara IDs
    const samVehicleMap = {};
    samsaraVehicles.forEach(v => { samVehicleMap[v.id] = v.name; });
    const samDriverMap = {};
    samsaraDrivers.forEach(d => { samDriverMap[d.id] = d.name; });

    const samsaraMonitoredSet = new Set();
    const enlaceMonitoredSet = new Set();

    // -------------------------------------------------------------
    // 1. PROCESS SAMSARA SAFETY EVENTS
    // -------------------------------------------------------------
    samsaraEvents.forEach(e => {
        const labels = e.behaviorLabels || [];
        let eventType = labels.length > 0 ? (labels[0].label || labels[0].name) : (e.eventType || e.type || 'unknown');
        
        const vehicleName = e.vehicle?.name || samVehicleMap[e.vehicle?.id] || 'Samsara Veh';
        const driverName = e.driver?.name || samDriverMap[e.driver?.id] || 'No Identificado';
        samsaraMonitoredSet.add(vehicleName);

        // Standardize speeding type
        if (eventType.toLowerCase().includes('speed')) {
            return; // Ignore speeding from safety events since we pull it accurately via driver_speeding_intervals
        }

        const lat = e.location?.latitude || e.location?.lat || null;
        const lng = e.location?.longitude || e.location?.lon || null;
        const address = e.location?.reverseGeo?.formattedLocation || e.location?.address || 'Ubicación Desconocida';

        report.samsara.safetyEvents.push({
            time: e.time,
            type: eventType,
            vehicle: vehicleName,
            driver: driverName,
            lat,
            lng,
            address
        });
        report.summary.samsara.totalSafetyEvents++;
    });

    // -------------------------------------------------------------
    // 2. PROCESS SAMSARA SPEEDING INTERVALS
    // -------------------------------------------------------------
    samsaraIntervals.forEach(interval => {
        const vehicleName = interval.vehicle?.name || samVehicleMap[interval.vehicle?.id] || `Veh ${interval.vehicle?.id || ''}`;
        const driverName = interval.driver?.name || samDriverMap[interval.driver?.id] || 'No Identificado';
        samsaraMonitoredSet.add(vehicleName);

        const speedKmH = Math.round(interval.averageSpeedMph * 1.60934);
        const durationSec = interval.durationSeconds || 0;

        // Apply filters: >100 km/h and duration > 60 seconds
        if (speedKmH > 100 && durationSec > 60) {
            const lat = interval.startLocation?.latitude || null;
            const lng = interval.startLocation?.longitude || null;
            const address = interval.startLocation?.formattedAddress || 'Ubicación Desconocida';
            
            report.samsara.speedingEvents.push({
                vehicle: vehicleName,
                driver: driverName,
                time: interval.startTime,
                duration: durationSec,
                maxSpeed: speedKmH, // Use speed from the interval
                severity: classifySpeeding(speedKmH),
                lat,
                lng,
                address
            });
            report.summary.samsara.totalSpeedingEvents++;
        }
    });

    // -------------------------------------------------------------
    // 3. PROCESS SAMSARA AVERAGE SPEEDS
    // -------------------------------------------------------------
    const samsaraVehicleStats = {};
    samsaraTrips.forEach(trip => {
        const vId = trip.vehicleId;
        if (!samsaraVehicleStats[vId]) {
            samsaraVehicleStats[vId] = { name: samVehicleMap[vId] || `Veh ${vId}`, distanceMeters: 0, durationMs: 0 };
        }
        
        if (trip.vehicleName) samsaraVehicleStats[vId].name = trip.vehicleName;
        samsaraVehicleStats[vId].distanceMeters += (trip.distanceMeters || 0);
        const dur = (trip.endMs && trip.startMs) ? (trip.endMs - trip.startMs) : 0;
        samsaraVehicleStats[vId].durationMs += dur;
    });

    Object.entries(samsaraVehicleStats).forEach(([vId, stats]) => {
        const distanceKm = parseFloat((stats.distanceMeters / 1000).toFixed(1));
        const hours = parseFloat((stats.durationMs / (1000 * 60 * 60)).toFixed(2));
        const avgSpeed = hours > 0 ? Math.round(distanceKm / hours) : 0;
        
        if (distanceKm > 0) {
            report.samsara.averageSpeeds.push({
                vehicle: stats.name,
                avgSpeed,
                distanceKm,
                hours
            });
        }
    });

    // -------------------------------------------------------------
    // 4. PROCESS ENLACE DATA (SPEEDING, SAFETY & AVG SPEEDS)
    // -------------------------------------------------------------
    enlaceHistory.forEach(v => {
        const vehicleName = v.vehicleNumber || `Enlace ${v.assetId}`;
        const historyPoints = v.history || [];
        if (historyPoints.length === 0) return;
        
        enlaceMonitoredSet.add(vehicleName);

        // Sort points ascending by date
        historyPoints.sort((a, b) => new Date(a.date) - new Date(b.date));

        // 4a. Calculate Speeding Events (>100 km/h for >60s)
        let inSpeeding = false;
        let eventStartPoint = null;
        let maxSpeed = 0;

        for (let i = 0; i < historyPoints.length; i++) {
            const p = historyPoints[i];
            const speed = p.gpsSpeed || 0;
            const pTime = new Date(p.date);

            if (speed > 100) {
                if (!inSpeeding) {
                    inSpeeding = true;
                    eventStartPoint = p;
                    maxSpeed = speed;
                } else {
                    maxSpeed = Math.max(maxSpeed, speed);
                    
                    // Check for large gaps > 5 mins
                    const prevTime = new Date(historyPoints[i-1].date);
                    if (pTime - prevTime > 5 * 60 * 1000) {
                        const durationSec = (prevTime - new Date(eventStartPoint.date)) / 1000;
                        if (durationSec > 60) {
                            report.enlace.speedingEvents.push({
                                vehicle: vehicleName,
                                driver: eventStartPoint.position?.driver?.driverName || eventStartPoint.driver?.driverName || 'No Identificado',
                                time: eventStartPoint.date,
                                duration: durationSec,
                                maxSpeed: Math.round(maxSpeed),
                                severity: classifySpeeding(Math.round(maxSpeed)),
                                lat: eventStartPoint.latitude,
                                lng: eventStartPoint.longitude,
                                address: eventStartPoint.streetReference || eventStartPoint.nearestCityReference || 'Ubicación Desconocida'
                            });
                            report.summary.enlace.totalSpeedingEvents++;
                        }
                        eventStartPoint = p;
                        maxSpeed = speed;
                    }
                }
            } else {
                if (inSpeeding) {
                    const prevPoint = historyPoints[i-1];
                    const durationSec = (new Date(prevPoint.date) - new Date(eventStartPoint.date)) / 1000;
                    if (durationSec > 60) {
                        report.enlace.speedingEvents.push({
                            vehicle: vehicleName,
                            driver: eventStartPoint.position?.driver?.driverName || eventStartPoint.driver?.driverName || 'No Identificado',
                            time: eventStartPoint.date,
                            duration: durationSec,
                            maxSpeed: Math.round(maxSpeed),
                            severity: classifySpeeding(Math.round(maxSpeed)),
                            lat: eventStartPoint.latitude,
                            lng: eventStartPoint.longitude,
                            address: eventStartPoint.streetReference || eventStartPoint.nearestCityReference || 'Ubicación Desconocida'
                        });
                        report.summary.enlace.totalSpeedingEvents++;
                    }
                    inSpeeding = false;
                    eventStartPoint = null;
                    maxSpeed = 0;
                }
            }
        }

        if (inSpeeding && eventStartPoint) {
            const lastPoint = historyPoints[historyPoints.length - 1];
            const durationSec = (new Date(lastPoint.date) - new Date(eventStartPoint.date)) / 1000;
            if (durationSec > 60) {
                report.enlace.speedingEvents.push({
                    vehicle: vehicleName,
                    driver: eventStartPoint.position?.driver?.driverName || eventStartPoint.driver?.driverName || 'No Identificado',
                    time: eventStartPoint.date,
                    duration: durationSec,
                    maxSpeed: Math.round(maxSpeed),
                    severity: classifySpeeding(Math.round(maxSpeed)),
                    lat: eventStartPoint.latitude,
                    lng: eventStartPoint.longitude,
                    address: eventStartPoint.streetReference || eventStartPoint.nearestCityReference || 'Ubicación Desconocida'
                });
                report.summary.enlace.totalSpeedingEvents++;
            }
        }

        // 4b. Extract safety events from the points
        historyPoints.forEach(p => {
            const evList = p.events || [];
            evList.forEach(e => {
                const driverName = p.position?.driver?.driverName || p.driver?.driverName || 'No Identificado';
                const eventTypeName = e.eventTypeName || e.event || 'Alerta Enlace';
                
                if (eventTypeName.toLowerCase().includes('velocidad') || eventTypeName.toLowerCase().includes('speed')) {
                    return; // Avoid duplicating speeding
                }

                report.enlace.safetyEvents.push({
                    time: p.date,
                    type: eventTypeName,
                    vehicle: vehicleName,
                    driver: driverName,
                    lat: p.latitude,
                    lng: p.longitude,
                    address: p.streetReference || p.nearestCityReference || 'Ubicación Desconocida'
                });
                report.summary.enlace.totalSafetyEvents++;
            });
        });

        // 4c. Calculate Enlace average speed using Haversine route calculation
        const distanceKm = calculatePathDistance(historyPoints);
        const firstPoint = historyPoints[0];
        const lastPoint = historyPoints[historyPoints.length - 1];
        
        const durationHours = (new Date(lastPoint.date) - new Date(firstPoint.date)) / (1000 * 60 * 60);
        const hours = parseFloat(Math.max(0, durationHours).toFixed(2));
        const avgSpeed = (hours > 0 && distanceKm > 0) ? Math.round(distanceKm / hours) : 0;

        if (distanceKm > 0.5) { // Only count if moved more than 500 meters
            report.enlace.averageSpeeds.push({
                vehicle: vehicleName,
                avgSpeed,
                distanceKm,
                hours
            });
        }
    });

    // -------------------------------------------------------------
    // 5. CALCULATE OVERALL SUMMARY METRICS
    // -------------------------------------------------------------
    report.summary.samsara.monitoredVehicles = samsaraMonitoredSet.size;
    report.summary.enlace.monitoredVehicles = enlaceMonitoredSet.size;

    // Samsara Average Fleet Speed
    let samSum = 0;
    let samCount = 0;
    report.samsara.averageSpeeds.forEach(v => {
        if (v.avgSpeed > 0) {
            samSum += v.avgSpeed;
            samCount++;
        }
    });
    report.summary.samsara.averageFleetSpeed = samCount > 0 ? Math.round(samSum / samCount) : 0;

    // Enlace Average Fleet Speed
    let enlSum = 0;
    let enlCount = 0;
    report.enlace.averageSpeeds.forEach(v => {
        if (v.avgSpeed > 0) {
            enlSum += v.avgSpeed;
            enlCount++;
        }
    });
    report.summary.enlace.averageFleetSpeed = enlCount > 0 ? Math.round(enlSum / enlCount) : 0;

    return report;
}

/**
 * Supabase DB interactions for saving audits
 */
export async function saveTelemetryAudit(auditData) {
    if (!supabase) return { error: 'Supabase client not initialized' };
    
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const userEmail = currentUser?.email || 'Sistema';

    try {
        const { data, error } = await supabase
            .from('telemetry_audits')
            .insert({
                start_date: auditData.startDate,
                end_date: auditData.endDate,
                summary: auditData.summary,
                speeding_events: auditData.speedingEvents,
                safety_events: auditData.safetyEvents,
                average_speeds: auditData.averageSpeeds,
                notes: auditData.notes,
                created_by: userEmail
            })
            .select();
            
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error saving telemetry audit:', error);
        return { success: false, error };
    }
}

export async function getTelemetryAudits() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('telemetry_audits')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting telemetry audits:', error);
        return [];
    }
}

export async function deleteTelemetryAudit(id) {
    if (!supabase) return false;
    try {
        const { error } = await supabase
            .from('telemetry_audits')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting telemetry audit:', error);
        return false;
    }
}
