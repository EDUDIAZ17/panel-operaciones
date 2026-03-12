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
        <div class="h-full flex flex-col md:flex-row bg-[#f3f4f6] p-2 gap-2 fade-in font-sans text-sm">
            
            <!-- Panel Izquierdo: Creador Avanzado de Rutas -->
            <div class="w-full md:w-[420px] bg-white border border-gray-300 flex flex-col overflow-hidden drop-shadow-sm h-full max-h-screen">
                
                <!-- TABS -->
                <div class="flex bg-[#e0e0e0] border-b border-gray-400">
                    <button id="tab-btn-create" class="flex-1 py-2 px-4 text-center border-r border-gray-300 font-bold bg-white text-gray-800 border-t-2 border-t-blue-600 focus:outline-none flex items-center justify-center gap-2 text-xs">
                        <i class="fas fa-map-marked-alt text-gray-500"></i> Crear Ruta
                    </button>
                    <button id="tab-btn-report" class="flex-1 py-2 px-4 text-center border-r border-gray-300 font-semibold text-gray-600 hover:bg-gray-100 focus:outline-none flex items-center justify-center gap-2 text-xs transition-colors">
                        <i class="fas fa-chart-line text-gray-500"></i> Reporte Ruta
                    </button>
                    <button id="tab-btn-points" class="flex-1 py-2 px-4 text-center font-semibold text-gray-600 hover:bg-gray-100 focus:outline-none flex items-center justify-center gap-2 text-xs transition-colors">
                        <i class="fas fa-map-marker-alt text-gray-500"></i> Puntos
                    </button>
                </div>
                
                <!-- CONTENIDO TABS -->
                <div class="flex-1 overflow-y-auto custom-scrollbar relative">
                    
                    <!-- TAB 1: CREAR RUTA -->
                    <div id="tab-crear-ruta" class="p-3 space-y-4">
                        
                        <!-- 1. Selección de Vehículo -->
                        <div class="border border-gray-300 bg-gray-50">
                            <div class="bg-[#e0e0e0] px-3 py-1.5 border-b border-gray-300 flex justify-between items-center">
                                <span class="font-bold text-gray-800 text-xs shadow-text">1. Seleccione un Vehículo para la Ruta</span>
                                <button class="bg-white border text-gray-600 px-2 py-0.5 text-[10px] hover:bg-gray-50"><i class="fas fa-plus"></i> Nuevo</button>
                            </div>
                            <div class="p-2 bg-white">
                                <select id="map-unit-type" class="w-full border border-gray-300 p-1.5 text-xs focus:outline-none focus:border-blue-500 bg-blue-50">
                                    <option value="Tractocamión Full (C3-R3)">Ejemplo 3 - Tracto Full (C3-R3)</option>
                                    <option value="Tractocamión Sencillo (T3-S2)">Ejemplo 2 - Tracto Sencillo (T3-S2)</option>
                                    <option value="Torton (C3)">Ejemplo 1 - Camión Torton (C3)</option>
                                    <option value="Automóvil (A2)">Ejemplo 4 - Automóvil (A2)</option>
                                </select>
                            </div>
                        </div>

                        <!-- 2. Preferencias -->
                        <div class="border border-gray-300 bg-gray-50">
                            <div class="bg-[#e0e0e0] px-3 py-1.5 border-b border-gray-300"><span class="font-bold text-gray-800 text-xs shadow-text">2. Preferencias de la Ruta</span></div>
                            <div class="p-3 bg-white grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-gray-700">
                                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="pref-avoid-tolls" class="form-checkbox text-blue-600"> Evitar Casetas</label>
                                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="pref-opt-truck" class="form-checkbox text-blue-600" checked> Optimizar Camión</label>
                                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="pref-avoid-ferries" class="form-checkbox text-blue-600" checked> Evitar Ferrys</label>
                                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="pref-opt-nom" class="form-checkbox text-blue-600" checked> Opt. NOM-012</label>
                                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="pref-close-road" class="form-checkbox text-blue-600"> Cerrar Tramo</label>
                                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="pref-opt-stops" class="form-checkbox text-blue-600" checked> Opt. Paradas</label>
                            </div>
                            <div class="border-t border-gray-200 p-2 bg-white flex items-center justify-between">
                                <span class="text-[11px] font-semibold text-gray-600">Velocidad Promedio:</span>
                                <div class="flex items-center gap-2">
                                     <button id="btn-speed-down" class="px-2 bg-gray-100 border hover:bg-gray-200">-</button>
                                     <input type="number" id="map-speed" value="70" class="w-12 text-center text-xs border p-1" title="km/h">
                                     <button id="btn-speed-up" class="px-2 bg-gray-100 border hover:bg-gray-200">+</button>
                                </div>
                            </div>
                        </div>

                        <!-- 3. Paradas -->
                        <div class="border border-gray-300 bg-gray-50">
                            <div class="bg-[#e0e0e0] px-3 py-1.5 border-b border-gray-300"><span class="font-bold text-gray-800 text-xs shadow-text">3. Origen, Destino y Paradas</span></div>
                            <div class="p-2 bg-white">
                                <table class="w-full text-[11px]">
                                    <tbody>
                                        <tr class="border-b">
                                            <td class="w-12 py-1.5 text-gray-500 font-semibold">Origen</td>
                                            <td class="py-1.5 px-1"><input type="text" id="map-origen" class="w-full border-none outline-none focus:ring-1 focus:ring-blue-300 px-1 placeholder-gray-400 text-gray-800" placeholder="Ej: Celaya, GTO"></td>
                                            <td class="w-16 py-1.5 text-right"><button class="text-gray-500 hover:text-red-500" onclick="document.getElementById('map-origen').value=''"><i class="fas fa-times"></i></button></td>
                                        </tr>
                                        <tr>
                                            <td colspan="3" class="p-0">
                                                <div id="waypoints-container" class="divide-y divide-gray-100"></div>
                                            </td>
                                        </tr>
                                        <tr class="border-b bg-gray-50 hover:bg-gray-100 cursor-pointer" id="btn-add-waypoint">
                                            <td class="w-12 py-2 text-gray-400 text-center"><i class="fas fa-plus"></i></td>
                                            <td class="py-2 px-1 text-gray-400 italic">Agregar nueva parada...</td>
                                            <td class="w-16 py-2 text-right"></td>
                                        </tr>
                                        <tr class="border-t border-gray-300 bg-gray-50">
                                            <td class="w-12 py-2 text-gray-700 font-semibold pl-1">Destino</td>
                                            <td class="py-2 px-1"><input type="text" id="map-destino" class="w-full border-none outline-none focus:ring-1 focus:ring-blue-300 px-1 placeholder-gray-400 text-gray-800 bg-transparent font-semibold" placeholder="Ej: Nuevo Laredo, TAMPS"></td>
                                            <td class="w-16 py-2 text-right"><button class="text-gray-500 hover:text-red-500 pr-1" onclick="document.getElementById('map-destino').value=''"><i class="fas fa-times"></i></button></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex gap-4 pt-2 pb-6">
                            <button id="btn-calc-route" class="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-800 font-bold py-2 shadow-sm text-sm">
                                Calcular Ruta
                            </button>
                            <button id="btn-clear-route" class="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-800 font-bold py-2 shadow-sm text-sm">
                                Borrar Ruta
                            </button>
                        </div>
                    </div>

                    <!-- TAB 2: REPORTE RUTA -->
                    <div id="tab-reporte-ruta" class="p-2 space-y-2 hidden">
                        <!-- Detalles de Ruta Superior -->
                        <div class="bg-[#f0f0f0] border border-gray-300 p-2 text-xs text-gray-800">
                             <div class="flex justify-between items-start mb-1">
                                 <span class="font-bold w-12 text-gray-600">Origen:</span>
                                 <span class="flex-1 px-1 font-semibold" id="rep-origen">--</span>
                                 <span class="text-gray-500" id="rep-fecha">--/--/----</span>
                             </div>
                             <div class="flex justify-between items-start mb-2">
                                 <span class="font-bold w-12 text-gray-600">Destino:</span>
                                 <span class="flex-1 px-1 font-semibold" id="rep-destino">--</span>
                             </div>
                             <div class="flex justify-between items-start pt-1 border-t border-gray-300">
                                 <span class="font-bold w-16 text-gray-600">Vehículo:</span>
                                 <span class="flex-1 px-1 font-semibold text-blue-700" id="rep-vehiculo">--</span>
                             </div>
                        </div>

                        <div class="grid grid-cols-[1fr_130px] gap-2">
                             <!-- Columna Izquierda: Tablas Resumen -->
                             <div class="space-y-2">
                                 
                                 <!-- Distancia -->
                                 <div class="border border-gray-400 bg-white text-xs">
                                      <div class="bg-[#e0e0e0] px-2 py-1 border-b border-gray-400 flex justify-between font-bold">
                                          <span>Distancia Total</span>
                                          <span id="rep-dist-total">0 Kms</span>
                                      </div>
                                      <div class="p-1 px-2 text-[10px] space-y-0.5">
                                          <div class="flex justify-between text-gray-600"><span>Con vehículo cargado...</span><span>0.00 Kms</span></div>
                                          <div class="flex justify-between text-gray-800 font-semibold border-t border-dashed border-gray-200 pt-0.5 mt-0.5"><span>Con vehículo vacío...</span><span id="rep-dist-vacio">0.00 Kms</span></div>
                                      </div>
                                 </div>

                                 <!-- Tiempo -->
                                 <div class="border border-gray-400 bg-white text-xs">
                                      <div class="bg-[#e0e0e0] px-2 py-1 border-b border-gray-400 flex justify-between font-bold">
                                          <span>Tiempo Total</span>
                                          <span id="rep-time-total">0h:00m</span>
                                      </div>
                                      <div class="p-1 px-2 text-[10px] space-y-0.5 text-gray-600">
                                          <div class="flex justify-between"><span>Conduciendo...</span><span id="rep-time-drive">0h:00m</span></div>
                                          <div class="flex justify-between"><span>En paradas programadas...</span><span>0h:00m</span></div>
                                          <div class="flex justify-between"><span>Descansando...</span><span>0h:00m</span></div>
                                      </div>
                                 </div>

                                 <!-- Costos Generales -->
                                 <div class="border border-gray-400 bg-white text-xs">
                                      <div class="bg-[#e0e0e0] px-2 py-1 border-b border-gray-400 flex justify-between font-bold text-gray-800">
                                          <span>Costo Total Estimado</span>
                                          <span id="rep-cost-total" class="text-blue-800">$0.00</span>
                                      </div>
                                      <div class="p-1 px-2 text-[10px] space-y-0.5 text-gray-700 font-mono tracking-tight">
                                          <div class="flex justify-between"><span>Casetas de cobro.......</span><span id="rep-cost-tolls">$0.00</span></div>
                                          <div class="flex justify-between"><span>Combustible............</span><span id="rep-cost-fuel" class="text-amber-700">$0.00</span></div>
                                          <div class="flex justify-between"><span>Chofer.................</span><span id="rep-cost-driver" class="text-green-700">$0.00</span></div>
                                          <div class="flex justify-between"><span>Mantenimiento..........</span><span id="rep-cost-maint">$0.00</span></div>
                                          <div class="flex justify-between"><span>Desgaste de llantas....</span><span id="rep-cost-tires">$0.00</span></div>
                                      </div>
                                      <div class="bg-[#e0e0e0] px-2 py-1 border-t border-gray-400 flex justify-between font-bold text-[10px] text-gray-800">
                                          <span>Costo promedio por Km</span>
                                          <span id="rep-cost-km">$0.00</span>
                                      </div>
                                 </div>

                             </div>

                             <!-- Columna Derecha: Botones -->
                             <div class="flex flex-col gap-1.5 pt-1">
                                  <button class="bg-[#f0f0f0] hover:bg-white border border-gray-400 text-gray-800 font-semibold py-1.5 px-2 text-xs shadow-sm text-center w-full">Itinerario</button>
                                  <button id="btn-show-tolls" class="bg-[#f0f0f0] hover:bg-white border text-blue-800 border-blue-400 font-bold py-1.5 px-2 text-xs shadow-sm text-center w-full"><i class="fas fa-ticket-alt"></i> Casetas</button>
                                  <button class="bg-[#f0f0f0] hover:bg-white border border-gray-400 text-gray-800 font-semibold py-1.5 px-2 text-xs shadow-sm text-center w-full">Paradas</button>
                                  <button id="btn-show-nom" class="bg-[#f0f0f0] hover:bg-white border border-gray-400 text-gray-800 font-semibold py-1.5 px-2 text-xs shadow-sm text-center w-full">NOM-012</button>
                                  <hr class="border-gray-300 my-1">
                                  <button class="bg-[#e6f0ff] hover:bg-blue-100 border border-blue-300 text-blue-800 font-bold py-1.5 px-2 text-xs shadow-sm text-center w-full"><i class="fas fa-file-invoice-dollar mt-1 block"></i> Generar Cotización</button>
                                  <button class="bg-[#f0f0f0] hover:bg-white border border-gray-400 text-gray-800 font-semibold py-1.5 px-2 text-xs shadow-sm text-center w-full"><i class="fas fa-file-pdf text-red-600"></i> Reporte PDF</button>
                                  <button id="btn-share-whatsapp" class="bg-green-50 hover:bg-green-100 border border-green-600 text-green-800 font-bold py-1.5 px-2 text-[11px] shadow-sm text-center w-full"><i class="fab fa-whatsapp text-green-600 text-sm mb-1 block"></i> Enviar a Operador</button>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mapa Principal -->
            <div class="flex-1 bg-white border border-gray-300 overflow-hidden relative drop-shadow-sm min-h-[400px]">
                <div class="absolute top-2 left-2 z-10 bg-white/90 px-2 py-1 rounded shadow text-xs font-bold text-gray-700 border border-gray-300 hidden md:block">
                    <i class="fas fa-globe-americas"></i> Mapas EDY Fleet Management
                </div>
                <!-- Mini Toolbar -->
                <div class="absolute top-2 right-2 z-10 bg-white border border-gray-400 shadow flex text-gray-600 rounded">
                     <button class="px-2 py-1 hover:bg-gray-100 border-r border-gray-300" title="Imprimir"><i class="fas fa-print"></i></button>
                     <button class="px-2 py-1 hover:bg-gray-100 border-r border-gray-300" title="Centrar"><i class="fas fa-crosshairs"></i></button>
                     <button class="px-2 py-1 hover:bg-gray-100" id="btn-nav-view" title="Vista Cabina 3D"><i class="fas fa-truck"></i> Dashboard Cabina</button>
                </div>

                <div id="map-canvas" class="w-full h-full"></div>
                <div id="map-loading" class="absolute inset-0 bg-white/70 flex flex-col items-center justify-center z-[1000] hidden">
                    <img src="assets/images/logo.png" alt="Loading" class="h-16 w-auto mb-4 animate-pulse sepia">
                    <div class="spinner border-4 border-gray-400 border-t-blue-600 w-8 h-8 rounded-full animate-spin"></div>
                    <p class="text-gray-800 font-bold mt-2 font-mono text-sm tracking-widest uppercase">Trazando Ruta Logística...</p>
                </div>
            </div>
        </div>

        <!-- Caseta Modal Container (Template) -->
        <div id="modal-casetas" class="fixed inset-0 bg-black/50 z-[2000] hidden flex items-center justify-center p-4">
            <div class="bg-[#f0f0f0] border-2 border-slate-400 shadow-2xl rounded-sm w-full max-w-2xl flex flex-col max-h-[80vh]">
                <!-- Modal Header -->
                <div class="bg-gradient-to-b from-[#e8ebf1] to-[#cbd2e0] border-b border-slate-400 flex justify-between items-center px-3 py-1.5">
                    <div class="flex items-center gap-2">
                         <i class="fas fa-globe-americas text-blue-600"></i>
                         <span class="font-bold text-slate-800 text-sm pb-0.5 shadow-text">Casetas de Cobro</span>
                    </div>
                    <button class="modal-casetas-close text-red-600 hover:bg-red-200 border border-transparent hover:border-red-400 px-2 rounded font-bold">X</button>
                </div>
                
                <!-- Modal Content -->
                <div class="p-2 flex-1 overflow-hidden flex flex-col bg-white">
                    <div class="bg-[#f8f9fa] border border-gray-300 mb-2 p-2 flex justify-between items-center text-sm">
                         <span class="font-semibold text-gray-700">Ruta Tarifada Oficialmente</span>
                         <span class="font-black text-red-700 text-base" id="casetas-gran-total">Total: $0.00</span>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto border border-gray-300">
                        <table class="w-full text-xs text-left whitespace-nowrap">
                            <thead class="bg-[#e4e7ec] border-b border-gray-300 sticky top-0 font-bold text-gray-700">
                                <tr>
                                    <th class="py-1.5 px-2 border-r border-gray-300 w-8 text-center text-gray-400"><i class="fas fa-dollar-sign"></i></th>
                                    <th class="py-1.5 px-2 border-r border-gray-300">Nombre de Plaza de Cobro</th>
                                    <th class="py-1.5 px-2 border-r border-gray-300 w-24 text-right">Distancia</th>
                                    <th class="py-1.5 px-2 border-r border-gray-300 w-20 text-center">Tiempo</th>
                                    <th class="py-1.5 px-2 w-20 text-right text-green-700">Tarifa</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200" id="casetas-table-body">
                                <tr><td colspan="5" class="py-8 text-center text-gray-400 italic">No hay casetas detectadas en esta ruta.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    initMap();
    bindWaypointLogic();
    bindTabsAndUI();
    
    document.getElementById('btn-calc-route').addEventListener('click', calculateMapRoute);
    document.getElementById('btn-clear-route').addEventListener('click', clearMapRoute);
    document.getElementById('btn-show-tolls').addEventListener('click', openTollsModal);
    document.querySelectorAll('.modal-casetas-close').forEach(btn => {
        btn.addEventListener('click', closeTollsModal);
    });
    document.getElementById('btn-share-whatsapp').addEventListener('click', shareRouteWhatsApp);
}

