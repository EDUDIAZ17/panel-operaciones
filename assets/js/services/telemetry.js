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
 * Fetch Samsara vehicles and drivers
 */
export async function getSamsaraVehicles() {
    const data = await invokeProxy('samsara-proxy', { endpoint: '/fleet/vehicles' });
    return data?.data || [];
}

/**
 * Fetch Enlace vehicles and drivers
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
 * Fetch Samsara trips
 */
async function getSamsaraTrips(startIso, endIso, vehicleIds = []) {
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    
    // We need to fetch trips for active vehicles.
    // If no vehicleIds provided, we fetch vehicles first.
    let targetIds = vehicleIds;
    if (!targetIds || targetIds.length === 0) {
        const vehicles = await getSamsaraVehicles();
        targetIds = vehicles.slice(0, 15).map(v => v.id); // Limit to 15 vehicles to prevent rate limits
    }

    const allTrips = [];
    // Fetch trips in parallel batches of 5
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
 * Main function to fetch telemetry from BOTH systems, process calculations on the fly, and return a clean report
 */
export async function getTelemetryReport(startDate, endDate) {
    const startIso = new Date(startDate).toISOString();
    const endIso = new Date(endDate).toISOString();

    console.log(`📡 [Telemetry Service] Fetching reports from ${startIso} to ${endIso}`);

    // Call APIs in parallel
    const [samsaraEvents, samsaraTrips, enlaceHistory] = await Promise.all([
        getSamsaraSafetyEvents(startIso, endIso).catch(() => []),
        getSamsaraTrips(startIso, endIso).catch(() => []),
        getEnlacePositionHistory(startIso, endIso).catch(() => [])
    ]);

    const report = {
        summary: {
            totalSafetyEvents: 0,
            totalSpeedingEvents: 0,
            averageFleetSpeed: 0,
            monitoredVehicles: 0
        },
        speedingEvents: [], // { vehicle, driver, start, end, duration, maxSpeed, lat, lng, address, source }
        safetyEvents: [],    // { time, type, vehicle, driver, lat, lng, source }
        averageSpeeds: []   // { vehicle, avgSpeed, distanceKm, hours, source }
    };

    const monitoredVehicleSet = new Set();

    // -------------------------------------------------------------
    // 1. PROCESS SAMSARA SAFETY & SPEEDING EVENTS
    // -------------------------------------------------------------
    samsaraEvents.forEach(e => {
        const labels = e.behaviorLabels || [];
        let eventType = labels.length > 0 ? (labels[0].label || labels[0].name) : (e.eventType || e.type || 'unknown');
        
        const vehicleName = e.vehicle?.name || 'Samsara Veh';
        const driverName = e.driver?.name || 'No Identificado';
        monitoredVehicleSet.add(vehicleName);

        // Standardize speeding type
        if (eventType.toLowerCase().includes('speed')) {
            eventType = 'speeding';
        }

        // Location
        const lat = e.location?.latitude || e.location?.lat || null;
        const lng = e.location?.longitude || e.location?.lon || null;
        const address = e.location?.reverseGeo?.formattedLocation || e.location?.address || 'Ubicación Desconocida';

        if (eventType === 'speeding') {
            let speedKmH = 0;
            if (e.maxSpeedMetersPerSecond) speedKmH = Math.round(e.maxSpeedMetersPerSecond * 3.6);
            else if (e.speedMilesPerHour) speedKmH = Math.round(e.speedMilesPerHour * 1.60934);
            else if (e.speed) speedKmH = Math.round(e.speed);

            report.speedingEvents.push({
                vehicle: vehicleName,
                driver: driverName,
                time: e.time,
                duration: 60, // Default duration if not provided
                maxSpeed: speedKmH || 100,
                lat,
                lng,
                address,
                source: 'Samsara'
            });
            report.summary.totalSpeedingEvents++;
        } else {
            report.safetyEvents.push({
                time: e.time,
                type: eventType,
                vehicle: vehicleName,
                driver: driverName,
                lat,
                lng,
                source: 'Samsara'
            });
            report.summary.totalSafetyEvents++;
        }
    });

    // -------------------------------------------------------------
    // 2. PROCESS SAMSARA AVERAGE SPEEDS
    // -------------------------------------------------------------
    const samsaraVehicleStats = {};
    samsaraTrips.forEach(trip => {
        const vId = trip.vehicleId;
        if (!samsaraVehicleStats[vId]) {
            samsaraVehicleStats[vId] = { name: `Veh ${vId}`, distanceMeters: 0, durationMs: 0 };
        }
        
        // Find vehicle name if possible from e.vehicle or fetch
        if (trip.vehicleName) samsaraVehicleStats[vId].name = trip.vehicleName;
        
        samsaraVehicleStats[vId].distanceMeters += (trip.distanceMeters || 0);
        const dur = (trip.endMs && trip.startMs) ? (trip.endMs - trip.startMs) : 0;
        samsaraVehicleStats[vId].durationMs += dur;
    });

    Object.entries(samsaraVehicleStats).forEach(([vId, stats]) => {
        const distanceKm = parseFloat((stats.distanceMeters / 1000).toFixed(1));
        const hours = parseFloat((stats.durationMs / (1000 * 60 * 60)).toFixed(2));
        const avgSpeed = hours > 0 ? Math.round(distanceKm / hours) : 0;
        
        report.averageSpeeds.push({
            vehicle: stats.name,
            avgSpeed,
            distanceKm,
            hours,
            source: 'Samsara'
        });
    });

    // -------------------------------------------------------------
    // 3. PROCESS ENLACE DATA (SPEEDING, SAFETY & AVG SPEEDS)
    // -------------------------------------------------------------
    enlaceHistory.forEach(v => {
        const vehicleName = v.vehicleNumber || `Enlace ${v.assetId}`;
        const historyPoints = v.history || [];
        if (historyPoints.length === 0) return;
        
        monitoredVehicleSet.add(vehicleName);

        // Sort points ascending
        historyPoints.sort((a, b) => new Date(a.date) - new Date(b.date));

        // 3a. Calculate Speeding Events (>100 km/h for >60s)
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
                        // Split event
                        const durationSec = (prevTime - new Date(eventStartPoint.date)) / 1000;
                        if (durationSec > 60) {
                            report.speedingEvents.push({
                                vehicle: vehicleName,
                                driver: eventStartPoint.position?.driver?.driverName || eventStartPoint.driver?.driverName || 'No Identificado',
                                time: eventStartPoint.date,
                                duration: durationSec,
                                maxSpeed: Math.round(maxSpeed),
                                lat: eventStartPoint.latitude,
                                lng: eventStartPoint.longitude,
                                address: eventStartPoint.streetReference || eventStartPoint.nearestCityReference || 'Ubicación Desconocida',
                                source: 'Enlace'
                            });
                            report.summary.totalSpeedingEvents++;
                        }
                        // Reset to current point
                        eventStartPoint = p;
                        maxSpeed = speed;
                    }
                }
            } else {
                if (inSpeeding) {
                    const prevPoint = historyPoints[i-1];
                    const durationSec = (new Date(prevPoint.date) - new Date(eventStartPoint.date)) / 1000;
                    if (durationSec > 60) {
                        report.speedingEvents.push({
                            vehicle: vehicleName,
                            driver: eventStartPoint.position?.driver?.driverName || eventStartPoint.driver?.driverName || 'No Identificado',
                            time: eventStartPoint.date,
                            duration: durationSec,
                            maxSpeed: Math.round(maxSpeed),
                            lat: eventStartPoint.latitude,
                            lng: eventStartPoint.longitude,
                            address: eventStartPoint.streetReference || eventStartPoint.nearestCityReference || 'Ubicación Desconocida',
                            source: 'Enlace'
                        });
                        report.summary.totalSpeedingEvents++;
                    }
                    inSpeeding = false;
                    eventStartPoint = null;
                    maxSpeed = 0;
                }
            }
        }

        // Catch active speeding at the end
        if (inSpeeding && eventStartPoint) {
            const lastPoint = historyPoints[historyPoints.length - 1];
            const durationSec = (new Date(lastPoint.date) - new Date(eventStartPoint.date)) / 1000;
            if (durationSec > 60) {
                report.speedingEvents.push({
                    vehicle: vehicleName,
                    driver: eventStartPoint.position?.driver?.driverName || eventStartPoint.driver?.driverName || 'No Identificado',
                    time: eventStartPoint.date,
                    duration: durationSec,
                    maxSpeed: Math.round(maxSpeed),
                    lat: eventStartPoint.latitude,
                    lng: eventStartPoint.longitude,
                    address: eventStartPoint.streetReference || eventStartPoint.nearestCityReference || 'Ubicación Desconocida',
                    source: 'Enlace'
                });
                report.summary.totalSpeedingEvents++;
            }
        }

        // 3b. Extract safety events from the points
        historyPoints.forEach(p => {
            const evList = p.events || [];
            evList.forEach(e => {
                const driverName = p.position?.driver?.driverName || p.driver?.driverName || 'No Identificado';
                const eventTypeName = e.eventTypeName || e.event || 'Alerta Enlace';
                
                // Avoid duplicating speeding events since we calculate them precisely
                if (eventTypeName.toLowerCase().includes('velocidad') || eventTypeName.toLowerCase().includes('speed')) {
                    return;
                }

                report.safetyEvents.push({
                    time: p.date,
                    type: eventTypeName,
                    vehicle: vehicleName,
                    driver: driverName,
                    lat: p.latitude,
                    lng: p.longitude,
                    source: 'Enlace'
                });
                report.summary.totalSafetyEvents++;
            });
        });

        // 3c. Calculate Enlace average speed
        const firstPoint = historyPoints[0];
        const lastPoint = historyPoints[historyPoints.length - 1];
        
        const fDistance = firstPoint.gpsDistance || 0;
        const lDistance = lastPoint.gpsDistance || 0;
        const distanceKm = parseFloat(Math.max(0, lDistance - fDistance).toFixed(1));
        
        const durationHours = (new Date(lastPoint.date) - new Date(firstPoint.date)) / (1000 * 60 * 60);
        const hours = parseFloat(Math.max(0, durationHours).toFixed(2));
        
        const avgSpeed = (hours > 0 && distanceKm > 0) ? Math.round(distanceKm / hours) : 0;

        if (distanceKm > 0) {
            report.averageSpeeds.push({
                vehicle: vehicleName,
                avgSpeed,
                distanceKm,
                hours,
                source: 'Enlace'
            });
        }
    });

    // -------------------------------------------------------------
    // 4. CALCULATE OVERALL SUMMARY METRICS
    // -------------------------------------------------------------
    report.summary.monitoredVehicles = monitoredVehicleSet.size;

    let sumSpeed = 0;
    let countSpeed = 0;
    report.averageSpeeds.forEach(v => {
        if (v.avgSpeed > 0) {
            sumSpeed += v.avgSpeed;
            countSpeed++;
        }
    });
    report.summary.averageFleetSpeed = countSpeed > 0 ? Math.round(sumSpeed / countSpeed) : 0;

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
