// assets/js/modules/telemetry.js
import { getTelemetryReport, saveTelemetryAudit, getTelemetryAudits, deleteTelemetryAudit } from '../services/telemetry.js';
import { supabase } from '../services/supabaseClient.js';

// Local module state
const moduleState = {
    reportData: null,
    filteredData: null,
    savedAudits: [],
    loading: false,
    activeTab: 'samsara', // 'samsara', 'enlace', 'general', 'audits'
    charts: {
        samsara: {
            speeding: null,
            avgSpeed: null,
            harshBrake: null,
            harshAccel: null,
            phoneUsage: null,
            drowsiness: null,
            unbuckled: null,
            collision: null,
            passenger: null
        },
        enlace: {
            speeding: null,
            avgSpeed: null,
            harshBrake: null,
            harshAccel: null,
            phoneUsage: null,
            drowsiness: null,
            unbuckled: null,
            collision: null,
            passenger: null
        }
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

                <!-- Dynamic Filters Row (Visible after loading) -->
                <div id="dynamic-filters-row" class="hidden border-t border-slate-100 pt-4 mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <!-- Unit Filter -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Filtrar por Unidad</label>
                        <select id="filter-unit" class="w-full border-2 border-slate-100 focus:border-indigo-500 outline-none p-2.5 rounded-xl font-semibold text-slate-700 bg-slate-50 transition">
                            <option value="all">Todas las Unidades</option>
                        </select>
                    </div>
                    
                    <!-- Operator Filter (Custom Multiselect dropdown) -->
                    <div class="relative">
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Filtrar por Operador(es)</label>
                        <button id="btn-operator-select" class="w-full border-2 border-slate-100 focus:border-indigo-500 outline-none p-2.5 rounded-xl font-semibold text-slate-700 bg-slate-50 transition text-left flex justify-between items-center text-xs">
                            <span id="selected-operators-label">Todos los Operadores</span>
                            <i class="fas fa-chevron-down text-slate-400"></i>
                        </button>
                        <div id="operator-select-dropdown" class="hidden absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto p-3 space-y-2">
                            <input type="text" id="search-operators" placeholder="Buscar operador..." class="w-full border border-slate-200 p-1.5 rounded-lg text-xs mb-2">
                            <div id="operator-checkboxes" class="space-y-1.5 max-h-40 overflow-y-auto">
                                <!-- Checkboxes will be populated dynamically -->
                            </div>
                        </div>
                    </div>

                    <!-- Reset Filters Button -->
                    <div class="flex items-end">
                        <button id="btn-reset-filters" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 px-6 rounded-xl transition text-xs flex items-center justify-center gap-2">
                            <i class="fas fa-filter-circle-xmark"></i> Limpiar Filtros
                        </button>
                    </div>
                </div>
            </div>

            <!-- Loader -->
            <div id="telemetry-loader" class="hidden py-20 text-center text-slate-400 font-bold bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div class="spinner mb-4 border-t-indigo-600 w-10 h-10 mx-auto"></div>
                <div class="text-sm uppercase tracking-wider text-slate-500">Consultando APIs en paralelo...</div>
                <p class="text-xs text-slate-400 font-semibold mt-1.5">Esto puede tardar unos segundos</p>
            </div>

            <!-- Dashboard Content Container (Visible once loaded) -->
            <div id="telemetry-content" class="hidden space-y-6">
                
                <!-- Tabs navigation -->
                <div class="border-b border-slate-200 flex gap-2 overflow-x-auto">
                    <button data-tab="samsara" class="tab-btn py-2.5 px-5 font-black text-xs uppercase tracking-widest border-b-2 border-indigo-600 text-indigo-600 focus:outline-none whitespace-nowrap">
                        <i class="fas fa-server mr-1"></i> Samsara Telemetría
                    </button>
                    <button data-tab="enlace" class="tab-btn py-2.5 px-5 font-bold text-xs uppercase tracking-widest border-b-2 border-transparent text-slate-400 hover:text-slate-600 focus:outline-none whitespace-nowrap">
                        <i class="fas fa-satellite mr-1"></i> Enlace FL Telemetría
                    </button>
                    <button data-tab="general" class="tab-btn py-2.5 px-5 font-bold text-xs uppercase tracking-widest border-b-2 border-transparent text-slate-400 hover:text-slate-600 focus:outline-none whitespace-nowrap">
                        <i class="fas fa-table mr-1"></i> Tabla Resumen
                    </button>
                    <button data-tab="audits" class="tab-btn py-2.5 px-5 font-bold text-xs uppercase tracking-widest border-b-2 border-transparent text-slate-400 hover:text-slate-600 focus:outline-none whitespace-nowrap">
                        <i class="fas fa-folder-open mr-1"></i> Auditorías
                    </button>
                </div>

                <!-- TAB: SAMSARA -->
                <div id="tab-samsara" class="tab-content space-y-6">
                    <!-- Stats Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div class="h-12 w-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl font-bold">
                                <i class="fas fa-shield-halved"></i>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Alertas Safety</p>
                                <p id="sam-stat-safety" class="text-2xl font-black text-slate-800">0</p>
                            </div>
                        </div>
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div class="h-12 w-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center text-xl font-bold">
                                <i class="fas fa-gauge-high"></i>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Excesos Velocidad</p>
                                <p id="sam-stat-speeding" class="text-2xl font-black text-slate-800">0</p>
                            </div>
                        </div>
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div class="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl font-bold">
                                <i class="fas fa-tachometer-alt"></i>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Velocidad Promedio</p>
                                <p id="sam-stat-avg-speed" class="text-2xl font-black text-slate-800">0 km/h</p>
                            </div>
                        </div>
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div class="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl font-bold">
                                <i class="fas fa-truck-moving"></i>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unidades Activas</p>
                                <p id="sam-stat-vehicles" class="text-2xl font-black text-slate-800">0</p>
                            </div>
                        </div>
                    </div>

                    <!-- Charts: Speed and Performance -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Chart 1: Speeding Events by Unit -->
                        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[260px]">
                            <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-1.5"><i class="fas fa-gauge-high text-rose-500"></i> Excesos de Velocidad por Unidad</h4>
                            <div class="flex-1 relative">
                                <canvas id="chart-sam-speeding"></canvas>
                            </div>
                        </div>

                        <!-- Chart 2: Avg Speed by Unit -->
                        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[260px]">
                            <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-1.5"><i class="fas fa-tachometer-alt text-emerald-500"></i> Velocidad Promedio (km/h)</h4>
                            <div class="flex-1 relative">
                                <canvas id="chart-sam-avg-speeds"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Safety Events Section Title -->
                    <div class="border-t border-slate-200 pt-6">
                        <h4 class="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                            <i class="fas fa-shield-halved text-amber-500"></i> Detalle de Alertas Safety por Tipo y Unidad
                        </h4>
                        <p class="text-[10px] text-slate-400 mt-1 font-semibold">Gráficos de barras que muestran la cantidad de alertas específicas de seguridad por cada vehículo.</p>
                    </div>

                    <!-- Safety Charts Grid (7 charts) -->
                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px]">
                            <div class="flex-1 relative">
                                <canvas id="chart-sam-safety-brake"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px]">
                            <div class="flex-1 relative">
                                <canvas id="chart-sam-safety-accel"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px]">
                            <div class="flex-1 relative">
                                <canvas id="chart-sam-safety-phone"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px]">
                            <div class="flex-1 relative">
                                <canvas id="chart-sam-safety-drowsiness"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px]">
                            <div class="flex-1 relative">
                                <canvas id="chart-sam-safety-unbuckled"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px]">
                            <div class="flex-1 relative">
                                <canvas id="chart-sam-safety-collision"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px] md:col-span-2 xl:col-span-1">
                            <div class="flex-1 relative">
                                <canvas id="chart-sam-safety-passenger"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Tables Grid -->
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <!-- Speeding table -->
                        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                            <div class="p-4 border-b border-slate-100 bg-slate-50/50">
                                <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest"><i class="fas fa-gauge-high text-rose-600 mr-1.5"></i> Excesos de Velocidad (>100 km/h por >60s)</h4>
                            </div>
                            <div class="overflow-x-auto max-h-[320px] custom-scrollbar">
                                <table class="w-full text-left border-collapse text-xs">
                                    <thead class="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-3">Unidad</th>
                                            <th class="p-3">Operador</th>
                                            <th class="p-3">Fecha/Hora</th>
                                            <th class="p-3 text-center">Duración</th>
                                            <th class="p-3 text-center">Velocidad</th>
                                            <th class="p-3 text-center">Mapa</th>
                                        </tr>
                                    </thead>
                                    <tbody id="table-sam-speeding-body" class="divide-y divide-slate-100">
                                        <tr><td colspan="6" class="p-8 text-center text-slate-400">Cargue datos para visualizar</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <!-- Safety table -->
                        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                            <div class="p-4 border-b border-slate-100 bg-slate-50/50">
                                <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest"><i class="fas fa-shield-halved text-amber-500 mr-1.5"></i> Registro de Eventos Safety</h4>
                            </div>
                            <div class="overflow-x-auto max-h-[320px] custom-scrollbar">
                                <table class="w-full text-left border-collapse text-xs">
                                    <thead class="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-3">Fecha/Hora</th>
                                            <th class="p-3">Evento</th>
                                            <th class="p-3">Unidad</th>
                                            <th class="p-3">Operador</th>
                                            <th class="p-3 text-center">Mapa</th>
                                        </tr>
                                    </thead>
                                    <tbody id="table-sam-safety-body" class="divide-y divide-slate-100">
                                        <tr><td colspan="5" class="p-8 text-center text-slate-400">Cargue datos para visualizar</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TAB: ENLACE FL -->
                <div id="tab-enlace" class="tab-content hidden-section space-y-6">
                    <!-- Stats Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div class="h-12 w-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl font-bold">
                                <i class="fas fa-shield-halved"></i>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Alertas Safety</p>
                                <p id="enl-stat-safety" class="text-2xl font-black text-slate-800">0</p>
                            </div>
                        </div>
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div class="h-12 w-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center text-xl font-bold">
                                <i class="fas fa-gauge-high"></i>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Excesos Velocidad</p>
                                <p id="enl-stat-speeding" class="text-2xl font-black text-slate-800">0</p>
                            </div>
                        </div>
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div class="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl font-bold">
                                <i class="fas fa-tachometer-alt"></i>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Velocidad Promedio</p>
                                <p id="enl-stat-avg-speed" class="text-2xl font-black text-slate-800">0 km/h</p>
                            </div>
                        </div>
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div class="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl font-bold">
                                <i class="fas fa-truck-moving"></i>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unidades Activas</p>
                                <p id="enl-stat-vehicles" class="text-2xl font-black text-slate-800">0</p>
                            </div>
                        </div>
                    </div>

                    <!-- Charts: Speed and Performance -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Chart 1: Speeding Events by Unit -->
                        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[260px]">
                            <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-1.5"><i class="fas fa-gauge-high text-rose-500"></i> Excesos de Velocidad por Unidad</h4>
                            <div class="flex-1 relative">
                                <canvas id="chart-enl-speeding"></canvas>
                            </div>
                        </div>

                        <!-- Chart 2: Avg Speed by Unit -->
                        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[260px]">
                            <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-1.5"><i class="fas fa-tachometer-alt text-emerald-500"></i> Velocidad Promedio (km/h)</h4>
                            <div class="flex-1 relative">
                                <canvas id="chart-enl-avg-speeds"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Safety Events Section Title -->
                    <div class="border-t border-slate-200 pt-6">
                        <h4 class="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                            <i class="fas fa-shield-halved text-amber-500"></i> Detalle de Alertas Safety por Tipo y Unidad
                        </h4>
                        <p class="text-[10px] text-slate-400 mt-1 font-semibold">Gráficos de barras que muestran la cantidad de alertas específicas de seguridad por cada vehículo.</p>
                    </div>

                    <!-- Safety Charts Grid (7 charts) -->
                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px]">
                            <div class="flex-1 relative">
                                <canvas id="chart-enl-safety-brake"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px]">
                            <div class="flex-1 relative">
                                <canvas id="chart-enl-safety-accel"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px]">
                            <div class="flex-1 relative">
                                <canvas id="chart-enl-safety-phone"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px]">
                            <div class="flex-1 relative">
                                <canvas id="chart-enl-safety-drowsiness"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px]">
                            <div class="flex-1 relative">
                                <canvas id="chart-enl-safety-unbuckled"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px]">
                            <div class="flex-1 relative">
                                <canvas id="chart-enl-safety-collision"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[220px] md:col-span-2 xl:col-span-1">
                            <div class="flex-1 relative">
                                <canvas id="chart-enl-safety-passenger"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Tables Grid -->
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <!-- Speeding table -->
                        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                            <div class="p-4 border-b border-slate-100 bg-slate-50/50">
                                <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest"><i class="fas fa-gauge-high text-rose-600 mr-1.5"></i> Excesos de Velocidad (>100 km/h por >60s)</h4>
                            </div>
                            <div class="overflow-x-auto max-h-[320px] custom-scrollbar">
                                <table class="w-full text-left border-collapse text-xs">
                                    <thead class="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-3">Unidad</th>
                                            <th class="p-3">Operador</th>
                                            <th class="p-3">Fecha/Hora</th>
                                            <th class="p-3 text-center">Duración</th>
                                            <th class="p-3 text-center">Velocidad</th>
                                            <th class="p-3 text-center">Mapa</th>
                                        </tr>
                                    </thead>
                                    <tbody id="table-enl-speeding-body" class="divide-y divide-slate-100">
                                        <tr><td colspan="6" class="p-8 text-center text-slate-400">Cargue datos para visualizar</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <!-- Safety table -->
                        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                            <div class="p-4 border-b border-slate-100 bg-slate-50/50">
                                <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest"><i class="fas fa-shield-halved text-amber-500 mr-1.5"></i> Registro de Eventos Safety</h4>
                            </div>
                            <div class="overflow-x-auto max-h-[320px] custom-scrollbar">
                                <table class="w-full text-left border-collapse text-xs">
                                    <thead class="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-3">Fecha/Hora</th>
                                            <th class="p-3">Evento</th>
                                            <th class="p-3">Unidad</th>
                                            <th class="p-3">Operador</th>
                                            <th class="p-3 text-center">Mapa</th>
                                        </tr>
                                    </thead>
                                    <tbody id="table-enl-safety-body" class="divide-y divide-slate-100">
                                        <tr><td colspan="5" class="p-8 text-center text-slate-400">Cargue datos para visualizar</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TAB: GENERAL TABLE -->
                <div id="tab-general" class="tab-content hidden-section bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div class="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest"><i class="fas fa-table text-slate-600 mr-1.5"></i> Tabla General Consolidad de Conducta y Excesos de Velocidad</h4>
                    </div>
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-left border-collapse text-[11px] min-w-[1200px]">
                            <thead class="bg-slate-100 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th class="p-3" rowspan="2">Sistema</th>
                                    <th class="p-3" rowspan="2">Unidad</th>
                                    <th class="p-3" rowspan="2">Operador</th>
                                    <th class="p-3 text-center border-b border-slate-200" colspan="4">Excesos de Velocidad (Rangos)</th>
                                    <th class="p-3 text-center text-rose-600 border-b border-slate-200" rowspan="2">Vel. Máx</th>
                                    <th class="p-3 text-center border-b border-slate-200" colspan="7">Alertas de Seguridad (Safety)</th>
                                </tr>
                                <tr class="bg-slate-50 text-[10px] text-slate-400 border-b border-slate-100">
                                    <th class="p-2 text-center">Leve<br>(101-105)</th>
                                    <th class="p-2 text-center">Moderado<br>(106-110)</th>
                                    <th class="p-2 text-center">Grave<br>(111-120)</th>
                                    <th class="p-2 text-center">Muy Grave<br>(>120)</th>
                                    
                                    <th class="p-2 text-center">Frenado<br>Brusco</th>
                                    <th class="p-2 text-center">Acel.<br>Brusca</th>
                                    <th class="p-2 text-center">Celular /<br>Distracción</th>
                                    <th class="p-2 text-center">Somno-<br>lencia</th>
                                    <th class="p-2 text-center">Sin<br>Cinturón</th>
                                    <th class="p-2 text-center">Colisión</th>
                                    <th class="p-2 text-center">Otros</th>
                                </tr>
                            </thead>
                            <tbody id="table-general-body" class="divide-y divide-slate-100">
                                <tr><td colspan="15" class="p-8 text-center text-slate-400">Cargue datos para visualizar</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- TAB: SAVED AUDITS -->
                <div id="tab-audits" class="tab-content hidden-section bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div class="p-4 border-b border-slate-100 bg-slate-50/50">
                        <h4 class="text-xs font-black text-slate-600 uppercase tracking-widest"><i class="fas fa-folder-open text-indigo-600 mr-1.5"></i> Consultas Guardadas para Auditoría (Supabase)</h4>
                    </div>
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead class="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                                <tr>
                                    <th class="p-3">Fecha Creación</th>
                                    <th class="p-3">Rango Consultado</th>
                                    <th class="p-3 text-center">Samsara Safety</th>
                                    <th class="p-3 text-center">Samsara Excesos</th>
                                    <th class="p-3 text-center">Enlace Safety</th>
                                    <th class="p-3 text-center">Enlace Excesos</th>
                                    <th class="p-3">Auditor / Notas</th>
                                    <th class="p-3 text-center">Cargar</th>
                                    <th class="p-3 text-center">Eliminar</th>
                                </tr>
                            </thead>
                            <tbody id="table-audits-body" class="divide-y divide-slate-100">
                                <tr><td colspan="9" class="p-8 text-center text-slate-400">No hay auditorías guardadas</td></tr>
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

    // Dynamic filters logic
    const btnOperatorSelect = document.getElementById('btn-operator-select');
    const operatorDropdown = document.getElementById('operator-select-dropdown');
    
    btnOperatorSelect.addEventListener('click', (e) => {
        e.stopPropagation();
        operatorDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!btnOperatorSelect.contains(e.target) && !operatorDropdown.contains(e.target)) {
            operatorDropdown.classList.add('hidden');
        }
    });

    document.getElementById('search-operators').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const labels = document.querySelectorAll('#operator-checkboxes label');
        labels.forEach(label => {
            if (label.innerText.toLowerCase().includes(query)) {
                label.style.display = 'flex';
            } else {
                label.style.display = 'none';
            }
        });
    });

    document.getElementById('operator-checkboxes').addEventListener('change', () => {
        const checked = document.querySelectorAll('.operator-checkbox:checked');
        const label = document.getElementById('selected-operators-label');
        if (checked.length === 0) {
            label.innerText = 'Todos los Operadores';
        } else if (checked.length === 1) {
            label.innerText = checked[0].value;
        } else {
            label.innerText = `${checked.length} Operadores`;
        }
        applyFilters();
    });

    document.getElementById('filter-unit').addEventListener('change', applyFilters);
    document.getElementById('btn-reset-filters').addEventListener('click', () => {
        document.getElementById('filter-unit').value = 'all';
        const checkboxes = document.querySelectorAll('.operator-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        document.getElementById('selected-operators-label').innerText = 'Todos los Operadores';
        applyFilters();
    });

    // Tab switcher
    const tabBtns = container.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
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
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);

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

    document.getElementById('telemetry-loader').classList.remove('hidden');
    document.getElementById('telemetry-content').classList.add('hidden');
    document.getElementById('btn-save-audit').classList.add('hidden');
    document.getElementById('btn-export-excel').classList.add('hidden');

    try {
        const report = await getTelemetryReport(startDate, endDate);
        moduleState.reportData = report;

        // Populate dynamic unit/operator filters
        populateFilterControls(report);

        // Apply filters (defaults to 'All')
        applyFilters();

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
 * Populate dynamic Units and Operators filter checkboxes
 */
function populateFilterControls(report) {
    const unitSelect = document.getElementById('filter-unit');
    const operatorCheckboxes = document.getElementById('operator-checkboxes');
    
    const units = new Set();
    const operators = new Set();

    const collectData = (sysData) => {
        sysData.speedingEvents.forEach(e => {
            if (e.vehicle) units.add(e.vehicle);
            if (e.driver && e.driver !== 'No Identificado') operators.add(e.driver);
        });
        sysData.safetyEvents.forEach(e => {
            if (e.vehicle) units.add(e.vehicle);
            if (e.driver && e.driver !== 'No Identificado') operators.add(e.driver);
        });
        sysData.averageSpeeds.forEach(v => {
            if (v.vehicle) units.add(v.vehicle);
        });
    };

    collectData(report.samsara);
    collectData(report.enlace);

    // Populate Units select
    unitSelect.innerHTML = '<option value="all">Todas las Unidades</option>' + 
        Array.from(units).sort().map(u => `<option value="${u}">${u}</option>`).join('');

    // Populate Operators checkbox list
    const sortedOps = Array.from(operators).sort();
    if (sortedOps.length > 0) {
        operatorCheckboxes.innerHTML = sortedOps.map(op => `
            <label class="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer py-1 px-1 hover:bg-slate-50 rounded">
                <input type="checkbox" value="${op}" class="operator-checkbox rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                <span>${op}</span>
            </label>
        `).join('');
    } else {
        operatorCheckboxes.innerHTML = '<div class="text-[10px] text-slate-400 text-center py-2">Sin operadores</div>';
    }

    document.getElementById('selected-operators-label').innerText = 'Todos los Operadores';
    document.getElementById('dynamic-filters-row').classList.remove('hidden');
}

/**
 * Filter data locally in memory and re-render everything
 */
function applyFilters() {
    if (!moduleState.reportData) return;

    const unitFilter = document.getElementById('filter-unit').value;
    
    // Get checked operators
    const checkedOps = [];
    const checkboxes = document.querySelectorAll('.operator-checkbox:checked');
    checkboxes.forEach(cb => checkedOps.push(cb.value));

    const filterFn = (item) => {
        const matchesUnit = (unitFilter === 'all' || item.vehicle === unitFilter);
        const matchesOperator = (checkedOps.length === 0 || checkedOps.includes(item.driver));
        return matchesUnit && matchesOperator;
    };

    // Filtered data subset
    moduleState.filteredData = {
        summary: {
            samsara: { totalSafetyEvents: 0, totalSpeedingEvents: 0, averageFleetSpeed: 0, monitoredVehicles: 0 },
            enlace: { totalSafetyEvents: 0, totalSpeedingEvents: 0, averageFleetSpeed: 0, monitoredVehicles: 0 }
        },
        samsara: {
            speedingEvents: moduleState.reportData.samsara.speedingEvents.filter(filterFn),
            safetyEvents: moduleState.reportData.samsara.safetyEvents.filter(filterFn),
            averageSpeeds: moduleState.reportData.samsara.averageSpeeds.filter(item => {
                return (unitFilter === 'all' || item.vehicle === unitFilter);
            })
        },
        enlace: {
            speedingEvents: moduleState.reportData.enlace.speedingEvents.filter(filterFn),
            safetyEvents: moduleState.reportData.enlace.safetyEvents.filter(filterFn),
            averageSpeeds: moduleState.reportData.enlace.averageSpeeds.filter(item => {
                return (unitFilter === 'all' || item.vehicle === unitFilter);
            })
        }
    };

    // Recalculate filtered stats
    // Samsara
    const samMonitored = new Set();
    moduleState.filteredData.samsara.speedingEvents.forEach(e => samMonitored.add(e.vehicle));
    moduleState.filteredData.samsara.safetyEvents.forEach(e => samMonitored.add(e.vehicle));
    moduleState.filteredData.samsara.averageSpeeds.forEach(e => samMonitored.add(e.vehicle));
    moduleState.filteredData.summary.samsara.monitoredVehicles = samMonitored.size;
    moduleState.filteredData.summary.samsara.totalSafetyEvents = moduleState.filteredData.samsara.safetyEvents.length;
    moduleState.filteredData.summary.samsara.totalSpeedingEvents = moduleState.filteredData.samsara.speedingEvents.length;

    let samSum = 0, samCount = 0;
    moduleState.filteredData.samsara.averageSpeeds.forEach(v => {
        if (v.avgSpeed > 0) { samSum += v.avgSpeed; samCount++; }
    });
    moduleState.filteredData.summary.samsara.averageFleetSpeed = samCount > 0 ? Math.round(samSum / samCount) : 0;

    // Enlace
    const enlMonitored = new Set();
    moduleState.filteredData.enlace.speedingEvents.forEach(e => enlMonitored.add(e.vehicle));
    moduleState.filteredData.enlace.safetyEvents.forEach(e => enlMonitored.add(e.vehicle));
    moduleState.filteredData.enlace.averageSpeeds.forEach(e => enlMonitored.add(e.vehicle));
    moduleState.filteredData.summary.enlace.monitoredVehicles = enlMonitored.size;
    moduleState.filteredData.summary.enlace.totalSafetyEvents = moduleState.filteredData.enlace.safetyEvents.length;
    moduleState.filteredData.summary.enlace.totalSpeedingEvents = moduleState.filteredData.enlace.speedingEvents.length;

    let enlSum = 0, enlCount = 0;
    moduleState.filteredData.enlace.averageSpeeds.forEach(v => {
        if (v.avgSpeed > 0) { enlSum += v.avgSpeed; enlCount++; }
    });
    moduleState.filteredData.summary.enlace.averageFleetSpeed = enlCount > 0 ? Math.round(enlSum / enlCount) : 0;

    // Render components
    renderStats(moduleState.filteredData.summary);
    renderCharts(moduleState.filteredData);
    renderTables(moduleState.filteredData);
    renderGeneralTable(moduleState.filteredData);
}

/**
 * Render Cards Stats
 */
function renderStats(summary) {
    // Samsara
    document.getElementById('sam-stat-safety').innerText = summary.samsara.totalSafetyEvents;
    document.getElementById('sam-stat-speeding').innerText = summary.samsara.totalSpeedingEvents;
    document.getElementById('sam-stat-avg-speed').innerText = `${summary.samsara.averageFleetSpeed} km/h`;
    document.getElementById('sam-stat-vehicles').innerText = summary.samsara.monitoredVehicles;

    // Enlace
    document.getElementById('enl-stat-safety').innerText = summary.enlace.totalSafetyEvents;
    document.getElementById('enl-stat-speeding').innerText = summary.enlace.totalSpeedingEvents;
    document.getElementById('enl-stat-avg-speed').innerText = `${summary.enlace.averageFleetSpeed} km/h`;
    document.getElementById('enl-stat-vehicles').innerText = summary.enlace.monitoredVehicles;
}

/**
 * Helper to render individual safety event bar charts by unit
 */
function renderSafetyBarChart(ctxId, events, eventTypeKey, label, color, systemKey) {
    // Filter events matching the translated Spanish label
    const filteredEvents = events.filter(e => formatEventLabel(e.type) === label);

    // Count by unit
    const counts = {};
    filteredEvents.forEach(e => {
        counts[e.vehicle] = (counts[e.vehicle] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const totalEvents = values.reduce((sum, val) => sum + val, 0);

    const canvas = document.getElementById(ctxId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (moduleState.charts[systemKey][eventTypeKey]) {
        moduleState.charts[systemKey][eventTypeKey].destroy();
    }

    moduleState.charts[systemKey][eventTypeKey] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cantidad',
                data: values,
                backgroundColor: color,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `${label} (${totalEvents} total)`,
                    font: { size: 11, weight: 'bold' },
                    color: '#475569'
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { ticks: { font: { size: 9 } } }
            }
        }
    });
}

function renderSpeedingChart(canvasId, events, systemKey) {
    const counts = {};
    events.forEach(e => { counts[e.vehicle] = (counts[e.vehicle] || 0) + 1; });
    const labels = Object.keys(counts);
    const values = Object.values(counts);

    const ctx = document.getElementById(canvasId).getContext('2d');
    moduleState.charts[systemKey].speeding = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Excesos',
                data: values,
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
}

function renderAvgSpeedChart(canvasId, averageSpeeds, systemKey) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    moduleState.charts[systemKey].avgSpeed = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: averageSpeeds.map(v => v.vehicle),
            datasets: [{
                label: 'Velocidad Promedio (km/h)',
                data: averageSpeeds.map(v => v.avgSpeed),
                backgroundColor: '#10b981',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true },
                x: { ticks: { font: { size: 9 } } }
            }
        }
    });
}

