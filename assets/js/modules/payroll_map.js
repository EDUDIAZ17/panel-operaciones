import { supabase } from '../services/supabaseClient.js';
import { GOOGLE_MAPS_API_KEY } from '../config/config.js';
import { getHeavyVehicleRouteWithAI, estimateTollsWithAI } from '../services/gemini.js';

let map = null;
let directionsService = null;
let directionsRenderer = null;
let geocoder = null;
let infoWindow = null;
let waypointCount = 0;

export function renderPayrollMap(container) {
    container.innerHTML = `
        <div class="h-full flex flex-col md:flex-row bg-gray-50 p-4 gap-4 fade-in">
            <!-- Menú Izquierdo: Formularios y Controles -->
            <div class="w-full md:w-1/3 bg-white rounded-xl shadow-lg border border-indigo-100 flex flex-col overflow-hidden">
                <div class="p-4 bg-gradient-to-r from-indigo-700 to-indigo-900 border-b relative">
                    <h2 class="text-xl font-bold text-white flex items-center gap-2">
                        <i class="fas fa-map-marked-alt text-indigo-300"></i> Mapa EDY
                    </h2>
                    <p class="text-indigo-200 text-xs mt-1">Herramienta de Ruteo, Tráfico y Liquidaciones</p>
                </div>
                
                <div class="p-4 flex-1 overflow-y-auto custom-scrollbar">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Origen (Ciudad/Estado)</label>
                            <input type="text" id="map-origen" class="w-full border border-gray-300 rounded-lg p-2.5 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" placeholder="Ej: Celaya, GTO">
                        </div>
                        
                        <div id="waypoints-container" class="space-y-2">
                            <!-- Paradas dinámicas aquí -->
                        </div>
                        <button id="btn-add-waypoint" class="text-indigo-600 text-xs font-bold hover:text-indigo-800 flex items-center gap-1 transition-colors w-max"><i class="fas fa-plus-circle"></i> Agregar Parada Segura</button>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Destino (Ciudad/Estado)</label>
                            <input type="text" id="map-destino" class="w-full border border-gray-300 rounded-lg p-2.5 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" placeholder="Ej: Nuevo Laredo, TAMPS">
                        </div>
                        
                        <div class="grid grid-cols-2 gap-3 pt-2">
                             <div>
                                 <label class="block text-xs font-semibold text-gray-700 mb-1" title="Velocidad Promedio">Velocidad (km/h)</label>
                                 <input type="number" id="map-speed" value="70" class="w-full border border-gray-300 rounded-lg p-2 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                             </div>
                             <div>
                                 <label class="block text-xs font-semibold text-gray-700 mb-1" title="Tiempo total en Paradas">Tiempo Paradas (h)</label>
                                 <input type="number" id="map-stop-time" value="0.0" step="0.5" class="w-full border border-gray-300 rounded-lg p-2 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                             </div>
                        </div>

                        <div class="pt-2">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Perfil Operativo (NOM-012)</label>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <select id="map-unit-type" class="w-full border border-gray-300 rounded-lg p-2.5 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-xs" title="Tipo de Unidad">
                                    <option value="full">Tractocamión (Full)</option>
                                    <option value="sencillo">Tractocamión (Sencillo)</option>
                                    <option value="torton">Torton/Rabón</option>
                                </select>
                                <input type="number" id="map-axles" value="9" min="2" max="14" class="w-full border border-gray-300 rounded-lg p-2.5 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none text-xs" title="Número de Ejes (ej. 9 para Full)" placeholder="Ejes">
                                <input type="number" id="map-weight" value="75.5" step="0.5" class="w-full border border-gray-300 rounded-lg p-2.5 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none text-xs" title="Peso Bruto/Carga (Toneladas)" placeholder="Ton.">
                            </div>
                        </div>

                        <div class="pt-2 border-t mt-3 border-gray-100">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Liquidación del Operador</label>
                            
                            <select id="map-trip-condition" class="w-full border border-gray-300 rounded-lg p-2 text-xs shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white mb-2 text-gray-600">
                                <option value="5.00">Estándar: Unidad Cargada ($5.00/km)</option>
                                <option value="3.00">Estándar: Unidad Vacía ($3.00/km)</option>
                            </select>

                            <div class="grid grid-cols-2 gap-3 mb-2">
                                <div>
                                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nómina ($ / KM)</label>
                                    <input type="number" id="map-rate-nomina" value="5.00" step="0.01" class="w-full border border-gray-300 rounded-lg p-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold text-indigo-700">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Alimentos ($ / KM)</label>
                                    <input type="number" id="map-rate-alimentos" value="0.45" step="0.01" class="w-full border border-gray-300 rounded-lg p-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold text-amber-600">
                                </div>
                            </div>
                        </div>

                        <div class="pt-2 border-t mt-2 border-gray-100 mb-4">
                            <label class="block text-xs font-bold text-gray-700 mb-1">Cálculo de Casetas</label>
                            <select id="map-toll-method" class="w-full border border-gray-300 rounded-lg p-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                <option value="ai">Inteligencia Artificial (Recomendado)</option>
                                <option value="native">Oficial SCT / Google Maps (Preciso)</option>
                            </select>
                        </div>

                        <button id="btn-calc-route" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition transform hover:-translate-y-0.5 flex justify-center items-center gap-2">
                            <i class="fas fa-route"></i> CALCULAR RUTA EDY
                        </button>
                    </div>

                    <div id="route-results" class="mt-6 hidden">
                        <h3 class="text-lg font-bold text-gray-800 border-b pb-2 mb-3">Resultados del Viaje</h3>
                        
                        <div class="grid grid-cols-2 gap-3 mb-4">
                            <div class="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <p class="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Distancia</p>
                                <p id="res-distance" class="text-xl font-black text-blue-800">-- km</p>
                            </div>
                            <div class="bg-emerald-50 p-3 rounded-lg border border-emerald-100 relative group cursor-help">
                                <p class="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Tiempo Estimado</p>
                                <p id="res-time" class="text-xl font-black text-emerald-800">-- h</p>
                                <!-- Tooltip con el desglose del tiempo -->
                                <div id="res-time-breakdown" class="hidden group-hover:block absolute z-50 bg-gray-900 text-white text-[10px] p-2 rounded -top-16 left-0 w-max shadow-lg leading-relaxed"></div>
                            </div>
                        </div>

                        <div class="bg-orange-50 p-3 rounded-lg border border-orange-100 mb-4 flex items-center justify-between">
                             <div class="flex-1">
                                 <p class="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-1">Costo Casetas (Oficial SCT/Google)</p>
                                 <p id="res-tolls" class="text-xl font-black text-orange-800">--</p>
                             </div>
                             <i class="fas fa-ticket-alt text-orange-300 text-3xl ml-2"></i>
                        </div>

                        <div class="bg-gray-50 border p-4 rounded-lg mb-4 space-y-3">
                            <h4 class="text-sm font-bold text-gray-700 uppercase"><i class="fas fa-calculator text-gray-400"></i> Proyección de Liquidación</h4>
                            
                            <div class="flex justify-between items-center bg-white p-2 border rounded-md">
                                <span class="text-xs text-gray-600 font-bold"><i class="fas fa-hamburger text-amber-500 w-4"></i> Alimentos Base:</span>
                                <span id="res-alimentos" class="text-sm font-bold text-gray-800">$0.00</span>
                            </div>
                            
                            <div class="flex justify-between items-center bg-white p-2 border rounded-md">
                                <span class="text-xs text-gray-600 font-bold"><i class="fas fa-coins text-yellow-500 w-4"></i> Nómina Operador:</span>
                                <span id="res-nomina" class="text-sm font-bold text-gray-800">$0.00</span>
                            </div>

                            <div class="pt-3 border-t-2 border-gray-200 mt-2">
                                <p class="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Gran Total Estimado (Viáticos + Liquidación)</p>
                                <p id="res-payroll" class="text-3xl font-black text-indigo-800">$0.00</p>
                            </div>
                        </div>

                        <button id="btn-start-nav" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-md transition transform hover:-translate-y-0.5 mt-2 flex justify-center items-center gap-2">
                            <i class="fas fa-location-arrow"></i> INICIAR NAVEGACIÓN (MÓVIL)
                        </button>

                        <button id="btn-ai-restrictions" class="w-full border border-purple-500 text-purple-700 bg-purple-50 hover:bg-purple-100 font-bold py-2 rounded-lg transition flex justify-center items-center gap-2 text-xs mt-3">
                            <i class="fas fa-robot"></i> Inteligencia Artificial: Riesgos Carretera
                        </button>
                        
                        <button id="btn-ai-nom012" class="w-full border-2 border-slate-800 text-slate-800 bg-slate-50 hover:bg-slate-800 hover:text-white font-bold py-2.5 rounded-lg transition flex justify-center items-center gap-2 text-sm mt-3 shadow-sm">
                            <i class="fas fa-balance-scale"></i> Análisis Logístico Integral (NOM-012)
                        </button>
                    </div>
                </div>
            </div>

            <!-- Mapa Principal -->
            <div class="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden relative min-h-[400px]">
                <div id="map-canvas" class="w-full h-full"></div>
                <div id="map-loading" class="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10 hidden">
                    <div class="spinner w-12 h-12 border-4 border-indigo-500 border-t-transparent mb-3"></div>
                    <p class="text-indigo-800 font-medium">Renderizando rutas...</p>
                </div>
            </div>
        </div>
    `;

    initMap();
    bindWaypointLogic();
    
    document.getElementById('btn-calc-route').addEventListener('click', calculateMapRoute);
    document.getElementById('map-rate-nomina').addEventListener('input', updatePayroll);
    document.getElementById('map-rate-alimentos').addEventListener('input', updatePayroll);
    document.getElementById('btn-start-nav').addEventListener('click', startMobileNavigation);
    document.getElementById('btn-ai-restrictions').addEventListener('click', checkAIRestrictions);
    document.getElementById('btn-ai-nom012').addEventListener('click', runNOM012Analysis);
    
    document.getElementById('map-trip-condition').addEventListener('change', (e) => {
        document.getElementById('map-rate-nomina').value = e.target.value;
        updatePayroll();
    });
}

