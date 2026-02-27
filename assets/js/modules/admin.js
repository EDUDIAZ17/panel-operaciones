import { supabase } from '../services/supabaseClient.js';
import { fetchSamsaraVehicles, fetchSamsaraDrivers } from '../services/samsara.js';

export async function renderAdmin(container) {
    container.innerHTML = `
        <div id="view-admin" class="p-6 fade-in space-y-6">
            <div class="flex justify-between items-center">
                <h2 class="text-2xl font-bold text-gray-800">Centro de Gestión Operativa</h2>
                <div class="flex gap-2">
                    <button id="tab-operators" class="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-sm transition">Operadores</button>
                    <button id="tab-units" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold shadow-sm transition hover:bg-gray-300">Unidades</button>
                </div>
            </div>

            <!-- Operators Section -->
            <div id="section-operators" class="space-y-4">
                <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-lg font-bold text-gray-700 flex items-center">
                            <i class="fas fa-users-cog text-blue-600 mr-2"></i> Directorio de Operadores
                        </h3>
                        <div class="flex gap-2">
                             <button id="btn-sync-ops" class="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center border border-gray-200">
                                <i class="fas fa-sync-alt mr-2"></i> SYNC SAMSARA
                            </button>
                            <button id="btn-new-op" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center shadow-md">
                                <i class="fas fa-plus mr-2"></i> NUEVO OPERADOR
                            </button>
                        </div>
                    </div>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead class="bg-gray-50 border-b">
                                <tr class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <th class="px-6 py-4">ID</th>
                                    <th class="px-6 py-4">Nombre Completo</th>
                                    <th class="px-6 py-4">Estado</th>
                                    <th class="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="admin-operators-body" class="divide-y divide-gray-100">
                                <!-- Loads dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Units Section (Hidden by default) -->
            <div id="section-units" class="hidden space-y-4">
                <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-lg font-bold text-gray-700 flex items-center">
                            <i class="fas fa-truck text-orange-600 mr-2"></i> Inventario de Unidades
                        </h3>
                        <div class="flex gap-2">
                             <button id="btn-sync-units" class="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center border border-gray-200">
                                <i class="fas fa-sync-alt mr-2"></i> SYNC SAMSARA
                            </button>
                            <button id="btn-new-unit" class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center shadow-md">
                                <i class="fas fa-plus mr-2"></i> NUEVA UNIDAD
                            </button>
                        </div>
                    </div>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead class="bg-gray-50 border-b">
                                <tr class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <th class="px-6 py-4">Eco #</th>
                                    <th class="px-6 py-4">Tipo</th>
                                    <th class="px-6 py-4">Placas</th>
                                    <th class="px-6 py-4">Estatus</th>
                                    <th class="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="admin-units-body" class="divide-y divide-gray-100">
                                <!-- Loads dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <div id="admin-modal-container"></div>
        </div>
    `;

    setupTabs();
    loadOperators();
    loadUnits();
    
    document.getElementById('btn-new-op').onclick = () => openOperatorModal();
    document.getElementById('btn-new-unit').onclick = () => openUnitModal();
    document.getElementById('btn-sync-ops').onclick = syncOperatorsFromSamsara;
    document.getElementById('btn-sync-units').onclick = syncUnitsFromSamsara;
}

function setupTabs() {
    const btnOps = document.getElementById('tab-operators');
    const btnUnits = document.getElementById('tab-units');
    const secOps = document.getElementById('section-operators');
    const secUnits = document.getElementById('section-units');

    btnOps.onclick = () => {
        btnOps.className = 'px-4 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-sm transition';
        btnUnits.className = 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold shadow-sm transition hover:bg-gray-300';
        secOps.classList.remove('hidden');
        secUnits.classList.add('hidden');
    };

    btnUnits.onclick = () => {
        btnUnits.className = 'px-4 py-2 bg-orange-600 text-white rounded-lg font-bold shadow-sm transition';
        btnOps.className = 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold shadow-sm transition hover:bg-gray-300';
        secUnits.classList.remove('hidden');
        secOps.classList.add('hidden');
    };
}

