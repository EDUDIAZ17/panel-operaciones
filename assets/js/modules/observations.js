import { supabase } from '../services/supabaseClient.js';
import { formatDate } from '../utils/formatters.js';

export async function renderObservations(container) {
    container.innerHTML = `
        <div id="view-observations" class="p-6 fade-in space-y-6">
            <!-- Stats Header -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
                    <p class="text-xs text-gray-400 uppercase font-bold">Total Incidencias</p>
                    <p id="obs-stat-total" class="text-2xl font-bold text-gray-800">0</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
                    <p class="text-xs text-gray-400 uppercase font-bold">Conducta / No Contesta</p>
                    <p id="obs-stat-conduct" class="text-2xl font-bold text-gray-800">0</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
                    <p class="text-xs text-gray-400 uppercase font-bold">Diesel / Logística</p>
                    <p id="obs-stat-diesel" class="text-2xl font-bold text-gray-800">0</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow border-l-4 border-red-600">
                    <p class="text-xs text-gray-400 uppercase font-bold">Alcohol / Accidentes</p>
                    <p id="obs-stat-critical" class="text-2xl font-bold text-gray-800">0</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Register Form -->
                <div class="bg-white p-6 rounded-lg shadow-lg border border-gray-100">
                    <h3 class="text-lg font-bold text-gray-800 mb-6 flex items-center">
                        <i class="fas fa-plus-circle text-blue-600 mr-2"></i> Nueva Incidencia
                    </h3>
                    <form id="obs-form-full" class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">OPERADOR</label>
                            <select id="obs-op-full" class="w-full border p-2 rounded text-sm bg-gray-50" required>
                                <option value="">Seleccionar...</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">TIPO DE INCIDENCIA</label>
                            <select id="obs-type-full" class="w-full border p-2 rounded text-sm bg-gray-50" required>
                                <option value="Conducta">Conducta / No Contesta</option>
                                <option value="Diesel">Incidencia Diesel</option>
                                <option value="Alcoholimetria">Alcoholimetría</option>
                                <option value="Accidente">Accidente</option>
                                <option value="Logistica">Error Logística</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">FECHA Y HORA</label>
                            <input type="datetime-local" id="obs-date-full" class="w-full border p-2 rounded text-sm bg-gray-50" required>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">DESCRIPCIÓN DETALLADA</label>
                            <textarea id="obs-desc-full" rows="4" class="w-full border p-2 rounded text-sm bg-gray-50" required placeholder="Escribe los detalles aquí..."></textarea>
                        </div>
                        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded shadow transition flex items-center justify-center">
                            <i class="fas fa-save mr-2"></i> REGISTRAR EN BITÁCORA
                        </button>
                    </form>
                </div>

                <!-- List & Filters -->
                <div class="lg:col-span-2 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden flex flex-col">
                    <div class="p-4 bg-gray-50 border-b flex flex-wrap gap-4 items-center justify-between">
                        <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wider">Historial Operativo</h3>
                        <div class="flex gap-2">
                            <select id="obs-filter-type" class="border text-[10px] p-1 rounded font-bold uppercase">
                                <option value="all">Tipos: Todos</option>
                                <option value="Conducta">Conducta</option>
                                <option value="Diesel">Diesel</option>
                                <option value="Alcoholimetria">Alcoholimetría</option>
                                <option value="Accidente">Accidente</option>
                            </select>
                            <button id="btn-refresh-obs" class="text-blue-600 p-1 hover:bg-blue-50 rounded transition">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>
                    </div>
                    <div id="obs-results-full" class="flex-1 overflow-y-auto p-4 space-y-4 max-h-[600px]">
                        <div class="text-center p-8 text-gray-400">Cargando incidencias...</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupObsForm();
    loadIncidences();
    
    document.getElementById('btn-refresh-obs').onclick = loadIncidences;
    document.getElementById('obs-filter-type').onchange = loadIncidences;
}

async function setupObsForm() {
    const { data: ops } = await supabase.from('operators').select('id, name').order('name');
    const select = document.getElementById('obs-op-full');
    if(ops) {
        ops.forEach(op => {
            select.innerHTML += `<option value="${op.id}">${op.name}</option>`;
        });
    }

    // document.getElementById('obs-date-full').valueAsDate = new Date(); // Removed: not supported for datetime-local
    
    // Set default value for datetime-local
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('obs-date-full').value = now.toISOString().slice(0, 16);

    document.getElementById('obs-form-full').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Guardando...';

        const data = {
            operator_id: document.getElementById('obs-op-full').value,
            type: document.getElementById('obs-type-full').value,
            incident_date: new Date(document.getElementById('obs-date-full').value).toISOString(),
            description: document.getElementById('obs-desc-full').value,
            reported_by: JSON.parse(sessionStorage.getItem('currentUser'))?.name || 'Sistema'
        };

        const { error } = await supabase.from('observations').insert(data);

        if (error) {
            alert("Error: " + error.message);
        } else {
            document.getElementById('obs-desc-full').value = '';
            loadIncidences();
        }
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save mr-2"></i> REGISTRAR EN BITÁCORA';
    };
}

async function loadIncidences() {
    const filterType = document.getElementById('obs-filter-type').value;
    const list = document.getElementById('obs-results-full');
    
    let query = supabase.from('observations').select('*, operators(name)').order('incident_date', { ascending: false });
    if (filterType !== 'all') query = query.eq('type', filterType);

    const { data, error } = await query;

    if (error) {
        list.innerHTML = `<div class="text-red-500 p-4">Error: ${error.message}</div>`;
        return;
    }

    updateObsStats(data);
    renderIncidenceCards(data);
}

function updateObsStats(data) {
    const total = data.length;
    const conduct = data.filter(i => i.type === 'Conducta').length;
    const diesel = data.filter(i => i.type === 'Diesel' || i.type === 'Logistica').length;
    const critical = data.filter(i => i.type === 'Alcoholimetria' || i.type === 'Accidente').length;

    document.getElementById('obs-stat-total').innerText = total;
    document.getElementById('obs-stat-conduct').innerText = conduct;
    document.getElementById('obs-stat-diesel').innerText = diesel;
    document.getElementById('obs-stat-critical').innerText = critical;
}

function renderIncidenceCards(data) {
    const list = document.getElementById('obs-results-full');
    if (data.length === 0) {
        list.innerHTML = '<div class="text-center p-8 text-gray-400">Sin registros para el filtro seleccionado.</div>';
        return;
    }

    list.innerHTML = data.map(item => {
        let colorClass = 'border-gray-200';
        let icon = 'fa-info-circle text-blue-500';
        
        if (item.type === 'Accidente' || item.type === 'Alcoholimetria') {
            colorClass = 'border-red-500 bg-red-50';
            icon = 'fa-exclamation-triangle text-red-600';
        } else if (item.type === 'Conducta') {
            colorClass = 'border-orange-400 bg-orange-50';
            icon = 'fa-user-times text-orange-600';
        } else if (item.type === 'Diesel') {
            colorClass = 'border-yellow-500 bg-yellow-50';
            icon = 'fa-gas-pump text-yellow-600';
        }

        return `
            <div class="p-4 border-l-4 rounded-r-lg shadow-sm transition hover:shadow-md ${colorClass} bg-white flex items-start gap-4">
                <div class="mt-1"><i class="fas ${icon} text-lg"></i></div>
                <div class="flex-1">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-gray-800 text-sm">${item.operators?.name || '---'}</span>
                        <span class="text-[10px] font-bold uppercase py-0.5 px-2 rounded-full border border-current opacity-70">${item.type}</span>
                    </div>
                    <p class="text-gray-700 text-xs mb-3 leading-relaxed">${item.description}</p>
                    <div class="flex justify-between items-center text-[10px] text-gray-500 italic">
                        <span>📅 ${formatDate(item.incident_date)}</span>
                        <span>Rep: ${item.reported_by}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