/**
 * Render Charts via Chart.js
 */
function renderCharts(data) {
    // Destroy existing chart instances to prevent canvas ghosting
    const destroyCharts = (sys) => {
        if (moduleState.charts[sys].speeding) moduleState.charts[sys].speeding.destroy();
        if (moduleState.charts[sys].avgSpeed) moduleState.charts[sys].avgSpeed.destroy();
        if (moduleState.charts[sys].harshBrake) moduleState.charts[sys].harshBrake.destroy();
        if (moduleState.charts[sys].harshAccel) moduleState.charts[sys].harshAccel.destroy();
        if (moduleState.charts[sys].phoneUsage) moduleState.charts[sys].phoneUsage.destroy();
        if (moduleState.charts[sys].drowsiness) moduleState.charts[sys].drowsiness.destroy();
        if (moduleState.charts[sys].unbuckled) moduleState.charts[sys].unbuckled.destroy();
        if (moduleState.charts[sys].collision) moduleState.charts[sys].collision.destroy();
        if (moduleState.charts[sys].passenger) moduleState.charts[sys].passenger.destroy();
    };
    destroyCharts('samsara');
    destroyCharts('enlace');

    // -------------------------------------------------------------
    // SAMSARA CHARTS
    // -------------------------------------------------------------
    renderSpeedingChart('chart-sam-speeding', data.samsara.speedingEvents, 'samsara');
    renderAvgSpeedChart('chart-sam-avg-speeds', data.samsara.averageSpeeds, 'samsara');

    // 7 Safety charts breakdown for Samsara
    renderSafetyBarChart('chart-sam-safety-brake', data.samsara.safetyEvents, 'harshBrake', 'Frenado Brusco', '#f59e0b', 'samsara');
    renderSafetyBarChart('chart-sam-safety-accel', data.samsara.safetyEvents, 'harshAccel', 'Aceleración Brusca', '#eab308', 'samsara');
    renderSafetyBarChart('chart-sam-safety-phone', data.samsara.safetyEvents, 'phoneUsage', 'Uso de Celular', '#ef4444', 'samsara');
    renderSafetyBarChart('chart-sam-safety-drowsiness', data.samsara.safetyEvents, 'drowsiness', 'Somnolencia / Fatiga', '#8b5cf6', 'samsara');
    renderSafetyBarChart('chart-sam-safety-unbuckled', data.samsara.safetyEvents, 'unbuckled', 'Sin Cinturón de Seguridad', '#3b82f6', 'samsara');
    renderSafetyBarChart('chart-sam-safety-collision', data.samsara.safetyEvents, 'collision', 'Alerta de Colisión / Choque', '#dc2626', 'samsara');
    renderSafetyBarChart('chart-sam-safety-passenger', data.samsara.safetyEvents, 'passenger', 'Pasajero No Autorizado', '#6b7280', 'samsara');

    // -------------------------------------------------------------
    // ENLACE CHARTS
    // -------------------------------------------------------------
    renderSpeedingChart('chart-enl-speeding', data.enlace.speedingEvents, 'enlace');
    renderAvgSpeedChart('chart-enl-avg-speeds', data.enlace.averageSpeeds, 'enlace');

    // 7 Safety charts breakdown for Enlace
    renderSafetyBarChart('chart-enl-safety-brake', data.enlace.safetyEvents, 'harshBrake', 'Frenado Brusco', '#f59e0b', 'enlace');
    renderSafetyBarChart('chart-enl-safety-accel', data.enlace.safetyEvents, 'harshAccel', 'Aceleración Brusca', '#eab308', 'enlace');
    renderSafetyBarChart('chart-enl-safety-phone', data.enlace.safetyEvents, 'phoneUsage', 'Uso de Celular', '#ef4444', 'enlace');
    renderSafetyBarChart('chart-enl-safety-drowsiness', data.enlace.safetyEvents, 'drowsiness', 'Somnolencia / Fatiga', '#8b5cf6', 'enlace');
    renderSafetyBarChart('chart-enl-safety-unbuckled', data.enlace.safetyEvents, 'unbuckled', 'Sin Cinturón de Seguridad', '#3b82f6', 'enlace');
    renderSafetyBarChart('chart-enl-safety-collision', data.enlace.safetyEvents, 'collision', 'Alerta de Colisión / Choque', '#dc2626', 'enlace');
    renderSafetyBarChart('chart-enl-safety-passenger', data.enlace.safetyEvents, 'passenger', 'Pasajero No Autorizado', '#6b7280', 'enlace');
}

