import { supabase } from '../services/supabaseClient.js';
import { fetchSamsaraLocations } from '../services/samsara.js';

export async function renderCameras(container) {
    container.innerHTML = `
        <div id="view-cameras" class="p-6 fade-in h-full flex flex-col gap-6">
            <div class="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-orange-100">
                <h3 class="text-xl font-bold text-gray-800"><i class="fas fa-video text-orange-500 mr-2"></i> Bitácora de Cámaras</h3>
                <button id="btn-new-log" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg shadow-md transition font-bold flex items-center gap-2">
                    <i class="fas fa-plus"></i> Nuevo Registro
                </button>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
                <div class="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h4 class="font-bold text-gray-700">Historial de Registros</h4>
                    <div class="flex gap-2">
                        <input type="date" id="filter-date" class="border p-2 rounded-lg text-sm outline-none focus:border-orange-500">
                        <select id="filter-unit" class="border p-2 rounded-lg text-sm outline-none focus:border-orange-500">
                            <option value="">Todas las Unidades...</option>
                        </select>
                    </div>
                </div>
                <div class="overflow-auto flex-1 p-0">
                    <table class="w-full text-left border-collapse min-w-[800px]">
                        <thead class="bg-white sticky top-0 shadow-sm z-10">
                            <tr class="text-xs uppercase tracking-wider text-gray-500 border-b">
                                <th class="p-4 font-bold">Fecha / Hora</th>
                                <th class="p-4 font-bold">Unidad / Operador</th>
                                <th class="p-4 font-bold text-center">Movimiento</th>
                                <th class="p-4 font-bold text-center">Cinturón</th>
                                <th class="p-4 font-bold text-center">Celular</th>
                                <th class="p-4 font-bold text-center">Cámara Tapada</th>
                                <th class="p-4 font-bold text-center">Evidencia</th>
                                <th class="p-4 font-bold text-right">Elaboró</th>
                            </tr>
                        </thead>
                        <tbody id="cameras-body" class="divide-y divide-gray-100">
                            <tr><td colspan="8" class="p-8 text-center text-gray-400 font-medium">Cargando bitácora... <i class="fas fa-spinner fa-spin"></i></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div id="modal-container"></div>
        </div>
    `;

    document.getElementById('btn-new-log').addEventListener('click', openNewLogModal);
    document.getElementById('filter-date').addEventListener('change', loadTable);
    document.getElementById('filter-unit').addEventListener('change', loadTable);

    await loadFilters();
    loadTable();
}

async function loadFilters() {
    const { data: units } = await supabase.from('units').select('id, economic_number').order('economic_number');
    if (units) {
        const select = document.getElementById('filter-unit');
        units.forEach(u => {
            select.insertAdjacentHTML('beforeend', `<option value="${u.id}">${u.economic_number}</option>`);
        });
        window.allUnitsData = units; 
    }
    const { data: ops } = await supabase.from('operators').select('id, name').order('name');
    if (ops) window.allOpsData = ops;
}

