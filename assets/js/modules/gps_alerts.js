import { supabase } from '../services/supabaseClient.js';
import { fetchSamsaraLocations } from '../services/samsara.js';

// Predefined Quality Message (Yoro)
const DEFAULT_QUALITY_MSG = "Estimado operador, le recordamos mantener las medidas de seguridad, respetar los límites de velocidad y reportar cualquier novedad a Torre de Control. Su seguridad es lo más importante. ¡Buen viaje y excelente llegada!";

// Local state for GPS Alerts
const alertState = {
    alerts: [],
    units: [],
    operators: [],
    samsaraLocations: [],
    activeMap: null,
    mapMarkers: {},
    geofenceCircles: {},
    simulatedPositions: {}, // { unitId: { lat, lng } }
    liveTrackingInterval: null,
    selectedAutocompleteCoords: null, // { lat, lng, name }
};

export async function renderGPSAlerts(container) {
    container.innerHTML = `
        <div id="view-gps-alerts" class="p-6 fade-in space-y-6 bg-slate-50 min-h-full">
            <!-- Warning Banner for missing table -->
            <div id="db-warning-banner" class="hidden bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl shadow-sm animate-pulse">
                <div class="flex items-start gap-3">
                    <div class="text-rose-600 mt-0.5"><i class="fas fa-exclamation-triangle text-lg"></i></div>
                    <div class="flex-1">
                        <h4 class="text-xs font-black text-rose-800 uppercase tracking-wider">Base de datos desincronizada</h4>
                        <p class="text-[11px] text-rose-700 mt-1">La tabla <b>whatsapp_gps_alerts</b> no existe en la base de datos de Supabase. Se activó el <b>modo de demostración local (localStorage)</b>. Las alertas funcionarán temporalmente en este navegador, pero debes ejecutar el script SQL <b>v13_whatsapp_gps_alerts.sql</b> en la consola SQL de Supabase para guardarlas permanentemente.</p>
                    </div>
                    <button onclick="this.parentElement.parentElement.remove()" class="text-rose-400 hover:text-rose-600 text-sm"><i class="fas fa-times"></i></button>
                </div>
            </div>

            <!-- Alert Stats Grid -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div class="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl font-bold">
                        <i class="fas fa-satellite-dish animate-pulse"></i>
                    </div>
                    <div>
                        <p class="text-xs text-slate-400 font-bold uppercase tracking-wider">Alertas Activas</p>
                        <p id="stat-active-alerts" class="text-2xl font-black text-slate-800">0</p>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div class="h-12 w-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl font-bold">
                        <i class="fas fa-bell animate-bounce"></i>
                    </div>
                    <div>
                        <p class="text-xs text-slate-400 font-bold uppercase tracking-wider">Llegadas/Disparadas</p>
                        <p id="stat-triggered-alerts" class="text-2xl font-black text-slate-800">0</p>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div class="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl font-bold">
                        <i class="fab fa-whatsapp"></i>
                    </div>
                    <div>
                        <p class="text-xs text-slate-400 font-bold uppercase tracking-wider">Alertas Enviadas</p>
                        <p id="stat-sent-alerts" class="text-2xl font-black text-slate-800">0</p>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div class="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl font-bold">
                        <i class="fas fa-truck"></i>
                    </div>
                    <div>
                        <p class="text-xs text-slate-400 font-bold uppercase tracking-wider">Unidades con GPS Activo</p>
                        <p id="stat-tracked-units" class="text-2xl font-black text-slate-800">0</p>
                    </div>
                </div>
            </div>

            <!-- Main Work Area -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                <!-- Left Panel: Planner (Programador) -->
                <div class="lg:col-span-4 space-y-6">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 class="text-lg font-black text-slate-800 mb-5 flex items-center gap-2">
                            <i class="fas fa-clock text-indigo-600"></i> Programar Alerta GPS
                        </h3>
                        
                        <form id="gps-alert-form" class="space-y-4">
                            <!-- Unit Select -->
                            <div>
                                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Unidad a Monitorear</label>
                                <select id="alert-unit-id" class="w-full border-2 border-slate-100 focus:border-indigo-500 outline-none p-3 rounded-xl font-semibold text-slate-700 bg-slate-50 transition" required>
                                    <option value="">Seleccione Unidad...</option>
                                </select>
                            </div>

                            <!-- Destination (Google Autocomplete) -->
                            <div>
                                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Destino (Localidad de Llegada)</label>
                                <div class="relative">
                                    <input type="text" id="alert-destination" placeholder="Escriba ciudad, patio o dirección..." class="w-full border-2 border-slate-100 focus:border-indigo-500 outline-none p-3 pl-10 rounded-xl font-semibold text-slate-700 bg-slate-50 transition" required>
                                    <i class="fas fa-map-marker-alt absolute left-4 top-4 text-slate-400"></i>
                                </div>
                                <div id="alert-coords-preview" class="text-[10px] text-slate-400 mt-1 font-mono italic">Coordenadas: No seleccionadas</div>
                            </div>

                            <!-- Geofence Radius slider -->
                            <div>
                                <div class="flex justify-between items-center mb-1">
                                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Radio de Alerta (Geocerca)</label>
                                    <span id="radius-value" class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">15 km</span>
                                </div>
                                <input type="range" id="alert-radius" min="1" max="50" value="15" class="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600">
                            </div>

                            <!-- ATC custom message -->
                            <div>
                                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Mensaje ATC (Datos Específicos de Ruta)</label>
                                <textarea id="alert-atc-msg" rows="3" class="w-full border-2 border-slate-100 focus:border-indigo-500 outline-none p-3 rounded-xl font-semibold text-slate-700 bg-slate-50 transition" placeholder="Ej: Cargamento BYD, pedido #8932. Entregar documentación en caseta y solicitar rampa 3." required></textarea>
                            </div>

                            <!-- Yoro Quality Message (Editable but loaded by default) -->
                            <div>
                                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Mensaje de Calidad de Yoro</label>
                                <textarea id="alert-quality-msg" rows="3" class="w-full border-2 border-slate-100 focus:border-indigo-500 outline-none p-3 rounded-xl font-semibold text-slate-700 bg-slate-50 transition text-xs" required>${DEFAULT_QUALITY_MSG}</textarea>
                            </div>

                            <!-- Recipient Phone Numbers -->
                            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                <h4 class="text-xs font-black text-slate-600 flex items-center gap-1.5">
                                    <i class="fab fa-whatsapp text-emerald-500"></i> Destinatarios de Alerta
                                </h4>
                                
                                <div>
                                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1">Teléfono Operador</label>
                                    <input type="text" id="alert-phone-operator" placeholder="Cargando automático..." class="w-full border border-slate-200 focus:border-indigo-500 outline-none p-2 rounded-lg text-xs font-semibold">
                                </div>
                                
                                <div>
                                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1">Contacto de Ruta 1 (Ej. Torre Control)</label>
                                    <input type="text" id="alert-phone-m1" placeholder="Ej: +52 55 1234 5678" class="w-full border border-slate-200 focus:border-indigo-500 outline-none p-2 rounded-lg text-xs font-semibold">
                                </div>
                                
                                <div>
                                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1">Contacto de Ruta 2 (Ej. Operaciones)</label>
                                    <input type="text" id="alert-phone-m2" placeholder="Ej: +52 55 8765 4321" class="w-full border border-slate-200 focus:border-indigo-500 outline-none p-2 rounded-lg text-xs font-semibold">
                                </div>

                                <div>
                                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1">Contacto de Ruta 3 (Ej. Supervisor)</label>
                                    <input type="text" id="alert-phone-m3" placeholder="Ej: +52 55 9988 7766" class="w-full border border-slate-200 focus:border-indigo-500 outline-none p-2 rounded-lg text-xs font-semibold">
                                </div>

                                <div>
                                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1">Grupo de WhatsApp / Enlace (Opcional)</label>
                                    <input type="text" id="alert-whatsapp-group" placeholder="Enlace de invitación de grupo" class="w-full border border-slate-200 focus:border-indigo-500 outline-none p-2 rounded-lg text-xs font-semibold">
                                </div>
                            </div>

                            <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition flex items-center justify-center gap-2">
                                <i class="fas fa-paper-plane"></i> PROGRAMAR MONITOREO
                            </button>
                        </form>
                    </div>

                    <!-- Automation Webhook Configuration Card -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 class="text-sm font-black text-slate-800 mb-4 flex items-center justify-between">
                            <span><i class="fas fa-cogs text-slate-500 mr-2"></i> Integración Webhook API</span>
                            <span class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="webhook-enabled" class="sr-only peer">
                                <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                            </span>
                        </h3>
                        <p class="text-[11px] text-slate-400 mb-3">Si se activa, el sistema enviará automáticamente un POST JSON a esta URL cuando el vehículo entre en el radio, permitiendo la automatización total con APIs externas.</p>
                        <input type="url" id="webhook-url" placeholder="https://api.tuservidor.com/whatsapp-webhook" class="w-full border-2 border-slate-100 focus:border-indigo-500 outline-none p-2.5 rounded-lg text-xs font-mono">
                    </div>
                </div>

                <!-- Right Panel: Map, Live Monitor & Simulation Controls -->
                <div class="lg:col-span-8 space-y-6">
                    
                    <!-- Live Tracker Map Card -->
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[500px]">
                        <div class="p-4 bg-white border-b flex flex-wrap gap-4 items-center justify-between">
                            <div>
                                <h3 class="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <span class="status-dot dot-green animate-pulse"></span> Mapa Logístico de Alertas y Geocercas
                                </h3>
                                <p class="text-[10px] text-slate-400 mt-0.5">Muestra unidades con alertas activas, su radio de cobertura y su ubicación real. Arrastra marcadores en el simulador para pruebas.</p>
                            </div>
                            <!-- Simulation Control Button Toggle -->
                            <div class="flex items-center gap-2">
                                <button id="btn-toggle-simulation" class="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-2">
                                    <i class="fas fa-gamepad"></i> Habilitar Simulador GPS
                                </button>
                                <button id="btn-refresh-gps" class="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl transition">
                                    <i class="fas fa-sync-alt"></i>
                                </button>
                            </div>
                        </div>
                        <div class="flex-1 w-full relative">
                            <div id="gps-alerts-map" class="w-full h-full bg-slate-100"></div>
                            
                            <!-- Overlay Simulator Menu -->
                            <div id="sim-control-panel" class="absolute top-4 left-4 bg-white/90 backdrop-blur-md p-4 rounded-xl border border-slate-100 shadow-xl max-w-xs z-10 space-y-3 hidden transition-all">
                                <div class="flex justify-between items-center border-b pb-1">
                                    <span class="text-xs font-black text-amber-600 uppercase tracking-widest"><i class="fas fa-tools"></i> Simulador GPS</span>
                                    <button onclick="document.getElementById('sim-control-panel').classList.add('hidden')" class="text-slate-400 hover:text-slate-600 text-sm"><i class="fas fa-times"></i></button>
                                </div>
                                <p class="text-[10px] text-slate-500">Selecciona una unidad de prueba y haz clic en cualquier parte del mapa para simular su movimiento y probar la geocerca.</p>
                                <div>
                                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1">Unidad a Simular</label>
                                    <select id="sim-unit-select" class="w-full border p-1.5 rounded text-xs">
                                        <option value="">Seleccione...</option>
                                    </select>
                                </div>
                                <div class="flex gap-2">
                                    <button id="btn-sim-trigger-arrival" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black py-1.5 rounded text-[10px]">Llegar a Destino</button>
                                    <button id="btn-sim-reset" class="bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 px-3 rounded text-[10px]">Restablecer</button>
                                </div>
                            </div>
                            <div id="map-loading" class="absolute inset-0 bg-slate-900/10 flex items-center justify-center font-bold text-slate-700 z-10">
                                <div class="text-center">
                                    <div class="spinner border-t-indigo-600 w-8 h-8 mb-2"></div>
                                    <div class="text-xs">Cargando Google Maps...</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Live Active Alerts Monitor Table -->
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div class="p-4 bg-slate-50/50 border-b flex items-center justify-between">
                            <h3 class="text-xs font-black text-slate-700 uppercase tracking-wider">Monitoreo de Unidades y Alertas Geográficas</h3>
                            <span class="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-full"><i class="fas fa-satellite"></i> Samsara GPS Conectado</span>
                        </div>
                        <div class="overflow-x-auto custom-scrollbar">
                            <table class="w-full text-left border-collapse min-w-max">
                                <thead>
                                    <tr class="bg-slate-50 border-b text-[11px] uppercase tracking-wider font-bold text-slate-400">
                                        <th class="p-4">Unidad / Op</th>
                                        <th class="p-4">Ubicación GPS (Samsara)</th>
                                        <th class="p-4">Destino Configurado</th>
                                        <th class="p-4">Distancia al Objetivo</th>
                                        <th class="p-4">Estatus</th>
                                        <th class="p-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="gps-alerts-body" class="divide-y divide-slate-100 text-sm">
                                    <tr>
                                        <td colspan="6" class="p-8 text-center text-slate-400">
                                            <div class="spinner w-6 h-6 border-t-indigo-500 mb-2"></div>
                                            <div>Cargando alertas y GPS en tiempo real...</div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    `;

    // Bind slider value
    const slider = document.getElementById('alert-radius');
    const sliderVal = document.getElementById('radius-value');
    slider.oninput = function() {
        sliderVal.innerText = `${this.value} km`;
        updateCirclesOnMap();
    };

    // Toggle simulation panel
    const btnSim = document.getElementById('btn-toggle-simulation');
    if (btnSim) {
        btnSim.onclick = () => {
            const panel = document.getElementById('sim-control-panel');
            if (!panel) return;
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) {
                btnSim.classList.remove('bg-amber-500', 'hover:bg-amber-600');
                btnSim.classList.add('bg-slate-700', 'hover:bg-slate-800');
                btnSim.innerHTML = `<i class="fas fa-eye"></i> Ocultar Simulador`;
            } else {
                btnSim.classList.remove('bg-slate-700', 'hover:bg-slate-800');
                btnSim.classList.add('bg-amber-500', 'hover:bg-amber-600');
                btnSim.innerHTML = `<i class="fas fa-gamepad"></i> Habilitar Simulador GPS`;
            }
        };
    }

    // Load custom integrations config
    const savedWebhook = localStorage.getItem('gps_alert_webhook_url') || '';
    const savedWebhookEnabled = localStorage.getItem('gps_alert_webhook_enabled') === 'true';
    document.getElementById('webhook-url').value = savedWebhook;
    document.getElementById('webhook-enabled').checked = savedWebhookEnabled;

    document.getElementById('webhook-url').onchange = (e) => {
        localStorage.setItem('gps_alert_webhook_url', e.target.value.trim());
    };
    document.getElementById('webhook-enabled').onchange = (e) => {
        localStorage.setItem('gps_alert_webhook_enabled', e.target.checked);
    };

    // Bind refresh buttons
    document.getElementById('btn-refresh-gps').onclick = loadGPSAlertsData;
    document.getElementById('gps-alert-form').onsubmit = handleFormSubmit;

    // Reset simulation position
    document.getElementById('btn-sim-reset').onclick = () => {
        alertState.simulatedPositions = {};
        Swal.fire({
            icon: 'info',
            title: 'Simulador Restablecido',
            text: 'Las ubicaciones de las unidades han vuelto a sus coordenadas de Samsara en tiempo real.',
            confirmButtonColor: '#4f46e5'
        });
        loadGPSAlertsData();
    };

    document.getElementById('btn-sim-trigger-arrival').onclick = triggerManualArrival;

    // Initialize Autocomplete
    initAutocomplete();

    // Load initial data
    await loadGPSAlertsData();

    // Start live tracking loop (every 30 seconds)
    if (alertState.liveTrackingInterval) clearInterval(alertState.liveTrackingInterval);
    alertState.liveTrackingInterval = setInterval(async () => {
        console.log("GPS-MONITOR: Real-time loop polling Samsara position updates...");
        await fetchSamsaraUpdatesAndEvaluate();
    }, 30000);

    // Make map initialization wait slightly for google object to be ready
    setTimeout(() => {
        initGoogleMap();
    }, 800);
}

