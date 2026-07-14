import { supabase } from '../services/supabaseClient.js';

// Database fallback helpers
async function fetchTableDataFallback(tableName) {
    try {
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) {
            if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
                return JSON.parse(localStorage.getItem(tableName) || '[]');
            }
            throw error;
        }
        return data || [];
    } catch (e) {
        return JSON.parse(localStorage.getItem(tableName) || '[]');
    }
}

async function insertTableDataFallback(tableName, row) {
    try {
        const rowWithId = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
        const { data, error } = await supabase.from(tableName).insert([rowWithId]).select();
        if (error) {
            if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
                const local = JSON.parse(localStorage.getItem(tableName) || '[]');
                local.push(rowWithId);
                localStorage.setItem(tableName, JSON.stringify(local));
                return rowWithId;
            }
            throw error;
        }
        return data?.[0] || rowWithId;
    } catch (e) {
        const rowWithId = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
        const local = JSON.parse(localStorage.getItem(tableName) || '[]');
        local.push(rowWithId);
        localStorage.setItem(tableName, JSON.stringify(local));
        return rowWithId;
    }
}

async function updateTableDataFallback(tableName, id, updates) {
    try {
        const { data, error } = await supabase.from(tableName).update(updates).eq('id', id).select();
        if (error) {
            if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
                let local = JSON.parse(localStorage.getItem(tableName) || '[]');
                local = local.map(item => item.id === id ? { ...item, ...updates } : item);
                localStorage.setItem(tableName, JSON.stringify(local));
                return;
            }
            throw error;
        }
    } catch (e) {
        let local = JSON.parse(localStorage.getItem(tableName) || '[]');
        local = local.map(item => item.id === id ? { ...item, ...updates } : item);
        localStorage.setItem(tableName, JSON.stringify(local));
    }
}

