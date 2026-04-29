// assets/js/modules/dashboard.js
import { supabase } from '../services/supabaseClient.js';
import { formatDate, calculateTimeElapsed, formatCurrency, calculateFinancialLoss } from '../utils/formatters.js';
import { fetchSamsaraLocations } from '../services/samsara.js';
import { GOOGLE_API_KEY } from '../config/config.js'; // Added import for GOOGLE_API_KEY

const geoCache = new Map();
let updateInterval; 
let transitionInterval;
let currentPage = 0;
const ITEMS_PER_PAGE = 8;
let samsaraData = [];

async function reverseGeocode(lat, lng, elementId) {
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (geoCache.has(key)) {
        const el = document.getElementById(elementId);
        if (el) el.innerText = geoCache.get(key);
        return;
    }

    if (!window.google || !window.google.maps || !window.google.maps.Geocoder) return;

    const geocoder = new window.google.maps.Geocoder();
    try {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results[0]) {
                // Try to get a short locality or route
                let shortAddress = results[0].formatted_address.split(',').slice(0, 2).join(', ');
                const localityMatch = results.find(r => r.types.includes('locality') || r.types.includes('sublocality') || r.types.includes('route'));
                if (localityMatch) shortAddress = localityMatch.formatted_address.split(',')[0];

                geoCache.set(key, shortAddress);
                const el = document.getElementById(elementId);
                if (el) el.innerText = shortAddress;
            } else {
                geoCache.set(key, 'GPS Activo');
                const el = document.getElementById(elementId);
                if (el) el.innerText = 'GPS Activo';
            }
        });
    } catch(e) {
        console.error("Geocoding Error", e);
    }
}