// Set up Autocomplete search box for Destination
function initAutocomplete() {
    const input = document.getElementById('alert-destination');
    if (!input) return;

    try {
        if (typeof google === 'object' && google.maps && google.maps.places) {
            const autocomplete = new google.maps.places.Autocomplete(input, {
                types: ['(cities)'],
                componentRestrictions: { country: 'MX' } // Focus on Mexico locations
            });

            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.geometry) {
                    const lat = place.geometry.location.lat();
                    const lng = place.geometry.location.lng();
                    alertState.selectedAutocompleteCoords = { lat, lng, name: place.name || place.formatted_address };
                    document.getElementById('alert-coords-preview').innerText = `Coordenadas: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
                } else {
                    alertState.selectedAutocompleteCoords = null;
                    document.getElementById('alert-coords-preview').innerText = `Coordenadas: No encontradas`;
                }
            });
        } else {
            console.warn("Autocomplete places library not available yet.");
        }
    } catch(e) {
        console.error("Autocomplete setup failed:", e);
    }
}

// Initial Data Loading
async function loadGPSAlertsData() {
    // 1. Fetch units with assignments
    const { data: unitsData, error: uErr } = await supabase
        .from('units')
        .select(`*, operators (id, name, phone)`)
        .order('economic_number');

    if (uErr) {
        console.error("Error loading units:", uErr);
        return;
    }

    alertState.units = unitsData.sort((a,b) => a.economic_number.localeCompare(b.economic_number, undefined, {numeric: true}));

    // Populate unit dropdown in planner and simulator
    const unitSelect = document.getElementById('alert-unit-id');
    const simSelect = document.getElementById('sim-unit-select');
    if (unitSelect && simSelect) {
        unitSelect.innerHTML = `<option value="">Seleccione Unidad...</option>`;
        simSelect.innerHTML = `<option value="">Seleccione...</option>`;
        
        alertState.units.forEach(u => {
            const label = `${u.economic_number} (${u.type}) - ${u.operators?.name || 'Sin Operador'}`;
            unitSelect.innerHTML += `<option value="${u.id}">${label}</option>`;
            simSelect.innerHTML += `<option value="${u.id}">${u.economic_number}</option>`;
        });

        // Trigger autofill listener when unit selected
        unitSelect.onchange = handleUnitSelectChange;
    }

    // 2. Fetch Active WhatsApp Alert configs
    try {
        const { data: alertsData, error: aErr } = await supabase
            .from('whatsapp_gps_alerts')
            .select('*')
            .order('created_at', { ascending: false });

        if (aErr) {
            console.error("Error loading whatsapp GPS alerts:", aErr);
            throw aErr;
        } else {
            alertState.alerts = alertsData || [];
            alertState.useLocalStorageFallback = false;
            const banner = document.getElementById('db-warning-banner');
            if (banner) banner.classList.add('hidden');
        }
    } catch (err) {
        console.log("GPS-MONITOR: Table 'whatsapp_gps_alerts' not found or inaccessible. Falling back to local storage.");
        alertState.useLocalStorageFallback = true;
        const localData = localStorage.getItem('whatsapp_gps_alerts');
        alertState.alerts = localData ? JSON.parse(localData) : [];
        const banner = document.getElementById('db-warning-banner');
        if (banner) banner.classList.remove('hidden');
    }

    // 3. Fetch Samsara live locations
    const samsaraLocations = await fetchSamsaraLocations();
    alertState.samsaraLocations = samsaraLocations || [];

    // Evaluate proximity and render
    evaluateProximityAndRender();
}

// Handle Auto-populating destination and contact details when a unit is selected
async function handleUnitSelectChange(e) {
    const unitId = e.target.value;
    if (!unitId) return;

    const unit = alertState.units.find(u => u.id === unitId);
    if (!unit) return;

    // Fill Operator phone
    const opPhoneInput = document.getElementById('alert-phone-operator');
    if (opPhoneInput) {
        opPhoneInput.value = unit.operators?.phone || '';
        if (!unit.operators?.phone) {
            opPhoneInput.placeholder = 'Sin número registrado';
        }
    }

    // Auto-detect route destination from active trip log/details
    let parsedDetails = unit.details;
    if (typeof parsedDetails === 'string') {
        try { parsedDetails = JSON.parse(parsedDetails); } catch(err) { parsedDetails = {}; }
    }
    parsedDetails = parsedDetails || {};

    const destNameInput = document.getElementById('alert-destination');
    const atcMsgInput = document.getElementById('alert-atc-msg');

    // Auto load ATC trip specific comments
    let tripComments = parsedDetails.comments || '';
    let cliente = parsedDetails.cliente || '';
    let viaje = parsedDetails.viaje || parsedDetails.bol || '';
    
    let defaultATCText = `[ATC LOGÍSTICA] Unidad: ${unit.economic_number} | Cliente: ${cliente || 'N/A'} | Viaje: ${viaje || 'N/A'}`;
    if (tripComments) {
        defaultATCText += ` | Instrucciones: ${tripComments}`;
    } else {
        defaultATCText += ` | Reportar hora de ingreso a patio y rampa asignada.`;
    }
    if (atcMsgInput) atcMsgInput.value = defaultATCText;

    // Determine target location string (e.g. CDMX)
    let destString = '';
    if (parsedDetails.destino) {
        // Destination can be comma/pipe separated. Grab the final destination
        const dests = parsedDetails.destino.split(' | ').filter(v=>v);
        destString = dests[dests.length - 1] || '';
    } else if (parsedDetails.route && parsedDetails.route.includes('-')) {
        const parts = parsedDetails.route.split('-');
        destString = parts[parts.length - 1].trim();
    }

    if (destString && destString !== '---') {
        if (destNameInput) destNameInput.value = destString;
        
        // Use maps geocoder to fetch the coordinates of this text automatically!
        if (typeof google === 'object' && google.maps) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: destString + ", Mexico" }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const lat = results[0].geometry.location.lat();
                    const lng = results[0].geometry.location.lng();
                    alertState.selectedAutocompleteCoords = { lat, lng, name: destString };
                    document.getElementById('alert-coords-preview').innerText = `Coordenadas: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
                    
                    // Center maps
                    if (alertState.activeMap) {
                        alertState.activeMap.setCenter({ lat, lng });
                        alertState.activeMap.setZoom(10);
                    }
                    updateCirclesOnMap();
                }
            });
        }
    } else {
        if (destNameInput) destNameInput.value = '';
        alertState.selectedAutocompleteCoords = null;
        document.getElementById('alert-coords-preview').innerText = `Coordenadas: No seleccionadas`;
    }
}

