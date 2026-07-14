import { supabase } from '../services/supabaseClient.js';
import { openHistoryModal } from './history.js';
import { fetchSamsaraLocations } from '../services/samsara.js';

window.openHistoryModal = openHistoryModal;

const geoCache = new Map();

// Database fallback helpers to ensure seamless operation
async function fetchTableDataFallback(tableName) {
    try {
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) {
            if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
                console.warn(`[Fallback] La tabla ${tableName} no existe en Supabase. Usando localStorage.`);
                return JSON.parse(localStorage.getItem(tableName) || '[]');
            }
            throw error;
        }
        return data || [];
    } catch (e) {
        console.warn(`[Fallback] Error al conectar a la tabla ${tableName}:`, e);
        return JSON.parse(localStorage.getItem(tableName) || '[]');
    }
}

async function insertTableDataFallback(tableName, row) {
    try {
        const rowWithId = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
        const { data, error } = await supabase.from(tableName).insert([rowWithId]).select();
        if (error) {
            if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
                console.warn(`[Fallback] Insertando en localStorage para ${tableName}`);
                const local = JSON.parse(localStorage.getItem(tableName) || '[]');
                local.push(rowWithId);
                localStorage.setItem(tableName, JSON.stringify(local));
                return rowWithId;
            }
            throw error;
        }
        return data?.[0] || rowWithId;
    } catch (e) {
        console.warn(`[Fallback] Error insertando en tabla ${tableName}:`, e);
        const rowWithId = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
        const local = JSON.parse(localStorage.getItem(tableName) || '[]');
        local.push(rowWithId);
        localStorage.setItem(tableName, JSON.stringify(local));
        return rowWithId;
    }
}

async function deleteTableDataFallback(tableName, id) {
    try {
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        if (error) {
            if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
                console.warn(`[Fallback] Eliminando de localStorage para ${tableName}`);
                let local = JSON.parse(localStorage.getItem(tableName) || '[]');
                local = local.filter(item => item.id !== id);
                localStorage.setItem(tableName, JSON.stringify(local));
                return;
            }
            throw error;
        }
    } catch (e) {
        console.warn(`[Fallback] Error eliminando en tabla ${tableName}:`, e);
        let local = JSON.parse(localStorage.getItem(tableName) || '[]');
        local = local.filter(item => item.id !== id);
        localStorage.setItem(tableName, JSON.stringify(local));
    }
}

// Google Maps Reverse Geocoder helper
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
                let preciseAddress = results[0].formatted_address.split(',').slice(0, 3).join(', ');
                geoCache.set(key, preciseAddress);
                const el = document.getElementById(elementId);
                if (el) {
                    el.innerText = preciseAddress;
                    el.title = results[0].formatted_address;
                }
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