export async function renderDashboard(container) {
    if (updateInterval) clearInterval(updateInterval);
    if (transitionInterval) clearInterval(transitionInterval);

    container.innerHTML = `
        <div id="view-dashboard" class="p-6 fade-in">
            <!-- Filtros -->
            <div class="mb-6 flex gap-4 bg-white p-4 rounded-lg shadow-sm">
                <select id="filter-type" class="border p-2 rounded w-1/4">
                    <option value="all">Todas las Unidades</option>
                    <option value="Madrina">Madrinas</option>
                    <option value="Pipa">Pipas</option>
                    <option value="Contenedor">Contenedores</option>
                </select>
                <select id="filter-status" class="border p-2 rounded w-1/4">
                    <option value="all">Todos los Estatus</option>
                    <option value="Vacia">Vacía</option>
                    <option value="Cargada">Cargada</option>
                    <option value="En Taller">En Taller</option>
                    <option value="Transito">En Tránsito</option>
                </select>
                <div class="flex-1 text-right flex items-center justify-end gap-2">
                    <span id="page-indicator" class="text-xs font-bold text-gray-400 bg-gray-800 px-2 py-1 rounded">PAGINA 1/1</span>
                    <span id="next-refresh" class="text-xs font-bold text-orange-500 bg-black px-2 py-1 rounded">PROX. CAMBIO: 60s</span>
                </div>
            </div>

            <!-- TABLA OPERACIONES -->
            <div class="overflow-hidden rounded-lg shadow-2xl bg-black airport-board">
                <div class="grid grid-cols-10 airport-header p-3 text-[10px] md:text-sm font-bold text-center">
                    <div class="col-span-1 text-left">TIPO</div>
                    <div class="col-span-1">CLIENTE</div>
                    <div class="col-span-1">ECO #</div>
                    <div class="col-span-1">PLACAS</div>
                    <div class="col-span-1">ESTATUS</div>
                    <div class="col-span-1 text-left pl-4">OPERADOR</div>
                    <div class="col-span-1">RUTA</div>
                    <div class="col-span-1">UBICACIÓN</div>
                    <div class="col-span-2 text-right">TIEMPO ACTUAL (REAL)</div>
                </div>
                <div id="airport-board-body" class="min-h-[400px]">
                    <div class="p-4 text-center text-gray-500"><div class="spinner"></div> Cargando datos en tiempo real...</div>
                </div>
            </div>
            
            <div class="mt-4 text-xs text-gray-500 flex gap-4 mb-6">
                <span>* Semáforo Tiempos:</span>
                <span class="text-green-600 font-bold">● En Ruta (Productivo)</span>
                <span class="text-red-600 font-bold">● Pérdida (>24h Vacia/Taller)</span>
                <span class="text-yellow-600 font-bold">● Atencíon (12-24h Vacia/Taller)</span>
                <span class="ml-auto text-blue-500 font-bold italic">* Sincronizado con Samsara API</span>
            </div>

            <!-- SMART ASSISTANT & SHIFT NOTES -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                
                <!-- Cambio de Turno -->
                <div class="bg-gray-800/80 backdrop-blur-md rounded-xl p-5 border border-gray-700/50 shadow-xl flex flex-col">
                    <h3 class="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <i class="fas fa-clipboard-check text-emerald-400"></i> Notas de Cambio de Turno
                    </h3>
                    <p class="text-xs text-gray-400 mb-3">Deja pendientes, recados y novedades operativas para el siguiente turno.</p>
                    <textarea id="shift-notes" class="flex-1 w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm resize-none" placeholder="Escribe aquí las novedades del turno..."></textarea>
                    <div class="mt-3 flex justify-end">
                        <button id="btn-save-notes" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-lg shadow-emerald-500/20 text-sm flex items-center gap-2">
                            <i class="fas fa-save"></i> Guardar Novedades
                        </button>
                    </div>
                </div>

                <!-- AI Assistant -->
                <div class="bg-gray-800/80 backdrop-blur-md rounded-xl p-5 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)] flex flex-col relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-4 opacity-10">
                        <i class="fas fa-robot text-8xl text-purple-400"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-3 flex items-center gap-2 relative z-10">
                        <i class="fas fa-sparkles text-purple-400"></i> Asistente de IA (Tiempo Real)
                    </h3>
                    <p class="text-xs text-purple-200/60 mb-3 relative z-10">Análisis proactivo de la flota y sugerencias operativas.</p>
                    <div id="ai-notifications" class="flex-1 overflow-y-auto pr-2 space-y-3 relative z-10 custom-scrollbar max-h-[200px]">
                        <div class="text-center text-gray-500 mt-10"><i class="fas fa-sync fa-spin"></i> Analizando flota...</div>
                    </div>
                </div>

            </div>
        </div>
    `;

    // Initial Fetch
    await fetchAndUpdate();

    // Attach Filter Listeners
    const filterType = document.getElementById('filter-type');
    const filterStatus = document.getElementById('filter-status');
    if (filterType) filterType.addEventListener('change', () => resetAndFilter());
    if (filterStatus) filterStatus.addEventListener('change', () => resetAndFilter());

    // Notes Listener
    const btnSaveNotes = document.getElementById('btn-save-notes');
    if (btnSaveNotes) btnSaveNotes.addEventListener('click', saveShiftNotes);

    // Initial Load of Notes
    loadShiftNotes();

    // Start Loops
    startRealTimeUpdates();
    startTransitionLoop();
}

let lastSamsaraFetchTime = 0;