// Periodic check loop for GPS updates
async function fetchSamsaraUpdatesAndEvaluate() {
    try {
        const samsaraLocations = await fetchSamsaraLocations();
        alertState.samsaraLocations = samsaraLocations || [];
        
        evaluateProximityAndRender();
        updateMapMarkers();
    } catch(err) {
        console.warn("Real-time GPS update loop encountered an error:", err);
    }
}

// Compute distance using Haversine formula
function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

// Clean and format phone numbers for WhatsApp
function formatWhatsAppPhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) {
        cleaned = '52' + cleaned;
    }
    return cleaned;
}

// Proximity checker & interface renderer
function evaluateProximityAndRender() {
    // Keep track of counts
    let activeCount = 0;
    let triggeredCount = 0;
    let sentCount = 0;

    let html = '';
    alertState.alerts.forEach(alert => {
        const unit = alertState.units.find(u => u.id === alert.unit_id);
        const unitNum = unit ? unit.economic_number : 'S/U';
        const operatorName = unit?.operators?.name || 'Sin Operador';
        
        // Find match in Samsara or Simulator
        let lat = null;
        let lng = null;
        let speed = 0;
        let isSimulated = false;

        if (alertState.simulatedPositions[alert.unit_id]) {
            lat = alertState.simulatedPositions[alert.unit_id].lat;
            lng = alertState.simulatedPositions[alert.unit_id].lng;
            speed = 0;
            isSimulated = true;
        } else {
            // Find in Samsara
            const samsaraMatch = alertState.samsaraLocations.find(s => 
                s.name.includes(unitNum) || (unit?.placas && s.name.includes(unit?.placas))
            );
            if (samsaraMatch && samsaraMatch.location) {
                lat = samsaraMatch.location.latitude;
                lng = samsaraMatch.location.longitude;
                speed = samsaraMatch.location.speed || 0;
            }
        }

        let gpsLocationStr = 'Sin Señal GPS';
        let distanceStr = 'N/A';
        let distanceKm = 9999;

        if (lat !== null && lng !== null) {
            gpsLocationStr = `<div class="font-mono text-xs">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
                              <div class="text-[10px] text-slate-400 font-bold">${speed.toFixed(1)} km/h ${isSimulated ? '<span class="text-amber-500 font-bold bg-amber-50 px-1 rounded">SIMULADO</span>' : ''}</div>`;
            
            // Calculate distance to target destination coordinates
            distanceKm = getDistanceKm(lat, lng, Number(alert.latitude), Number(alert.longitude));
            distanceStr = `<span class="font-bold text-indigo-700">${distanceKm.toFixed(2)} km</span>`;
        }

        // Eval trigger condition
        if (alert.status === 'Programada' && lat !== null && lng !== null && distanceKm <= Number(alert.radius_km)) {
            alert.status = 'Disparada';
            alert.triggered_at = new Date().toISOString();
            if (alertState.useLocalStorageFallback) {
                // Save updated array to localstorage
                localStorage.setItem('whatsapp_gps_alerts', JSON.stringify(alertState.alerts));
                fireWhatsAppDispatcherModal(alert.id);
            } else {
                supabase.from('whatsapp_gps_alerts')
                    .update({ status: 'Disparada', triggered_at: new Date().toISOString() })
                    .eq('id', alert.id)
                    .then(({ error }) => {
                        if (error) console.error("Error updating trigger state:", error);
                        else {
                            // Play alert sound if wanted, notify UI
                            fireWhatsAppDispatcherModal(alert.id);
                        }
                    });
            }
        }

        // Stats classification
        if (alert.status === 'Programada') activeCount++;
        if (alert.status === 'Disparada') triggeredCount++;
        if (alert.status === 'Enviada') sentCount++;

        // Status Badge Styling
        let statusBadge = '';
        if (alert.status === 'Programada') {
            statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1.5 w-max">
                <span class="status-dot dot-yellow"></span> En Tránsito
            </span>`;
        } else if (alert.status === 'Disparada') {
            statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 animate-pulse flex items-center gap-1.5 w-max cursor-pointer" onclick="window.openDispatcherModal('${alert.id}')">
                <span class="status-dot dot-red"></span> ¡Por Enviar!
            </span>`;
        } else if (alert.status === 'Enviada') {
            statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 w-max">
                <span class="status-dot dot-green"></span> Enviada
            </span>`;
        } else {
            statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5 w-max">
                ${alert.status}
            </span>`;
        }

        html += `
            <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                <td class="p-4">
                    <div class="font-bold text-slate-800">${unitNum}</div>
                    <div class="text-[10px] text-slate-400 font-bold">${operatorName}</div>
                </td>
                <td class="p-4">${gpsLocationStr}</td>
                <td class="p-4">
                    <div class="font-bold text-slate-700">${alert.destination_name}</div>
                    <div class="text-[10px] text-slate-400 font-mono">Radio: ${alert.radius_km} km</div>
                </td>
                <td class="p-4">${distanceStr}</td>
                <td class="p-4">${statusBadge}</td>
                <td class="p-4 text-right">
                    <div class="flex justify-end gap-1.5">
                        ${alert.status === 'Disparada' ? `
                            <button onclick="window.openDispatcherModal('${alert.id}')" class="bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-1.5 px-3 rounded-lg shadow-md active:scale-95 transition flex items-center gap-1">
                                <i class="fab fa-whatsapp"></i> Despachar
                            </button>
                        ` : ''}
                        <button onclick="window.zoomAlertMap('${alert.latitude}', '${alert.longitude}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-2 rounded-lg transition" title="Ver en Mapa">
                            <i class="fas fa-search-location"></i>
                        </button>
                        <button onclick="window.deleteGPSAlert('${alert.id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 rounded-lg transition" title="Eliminar Alerta">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    const tbody = document.getElementById('gps-alerts-body');
    if (tbody) {
        if (alertState.alerts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">No hay alertas de GPS programadas. Crea una usando el formulario lateral.</td></tr>`;
        } else {
            tbody.innerHTML = html;
        }
    }
    updateStats(activeCount, triggeredCount, sentCount, alertState.samsaraLocations.length);
}