export async function renderAssignments(container) {
    const canEdit = ['admin', 'torre_control', 'operaciones'].includes(window.userRole);

    container.innerHTML = `
        <div id="view-assignments" class="p-6 fade-in">
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between mb-6 items-center gap-4">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800"><i class="fas fa-tasks text-purple-600 mr-2"></i>Control de Asignaciones y Programación</h3>
                        <p class="text-xs text-gray-500 mt-1">Gestión de viajes activos, telemetría satelital, regresos y estatus preventivo ERP.</p>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        ${canEdit ? `
                        <button id="btn-schedule" class="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 transition">
                            <i class="fas fa-calendar-plus mr-2"></i> Programar Viaje
                        </button>
                        <button id="btn-observations-direct" class="bg-amber-500 text-white px-4 py-2 rounded shadow hover:bg-amber-600 transition">
                            <i class="fas fa-exclamation-triangle mr-2"></i> Observaciones RH
                        </button>
                        ` : ''}
                        <input type="text" placeholder="Buscar unidad..." class="border p-2 rounded min-w-[200px]" id="assign-search">
                    </div>
                </div>
                
                <!-- Table -->
                <div class="overflow-x-auto custom-scrollbar w-full pb-4">
                    <table class="w-full text-left border-collapse min-w-max">
                        <thead>
                            <tr class="bg-gray-100 border-b text-xs uppercase tracking-wider text-gray-500">
                                <th class="p-4 font-bold rounded-tl-lg">Económico</th>
                                <th class="p-4 font-bold">Operador Actual</th>
                                <th class="p-4 font-bold w-32">Estado</th>
                                <th class="p-4 font-bold w-48">Origen Actual (GPS)</th>
                                <th class="p-4 font-bold w-48">Destino Actual</th>
                                <th class="p-4 font-bold w-32">Regreso</th>
                                <th class="p-4 font-bold w-40">Duración y Semáforo</th>
                                <th class="p-4 font-bold w-40">Fecha Asignación</th>
                                <th class="p-4 font-bold rounded-tr-lg">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="assignments-body" class="text-sm">
                             <tr><td colspan="9" class="p-8 text-center"><div class="spinner"></div> Cargando flota...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- AI Suggestions & Pending Trips Layout -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <!-- AI recommendations panel -->
                <div class="bg-indigo-50/50 rounded-xl border border-indigo-100 p-6 flex flex-col shadow-sm">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="font-black text-slate-800 flex items-center gap-2">
                            <i class="fas fa-robot text-indigo-600 text-xl animate-bounce"></i>
                            Sugerencias Logísticas de IA (Gemini)
                        </h4>
                        <button id="btn-refresh-ai-suggestions" class="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
                            <i class="fas fa-sync-alt"></i> Recargar
                        </button>
                    </div>
                    <div id="ai-suggestions-content" class="flex-1 overflow-y-auto max-h-[350px] min-h-[150px] custom-scrollbar bg-white rounded-lg p-4 border border-indigo-50 shadow-inner">
                        <div class="text-center py-8 text-slate-400 font-medium">
                            <div class="spinner border-t-indigo-500 mb-2"></div>
                            Generando sugerencias logísticas...
                        </div>
                    </div>
                </div>

                <!-- Pending Trips panel -->
                <div class="bg-white rounded-xl border border-slate-200 p-6 flex flex-col shadow-sm">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="font-bold text-slate-800 flex items-center gap-2">
                            <i class="fas fa-clock text-orange-500 text-lg"></i>
                            Viajes Pendientes por Asignar
                        </h4>
                        ${canEdit ? `
                        <button id="btn-add-pending-trip" class="bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm">
                            <i class="fas fa-plus"></i> Registrar Viaje
                        </button>
                        ` : ''}
                    </div>
                    <div class="flex-1 overflow-y-auto max-h-[350px] custom-scrollbar border border-slate-100 rounded-lg">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr class="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase">
                                    <th class="p-3">Cliente</th>
                                    <th class="p-3">Origen Carga</th>
                                    <th class="p-3">Destino Entrega</th>
                                    <th class="p-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="pending-trips-body">
                                <tr><td colspan="4" class="p-6 text-center text-gray-400 italic">Cargando viajes pendientes...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Modals Container -->
            <div id="modal-container"></div>
        </div>
    `;

    const btnObs = document.getElementById('btn-observations-direct');
    if (btnObs) {
        btnObs.onclick = () => {
            const navBtn = document.getElementById('nav-observations');
            if (navBtn) navBtn.click();
            else alert("La sección de Observaciones no está disponible.");
        };
    }
    
    const btnSchedule = document.getElementById('btn-schedule');
    if (btnSchedule) btnSchedule.onclick = () => openScheduleModal();

    const btnAddPending = document.getElementById('btn-add-pending-trip');
    if (btnAddPending) btnAddPending.onclick = () => window.openAddPendingTripModal();

    const btnRefreshAI = document.getElementById('btn-refresh-ai-suggestions');
    if (btnRefreshAI) btnRefreshAI.onclick = () => window.refreshAISuggestions();

    window.addSchedDestination = () => {
        const container = document.getElementById('sched-destinations-list');
        const div = document.createElement('div');
        div.className = 'flex gap-2 items-center dest-row animate-content-fade-in mt-2';
        div.innerHTML = `
            <select class="flex-1 border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium sched-dest-item" onchange="window.handleDynamicSelect(this, 'locations')">
                <option value="">Seleccionar Destino...</option>
                ${(window.locationsData || []).map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo...</option>
            </select>
            <button type="button" class="text-red-500 hover:text-red-700 p-2" onclick="this.parentElement.remove()">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        container.appendChild(div);
    };

    document.getElementById('assign-search').addEventListener('keyup', (e) => filterAssignments(e.target.value));
    
    loadTable();
}

async function loadTable() {
    const list = document.getElementById('assignments-body');
    const { data: units, error } = await supabase
        .from('units')
        .select(`*, operators (id, name, phone)`)
        .order('economic_number');
    
    const { data: allOps } = await supabase.from('operators').select('*').eq('active', true).order('name');
    
    const { data: clients } = await supabase.from('clients').select('*').order('name');
    const { data: locations } = await supabase.from('locations').select('*').order('name');
    const { data: destinations } = await supabase.from('destinations').select('*').order('name');
    const { data: unitStatuses } = await supabase.from('unit_statuses').select('*').order('name');
    
    // Fetch Samsara Data
    const samsaraData = await fetchSamsaraLocations();
    window.samsaraData = samsaraData;

    if (error) {
        list.innerHTML = `<tr><td colspan="9" class="text-red-500 p-4 text-center">Error: ${error.message}</td></tr>`;
        return;
    }

    // Sort units naturally (ATM01, ATM02, ATM10...)
    window.unitsData = units.sort((a,b) => a.economic_number.localeCompare(b.economic_number, undefined, {numeric: true})); 
    window.operatorsData = allOps;
    window.clientsData = clients || [];
    window.locationsData = locations || [];
    window.destinationsData = destinations || [];
    window.statusesData = unitStatuses || [];

    // Fetch Pending Trips and Maintenance Logs (with fallback)
    window.pendingTripsData = await fetchTableDataFallback('pending_trips');
    window.maintLogsData = await fetchTableDataFallback('maintenance_logs');

    // Render assignments table
    renderRows(window.unitsData, allOps, samsaraData);

    // Render pending trips table
    renderPendingTripsList();

    // Trigger AI recommendations in the background
    window.refreshAISuggestions();
}

function renderPendingTripsList() {
    const tbody = document.getElementById('pending-trips-body');
    if (!tbody) return;
    
    const trips = window.pendingTripsData || [];
    if (trips.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-400 italic">No hay viajes pendientes registrados.</td></tr>`;
        return;
    }

    let html = '';
    const canEdit = ['admin', 'torre_control', 'operaciones'].includes(window.userRole);

    trips.forEach(trip => {
        html += `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-3 font-semibold text-slate-800">${trip.client}</td>
                <td class="p-3 text-slate-600">${trip.origin}</td>
                <td class="p-3 text-slate-600">${trip.destination}</td>
                <td class="p-3 text-center">
                    ${canEdit ? `
                    <button class="text-red-500 hover:text-red-700 p-1.5 transition" onclick="window.deletePendingTripDirect('${trip.id}')" title="Eliminar Viaje Pendiente">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    ` : '---'}
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

window.deletePendingTripDirect = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este viaje pendiente?')) return;
    await deleteTableDataFallback('pending_trips', id);
    loadTable();
};

window.openAddPendingTripModal = () => {
    const clients = window.clientsData || [];
    const locations = window.locationsData || [];
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 w-[28rem] shadow-2xl border border-gray-100">
            <h3 class="text-lg font-black mb-4 border-b pb-2 text-indigo-700">
                <i class="fas fa-plus mr-2"></i> Registrar Viaje Pendiente
            </h3>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Cliente</label>
                    <select id="pending-client" class="w-full border-2 border-gray-200 focus:border-indigo-500 outline-none p-2 rounded-lg font-medium" onchange="window.handleDynamicSelect('pending-client', 'clients')">
                        <option value="">Seleccionar Cliente...</option>
                        ${clients.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Cliente...</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Origen de Carga</label>
                    <select id="pending-origin" class="w-full border-2 border-gray-200 focus:border-indigo-500 outline-none p-2 rounded-lg font-medium" onchange="window.handleDynamicSelect('pending-origin', 'locations')">
                        <option value="">Seleccionar Origen...</option>
                        ${locations.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Origen...</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Destino de Entrega (Descarga)</label>
                    <select id="pending-destination" class="w-full border-2 border-gray-200 focus:border-indigo-500 outline-none p-2 rounded-lg font-medium" onchange="window.handleDynamicSelect('pending-destination', 'locations')">
                        <option value="">Seleccionar Destino...</option>
                        ${locations.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo...</option>
                    </select>
                </div>
            </div>
            
            <div class="mt-6 flex justify-end gap-3 pt-4 border-t">
                <button class="px-4 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition" onclick="this.closest('.fixed').remove()">Cancelar</button>
                <button class="px-4 py-2 font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition" id="btn-save-pending">Registrar Viaje</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-save-pending').onclick = async () => {
        const client = document.getElementById('pending-client').value;
        const origin = document.getElementById('pending-origin').value;
        const destination = document.getElementById('pending-destination').value;
        
        if (!client || !origin || !destination) {
            alert('Todos los campos son obligatorios.');
            return;
        }
        
        await insertTableDataFallback('pending_trips', {
            client,
            origin,
            destination,
            status: 'Pendiente'
        });
        
        modal.remove();
        loadTable();
    };
};

window.refreshAISuggestions = async () => {
    const container = document.getElementById('ai-suggestions-content');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center py-12 text-slate-400 font-medium">
            <div class="spinner border-t-indigo-500 mb-2"></div>
            Analizando flota y ubicaciones para sugerir asignaciones...
        </div>
    `;
    
    try {
        const availableUnits = [];
        for (const unit of window.unitsData || []) {
            const samsaraVeh = (window.samsaraData || []).find(v => v.name.includes(unit.economic_number) || (unit.placas && v.name.includes(unit.placas)));
            let gpsLocStr = 'No disponible';
            if (samsaraVeh) {
                const key = `${samsaraVeh.location.latitude.toFixed(3)},${samsaraVeh.location.longitude.toFixed(3)}`;
                gpsLocStr = geoCache.get(key) || `Coordenadas: ${samsaraVeh.location.latitude}, ${samsaraVeh.location.longitude}`;
            }
            availableUnits.push({
                ...unit,
                gpsLocation: gpsLocStr
            });
        }
        
        const pendingTrips = window.pendingTripsData || [];
        const suggestionsHtml = await window.getAssignmentSuggestionsAI(availableUnits, pendingTrips);
        container.innerHTML = suggestionsHtml;
    } catch (e) {
        console.error("AI Suggestions Error:", e);
        container.innerHTML = `
            <div class="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-red-600 font-medium">
                <i class="fas fa-exclamation-triangle mr-2 text-red-500 text-lg animate-pulse"></i>
                Error al generar las sugerencias con Gemini: ${e.message || e}
            </div>
        `;
    }
};

window.handleDynamicSelect = async (selectOrId, tableName) => {
    const select = (typeof selectOrId === 'string') ? document.getElementById(selectOrId) : selectOrId;
    if (!select) return;

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

                if (tableName === 'clients') window.clientsData = [...(window.clientsData || []), {name: val}];
                if (tableName === 'locations') window.locationsData = [...(window.locationsData || []), {name: val}];
                if (tableName === 'destinations') window.destinationsData = [...(window.destinationsData || []), {name: val}];
                if (tableName === 'unit_statuses') window.statusesData = [...(window.statusesData || []), {name: val}];
                if (tableName === 'incident_types' && window.allIncidentTypes) window.allIncidentTypes.push({name: val});
            }
        } else {
            select.value = "";
        }
    }
};