function bindTabsAndUI() {
    const tabCreateBtn = document.getElementById('tab-btn-create');
    const tabReportBtn = document.getElementById('tab-btn-report');
    const tabPointsBtn = document.getElementById('tab-btn-points');
    
    const tabCreateContent = document.getElementById('tab-crear-ruta');
    const tabReportContent = document.getElementById('tab-reporte-ruta');

    function switchTab(activeBtn, activeContent) {
        // Reset buttons
        [tabCreateBtn, tabReportBtn, tabPointsBtn].forEach(btn => {
            btn.classList.remove('bg-white', 'text-gray-800', 'border-t-2', 'border-t-blue-600');
            btn.classList.add('text-gray-600', 'hover:bg-gray-100');
        });
        
        // Hide contents
        tabCreateContent.classList.add('hidden');
        tabReportContent.classList.add('hidden');
        
        // Set active
        activeBtn.classList.remove('text-gray-600', 'hover:bg-gray-100');
        activeBtn.classList.add('bg-white', 'text-gray-800', 'border-t-2', 'border-t-blue-600');
        if(activeContent) activeContent.classList.remove('hidden');
    }

    tabCreateBtn.addEventListener('click', () => switchTab(tabCreateBtn, tabCreateContent));
    tabReportBtn.addEventListener('click', () => switchTab(tabReportBtn, tabReportContent));
    tabPointsBtn.addEventListener('click', () => switchTab(tabPointsBtn, null));

    // Speed controls
    const speedInput = document.getElementById('map-speed');
    document.getElementById('btn-speed-up').addEventListener('click', () => {
        speedInput.value = parseInt(speedInput.value || 70) + 5;
    });
    document.getElementById('btn-speed-down').addEventListener('click', () => {
        speedInput.value = Math.max(10, parseInt(speedInput.value || 70) - 5);
    });
}