// Update stats headers
function updateStats(active, triggered, sent, gpsTracked) {
    const elActive = document.getElementById('stat-active-alerts');
    const elTriggered = document.getElementById('stat-triggered-alerts');
    const elSent = document.getElementById('stat-sent-alerts');
    const elTracked = document.getElementById('stat-tracked-units');

    if (elActive) elActive.innerText = active;
    if (elTriggered) elTriggered.innerText = triggered;
    if (elSent) elSent.innerText = sent;
    if (elTracked) elTracked.innerText = gpsTracked;
}

// Create new Alert Form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Creando...';

    const unitId = document.getElementById('alert-unit-id').value;
    const destName = document.getElementById('alert-destination').value;
    const radius = Number(document.getElementById('alert-radius').value);
    const atcMsg = document.getElementById('alert-atc-msg').value;
    const qualityMsg = document.getElementById('alert-quality-msg').value;

    const opPhone = document.getElementById('alert-phone-operator').value.trim();
    const m1 = document.getElementById('alert-phone-m1').value.trim();
    const m2 = document.getElementById('alert-phone-m2').value.trim();
    const m3 = document.getElementById('alert-phone-m3').value.trim();
    const wGroup = document.getElementById('alert-whatsapp-group').value.trim();

    let coords = alertState.selectedAutocompleteCoords;
    if (!coords && destName.trim()) {
        // Fallback to geocoding the entered text directly (handles cases where autocomplete didn't register or was blocked)
        coords = await new Promise((resolve) => {
            if (typeof google === 'object' && google.maps) {
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ address: destName.trim() + ", Mexico" }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        resolve({
                            lat: results[0].geometry.location.lat(),
                            lng: results[0].geometry.location.lng(),
                            name: destName.trim()
                        });
                    } else {
                        resolve(null);
                    }
                });
            } else {
                resolve(null);
            }
        });
    }

    if (!coords) {
        // If still no coordinates, use a safe fallback (unit's simulated position or current position or CDMX center)
        let lat = 19.4326;
        let lng = -99.1332;
        if (alertState.simulatedPositions[unitId]) {
            lat = alertState.simulatedPositions[unitId].lat;
            lng = alertState.simulatedPositions[unitId].lng;
        } else {
            const unit = alertState.units.find(u => u.id === unitId);
            const unitNum = unit ? unit.economic_number : '';
            const samsaraMatch = alertState.samsaraLocations.find(s => 
                s.name.includes(unitNum) || (unit?.placas && s.name.includes(unit?.placas))
            );
            if (samsaraMatch && samsaraMatch.location) {
                lat = samsaraMatch.location.latitude;
                lng = samsaraMatch.location.longitude;
            }
        }
        coords = {
            lat,
            lng,
            name: destName || 'Destino Predeterminado'
        };
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Coordenadas Aproximadas',
            text: 'No se geolocalizó con precisión el destino. Se usó una ubicación de aproximación.',
            showConfirmButton: false,
            timer: 3000
        });
    }

    const recipients = [];
    if (opPhone) recipients.push({ name: 'Operador', phone: formatWhatsAppPhone(opPhone) });
    if (m1) recipients.push({ name: 'Contacto Ruta 1', phone: formatWhatsAppPhone(m1) });
    if (m2) recipients.push({ name: 'Contacto Ruta 2', phone: formatWhatsAppPhone(m2) });
    if (m3) recipients.push({ name: 'Contacto Ruta 3', phone: formatWhatsAppPhone(m3) });
    if (wGroup) recipients.push({ name: 'Grupo Whatsapp', phone: wGroup, isGroup: true });

    const payload = {
        unit_id: unitId,
        destination_name: coords.name,
        latitude: coords.lat,
        longitude: coords.lng,
        radius_km: radius,
        atc_message: atcMsg,
        quality_message: qualityMsg,
        recipients: recipients,
        status: 'Programada'
    };

    let success = false;
    if (alertState.useLocalStorageFallback) {
        const newAlert = {
            id: 'local_' + Math.random().toString(36).substr(2, 9),
            ...payload,
            created_at: new Date().toISOString()
        };
        alertState.alerts.unshift(newAlert);
        localStorage.setItem('whatsapp_gps_alerts', JSON.stringify(alertState.alerts));
        success = true;
    } else {
        const { error } = await supabase.from('whatsapp_gps_alerts').insert([payload]);
        if (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        } else {
            success = true;
        }
    }

    if (success) {
        Swal.fire({
            icon: 'success',
            title: 'Alerta Programada',
            text: `Monitoreo GPS iniciado para la unidad rumbo a ${payload.destination_name}.`,
            confirmButtonColor: '#4f46e5'
        });
        // Clear fields
        document.getElementById('alert-unit-id').value = '';
        document.getElementById('alert-destination').value = '';
        document.getElementById('alert-phone-operator').value = '';
        document.getElementById('alert-phone-m1').value = '';
        document.getElementById('alert-phone-m2').value = '';
        document.getElementById('alert-phone-m3').value = '';
        document.getElementById('alert-whatsapp-group').value = '';
        alertState.selectedAutocompleteCoords = null;
        document.getElementById('alert-coords-preview').innerText = 'Coordenadas: No seleccionadas';

        await loadGPSAlertsData();
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> PROGRAMAR MONITOREO';
}

