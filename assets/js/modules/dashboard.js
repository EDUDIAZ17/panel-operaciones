// assets/js/modules/dashboard.js
import { supabase } from '../services/supabaseClient.js';
import { formatDate, calculateTimeElapsed, formatCurrency, calculateFinancialLoss } from '../utils/formatters.js';
import { fetchSamsaraLocations } from '../services/samsara.js';

let updateInterval; 
let transitionInterval;
let currentPage = 0;
const ITEMS_PER_PAGE = 8;
let samsaraData = [];

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
            
            <div class="mt-4 text-xs text-gray-500 flex gap-4">
                <span>* Semáforo Tiempos:</span>
                <span class="text-green-600 font-bold">● En Ruta (Productivo)</span>
                <span class="text-red-600 font-bold">● Pérdida (>24h Vacia/Taller)</span>
                <span class="text-yellow-600 font-bold">● Atencíon (12-24h Vacia/Taller)</span>
                <span class="ml-auto text-blue-500 font-bold italic">* Sincronizado con Samsara API</span>
            </div>
        </div>
    `;

    // Initial Fetch
    await fetchAndUpdate();

    // Attach Filter Listeners
    document.getElementById('filter-type').addEventListener('change', () => resetAndFilter());
    document.getElementById('filter-status').addEventListener('change', () => resetAndFilter());

    // Start Loops
    startRealTimeUpdates();
    startTransitionLoop();
}

async function fetchAndUpdate() {
    const { data: units, error } = await supabase
        .from('units')
        .select(`*, operators (name)`)
        .order('last_status_update', { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    // Fetch Samsara Data concurrently
    samsaraData = await fetchSamsaraLocations();
    
    window.allUnits = units.sort((a,b) => a.economic_number.localeCompare(b.economic_number, undefined, {numeric: true}));
    applyFiltersAndRender();
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

        const cliente = (typeof unit.details === 'object' && unit.details?.cliente) ? unit.details.cliente : '---';

        let customRoute = '---';
        if (typeof unit.details === 'object' && unit.details !== null) {
            if (unit.details.origen && unit.details.destino) customRoute = `${unit.details.origen} - ${unit.details.destino}`;
            else if (unit.details.route) customRoute = unit.details.route;
        } else if (typeof unit.details === 'string') {
            customRoute = unit.details;
        }

        const city = samsaraVeh ? `<span class="text-[10px] block truncate text-gray-400">GPS Activo</span>` : '<span class="text-[10px] text-gray-600">No Signal</span>';

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
                
                <div class="col-span-1 text-center text-[10px] md:text-xs text-orange-400 font-mono">${customRoute}</div>
                <div class="col-span-1 text-center font-mono">
                    <a href="${mapsUrl}" target="_blank">
                        ${location}
                        ${city}
                    </a>
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

let countdown = 60;
function startTransitionLoop() {
    transitionInterval = setInterval(async () => {
        countdown--;
        const refreshLabel = document.getElementById('next-refresh');
        if (refreshLabel) refreshLabel.innerText = `PROX. CAMBIO: ${countdown}s`;

        if (countdown <= 0) {
            countdown = 60;
            currentPage++;
            // Refresh data from DB/Samsara every minute too
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
        
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

        const timeStr = `${hours}h ${minutes}m ${seconds}s`;
        
        const timeDisplay = row.querySelector('.time-display');
        const timeLabel = row.querySelector('.time-label');
        const statusDot = row.querySelector('.status-indicator');

        if (!timeDisplay || !timeLabel) return;

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
        
        timeDisplay.textContent = timeStr;
    });
}