async function loadOperators() {
    const list = document.getElementById('admin-operators-body');
    const { data: ops } = await supabase.from('operators').select('*').order('name');
    
    if(!ops) return;

    list.innerHTML = ops.map(op => `
        <tr class="hover:bg-gray-50 transition">
            <td class="px-6 py-4 text-xs font-mono text-gray-400">#${op.id.slice(0,8)}</td>
            <td class="px-6 py-4 font-bold text-gray-700">${op.name}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 ${op.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} rounded-full text-[10px] font-bold">
                    ${op.active ? 'ACTIVO' : 'INACTIVO'}
                </span>
            </td>
            <td class="px-6 py-4 text-right space-x-2">
                <button class="text-blue-600 hover:bg-blue-50 p-2 rounded transition edit-op" data-id="${op.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="text-red-500 hover:bg-red-50 p-2 rounded transition del-op" data-id="${op.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    list.querySelectorAll('.edit-op').forEach(btn => 
        btn.onclick = () => openOperatorModal(ops.find(o => o.id === btn.dataset.id))
    );
    list.querySelectorAll('.del-op').forEach(btn => 
        btn.onclick = () => confirmDelete('operators', btn.dataset.id, loadOperators)
    );
}

async function loadUnits() {
    const list = document.getElementById('admin-units-body');
    const { data: units } = await supabase.from('units').select('*').order('economic_number');
    
    if(!units) return;

    list.innerHTML = units.map(u => `
        <tr class="hover:bg-gray-50 transition">
            <td class="px-6 py-4 font-bold text-gray-800">${u.economic_number}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${u.type}</td>
            <td class="px-6 py-4 text-sm font-mono">${u.placas || '---'}</td>
            <td class="px-6 py-4">
                <span class="text-xs uppercase font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">${u.status}</span>
            </td>
            <td class="px-6 py-4 text-right space-x-2">
                <button class="text-blue-600 hover:bg-blue-50 p-2 rounded transition edit-unit" data-id="${u.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="text-red-500 hover:bg-red-50 p-2 rounded transition del-unit" data-id="${u.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    list.querySelectorAll('.edit-unit').forEach(btn => 
        btn.onclick = () => openUnitModal(units.find(u => u.id === btn.dataset.id))
    );
    list.querySelectorAll('.del-unit').forEach(btn => 
        btn.onclick = () => confirmDelete('units', btn.dataset.id, loadUnits)
    );
}

// --- Modals ---

function openOperatorModal(op = null) {
    const container = document.getElementById('admin-modal-container');
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 w-[400px] shadow-2xl scale-in">
            <h3 class="text-xl font-bold mb-6 text-gray-800">${op ? 'Editar' : 'Registro de'} Operador</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">NOMBRE COMPLETO</label>
                    <input type="text" id="modal-op-name" class="w-full border p-3 rounded-xl bg-gray-50" value="${op ? op.name : ''}" required>
                </div>
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="modal-op-active" ${op ? (op.active ? 'checked' : '') : 'checked'}>
                    <label class="text-sm font-bold text-gray-700">Operador Activo</label>
                </div>
            </div>
            <div class="mt-8 flex justify-end gap-3">
                <button class="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl" onclick="this.closest('.fixed').remove()">Cancelar</button>
                <button class="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition" id="save-op-btn">Guardar</button>
            </div>
        </div>
    `;
    container.appendChild(modal);

    document.getElementById('save-op-btn').onclick = async () => {
        const name = document.getElementById('modal-op-name').value;
        const active = document.getElementById('modal-op-active').checked;
        if(!name) return;

        const { error } = op 
            ? await supabase.from('operators').update({ name, active }).eq('id', op.id)
            : await supabase.from('operators').insert({ name, active });

        if(error) alert(error.message);
        else {
            modal.remove();
            loadOperators();
        }
    };
}

function openUnitModal(unit = null) {
    const container = document.getElementById('admin-modal-container');
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 w-[400px] shadow-2xl scale-in">
            <h3 class="text-xl font-bold mb-6 text-gray-800">${unit ? 'Editar' : 'Registro de'} Unidad</h3>
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">ECONÓMICO</label>
                        <input type="text" id="modal-unit-eco" class="w-full border p-3 rounded-xl bg-gray-50" value="${unit ? unit.economic_number : ''}" required placeholder="M-101">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">TIPO</label>
                        <select id="modal-unit-type" class="w-full border p-3 rounded-xl bg-gray-50">
                            <option value="Madrina" ${unit?.type === 'Madrina' ? 'selected' : ''}>Madrina</option>
                            <option value="Pipa" ${unit?.type === 'Pipa' ? 'selected' : ''}>Pipa</option>
                            <option value="Contenedor" ${unit?.type === 'Contenedor' ? 'selected' : ''}>Contenedor</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">PLACAS</label>
                    <input type="text" id="modal-unit-placas" class="w-full border p-3 rounded-xl bg-gray-50" value="${unit ? (unit.placas || '') : ''}" placeholder="ABC-1234">
                </div>
            </div>
            <div class="mt-8 flex justify-end gap-3">
                <button class="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl" onclick="this.closest('.fixed').remove()">Cancelar</button>
                <button class="px-6 py-2 bg-orange-600 text-white font-bold rounded-xl shadow-lg hover:bg-orange-700 transition" id="save-unit-btn">Guardar</button>
            </div>
        </div>
    `;
    container.appendChild(modal);

    document.getElementById('save-unit-btn').onclick = async () => {
        const economic_number = document.getElementById('modal-unit-eco').value;
        const type = document.getElementById('modal-unit-type').value;
        const placas = document.getElementById('modal-unit-placas').value;

        if(!economic_number) return;

        const { error } = unit 
            ? await supabase.from('units').update({ economic_number, type, placas }).eq('id', unit.id)
            : await supabase.from('units').insert({ economic_number, type, placas, status: 'Sin Operador' });

        if(error) alert(error.message);
        else {
            modal.remove();
            loadUnits();
        }
    };
}

function confirmDelete(table, id, callback) {
    const container = document.getElementById('admin-modal-container');
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 w-[350px] shadow-2xl text-center scale-in">
            <div class="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
                <i class="fas fa-trash-alt"></i>
            </div>
            <h3 class="text-xl font-bold mb-2 text-gray-800">¿Estás seguro?</h3>
            <p class="text-sm text-gray-500 mb-6 font-medium">Esta acción no se puede deshacer. Escribe "BORRAR" para confirmar.</p>
            <input type="text" id="delete-confirm-code" class="w-full border-2 border-red-50 p-3 rounded-xl bg-red-50/50 text-center font-bold text-red-600 mb-6 placeholder-red-200" placeholder="Código de seguridad">
            <div class="flex gap-3">
                <button class="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition" onclick="this.closest('.fixed').remove()">No, cancelar</button>
                <button class="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transition" id="execute-delete-btn">SÍ, ELIMINAR</button>
            </div>
        </div>
    `;
    container.appendChild(modal);

    document.getElementById('execute-delete-btn').onclick = async () => {
        if (document.getElementById('delete-confirm-code').value !== 'BORRAR') {
            alert("Código incorrecto");
            return;
        }
        
        const { error } = await supabase.from(table).delete().eq('id', id);
        if(error) alert(error.message);
        else {
            modal.remove();
            callback();
        }
    };
}

async function syncOperatorsFromSamsara() {
    const btn = document.getElementById('btn-sync-ops');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> SINCRONIZANDO...';

    try {
        const samsaraDrivers = await fetchSamsaraDrivers();
        const { data: existingOps } = await supabase.from('operators').select('name');
        const existingNames = new Set(existingOps?.map(o => o.name.trim().toLowerCase()) || []);

        // Deduplicate Samsara results first
        const uniqueSamsara = Array.from(new Map(samsaraDrivers.map(d => [d.name.trim().toLowerCase(), d])).values());

        const toInsert = uniqueSamsara
            .filter(d => d.name && !existingNames.has(d.name.trim().toLowerCase()))
            .map(d => ({ name: d.name.trim(), active: true }));

        if (toInsert.length > 0) {
            const { error } = await supabase.from('operators').insert(toInsert);
            if (error) throw error;
            alert(`Sincronización exitosa: ${toInsert.length} nuevos operadores añadidos.`);
        } else {
            alert("Sincronización completa: No se encontraron nuevos operadores.");
        }
        loadOperators();
    } catch (error) {
        console.error(error);
        alert("Error en la sincronización: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> SYNC SAMSARA';
    }
}

async function syncUnitsFromSamsara() {
    const btn = document.getElementById('btn-sync-units');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> SINCRONIZANDO...';

    try {
        const samsaraVehicles = await fetchSamsaraVehicles();
        const { data: existingUnits } = await supabase.from('units').select('economic_number');
        const existingEcos = new Set(existingUnits?.map(u => u.economic_number.trim().toLowerCase()) || []);

        // Deduplicate Samsara results first
        const uniqueSamsara = Array.from(new Map(samsaraVehicles.map(v => [v.name.trim().toLowerCase(), v])).values());

        const toInsert = uniqueSamsara
            .filter(v => v.name && !existingEcos.has(v.name.trim().toLowerCase()))
            .map(v => ({ 
                economic_number: v.name.trim(), 
                type: 'Madrina', 
                placas: v.licensePlate || '',
                status: 'Sin Operador' 
            }));

        if (toInsert.length > 0) {
            const { error } = await supabase.from('units').insert(toInsert);
            if (error) throw error;
            alert(`Sincronización exitosa: ${toInsert.length} nuevas unidades añadidas.`);
        } else {
            alert("Sincronización completa: No se encontraron nuevas unidades.");
        }
        loadUnits();
    } catch (error) {
        console.error(error);
        alert("Error en la sincronización: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> SYNC SAMSARA';
    }
}