// Global actions exposed to window
window.deleteGPSAlert = async function(id) {
    const result = await Swal.fire({
        title: '¿Eliminar Monitoreo?',
        text: "Se detendrá el seguimiento satelital de esta alerta.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        let success = false;
        if (alertState.useLocalStorageFallback) {
            alertState.alerts = alertState.alerts.filter(a => a.id !== id);
            localStorage.setItem('whatsapp_gps_alerts', JSON.stringify(alertState.alerts));
            success = true;
        } else {
            const { error } = await supabase.from('whatsapp_gps_alerts').delete().eq('id', id);
            if (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: error.message });
            } else {
                success = true;
            }
        }

        if (success) {
            Swal.fire({ icon: 'success', title: 'Eliminado', text: 'Alerta cancelada.', confirmButtonColor: '#4f46e5' });
            loadGPSAlertsData();
        }
    }
};

window.zoomAlertMap = function(lat, lng) {
    const mapsEl = document.getElementById('gps-alerts-map');
    if (mapsEl) {
        mapsEl.scrollIntoView({ behavior: 'smooth' });
    }
    if (alertState.activeMap) {
        const coords = { lat: Number(lat), lng: Number(lng) };
        alertState.activeMap.setCenter(coords);
        alertState.activeMap.setZoom(11);
    }
};