function clearMapRoute() {
    document.getElementById('map-origen').value = '';
    document.getElementById('map-destino').value = '';
    document.getElementById('waypoints-container').innerHTML = '';
    if (directionsRenderer) directionsRenderer.setDirections({routes: []});
    if (window.tollMarkers) {
        window.tollMarkers.forEach(m => m.setMap(null));
    }
    window.tollMarkers = [];
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
    const unitTypeOptions = document.getElementById('map-unit-type');
    const unitTypeName = unitTypeOptions.options[unitTypeOptions.selectedIndex].text;

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
        avoidTolls: document.getElementById('pref-avoid-tolls').checked,
        avoidFerries: document.getElementById('pref-avoid-ferries').checked
    };

    directionsService.route(request, async (result, status) => {
        loading.classList.add('hidden');
        if (status == 'OK') {
            directionsRenderer.setDirections(result);
            
            // Remove previous toll markers
            if (window.tollMarkers) window.tollMarkers.forEach(m => m.setMap(null));
            window.tollMarkers = [];
            
            let totalDistanceMeters = 0;
            result.routes[0].legs.forEach(leg => {
                totalDistanceMeters += leg.distance.value;
                // Add basic orange markers for tolls from Google
                leg.steps.forEach(step => {
                    const instructions = step.instructions.toLowerCase();
                    if (instructions.includes('cuota') || instructions.includes('peaje') || instructions.includes('toll')) {
                        const marker = new google.maps.Marker({
                            position: step.start_location,
                            map: map,
                            icon: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
                            title: 'Caseta de Cobro'
                        });
                        window.tollMarkers.push(marker);
                    }
                });
            });
            
            const distanceValueKm = totalDistanceMeters / 1000;
            
            // Time breakdown
            const drivingTimeH = distanceValueKm / speedKmH;
            const stopTimeH = waypoints.length * 0.5; // Assume 30 mins per stop for now
            const restTimeH = document.getElementById('pref-opt-nom').checked ? Math.floor(drivingTimeH / 5) * 0.5 : 0; // NOM-012 rest (30 min every 5h)
            
            const totalTimeH = drivingTimeH + stopTimeH + restTimeH;
            
            function formatTime(hoursDecimal) {
                const hours = Math.floor(hoursDecimal);
                const minutes = Math.round((hoursDecimal - hours) * 60);
                return `${hours}h:${minutes.toString().padStart(2, '0')}m`;
            }
            
            // Populate Reporte Ruta
            const today = new Date().toLocaleDateString('es-MX');
            document.getElementById('rep-origen').textContent = origen;
            document.getElementById('rep-destino').textContent = destino;
            document.getElementById('rep-fecha').textContent = today;
            document.getElementById('rep-vehiculo').textContent = unitTypeName;
            
            document.getElementById('rep-dist-total').textContent = distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 0}) + ' Kms';
            document.getElementById('rep-dist-vacio').textContent = distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 0}) + ' Kms';
            
            document.getElementById('rep-time-total').textContent = formatTime(totalTimeH);
            document.getElementById('rep-time-drive').textContent = formatTime(drivingTimeH);
            
            window.currentRouteData = {
                origen, destino, waypointNames, distance: distanceValueKm, unitTypeName
            };
            
            // Switch to Report Tab
            document.getElementById('tab-btn-report').click();
            
            // Trigger AI Tolls & Payroll Calc
            triggerTollCalculationAndPayroll(distanceValueKm, unitTypeName);

        } else {
            console.error("Directions requests failed: ", status);
            Swal.fire('Ruta no encontrada', 'No se pudo trazar la ruta entre estos puntos.', 'error');
        }
    });
}