/**
 * Render Tables (Speeding, Safety)
 */
function renderTables(data) {
    const renderTableHtml = (events, type) => {
        if (events.length === 0) {
            return `<tr><td colspan="${type === 'speeding' ? 6 : 5}" class="p-8 text-center text-slate-400 font-semibold">Sin registros en este rango</td></tr>`;
        }
        
        if (type === 'speeding') {
            return events.map(e => `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-3 font-bold text-slate-800">${e.vehicle}</td>
                    <td class="p-3 text-slate-600 font-semibold">${e.driver}</td>
                    <td class="p-3 font-mono text-slate-500">${new Date(e.time).toLocaleString()}</td>
                    <td class="p-3 text-center text-rose-600 font-bold">${formatDuration(e.duration)}</td>
                    <td class="p-3 text-center text-slate-800 font-black">${e.maxSpeed} km/h</td>
                    <td class="p-3 text-center">
                        ${e.lat ? `
                            <a href="https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}" target="_blank" class="inline-flex h-7 w-7 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg items-center justify-center transition">
                                <i class="fas fa-map-location-dot"></i>
                            </a>
                        ` : '-'}
                    </td>
                </tr>
            `).join('');
        } else {
            return events.map(e => `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-3 font-mono text-slate-500">${new Date(e.time).toLocaleString()}</td>
                    <td class="p-3">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200/50 text-center">
                            ${formatEventLabel(e.type)}
                        </span>
                    </td>
                    <td class="p-3 font-bold text-slate-800">${e.vehicle}</td>
                    <td class="p-3 text-slate-600 font-semibold">${e.driver}</td>
                    <td class="p-3 text-center">
                        ${e.lat ? `
                            <a href="https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}" target="_blank" class="inline-flex h-7 w-7 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg items-center justify-center transition">
                                <i class="fas fa-map-location-dot"></i>
                            </a>
                        ` : '-'}
                    </td>
                </tr>
            `).join('');
        }
    };

    // Samsara
    document.getElementById('table-sam-speeding-body').innerHTML = renderTableHtml(data.samsara.speedingEvents, 'speeding');
    document.getElementById('table-sam-safety-body').innerHTML = renderTableHtml(data.samsara.safetyEvents, 'safety');

    // Enlace
    document.getElementById('table-enl-speeding-body').innerHTML = renderTableHtml(data.enlace.speedingEvents, 'speeding');
    document.getElementById('table-enl-safety-body').innerHTML = renderTableHtml(data.enlace.safetyEvents, 'safety');
}