window.removeWaypoint = (btn) => {
    btn.parentElement.remove();
};

function bindWaypointLogic() {
    const btnAdd = document.getElementById('btn-add-waypoint');
    const container = document.getElementById('waypoints-container');
    
    btnAdd.addEventListener('click', () => {
        waypointCount++;
        const id = `waypoint-${waypointCount}`;
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 mt-2 fade-in';
        div.innerHTML = `
            <div class="flex-1 relative">
                <input type="text" id="${id}" class="waypoint-input w-full border border-indigo-200 rounded-lg p-2 pl-8 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-indigo-50/30" placeholder="Ej: San Luis Potosí, SLP">
                <i class="fas fa-map-pin absolute left-3 top-2.5 text-indigo-400"></i>
            </div>
            <button class="text-red-400 hover:text-red-600 transition" onclick="window.removeWaypoint(this)" title="Eliminar Parada"><i class="fas fa-times-circle text-lg mt-1"></i></button>
        `;
        container.appendChild(div);
        
        if (window.google && window.google.maps && window.google.maps.places) {
            new google.maps.places.Autocomplete(document.getElementById(id), { componentRestrictions: { country: 'mx' }});
        }
    });
}

function initMap() {
    if (typeof google === 'undefined') {
        Swal.fire('Error', 'Google Maps API no pudo cargar. Verifique su conexión y API Key.', 'error');
        return;
    }

    const mexicoCenter = { lat: 23.6345, lng: -102.5528 };
    map = new google.maps.Map(document.getElementById('map-canvas'), {
        zoom: 5,
        center: mexicoCenter,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
            {"featureType":"administrative.country","elementType":"geometry.stroke","stylers":[{"color":"#4b6878"}]},
            {"featureType":"landscape.natural","elementType":"geometry","stylers":[{"color":"#f5f5f2"}]},
            {"featureType":"water","elementType":"geometry","stylers":[{"color":"#e9e9e9"}]}
        ]
    });

    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        draggable: true, // Habilitar arrastre de ruta
        polylineOptions: {
            strokeColor: '#4f46e5',
            strokeOpacity: 0.8,
            strokeWeight: 6
        }
    });

    geocoder = new google.maps.Geocoder();
    infoWindow = new google.maps.InfoWindow();

    // Map click event to see what's there
    map.addListener('click', (e) => {
        geocodeLatLng(e.latLng);
    });

    // Escuchar cuando el usuario arrastre y modifique la ruta
    directionsRenderer.addListener('directions_changed', () => {
        const result = directionsRenderer.getDirections();
        if (result) {
            recalculateTotalsFromDraggedRoute(result);
        }
    });

    // Setup autocomplete
    const inputOrigen = document.getElementById('map-origen');
    const inputDestino = document.getElementById('map-destino');
    new google.maps.places.Autocomplete(inputOrigen, { componentRestrictions: { country: 'mx' }});
    new google.maps.places.Autocomplete(inputDestino, { componentRestrictions: { country: 'mx' }});
}