// Nueva función extraída para calcular casetas y no repetir código al arrastrar
async function triggerTollCalculationAndPayroll(distanceKm, unitTypeName) {
    const origen = window.currentRouteData.origen;
    const destino = window.currentRouteData.destino;
    const waypoints = window.currentRouteData.waypointNames;
    const avoidTolls = document.getElementById('pref-avoid-tolls').checked;

    document.getElementById('rep-cost-tolls').innerHTML = '<i class="fas fa-sync fa-spin"></i>';
    
    let tollsCost = 0;

    if (avoidTolls) {
        document.getElementById('rep-cost-tolls').textContent = '$0.00';
        populateCasetasModal([]);
    } else {
        try {
            // This will be handled by Gemini to get detailed info
            if(window.getDetailedTollsAI) {
                const response = await window.getDetailedTollsAI(origen, destino, waypoints, unitTypeName);
                if (response && response.tolls) {
                    tollsCost = response.totalCost || 0;
                    document.getElementById('rep-cost-tolls').textContent = '$' + tollsCost.toLocaleString('es-MX', {minimumFractionDigits: 2});
                    populateCasetasModal(response.tolls, tollsCost);
                } else {
                    document.getElementById('rep-cost-tolls').textContent = 'Error IA';
                    populateCasetasModal([]);
                }
            } else {
                 document.getElementById('rep-cost-tolls').textContent = 'IA No Lista';
                 populateCasetasModal([]);
            }
        } catch (e) {
            console.error("Error estimando casetas con IA:", e);
            document.getElementById('rep-cost-tolls').textContent = 'Error IA';
            populateCasetasModal([]);
        }
    }

    // Rendimiento/Fuel based on Unit type (approx)
    let kpl = Math.max(1, parseFloat(document.getElementById('pref-kpl').value) || 2.5); // Km/L
    let dieselPrice = 24.50; // Approximated
    let fuelCost = (distanceKm / kpl) * dieselPrice;
    
    // Sueldo/Driver (based on km usually)
    let driverRateKm = document.getElementById('pref-opt-truck').checked ? 1.50 : 1.20; 
    let driverCost = distanceKm * driverRateKm;

    // Maintenance factor per km
    let maintCost = distanceKm * 0.85; 

    // Tires factor per km
    let tiresCost = distanceKm * 0.60;

    // Update Report Table
    document.getElementById('rep-cost-fuel').textContent = '$' + fuelCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('rep-cost-driver').textContent = '$' + driverCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('rep-cost-maint').textContent = '$' + maintCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('rep-cost-tires').textContent = '$' + tiresCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    let masterTotal = tollsCost + fuelCost + driverCost + maintCost + tiresCost;
    document.getElementById('rep-cost-total').textContent = '$' + masterTotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('rep-tit-cost').textContent = '$' + masterTotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 0}) + ' MXN';

    let costPerKm = distanceKm > 0 ? (masterTotal / distanceKm) : 0;
    document.getElementById('rep-cost-km').textContent = '$' + costPerKm.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    window.currentRouteData.calculatedCosts = {
         tolls: tollsCost, fuel: fuelCost, driver: driverCost, maint: maintCost, tires: tiresCost, total: masterTotal, perKm: costPerKm
    };
}