/**
 * Render General Grouped Conduct Table
 */
function renderGeneralTable(filteredData) {
    const tableBody = document.getElementById('table-general-body');
    const grouped = {};

    const getGroup = (vehicle, driver, source) => {
        const key = `${source}_${vehicle}_${driver}`;
        if (!grouped[key]) {
            grouped[key] = {
                source,
                vehicle,
                driver,
                speeding: { leve: 0, moderado: 0, grave: 0, muy_grave: 0 },
                maxSpeed: 0,
                safety: {
                    harshBrake: 0,
                    harshAcceleration: 0,
                    phoneUsage: 0,
                    drowsiness: 0,
                    unbuckled: 0,
                    crash: 0,
                    other: 0
                }
            };
        }
        return grouped[key];
    };

    // Samsara Speeding
    filteredData.samsara.speedingEvents.forEach(e => {
        const g = getGroup(e.vehicle, e.driver, 'Samsara');
        g.speeding[e.severity] = (g.speeding[e.severity] || 0) + 1;
        g.maxSpeed = Math.max(g.maxSpeed, e.maxSpeed);
    });

    // Samsara Safety
    filteredData.samsara.safetyEvents.forEach(e => {
        const g = getGroup(e.vehicle, e.driver, 'Samsara');
        const type = e.type.toLowerCase();
        if (type.includes('brake') || type.includes('frenado') || type.includes('frenada')) g.safety.harshBrake++;
        else if (type.includes('accel') || type.includes('aceleracion') || type.includes('aceleración')) g.safety.harshAcceleration++;
        else if (type.includes('phone') || type.includes('celular') || type.includes('distract') || type.includes('camera') || type.includes('mobile') || type.includes('movil') || type.includes('móvil')) g.safety.phoneUsage++;
        else if (type.includes('drowsy') || type.includes('somnolencia') || type.includes('fatiga') || type.includes('sleep') || type.includes('bostezo')) g.safety.drowsiness++;
        else if (type.includes('seatbelt') || type.includes('cinturon') || type.includes('cinturón') || type.includes('unbuckled') || type.includes('belt')) g.safety.unbuckled++;
        else if (type.includes('crash') || type.includes('collision') || type.includes('colision') || type.includes('colisión') || type.includes('choque')) g.safety.crash++;
        else g.safety.other++;
    });

    // Enlace Speeding
    filteredData.enlace.speedingEvents.forEach(e => {
        const g = getGroup(e.vehicle, e.driver, 'Enlace');
        g.speeding[e.severity] = (g.speeding[e.severity] || 0) + 1;
        g.maxSpeed = Math.max(g.maxSpeed, e.maxSpeed);
    });

    // Enlace Safety
    filteredData.enlace.safetyEvents.forEach(e => {
        const g = getGroup(e.vehicle, e.driver, 'Enlace');
        const type = e.type.toLowerCase();
        if (type.includes('brake') || type.includes('frenado') || type.includes('frenada')) g.safety.harshBrake++;
        else if (type.includes('accel') || type.includes('aceleracion') || type.includes('aceleración')) g.safety.harshAcceleration++;
        else if (type.includes('phone') || type.includes('celular') || type.includes('distract') || type.includes('mobile') || type.includes('movil') || type.includes('móvil')) g.safety.phoneUsage++;
        else if (type.includes('drowsy') || type.includes('somnolencia') || type.includes('fatiga') || type.includes('sleep') || type.includes('bostezo')) g.safety.drowsiness++;
        else if (type.includes('seatbelt') || type.includes('cinturon') || type.includes('cinturón') || type.includes('unbuckled') || type.includes('belt')) g.safety.unbuckled++;
        else if (type.includes('crash') || type.includes('collision') || type.includes('colision') || type.includes('colisión') || type.includes('choque')) g.safety.crash++;
        else g.safety.other++;
    });

    const rows = Object.values(grouped);

    if (rows.length > 0) {
        tableBody.innerHTML = rows.map(r => `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${r.source === 'Samsara' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}">
                        ${r.source}
                    </span>
                </td>
                <td class="p-3 font-bold text-slate-800">${r.vehicle}</td>
                <td class="p-3 text-slate-600 font-semibold">${r.driver}</td>
                <td class="p-3 text-center text-slate-700 font-bold ${r.speeding.leve ? 'bg-rose-50/30' : ''}">${r.speeding.leve || '-'}</td>
                <td class="p-3 text-center text-slate-700 font-bold ${r.speeding.moderado ? 'bg-rose-50/50' : ''}">${r.speeding.moderado || '-'}</td>
                <td class="p-3 text-center text-slate-700 font-bold ${r.speeding.grave ? 'bg-rose-100/40' : ''}">${r.speeding.grave || '-'}</td>
                <td class="p-3 text-center text-slate-700 font-bold ${r.speeding.muy_grave ? 'bg-rose-100/70 text-rose-700' : ''}">${r.speeding.muy_grave || '-'}</td>
                <td class="p-3 text-center text-rose-600 font-black">${r.maxSpeed ? `${r.maxSpeed} km/h` : '-'}</td>
                <td class="p-3 text-center text-slate-600 font-medium">${r.safety.harshBrake || '-'}</td>
                <td class="p-3 text-center text-slate-600 font-medium">${r.safety.harshAcceleration || '-'}</td>
                <td class="p-3 text-center text-slate-600 font-medium">${r.safety.phoneUsage || '-'}</td>
                <td class="p-3 text-center text-slate-600 font-medium">${r.safety.drowsiness || '-'}</td>
                <td class="p-3 text-center text-slate-600 font-medium">${r.safety.unbuckled || '-'}</td>
                <td class="p-3 text-center text-slate-600 font-medium">${r.safety.crash || '-'}</td>
                <td class="p-3 text-center text-slate-400">${r.safety.other || '-'}</td>
            </tr>
        `).join('');
    } else {
        tableBody.innerHTML = `<tr><td colspan="15" class="p-8 text-center text-slate-400 font-semibold">Sin datos agrupados en este rango</td></tr>`;
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
                <td class="p-3 text-center font-bold text-amber-600">${a.summary?.samsara?.totalSafetyEvents || 0}</td>
                <td class="p-3 text-center font-bold text-rose-600">${a.summary?.samsara?.totalSpeedingEvents || 0}</td>
                <td class="p-3 text-center font-bold text-amber-600">${a.summary?.enlace?.totalSafetyEvents || 0}</td>
                <td class="p-3 text-center font-bold text-rose-600">${a.summary?.enlace?.totalSpeedingEvents || 0}</td>
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
        listBody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-400 font-semibold">No se han registrado auditorías para fechas específicas</td></tr>`;
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
            moduleState.reportData = {
                summary: audit.summary,
                samsara: audit.summary.samsara ? {
                    speedingEvents: audit.speeding_events?.samsara || [],
                    safetyEvents: audit.safety_events?.samsara || [],
                    averageSpeeds: audit.average_speeds?.samsara || []
                } : { speedingEvents: [], safetyEvents: [], averageSpeeds: [] },
                enlace: audit.summary.enlace ? {
                    speedingEvents: audit.speeding_events?.enlace || [],
                    safetyEvents: audit.safety_events?.enlace || [],
                    averageSpeeds: audit.average_speeds?.enlace || []
                } : { speedingEvents: [], safetyEvents: [], averageSpeeds: [] }
            };

            // Set inputs
            document.getElementById('filter-start-date').value = formatLocalDateTime(new Date(audit.start_date));
            document.getElementById('filter-end-date').value = formatLocalDateTime(new Date(audit.end_date));
            document.getElementById('filter-preset').value = 'custom';

            // Populate controls & render
            populateFilterControls(moduleState.reportData);
            applyFilters();

            document.getElementById('telemetry-loader').classList.add('hidden');
            document.getElementById('telemetry-content').classList.remove('hidden');
            document.getElementById('btn-save-audit').classList.add('hidden'); // Disable saving again
            document.getElementById('btn-export-excel').classList.remove('hidden');

            const tabBtns = document.querySelectorAll('.tab-btn');
            switchTab('samsara', tabBtns);

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
        inputPlaceholder: 'Escriba detalles adicionales...',
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar'
    }).then(async (res) => {
        if (res.isConfirmed) {
            const startDate = document.getElementById('filter-start-date').value;
            const endDate = document.getElementById('filter-end-date').value;

            // Structure data to split samsara/enlace in JSONB
            const auditData = {
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                summary: moduleState.reportData.summary,
                speedingEvents: {
                    samsara: moduleState.reportData.samsara.speedingEvents,
                    enlace: moduleState.reportData.enlace.speedingEvents
                },
                safetyEvents: {
                    samsara: moduleState.reportData.samsara.safetyEvents,
                    enlace: moduleState.reportData.enlace.safetyEvents
                },
                averageSpeeds: {
                    samsara: moduleState.reportData.samsara.averageSpeeds,
                    enlace: moduleState.reportData.enlace.averageSpeeds
                },
                notes: res.value
            };

            const saveRes = await saveTelemetryAudit(auditData);
            if (saveRes.success) {
                Swal.fire('Guardado', 'La auditoría se guardó exitosamente en Supabase.', 'success');
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
    if (!moduleState.filteredData) return;

    try {
        const wb = XLSX.utils.book_new();

        // 1. Sheet Summary
        const summaryData = [
            ['INDICADOR', 'SAMSARA', 'ENLACE FL'],
            ['Total Alertas Safety', moduleState.filteredData.summary.samsara.totalSafetyEvents, moduleState.filteredData.summary.enlace.totalSafetyEvents],
            ['Total Excesos de Velocidad (>100 km/h por >60s)', moduleState.filteredData.summary.samsara.totalSpeedingEvents, moduleState.filteredData.summary.enlace.totalSpeedingEvents],
            ['Velocidad Promedio de la Flota', `${moduleState.filteredData.summary.samsara.averageFleetSpeed} km/h`, `${moduleState.filteredData.summary.enlace.averageFleetSpeed} km/h`],
            ['Unidades Monitoreadas', moduleState.filteredData.summary.samsara.monitoredVehicles, moduleState.filteredData.summary.enlace.monitoredVehicles]
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

        // 2. Sheet Samsara Speeding
        const samSpeedingData = [
            ['VEHÍCULO', 'OPERADOR', 'FECHA/HORA', 'DURACIÓN (s)', 'VELOCIDAD MÁX (km/h)', 'SEVERIDAD', 'LATITUD', 'LONGITUD', 'REFERENCIA']
        ];
        moduleState.filteredData.samsara.speedingEvents.forEach(e => {
            samSpeedingData.push([
                e.vehicle, e.driver, new Date(e.time).toLocaleString(), e.duration, e.maxSpeed, e.severity, e.lat || '', e.lng || '', e.address
            ]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(samSpeedingData), 'Excesos Samsara');

        // 3. Sheet Enlace Speeding
        const enlSpeedingData = [
            ['VEHÍCULO', 'OPERADOR', 'FECHA/HORA', 'DURACIÓN (s)', 'VELOCIDAD MÁX (km/h)', 'SEVERIDAD', 'LATITUD', 'LONGITUD', 'REFERENCIA']
        ];
        moduleState.filteredData.enlace.speedingEvents.forEach(e => {
            enlSpeedingData.push([
                e.vehicle, e.driver, new Date(e.time).toLocaleString(), e.duration, e.maxSpeed, e.severity, e.lat || '', e.lng || '', e.address
            ]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(enlSpeedingData), 'Excesos Enlace');

        // 4. Sheet Samsara Safety
        const samSafetyData = [
            ['FECHA/HORA', 'TIPO EVENTO', 'VEHÍCULO', 'OPERADOR', 'LATITUD', 'LONGITUD', 'REFERENCIA']
        ];
        moduleState.filteredData.samsara.safetyEvents.forEach(e => {
            samSafetyData.push([
                new Date(e.time).toLocaleString(), formatEventLabel(e.type), e.vehicle, e.driver, e.lat || '', e.lng || '', e.address || ''
            ]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(samSafetyData), 'Safety Samsara');

        // 5. Sheet Enlace Safety
        const enlSafetyData = [
            ['FECHA/HORA', 'TIPO EVENTO', 'VEHÍCULO', 'OPERADOR', 'LATITUD', 'LONGITUD', 'REFERENCIA']
        ];
        moduleState.filteredData.enlace.safetyEvents.forEach(e => {
            enlSafetyData.push([
                new Date(e.time).toLocaleString(), formatEventLabel(e.type), e.vehicle, e.driver, e.lat || '', e.lng || '', e.address || ''
            ]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(enlSafetyData), 'Safety Enlace');

        // Save file
        const filename = `Reporte_Telemetria_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'No se pudo generar el reporte de Excel.', 'error');
    }
}

/**
 * Format helper for durations
 */
function formatDuration(sec) {
    if (!sec || isNaN(sec)) return '-';
    if (sec < 60) return `${Math.round(sec)}s`;
    const min = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${min}m ${s}s`;
}

/**
 * Format helper for event labels to ensure complete Spanish translations
 */
function formatEventLabel(type) {
    if (!type) return 'Desconocido';
    const lower = type.toLowerCase();
    
    // Check for substrings first (extremely robust)
    if (lower.includes('brake') || lower.includes('frenado') || lower.includes('frenada')) return 'Frenado Brusco';
    if (lower.includes('accel') || lower.includes('aceleracion') || lower.includes('aceleración')) return 'Aceleración Brusca';
    if (lower.includes('phone') || lower.includes('celular') || lower.includes('mobile') || lower.includes('movil') || lower.includes('móvil')) return 'Uso de Celular';
    if (lower.includes('distract') || lower.includes('distracc')) return 'Conducción Distraída';
    if (lower.includes('drowsy') || lower.includes('fatiga') || lower.includes('somnolencia') || lower.includes('sleep') || lower.includes('bostezo') || lower.includes('yawn')) return 'Somnolencia / Fatiga';
    if (lower.includes('seatbelt') || lower.includes('cinturon') || lower.includes('cinturón') || lower.includes('unbuckled') || lower.includes('belt')) return 'Sin Cinturón de Seguridad';
    if (lower.includes('passenger') || lower.includes('pasajero') || lower.includes('unauthorized')) return 'Pasajero No Autorizado';
    if (lower.includes('collision') || lower.includes('colision') || lower.includes('colisión') || lower.includes('crash') || lower.includes('choque')) return 'Alerta de Colisión / Choque';
    if (lower.includes('lane') || lower.includes('carril')) return 'Salida de Carril';
    if (lower.includes('speed') || lower.includes('velocidad')) return 'Exceso de Velocidad';
    
    const map = {
        'harshbrake': 'Frenado Brusco',
        'harshacceleration': 'Aceleración Brusca',
        'distraction': 'Conducción Distraída',
        'phoneusage': 'Uso de Celular',
        'drowsiness': 'Somnolencia / Fatiga',
        'unbuckled': 'Sin Cinturón',
        'forwardcollision': 'Alerta Colisión Frontal',
        'lanedeparture': 'Salida de Carril',
        'crash': 'Colisión / Choque'
    };
    return map[lower] || type;
}
