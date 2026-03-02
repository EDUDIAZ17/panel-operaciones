import { supabase } from '../services/supabaseClient.js';

export async function renderTripLogs(container) {
    container.innerHTML = `
        <div id="view-trip-logs" class="p-6 fade-in h-full flex flex-col">
            <div class="bg-white rounded-xl shadow-sm p-6 flex-1 flex flex-col">
                <div class="flex justify-between items-center mb-6 border-b pb-4">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-route text-blue-500 mr-2"></i> Bitácora de Viajes</h2>
                        <p class="text-gray-500 text-sm mt-1">Control logístico detallado para Madrinas, Pipas y Contenedores.</p>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="flex border-b mb-4">
                    <button class="tab-btn active px-6 py-3 font-semibold text-blue-600 border-b-2 border-blue-600" data-target="madrinas">
                        <i class="fas fa-truck-moving mr-2"></i> Madrinas
                    </button>
                    <button class="tab-btn px-6 py-3 font-semibold text-gray-500 hover:text-blue-500 transition border-b-2 border-transparent" data-target="pipas">
                        <i class="fas fa-truck mr-2"></i> Pipas
                    </button>
                    <button class="tab-btn px-6 py-3 font-semibold text-gray-500 hover:text-blue-500 transition border-b-2 border-transparent" data-target="contenedores">
                        <i class="fas fa-box mr-2"></i> Contenedores
                    </button>
                </div>

                <!-- Content Area -->
                <div class="flex-1 overflow-auto custom-scrollbar relative">
                    <div id="logs-loading" class="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                        <div class="spinner border-t-blue-500 w-10 h-10"></div>
                    </div>
                    
                    <div id="tab-madrinas" class="tab-content active transition-opacity duration-300"></div>
                    <div id="tab-pipas" class="tab-content hidden transition-opacity duration-300"></div>
                    <div id="tab-contenedores" class="tab-content hidden transition-opacity duration-300"></div>
                </div>
            </div>
        </div>
    `;

    // Tabs Logic
    const tabs = container.querySelectorAll('.tab-btn');
    const contents = container.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active', 'text-blue-600', 'border-blue-600');
                t.classList.add('text-gray-500', 'border-transparent');
            });
            contents.forEach(c => c.classList.add('hidden'));

            tab.classList.remove('text-gray-500', 'border-transparent');
            tab.classList.add('active', 'text-blue-600', 'border-blue-600');
            container.querySelector(`#tab-${tab.dataset.target}`).classList.remove('hidden');
        });
    });

    await loadLogisticsData(container);
}

async function loadLogisticsData(container) {
    const loading = container.querySelector('#logs-loading');
    if (loading) loading.style.display = 'flex';

    // Fetch units with assignments
    const { data: units, error } = await supabase
        .from('units')
        .select('*, operators(name)')
        .order('economic_number');

    if (loading) loading.style.display = 'none';

    if (error) {
        alert('Error cargando datos: ' + error.message);
        return;
    }

    const madrinas = units.filter(u => u.type === 'Madrina');
    const pipas = units.filter(u => u.type === 'Pipa');
    const contenedores = units.filter(u => u.type === 'Contenedor');

    renderTable(container.querySelector('#tab-madrinas'), madrinas);
    renderTable(container.querySelector('#tab-pipas'), pipas);
    renderTable(container.querySelector('#tab-contenedores'), contenedores);
}