function populateCasetasModal(tollsArray, totalCost) {
    const tbody = document.getElementById('casetas-table-body');
    const totalSpan = document.getElementById('casetas-gran-total');
    
    if(!tollsArray || tollsArray.length === 0) {
         tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-gray-400 italic">No hay casetas registradas o se seleccionó 'Evitar Cuotas'.</td></tr>`;
         totalSpan.textContent = "Total: $0.00";
         return;
    }

    totalSpan.textContent = "Total: $" + (totalCost || 0).toLocaleString('es-MX', {minimumFractionDigits: 2});
    
    tbody.innerHTML = '';
    tollsArray.forEach(toll => {
         const tr = document.createElement('tr');
         tr.className = "hover:bg-blue-50 transition-colors";
         tr.innerHTML = `
             <td class="py-1.5 px-2 border-r border-gray-200 text-center"><i class="fas fa-ticket-alt text-orange-500"></i></td>
             <td class="py-1.5 px-2 border-r border-gray-200 font-medium text-gray-800">${toll.name}</td>
             <td class="py-1.5 px-2 border-r border-gray-200 text-right text-gray-600">${toll.distance || '-'} km</td>
             <td class="py-1.5 px-2 border-r border-gray-200 text-center text-gray-600">${toll.time || '-'}</td>
             <td class="py-1.5 px-2 text-right font-bold text-green-700">$${(toll.cost || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
         `;
         tbody.appendChild(tr);
    });
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
    const stopTimeH = waypoints.length * 0.5;
    
    const drivingTimeH = distanceValueKm / speedKmH;
    const restTimeH = document.getElementById('pref-opt-nom').checked ? Math.floor(drivingTimeH / 5) * 0.5 : 0;
    const totalTimeH = drivingTimeH + stopTimeH + restTimeH;
    
    function formatTime(hoursDecimal) {
        const h = Math.floor(hoursDecimal);
        const m = Math.round((hoursDecimal - h) * 60);
        return `${h}h:${m.toString().padStart(2, '0')}m`;
    }
    
    // Update Report tab manually since dragged
    document.getElementById('rep-dist-total').textContent = distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 0}) + ' Kms';
    document.getElementById('rep-dist-vacio').textContent = distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 0}) + ' Kms';
    
    document.getElementById('rep-time-total').textContent = formatTime(totalTimeH) + ' (Modificado)';
    document.getElementById('rep-time-drive').textContent = formatTime(drivingTimeH);

    window.currentRouteData.distance = distanceValueKm;

    // Volver a calcular casetas con los nuevos puntos arrastrados
    // Excluir el primer address porque es el origen
    const arrastrados = legWaypoints.slice(1); 
    triggerTollCalculationAndPayroll(distanceValueKm, window.currentRouteData.unitTypeName);
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