// Open WhatsApp dispatcher popup manually
window.openDispatcherModal = function(id) {
    fireWhatsAppDispatcherModal(id);
};

// Real-time WhatsApp Dispatcher popup modal
async function fireWhatsAppDispatcherModal(alertId) {
    // Retrieve alert data
    const alert = alertState.alerts.find(a => a.id === alertId);
    if (!alert) return;

    const unit = alertState.units.find(u => u.id === alert.unit_id);
    const unitNum = unit ? unit.economic_number : 'S/U';
    const operatorName = unit?.operators?.name || 'Sin Asignar';

    // Build the messages
    const atcMsg = alert.atc_message || '';
    const qualMsg = alert.quality_message || '';
    const fullMessage = `🚨 *NOTIFICACIÓN DE ARRIBADA GPS* 🚨\n\n🚛 *Unidad:* ${unitNum}\n👤 *Operador:* ${operatorName}\n📍 *Destino:* ${alert.destination_name}\n\n====================\n💬 *INSTRUCCIONES ATC:*\n${atcMsg}\n\n====================\n⭐ *CALIDAD Y SEGURO YORO:*\n${qualMsg}`;

    // Auto Webhook trigger check with DOM guards
    const webhookEl = document.getElementById('webhook-enabled');
    const webhookUrlEl = document.getElementById('webhook-url');
    const isWebhookActive = webhookEl ? webhookEl.checked : false;
    const webhookUrl = webhookUrlEl ? webhookUrlEl.value.trim() : '';

    if (isWebhookActive && webhookUrl) {
        console.log("GPS-MONITOR: Webhook automation is active. Calling URL:", webhookUrl);
        
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    event: 'gps_alert_arrival',
                    unit: unitNum,
                    operator: operatorName,
                    destination: alert.destination_name,
                    atc_message: atcMsg,
                    quality_message: qualMsg,
                    full_text: fullMessage,
                    recipients: alert.recipients,
                    timestamp: new Date().toISOString()
                })
            });

            console.log("GPS-MONITOR: Webhook call response status:", response.status);
            // Automatically transition status to sent
            if (alertState.useLocalStorageFallback) {
                alertState.alerts = alertState.alerts.map(a => a.id === alert.id ? { ...a, status: 'Enviada' } : a);
                localStorage.setItem('whatsapp_gps_alerts', JSON.stringify(alertState.alerts));
            } else {
                await supabase.from('whatsapp_gps_alerts')
                    .update({ status: 'Enviada' })
                    .eq('id', alert.id);
            }

            Swal.fire({
                icon: 'success',
                title: 'Alerta Enviada (Automatizado)',
                html: `La unidad <b>${unitNum}</b> ingresó a la geocerca de <b>${alert.destination_name}</b> y la alerta se despachó automáticamente al Webhook.`,
                confirmButtonColor: '#10b981'
            });
            
            loadGPSAlertsData();
            return;
        } catch(err) {
            console.error("Failed to automatically post to webhook:", err);
            // Fallback to manual dispatcher modal on failure
        }
    }

    // Modal elements
    const recipientsHtml = alert.recipients.map((rec, i) => {
        const escapedMsg = encodeURIComponent(fullMessage);
        let cleanedPhone = rec.phone.replace(/[^0-9]/g, '');
        if (cleanedPhone.length === 10) {
            cleanedPhone = '52' + cleanedPhone;
        }
        let link = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${escapedMsg}`;
        if (rec.isGroup) {
            // Group link or direct share
            link = rec.phone.startsWith('http') ? rec.phone : `https://api.whatsapp.com/send?text=${escapedMsg}`;
        }
        return `
            <div class="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition">
                <div class="flex items-center gap-2">
                    <span class="h-6 w-6 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold">${i+1}</span>
                    <div>
                        <div class="text-xs font-bold text-slate-700">${rec.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${rec.phone}</div>
                    </div>
                </div>
                <a href="${link}" target="_blank" onclick="markRecipientDispatched(this)" class="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 transition active:scale-95">
                    <i class="fab fa-whatsapp"></i> Enviar
                </a>
            </div>
        `;
    }).join('');

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] fade-in';
    modal.id = `dispatcher-modal-${alert.id}`;
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 w-[36rem] shadow-2xl border border-gray-100 flex flex-col max-h-[85vh]">
            <div class="flex justify-between items-center border-b pb-3 mb-4">
                <h3 class="text-lg font-black text-rose-600 flex items-center gap-2">
                    <i class="fas fa-bell animate-pulse text-xl"></i> LLEGADA DETECTADA POR GPS
                </h3>
                <button onclick="document.getElementById('dispatcher-modal-${alert.id}').remove()" class="text-slate-400 hover:text-slate-600 text-lg transition"><i class="fas fa-times"></i></button>
            </div>
            
            <div class="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                <div class="bg-rose-50 p-4 rounded-xl border border-rose-100">
                    <p class="text-xs text-rose-800 font-medium">La unidad <b>${unitNum}</b> (Operador: ${operatorName}) ha ingresado al radio de <b>${alert.radius_km} km</b> de la localidad de <b>${alert.destination_name}</b>.</p>
                </div>

                <!-- Text message previews -->
                <div class="space-y-1.5">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vista Previa de Alerta (WhatsApp)</label>
                    <div class="bg-emerald-50 text-slate-700 text-xs font-medium p-4 rounded-xl border border-emerald-100 whitespace-pre-wrap font-mono">${fullMessage}</div>
                </div>

                <!-- Recipient buttons -->
                <div class="space-y-2">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enviar por WhatsApp a Destinatarios</label>
                    <div class="grid grid-cols-1 gap-2">
                        ${recipientsHtml.length > 0 ? recipientsHtml : '<div class="text-xs text-slate-400 italic">No hay números registrados para esta alerta.</div>'}
                    </div>
                </div>
            </div>

            <div class="mt-6 pt-4 border-t flex items-center justify-between gap-3">
                <button onclick="window.copyToClipboard('${encodeURIComponent(fullMessage)}')" class="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2.5 px-4 rounded-xl transition active:scale-95 flex items-center gap-1.5">
                    <i class="far fa-copy"></i> Copiar Texto Completo
                </button>
                <div class="flex gap-2">
                    <button onclick="document.getElementById('dispatcher-modal-${alert.id}').remove()" class="px-4 py-2.5 font-bold text-xs text-slate-500 hover:bg-slate-50 rounded-xl transition">Cerrar</button>
                    <button onclick="window.markAlertAsSent('${alert.id}')" class="px-5 py-2.5 font-bold text-xs bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-600/20 active:scale-95 transition flex items-center gap-1.5">
                        <i class="fas fa-check-circle"></i> Completar y Registrar Envío
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Click callback on WhatsApp links
window.markRecipientDispatched = function(anchor) {
    anchor.classList.remove('bg-emerald-500', 'hover:bg-emerald-600');
    anchor.classList.add('bg-slate-200', 'text-slate-600');
    anchor.innerHTML = `<i class="fas fa-check"></i> Enviado`;
};

