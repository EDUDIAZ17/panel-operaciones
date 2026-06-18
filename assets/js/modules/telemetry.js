// assets/js/modules/telemetry.js
import { getTelemetryReport, saveTelemetryAudit, getTelemetryAudits, deleteTelemetryAudit } from '../services/telemetry.js';
import { supabase } from '../services/supabaseClient.js';

// Local module state
const moduleState = {
    reportData: null,
    savedAudits: [],
    loading: false,
    activeTab: 'dashboard', // 'dashboard', 'speeding', 'safety', 'audits'
    charts: {
        safetyChart: null,
        speedingChart: null,
        avgSpeedChart: null
    }
};

/**
 * Main entry point called by app.js to render the telemetry page
 */
export async function renderTelemetry(container) {
    container.innerHTML = `
        <div id="view-telemetry" class="p-6 fade-in space-y-6 bg-slate-50 min-h-full overflow-y-auto">
            <!-- Header Panel -->
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 class="text-xl font-black text-slate-800 flex items-center gap-2">
                        <i class="fas fa-satellite-dish text-indigo-600"></i> Módulo de Telemetría Unificada
                    </h3>
                    <p class="text-xs text-slate-400 font-semibold mt-1">Monitoreo de hábitos de conducción en tiempo real e histórico para Samsara y Enlace FL</p>
                </div>
                <div class="flex gap-2">
                    <button id="btn-save-audit" class="hidden bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-md shadow-emerald-500/20 text-xs flex items-center gap-2 uppercase tracking-wider">
                        <i class="fas fa-file-invoice"></i> Guardar Auditoría
                    </button>
                    <button id="btn-export-excel" class="hidden bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs flex items-center gap-2 uppercase tracking-wider">
                        <i class="fas fa-file-excel"></i> Exportar Excel
                    </button>
                </div>
            </div>

            <!-- Filters Panel -->
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <!-- Start Date -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Fecha Inicio</label>
                        <input type="datetime-local" id="filter-start-date" class="w-full border-2 border-slate-100 focus:border-indigo-500 outline-none p-2.5 rounded-xl font-semibold text-slate-700 bg-slate-50 transition">
                    </div>
                    
                    <!-- End Date -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Fecha Fin</label>
                        <input type="datetime-local" id="filter-end-date" class="w-full border-2 border-slate-100 focus:border-indigo-500 outline-none p-2.5 rounded-xl font-semibold text-slate-700 bg-slate-50 transition">
                    </div>

                    <!-- Presets -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Rango Rápido</label>
                        <select id="filter-preset" class="w-full border-2 border-slate-100 focus:border-indigo-500 outline-none p-2.5 rounded-xl font-semibold text-slate-700 bg-slate-50 transition">
                            <option value="today">Hoy</option>
                            <option value="yesterday">Ayer</option>
                            <option value="week" selected>Últimos 7 Días</option>
                            <option value="month">Este Mes</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>

                    <!-- Action Button -->
                    <div>
                        <button id="btn-load-telemetry" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 px-6 rounded-xl transition-all shadow-md shadow-indigo-500/20 text-xs flex items-center justify-center gap-2 uppercase tracking-widest">
                            <i class="fas fa-sync"></i> Consultar / Cargar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Loader -->
            <div id="telemetry-loader" class="hidden py-20 text-center text-slate-400 font-bold bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div class="spinner mb-4 border-t-indigo-600 w-10 h-10"></div>
                <div class="text-sm uppercase tracking-wider text-slate-500">Consultando APIs en paralelo...</div>
                <p class="text-xs text-slate-400 font-semibold mt-1.5">Esto puede tardar unos segundos</p>
            </div>

            <!-- Dashboard Content Container (Visible once loaded) -->
            <div id="telemetry-content" class="hidden space-y-6">
                <!-- Stats Indicators -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:-translate-y-0.5 transition-transform duration-300">
                        <div class="h-12 w-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-inner">
                            <i class="fas fa-shield-halved"></i>
                        </div>
                        <div>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Alertas Safety</p>
                            <p id="stat-safety-events" class="text-2xl font-black text-slate-800">0</p>
                        </div>
                    </div>
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:-translate-y-0.5 transition-transform duration-300">
                        <div class="h-12 w-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-inner">
                            <i class="fas fa-gauge-high"></i>
                        </div>
                        <div>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Excesos Velocidad</p>
                            <p id="stat-speeding-events" class="text-2xl font-black text-slate-800">0</p>
                        </div>
                    </div>
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:-translate-y-0.5 transition-transform duration-300">
                        <div class="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-inner">
                            <i class="fas fa-tachometer-alt"></i>
                        </div>
                        <div>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Velocidad Promedio</p>
                            <p id="stat-avg-speed" class="text-2xl font-black text-slate-800">0 km/h</p>
                        </div>
                    </div>
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:-translate-y-0.5 transition-transform duration-300">
                        <div class="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-inner">
                            <i class="fas fa-truck-moving"></i>
                        </div>
                        <div>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unidades Monitoreadas</p>
                            <p id="stat-vehicles-count" class="text-2xl font-black text-slate-800">0</p>
                        </div>
                    </div>
                </div>

                <!-- Tabs navigation -->
                <div class="border-b border-slate-200 flex gap-2">
                    <button data-tab="dashboard" class="tab-btn py-2.5 px-5 font-black text-xs uppercase tracking-widest border-b-2 border-indigo-600 text-indigo-600 focus:outline-none">
                        <i class="fas fa-chart-pie mr-1"></i> Dashboard
                    </button>
                    <button data-tab="speeding" class="tab-btn py-2.5 px-5 font-bold text-xs uppercase tracking-widest border-b-2 border-transparent text-slate-400 hover:text-slate-600 focus:outline-none">
                        <i class="fas fa-gauge-high mr-1"></i> Excesos Velocidad
                    </button>
                    <button data-tab="safety" class="tab-btn py-2.5 px-5 font-bold text-xs uppercase tracking-widest border-b-2 border-transparent text-slate-400 hover:text-slate-600 focus:outline-none">
                        <i class="fas fa-shield-halved mr-1"></i> Eventos Safety
                    </button>
                    <button data-tab="audits" class="tab-btn py-2.5 px-5 font-bold text-xs uppercase tracking-widest border-b-2 border-transparent text-slate-400 hover:text-slate-600 focus:outline-none">
                        <i class="fas fa-folder-open mr-1"></i> Auditorías
                    </button>
                </div>

                <!-- TAB: DASHBOARD (CHARTS) -->
                <div id="tab-dashboard" class="tab-content grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <!-- Chart 1: Safety Distribution -->
                    <div class="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                        <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-1.5"><i class="fas fa-chart-pie text-amber-500"></i> Eventos Safety</h4>
                        <div class="flex-1 flex items-center justify-center min-h-[220px]">
                            <canvas id="chart-safety-dist"></canvas>
                        </div>
                    </div>

                    <!-- Chart 2: Speeding Duration by Vehicle -->
                    <div class="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                        <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-1.5"><i class="fas fa-chart-bar text-rose-500"></i> Excesos de Velocidad por Unidad</h4>
                        <div class="flex-1 flex items-center justify-center min-h-[220px]">
                            <canvas id="chart-speeding-vehicles"></canvas>
                        </div>
                    </div>

                    <!-- Chart 3: Average Speed -->
                    <div class="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                        <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-1.5"><i class="fas fa-tachometer-alt text-emerald-500"></i> Velocidad Promedio por Unidad</h4>
                        <div class="flex-1 flex items-center justify-center min-h-[220px]">
                            <canvas id="chart-avg-speeds"></canvas>
                        </div>
                    </div>
                </div>

                <!-- TAB: SPEEDING EVENTS TABLE -->
                <div id="tab-speeding" class="tab-content hidden-section bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="p-4 border-b border-slate-100">
                        <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest"><i class="fas fa-gauge-high text-rose-600 mr-1.5"></i> Registro Detallado de Excesos de Velocidad (>100 km/h por >60s)</h4>
                    </div>
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead class="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                                <tr>
                                    <th class="p-3">Unidad</th>
                                    <th class="p-3">Operador</th>
                                    <th class="p-3">Fecha/Hora</th>
                                    <th class="p-3 text-center">Duración</th>
                                    <th class="p-3 text-center">Velocidad Máx</th>
                                    <th class="p-3">Dirección / Referencia</th>
                                    <th class="p-3 text-center">Mapa</th>
                                    <th class="p-3 text-center">Sistema</th>
                                </tr>
                            </thead>
                            <tbody id="table-speeding-body" class="divide-y divide-slate-100">
                                <tr>
                                    <td colspan="8" class="p-8 text-center text-slate-400">Sin datos de velocidad en este rango</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- TAB: SAFETY EVENTS TABLE -->
                <div id="tab-safety" class="tab-content hidden-section bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="p-4 border-b border-slate-100">
                        <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest"><i class="fas fa-shield-halved text-amber-500 mr-1.5"></i> Registro Detallado de Eventos de Seguridad</h4>
                    </div>
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead class="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                                <tr>
                                    <th class="p-3">Fecha/Hora</th>
                                    <th class="p-3">Evento</th>
                                    <th class="p-3">Unidad</th>
                                    <th class="p-3">Operador</th>
                                    <th class="p-3">Coordenadas</th>
                                    <th class="p-3 text-center">Mapa</th>
                                    <th class="p-3 text-center">Sistema</th>
                                </tr>
                            </thead>
                            <tbody id="table-safety-body" class="divide-y divide-slate-100">
                                <tr>
                                    <td colspan="7" class="p-8 text-center text-slate-400">Sin alertas registradas en este rango</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- TAB: SAVED AUDITS -->
                <div id="tab-audits" class="tab-content hidden-section bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="p-4 border-b border-slate-100">
                        <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest"><i class="fas fa-folder-open text-indigo-600 mr-1.5"></i> Consultas Guardadas para Auditoría (Supabase)</h4>
                    </div>
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead class="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                                <tr>
                                    <th class="p-3">Fecha Creación</th>
                                    <th class="p-3">Rango Consultado</th>
                                    <th class="p-3 text-center">Safety Eventos</th>
                                    <th class="p-3 text-center">Excesos Velocidad</th>
                                    <th class="p-3 text-center">Prom. Flota</th>
                                    <th class="p-3">Auditor / Notas</th>
                                    <th class="p-3 text-center">Cargar</th>
                                    <th class="p-3 text-center">Eliminar</th>
                                </tr>
                            </thead>
                            <tbody id="table-audits-body" class="divide-y divide-slate-100">
                                <tr>
                                    <td colspan="8" class="p-8 text-center text-slate-400">No hay auditorías guardadas</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize default dates
    initDates();

    // Attach Action Listeners
    document.getElementById('btn-load-telemetry').addEventListener('click', loadTelemetry);
    document.getElementById('btn-save-audit').addEventListener('click', openSaveAuditModal);
    document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);
    document.getElementById('filter-preset').addEventListener('change', handlePresetChange);

    // Tab switcher
    const tabBtns = container.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = btn.getAttribute('data-tab');
            switchTab(targetTab, tabBtns);
        });
    });

    // Populate audits on load
    loadSavedAuditsList();
}

/**
 * Handle date range presets
 */
function initDates() {
    const startInput = document.getElementById('filter-start-date');
    const endInput = document.getElementById('filter-end-date');

    const now = new Date();
    // Default: Last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);

    // Set times to local ISO
    startInput.value = formatLocalDateTime(weekAgo);
    endInput.value = formatLocalDateTime(now);
}

function handlePresetChange(e) {
    const preset = e.target.value;
    if (preset === 'custom') return;

    const startInput = document.getElementById('filter-start-date');
    const endInput = document.getElementById('filter-end-date');
    const now = new Date();
    let start = new Date();

    switch(preset) {
        case 'today':
            start.setHours(0,0,0,0);
            now.setHours(23,59,59,999);
            break;
        case 'yesterday':
            start.setDate(now.getDate() - 1);
            start.setHours(0,0,0,0);
            
            const yesterdayEnd = new Date();
            yesterdayEnd.setDate(now.getDate() - 1);
            yesterdayEnd.setHours(23,59,59,999);
            endInput.value = formatLocalDateTime(yesterdayEnd);
            startInput.value = formatLocalDateTime(start);
            return;
        case 'week':
            start.setDate(now.getDate() - 7);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
    }

    startInput.value = formatLocalDateTime(start);
    endInput.value = formatLocalDateTime(now);
}

function formatLocalDateTime(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

/**
 * Switch tabs dynamically
 */
function switchTab(tabId, tabBtns) {
    moduleState.activeTab = tabId;
    tabBtns.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.className = 'tab-btn py-2.5 px-5 font-black text-xs uppercase tracking-widest border-b-2 border-indigo-600 text-indigo-600 focus:outline-none';
        } else {
            btn.className = 'tab-btn py-2.5 px-5 font-bold text-xs uppercase tracking-widest border-b-2 border-transparent text-slate-400 hover:text-slate-600 focus:outline-none';
        }
    });

    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => {
        if (content.id === `tab-${tabId}`) {
            content.classList.remove('hidden-section');
        } else {
            content.classList.add('hidden-section');
        }
    });
}

/**
 * Fetch and Render Telemetry Data
 */
async function loadTelemetry() {
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;

    if (!startDate || !endDate) {
        Swal.fire('Error', 'Por favor seleccione ambas fechas.', 'error');
        return;
    }

    // Toggle loader
    document.getElementById('telemetry-loader').classList.remove('hidden');
    document.getElementById('telemetry-content').classList.add('hidden');
    document.getElementById('btn-save-audit').classList.add('hidden');
    document.getElementById('btn-export-excel').classList.add('hidden');

    try {
        const report = await getTelemetryReport(startDate, endDate);
        moduleState.reportData = report;

        // Render everything
        renderStats(report.summary);
        renderCharts(report);
        renderTables(report);

        // Show contents
        document.getElementById('telemetry-loader').classList.add('hidden');
        document.getElementById('telemetry-content').classList.remove('hidden');
        document.getElementById('btn-save-audit').classList.remove('hidden');
        document.getElementById('btn-export-excel').classList.remove('hidden');

    } catch (error) {
        console.error(error);
        document.getElementById('telemetry-loader').classList.add('hidden');
        Swal.fire('Error', 'No se pudieron jalar los datos de telemetría de las APIs.', 'error');
    }
}

/**
 * Render Cards Stats
 */
function renderStats(summary) {
    document.getElementById('stat-safety-events').innerText = summary.totalSafetyEvents;
    document.getElementById('stat-speeding-events').innerText = summary.totalSpeedingEvents;
    document.getElementById('stat-avg-speed').innerText = `${summary.averageFleetSpeed} km/h`;
    document.getElementById('stat-vehicles-count').innerText = summary.monitoredVehicles;
}

/**
 * Render Charts via Chart.js
 */
function renderCharts(report) {
    // Destroy existing chart instances to prevent canvas ghosting
    Object.values(moduleState.charts).forEach(chart => {
        if (chart) chart.destroy();
    });

    // 1. Chart Safety Dist
    const safetyTypes = {};
    report.safetyEvents.forEach(e => {
        safetyTypes[e.type] = (safetyTypes[e.type] || 0) + 1;
    });

    const safetyCtx = document.getElementById('chart-safety-dist').getContext('2d');
    moduleState.charts.safetyChart = new Chart(safetyCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(safetyTypes).map(t => formatEventLabel(t)),
            datasets: [{
                data: Object.values(safetyTypes),
                backgroundColor: ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#6b7280', '#eab308']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }
            }
        }
    });

    // 2. Chart Speeding by Vehicle
    const speedingVehicles = {};
    report.speedingEvents.forEach(e => {
        speedingVehicles[e.vehicle] = (speedingVehicles[e.vehicle] || 0) + 1;
    });

    const speedingCtx = document.getElementById('chart-speeding-vehicles').getContext('2d');
    moduleState.charts.speedingChart = new Chart(speedingCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(speedingVehicles),
            datasets: [{
                label: 'Excesos',
                data: Object.values(speedingVehicles),
                backgroundColor: '#ef4444',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { ticks: { font: { size: 9 } } }
            }
        }
    });

    // 3. Chart Average Speeds
    const avgSpeedCtx = document.getElementById('chart-avg-speeds').getContext('2d');
    moduleState.charts.avgSpeedChart = new Chart(avgSpeedCtx, {
        type: 'bar',
        data: {
            labels: report.averageSpeeds.map(v => v.vehicle),
            datasets: [{
                label: 'Km/h',
                data: report.averageSpeeds.map(v => v.avgSpeed),
                backgroundColor: '#10b981',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { font: { size: 10 } } },
                x: { ticks: { font: { size: 9 } } }
            }
        }
    });
}

/**
 * Render Tables (Speeding, Safety)
 */
function renderTables(report) {
    // 1. Render Speeding Table
    const speedingBody = document.getElementById('table-speeding-body');
    if (report.speedingEvents.length > 0) {
        speedingBody.innerHTML = report.speedingEvents.map(e => `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-3 font-bold text-slate-800">${e.vehicle}</td>
                <td class="p-3 text-slate-600 font-semibold">${e.driver}</td>
                <td class="p-3 font-mono text-slate-500">${new Date(e.time).toLocaleString()}</td>
                <td class="p-3 text-center text-rose-600 font-bold">${formatDuration(e.duration)}</td>
                <td class="p-3 text-center text-slate-800 font-black">${e.maxSpeed} km/h</td>
                <td class="p-3 text-slate-500 font-medium">${e.address}</td>
                <td class="p-3 text-center">
                    ${e.lat ? `
                        <a href="https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}" target="_blank" class="inline-flex h-7 w-7 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg items-center justify-center transition">
                            <i class="fas fa-map-location-dot"></i>
                        </a>
                    ` : '-'}
                </td>
                <td class="p-3 text-center">
                    <span class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${e.source === 'Samsara' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}">
                        ${e.source}
                    </span>
                </td>
            </tr>
        `).join('');
    } else {
        speedingBody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400 font-semibold">Sin excesos de velocidad en este rango</td></tr>`;
    }

    // 2. Render Safety Table
    const safetyBody = document.getElementById('table-safety-body');
    if (report.safetyEvents.length > 0) {
        safetyBody.innerHTML = report.safetyEvents.map(e => `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-3 font-mono text-slate-500">${new Date(e.time).toLocaleString()}</td>
                <td class="p-3">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200/50">
                        ${formatEventLabel(e.type)}
                    </span>
                </td>
                <td class="p-3 font-bold text-slate-800">${e.vehicle}</td>
                <td class="p-3 text-slate-600 font-semibold">${e.driver}</td>
                <td class="p-3 font-mono text-slate-500">${e.lat ? `${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}` : '-'}</td>
                <td class="p-3 text-center">
                    ${e.lat ? `
                        <a href="https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}" target="_blank" class="inline-flex h-7 w-7 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg items-center justify-center transition">
                            <i class="fas fa-map-location-dot"></i>
                        </a>
                    ` : '-'}
                </td>
                <td class="p-3 text-center">
                    <span class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${e.source === 'Samsara' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}">
                        ${e.source}
                    </span>
                </td>
            </tr>
        `).join('');
    } else {
        safetyBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400 font-semibold">Sin alertas de seguridad registradas en este rango</td></tr>`;
    }
}