function calculateMapRoute() {
    const origen = document.getElementById('map-origen').value;
    const destino = document.getElementById('map-destino').value;

    if (!origen || !destino) {
        Swal.fire('Atención', 'Por favor, ingrese un origen y un destino.', 'warning');
        return;
    }

    const speedKmH = parseFloat(document.getElementById('map-speed').value) || 70;
    const stopTimeH = parseFloat(document.getElementById('map-stop-time').value) || 0;

    const waypointInputs = document.querySelectorAll('.waypoint-input');
    const waypoints = [];
    const waypointNames = [];
    waypointInputs.forEach(input => {
        if (input.value.trim()) {
            waypoints.push({
                location: input.value.trim(),
                stopover: true
            });
            waypointNames.push(input.value.trim());
        }
    });

    const loading = document.getElementById('map-loading');
    loading.classList.remove('hidden');

    const request = {
        origin: origen,
        destination: destino,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
        avoidTolls: false // Heavy transport usually uses tolls in MX
    };

    directionsService.route(request, async (result, status) => {
        loading.classList.add('hidden');
        if (status == 'OK') {
            directionsRenderer.setDirections(result);
            
            // Remove previous toll markers
            if (window.tollMarkers) {
                window.tollMarkers.forEach(m => m.setMap(null));
            }
            window.tollMarkers = [];
            
            let totalDistanceMeters = 0;
            result.routes[0].legs.forEach(leg => {
                totalDistanceMeters += leg.distance.value;
                
                // Add markers for tolls
                leg.steps.forEach(step => {
                    const instructions = step.instructions.toLowerCase();
                    if (instructions.includes('cuota') || instructions.includes('peaje') || instructions.includes('toll')) {
                        const marker = new google.maps.Marker({
                            position: step.start_location,
                            map: map,
                            icon: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
                            title: 'Caseta de Cobro'
                        });
                        
                        // Agregar interactividad a la caseta
                        marker.addListener('mouseover', () => {
                            infoWindow.setContent(`<div class="p-1"><p class="font-bold text-orange-600 text-xs"><i class="fas fa-ticket-alt"></i> Caseta de Peaje Oficial</p><p class="text-[10px] text-gray-500">Punto de cobro verificado en ruta SCT.</p></div>`);
                            infoWindow.open(map, marker);
                        });
                        marker.addListener('mouseout', () => {
                            infoWindow.close();
                        });

                        window.tollMarkers.push(marker);
                    }
                });
            });
            
            const distanceValueKm = totalDistanceMeters / 1000;
            
            // Re-calculate Time based on inputs
            const drivingTimeH = distanceValueKm / speedKmH;
            const totalTimeH = drivingTimeH + stopTimeH;
            
            const hours = Math.floor(totalTimeH);
            const minutes = Math.round((totalTimeH - hours) * 60);
            
            const drivingHours = Math.floor(drivingTimeH);
            const drivingMinutes = Math.round((drivingTimeH - drivingHours) * 60);
            
            document.getElementById('res-distance').textContent = distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 1}) + ' km';
            document.getElementById('res-distance').dataset.km = distanceValueKm;
            
            document.getElementById('res-time').textContent = `${hours}h ${minutes}m`;
            
            const breakdown = document.getElementById('res-time-breakdown');
            if (breakdown) {
                 breakdown.innerHTML = `
                     <span class="text-indigo-300 font-bold block mb-1">Desglose de Tiempo:</span>
                     • <b>En Movimiento (${speedKmH}km/h):</b> ${drivingHours}h ${drivingMinutes}m <br>
                     • <b>Paradas Seguras:</b> ${stopTimeH}h
                 `;
            }

            document.getElementById('route-results').classList.remove('hidden');
            
            triggerTollCalculation(origen, destino, waypointNames);

        } else {
            console.error("Directions requests failed: ", status);
            Swal.fire('Ruta no encontrada', 'No se pudo trazar la ruta entre estos puntos. Verifica que estén escritos correctamente.', 'error');
        }
    });
}