window.copyToClipboard = function(escapedStr) {
    const text = decodeURIComponent(escapedStr);
    navigator.clipboard.writeText(text).then(() => {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Copiado al portapapeles',
            showConfirmButton: false,
            timer: 1500
        });
    });
};

// Transition alert status to Sent
window.markAlertAsSent = async function(id) {
    let success = false;
    if (alertState.useLocalStorageFallback) {
        alertState.alerts = alertState.alerts.map(a => a.id === id ? { ...a, status: 'Enviada' } : a);
        localStorage.setItem('whatsapp_gps_alerts', JSON.stringify(alertState.alerts));
        success = true;
    } else {
        const { error } = await supabase.from('whatsapp_gps_alerts')
            .update({ status: 'Enviada' })
            .eq('id', id);
        if (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        } else {
            success = true;
        }
    }

    if (success) {
        const modal = document.getElementById(`dispatcher-modal-${id}`);
        if (modal) modal.remove();

        Swal.fire({
            icon: 'success',
            title: 'Alerta Enviada',
            text: 'Se ha registrado la alerta como enviada con éxito.',
            confirmButtonColor: '#4f46e5'
        });

        await loadGPSAlertsData();
    }
};

// -------------------------------------------------------------
// Google Maps rendering & real-time plotting
// -------------------------------------------------------------
function initGoogleMap() {
    const mapEl = document.getElementById('gps-alerts-map');
    const loadingEl = document.getElementById('map-loading');
    if (!mapEl) return;

    try {
        if (typeof google === 'object' && google.maps) {
            // Center around standard coordinates in Mexico (Querétaro center)
            const mapOptions = {
                center: { lat: 20.5888, lng: -100.3899 },
                zoom: 6,
                mapId: "SAMSARA_ALERTS_MAP",
                mapTypeControl: false,
                streetViewControl: false
            };

            alertState.activeMap = new google.maps.Map(mapEl, mapOptions);
            if (loadingEl) loadingEl.remove();

            // Setup map click listener for simulation
            alertState.activeMap.addListener('click', handleMapClickForSimulation);

            // Populate Map initially
            updateMapMarkers();
        }
    } catch(err) {
        console.error("Google maps failed to load in view:", err);
        mapEl.innerHTML = `<div class="p-8 text-center text-red-500 font-bold"><i class="fas fa-exclamation-triangle"></i> No se pudo iniciar Google Maps en esta vista.</div>`;
    }
}

// Redraw all markers and geofence circles on the map
function updateMapMarkers() {
    if (!alertState.activeMap) return;

    // 1. Remove obsolete markers
    Object.keys(alertState.mapMarkers).forEach(key => {
        alertState.mapMarkers[key].setMap(null);
    });
    alertState.mapMarkers = {};

    // Remove old circles
    Object.keys(alertState.geofenceCircles).forEach(key => {
        alertState.geofenceCircles[key].setMap(null);
    });
    alertState.geofenceCircles = {};

    // 2. Draw Geofence Destinations
    alertState.alerts.forEach(alert => {
        if (alert.status !== 'Enviada' && alert.status !== 'Cancelada') {
            const destPos = { lat: Number(alert.latitude), lng: Number(alert.longitude) };
            
            // Draw Target Pin
            const destMarker = new google.maps.Marker({
                position: destPos,
                map: alertState.activeMap,
                title: `Destino: ${alert.destination_name}`,
                icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/red-pushpin.png'
                }
            });
            alertState.mapMarkers[`dest_${alert.id}`] = destMarker;

            // Draw circular geofence
            const geofenceCircle = new google.maps.Circle({
                strokeColor: "#4F46E5",
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: "#4F46E5",
                fillOpacity: 0.15,
                map: alertState.activeMap,
                center: destPos,
                radius: Number(alert.radius_km) * 1000 // Convert km to meters
            });
            alertState.geofenceCircles[alert.id] = geofenceCircle;
        }
    });

    // 3. Draw Live Units positions (from Samsara or Simulator)
    alertState.units.forEach(unit => {
        let lat = null;
        let lng = null;
        let isSimulated = false;

        if (alertState.simulatedPositions[unit.id]) {
            lat = alertState.simulatedPositions[unit.id].lat;
            lng = alertState.simulatedPositions[unit.id].lng;
            isSimulated = true;
        } else {
            // Find in Samsara locations list
            const match = alertState.samsaraLocations.find(s => 
                s.name.includes(unit.economic_number) || (unit.placas && s.name.includes(unit.placas))
            );
            if (match && match.location) {
                lat = match.location.latitude;
                lng = match.location.longitude;
            }
        }

        if (lat !== null && lng !== null) {
            const unitPos = { lat, lng };

            // Dynamic color/icon depending on simulator
            const pinColor = isSimulated ? 'orange' : 'blue';
            const marker = new google.maps.Marker({
                position: unitPos,
                map: alertState.activeMap,
                title: `${unit.economic_number} - ${unit.operators?.name || 'S/O'}`,
                label: {
                    text: unit.economic_number,
                    color: "white",
                    fontWeight: "bold",
                    fontSize: "11px"
                },
                icon: {
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 6,
                    strokeColor: "white",
                    strokeWeight: 2,
                    fillColor: pinColor,
                    fillOpacity: 0.9,
                }
            });

            // Double click marker to open simulation helper
            marker.addListener('dblclick', () => {
                const simSelect = document.getElementById('sim-unit-select');
                if (simSelect) {
                    simSelect.value = unit.id;
                    const panel = document.getElementById('sim-control-panel');
                    panel.classList.remove('hidden');
                }
            });

            alertState.mapMarkers[`unit_${unit.id}`] = marker;
        }
    });
}

// Adjust geofence sizes dynamically when slider changes
function updateCirclesOnMap() {
    const currentRadius = Number(document.getElementById('alert-radius').value) * 1000;
    
    // If a destination was selected or geocoded, show geofence preview
    if (alertState.selectedAutocompleteCoords && alertState.activeMap) {
        const previewKey = 'preview_geofence';
        if (alertState.geofenceCircles[previewKey]) {
            alertState.geofenceCircles[previewKey].setMap(null);
        }

        const circle = new google.maps.Circle({
            strokeColor: "#e11d48",
            strokeOpacity: 0.7,
            strokeWeight: 1,
            fillColor: "#e11d48",
            fillOpacity: 0.1,
            map: alertState.activeMap,
            center: alertState.selectedAutocompleteCoords,
            radius: currentRadius
        });
        alertState.geofenceCircles[previewKey] = circle;
    }
}

// -------------------------------------------------------------
// GPS Simulation & Testing Engine
// -------------------------------------------------------------

