import { supabase } from '../services/supabaseClient.js';

export async function renderIncidents(container) {
    container.innerHTML = `
        <div id="view-incidents" class="p-6 fade-in h-full flex flex-col gap-6">
            <div class="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-red-100">
                <h3 class="text-xl font-bold text-gray-800"><i class="fas fa-exclamation-triangle text-red-500 mr-2"></i> Incidencias Automáticas</h3>
                    <button id="btn-new-incident" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-md transition font-bold flex items-center gap-2">
                        <i class="fas fa-plus"></i> Nuevo Registro
                    </button>
                    <button id="btn-settings" class="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg shadow-md transition font-bold flex items-center gap-2">
                        <i class="fas fa-cog"></i> Ajustes Semáforo
                    </button>
                    <button id="btn-refresh-incidents" class="bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg transition font-bold">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
            </div>

            <!-- Dashboard Widgets row -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
                <!-- Stats -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center">
                    <div class="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">Total Incidencias (30 días)</div>
                    <div class="text-4xl font-black text-gray-800" id="incidents-total">0</div>
                    <div class="text-sm font-bold mt-2 text-red-500" id="incidents-unresolved">0 Sin resolver</div>
                </div>

                <!-- Chart container: Takes 2 cols -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:col-span-2 h-48">
                    <canvas id="incidentsChart"></canvas>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
                <div class="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h4 class="font-bold text-gray-700">Historial de Incidencias</h4>
                    <select id="filter-status" class="border p-2 rounded-lg text-sm outline-none focus:border-red-500">
                        <option value="">Todos los estados...</option>
                        <option value="false">Pendientes</option>
                        <option value="true">Resueltas</option>
                    </select>
                </div>
                <div class="overflow-auto flex-1 p-0 custom-scrollbar">
                    <table class="w-full text-left border-collapse min-w-[1000px]">
                        <thead class="bg-white sticky top-0 shadow-sm z-10">
                            <tr class="text-xs uppercase tracking-wider text-gray-500 border-b">
                                <th class="p-4 font-bold">Fecha / Hora</th>
                                <th class="p-4 font-bold">Unidad / Operador</th>
                                <th class="p-4 font-bold">Infracción(es)</th>
                                <th class="p-4 font-bold text-center">Nivel</th>
                                <th class="p-4 font-bold text-center">Ubicación GPS</th>
                                <th class="p-4 font-bold text-center">Estado</th>
                                <th class="p-4 font-bold">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="incidents-body" class="divide-y divide-gray-100">
                            <tr><td colspan="7" class="p-8 text-center text-gray-400 font-medium">Cargando incidencias... <i class="fas fa-spinner fa-spin"></i></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div id="modal-container"></div>
        </div>
    `;

    document.getElementById('btn-new-incident').addEventListener('click', openNewIncidentModal);
    document.getElementById('btn-refresh-incidents').addEventListener('click', loadData);
    document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
    document.getElementById('filter-status').addEventListener('change', () => renderTable(window.currentIncidentsList));

    await loadData();
}

let chartInstance = null;

async function loadData() {
    const tbody = document.getElementById('incidents-body');
    const { data: thresholdsObj } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'traffic_light_thresholds').single();
    
    // Default config if DB empty
    let thresholds = { yellow: 1, red: 2 };
    if (thresholdsObj && thresholdsObj.setting_value) {
        thresholds = thresholdsObj.setting_value;
    }

    const { data, error } = await supabase
        .from('incidents')
        .select('*, units(economic_number), operators(name)')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 font-bold">${error.message}</td></tr>`;
        return;
    }

    // Attach thresholds for the UI
    window.currentIncidentsList = data;
    window.currentThresholds = thresholds;

    // Fetch units, ops, and incident types for the manual modal
    const { data: units } = await supabase.from('units').select('id, economic_number').order('economic_number');
    const { data: ops } = await supabase.from('operators').select('id, name').order('name');
    const { data: types } = await supabase.from('incident_types').select('name').order('name');
    window.allUnitsData = units || [];
    window.allOpsData = ops || [];
    window.allIncidentTypes = types || [];

    // Update Stats
    document.getElementById('incidents-total').innerText = data.length;
    document.getElementById('incidents-unresolved').innerText = `${data.filter(i => !i.resolved).length} Pendientes`;

    renderTable(data);
    renderChart(data);
}

