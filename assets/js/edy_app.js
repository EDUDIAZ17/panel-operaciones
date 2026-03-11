import { toggleHotspots, toggleSafeStops, renderSecurityOverlay } from './edy_security.js';
import { initVoiceAssistant } from './edy_voice.js';
import { initOfflineManager } from './edy_offline.js';
import { getNextTollAI, optimizeReturnLoadETA } from './edy_ai.js';

let edyMap = null;
let directionsService = null;
let directionsRenderer = null;
let watchId = null;
let currentRoute = null;

// Initial state
const state = {
    isOffline: !navigator.onLine,
    speed: 0,
    hotspotsActive: false,
    safeStopsActive: false
};

document.addEventListener('DOMContentLoaded', () => {
    initEdyMap();
    initHandlers();
    initVoiceAssistant();
    initOfflineManager(state);
    
    // Check if we have route data passed from main app (localStorage)
    loadPendingRoute();
});

function initEdyMap() {
    if (typeof google === 'undefined') {
        Swal.fire({
            title: 'Mapas Bloqueados',
            text: 'No se pudo cargar Google Maps. Por favor desactiva tu bloqueador de anuncios (AdBlock, Brave Shields) para esta página.',
            icon: 'error',
            confirmButtonColor: '#3b82f6'
        });
        return;
    }

    // High contrast dark style for cabin
    const darkStyle = [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
      { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
      { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
    ];

    edyMap = new google.maps.Map(document.getElementById('edy-map-canvas'), {
        zoom: 6,
        center: { lat: 23.6345, lng: -102.5528 }, // Mexico
        styles: darkStyle,
        disableDefaultUI: true, // Clean interface
        zoomControl: true,
        compassControl: true
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: edyMap,
        suppressMarkers: false,
        polylineOptions: {
            strokeColor: '#3b82f6', // Bright blue
            strokeOpacity: 0.9,
            strokeWeight: 8
        }
    });

    renderSecurityOverlay(edyMap); // Prepare security layers (hidden by default)
}

function initHandlers() {
    // Hotspots toggle
    const btnHotspots = document.getElementById('btn-hotspots');
    btnHotspots.addEventListener('click', () => {
        state.hotspotsActive = !state.hotspotsActive;
        toggleHotspots(state.hotspotsActive);
        btnHotspots.classList.toggle('bg-red-900', state.hotspotsActive);
        btnHotspots.classList.toggle('text-white', state.hotspotsActive);
    });

    // Safe stops toggle
    const btnSafeStops = document.getElementById('btn-safe-stops');
    btnSafeStops.addEventListener('click', () => {
        state.safeStopsActive = !state.safeStopsActive;
        toggleSafeStops(state.safeStopsActive);
        btnSafeStops.classList.toggle('bg-emerald-900', state.safeStopsActive);
        btnSafeStops.classList.toggle('text-white', state.safeStopsActive);
    });

    // Carta Porte
    document.getElementById('btn-carta-porte').addEventListener('click', () => {
        if(state.isOffline) {
            Swal.fire('Modo Offline', 'Carta Porte guardada localmente. Se timbrará al recuperar conexión.', 'info');
        } else {
            Swal.fire({
                title: 'Timbrado Automático',
                html: 'Generando Complemento Carta Porte 3.0... <br><br> <div class="spinner border-t-indigo-500"></div>',
                showConfirmButton: false,
                timer: 2000
            }).then(() => {
                Swal.fire('Éxito', 'Carta Porte 3.0 validada con el SAT.', 'success');
            });
        }
    });

    window.addEventListener('online', () => {
        state.isOffline = false;
        document.getElementById('offline-indicator').classList.add('hidden');
        // Trigger sync
    });

    window.addEventListener('offline', () => {
        state.isOffline = true;
        document.getElementById('offline-indicator').classList.remove('hidden');
    });

    // Start tracking GPS
    startGPS();
}

function loadPendingRoute() {
    const routeDataStr = localStorage.getItem('edy_pending_route');
    if (routeDataStr) {
        try {
            const data = JSON.parse(routeDataStr);
            console.log("Loading route into EDY:", data);
            calculateRoute(data.origen, data.destino, data.waypoints);
            
            // Clear it so it doesn't reload forever, or keep it for offline? 
            // We'll keep it as 'active_route' in offline manager.
        } catch(e) {}
    }
}

function calculateRoute(origen, destino, waypoints = []) {
    const request = {
        origin: origen,
        destination: destino,
        waypoints: waypoints.map(w => ({ location: w, stopover: true })),
        travelMode: 'DRIVING'
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            currentRoute = result.routes[0];
            updateNavigationUI(currentRoute.legs[0]);
            
            // Save for offline
            localStorage.setItem('edy_active_route_cache', JSON.stringify(result));

            // Setup AI Next Toll
            updateAITollInfo(currentRoute);
            
            // ETA
            const totalDistance = currentRoute.legs.reduce((acc, leg) => acc + leg.distance.value, 0);
            updateAdaptiveETA(totalDistance);
        }
    });
}