// Mouse click listener to position simulated vehicle
function handleMapClickForSimulation(event) {
    const simPanel = document.getElementById('sim-control-panel');
    if (!simPanel || simPanel.classList.contains('hidden')) return; // Simulator inactive

    const unitId = document.getElementById('sim-unit-select').value;
    if (!unitId) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: 'Seleccione unidad primero',
            text: 'Por favor, selecciona qué unidad quieres mover en la caja de control del simulador.',
            showConfirmButton: false,
            timer: 2500
        });
        return;
    }

    const clickedLat = event.latLng.lat();
    const clickedLng = event.latLng.lng();

    // Position marker
    alertState.simulatedPositions[unitId] = { lat: clickedLat, lng: clickedLng };

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Posición Simulada',
        text: `Unidad posicionada en ${clickedLat.toFixed(5)}, ${clickedLng.toFixed(5)}`,
        showConfirmButton: false,
        timer: 2000
    });

    evaluateProximityAndRender();
    updateMapMarkers();
}

// Forces simulated vehicle to arrive instantly at coordinates
function triggerManualArrival() {
    const unitId = document.getElementById('sim-unit-select').value;
    if (!unitId) return alert("Seleccione unidad a simular.");

    // Find any alerts active for this unit
    const alert = alertState.alerts.find(a => a.unit_id === unitId && a.status === 'Programada');
    if (!alert) {
        return Swal.fire({
            icon: 'info',
            title: 'Sin Alertas Programadas',
            text: 'Esta unidad no tiene alertas en estatus "En Tránsito". Programe una primero para probar la llegada.',
            confirmButtonColor: '#4f46e5'
        });
    }

    // Set simulated coordinates right inside geofence boundary (0.5 km offset)
    const lat = Number(alert.latitude) + 0.003;
    const lng = Number(alert.longitude) + 0.003;

    alertState.simulatedPositions[unitId] = { lat, lng };

    Swal.fire({
        icon: 'success',
        title: 'Llegada Forzada',
        text: `Unidad movida dentro del radio de geocerca de ${alert.destination_name}. Evaluando proximidad...`,
        confirmButtonColor: '#4f46e5'
    });

    evaluateProximityAndRender();
    updateMapMarkers();
}

// Shared function to create or update GPS alert from assignments/trip logs
window.syncGPSAlertForUnit = async function(unitId, unitNum, destinationName, atcComments, opPhone, m1, m2, m3, wGroup) {
    if (!destinationName || destinationName === '---') return;

    try {
        let lat = 19.4326;
        let lng = -99.1332;
        let coordsFetched = false;

        if (typeof google === 'object' && google.maps) {
            const geocoder = new google.maps.Geocoder();
            await new Promise((resolve) => {
                geocoder.geocode({ address: destinationName + ", Mexico" }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        lat = results[0].geometry.location.lat();
                        lng = results[0].geometry.location.lng();
                        coordsFetched = true;
                    } else {
                        console.warn(`GPS-MONITOR: Geocoding failed for ${destinationName} (Status: ${status}). Using default/current fallback.`);
                    }
                    resolve();
                });
            });
        }

        if (!coordsFetched) {
            // Check if the unit has simulated coordinates or live position
            if (alertState.simulatedPositions[unitId]) {
                lat = alertState.simulatedPositions[unitId].lat;
                lng = alertState.simulatedPositions[unitId].lng;
            } else {
                const unit = alertState.units.find(u => u.id === unitId);
                const economicNum = unit ? unit.economic_number : '';
                const samsaraMatch = alertState.samsaraLocations.find(s => 
                    s.name.includes(economicNum) || (unit?.placas && s.name.includes(unit?.placas))
                );
                if (samsaraMatch && samsaraMatch.location) {
                    lat = samsaraMatch.location.latitude;
                    lng = samsaraMatch.location.longitude;
                }
            }
        }

        const recipients = [];
        if (opPhone) recipients.push({ name: 'Operador', phone: formatWhatsAppPhone(opPhone) });
        if (m1) recipients.push({ name: 'Contacto Ruta 1', phone: formatWhatsAppPhone(m1) });
        if (m2) recipients.push({ name: 'Contacto Ruta 2', phone: formatWhatsAppPhone(m2) });
        if (m3) recipients.push({ name: 'Contacto Ruta 3', phone: formatWhatsAppPhone(m3) });
        if (wGroup) recipients.push({ name: 'Grupo Whatsapp', phone: wGroup, isGroup: true });

        const payload = {
            unit_id: unitId,
            destination_name: destinationName,
            latitude: lat,
            longitude: lng,
            radius_km: 15.0,
            atc_message: atcComments,
            quality_message: DEFAULT_QUALITY_MSG,
            recipients: recipients,
            status: 'Programada'
        };

        const useLocal = alertState.useLocalStorageFallback || (localStorage.getItem('db-warning-banner') !== null);

        if (useLocal) {
            let localAlerts = JSON.parse(localStorage.getItem('whatsapp_gps_alerts') || '[]');
            const existingIdx = localAlerts.findIndex(a => a.unit_id === unitId);
            if (existingIdx !== -1) {
                localAlerts[existingIdx] = { 
                    ...localAlerts[existingIdx], 
                    ...payload, 
                    status: 'Programada',
                    triggered_at: null 
                };
            } else {
                localAlerts.unshift({ 
                    id: 'local_' + Math.random().toString(36).substr(2, 9), 
                    ...payload, 
                    created_at: new Date().toISOString() 
                });
            }
            localStorage.setItem('whatsapp_gps_alerts', JSON.stringify(localAlerts));
            console.log("GPS-MONITOR: Synced alert in localStorage.");
        } else {
            // Check in Supabase first
            const { data: existing, error: fetchErr } = await supabase.from('whatsapp_gps_alerts')
                .select('id')
                .eq('unit_id', unitId)
                .maybeSingle();

            if (!fetchErr) {
                if (existing) {
                    await supabase.from('whatsapp_gps_alerts')
                        .update({ ...payload, status: 'Programada', triggered_at: null })
                        .eq('id', existing.id);
                    console.log("GPS-MONITOR: Synced/updated alert in Supabase.");
                } else {
                    await supabase.from('whatsapp_gps_alerts')
                        .insert([payload]);
                    console.log("GPS-MONITOR: Synced/created new alert in Supabase.");
                }
            } else {
                // Fallback if table doesn't exist
                let localAlerts = JSON.parse(localStorage.getItem('whatsapp_gps_alerts') || '[]');
                const existingIdx = localAlerts.findIndex(a => a.unit_id === unitId);
                if (existingIdx !== -1) {
                    localAlerts[existingIdx] = { ...localAlerts[existingIdx], ...payload, status: 'Programada', triggered_at: null };
                } else {
                    localAlerts.unshift({ id: 'local_' + Math.random().toString(36).substr(2, 9), ...payload, created_at: new Date().toISOString() });
                }
                localStorage.setItem('whatsapp_gps_alerts', JSON.stringify(localAlerts));
                console.log("GPS-MONITOR: Fallback synced alert in localStorage.");
            }
        }

        // Force reload and evaluate geofence proximity immediately
        await loadGPSAlertsData();
    } catch(err) {
        console.error("Failed to sync GPS alert:", err);
    }
};