// Nueva función extraída para calcular casetas y no repetir código al arrastrar
function triggerTollCalculation(origen, destino, waypointNames) {
    const tollMethod = document.getElementById('map-toll-method').value;
    const unitType = document.getElementById('map-unit-type').value;

    if (tollMethod === 'native') {
        document.getElementById('res-tolls').innerHTML = '<i class="fas fa-sync fa-spin"></i> Consultando SCT (Google Routes)...';
        fetchTollsViaRoutesAPI(origen, destino, waypointNames).then(tollData => {
             document.getElementById('res-tolls').textContent = tollData.costoTotalFormatted;
             document.getElementById('res-tolls').dataset.tollsAmount = tollData.costoTotalNumerical;
             updatePayroll();
        }).catch(e => {
             console.error("Native toll error:", e);
             document.getElementById('res-tolls').innerHTML = '<span class="text-red-500 text-[10px]">Error SCT. Intente con IA.</span>';
             document.getElementById('res-tolls').dataset.tollsAmount = 0;
             updatePayroll();
        });
    } else {
        document.getElementById('res-tolls').innerHTML = '<i class="fas fa-sync fa-spin"></i> Estimando con IA...';
        updatePayroll(); // Update with 0 for now
        
        estimateTollsWithAI(origen, destino, waypointNames, unitType).then(tollText => {
            document.getElementById('res-tolls').innerHTML = tollText;
            const match = tollText.match(/\$?(\d+,?\d*\.?\d*)/);
            if (match) {
                const numStr = match[1].replace(/,/g, '');
                const num = parseFloat(numStr);
                if (!isNaN(num)) {
                     document.getElementById('res-tolls').dataset.tollsAmount = num;
                     updatePayroll();
                }
            }
        }).catch(e => {
            document.getElementById('res-tolls').innerHTML = '<span class="text-red-500 font-normal">Error al estimar peajes IA.</span>';
            document.getElementById('res-tolls').dataset.tollsAmount = 0;
            updatePayroll();
        });
    }
}