/**
 * Fetch and Render Saved Audits List
 */
async function loadSavedAuditsList() {
    const listBody = document.getElementById('table-audits-body');
    const audits = await getTelemetryAudits();
    moduleState.savedAudits = audits;

    if (audits.length > 0) {
        listBody.innerHTML = audits.map(a => `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-3 font-mono text-slate-500">${new Date(a.created_at).toLocaleString()}</td>
                <td class="p-3 font-bold text-slate-700">
                    ${new Date(a.start_date).toLocaleDateString()} a ${new Date(a.end_date).toLocaleDateString()}
                </td>
                <td class="p-3 text-center font-bold text-amber-600">${a.summary?.totalSafetyEvents || 0}</td>
                <td class="p-3 text-center font-bold text-rose-600">${a.summary?.totalSpeedingEvents || 0}</td>
                <td class="p-3 text-center font-bold text-slate-800">${a.summary?.averageFleetSpeed || 0} km/h</td>
                <td class="p-3">
                    <div class="font-bold text-slate-800">${a.created_by || 'Sistema'}</div>
                    <div class="text-[10px] text-slate-400 italic">${a.notes || 'Sin observaciones'}</div>
                </td>
                <td class="p-3 text-center">
                    <button onclick="window.loadAuditToUI('${a.id}')" class="inline-flex h-7 w-7 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg items-center justify-center transition">
                        <i class="fas fa-folder-open"></i>
                    </button>
                </td>
                <td class="p-3 text-center">
                    <button onclick="window.deleteAuditFromDB('${a.id}')" class="inline-flex h-7 w-7 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg items-center justify-center transition">
                        <i class="fas fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } else {
        listBody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400 font-semibold">No se han registrado auditorías para fechas específicas</td></tr>`;
    }
}

// Attach loading/deleting methods to window for onclick callbacks
window.loadAuditToUI = function (auditId) {
    const audit = moduleState.savedAudits.find(a => a.id === auditId);
    if (!audit) return;

    Swal.fire({
        title: 'Cargar Auditoría',
        text: '¿Desea cargar los datos de este reporte estático en la UI?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Cargar',
        cancelButtonText: 'Cancelar'
    }).then((res) => {
        if (res.isConfirmed) {
            // Restore state
            moduleState.reportData = {
                summary: audit.summary,
                speedingEvents: audit.speeding_events,
                safetyEvents: audit.safety_events,
                averageSpeeds: audit.average_speeds
            };

            // Set inputs
            document.getElementById('filter-start-date').value = formatLocalDateTime(new Date(audit.start_date));
            document.getElementById('filter-end-date').value = formatLocalDateTime(new Date(audit.end_date));
            document.getElementById('filter-preset').value = 'custom';

            // Render
            renderStats(audit.summary);
            renderCharts(moduleState.reportData);
            renderTables(moduleState.reportData);

            // Toggle views
            document.getElementById('telemetry-loader').classList.add('hidden');
            document.getElementById('telemetry-content').classList.remove('hidden');
            document.getElementById('btn-save-audit').classList.add('hidden'); // Disable saving again
            document.getElementById('btn-export-excel').classList.remove('hidden');

            // Switch to dashboard tab
            const tabBtns = document.querySelectorAll('.tab-btn');
            switchTab('dashboard', tabBtns);

            Swal.fire('Cargado', 'El reporte estático se cargó correctamente.', 'success');
        }
    });
};

window.deleteAuditFromDB = function (auditId) {
    Swal.fire({
        title: '¿Eliminar Auditoría?',
        text: 'Esta acción no se puede deshacer. ¿Desea eliminar este registro permanentemente?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (res) => {
        if (res.isConfirmed) {
            const success = await deleteTelemetryAudit(auditId);
            if (success) {
                Swal.fire('Eliminado', 'La auditoría ha sido borrada.', 'success');
                loadSavedAuditsList();
            } else {
                Swal.fire('Error', 'No se pudo eliminar el registro.', 'error');
            }
        }
    });
};

/**
 * Open Save Audit Modal
 */
function openSaveAuditModal() {
    if (!moduleState.reportData) return;

    Swal.fire({
        title: 'Guardar Auditoría',
        input: 'textarea',
        inputLabel: 'Notas u observaciones del reporte',
        inputPlaceholder: 'Escriba detalles adicionales (ej. Auditoría quincenal, incidencias críticas detectadas)...',
        inputAttributes: { 'aria-label': 'Notas de auditoría' },
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        preConfirm: (notes) => {
            return notes || '';
        }
    }).then(async (res) => {
        if (res.isConfirmed) {
            const startDate = document.getElementById('filter-start-date').value;
            const endDate = document.getElementById('filter-end-date').value;

            const auditData = {
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                summary: moduleState.reportData.summary,
                speedingEvents: moduleState.reportData.speedingEvents,
                safetyEvents: moduleState.reportData.safetyEvents,
                averageSpeeds: moduleState.reportData.averageSpeeds,
                notes: res.value
            };

            const saveRes = await saveTelemetryAudit(auditData);
            if (saveRes.success) {
                Swal.fire('Guardado', 'La auditoría para este rango de fechas se guardó exitosamente en Supabase.', 'success');
                loadSavedAuditsList();
            } else {
                Swal.fire('Error', 'Fallo al guardar la auditoría.', 'error');
            }
        }
    });
}

/**
 * Export to Excel using SheetJS
 */
function exportToExcel() {
    if (!moduleState.reportData) return;

    try {
        const wb = XLSX.utils.book_new();

        // 1. Sheet Summary
        const summaryData = [
            ['INDICADOR', 'VALOR'],
            ['Total Alertas Safety', moduleState.reportData.summary.totalSafetyEvents],
            ['Total Excesos de Velocidad (>100 km/h por >60s)', moduleState.reportData.summary.totalSpeedingEvents],
            ['Velocidad Promedio de la Flota', `${moduleState.reportData.summary.averageFleetSpeed} km/h`],
            ['Unidades Monitoreadas', moduleState.reportData.summary.monitoredVehicles]
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

        // 2. Sheet Speeding Events
        const speedingData = [
            ['VEHÍCULO', 'OPERADOR', 'FECHA/HORA', 'DURACIÓN (s)', 'VELOCIDAD MÁX (km/h)', 'LATITUD', 'LONGITUD', 'REFERENCIA', 'SISTEMA']
        ];
        moduleState.reportData.speedingEvents.forEach(e => {
            speedingData.push([
                e.vehicle,
                e.driver,
                new Date(e.time).toLocaleString(),
                e.duration,
                e.maxSpeed,
                e.lat || '',
                e.lng || '',
                e.address,
                e.source
            ]);
        });
        const wsSpeeding = XLSX.utils.aoa_to_sheet(speedingData);
        XLSX.utils.book_append_sheet(wb, wsSpeeding, 'Excesos Velocidad');

        // 3. Sheet Safety Events
        const safetyData = [
            ['FECHA/HORA', 'TIPO EVENTO', 'VEHÍCULO', 'OPERADOR', 'LATITUD', 'LONGITUD', 'SISTEMA']
        ];
        moduleState.reportData.safetyEvents.forEach(e => {
            safetyData.push([
                new Date(e.time).toLocaleString(),
                formatEventLabel(e.type),
                e.vehicle,
                e.driver,
                e.lat || '',
                e.lng || '',
                e.source
            ]);
        });
        const wsSafety = XLSX.utils.aoa_to_sheet(safetyData);
        XLSX.utils.book_append_sheet(wb, wsSafety, 'Eventos Safety');

        // 4. Sheet Average Speeds
        const speedData = [
            ['VEHÍCULO', 'VELOCIDAD PROMEDIO (km/h)', 'DISTANCIA RECORRIDA (km)', 'HORAS OPERACIÓN', 'SISTEMA']
        ];
        moduleState.reportData.averageSpeeds.forEach(v => {
            speedData.push([
                v.vehicle,
                v.avgSpeed,
                v.distanceKm,
                v.hours,
                v.source
            ]);
        });
        const wsSpeeds = XLSX.utils.aoa_to_sheet(speedData);
        XLSX.utils.book_append_sheet(wb, wsSpeeds, 'Velocidades Promedio');

        // Save file
        const filename = `Reporte_Telemetria_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'No se pudo generar el reporte de Excel.', 'error');
    }
}

/**
 * Format helper for durations (seconds to human readable)
 */
function formatDuration(sec) {
    if (!sec || isNaN(sec)) return '-';
    if (sec < 60) return `${Math.round(sec)}s`;
    const min = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${min}m ${s}s`;
}

/**
 * Format helper for event labels
 */
function formatEventLabel(type) {
    const map = {
        'speeding': 'Exceso de Velocidad',
        'harshBrake': 'Frenado Brusco',
        'harshAcceleration': 'Aceleración Brusca',
        'distraction': 'Conducción Distraída',
        'distractedDriving': 'Conducción Distraída',
        'phoneUsage': 'Uso de Celular',
        'mobileUsage': 'Uso de Celular',
        'drowsiness': 'Somnolencia / Fatiga',
        'unbuckled': 'Sin Cinturón',
        'noSeatbelt': 'Sin Cinturón',
        'forwardCollision': 'Alerta Colisión Frontal',
        'laneDeparture': 'Salida de Carril',
        'crash': 'Colisión / Choque'
    };
    return map[type] || type;
}