// Modals and Share Logic
function openTollsModal() {
    document.getElementById('modal-casetas').classList.remove('hidden');
}

function closeTollsModal() {
    document.getElementById('modal-casetas').classList.add('hidden');
}

function shareRouteWhatsApp() {
    if(!window.currentRouteData || !window.currentRouteData.origen) {
        Swal.fire('Atención', 'Debe calcular una ruta primero antes de enviarla.', 'warning');
        return;
    }
    
    let text = `*📍 NUEVA ASIGNACIÓN DE RUTA*\n\n`;
    text += `*🚛 Unidad:* ${window.currentRouteData.unitTypeName || 'No esp.'}\n`;
    text += `*🛣️ Origen:* ${window.currentRouteData.origen}\n`;
    text += `*🏁 Destino:* ${window.currentRouteData.destino}\n`;
    
    let mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(window.currentRouteData.origen)}&destination=${encodeURIComponent(window.currentRouteData.destino)}`;

    if(window.currentRouteData.waypointNames && window.currentRouteData.waypointNames.length > 0) {
        text += `\n*🛑 Paradas Obligatorias:*\n`;
        window.currentRouteData.waypointNames.forEach((w,i) => {
             text += `  ${i+1}. ${w}\n`;
        });
        const waypointsStr = window.currentRouteData.waypointNames.join('|');
        mapsUrl += `&waypoints=${encodeURIComponent(waypointsStr)}`;
    }
    
    if(window.currentRouteData.calculatedCosts) {
        text += `\n*💰 Viáticos Asignados:*\n`;
        text += `  Casetas: $${window.currentRouteData.calculatedCosts.tolls.toLocaleString('es-MX', {minimumFractionDigits: 2})}\n`;
        text += `  Diésel Estimado: $${window.currentRouteData.calculatedCosts.fuel.toLocaleString('es-MX', {minimumFractionDigits: 2})}\n`;
    }
    
    text += `\n*🗺️ Ver Ruta en Google Maps:*\n${mapsUrl}\n`;
    
    text += `\nPor favor, confirme de recibido y registre la salida en su App de Operador (EDY). Buen viaje.`;
    
    const encoded = encodeURIComponent(text);
    // Para simplificar, abrir WhatsApp Web/App hacia el usuario
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
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
            waypoints.push(input.value.trim());
        }
    });

    // Guardar para la App EDY (offline-first simulator)
    localStorage.setItem('edy_pending_route', JSON.stringify({
        origen,
        destino,
        waypoints
    }));

    Swal.fire({
        title: 'Navegación Cabina',
        text: 'Se ha preparado la ruta para la aplicación integral de Cabina.',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-truck"></i> Abrir App EDY',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4f46e5'
    }).then((res) => {
        if(res.isConfirmed) {
            window.open('edy_app.html', '_blank');
        }
    });
}