function recalculateTotalsFromDraggedRoute(result) {
    if (window.tollMarkers) {
        window.tollMarkers.forEach(m => m.setMap(null));
    }
    window.tollMarkers = [];
    
    let totalDistanceMeters = 0;
    const legWaypoints = [];
    const origen = result.request.origin.query || result.request.origin.location.toString();
    const destino = result.request.destination.query || result.request.destination.location.toString();

    result.routes[0].legs.forEach(leg => {
        totalDistanceMeters += leg.distance.value;
        
        // El usuario al arrastrar crea "vía endpoints" o waypoints implícitos
        // Estos no tienen query de texto directo a veces, usamos location
        if(leg.start_address) legWaypoints.push(leg.start_address);

        leg.steps.forEach(step => {
            const instructions = step.instructions.toLowerCase();
            if (instructions.includes('cuota') || instructions.includes('peaje') || instructions.includes('toll')) {
                const marker = new google.maps.Marker({
                    position: step.start_location,
                    map: map,
                    icon: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
                    title: 'Caseta de Cobro'
                });

                // Agregar interactividad a la caseta al arrastrar
                marker.addListener('mouseover', () => {
                    infoWindow.setContent(`<div class="p-1"><p class="font-bold text-orange-600 text-xs"><i class="fas fa-ticket-alt"></i> Caseta de Peaje (Modificada)</p><p class="text-[10px] text-gray-500">Punto de cobro detectado en la nueva ruta.</p></div>`);
                    infoWindow.open(map, marker);
                });
                marker.addListener('mouseout', () => {
                    infoWindow.close();
                });

                window.tollMarkers.push(marker);
            }
        });
    });

    const distanceValueKm = totalDistanceMeters / 1000;
    const speedKmH = parseFloat(document.getElementById('map-speed').value) || 70;
    const stopTimeH = parseFloat(document.getElementById('map-stop-time').value) || 0;
    
    const drivingTimeH = distanceValueKm / speedKmH;
    const totalTimeH = drivingTimeH + stopTimeH;
    
    const hours = Math.floor(totalTimeH);
    const minutes = Math.round((totalTimeH - hours) * 60);
    const drivingHours = Math.floor(drivingTimeH);
    const drivingMinutes = Math.round((drivingTimeH - drivingHours) * 60);
    
    document.getElementById('res-distance').textContent = distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 1}) + ' km (Modificada)';
    document.getElementById('res-distance').dataset.km = distanceValueKm;
    document.getElementById('res-time').textContent = `${hours}h ${minutes}m`;
    
    const breakdown = document.getElementById('res-time-breakdown');
    if (breakdown) {
         breakdown.innerHTML = `
             <span class="text-indigo-300 font-bold block mb-1">Desglose de Tiempo (Modificado):</span>
             • <b>En Movimiento (${speedKmH}km/h):</b> ${drivingHours}h ${drivingMinutes}m <br>
             • <b>Paradas Seguras:</b> ${stopTimeH}h
         `;
    }

    // Volver a calcular casetas con los nuevos puntos arrastrados
    // Excluir el primer address porque es el origen
    const arrastrados = legWaypoints.slice(1); 
    triggerTollCalculation(origen, destino, arrastrados);
}