function renderTable(data) {
    const tbody = document.getElementById('incidents-body');
    const filterStatus = document.getElementById('filter-status').value;
    const thresholds = window.currentThresholds;

    let filtered = data;
    if (filterStatus !== '') {
        const isResolved = filterStatus === 'true';
        filtered = data.filter(i => i.resolved === isResolved);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-500 font-medium">No hay incidencias para mostrar.</td></tr>';
        return;
    }

    let html = '';
    filtered.forEach(inc => {
        const date = new Date(inc.created_at).toLocaleString();
        
        // Traffic light logic
        let lightColorClass = 'bg-gray-100 text-gray-400';
        let lightIcon = 'fa-circle';
        
        if (inc.severity_value >= thresholds.red) {
            lightColorClass = 'bg-red-100 text-red-700 border border-red-200';
            lightIcon = 'fa-exclamation-circle text-red-500 animate-pulse';
        } else if (inc.severity_value >= thresholds.yellow) {
            lightColorClass = 'bg-yellow-100 text-yellow-700 border border-yellow-200';
            lightIcon = 'fa-exclamation-triangle text-yellow-500';
        } else {
            lightColorClass = 'bg-green-100 text-green-700 border border-green-200';
            lightIcon = 'fa-check text-green-500';
        }

        const gmapsHtml = inc.location_url 
            ? `<a href="${inc.location_url}" target="_blank" class="text-blue-500 hover:text-blue-700 font-bold text-xs"><i class="fas fa-map-marked-alt text-lg"></i><br>${inc.location_speed || 'Mapa'}</a>`
            : '<span class="text-gray-400 text-xs">Sin ubicación</span>';

        // Resolve Status
        let statusHtml = '';
        if (inc.resolved) {
            statusHtml = `
                <div class="text-green-600 font-bold text-xs"><i class="fas fa-check-double"></i> Resuelto</div>
                <div class="text-[10px] text-gray-500">Por: ${inc.resolved_by}</div>
                <div class="text-[10px] text-gray-400">${new Date(inc.resolved_at).toLocaleDateString()}</div>
            `;
        } else {
            statusHtml = `<div class="text-red-500 font-bold text-xs animate-pulse"><i class="fas fa-exclamation"></i> Pendiente</div>`;
        }

        const actionHtml = inc.resolved
            ? '<i class="fas fa-lock text-gray-300" title="Cerrado"></i>'
            : `<button onclick="window.resolveIncident('${inc.id}')" class="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 px-3 py-1 rounded-full text-xs font-bold transition">Marcar Resuelto</button>`;

        // Row background
        const rowBg = !inc.resolved && inc.severity_value >= thresholds.red ? 'bg-red-50/50' : '';

        html += `
            <tr class="border-b transition hover:bg-gray-50 ${rowBg}">
                <td class="p-4 text-sm text-gray-600 font-medium">${date}</td>
                <td class="p-4">
                    <div class="font-bold text-gray-800 text-blue-900">${inc.units?.economic_number || 'N/A'}</div>
                    <div class="text-xs text-gray-500">${inc.operators?.name || 'N/A'}</div>
                </td>
                <td class="p-4">
                    <div class="font-bold text-gray-700 text-sm max-w-[250px]">${inc.incident_type}</div>
                </td>
                <td class="p-4 text-center">
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${lightColorClass}">
                        <i class="fas ${lightIcon}"></i> Puntos: ${inc.severity_value}
                    </div>
                </td>
                <td class="p-4 text-center">${gmapsHtml}</td>
                <td class="p-4 text-center">${statusHtml}</td>
                <td class="p-4">${actionHtml}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

window.resolveIncident = async (id) => {
    if(!confirm("¿Deseas marcar esta incidencia como resuelta?")) return;

    const currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || {name: 'Admin'};

    const { error } = await supabase.from('incidents').update({
        resolved: true,
        resolved_by: currentUser.name,
        resolved_at: new Date().toISOString()
    }).eq('id', id);

    if (error) {
        alert(error.message);
    } else {
        loadData(); // refresh
    }
};

function renderChart(data) {
    const ctx = document.getElementById('incidentsChart');
    if (!ctx) return;

    // Aggregate by hour of day
    const hourCounts = new Array(24).fill(0);
    data.forEach(inc => {
        const hr = new Date(inc.created_at).getHours();
        hourCounts[hr]++;
    });

    const labels = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`);

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Incumplimientos / Incidencias',
                data: hourCounts,
                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            }
        }
    });
}