async function loadTable() {
    const tbody = document.getElementById('cameras-body');
    const filterDate = document.getElementById('filter-date').value;
    const filterUnit = document.getElementById('filter-unit').value;

    let query = supabase.from('camera_logs').select('*, units(economic_number), operators(name)').order('created_at', { ascending: false });

    if (filterUnit) query = query.eq('unit_id', filterUnit);
    if (filterDate) {
        // Simple date filter (beginning to end of day UTC)
        query = query.gte('created_at', filterDate + 'T00:00:00.000Z')
                     .lte('created_at', filterDate + 'T23:59:59.999Z');
    }

    const { data, error } = await query;

    if (error) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-red-500 font-bold">${error.message}</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-gray-500 font-medium">No hay registros para mostrar.</td></tr>';
        return;
    }

    let html = '';
    data.forEach(log => {
        const date = new Date(log.created_at).toLocaleString();
        
        const isInfraction = !log.has_seatbelt || log.using_cellphone || log.camera_covered;
        const rowBg = isInfraction ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-gray-50';
        
        const renderIcon = (val, invert = false) => {
            // invert: true for seatbelt (green if true). false for cellphone/covered (red if true)
            if (val) return invert ? '<i class="fas fa-check-circle text-green-500 text-lg"></i>' : '<i class="fas fa-times-circle text-red-500 text-lg"></i>';
            return invert ? '<i class="fas fa-times-circle text-red-500 text-lg"></i>' : '<i class="fas fa-check-circle text-green-500 text-lg"></i>';
        };

        const renderMov = (val) => val ? '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">EN MOV.</span>' : '<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">DETENIDO</span>';

        const photoHtml = log.photo_url 
            ? `<a href="${log.photo_url}" target="_blank" class="text-orange-500 hover:text-orange-700 bg-orange-50 px-3 py-1 rounded-full text-xs font-bold"><i class="fas fa-image"></i> Ver Foto</a>` 
            : '<span class="text-gray-400 text-xs">Sin Foto</span>';

        html += `
            <tr class="border-b transition ${rowBg}">
                <td class="p-4 text-sm text-gray-600 font-medium">${date}</td>
                <td class="p-4">
                    <div class="font-bold text-gray-800">${log.units?.economic_number || 'N/A'}</div>
                    <div class="text-xs text-gray-500 truncate max-w-[150px]">${log.operators?.name || 'N/A'}</div>
                </td>
                <td class="p-4 text-center">${renderMov(log.is_moving)}</td>
                <td class="p-4 text-center">${renderIcon(log.has_seatbelt, true)}</td>
                <td class="p-4 text-center">${renderIcon(log.using_cellphone, false)}</td>
                <td class="p-4 text-center">${renderIcon(log.camera_covered, false)}</td>
                <td class="p-4 text-center">${photoHtml}</td>
                <td class="p-4 text-sm text-gray-500 text-right">${log.created_by}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function openNewLogModal() {
    const units = window.allUnitsData || [];
    const ops = window.allOpsData || [];

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in';
    modal.innerHTML = `
        <div class="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="bg-orange-500 p-4 shrink-0 flex justify-between items-center text-white">
                <h3 class="text-xl font-black"><i class="fas fa-video mr-2"></i> Nuevo Registro de Cámara</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-white hover:text-orange-200"><i class="fas fa-times text-xl"></i></button>
            </div>
            
            <div class="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Unidad</label>
                        <select id="log-unit" class="w-full border-2 border-gray-200 focus:border-orange-500 outline-none p-2 rounded-lg font-bold text-gray-700">
                            <option value="">Selecciona...</option>
                            ${units.map(u => `<option value="${u.id}">${u.economic_number}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Operador</label>
                        <select id="log-op" class="w-full border-2 border-gray-200 focus:border-orange-500 outline-none p-2 rounded-lg font-bold text-gray-700">
                            <option value="">Selecciona...</option>
                            ${ops.map(o => `<option value="${o.id}">${o.name}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                    <label class="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" id="log-moving" class="w-5 h-5 text-orange-500 rounded focus:ring-orange-500">
                        <span class="font-bold text-gray-700 group-hover:text-orange-600 transition">¿Unidad en movimiento?</span>
                    </label>
                    <hr class="border-gray-200">
                    <label class="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" id="log-belt" checked class="w-5 h-5 text-green-500 rounded focus:ring-green-500">
                        <span class="font-bold text-gray-700 group-hover:text-green-600 transition">¿Lleva cinturón puesto?</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" id="log-cell" class="w-5 h-5 text-red-500 rounded focus:ring-red-500">
                        <span class="font-bold text-gray-700 group-hover:text-red-600 transition">¿Uso de celular detectado?</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" id="log-cover" class="w-5 h-5 text-red-500 rounded focus:ring-red-500">
                        <span class="font-bold text-gray-700 group-hover:text-red-600 transition">¿Cámara tapada o bloqueada?</span>
                    </label>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Evidencia Fotográfica (Opcional)</label>
                    <input type="file" id="log-photo" accept="image/*" class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 transition cursor-pointer">
                </div>
            </div>

            <div class="p-4 border-t bg-gray-50 shrink-0 flex justify-end gap-3">
                <button class="px-5 py-2 font-bold text-gray-500 hover:bg-gray-200 rounded-lg transition" onclick="this.closest('.fixed').remove()">Cancelar</button>
                <button class="px-5 py-2 font-bold bg-orange-500 text-white rounded-lg hover:bg-orange-600 shadow-lg shadow-orange-500/30 transition flex items-center gap-2" id="btn-submit-log">
                    <span>Guardar Registro</span>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-submit-log').onclick = async function() {
        const unitId = document.getElementById('log-unit').value;
        const opId = document.getElementById('log-op').value;
        if (!unitId || !opId) return alert("Selecciona unidad y operador.");

        const isMoving = document.getElementById('log-moving').checked;
        const hasBelt = document.getElementById('log-belt').checked;
        const useCell = document.getElementById('log-cell').checked;
        const cover = document.getElementById('log-cover').checked;
        const photoFile = document.getElementById('log-photo').files[0];

        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || {name: 'Sistema'};

        try {
            let photoUrl = null;

            // 1. Upload Photo if exists
            if (photoFile) {
                const fileExt = photoFile.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                
                const { error: uploadError, data } = await supabase.storage
                    .from('camera_photos')
                    .upload(`logs/${fileName}`, photoFile);
                    
                if (uploadError) throw new Error("Error subiendo foto. Verifique que el bucket 'camera_photos' exista y sea público. " + uploadError.message);

                const { data: publicUrlData } = supabase.storage.from('camera_photos').getPublicUrl(`logs/${fileName}`);
                photoUrl = publicUrlData.publicUrl;
            }

            // 2. Insert Log
            const { data: logData, error: logError } = await supabase.from('camera_logs').insert([{
                unit_id: unitId,
                operator_id: opId,
                is_moving: isMoving,
                has_seatbelt: hasBelt,
                using_cellphone: useCell,
                camera_covered: cover,
                photo_url: photoUrl,
                created_by: currentUser.name
            }]).select().single();

            if (logError) throw logError;

            // 3. Auto-Incident generation
            const infractions = [];
            if (!hasBelt) infractions.push("Sin cinturón de seguridad");
            if (useCell) infractions.push("Uso de celular conduciendo");
            if (cover) infractions.push("Cámara tapada o bloqueada");

            if (infractions.length > 0) {
                // Fetch Samsara to get speed/location
                const samsaraData = await fetchSamsaraLocations();
                const unitNumber = document.getElementById('log-unit').options[document.getElementById('log-unit').selectedIndex].text;
                const samsaraVeh = samsaraData.find(v => v.name.includes(unitNumber));
                
                const speed = samsaraVeh ? `${samsaraVeh.location.speed} km/h` : 'Desconocida';
                const lat = samsaraVeh ? samsaraVeh.location.latitude : null;
                const lng = samsaraVeh ? samsaraVeh.location.longitude : null;
                const gmapsUrl = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null;

                const { error: incError } = await supabase.from('incidents').insert([{
                    unit_id: unitId,
                    operator_id: opId,
                    source_log_id: logData.id,
                    incident_type: infractions.join(' + '),
                    severity_value: infractions.length, // Basic sum severity
                    location_speed: speed,
                    location_url: gmapsUrl
                }]);

                if (incError) console.error("Error creating incident:", incError);
            }

            modal.remove();
            loadTable();
        } catch (e) {
            console.error(e);
            alert(e.message);
            btn.disabled = false;
            btn.innerHTML = 'Guardar Registro';
        }
    };
}