async function fetchTollsViaRoutesAPI(originStr, destinationStr, waypointsArray) {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    
    const requestBody = {
        origin: { address: originStr },
        destination: { address: destinationStr },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        extraComputations: ["TOLLS"]
    };

    if (waypointsArray && waypointsArray.length > 0) {
        requestBody.intermediates = waypointsArray.map(w => ({
            address: w
        }));
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.travelAdvisory.tollInfo'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errDetails = await response.text();
        console.error("Detalle de Error de Google Routes API V2:", errDetails);
        throw new Error(`Google Routes API V2 Error: ${response.status}`);
    }

    const data = JSON.parse(await response.text());
    
    // Calcula el costo total basado en la moneda local
    let costoTotal = 0;
    let currencyCode = "MXN";

    if (data.routes && data.routes[0] && data.routes[0].travelAdvisory && data.routes[0].travelAdvisory.tollInfo) {
        const tollInfo = data.routes[0].travelAdvisory.tollInfo;
        if (tollInfo.estimatedPrice && tollInfo.estimatedPrice.length > 0) {
            costoTotal = parseFloat(tollInfo.estimatedPrice[0].units) || 0;
            const nanos = tollInfo.estimatedPrice[0].nanos || 0;
            costoTotal += (nanos / 1000000000); // 1 nano = 10^-9
            currencyCode = tollInfo.estimatedPrice[0].currencyCode;
        }
    }

    if(costoTotal === 0) {
        return {
            costoTotalFormatted: "Sin Costo de Casetas Libre de Peaje",
            costoTotalNumerical: 0
        };
    }

    return {
         costoTotalFormatted: new Intl.NumberFormat('es-MX', { style: 'currency', currency: currencyCode }).format(costoTotal) + " " + currencyCode,
         costoTotalNumerical: costoTotal
    };
}

