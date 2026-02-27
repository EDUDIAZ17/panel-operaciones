import { supabase } from '../services/supabaseClient.js';
import { openHistoryModal } from './history.js';
import { fetchSamsaraLocations } from '../services/samsara.js';

export async function renderAssignments(container) {
    container.innerHTML = `
        <div id="view-assignments" class="p-6 fade-in">
            <div class="bg-white rounded-lg shadow p-6">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between mb-6 items-center gap-4">
                    <h3 class="text-xl font-bold text-gray-800">Control de Asignaciones y Programación</h3>
                    <div class="flex gap-2 flex-wrap">
                        <button id="btn-schedule" class="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 transition">
                            <i class="fas fa-calendar-plus mr-2"></i> Programar Viaje
                        </button>
                        <button id="btn-observations" class="bg-yellow-500 text-white px-4 py-2 rounded shadow hover:bg-yellow-600 transition">
                            <i class="fas fa-exclamation-triangle mr-2"></i> Observaciones RH
                        </button>
                        <input type="text" placeholder="Buscar unidad..." class="border p-2 rounded min-w-[200px]" id="assign-search">
                    </div>
                </div>
                
                <!-- Table -->
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-gray-100 border-b">
                                <th class="p-4 font-semibold text-gray-600 rounded-tl-lg">Unidad</th>
                                <th class="p-4 font-semibold text-gray-600">Operador Actual</th>
                                <th class="p-4 font-semibold text-gray-600 w-32">Estado</th>
                                <th class="p-4 font-semibold text-gray-600">Ruta / Ubicación</th>
                                <th class="p-4 font-semibold text-gray-600">Fecha Asignación</th>
                                <th class="p-4 font-semibold text-gray-600 rounded-tr-lg">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="assignments-body">
                             <tr><td colspan="5" class="p-8 text-center"><div class="spinner"></div> Cargando flota...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <!-- Modals Container -->
            <div id="modal-container"></div>
        </div>
    `;

    document.getElementById('btn-observations').onclick = () => {
        // Find the sidebar button and click it to change view
        const navBtn = document.getElementById('nav-observations');
        if (navBtn) navBtn.click();
        else alert("La sección de Observaciones no está disponible.");
    };
    document.getElementById('btn-schedule').onclick = () => openScheduleModal();
    document.getElementById('assign-search').addEventListener('keyup', (e) => filterAssignments(e.target.value));
    
    loadTable();
}

async function loadTable() {
    const list = document.getElementById('assignments-body');
    const { data: units, error } = await supabase
        .from('units')
        .select(`*, operators (id, name)`)
        .order('economic_number');
    
    const { data: allOps } = await supabase.from('operators').select('*').eq('active', true).order('name');
    
    const { data: clients } = await supabase.from('clients').select('*').order('name');
    const { data: locations } = await supabase.from('locations').select('*').order('name');
    const { data: unitStatuses } = await supabase.from('unit_statuses').select('*').order('name');
    
    // Fetch Samsara Data
    const samsaraData = await fetchSamsaraLocations();
    window.samsaraData = samsaraData;

    if (error) {
        list.innerHTML = `<tr><td colspan="5" class="text-red-500 p-4 text-center">Error: ${error.message}</td></tr>`;
        return;
    }

    window.unitsData = units; 
    window.operatorsData = allOps;
    window.clientsData = clients || [];
    window.locationsData = locations || [];
    window.statusesData = unitStatuses || [];

    renderRows(units, allOps, samsaraData);
}

window.handleDynamicSelect = async (selectId, tableName) => {
    const select = document.getElementById(selectId);
    if (select.value === '__NEW__') {
        const newValue = prompt('Ingresa el nuevo valor:');
        if (newValue && newValue.trim()) {
            const val = newValue.trim().toUpperCase();
            const { data, error } = await supabase.from(tableName).insert([{ name: val }]).select();
            if (error) {
                alert('Error al guardar en base de datos: ' + error.message);
                select.value = "";
            } else {
                const option = document.createElement('option');
                option.value = val;
                option.textContent = val;
                select.insertBefore(option, select.querySelector('option[value="__NEW__"]'));
                select.value = val;

                if (tableName === 'clients') window.clientsData.push({name: val});
                if (tableName === 'locations') window.locationsData.push({name: val});
                if (tableName === 'unit_statuses') window.statusesData.push({name: val});
                if (tableName === 'incident_types' && window.allIncidentTypes) window.allIncidentTypes.push({name: val});
            }
        } else {
            select.value = "";
        }
    }
};