function renderRows(units, allOps) {
    const list = document.getElementById('assignments-body');
    if (!list) return;

    if (units.length === 0) {
        list.innerHTML = '<tr><td colspan="9" class="p-6 text-center text-gray-500">No se encontraron unidades.</td></tr>';
        return;
    }

    let html = '';
    const canEdit = ['admin', 'torre_control', 'operaciones'].includes(window.userRole);

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
        
        let telemetryOriginHtml = '';
        if (samsaraVeh) {
            const lat = samsaraVeh.location.latitude;
            const lng = samsaraVeh.location.longitude;
            const speed = samsaraVeh.location.speed || 0;
            const geoId = `geo-loc-${unit.id}`;
            
            telemetryOriginHtml = `
                <div id="${geoId}" class="font-bold text-gray-800 text-xs truncate max-w-[150px]">Geocodificando...</div>
                <div class="text-[9px] text-blue-600 font-black mt-0.5"><i class="fas fa-gauge"></i> ${speed.toFixed(0)} km/h</div>
            `;
            setTimeout(() => reverseGeocode(lat, lng, geoId), 100);
        } else {
            telemetryOriginHtml = `<span class="text-xs text-gray-400 font-medium">Sin GPS (Desconectado)</span>`;
        }
        
        let parsedDetails = unit.details;
        if (typeof parsedDetails === 'string') {
            try { parsedDetails = JSON.parse(parsedDetails); } catch(e) {}
        }
        parsedDetails = parsedDetails || {};

        let hasTrip = false;
        if (parsedDetails.cliente) hasTrip = true;

        let originStr = parsedDetails.origen || '---';
        let destinoStr = parsedDetails.destino || '---';
        
        if (originStr && destinoStr && originStr !== '---' && destinoStr !== '---' && !samsaraVeh) {
             // AI Route recommendation option if GPS unavailable
             telemetryOriginHtml += `<button onclick="window.openAIRoute('${originStr}', '${destinoStr}')" class="text-purple-600 hover:text-purple-800 text-[10px] font-bold mt-1 transition flex items-center gap-1 w-max"><i class="fas fa-robot"></i> Ruta IA</button>`;
        }

        // 1. Duración y Semáforo Logic
        let durationHtml = '<span class="text-xs text-gray-400 font-medium">---</span>';
        if (hasTrip) {
            const assignDate = parsedDetails.assignment_date ? new Date(parsedDetails.assignment_date) : new Date(unit.last_status_update);
            const elapsedMs = Date.now() - assignDate.getTime();
            const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
            const estDays = parseFloat(parsedDetails.duracion_estimada_dias) || 0;
            
            if (estDays > 0) {
                const remainingDays = estDays - elapsedDays;
                let dotColor = 'dot-green';
                let textClass = 'text-emerald-600';
                let textLabel = '';
                
                if (remainingDays < 0) {
                    dotColor = 'dot-red';
                    textClass = 'text-red-600 animate-pulse';
                    textLabel = `${Math.abs(remainingDays).toFixed(1)} días de retraso`;
                } else if (remainingDays <= 1) {
                    dotColor = 'dot-yellow';
                    textClass = 'text-amber-600';
                    textLabel = `${remainingDays.toFixed(1)} días restantes`;
                } else {
                    dotColor = 'dot-green';
                    textClass = 'text-emerald-600';
                    textLabel = `${remainingDays.toFixed(1)} días restantes`;
                }
                
                durationHtml = `
                    <div class="flex items-center gap-1.5 font-bold ${textClass}">
                        <span class="status-dot ${dotColor} scale-90"></span>
                        <span>${textLabel}</span>
                    </div>
                    <div class="text-[10px] text-gray-500 font-medium mt-0.5">Pactado: ${estDays} días</div>
                `;
            } else {
                durationHtml = `<span class="text-xs text-gray-400 font-medium">Sin duración pactada</span>`;
            }
        }

        // 2. Mantenimiento ERP Alerts & Badges
        let maintenanceAlertHtml = '';
        const logs = window.maintLogsData || [];
        const activeLogs = logs.filter(l => l.unit_id === unit.id && l.status !== 'Resuelto' && l.status !== 'Terminado');
        
        activeLogs.forEach(log => {
            if (log.type === 'Preventivo' && log.status === 'Programado') {
                maintenanceAlertHtml += `
                    <div class="mt-1 text-[9px] bg-yellow-100 text-yellow-800 border border-yellow-200 px-1.5 py-0.5 rounded font-black w-max flex items-center gap-1 animate-pulse shadow-sm" title="Se requiere bajar a patio para servicio preventivo">
                        <i class="fas fa-wrench"></i> Bajar a Patio: Preventivo (${new Date(log.scheduled_date).toLocaleDateString()})
                    </div>
                `;
            } else if (log.type === 'Rescate Carretero') {
                maintenanceAlertHtml += `
                    <div class="mt-1 text-[9px] bg-red-600 text-white border border-red-700 px-1.5 py-0.5 rounded font-black w-max flex items-center gap-1 animate-bounce shadow-md">
                        <i class="fas fa-truck-medical"></i> Rescate Activo: ${log.description || 'Falla mecánica'}
                    </div>
                `;
            } else if (log.status === 'En Taller') {
                maintenanceAlertHtml += `
                    <div class="mt-1 text-[9px] bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.5 rounded font-black w-max flex items-center gap-1 shadow-sm">
                        <i class="fas fa-tools"></i> En taller: ${log.description || 'Servicio'}
                    </div>
                `;
            }
        });

        // Forced color for "En Taller" unit status
        if (unit.status === 'En Taller' && !maintenanceAlertHtml) {
            maintenanceAlertHtml += `
                <div class="mt-1 text-[9px] bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.5 rounded font-black w-max flex items-center gap-1">
                    <i class="fas fa-tools"></i> En taller (Servicio)
                </div>
            `;
        }

        let terminarViajeBtn = hasTrip ? `<button class="bg-green-50 text-green-600 hover:bg-green-100 px-3 py-2 rounded transition" onclick="openFinishTripModal('${unit.id}')" title="Terminar Viaje"><i class="fas fa-flag-checkered"></i></button>` : '';

        let rowClasses = 'border-b transition items-center';
        if (hasTrip) {
            rowClasses += ' bg-yellow-50/50 hover:bg-yellow-100/50 border-l-4 border-l-yellow-400';
        } else {
            rowClasses += ' hover:bg-gray-50';
        }

        html += `
            <tr class="${rowClasses}">
                <!-- Unidad -->
                <td class="p-4">
                    <div class="font-bold text-gray-800 text-lg">${unit.economic_number}</div>
                    <div class="text-xs text-gray-500">${unit.type} • ${unit.placas || 'S/P'}</div>
                    ${maintenanceAlertHtml}
                </td>
                <!-- Operador -->
                <td class="p-4">
                    <div class="font-medium text-gray-700">${opName}</div>
                </td>
                <!-- Estado -->
                <td class="p-4">
                    <span class="px-3 py-1 rounded-full text-xs font-bold ${statusColor} text-center block w-max shadow-sm ${canEdit ? 'cursor-pointer hover:opacity-80' : ''} transition" ${canEdit ? `onclick="openStatusModal('${unit.id}')"` : ''}>
                        ${unit.status}
                    </span>
                    ${scheduleBadge}
                </td>
                <!-- Origen Actual GPS -->
                <td class="p-4">
                    ${telemetryOriginHtml}
                </td>
                <!-- Destino Actual -->
                <td class="p-4">
                    <div class="font-bold text-orange-600 uppercase truncate max-w-[150px]" title="${destinoStr}">${destinoStr}</div>
                    <div class="text-[10px] text-indigo-600 font-bold mt-0.5">VIAJE/BOL: ${parsedDetails?.viaje || parsedDetails?.bol || '---'}</div>
                </td>
                <!-- Regreso -->
                <td class="p-4 text-xs font-bold text-blue-700 uppercase">
                    ${parsedDetails?.regreso || '---'}
                </td>
                <!-- Duración y Semáforo -->
                <td class="p-4">
                    ${durationHtml}
                </td>
                <!-- Fecha Asignación -->
                <td class="p-4 text-sm text-gray-600 w-40">
                    <div><i class="far fa-clock"></i> ${dateDisplay}</div>
                    <div class="text-[10px] font-bold mt-1 ${unit.last_modified_by ? 'text-indigo-600 bg-indigo-50 inline-block px-1 rounded truncate max-w-full' : 'text-gray-400'}" title="${unit.last_modified_by || 'Sistema'}">
                        <i class="fas fa-user-edit"></i> ${unit.last_modified_by || 'Sistema'}
                    </div>
                </td>
                <!-- Acciones -->
                <td class="p-4 flex gap-2 w-max">
                    <button class="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-2 rounded transition" onclick="openTimersModal('${unit.id}')" title="Tiempos Logísticos">
                        <i class="fas fa-map-marker-alt"></i>
                    </button>
                    ${canEdit ? terminarViajeBtn : ''}
                    ${canEdit ? `
                    <button class="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded transition" onclick="openEditModal('${unit.id}')" title="Editar Detalles Actuales">
                        <i class="fas fa-edit"></i>
                    </button>
                    ` : ''}
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

// 1. Edit Modal
window.openEditModal = (unitId) => {
    const unit = window.unitsData.find(u => u.id === unitId);
    const ops = window.operatorsData;
    const clients = window.clientsData || [];
    const locations = window.locationsData || [];
    const destinations = window.destinationsData || [];

    let parsedDetails = unit.details;
    if (typeof parsedDetails === 'string') {
        try { parsedDetails = JSON.parse(parsedDetails); } catch(e) { parsedDetails = {}; }
    }
    parsedDetails = parsedDetails || {};

    const currentClient = parsedDetails.cliente || '';
    const currentOrigin = parsedDetails.origen || '';
    const currentDest = parsedDetails.destino || '';
    const currentRegreso = parsedDetails.regreso || '';
    const currentDuration = parsedDetails.duracion_estimada_dias || '';
    const currentDestinatario = parsedDetails.destinatario || '';
    const currentAssignDate = parsedDetails.assignment_date || '';
    const currentRoute = parsedDetails.route || '';
    const currentViaje = parsedDetails.viaje || '';
    const currentBol = parsedDetails.bol || '';
    const currentComments = parsedDetails.comments || '';

    const currentIso = currentAssignDate ? new Date(currentAssignDate).toISOString().slice(0, 16) : new Date(unit.last_status_update).toISOString().slice(0, 16);

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
                        ${ops.map(op => `<option value="${op.id}" ${op.id === unit.current_operator_id ? 'selected' : ''}>${op.name} (${op.phone || 'Sin Tel'})</option>`).join('')}
                    </select>
                    <p id="edit-op-phone-help" class="text-[10px] text-blue-600 mt-1 italic font-medium"></p>
                </div>
                
                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Fecha de Asignación</label>
                    <input type="datetime-local" id="edit-date" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium" value="${currentIso}">
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Cliente</label>
                    <select id="edit-client" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium text-blue-700" onchange="window.handleDynamicSelect('edit-client', 'clients')">
                        <option value="">Seleccionar Cliente...</option>
                        <option value="Sin Asignación" ${currentClient === 'Sin Asignación' ? 'selected' : ''}>Sin asignación de cliente</option>
                        ${clients.map(c => `<option value="${c.name}" ${currentClient === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Cliente...</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Origen (Carga)</label>
                    <select id="edit-origin" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium" onchange="window.handleDynamicSelect('edit-origin', 'locations')">
                        <option value="">Seleccionar Origen...</option>
                        ${locations.map(d => `<option value="${d.name}" ${currentOrigin === d.name ? 'selected' : ''}>${d.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Origen...</option>
                    </select>
                </div>

                <div class="col-span-2">
                    <div class="flex justify-between items-center mb-1">
                        <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider">Destino(s) / Paradas</label>
                        <button type="button" class="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold hover:bg-blue-200 transition" onclick="window.addEditDestination()">
                            <i class="fas fa-plus mr-1"></i> Añadir Parada
                        </button>
                    </div>
                    <div id="edit-destinations-list" class="space-y-2">
                        ${(() => {
                            const dests = (currentDest || "").split(' | ').filter(v => v);
                            if (dests.length === 0) {
                                return `
                                    <div class="flex gap-2 items-center dest-row">
                                        <select class="flex-1 border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium edit-dest-item" onchange="window.handleDynamicSelect(this, 'locations')">
                                            <option value="">Seleccionar Destino...</option>
                                            ${locations.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                                            <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo...</option>
                                        </select>
                                    </div>
                                `;
                            }
                            return dests.map((d, i) => `
                                <div class="flex gap-2 items-center dest-row">
                                    <select class="flex-1 border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium edit-dest-item" onchange="window.handleDynamicSelect(this, 'locations')">
                                        <option value="">Seleccionar Destino...</option>
                                        ${locations.map(loc => `<option value="${loc.name}" ${loc.name === d ? 'selected' : ''}>${loc.name}</option>`).join('')}
                                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo...</option>
                                    </select>
                                    ${i > 0 ? `
                                    <button type="button" class="text-red-500 hover:text-red-700 p-2" onclick="this.parentElement.remove()">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                    ` : ''}
                                </div>
                            `).join('');
                        })()}
                    </div>
                </div>

                <!-- NEW FIELDS: REGRESO Y DURACION ESTIMADA -->
                <div>
                    <label class="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Destino de Regreso</label>
                    <select id="edit-regreso" class="w-full border-2 border-blue-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium bg-blue-50/20" onchange="window.handleDynamicSelect('edit-regreso', 'locations')">
                        <option value="">Seleccionar Regreso...</option>
                        ${locations.map(d => `<option value="${d.name}" ${currentRegreso === d.name ? 'selected' : ''}>${d.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo...</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Duración (Días)</label>
                    <input type="number" id="edit-duration-days" class="w-full border-2 border-indigo-200 focus:border-indigo-500 outline-none p-2 rounded-lg font-medium bg-indigo-50/20" value="${currentDuration}" placeholder="Ej: 3" min="0.5" step="0.5">
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Destinatario (Empresa/Receptor)</label>
                    <select id="edit-destinatario" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium text-indigo-700" onchange="window.handleDynamicSelect('edit-destinatario', 'destinations')">
                        <option value="">Seleccionar Destinatario...</option>
                        ${destinations.map(d => `<option value="${d.name}" ${currentDestinatario === d.name ? 'selected' : ''}>${d.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Destinatario...</option>
                    </select>
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Ruta Libre (Opcional)</label>
                    <input type="text" id="edit-route" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium" value="${currentRoute}" placeholder="Ej: Autopista 57">
                </div>

                <div class="col-span-1" id="field-viaje">
                    <label class="block text-xs font-bold text-teal-600 uppercase tracking-wider mb-1">Número de Viaje</label>
                    <input type="text" id="edit-viaje" class="w-full border-2 border-teal-100 focus:border-teal-500 outline-none p-2 rounded-lg font-medium bg-teal-50" value="${currentViaje}" placeholder="Ej: VJ-10293">
                </div>
                <div class="col-span-1" id="field-bol">
                    <label class="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">BOL / Referencia</label>
                    <input type="text" id="edit-bol" class="w-full border-2 border-blue-100 focus:border-blue-500 outline-none p-2 rounded-lg font-medium bg-blue-50" value="${currentBol}" placeholder="Ej: BOL-99281">
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Observaciones</label>
                    <textarea id="edit-comments" class="w-full border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium" rows="2">${currentComments}</textarea>
                </div>

                <div class="col-span-2 bg-emerald-50 p-4 rounded-xl border border-emerald-100 space-y-3">
                    <div class="flex items-center justify-between">
                        <h4 class="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                            <i class="fab fa-whatsapp text-lg"></i> Alerta GPS de WhatsApp al Arribar
                        </h4>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="edit-wa-enable" class="sr-only peer" checked>
                            <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                    <div id="edit-wa-fields" class="space-y-2">
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Contacto Ruta 1</label>
                                <input type="text" id="edit-wa-m1" placeholder="Ej: 5512345678" class="w-full border border-emerald-200 focus:border-emerald-500 outline-none p-1.5 rounded text-xs font-medium" value="${localStorage.getItem('last_wa_m1') || ''}">
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Contacto Ruta 2</label>
                                <input type="text" id="edit-wa-m2" placeholder="Ej: 5587654321" class="w-full border border-emerald-200 focus:border-emerald-500 outline-none p-1.5 rounded text-xs font-medium" value="${localStorage.getItem('last_wa_m2') || ''}">
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Contacto Ruta 3</label>
                                <input type="text" id="edit-wa-m3" placeholder="Ej: 5599887766" class="w-full border border-emerald-200 focus:border-emerald-500 outline-none p-1.5 rounded text-xs font-medium" value="${localStorage.getItem('last_wa_m3') || ''}">
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Grupo Whatsapp (Opcional)</label>
                                <input type="text" id="edit-wa-group" placeholder="Enlace de Grupo" class="w-full border border-emerald-200 focus:border-emerald-500 outline-none p-1.5 rounded text-xs font-medium" value="${localStorage.getItem('last_wa_group') || ''}">
                            </div>
                        </div>
                    </div>
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

        const destElements = document.querySelectorAll('.edit-dest-item');
        const destinationsArray = Array.from(destElements).map(el => el.value).filter(v => v);
        const destino = destinationsArray.join(' | ');
        const regreso = document.getElementById('edit-regreso').value;
        const duracion = document.getElementById('edit-duration-days').value;
        const destinatario = document.getElementById('edit-destinatario').value;
        const route = document.getElementById('edit-route').value;
        const comments = document.getElementById('edit-comments').value.trim();
        const bol = document.getElementById('edit-bol').value.trim();
        const viaje = document.getElementById('edit-viaje').value.trim();

        const waEnable = document.getElementById('edit-wa-enable').checked;
        const waM1 = document.getElementById('edit-wa-m1').value.trim();
        const waM2 = document.getElementById('edit-wa-m2').value.trim();
        const waM3 = document.getElementById('edit-wa-m3').value.trim();
        const waGroup = document.getElementById('edit-wa-group').value.trim();

        let finalRoute = route;
        if(origen && destino && !route.trim()) {
            finalRoute = `${origen} - ${destino}`;
        }
        
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        let currentParsed = typeof unit.details === 'string' ? { raw: unit.details } : (unit.details || {});
        let oldDetailsStr = JSON.stringify(currentParsed);

        let clientChangedReason = '';
        if (currentParsed.cliente && cliente && currentParsed.cliente !== cliente) {
            clientChangedReason = prompt(`Estás cambiando el cliente de ${currentParsed.cliente} a ${cliente}. Por favor, ingresa el motivo del cambio:`);
            if (clientChangedReason === null) return;
        }

        const { error } = await supabase.from('units').update({
            current_operator_id: newOp,
            last_status_update: new Date().toISOString(),
            last_modified_by: currentUser.name,
            details: { ...currentParsed, assignment_date: newDate, route: finalRoute, cliente, destinatario, origen, destino, regreso, duracion_estimada_dias: duracion, comments, bol, viaje } 
        }).eq('id', unitId);

        if(error) alert(error.message);
        else {
            let historyDetails = `Cambio de detalles. Antes: ${oldDetailsStr} | Ahora: Cliente=${cliente}, Destino=${finalRoute}, Regreso=${regreso}`;
            if (clientChangedReason) historyDetails += ` | Motivo cambio cliente: ${clientChangedReason}`;

            supabase.from('assignments_history').insert([{
                unit_id: unitId,
                unidad_eco_txt: unit?.economic_number || null,
                new_operator_id: newOp,
                action_type: 'Edición Manual',
                details: historyDetails,
                modified_by: currentUser.name,
                timestamp: new Date().toISOString()
            }]).then(()=>{});

            // GPS Whatsapp sync
            if (waEnable && destino) {
                localStorage.setItem('last_wa_m1', waM1);
                localStorage.setItem('last_wa_m2', waM2);
                localStorage.setItem('last_wa_m3', waM3);
                localStorage.setItem('last_wa_group', waGroup);

                const selectedOp = (window.operatorsData || []).find(o => o.id === newOp);
                const opPhone = selectedOp ? (selectedOp.phone || '') : '';
                let atcText = `[ATC LOGÍSTICA] Unidad: ${unit.economic_number} | Cliente: ${cliente || 'N/A'} | Viaje: ${viaje || 'N/A'}`;
                if (comments) atcText += ` | Observaciones: ${comments}`;

                const dests = destino.split(' | ').filter(v=>v);
                const targetDestCity = dests[dests.length - 1] || '';

                if (window.syncGPSAlertForUnit) {
                    await window.syncGPSAlertForUnit(unitId, unit.economic_number, targetDestCity, atcText, opPhone, waM1, waM2, waM3, waGroup);
                }
            }

            modal.remove();
            loadTable();
        }
    };

    window.addEditDestination = () => {
        const container = document.getElementById('edit-destinations-list');
        const div = document.createElement('div');
        div.className = 'flex gap-2 items-center dest-row animate-content-fade-in mt-2';
        div.innerHTML = `
            <select class="flex-1 border-2 border-gray-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium edit-dest-item" onchange="window.handleDynamicSelect(this, 'locations')">
                <option value="">Seleccionar Destino...</option>
                ${locations.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo...</option>
            </select>
            <button type="button" class="text-red-500 hover:text-red-700 p-2" onclick="this.parentElement.remove()">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        container.appendChild(div);
    };

    const editOpSelect = document.getElementById('edit-op');
    const updateEditOpPhoneHelp = () => {
        const opId = editOpSelect.value;
        const op = ops.find(o => o.id === opId);
        const help = document.getElementById('edit-op-phone-help');
        if (help) {
            if (op) {
                help.textContent = op.phone ? `📞 Teléfono: ${op.phone}` : '⚠️ Operador sin teléfono registrado en sistema';
            } else {
                help.textContent = '⚠️ Sin operador asignado';
            }
        }
    };
    if (editOpSelect) {
        editOpSelect.addEventListener('change', updateEditOpPhoneHelp);
        updateEditOpPhoneHelp();
    }
}

// 2. Schedule Modal
window.openScheduleModal = () => {
    const units = window.unitsData;
    const availableUnits = units.filter(u => {
        let d = u.details;
        if(typeof d === 'string') { try{d=JSON.parse(d)}catch(e){} }
        return !d || !d.cliente;
    });

    if(availableUnits.length === 0) {
        return alert("Todas las unidades tienen un viaje activo. Para programar, primero debes 'Terminar Viaje' de alguna en la tabla.");
    }
    
    const clients = window.clientsData || [];
    const destinations = window.destinationsData || [];
    const locationsList = window.locationsData || [];
    const ops = window.operatorsData || [];

    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localIso = (new Date(now - tzoffset)).toISOString().slice(0, 16);

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 w-[32rem] shadow-2xl border border-gray-100">
            <h3 class="text-xl font-black mb-6 border-b pb-2 text-purple-700"><i class="fas fa-calendar-alt mr-2"></i> Programar Nuevo Viaje</h3>
            <p class="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded border border-gray-200"><i class="fas fa-info-circle text-blue-500"></i> Solo se muestran unidades sin viaje activo. Al programar, el contador de tiempo de inactividad se reiniciará a cero y se cargará automáticamente el operador de la unidad.</p>
            
            <div class="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Seleccionar Unidad</label>
                    <select id="sched-unit" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium">
                        ${availableUnits.map(u => `<option value="${u.id}">${u.economic_number} (${u.type}) - ${u.status}</option>`).join('')}
                    </select>
                </div>

                <div class="col-span-2 animate-content-fade-in">
                    <label class="block text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Operador Asignado (Auto)</label>
                    <select id="sched-op" class="w-full border-2 border-purple-100 focus:border-purple-500 outline-none p-2 rounded-lg font-medium bg-purple-50">
                        <option value="">Sin Asignar</option>
                        ${ops.map(op => `<option value="${op.id}">${op.name} (${op.phone || 'Sin Teléfono'})</option>`).join('')}
                    </select>
                    <p id="sched-op-phone-help" class="text-[10px] text-purple-600 mt-1 italic font-medium"></p>
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Fecha y Hora de Salida <span class="text-red-500">*</span></label>
                    <input type="datetime-local" id="sched-date" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium" value="${localIso}">
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Cliente</label>
                    <select id="sched-client" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium text-purple-700" onchange="window.handleDynamicSelect('sched-client', 'clients')">
                        <option value="">Seleccionar Cliente...</option>
                        <option value="Sin Asignación">Sin asignación de cliente</option>
                        ${clients.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Cliente...</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Origen (Carga)</label>
                    <select id="sched-origin" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium" onchange="window.handleDynamicSelect('sched-origin', 'locations')">
                        <option value="">Seleccionar Origen...</option>
                        ${locationsList.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Origen...</option>
                    </select>
                </div>

                <div class="col-span-2">
                    <div class="flex justify-between items-center mb-1">
                        <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider">Destino(s) / Paradas</label>
                        <button type="button" class="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold hover:bg-indigo-200 transition" onclick="window.addSchedDestination()">
                            <i class="fas fa-plus mr-1"></i> Añadir Parada
                        </button>
                    </div>
                    <div id="sched-destinations-list" class="space-y-2">
                        <div class="flex gap-2 items-center dest-row">
                            <select class="flex-1 border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium sched-dest-item" onchange="window.handleDynamicSelect(this, 'locations')">
                                <option value="">Seleccionar Destino...</option>
                                ${locationsList.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                                <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo...</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- NEW FIELDS: REGRESO Y DURACION ESTIMADA -->
                <div>
                    <label class="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Destino de Regreso</label>
                    <select id="sched-regreso" class="w-full border-2 border-blue-200 focus:border-blue-500 outline-none p-2 rounded-lg font-medium bg-blue-50/20" onchange="window.handleDynamicSelect('sched-regreso', 'locations')">
                        <option value="">Seleccionar Regreso...</option>
                        ${locationsList.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo...</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Duración (Días)</label>
                    <input type="number" id="sched-duration-days" class="w-full border-2 border-indigo-200 focus:border-indigo-500 outline-none p-2 rounded-lg font-medium bg-indigo-50/20" placeholder="Ej: 3" min="0.5" step="0.5">
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Destinatario (Empresa/Receptor)</label>
                    <select id="sched-destinatario" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium text-indigo-700" onchange="window.handleDynamicSelect('sched-destinatario', 'destinations')">
                        <option value="">Seleccionar Destinatario...</option>
                        ${destinations.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                        <option value="__NEW__" class="font-bold text-green-600">+ Agregar Nuevo Destinatario...</option>
                    </select>
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Ruta Libre (Opcional)</label>
                    <input type="text" id="sched-route" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium" placeholder="Ej: Viaje a Monterrey directo">
                </div>

                <div class="col-span-1" id="sched-field-viaje">
                    <label class="block text-xs font-bold text-teal-600 uppercase tracking-wider mb-1">Número de Viaje</label>
                    <input type="text" id="sched-viaje" class="w-full border-2 border-teal-100 focus:border-teal-500 outline-none p-2 rounded-lg font-medium bg-teal-50" placeholder="Ej: VJ-10293">
                </div>
                <div class="col-span-1" id="sched-field-bol">
                    <label class="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">BOL / Referencia</label>
                    <input type="text" id="sched-bol" class="w-full border-2 border-blue-100 focus:border-blue-500 outline-none p-2 rounded-lg font-medium bg-blue-50" placeholder="Ej: BOL-99281">
                </div>

                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Observaciones</label>
                    <textarea id="sched-comments" class="w-full border-2 border-gray-200 focus:border-purple-500 outline-none p-2 rounded-lg font-medium" rows="2" placeholder="Notas o comentarios sobre la programación..."></textarea>
                </div>

                <div class="col-span-2 bg-emerald-50 p-4 rounded-xl border border-emerald-100 space-y-3">
                    <div class="flex items-center justify-between">
                        <h4 class="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                            <i class="fab fa-whatsapp text-lg"></i> Alerta GPS de WhatsApp al Arribar
                        </h4>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="sched-wa-enable" class="sr-only peer" checked>
                            <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                    <div id="sched-wa-fields" class="space-y-2">
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Contacto Ruta 1</label>
                                <input type="text" id="sched-wa-m1" placeholder="Ej: 5512345678" class="w-full border border-emerald-200 focus:border-emerald-500 outline-none p-1.5 rounded text-xs font-medium" value="${localStorage.getItem('last_wa_m1') || ''}">
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Contacto Ruta 2</label>
                                <input type="text" id="sched-wa-m2" placeholder="Ej: 5587654321" class="w-full border border-emerald-200 focus:border-emerald-500 outline-none p-1.5 rounded text-xs font-medium" value="${localStorage.getItem('last_wa_m2') || ''}">
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Contacto Ruta 3</label>
                                <input type="text" id="sched-wa-m3" placeholder="Ej: 5599887766" class="w-full border border-emerald-200 focus:border-emerald-500 outline-none p-1.5 rounded text-xs font-medium" value="${localStorage.getItem('last_wa_m3') || ''}">
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Grupo Whatsapp (Opcional)</label>
                                <input type="text" id="sched-wa-group" placeholder="Enlace de Grupo" class="w-full border border-emerald-200 focus:border-emerald-500 outline-none p-1.5 rounded text-xs font-medium" value="${localStorage.getItem('last_wa_group') || ''}">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-6 flex justify-end gap-3 pt-4 border-t">
                <button class="px-5 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition" onclick="this.closest('.fixed').remove()">Cancelar</button>
                <button class="px-5 py-2 font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-lg shadow-purple-500/30 transition" id="btn-save-sched">Programar Viaje</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Sync unit operator details on select change
    const unitSelect = document.getElementById('sched-unit');
    const opSelect = document.getElementById('sched-op');
    const updateOperatorPreselect = () => {
        const uId = unitSelect.value;
        const unit = units.find(u => u.id === uId);
        if (unit && unit.current_operator_id) {
            opSelect.value = unit.current_operator_id;
        } else {
            opSelect.value = "";
        }
        updateSchedOpPhoneHelp();
    };
    const updateSchedOpPhoneHelp = () => {
        const opId = opSelect.value;
        const op = ops.find(o => o.id === opId);
        const help = document.getElementById('sched-op-phone-help');
        if (help) {
            if (op) {
                help.textContent = op.phone ? `📞 Teléfono: ${op.phone}` : '⚠️ Operador sin teléfono registrado en sistema';
            } else {
                help.textContent = '⚠️ Sin operador asignado';
            }
        }
    };
    unitSelect.addEventListener('change', updateOperatorPreselect);
    opSelect.addEventListener('change', updateSchedOpPhoneHelp);
    updateOperatorPreselect();

    document.getElementById('btn-save-sched').onclick = async () => {
        const unitId = unitSelect.value;
        const newOp = opSelect.value || null;
        const date = document.getElementById('sched-date').value;
        const cliente = document.getElementById('sched-client').value;
        const origen = document.getElementById('sched-origin').value;

        const destElements = document.querySelectorAll('.sched-dest-item');
        const destinationsArray = Array.from(destElements).map(el => el.value).filter(v => v);
        const destino = destinationsArray.join(' | ');
        const regreso = document.getElementById('sched-regreso').value;
        const duracion = document.getElementById('sched-duration-days').value;
        const destinatario = document.getElementById('sched-destinatario').value;
        const route = document.getElementById('sched-route').value;
        const comments = document.getElementById('sched-comments').value.trim();
        const bol = document.getElementById('sched-bol').value.trim();
        const viaje = document.getElementById('sched-viaje').value.trim();

        const waEnable = document.getElementById('sched-wa-enable').checked;
        const waM1 = document.getElementById('sched-wa-m1').value.trim();
        const waM2 = document.getElementById('sched-wa-m2').value.trim();
        const waM3 = document.getElementById('sched-wa-m3').value.trim();
        const waGroup = document.getElementById('sched-wa-group').value.trim();

        if (!date) {
            return alert("La fecha de salida es obligatoria.");
        }

        let finalRoute = route;
        if(origen && destino && !route.trim()) {
            finalRoute = `${origen} - ${destino}`;
        }

        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        const unit = units.find(u => u.id === unitId);
        
        const newDetails = {
            scheduled_trip: date,
            assignment_date: date,
            route: finalRoute,
            cliente: cliente,
            destinatario: destinatario,
            origen: origen,
            destino: destino,
            regreso: regreso,
            duracion_estimada_dias: duracion,
            comments: comments,
            bol: bol,
            viaje: viaje
        };

        const { error } = await supabase.from('units').update({
            status: 'Vacia', // Se pone en patio
            current_operator_id: newOp,
            details: newDetails,
            last_status_update: new Date(date).toISOString(),
            last_modified_by: currentUser.name
        }).eq('id', unitId);

        if(error) alert(error.message);
        else {
            supabase.from('assignments_history').insert([{
                unit_id: unitId,
                unidad_eco_txt: unit?.economic_number || null,
                new_operator_id: newOp,
                action_type: 'Viaje Programado',
                details: `Programado para ${date} | Cliente: ${cliente} | Ruta: ${finalRoute} | Regreso: ${regreso}`,
                modified_by: currentUser.name,
                timestamp: new Date().toISOString()
            }]).then(()=>{});

            // GPS Whatsapp sync
            if (waEnable && destino) {
                localStorage.setItem('last_wa_m1', waM1);
                localStorage.setItem('last_wa_m2', waM2);
                localStorage.setItem('last_wa_m3', waM3);
                localStorage.setItem('last_wa_group', waGroup);

                const selectedOp = (window.operatorsData || []).find(o => o.id === newOp);
                const opPhone = selectedOp ? (selectedOp.phone || '') : '';
                let atcText = `[ATC LOGÍSTICA] Unidad: ${unit.economic_number} | Cliente: ${cliente || 'N/A'} | Viaje: ${viaje || 'N/A'}`;
                if (comments) atcText += ` | Observaciones: ${comments}`;

                const dests = destino.split(' | ').filter(v=>v);
                const targetDestCity = dests[dests.length - 1] || '';

                if (window.syncGPSAlertForUnit) {
                    await window.syncGPSAlertForUnit(unitId, unit.economic_number, targetDestCity, atcText, opPhone, waM1, waM2, waM3, waGroup);
                }
            }

            alert("Viaje Programado exitosamente.");
            modal.remove();
            loadTable();
        }
    };
};

// 3. Finish Trip Modal
window.openFinishTripModal = (unitId) => {
    const unit = window.unitsData.find(u => u.id === unitId);
    let parsedDetails = unit.details;
    if (typeof parsedDetails === 'string') {
        try { parsedDetails = JSON.parse(parsedDetails); } catch(e) {}
    }
    parsedDetails = parsedDetails || {};
    const cliente = parsedDetails.cliente || 'Desconocido';

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 w-[32rem] shadow-2xl border border-gray-100 text-center">
            <h3 class="text-xl font-black mb-4 text-gray-800"><i class="fas fa-flag-checkered text-green-500 mr-2"></i> Terminar Viaje</h3>
            <p class="text-sm text-gray-600 mb-4 bg-green-50 p-2 rounded text-left">
               Unidad: <b>${unit.economic_number}</b><br>
               Cliente Actual: <b>${cliente}</b><br><br>
               Al terminar el viaje, la unidad quedará <b>Vacia</b>, sus datos de viaje se limpiarán, su contador de tiempo se reiniciará a 0 y se guardará la acción en el historial.
            </p>
            
            <div class="text-left mb-4">
                <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Fecha y Hora de Término</label>
                <input type="datetime-local" id="finish-date" class="w-full border-2 border-gray-200 focus:border-green-500 outline-none p-2 rounded-lg font-medium">
            </div>
            
            <div class="text-left mb-6">
                <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Observaciones del Viaje Completado</label>
                <textarea id="finish-comments" class="w-full border-2 border-gray-200 focus:border-green-500 outline-none p-2 rounded-lg font-medium" rows="3" placeholder="Ingresa detalles de cómo terminó el viaje, novedades, etc..."></textarea>
            </div>

            <div class="flex justify-center gap-3">
                <button class="px-5 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition" onclick="this.closest('.fixed').remove()">Cancelar</button>
                <button class="px-5 py-2 font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-lg shadow-green-600/30" id="btn-save-finish">Confirmar Término</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - tzoffset)).toISOString().slice(0, 16);
    document.getElementById('finish-date').value = localISOTime;

    document.getElementById('btn-save-finish').onclick = async () => {
        const finishDate = document.getElementById('finish-date').value;
        const comments = document.getElementById('finish-comments').value;
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        const checkpoints = parsedDetails.checkpoints || {};
        const requiredCPs = [
            { key: 'trip_load_arrival', name: 'Llegada a Carga' },
            { key: 'trip_load_end', name: 'Fin de Carga / Ins. Ruta' },
            { key: 'trip_route_start', name: 'Inicio de Ruta (Punta a Punta)' },
            { key: 'trip_route_end', name: 'Fin de Ruta (Punta a Punta)' },
            { key: 'trip_unload_arrival', name: 'Llegada a Descarga (ETA)' },
            { key: 'trip_unload_end', name: 'Fin de Descarga (Entrega)' }
        ];

        let missingFields = [];
        
        if(!parsedDetails.cliente) missingFields.push('Cliente');
        if(!parsedDetails.origen) missingFields.push('Origen');
        if(!parsedDetails.destino) missingFields.push('Destino');

        for (const cp of requiredCPs) {
            if (!checkpoints[cp.key]) {
                missingFields.push(cp.name);
            }
        }

        const isVacio = unit.status === 'Vacia' || unit.status.toUpperCase().includes('VACIO');

        if (missingFields.length > 0 && !isVacio) {
            let errorHtml = `<div class="text-left text-sm text-gray-700 mb-2">Para terminar el viaje, necesitas llenar los siguientes campos:</div>
                <ul class="list-disc pl-5 text-left text-red-600 font-bold mb-4 text-sm">
                    ${missingFields.map(f => `<li>${f}</li>`).join('')}
                </ul>
                <div class="text-xs text-gray-500 italic bg-gray-50 p-2 rounded border text-left">
                    <i class="fas fa-info-circle mr-1"></i>Puedes completar los datos faltantes en la pestaña "Bitácora de Viajes" o haciendo clic en el botón de "Tiempos Logísticos" de esta unidad.
                </div>
            `;
            Swal.fire({
                icon: 'warning',
                title: 'Faltan Datos del Viaje',
                html: errorHtml,
                confirmButtonColor: '#4f46e5'
            });
            return;
        }

        const oldDetailsStr = JSON.stringify(parsedDetails);

        const { error: histErr } = await supabase.from('assignments_history').insert([{
            unit_id: unit.id,
            unidad_eco_txt: unit.economic_number,
            action_type: 'Viaje Terminado',
            details: `Cliente: ${cliente} | Obs: ${comments} | Viaje: ${oldDetailsStr}`,
            modified_by: currentUser.name,
            timestamp: new Date(finishDate).toISOString()
        }]);

        if (histErr) {
            console.error("No se pudo guardar en historial", histErr);
        }

        const { error } = await supabase.from('units').update({
            status: 'Vacia',
            details: null,
            last_status_update: new Date().toISOString(),
            last_modified_by: currentUser.name
        }).eq('id', unit.id);

        if(error) alert(error.message);
        else {
            modal.remove();
            loadTable();
        }
    };
};

// 4. Status Modal
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
        }).eq('id', unitId).then(({ error }) => {
            if (error) {
                alert('No se pudo actualizar el estatus: ' + error.message);
            } else {
                const unit = (window.unitsData || []).find(u => u.id === unitId);
                const economicNumber = unit ? unit.economic_number : null;

                supabase.from('assignments_history').insert([{
                    unit_id: unitId,
                    unidad_eco_txt: economicNumber,
                    action_type: 'Cambio de Estatus',
                    details: `Se cambió estatus de ${currentStatus} a ${newStatus}`,
                    modified_by: currentUser.name,
                    timestamp: new Date().toISOString()
                }]).then(()=>{});

                modal.remove();
                loadTable();
            }
        });
    };
};

// 5. Timers Modal
window.openTimersModal = (unitId) => {
    const unit = window.unitsData.find(u => u.id === unitId);
    let parsedDetails = unit.details;
    if (typeof parsedDetails === 'string') {
        try { parsedDetails = JSON.parse(parsedDetails); } catch(e) {}
    }
    parsedDetails = parsedDetails || {};
    const checkpoints = parsedDetails.checkpoints || {};

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 w-[28rem] shadow-2xl border border-gray-100">
            <h3 class="text-xl font-black mb-4 border-b pb-2 text-indigo-700">
                <i class="fas fa-map-marker-alt mr-2"></i> Tiempos Logísticos: ${unit.economic_number}
            </h3>
            
            <div class="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 mb-6">
                <!-- Odometer -->
                <div class="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Odómetro Inicial</label>
                        <input type="number" id="cp-odo-init" class="w-full border border-gray-300 focus:border-indigo-500 rounded p-1.5 text-sm" value="${checkpoints.odoInit !== undefined ? checkpoints.odoInit : ''}">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Odómetro Final</label>
                        <input type="number" id="cp-odo-end" class="w-full border border-gray-300 focus:border-indigo-500 rounded p-1.5 text-sm" value="${checkpoints.odoEnd !== undefined ? checkpoints.odoEnd : ''}">
                    </div>
                </div>

                <!-- Milestones / Timers -->
                ${[
                    {key: 'trip_load_arrival', label: 'Llegada a Carga'}, 
                    {key: 'trip_load_start', label: 'Inicio de Carga'}, 
                    {key: 'trip_load_end', label: 'Fin de Carga'}, 
                    {key: 'trip_unload_arrival', label: 'Llegada a Descarga'},
                    {key: 'trip_unload_start', label: 'Inicio de Descarga'},
                    {key: 'trip_unload_end', label: 'Fin de Descarga'},
                    {key: 'trip_route_start', label: 'Inicio de Ruta'},
                    {key: 'trip_route_end', label: 'Fin de Ruta'}
                ].map(item => {
                    return `
                        <div>
                            <div class="flex justify-between mb-1 items-end">
                                <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider">${item.label}</label>
                                <button type="button" data-now-target="${item.key}" class="btn-now text-[10px] bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-2 py-0.5 rounded font-bold transition">
                                    <i class="fas fa-clock"></i> Ahora
                                </button>
                            </div>
                            <input type="datetime-local" id="cp-${item.key}" class="w-full border-2 border-gray-200 focus:border-indigo-500 outline-none p-2 rounded-lg font-medium text-sm" value="${checkpoints[item.key] || ''}">
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="flex justify-end gap-3 pt-4 border-t">
                <button class="px-5 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition" onclick="this.closest('.fixed').remove()">Cerrar</button>
                <button class="px-5 py-2 font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30" id="btn-save-checkpoints">Guardar Tiempos</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('.btn-now').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.nowTarget;
            const input = document.getElementById(`cp-${key}`);
            if (input) {
                const localISOTime = (new Date(new Date() - new Date().getTimezoneOffset() * 60000)).toISOString().slice(0,16);
                input.value = localISOTime;
                input.dispatchEvent(new Event('change'));
            }
        });
    });

    const inputUnloadEnd = document.getElementById('cp-trip_unload_end');
    const inputRouteEnd = document.getElementById('cp-trip_route_end');
    if (inputUnloadEnd && inputRouteEnd) {
        inputUnloadEnd.addEventListener('change', () => {
            inputRouteEnd.value = inputUnloadEnd.value;
        });
    }

    document.getElementById('btn-save-checkpoints').onclick = async () => {
        parsedDetails.checkpoints = {
            odoInit: document.getElementById('cp-odo-init').value,
            odoEnd: document.getElementById('cp-odo-end').value,
            trip_load_arrival: document.getElementById('cp-trip_load_arrival').value,
            trip_load_start: document.getElementById('cp-trip_load_start').value,
            trip_load_end: document.getElementById('cp-trip_load_end').value,
            trip_unload_arrival: document.getElementById('cp-trip_unload_arrival').value,
            trip_unload_start: document.getElementById('cp-trip_unload_start').value,
            trip_unload_end: document.getElementById('cp-trip_unload_end').value,
            trip_route_start: document.getElementById('cp-trip_route_start').value,
            trip_route_end: document.getElementById('cp-trip_route_end').value
        };

        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

        const { error } = await supabase.from('units').update({
            details: parsedDetails,
            last_modified_by: currentUser.name
        }).eq('id', unit.id);
        
        if (error) {
            alert('Error al guardar tiempos: ' + error.message);
        } else {
            supabase.from('assignments_history').insert([{
                unit_id: unit.id,
                unidad_eco_txt: unit.economic_number,
                action_type: 'Registro Logístico',
                details: `Se actualizaron los Tiempos/Checkpoints de Viaje`,
                modified_by: currentUser.name,
                timestamp: new Date().toISOString()
            }]).then(()=>{});

            modal.remove();
            loadTable();
        }
    };
};

function filterAssignments(text) {
    text = text.toLowerCase();
    const filtered = window.unitsData.filter(u => 
        u.economic_number.toLowerCase().includes(text) || 
        (u.operators && u.operators.name.toLowerCase().includes(text))
    );
    renderRows(filtered, window.operatorsData);
}