function openSettingsModal() {
    const thresholds = window.currentThresholds || { yellow: 1, red: 2 };

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-xl w-96 shadow-2xl p-6">
            <h3 class="text-xl font-black mb-4 text-gray-800"><i class="fas fa-traffic-light text-red-500 mr-2"></i> Ajustes de Semáforo</h3>
            <p class="text-xs text-gray-500 mb-6">Define a partir de qué puntaje (sumatoria de infracciones en un registro) se enciende cada color.</p>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-yellow-600 uppercase mb-1">Puntos para AMARILLO</label>
                    <input type="number" id="set-yellow" value="${thresholds.yellow}" min="1" class="w-full border-2 border-yellow-200 focus:border-yellow-500 bg-yellow-50 outline-none p-2 rounded-lg font-bold text-gray-700">
                </div>
                <div>
                    <label class="block text-xs font-bold text-red-600 uppercase mb-1">Puntos para ROJO</label>
                    <input type="number" id="set-red" value="${thresholds.red}" min="1" class="w-full border-2 border-red-200 focus:border-red-500 bg-red-50 outline-none p-2 rounded-lg font-bold text-gray-700">
                </div>
            </div>

            <div class="mt-8 flex justify-end gap-3 pt-4 border-t">
                <button class="px-5 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition" onclick="this.closest('.fixed').remove()">Cancelar</button>
                <button class="px-5 py-2 font-bold bg-gray-800 text-white rounded-lg hover:bg-black shadow-lg shadow-gray-500/30 transition" id="btn-save-settings">Guardar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-save-settings').onclick = async () => {
        const y = parseInt(document.getElementById('set-yellow').value);
        const r = parseInt(document.getElementById('set-red').value);

        if (y >= r) return alert("Los puntos para Rojo deben ser mayores a los de Amarillo.");

        const { error } = await supabase.from('system_settings').upsert({
            setting_key: 'traffic_light_thresholds',
            setting_value: { yellow: y, red: r }
        });

        if (error) alert(error.message);
        else {
            modal.remove();
            loadData(); // Refresh colors
        }
    };
}

function openNewIncidentModal() {
    const units = window.allUnitsData || [];
    const ops = window.allOpsData || [];

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="bg-red-500 p-4 shrink-0 flex justify-between items-center text-white">
                <h3 class="text-xl font-black"><i class="fas fa-exclamation-triangle mr-2"></i> Crear Incidencia Manual</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-white hover:text-red-200"><i class="fas fa-times text-xl"></i></button>
            </div>
            
            <div class="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Unidad</label>
                        <select id="man-inc-unit" class="w-full border-2 border-gray-200 focus:border-red-500 outline-none p-2 rounded-lg font-bold text-gray-700">
                            <option value="">Selecciona...</option>
                            ${units.map(u => `<option value="${u.id}">${u.economic_number}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Operador</label>
                        <select id="man-inc-op" class="w-full border-2 border-gray-200 focus:border-red-500 outline-none p-2 rounded-lg font-bold text-gray-700">
                            <option value="">Selecciona...</option>
                            ${ops.map(o => `<option value="${o.id}">${o.name}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo / Tipo de Infracción</label>
                    <select id="man-inc-type" class="w-full border-2 border-gray-200 focus:border-red-500 outline-none p-3 rounded-lg font-medium text-gray-700" onchange="window.handleDynamicSelect('man-inc-type', 'incident_types')">
                        <option value="">Selecciona el tipo de infracción...</option>
                        ${(window.allIncidentTypes || []).map(t => `<option value="${t.name}">${t.name}</option>`).join('')}
                        <option value="__NEW__" class="text-green-600 font-bold bg-green-50">+ Agregar Nuevo...</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Severidad (Puntos)</label>
                    <input type="number" id="man-inc-sev" value="1" min="1" max="10" class="w-full border-2 border-gray-200 focus:border-red-500 outline-none p-2 rounded-lg font-bold text-gray-700">
                    <p class="text-[10px] text-gray-400 mt-1">Revisa tus Ajustes de Semáforo para ver qué color le corresponderá.</p>
                </div>
            </div>

            <div class="p-4 border-t bg-gray-50 shrink-0 flex justify-end gap-3">
                <button class="px-5 py-2 font-bold text-gray-500 hover:bg-gray-200 rounded-lg transition" onclick="this.closest('.fixed').remove()">Cancelar</button>
                <button class="px-5 py-2 font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-lg shadow-red-500/30 transition flex items-center gap-2" id="btn-submit-man-inc">
                    <span>Crear Incidencia</span>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-submit-man-inc').onclick = async function() {
        const unitId = document.getElementById('man-inc-unit').value;
        const opId = document.getElementById('man-inc-op').value;
        const typeMsg = document.getElementById('man-inc-type').value.trim();
        const sevVal = parseInt(document.getElementById('man-inc-sev').value);

        if (!unitId || !opId || !typeMsg) return alert("Llena todos los campos requeridos (Unidad, Operador, Motivo).");

        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        try {
            const { error } = await supabase.from('incidents').insert([{
                unit_id: unitId,
                operator_id: opId,
                incident_type: typeMsg,
                severity_value: sevVal || 1
            }]);

            if (error) throw error;

            modal.remove();
            loadData();
        } catch (e) {
            console.error(e);
            alert("Error al guardar: " + e.message);
            btn.disabled = false;
            btn.innerHTML = 'Crear Incidencia';
        }
    };
}