export async function renderMaintenance(container) {
    const isMaintOrAdmin = ['admin', 'mantenimiento', 'manto', 'maintenance', 'operaciones'].includes(window.userRole);
    
    container.innerHTML = `
        <div id="view-maintenance" class="p-6 fade-in h-full overflow-y-auto custom-scrollbar">
            <!-- Header -->
            <div class="mb-6 border-b pb-4">
                <h2 class="text-2xl font-black text-slate-800"><i class="fas fa-screwdriver-wrench text-red-500 mr-2"></i>Módulo de Mantenimiento</h2>
                <p class="text-slate-500 text-sm mt-1">Control de servicios preventivos, rescates carreteros y liberación de unidades en taller.</p>
            </div>

            <!-- Stats grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="bg-red-50 rounded-xl p-5 border border-red-100 flex items-center gap-4 shadow-sm">
                    <div class="h-12 w-12 bg-red-500 rounded-lg flex items-center justify-center text-white text-xl">
                        <i class="fas fa-tools"></i>
                    </div>
                    <div>
                        <div id="stat-in-shop" class="text-2xl font-black text-red-700">0</div>
                        <div class="text-xs text-red-600 font-bold uppercase tracking-wider">Unidades en Taller</div>
                    </div>
                </div>

                <div class="bg-amber-50 rounded-xl p-5 border border-amber-100 flex items-center gap-4 shadow-sm animate-pulse">
                    <div class="h-12 w-12 bg-amber-500 rounded-lg flex items-center justify-center text-white text-xl">
                        <i class="fas fa-truck-medical"></i>
                    </div>
                    <div>
                        <div id="stat-active-rescues" class="text-2xl font-black text-amber-700">0</div>
                        <div class="text-xs text-amber-600 font-bold uppercase tracking-wider">Rescates Activos</div>
                    </div>
                </div>

                <div class="bg-indigo-50 rounded-xl p-5 border border-indigo-100 flex items-center gap-4 shadow-sm">
                    <div class="h-12 w-12 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-xl">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div>
                        <div id="stat-scheduled-preventives" class="text-2xl font-black text-indigo-700">0</div>
                        <div class="text-xs text-indigo-600 font-bold uppercase tracking-wider">Preventivos Programados</div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Action Cards -->
                <div class="space-y-6 lg:col-span-1">
                    <!-- Ingresar / Programar Preventivo -->
                    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                        <h3 class="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <i class="fas fa-calendar-alt text-indigo-500"></i>
                            Programar Servicio Preventivo
                        </h3>
                        <form id="form-preventive" class="space-y-3">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">Unidad</label>
                                <select id="maint-unit-preventive" class="w-full border p-2 rounded-lg text-sm" required>
                                    <option value="">Seleccionar Unidad...</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">Fecha Programada</label>
                                <input type="date" id="maint-date-preventive" class="w-full border p-2 rounded-lg text-sm" required>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">Descripción / Trabajo</label>
                                <textarea id="maint-desc-preventive" class="w-full border p-2 rounded-lg text-xs" rows="2" placeholder="Ej: Cambio de aceite, filtros y revisión de frenos..." required></textarea>
                            </div>
                            <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-2 rounded-lg transition" ${isMaintOrAdmin ? '' : 'disabled'}>
                                <i class="fas fa-save mr-1"></i> Programar Servicio
                            </button>
                        </form>
                    </div>

                    <!-- Registrar Rescate Carretero -->
                    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                        <h3 class="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <i class="fas fa-truck-medical text-amber-500"></i>
                            Registrar Rescate Carretero
                        </h3>
                        <form id="form-rescue" class="space-y-3">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">Unidad Afectada</label>
                                <select id="maint-unit-rescue" class="w-full border p-2 rounded-lg text-sm" required>
                                    <option value="">Seleccionar Unidad...</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">Ubicación (Carretera / Ciudad)</label>
                                <input type="text" id="maint-location-rescue" class="w-full border p-2 rounded-lg text-sm" placeholder="Ej: Km 57 Aut. Querétaro-SLA" required>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">Falla Reportada / Detalles</label>
                                <textarea id="maint-desc-rescue" class="w-full border p-2 rounded-lg text-xs" rows="2" placeholder="Ej: Ponchadura de llanta delantera izquierda, requiere grúa..." required></textarea>
                            </div>
                            <button type="submit" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm py-2 rounded-lg transition" ${isMaintOrAdmin ? '' : 'disabled'}>
                                <i class="fas fa-ambulance mr-1"></i> Registrar Rescate
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Active Logs / Workshop Table -->
                <div class="lg:col-span-2 space-y-6">
                    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-bold text-slate-800"><i class="fas fa-list-check text-slate-500 mr-2"></i>Bitácora de Servicios y Rescates Activos</h3>
                            ${isMaintOrAdmin ? `
                            <button id="btn-maint-enter-shop" class="bg-red-500 text-white hover:bg-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
                                <i class="fas fa-tools"></i> Enviar a Taller
                            </button>
                            ` : ''}
                        </div>
                        <div class="overflow-x-auto custom-scrollbar border border-slate-100 rounded-lg">
                            <table class="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr class="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-xs">
                                        <th class="p-3">Unidad</th>
                                        <th class="p-3">Tipo</th>
                                        <th class="p-3">Estatus</th>
                                        <th class="p-3">Detalles</th>
                                        <th class="p-3">Fecha</th>
                                        <th class="p-3 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="maint-logs-body">
                                    <tr><td colspan="6" class="p-8 text-center text-slate-400 italic"><div class="spinner"></div> Cargando bitácora de mantenimiento...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add event listeners
    document.getElementById('form-preventive').onsubmit = handleAddPreventive;
    document.getElementById('form-rescue').onsubmit = handleAddRescue;
    
    const btnEnterShop = document.getElementById('btn-maint-enter-shop');
    if (btnEnterShop) btnEnterShop.onclick = openSendToWorkshopModal;

    // Load data
    await loadMaintenanceData();
}

async function loadMaintenanceData() {
    // 1. Fetch units
    const { data: units, error } = await supabase.from('units').select('*').order('economic_number');
    if (error) {
        console.error("Error loading units for maintenance:", error);
        return;
    }
    
    window.maintUnits = units.sort((a,b) => a.economic_number.localeCompare(b.economic_number, undefined, {numeric: true}));

    // 2. Fetch logs (using fallback helper)
    window.maintLogs = await fetchTableDataFallback('maintenance_logs');

    // 3. Fill selects
    const preventiveSelect = document.getElementById('maint-unit-preventive');
    const rescueSelect = document.getElementById('maint-unit-rescue');
    
    if (preventiveSelect && rescueSelect) {
        const optionsHtml = window.maintUnits.map(u => `<option value="${u.id}">${u.economic_number} (${u.type}) - ${u.status}</option>`).join('');
        preventiveSelect.innerHTML = `<option value="">Seleccionar Unidad...</option>` + optionsHtml;
        rescueSelect.innerHTML = `<option value="">Seleccionar Unidad...</option>` + optionsHtml;
    }

    // 4. Render Table and Stats
    renderMaintTable();
    updateMaintStats();
}

function updateMaintStats() {
    const logs = window.maintLogs || [];
    const units = window.maintUnits || [];

    // Stats calculations
    const inShopCount = units.filter(u => u.status === 'En Taller').length;
    const activeRescues = logs.filter(l => l.type === 'Rescate Carretero' && l.status !== 'Resuelto' && l.status !== 'Terminado').length;
    const scheduledPreventives = logs.filter(l => l.type === 'Preventivo' && l.status === 'Programado').length;

    // Set text
    const shopEl = document.getElementById('stat-in-shop');
    const rescuesEl = document.getElementById('stat-active-rescues');
    const prevsEl = document.getElementById('stat-scheduled-preventives');

    if (shopEl) shopEl.innerText = inShopCount;
    if (rescuesEl) rescuesEl.innerText = activeRescues;
    if (prevsEl) prevsEl.innerText = scheduledPreventives;
}

function renderMaintTable() {
    const tbody = document.getElementById('maint-logs-body');
    if (!tbody) return;

    const logs = window.maintLogs || [];
    const activeLogs = logs.filter(l => l.status !== 'Resuelto' && l.status !== 'Terminado');

    if (activeLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400 italic">No hay servicios ni rescates activos registrados.</td></tr>`;
        return;
    }

    const isMaintOrAdmin = ['admin', 'mantenimiento', 'manto', 'maintenance', 'operaciones'].includes(window.userRole);

    let html = '';
    // Sort logs: Rescates first, then preventives/taller, newest first
    activeLogs.sort((a,b) => {
        if (a.type === 'Rescate Carretero' && b.type !== 'Rescate Carretero') return -1;
        if (a.type !== 'Rescate Carretero' && b.type === 'Rescate Carretero') return 1;
        return new Date(b.created_at) - new Date(a.created_at);
    });

    activeLogs.forEach(log => {
        const unitObj = (window.maintUnits || []).find(u => u.id === log.unit_id);
        const unitName = unitObj ? unitObj.economic_number : 'Desconocida';
        
        let typeBadge = '';
        if (log.type === 'Rescate Carretero') {
            typeBadge = `<span class="bg-red-600 text-white text-xs font-black px-2 py-0.5 rounded animate-pulse"><i class="fas fa-truck-medical"></i> Rescate</span>`;
        } else if (log.type === 'Preventivo') {
            typeBadge = `<span class="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded"><i class="fas fa-wrench"></i> Preventivo</span>`;
        } else {
            typeBadge = `<span class="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-0.5 rounded"><i class="fas fa-tools"></i> Correctivo</span>`;
        }

        let statusClass = 'text-gray-500 font-bold';
        if (log.status === 'En Taller') statusClass = 'text-red-600 font-black';
        if (log.status === 'Programado') statusClass = 'text-indigo-600 font-bold';

        const displayDate = log.scheduled_date ? new Date(log.scheduled_date).toLocaleDateString() : new Date(log.created_at).toLocaleDateString();

        html += `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-3 font-bold text-slate-800">${unitName}</td>
                <td class="p-3">${typeBadge}</td>
                <td class="p-3 text-xs uppercase ${statusClass}">${log.status}</td>
                <td class="p-3 text-xs text-slate-600 max-w-[200px] truncate" title="${log.description}">${log.description || 'Sin descripción'}</td>
                <td class="p-3 text-xs text-slate-500 font-mono">${displayDate}</td>
                <td class="p-3 text-center">
                    ${isMaintOrAdmin ? `
                    <div class="flex gap-1 justify-center">
                        ${log.status === 'Programado' ? `
                        <button class="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1 shadow-sm" onclick="window.sendUnitToShopDirect('${log.id}', '${log.unit_id}')">
                            <i class="fas fa-tools"></i> Meter a Taller
                        </button>
                        ` : ''}
                        <button class="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1 shadow-sm" onclick="window.resolveMaintLog('${log.id}', '${log.unit_id}', '${log.type}')">
                            <i class="fas fa-check"></i> Liberar / Resolver
                        </button>
                    </div>
                    ` : '---'}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Handler: Add Preventive Maintenance
async function handleAddPreventive(e) {
    e.preventDefault();
    const unitId = document.getElementById('maint-unit-preventive').value;
    const date = document.getElementById('maint-date-preventive').value;
    const desc = document.getElementById('maint-desc-preventive').value.trim();

    if (!unitId || !date || !desc) {
        alert('Todos los campos son obligatorios.');
        return;
    }

    const newLog = {
        unit_id: unitId,
        type: 'Preventivo',
        status: 'Programado',
        scheduled_date: new Date(date).toISOString(),
        description: desc
    };

    await insertTableDataFallback('maintenance_logs', newLog);
    
    // Log to assignments history in Supabase
    const unitObj = window.maintUnits.find(u => u.id === unitId);
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    await supabase.from('assignments_history').insert([{
        unit_id: unitId,
        unidad_eco_txt: unitObj?.economic_number || null,
        action_type: 'Mantenimiento Programado',
        details: `Servicio preventivo programado para el día: ${date}. Detalle: ${desc}`,
        modified_by: currentUser.name,
        timestamp: new Date().toISOString()
    }]);

    document.getElementById('form-preventive').reset();
    alert('Servicio preventivo programado exitosamente.');
    await loadMaintenanceData();
}

// Handler: Add Road Rescue
async function handleAddRescue(e) {
    e.preventDefault();
    const unitId = document.getElementById('maint-unit-rescue').value;
    const location = document.getElementById('maint-location-rescue').value.trim();
    const desc = document.getElementById('maint-desc-rescue').value.trim();

    if (!unitId || !location || !desc) {
        alert('Todos los campos son obligatorios.');
        return;
    }

    const description = `Ubicación: ${location} | Falla: ${desc}`;

    const newLog = {
        unit_id: unitId,
        type: 'Rescate Carretero',
        status: 'En Proceso',
        description: description
    };

    await insertTableDataFallback('maintenance_logs', newLog);
    
    const unitObj = window.maintUnits.find(u => u.id === unitId);
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    await supabase.from('assignments_history').insert([{
        unit_id: unitId,
        unidad_eco_txt: unitObj?.economic_number || null,
        action_type: 'Rescate Carretero Activo',
        details: `Rescate carretero registrado en: ${location}. Detalle: ${desc}`,
        modified_by: currentUser.name,
        timestamp: new Date().toISOString()
    }]);

    document.getElementById('form-rescue').reset();
    alert('Rescate carretero registrado. Alerta roja activa en Asignaciones.');
    await loadMaintenanceData();
}

// Action: Resolve/Release unit
window.resolveMaintLog = async (logId, unitId, type) => {
    if (!confirm('¿Desea dar de alta / resolver este servicio y liberar la unidad?')) return;
    
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    
    // 1. Mark log as resolved
    await updateTableDataFallback('maintenance_logs', logId, { status: 'Resuelto' });

    // 2. Change unit status back to 'Vacia' (Patio)
    const { error: unitErr } = await supabase.from('units').update({
        status: 'Vacia',
        last_status_update: new Date().toISOString(),
        last_modified_by: currentUser.name
    }).eq('id', unitId);

    if (unitErr) {
        console.error("Error al actualizar unidad:", unitErr);
    } else {
        const unitObj = window.maintUnits.find(u => u.id === unitId);
        await supabase.from('assignments_history').insert([{
            unit_id: unitId,
            unidad_eco_txt: unitObj?.economic_number || null,
            action_type: 'Liberación de Mantenimiento',
            details: `Unidad liberada de mantenimiento (${type}) y pasada a estatus Vacía (Patio)`,
            modified_by: currentUser.name,
            timestamp: new Date().toISOString()
        }]);
    }

    alert('Servicio resuelto y unidad liberada a estatus "Vacia" (Patio).');
    await loadMaintenanceData();
};

// Action: Move unit scheduled for preventive into workshop (En Taller)
window.sendUnitToShopDirect = async (logId, unitId) => {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    
    // 1. Update log status to 'En Taller'
    await updateTableDataFallback('maintenance_logs', logId, { status: 'En Taller' });

    // 2. Update unit status in units table to 'En Taller'
    const { error: unitErr } = await supabase.from('units').update({
        status: 'En Taller',
        last_status_update: new Date().toISOString(),
        last_modified_by: currentUser.name
    }).eq('id', unitId);

    if (unitErr) {
        console.error("Error updating unit status:", unitErr);
    } else {
        const unitObj = window.maintUnits.find(u => u.id === unitId);
        await supabase.from('assignments_history').insert([{
            unit_id: unitId,
            unidad_eco_txt: unitObj?.economic_number || null,
            action_type: 'Ingreso a Taller',
            details: `Unidad ingresada a taller para servicio preventivo programado`,
            modified_by: currentUser.name,
            timestamp: new Date().toISOString()
        }]);
    }

    alert('Unidad ingresada a taller. Estatus de la flota actualizado.');
    await loadMaintenanceData();
};

// Modal: Send unit directly to shop (Manual)
function openSendToWorkshopModal() {
    const units = window.maintUnits || [];
    const availableUnits = units.filter(u => u.status !== 'En Taller');

    if (availableUnits.length === 0) {
        alert('Todas las unidades ya se encuentran en taller.');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 w-96 shadow-2xl border border-gray-100">
            <h3 class="text-lg font-black mb-4 border-b pb-2 text-red-600">
                <i class="fas fa-tools mr-2"></i> Ingresar Unidad a Taller
            </h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Seleccionar Unidad</label>
                    <select id="direct-shop-unit" class="w-full border-2 border-gray-200 focus:border-red-500 outline-none p-2 rounded-lg font-medium">
                        ${availableUnits.map(u => `<option value="${u.id}">${u.economic_number} (${u.type}) - ${u.status}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Motivo del Ingreso</label>
                    <textarea id="direct-shop-desc" class="w-full border-2 border-gray-200 focus:border-red-500 outline-none p-2 rounded-lg font-medium" rows="3" placeholder="Ej: Reparación de marcha, servicio correctivo..."></textarea>
                </div>
            </div>
            <div class="mt-6 flex justify-end gap-3 pt-4 border-t">
                <button class="px-4 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition" onclick="this.closest('.fixed').remove()">Cancelar</button>
                <button class="px-4 py-2 font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition" id="btn-save-direct-shop">Ingresar a Taller</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-save-direct-shop').onclick = async () => {
        const unitId = document.getElementById('direct-shop-unit').value;
        const desc = document.getElementById('direct-shop-desc').value.trim();

        if (!unitId || !desc) {
            alert('Todos los campos son obligatorios.');
            return;
        }

        const newLog = {
            unit_id: unitId,
            type: 'Correctivo',
            status: 'En Taller',
            description: desc
        };

        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

        await insertTableDataFallback('maintenance_logs', newLog);

        const { error: unitErr } = await supabase.from('units').update({
            status: 'En Taller',
            last_status_update: new Date().toISOString(),
            last_modified_by: currentUser.name
        }).eq('id', unitId);

        if (unitErr) {
            console.error("Error al actualizar unidad:", unitErr);
        } else {
            const unitObj = units.find(u => u.id === unitId);
            await supabase.from('assignments_history').insert([{
                unit_id: unitId,
                unidad_eco_txt: unitObj?.economic_number || null,
                action_type: 'Ingreso Manual a Taller',
                details: `Ingresado a taller manualmente. Motivo: ${desc}`,
                modified_by: currentUser.name,
                timestamp: new Date().toISOString()
            }]);
        }

        modal.remove();
        alert('Unidad ingresada a taller exitosamente.');
        await loadMaintenanceData();
    };
}