function renderRows(units, allOps) {
    const list = document.getElementById('assignments-body');
    if (units.length === 0) {
        list.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-500">No se encontraron unidades.</td></tr>';
        return;
    }

    let html = '';
    units.forEach(unit => {
        const opName = unit.operators?.name || 'Sin Asignar';
        
        // Status Badge Logic
        let statusColor = 'bg-gray-200 text-gray-800';
        if (unit.status === 'Cargada') statusColor = 'bg-green-100 text-green-800 border border-green-200';
        if (unit.status === 'En Taller') statusColor = 'bg-red-100 text-red-800 border border-red-200';
        if (unit.status === 'Transito') statusColor = 'bg-blue-100 text-blue-800 border border-blue-200';
        if (unit.status.includes('Programad')) statusColor = 'bg-purple-100 text-purple-800 border border-purple-200';

        // Scheduled Info Check
        let dateDisplay = new Date(unit.last_status_update).toLocaleString();
        let scheduleBadge = '';
        if (unit.details && unit.details.scheduled_trip) {
            scheduleBadge = `<div class="mt-1 text-xs text-purple-600 font-bold"><i class="fas fa-clock"></i> Prog: ${new Date(unit.details.scheduled_trip).toLocaleString()}</div>`;
        }

        // Match with Samsara
        const samsaraData = window.samsaraData || [];
        const samsaraVeh = samsaraData.find(v => v.name.includes(unit.economic_number) || (unit.placas && v.name.includes(unit.placas)));
        const locationStr = samsaraVeh ? `<div class="text-[10px] text-blue-600 font-bold"><i class="fas fa-map-marker-alt"></i> GPS: ${samsaraVeh.location.speed} km/h</div>` : '<div class="text-[10px] text-gray-400">Sin GPS</div>';
        
        const routeStr = typeof unit.details === 'string' ? unit.details : (unit.details?.route || 'Pendiente');

        html += `
            <tr class="border-b hover:bg-gray-50 transition items-center">
                <td class="p-4">
                    <div class="font-bold text-gray-800 text-lg">${unit.economic_number}</div>
                    <div class="text-xs text-gray-500">${unit.type} • ${unit.placas || 'S/P'}</div>
                </td>
                <td class="p-4">
                    <div class="font-medium text-gray-700">${opName}</div>
                </td>
                <td class="p-4">
                    <span class="px-3 py-1 rounded-full text-xs font-bold ${statusColor} text-center block w-max shadow-sm cursor-pointer hover:opacity-80 transition" onclick="openStatusModal('${unit.id}')">
                        ${unit.status}
                    </span>
                    ${scheduleBadge}
                </td>
                <td class="p-4 text-sm">
                    <div class="font-bold text-orange-600 uppercase">${routeStr}</div>
                    ${locationStr}
                </td>
                <td class="p-4 text-sm text-gray-600">
                    <div><i class="far fa-clock"></i> ${dateDisplay}</div>
                    <div class="text-xs font-bold mt-1 ${unit.last_modified_by ? 'text-indigo-600 bg-indigo-50 inline-block px-2 py-0.5 rounded' : 'text-gray-400'}">
                        <i class="fas fa-user-edit"></i> ${unit.last_modified_by || 'Sistema'}
                    </div>
                </td>
                <td class="p-4 flex gap-2">
                    <button class="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded transition" onclick="openEditModal('${unit.id}')" title="Editar Completo">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="bg-gray-50 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded transition" onclick="openHistoryModal('${unit.id}')" title="Historial">
                        <i class="fas fa-history"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    list.innerHTML = html;
}

// --- MODALS ---

// 1. Edit Modal (Full Control)
window.openEditModal = (unitId) => {
    const unit = window.unitsData.find(u => u.id === unitId);
    const ops = window.operatorsData;
    
    // Dynamically loaded generic catalogs
    const clients = window.clientsData || [];
    const destinations = window.locationsData || [];

    const currentClient = unit.details?.cliente || '';
    const currentOrigin = unit.details?.origen || '';
    const currentDest = unit.details?.destino || '';

    // ISO string for datetime-local input (YYYY-MM-DDTHH:MM)
    const currentIso = new Date(unit.last_status_update).toISOString().slice(0, 16);

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 w-[32rem] shadow-2xl border border-gray-100">
            <h3 class="text-xl font-black mb-6 border-b pb-2 text-gray-800"><i class="fas fa-truck-loading text-blue-500 mr-2"></i> Editar: ${unit.economic_number}</h3>
            
            <div class="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Operador</label>
                    <select id="edit-op" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium">
                        <option value="">Sin Asignar</option>
                        ${ops.map(op => `<option value="${op.id}" ${op.id === unit.current_operator_id ? 'selected' : ''}>${op.name}</option>`).join('')}
                    </select>
                </div>
                
                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Fecha de Asignación</label>
                    <input type="datetime-local" id="edit-date" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium" value="${currentIso}">
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Cliente</label>
                    <select id="edit-client" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium text-blue-700" onchange="window.handleDynamicSelect('edit-client', 'clients')">
                        <option value="">Seleccionar Cliente...</option>
                        ${clients.map(c => `<option value="${c.name}" ${currentClient === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Cliente...</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Origen (Carga)</label>
                    <select id="edit-origin" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium" onchange="window.handleDynamicSelect('edit-origin', 'locations')">
                        <option value="">Seleccionar Origen...</option>
                        ${destinations.map(d => `<option value="${d.name}" ${currentOrigin === d.name ? 'selected' : ''}>${d.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Origen...</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Destino (Entrega)</label>
                    <select id="edit-dest" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium" onchange="window.handleDynamicSelect('edit-dest', 'locations')">
                        <option value="">Seleccionar Destino...</option>
                        ${destinations.map(d => `<option value="${d.name}" ${currentDest === d.name ? 'selected' : ''}>${d.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Destino...</option>
                    </select>
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Ruta Libre (Opcional)</label>
                    <input type="text" id="edit-route" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium" value="${typeof unit.details === 'string' ? unit.details : (unit.details?.route || '')}" placeholder="Ej: Autopista 57">
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Observaciones</label>
                    <textarea id="edit-comments" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium" rows="2">${unit.details?.comments || ''}</textarea>
                </div>
            </div>

            <div class="mt-6 flex justify-end gap-3 pt-4 border-t">
                <button class="px-5 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition" onclick="this.closest('.fixed').remove()">Cancelar</button>
                <button class="px-5 py-2 font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition" id="btn-save-edit">Guardar Cambios</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-save-edit').onclick = async () => {
        const newOp = document.getElementById('edit-op').value || null;
        const newDate = document.getElementById('edit-date').value;
        const cliente = document.getElementById('edit-client').value;
        const origen = document.getElementById('edit-origin').value;
        const destino = document.getElementById('edit-dest').value;
        const route = document.getElementById('edit-route').value;
        const comments = document.getElementById('edit-comments').value;

        // Auto format route if dropdowns used
        let finalRoute = route;
        if(origen && destino && !route.trim()) {
            finalRoute = `${origen} - ${destino}`;
        }
        
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

        const { error } = await supabase.from('units').update({
            current_operator_id: newOp,
            last_status_update: new Date(newDate).toISOString(),
            last_modified_by: currentUser.name,
            details: { route: finalRoute, cliente, origen, destino, comments } 
        }).eq('id', unitId);

        if(error) alert(error.message);
        else {
            modal.remove();
            loadTable();
        }
    };
}

// 2. Schedule Modal (Programación)
window.openScheduleModal = () => {
    const units = window.unitsData;
    
    // Dynamically loaded generic catalogs
    const clients = window.clientsData || [];
    const destinations = window.locationsData || [];

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 w-[32rem] shadow-2xl border border-gray-100">
            <h3 class="text-xl font-black mb-6 border-b pb-2 text-purple-700"><i class="fas fa-calendar-alt mr-2"></i> Programar Viaje</h3>
            
            <div class="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Seleccionar Unidad</label>
                    <select id="sched-unit" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium">
                        ${units.map(u => `<option value="${u.id}">${u.economic_number} (${u.type})</option>`).join('')}
                    </select>
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Fecha y Hora de Salida <span class="text-red-500">*</span></label>
                    <input type="datetime-local" id="sched-date" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium">
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Cliente</label>
                    <select id="sched-client" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium text-purple-700" onchange="window.handleDynamicSelect('sched-client', 'clients')">
                        <option value="">Seleccionar Cliente...</option>
                        ${clients.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Cliente...</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Origen (Carga)</label>
                    <select id="sched-origin" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium" onchange="window.handleDynamicSelect('sched-origin', 'locations')">
                        <option value="">Seleccionar Origen...</option>
                        ${destinations.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Origen...</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Destino (Entrega)</label>
                    <select id="sched-dest" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium" onchange="window.handleDynamicSelect('sched-dest', 'locations')">
                        <option value="">Seleccionar Destino...</option>
                        ${destinations.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Destino...</option>
                    </select>
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Ruta Libre (Opcional)</label>
                    <input type="text" id="sched-route" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium" placeholder="Ej: Viaje a Monterrey directo">
                </div>
            </div>

            <div class="mt-6 flex justify-end gap-3 pt-4 border-t">
                <button class="px-5 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition" onclick="this.closest('.fixed').remove()">Cancelar</button>
                <button class="px-5 py-2 font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-lg shadow-purple-500/30 transition" id="btn-save-sched">Crear Programación</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-save-sched').onclick = async () => {
        const unitId = document.getElementById('sched-unit').value;
        const date = document.getElementById('sched-date').value;
        const cliente = document.getElementById('sched-client').value;
        const origen = document.getElementById('sched-origin').value;
        const destino = document.getElementById('sched-dest').value;
        const route = document.getElementById('sched-route').value;

        if(!date) return alert("Selecciona fecha");
        
        let finalRoute = route;
        if(origen && destino && !route.trim()) {
            finalRoute = `${origen} - ${destino}`;
        }
        if(!finalRoute.trim()) return alert("Debes indicar Origen y Destino, o escribir una Ruta Libre.");

        // Ideally we save this to a 'trips' table, but for now we update unit details to show 'Scheduled'
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        
        // Fetch current details first to not overwrite other stuff
        const currentUnit = units.find(u => u.id == unitId);
        const newDetails = typeof currentUnit.details === 'object' ? { ...currentUnit.details } : { raw: currentUnit.details || '' };
        
        newDetails.scheduled_trip = date;
        newDetails.route = finalRoute; // Assign route to details for sync with dashboard
        newDetails.cliente = cliente;
        newDetails.origen = origen;
        newDetails.destino = destino;
        newDetails.status_at_scheduling = currentUnit.status;

        const { error } = await supabase.from('units').update({
            details: newDetails,
            last_modified_by: currentUser.name
        }).eq('id', unitId);

        if(error) alert(error.message);
        else {
            alert("Viaje Programado exitosamente.");
            modal.remove();
            loadTable();
        }
    };
}

// 3. Status Modal (Quick Change)
window.openStatusModal = (unitId) => {
    const currentStatus = window.unitsData.find(u => u.id === unitId).status;
    const valid = window.statusesData || [];
    const hasCurrent = valid.find(s => s.name === currentStatus);
    const renderStatuses = hasCurrent ? valid : [...valid, {name: currentStatus}];
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 w-80 shadow-2xl border border-gray-100 text-center">
            <h3 class="text-lg font-black mb-4 text-gray-800">Actualizar Estatus</h3>
            <select id="status-select" class="w-full border-2 border-gray-200 focus:border-blue-500 p-3 rounded-lg font-bold text-center mb-6 text-gray-700 outline-none" onchange="window.handleDynamicSelect('status-select', 'unit_statuses')">
                ${renderStatuses.map(st => `<option value="${st.name}" ${currentStatus === st.name ? 'selected' : ''}>${st.name}</option>`).join('')}
                <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Estatus...</option>
            </select>
            <div class="flex justify-center gap-3">
                <button class="px-4 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition" onclick="this.closest('.fixed').remove()">Cancelar</button>
                <button class="px-4 py-2 font-bold bg-green-500 text-white rounded-lg hover:bg-green-600 transition shadow-lg shadow-green-500/30" id="btn-save-status">Actualizar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-save-status').onclick = () => {
        const newStatus = document.getElementById('status-select').value;
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
         supabase.from('units').update({
            status: newStatus,
            last_modified_by: currentUser.name,
            last_status_update: new Date().toISOString()
        }).eq('id', unitId).then(() => {
            modal.remove();
            loadTable();
        });
    }
}

function filterAssignments(text) {
    text = text.toLowerCase();
    const filtered = window.unitsData.filter(u => 
        u.economic_number.toLowerCase().includes(text) || 
        (u.operators && u.operators.name.toLowerCase().includes(text))
    );
    renderRows(filtered, window.operatorsData);
}