function renderTable(element, units) {
    if (units.length === 0) {
        element.innerHTML = '<div class="p-8 text-center text-gray-500 italic bg-gray-50 rounded-lg border border-dashed">No hay unidades de este tipo registradas.</div>';
        return;
    }

    let html = `
        <table class="w-full text-left border-collapse text-sm">
            <thead class="sticky top-0 bg-white shadow-sm z-10">
                <tr class="bg-indigo-50/50 border-b border-indigo-100">
                    <th class="p-3 font-semibold text-indigo-800">Unidad</th>
                    <th class="p-3 font-semibold text-indigo-800">Viaje / Cliente</th>
                    <th class="p-3 font-semibold text-indigo-800">Origen &rarr; Destino</th>
                    <th class="p-3 font-semibold text-indigo-800 text-center border-l w-32 border-indigo-100">LL. Carga</th>
                    <th class="p-3 font-semibold text-indigo-800 text-center w-32">In. Carga</th>
                    <th class="p-3 font-semibold text-indigo-800 text-center w-32">Fin Carga</th>
                    <th class="p-3 font-semibold text-teal-800 text-center border-l w-32 border-indigo-100 bg-teal-50/30">LL. Descarga</th>
                    <th class="p-3 font-semibold text-teal-800 text-center w-32 bg-teal-50/30">In. Descarga</th>
                    <th class="p-3 font-semibold text-teal-800 text-center w-32 bg-teal-50/30">Fin Descarga</th>
                    <th class="p-3 font-semibold text-gray-800 text-center border-l w-32 border-indigo-100">In. Ruta</th>
                    <th class="p-3 font-semibold text-gray-800 text-center w-32">Fin Ruta</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
    `;

    let activeCount = 0;
    units.forEach(unit => {
        let det = unit.details;
        if (typeof det === 'string') { try { det = JSON.parse(det); } catch(e) { det = {}; } }
        det = det || {};
        const cp = det.checkpoints || {};

        const isAssigned = (det.cliente || det.origen || det.route || det.destinatario);
        // Only show active trips or units that are loaded/in transit
        if(!isAssigned && ['Vacia', 'En Taller', 'Sin Operador'].includes(unit.status)) return; 

        // Safely display route string
        let routeDisplay = '---';
        if (det.origen && det.destino) routeDisplay = `<strong>${det.origen}</strong> &rarr; <strong>${det.destino}</strong>`;
        else if (det.route) routeDisplay = det.route;
        
        let destinatariosArray = [];
        if (Array.isArray(det.destinatarios) && det.destinatarios.length > 0) destinatariosArray = det.destinatarios;
        else if (det.destinatario) destinatariosArray = [det.destinatario];
        
        const destinatarioStr = destinatariosArray.map(d => `<div class="mt-1"><span class="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">${d}</span></div>`).join('');

        // Helper to render input cells directly inside the table
        const renderInput = (key) => `
            <input type="datetime-local" 
                class="w-full text-[11px] p-1 border rounded focus:ring-2 focus:ring-blue-500 outline-none ${cp[key] ? 'bg-blue-50 border-blue-200 font-bold' : 'bg-transparent border-gray-200 text-gray-400'}" 
                value="${cp[key] || ''}" 
                onchange="window.saveCheckpoint('${unit.id}', '${key}', this.value)">
        `;

        html += `
            <tr class="hover:bg-blue-50/20 transition group">
                <td class="p-3 align-top">
                    <div class="font-bold text-gray-800">${unit.economic_number}</div>
                    <div class="text-[10px] text-gray-500 uppercase">${unit.status}</div>
                </td>
                <td class="p-3 align-top">
                    <div class="font-bold text-blue-700">${det.cliente || 'Sin cliente'}</div>
                    <div class="text-[10px] text-gray-500 mt-0.5">VIAJE: ${det.viaje || det.bol || '---'}</div>
                </td>
                <td class="p-3 align-top text-xs">
                    <div>${routeDisplay}</div>
                    ${destinatarioStr}
                </td>
                <!-- Carga -->
                <td class="p-2 align-top border-l border-indigo-50/50">${renderInput('trip_load_arrival')}</td>
                <td class="p-2 align-top">${renderInput('trip_load_start')}</td>
                <td class="p-2 align-top">${renderInput('trip_load_end')}</td>
                <!-- Descarga -->
                <td class="p-2 align-top border-l border-teal-50/50 bg-teal-50/10">${renderInput('trip_unload_arrival')}</td>
                <td class="p-2 align-top bg-teal-50/10">${renderInput('trip_unload_start')}</td>
                <td class="p-2 align-top bg-teal-50/10">${renderInput('trip_unload_end')}</td>
                <!-- Ruta -->
                <td class="p-2 align-top border-l border-gray-50">${renderInput('trip_route_start')}</td>
                <td class="p-2 align-top">${renderInput('trip_route_end')}</td>
            </tr>
        `;
        activeCount++;
    });

    html += `</tbody></table>`;
    
    // Check if empty after filtering
    if(activeCount === 0) {
        element.innerHTML = '<div class="p-8 text-center text-gray-500 italic bg-gray-50 rounded-lg border border-dashed">No hay unidades en viaje activo de este tipo actualmente.</div>';
    } else {
        element.innerHTML = html;
    }
}

// Global hook to save checkpoint instantly
window.saveCheckpoint = async (unitId, key, value) => {
    // We cannot wait, UI needs to feel instantaneous. We'll fire and forget the update.
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    
    // First, fetch the current unit details to not overwrite anything else
    const { data: currentUnit } = await supabase.from('units').select('details').eq('id', unitId).single();
    if(!currentUnit) return;
    
    let det = currentUnit.details;
    if (typeof det === 'string') { try { det = JSON.parse(det); } catch(e) { det = {}; } }
    det = det || {};
    if (!det.checkpoints) det.checkpoints = {};
    
    // Update the specific key
    det.checkpoints[key] = value;
    
    // Save to DB
    const { error } = await supabase.from('units').update({ details: det }).eq('id', unitId);
    
    if(error) {
        console.error("Error guardando logística", error);
        window.alert("Error de red al guardar: " + error.message);
    } else {
        // Log to history silently
        const actionMap = {
            'trip_load_arrival': 'Llegada a Carga',
            'trip_load_start': 'Inicio de Carga',
            'trip_load_end': 'Fin de Carga',
            'trip_unload_arrival': 'Llegada a Descarga',
            'trip_unload_start': 'Inicio de Descarga',
            'trip_unload_end': 'Fin de Descarga',
            'trip_route_start': 'Inicio de Ruta',
            'trip_route_end': 'Fin de Ruta'
        };
        const prettyName = actionMap[key] || key;
        const msg = value ? `Se registró [${prettyName}] a las ${value.replace('T', ' ')}` : `Se borró [${prettyName}]`;
        
        supabase.from('assignments_history').insert([{
            unit_id: unitId,
            action_type: 'Bitácora Logística',
            details: msg,
            modified_by: (currentUser ? currentUser.name : 'Sistema'),
            timestamp: new Date().toISOString()
        }]).then(()=>{});
    }
};