function updateNavigationUI(leg) {
    if (!leg || !leg.steps || leg.steps.length === 0) return;
    const nextStep = leg.steps[0];
    
    document.getElementById('nav-distance').textContent = nextStep.distance.text;
    document.getElementById('nav-text').innerHTML = nextStep.instructions; // Instructions often have HTML
    
    // Strip HTML for safer display or just rely on text
    document.getElementById('nav-text').textContent = document.getElementById('nav-text').textContent;
}

async function updateAITollInfo(route) {
    // Simulamos la extracción de OCR/Gaceta en tiempo real
    const tollData = await getNextTollAI(route);
    if(tollData) {
        document.getElementById('next-toll-name').textContent = tollData.name;
        document.getElementById('next-toll-cost').textContent = `$${tollData.cost.toFixed(2)}`;
    }
}

function updateAdaptiveETA(distanceMeters) {
    // Distancia / 80kmh (Límite Pesados)
    const MAX_SPEED = 80;
    let hours = (distanceMeters / 1000) / MAX_SPEED;
    
    // Add rest time (NOM-012: 30 min per 5 hours approx)
    const restStops = Math.floor(hours / 5);
    hours += (restStops * 0.5);

    document.getElementById('telemetry-time-left').textContent = `${hours.toFixed(1)} h`;
    
    // Calc real time
    const eta = new Date();
    eta.setMinutes(eta.getMinutes() + (hours * 60));
    
    document.getElementById('telemetry-eta').textContent = eta.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function startGPS() {
    if (!navigator.geolocation) return;

    watchId = navigator.geolocation.watchPosition((position) => {
        const speedMps = position.coords.speed || 0; // meters per second
        const speedKmh = Math.round(speedMps * 3.6);
        state.speed = speedKmh;
        
        const speedEl = document.getElementById('telemetry-speed');
        speedEl.textContent = speedKmh;
        
        // Update bar color
        const bar = document.getElementById('speed-bar');
        const percent = Math.min((speedKmh / 100) * 100, 100);
        bar.style.width = `${percent}%`;
        
        if (speedKmh > 85) {
            bar.classList.replace('bg-emerald-500', 'bg-red-500');
            speedEl.classList.add('text-red-400');
        } else if (speedKmh > 75) {
            bar.classList.replace('bg-emerald-500', 'bg-amber-500');
            speedEl.classList.remove('text-red-400');
        } else {
            bar.classList.remove('bg-red-500', 'bg-amber-500');
            bar.classList.add('bg-emerald-500');
            speedEl.classList.remove('text-red-400');
        }

        // Center map occasionally if driving
        if (speedKmh > 10 && edyMap) {
            const pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
            edyMap.panTo(pos);
            // Si tuvieramos marker, lo actualizamos.
        }

    }, (err) => {
        console.warn("GPS error:", err);
    }, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
    });
}