function updatePayroll() {
    const kmSpan = document.getElementById('res-distance');
    if (!kmSpan.dataset.km) return;
    
    const km = parseFloat(kmSpan.dataset.km);
    const nominaRate = parseFloat(document.getElementById('map-rate-nomina').value) || 0;
    const alimentosRate = parseFloat(document.getElementById('map-rate-alimentos').value) || 0;
    
    const nominaTotal = km * nominaRate;
    const alimentosTotal = km * alimentosRate;
    
    const casetasElement = document.getElementById('res-tolls');
    const casetasTotal = parseFloat(casetasElement?.dataset?.tollsAmount) || 0;

    const granTotal = nominaTotal + alimentosTotal + casetasTotal;
    
    document.getElementById('res-alimentos').textContent = '$' + alimentosTotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('res-nomina').textContent = '$' + nominaTotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    document.getElementById('res-payroll').textContent = '$' + granTotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

async function checkAIRestrictions() {
    const origen = document.getElementById('map-origen').value;
    const destino = document.getElementById('map-destino').value;
    const unitType = document.getElementById('map-unit-type').value;

    if (!origen || !destino) return;

    Swal.fire({
        title: 'Consultando Restricciones SCT...',
        html: '<div class="spinner my-4"></div><p class="text-sm">Analizando trazado de autopistas federales de cuota y compatibilidad de unidad...</p>',
        allowOutsideClick: false,
        showConfirmButton: false
    });

    const routeAI = await getHeavyVehicleRouteWithAI(origen, destino, unitType);

    Swal.fire({
        icon: 'info',
        title: 'Análisis IA (Restricciones SCT)',
        html: `<div class="text-left text-sm bg-purple-50 p-4 border border-purple-100 rounded-xl shadow-inner mt-4 text-purple-900">${routeAI}</div>`,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#8b5cf6',
        width: 600
    });
}

async function runNOM012Analysis() {
    const origen = document.getElementById('map-origen').value;
    const destino = document.getElementById('map-destino').value;
    const unitType = document.getElementById('map-unit-type').value;
    const axles = document.getElementById('map-axles').value;
    const weight = document.getElementById('map-weight').value;

    if (!origen || !destino) {
        Swal.fire('Atención', 'Ingrese Origen y Destino para el análisis NOM-012.', 'warning');
        return;
    }

    // Get waypoints
    const waypointInputs = document.querySelectorAll('.waypoint-input');
    const waypoints = [];
    waypointInputs.forEach(input => {
        if (input.value.trim()) waypoints.push(input.value.trim());
    });

    Swal.fire({
        title: 'Auditoría Logística (NOM-012)...',
        html: '<div class="spinner my-4"></div><p class="text-sm font-mono text-gray-600">Calculando categorización de vía, Fórmula Puente y extracción Inteligente de Tarifas...</p>',
        allowOutsideClick: false,
        showConfirmButton: false
    });

    try {
        const reportHTML = await window.generateLogisticsReportAI(origen, destino, waypoints, unitType, axles, weight);
        
        Swal.fire({
            title: '<i class="fas fa-shield-alt text-slate-800"></i> Reporte Integral de Operación (NOM-012)',
            html: `<div class="text-left text-sm mt-4 custom-scrollbar overflow-y-auto max-h-[70vh] w-full">${reportHTML}</div>`,
            confirmButtonText: 'Cerrar Reporte',
            confirmButtonColor: '#1e293b',
            width: '800px',
            customClass: {
                popup: 'rounded-xl shadow-2xl',
                htmlContainer: 'p-0 m-0'
            }
        });
    } catch (e) {
        // Error already handled in gemini layer, but dismiss spinner if needed
    }
}

// ---- INTERACTION & UTILITIES ---- //
function geocodeLatLng(latLng) {
    if (!geocoder) return;
    geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === "OK") {
            if (results[0]) {
                infoWindow.setContent(`
                    <div class="p-2 max-w-xs">
                        <p class="font-bold text-gray-800 text-sm mb-1"><i class="fas fa-map-marker-alt text-indigo-500"></i> Ubicación Seleccionada</p>
                        <p class="text-xs text-gray-600 leading-relaxed">${results[0].formatted_address}</p>
                    </div>
                `);
                infoWindow.setPosition(latLng);
                infoWindow.open(map);
            } else {
                infoWindow.setContent('<div class="p-1 text-xs">No se encontraron resultados para esta ubicación.</div>');
                infoWindow.setPosition(latLng);
                infoWindow.open(map);
            }
        }
    });
}

function startMobileNavigation() {
    const origen = document.getElementById('map-origen').value;
    const destino = document.getElementById('map-destino').value;

    if (!origen || !destino) {
        Swal.fire('Atención', 'Calcule la ruta primero antes de iniciar la navegación.', 'warning');
        return;
    }

    const waypointInputs = document.querySelectorAll('.waypoint-input');
    const waypoints = [];
    waypointInputs.forEach(input => {
        if (input.value.trim()) {
            waypoints.push(encodeURIComponent(input.value.trim()));
        }
    });

    let navUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origen)}&destination=${encodeURIComponent(destino)}&travelmode=driving`;
    if (waypoints.length > 0) {
        navUrl += `&waypoints=${waypoints.join('|')}`;
    }

    // Open link in a new tab, forcing Google Maps app to trigger on mobile devices
    window.open(navUrl, '_blank');
}
