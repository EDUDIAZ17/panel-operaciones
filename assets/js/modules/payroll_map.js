import { supabase } from '../services/supabaseClient.js';
import { GOOGLE_MAPS_API_KEY } from '../config/config.js';
import { getHeavyVehicleRouteWithAI } from '../services/gemini.js';

let map = null;
let directionsService = null;
let directionsRenderer = null;

export function renderPayrollMap(container) {
    container.innerHTML = `
        <div class="h-full flex flex-col md:flex-row bg-gray-50 p-4 gap-4 fade-in">
            <!-- Menú Izquierdo: Formularios y Controles -->
            <div class="w-full md:w-1/3 bg-white rounded-xl shadow-lg border border-indigo-100 flex flex-col overflow-hidden">
                <div class="p-4 bg-gradient-to-r from-indigo-700 to-indigo-900 border-b relative">
                    <h2 class="text-xl font-bold text-white flex items-center gap-2">
                        <i class="fas fa-map-marked-alt text-indigo-300"></i> Calculadora Nómima y Rutas
                    </h2>
                    <p class="text-indigo-200 text-xs mt-1">Herramienta exclusiva para Recursos Humanos</p>
                </div>
                
                <div class="p-4 flex-1 overflow-y-auto custom-scrollbar">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Origen (Ciudad/Estado)</label>
                            <input type="text" id="map-origen" class="w-full border border-gray-300 rounded-lg p-2.5 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" placeholder="Ej: Celaya, GTO">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Destino (Ciudad/Estado)</label>
                            <input type="text" id="map-destino" class="w-full border border-gray-300 rounded-lg p-2.5 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" placeholder="Ej: Nuevo Laredo, TAMPS">
                        </div>
                        
                        <div class="pt-2">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Tipo de Unidad</label>
                            <select id="map-unit-type" class="w-full border border-gray-300 rounded-lg p-2.5 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                <option value="full">Tractocamión T3-S2-R4 (Full)</option>
                                <option value="sencillo">Tractocamión T3-S2 (Sencillo)</option>
                                <option value="torton">Torton / Rabón</option>
                            </select>
                        </div>
                        
                        <button id="btn-calc-route" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition transform hover:-translate-y-0.5 mt-4 flex justify-center items-center gap-2">
                            <i class="fas fa-route"></i> CALCULAR RUTA Y DISTANCIA
                        </button>
                    </div>

                    <div id="route-results" class="mt-6 hidden">
                        <h3 class="text-lg font-bold text-gray-800 border-b pb-2 mb-3">Resultados del Viaje</h3>
                        
                        <div class="grid grid-cols-2 gap-3 mb-4">
                            <div class="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <p class="text-xs text-blue-600 font-bold uppercase">Distancia</p>
                                <p id="res-distance" class="text-xl font-black text-blue-800">-- km</p>
                            </div>
                            <div class="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                <p class="text-xs text-emerald-600 font-bold uppercase">Tiempo Est.</p>
                                <p id="res-time" class="text-xl font-black text-emerald-800">-- h</p>
                            </div>
                        </div>

                        <div class="bg-gray-50 border p-4 rounded-lg mb-4 space-y-3">
                            <h4 class="text-sm font-bold text-gray-700 uppercase"><i class="fas fa-calculator text-gray-400"></i> Proyección de Nómina</h4>
                            <div>
                                <p class="text-xs text-gray-500">Tarifa por KM Sugerida</p>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="text-gray-500">$</span>
                                    <input type="number" id="rate-per-km" class="w-20 border rounded p-1 text-sm font-bold text-right outline-none focus:border-indigo-500" value="0.45" step="0.01">
                                </div>
                            </div>
                            <div class="pt-2 border-t">
                                <p class="text-xs text-gray-500">Total Nómina (Viáticos/Comisión)</p>
                                <p id="res-payroll" class="text-2xl font-black text-gray-800">$0.00</p>
                            </div>
                        </div>

                        <button id="btn-ai-restrictions" class="w-full border-2 border-purple-500 text-purple-700 bg-purple-50 hover:bg-purple-100 font-bold py-2.5 rounded-lg transition flex justify-center items-center gap-2 text-sm">
                            <i class="fas fa-robot"></i> Consultar Restricciones IA SCT
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
    
    document.getElementById('btn-calc-route').addEventListener('click', calculateMapRoute);
    document.getElementById('rate-per-km').addEventListener('change', updatePayroll);
    document.getElementById('btn-ai-restrictions').addEventListener('click', checkAIRestrictions);
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

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        polylineOptions: {
            strokeColor: '#4f46e5',
            strokeOpacity: 0.8,
            strokeWeight: 6
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

    const loading = document.getElementById('map-loading');
    loading.classList.remove('hidden');

    const request = {
        origin: origen,
        destination: destino,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
        avoidTolls: false // Heavy transport usually uses tolls in MX
    };

    directionsService.route(request, (result, status) => {
        loading.classList.add('hidden');
        if (status == 'OK') {
            directionsRenderer.setDirections(result);
            
            const route = result.routes[0].legs[0];
            const distanceText = route.distance.text;
            const distanceValue = route.distance.value / 1000; // in km
            const durationText = route.duration.text;
            
            document.getElementById('res-distance').textContent = distanceText;
            document.getElementById('res-distance').dataset.km = distanceValue;
            document.getElementById('res-time').textContent = durationText;

            document.getElementById('route-results').classList.remove('hidden');
            updatePayroll();
            
        } else {
            console.error("Directions requests failed: ", status);
            Swal.fire('Ruta no encontrada', 'No se pudo trazar la ruta entre estos puntos.', 'error');
        }
    });
}

function updatePayroll() {
    const kmSpan = document.getElementById('res-distance');
    if (!kmSpan.dataset.km) return;
    
    const km = parseFloat(kmSpan.dataset.km);
    const rate = parseFloat(document.getElementById('rate-per-km').value) || 0;
    const total = km * rate;
    
    document.getElementById('res-payroll').textContent = '$' + total.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

async function checkAIRestrictions() {
    const origen = document.getElementById('map-origen').value;
    const destino = document.getElementById('map-destino').value;

    if (!origen || !destino) return;

    Swal.fire({
        title: 'Consultando Restricciones SCT...',
        html: '<div class="spinner my-4"></div><p class="text-sm">Analizando trazado de autopistas federales de cuota compatibles con Full Remolque...</p>',
        allowOutsideClick: false,
        showConfirmButton: false
    });

    const routeAI = await getHeavyVehicleRouteWithAI(origen, destino);

    Swal.fire({
        icon: 'info',
        title: 'Análisis IA (SCT Doble Articulado)',
        html: `<div class="text-left text-sm bg-purple-50 p-4 border border-purple-100 rounded-xl shadow-inner mt-4 text-purple-900">${routeAI}</div>`,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#8b5cf6',
        width: 600
    });
}