async function fetchAndUpdate() {
    const { data: units, error } = await supabase
        .from('units')
        .select(`*, operators (name)`)
        .order('last_status_update', { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    // Ubicacion cache: Fetch Samsara Data every 2 minutes (120,000ms), except first time
    const now = Date.now();
    if (samsaraData.length === 0 || (now - lastSamsaraFetchTime > 120000)) {
        samsaraData = await fetchSamsaraLocations();
        lastSamsaraFetchTime = now;
    }
    
    window.allUnits = units.sort((a,b) => a.economic_number.localeCompare(b.economic_number, undefined, {numeric: true}));
    applyFiltersAndRender();
    
    // Trigger AI Analysis
    generateAIInsights();
}

function applyFiltersAndRender() {
    const filterType = document.getElementById('filter-type');
    const filterStatus = document.getElementById('filter-status');
    
    // Safety check: if we are not in dashboard view anymore
    if (!filterType || !filterStatus) return;

    const type = filterType.value;
    const status = filterStatus.value;
    
    let filtered = window.allUnits.filter(u => {
        return (type === 'all' || u.type === type) &&
               (status === 'all' || u.status === status || (status === 'Transito' && (u.status.includes('Transito') || u.status === 'Cargada')));
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
    if (currentPage >= totalPages) currentPage = 0;

    const start = currentPage * ITEMS_PER_PAGE;
    const paginated = filtered.slice(start, start + ITEMS_PER_PAGE);

    const indicator = document.getElementById('page-indicator');
    if (indicator) indicator.innerText = `PAGINA ${currentPage + 1}/${totalPages}`;

    const boardBody = document.getElementById('airport-board-body');
    if (boardBody) renderRows(paginated, boardBody);
}

function renderRows(units, container) {
    if (units.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-gray-500">No hay unidades para mostrar.</div>';
        return;
    }

    let html = '';
    
    units.forEach((unit, idx) => {
        const opName = unit.operators ? unit.operators.name : '<span class="text-gray-600">Sin Asignar</span>';
        const placas = unit.placas || '---';
        
        // Match with Samsara
        const samsaraVeh = samsaraData.find(v => v.name.includes(unit.economic_number) || (unit.placas && v.name.includes(unit.placas)));
        let location = '---';
        let mapsUrl = '#';
        
        if (samsaraVeh && samsaraVeh.location) {
            const { latitude, longitude, speed } = samsaraVeh.location;
            location = `<span class="text-xs text-blue-300 font-bold underline cursor-pointer hover:text-blue-100" title="Ver en Google Maps">${speed} km/h</span>`;
            mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        }

        let parsedDetails = unit.details;
        if (typeof parsedDetails === 'string') {
            try { parsedDetails = JSON.parse(parsedDetails); } catch(e) {}
        }

        const cliente = (typeof parsedDetails === 'object' && parsedDetails?.cliente) ? parsedDetails.cliente : '---';

        let origenStr = typeof parsedDetails === 'object' ? (parsedDetails?.origen || '') : '';
        let destinoStr = typeof parsedDetails === 'object' ? (parsedDetails?.destino || '') : '';
        let customRoute = '---';
        
        if (typeof parsedDetails === 'object' && parsedDetails !== null) {
            if (origenStr && destinoStr) customRoute = `${origenStr} - ${destinoStr}`;
            else if (parsedDetails.route) customRoute = parsedDetails.route;
        } else if (typeof unit.details === 'string') {
            customRoute = unit.details;
        }

        let aiRouteBtn = '';
        if (origenStr && destinoStr && origenStr !== '---' && destinoStr !== '---' && !samsaraVeh) {
            aiRouteBtn = `<div class="mt-1"><button onclick="window.openAIRoute('${origenStr}', '${destinoStr}')" class="text-purple-400 hover:text-purple-300 text-[10px] font-bold transition flex justify-center items-center gap-1 w-full"><i class="fas fa-robot"></i> Ruta IA</button></div>`;
        }

        let geoId = `geo-${unit.id}`;
        let city = '<span class="text-[10px] text-gray-600">No Signal</span>';
        
        if (samsaraVeh && samsaraVeh.location) {
            city = `<span id="${geoId}" class="text-[10px] block truncate text-purple-300 font-bold w-32 mx-auto" title="Ubicación GPS">Obteniendo...</span>`;
            setTimeout(() => reverseGeocode(samsaraVeh.location.latitude, samsaraVeh.location.longitude, geoId), 100);
        }

        let rowClass = 'border-l-4 border-transparent airport-flip'; 
        if(unit.status === 'Vacia' || unit.status === 'En Taller') rowClass += ' border-l-red-900';
        if(unit.status.includes('Transito') || unit.status === 'Cargada') rowClass += ' border-l-green-900';

        html += `
            <div class="grid grid-cols-10 border-b border-gray-800 p-3 items-center hover:bg-gray-800 transition airport-row ${rowClass} time-row" 
                 style="animation-delay: ${idx * 0.1}s"
                 data-timestamp="${unit.last_status_update}" 
                 data-status="${unit.status}">
                 
                <div class="col-span-1 text-blue-400 font-bold text-xs md:text-sm">${unit.type}</div>
                <div class="col-span-1 text-purple-400 text-[10px] md:text-xs font-bold text-center truncate">${cliente}</div>
                <div class="col-span-1 text-white font-mono text-sm md:text-lg text-center">${unit.economic_number}</div>
                <div class="col-span-1 text-gray-400 text-[10px] md:text-sm text-center">${placas}</div>
                
                <div class="col-span-1 flex items-center justify-center">
                    <span class="status-indicator w-3 h-3 rounded-full mr-2"></span>
                    <span class="uppercase text-[10px] md:text-sm font-bold text-gray-300 truncate">${unit.status}</span>
                </div>
                
                <div class="col-span-1 text-gray-300 text-[10px] md:text-sm truncate pl-4">${opName}</div>
                
                <div class="col-span-1 text-center text-[10px] md:text-xs text-orange-400 font-mono">
                    ${customRoute}
                </div>
                <div class="col-span-1 text-center font-mono">
                    <a href="${mapsUrl}" target="_blank">
                        ${location}
                        ${city}
                    </a>
                    ${aiRouteBtn}
                </div>

                <div class="col-span-2 text-right">
                    <div class="font-mono text-xl font-bold time-display">--:--:--</div>
                    <div class="text-xs time-label mt-1">Calculando...</div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    updateTimers(); 
}

function resetAndFilter() {
    currentPage = 0;
    applyFiltersAndRender();
}

function startRealTimeUpdates() {
    updateInterval = setInterval(updateTimers, 1000);
}

let countdown = 10;
function startTransitionLoop() {
    transitionInterval = setInterval(async () => {
        countdown--;
        const refreshLabel = document.getElementById('next-refresh');
        if (refreshLabel) refreshLabel.innerText = `PROX. CAMBIO: ${countdown}s`;

        if (countdown <= 0) {
            countdown = 10;
            currentPage++;
            // Refresh DB every 10s. Samsara will be bypassed via 1h cache internally
            await fetchAndUpdate();
        }
    }, 1000);
}

function updateTimers() {
    const rows = document.querySelectorAll('.time-row');
    const now = new Date();

    rows.forEach(row => {
        const timestamp = new Date(row.dataset.timestamp);
        if (isNaN(timestamp)) return;
        
        const status = row.dataset.status;
        const diffMs = now - timestamp;
        
        let isFuture = false;
        let absDiffMs = diffMs;
        if (diffMs < 0) {
            isFuture = true;
            absDiffMs = Math.abs(diffMs);
        }

        const hours = Math.floor(absDiffMs / (1000 * 60 * 60));
        const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((absDiffMs % (1000 * 60)) / 1000);

        const timeStr = isFuture ? `- ${hours}h ${minutes}m ${seconds}s` : `${hours}h ${minutes}m ${seconds}s`;
        
        const timeDisplay = row.querySelector('.time-display');
        const timeLabel = row.querySelector('.time-label');
        const statusDot = row.querySelector('.status-indicator');

        if (!timeDisplay || !timeLabel) return;

        if (isFuture) {
            timeDisplay.className = 'font-mono text-xl font-bold text-purple-400';
            timeLabel.innerHTML = `<span class="text-purple-300 text-[10px]">🗓️ Iniciará en</span>`;
            if (statusDot) statusDot.className = 'status-indicator w-3 h-3 rounded-full mr-2 bg-purple-500 shadow-[0_0_10px_#a855f7]';
        } else {
            const isLostTimeStatus = ['Vacia', 'En Taller', 'Sin Operador'].includes(status);

            if (isLostTimeStatus) {
                if (hours >= 24) {
                    timeDisplay.className = 'font-mono text-xl font-bold text-red-500 animate-pulse';
                    timeLabel.innerHTML = `<span class="text-red-400 text-[10px]">⚠️ PÉRDIDA: ${formatCurrency(calculateFinancialLoss(hours))}</span>`;
                    if (statusDot) statusDot.className = 'status-indicator w-3 h-3 rounded-full mr-2 bg-red-600 shadow-[0_0_10px_#ef4444]';
                } else if (hours >= 12) {
                    timeDisplay.className = 'font-mono text-xl font-bold text-yellow-500';
                    timeLabel.innerHTML = `<span class="text-yellow-400 text-[10px]">⏱️ Tiempo Muerto</span>`;
                    if (statusDot) statusDot.className = 'status-indicator w-3 h-3 rounded-full mr-2 bg-yellow-500 shadow-[0_0_10px_#eab308]';
                } else {
                    timeDisplay.className = 'font-mono text-xl font-bold text-white';
                    timeLabel.innerHTML = `<span class="text-gray-400 text-[10px]">Tiempo Inactivo</span>`;
                    if (statusDot) statusDot.className = 'status-indicator w-3 h-3 rounded-full mr-2 bg-gray-500';
                }
            } else {
                timeDisplay.className = 'font-mono text-xl font-bold text-green-400';
                timeLabel.innerHTML = `<span class="text-green-300 text-[10px]">🚛 En Ruta / Operando</span>`;
                if (statusDot) statusDot.className = 'status-indicator w-3 h-3 rounded-full mr-2 bg-green-500 shadow-[0_0_10px_#22c55e]';
            }
        }
        
        timeDisplay.textContent = timeStr;
    });
}

// --- SHIFT NOTES ---
async function loadShiftNotes() {
    const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'shift_notes').maybeSingle();
    if (data && data.setting_value) {
        document.getElementById('shift-notes').value = data.setting_value;
    }
}

async function saveShiftNotes() {
    const btn = document.getElementById('btn-save-notes');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    
    const val = document.getElementById('shift-notes').value;
    
    // Upsert logic using key
    const { error } = await supabase.from('system_settings').upsert({ setting_key: 'shift_notes', setting_value: val, description: 'Notas de Cambio de Turno' }, { onConflict: 'setting_key' });
    
    if (error) {
        alert("Error guardando notas: " + error.message);
    } else {
        btn.innerHTML = '<i class="fas fa-check text-white"></i> ¡Guardado!';
        setTimeout(() => btn.innerHTML = oldHtml, 2000);
    }
}

// --- AI ASSISTANT LOGIC ---
function generateAIInsights() {
    const container = document.getElementById('ai-notifications');
    if (!container) return;

    if (!window.allUnits || window.allUnits.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500">No hay suficientes datos para analizar.</p>';
        return;
    }

    const insights = [];
    const now = new Date();

    // Regla 1: Unidades inactivas por mas de 24 horas (Alerta Roja)
    const lazyUnits = window.allUnits.filter(u => {
        if (u.status !== 'Vacia' && u.status !== 'En Taller') return false;
        const ms = now - new Date(u.last_status_update);
        return ms > 24 * 60 * 60 * 1000;
    });

    if (lazyUnits.length > 0) {
        insights.push(`
            <div class="bg-red-900/40 border-l-4 border-red-500 p-3 rounded">
                <div class="flex items-center gap-2 text-red-400 font-bold text-sm mb-1">
                    <i class="fas fa-exclamation-circle"></i> Alerta de Inactividad
                </div>
                <p class="text-xs text-gray-300">Tienes <b>${lazyUnits.length}</b> unidades (ej. ${lazyUnits[0].economic_number}) paradas por más de 24 horas. ¡Asigna viajes para evitar pérdida financiera!</p>
            </div>
        `);
    }

    // Regla 2: Sugerencia de Asignación Optima
    const vacias = window.allUnits.filter(u => u.status === 'Vacia');
    if (vacias.length > 0) {
        insights.push(`
            <div class="bg-blue-900/40 border-l-4 border-blue-500 p-3 rounded">
                <div class="flex items-center gap-2 text-blue-400 font-bold text-sm mb-1">
                    <i class="fas fa-lightbulb"></i> Sugerencia Logística
                </div>
                <p class="text-xs text-gray-300">La unidad <b>${vacias[0].economic_number}</b> está disponible. Considera asignarla a las rutas de alta demanda actuales para maximizar rendimiento.</p>
            </div>
        `);
    }

    // Regla 3: Monitoreo de Viajes Programados proximos (menos de 2 horas)
    const proximos = window.allUnits.filter(u => {
        if (!u.details || typeof u.details !== 'object' || !u.details.assignment_date) return false;
        const ad = new Date(u.details.assignment_date);
        const diffMs = ad - now;
        return diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000; // En las proximas 2 horas
    });

    if (proximos.length > 0) {
        insights.push(`
            <div class="bg-purple-900/40 border-l-4 border-purple-500 p-3 rounded">
                <div class="flex items-center gap-2 text-purple-400 font-bold text-sm mb-1">
                    <i class="fas fa-clock"></i> Viajes Próximos
                </div>
                <p class="text-xs text-gray-300">La unidad <b>${proximos[0].economic_number}</b> arranca ruta en menos de 2 horas. Verifica con el operador.</p>
            </div>
        `);
    }

    // Si todo esta perfecto
    if (insights.length === 0) {
        insights.push(`
            <div class="bg-emerald-900/40 border-l-4 border-emerald-500 p-3 rounded">
                <div class="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
                    <i class="fas fa-check-circle"></i> Operación Óptima
                </div>
                <p class="text-xs text-gray-300">La inteligencia artificial no detecta cuellos de botella asincrónicos en este momento. Buen trabajo.</p>
            </div>
        `);
    }

    container.innerHTML = insights.join('');
}
