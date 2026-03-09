import { supabase } from '../services/supabaseClient.js';
import { formatDate } from '../utils/formatters.js';

let currentMode = 'auditoria';

export async function renderHistoryReports(container) {
    container.innerHTML = `
        <div class="p-6 fade-in max-w-7xl mx-auto h-full flex flex-col gap-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-blue-50/50 gap-4">
                <div>
                    <h2 class="text-2xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent flex items-center">
                        <i class="fas fa-file-signature text-red-500 mr-3 text-2xl drop-shadow-sm"></i> Reportes Históricos (Bitácora)
                    </h2>
                    <p class="text-gray-500 text-sm mt-1">Audita todos los movimientos realizados en la aplicación con precisión horaria.</p>
                </div>
                <button id="btn-export-pdf" class="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg hover:shadow-red-500/30 transition-all flex items-center gap-2 group">
                    <i class="fas fa-file-pdf group-hover:-translate-y-1 transition-transform"></i> Descargar PDF Formal
                </button>
            </div>

            <!-- Tabs -->
            <div class="flex border-b mb-1">
                <button class="tab-btn active px-6 py-3 font-bold text-sm text-red-600 border-b-2 border-red-600 transition" data-target="auditoria" id="tab-auditoria">
                    <i class="fas fa-list-ul mr-2"></i> Auditoría General
                </button>
                <button class="tab-btn px-6 py-3 font-bold text-sm text-gray-500 hover:text-red-500 transition border-b-2 border-transparent" data-target="viajes" id="tab-viajes">
                    <i class="fas fa-route mr-2"></i> Viajes Completados
                </button>
            </div>

            <!-- Panel de Filtros -->
            <div class="bg-white/90 backdrop-blur-md rounded-2xl p-6 border border-gray-100 shadow-sm w-full">
                <h3 class="text-xs font-black text-gray-500 tracking-widest uppercase mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
                    <i class="fas fa-filter text-orange-400"></i> Parámetros de Búsqueda
                </h3>
                
                <div class="grid grid-cols-1 md:grid-cols-5 gap-5">
                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Fecha Inicio</label>
                        <input type="date" id="filter-start-date" class="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 p-2.5 outline-none font-bold transition">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Fecha Fin</label>
                        <input type="date" id="filter-end-date" class="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 p-2.5 outline-none font-bold transition">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Unidad Económica</label>
                        <select id="filter-unit" class="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 p-2.5 outline-none font-bold transition cursor-pointer">
                            <option value="">Todas las Unidades</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Operador</label>
                        <select id="filter-operator" class="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 p-2.5 outline-none font-bold transition cursor-pointer">
                            <option value="">Todos los Operadores</option>
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button id="btn-apply-filters" class="w-full bg-gray-800 hover:bg-black text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md">
                            <i class="fas fa-search"></i> Buscar Registros
                        </button>
                    </div>
                </div>
            </div>

            <!-- Loading Spinner -->
            <div id="loading-spinner" class="hidden flex justify-center py-10 bg-white/50 rounded-xl backdrop-blur-sm">
                <div class="spinner border-orange-500"></div>
                <span class="ml-3 text-orange-500 font-bold">Cargando bitácora profunda...</span>
            </div>

            <!-- Tabla de Resultados -->
            <div class="bg-white/90 backdrop-blur-md rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden flex-1 flex flex-col">
                <div class="overflow-auto flex-1 custom-scrollbar">
                    <table class="w-full text-sm text-left whitespace-nowrap">
                        <thead class="text-[10px] text-gray-400 uppercase tracking-widest bg-gray-50/90 backdrop-blur-sm sticky top-0 border-b border-gray-100 z-10" id="history-table-thead">
                            <tr>
                                <th class="px-5 py-4 font-black">Fecha y Hora</th>
                                <th class="px-5 py-4 font-black bg-white shadow-sm sticky left-0 z-20">Económico</th>
                                <th class="px-5 py-4 font-black text-center">Acción / Tipo</th>
                                <th class="px-5 py-4 font-black">Detalles Auditados</th>
                                <th class="px-5 py-4 font-black">Usuario (Torre de Control)</th>
                            </tr>
                        </thead>
                        <tbody id="history-table-body" class="divide-y divide-gray-50">
                            <!-- Rows -->
                        </tbody>
                    </table>
                </div>
                <div id="no-data-msg" class="hidden text-center py-8 text-gray-400 italic bg-gray-50 rounded-b-2xl border-t border-gray-100 font-medium">
                    <i class="fas fa-inbox text-3xl mb-3 text-gray-300 block"></i> No se encontraron registros para los filtros seleccionados.
                </div>
            </div>
        </div>
    `;

    // Initialize Filters
    await initFilters();

    // Tabs Event Listeners
    const tabs = container.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
             tabs.forEach(t => {
                t.classList.remove('active', 'text-red-600', 'border-red-600');
                t.classList.add('text-gray-500', 'border-transparent');
            });
            tab.classList.remove('text-gray-500', 'border-transparent');
            tab.classList.add('active', 'text-red-600', 'border-red-600');
            currentMode = tab.dataset.target;
            
            updateTableHeaders();
            loadHistoryData();
        });
    });

    // Event Listeners
    document.getElementById('btn-apply-filters').addEventListener('click', loadHistoryData);
    document.getElementById('btn-export-pdf').addEventListener('click', generatePDF);

    // Initial Load (limit to recent to avoid heavy initial load)
    loadHistoryData();
}

let currentData = [];

async function initFilters() {
    // Set default dates (last month)
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    
    document.getElementById('filter-end-date').value = end.toISOString().split('T')[0];
    document.getElementById('filter-start-date').value = start.toISOString().split('T')[0];

    // Load dropdowns
    const { data: units } = await supabase.from('units').select('id, economic_number').order('economic_number');
    const { data: ops } = await supabase.from('operators').select('id, name').order('name');

    const unitSelect = document.getElementById('filter-unit');
    units?.forEach(u => {
        unitSelect.innerHTML += `<option value="${u.id}">${u.economic_number}</option>`;
    });

    const opSelect = document.getElementById('filter-operator');
    ops?.forEach(o => {
        opSelect.innerHTML += `<option value="${o.id}">${o.name}</option>`;
    });
}

async function loadHistoryData() {
    const list = document.getElementById('history-table-body');
    const spinner = document.getElementById('loading-spinner');
    const noData = document.getElementById('no-data-msg');
    
    const startDt = document.getElementById('filter-start-date').value;
    const endDt = document.getElementById('filter-end-date').value;
    const unitId = document.getElementById('filter-unit').value;
    const opId = document.getElementById('filter-operator').value; // We might not have operator correctly linked in history, but we can try filtering details if needed, or by join.

    list.innerHTML = '';
    spinner.classList.remove('hidden');
    noData.classList.add('hidden');

    // Build Query
    let query = supabase
        .from('assignments_history')
        .select(`
            *,
            units ( economic_number )
        `)
        .order('timestamp', { ascending: false });

    if (currentMode === 'viajes') {
        query = query.eq('action_type', 'Viaje Terminado');
    }

    if (startDt) query = query.gte('timestamp', startDt + 'T00:00:00Z');
    if (endDt) query = query.lte('timestamp', endDt + 'T23:59:59Z');
    if (unitId) query = query.eq('unit_id', unitId);
    
    // Note: If we wanted to filter by operator exactly, we'd need to ensure 'operator_id' is actively used in assignments_history.
    // For now, if opId is provided, we filter in JS since details contains text usually.

    const { data, error } = await query;

    spinner.classList.add('hidden');

    if (error) {
        alert("Error cargando historial: " + error.message);
        return;
    }

    let filteredData = data || [];
    
    if (opId) {
        const opSelect = document.getElementById('filter-operator');
        if (opSelect && opSelect.selectedIndex > -1) {
            const selectedOpName = opSelect.options[opSelect.selectedIndex].text;
            filteredData = filteredData.filter(d => 
                (d.details && d.details.includes(selectedOpName)) || 
                (d.new_operator_id === opId) || 
                (d.previous_operator_id === opId)
            );
        }
    }

    currentData = filteredData;

    if (filteredData.length === 0) {
        noData.classList.remove('hidden');
        return;
    }

    filteredData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-orange-50/50 transition-colors group bg-white';

        if (currentMode === 'auditoria') {
            let badgeClass = 'bg-gray-100 text-gray-600';
            if (row.action_type === 'Cambio de Estatus') badgeClass = 'bg-yellow-100 text-yellow-700 border border-yellow-200';
            if (row.action_type === 'Viaje Programado') badgeClass = 'bg-purple-100 text-purple-700 border border-purple-200';
            if (row.action_type === 'Edición Manual') badgeClass = 'bg-blue-100 text-blue-700 border border-blue-200';
            if (row.action_type.includes('Terminado')) badgeClass = 'bg-emerald-100 text-emerald-700 border border-emerald-200';
            if (row.action_type.includes('Logistico')) badgeClass = 'bg-orange-100 text-orange-700 border border-orange-200';

            tr.innerHTML = `
                <td class="px-5 py-4 whitespace-nowrap text-gray-500 text-xs">${formatDate(row.timestamp)}</td>
                <td class="px-5 py-4 whitespace-nowrap font-black text-gray-800 bg-white group-hover:bg-orange-50/30 sticky left-0 z-10 transition-colors shadow-sm">${row.units?.economic_number || 'N/A'}</td>
                <td class="px-5 py-4 whitespace-nowrap text-center">
                    <span class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm ${badgeClass}">${row.action_type}</span>
                </td>
                <td class="px-5 py-4 text-gray-600 min-w-[400px] leading-relaxed max-w-lg whitespace-normal text-xs font-medium">${row.details || ''}</td>
                <td class="px-5 py-4 whitespace-nowrap text-gray-400 font-bold text-xs"><i class="fas fa-user-circle mr-1"></i> ${row.modified_by || 'Sistema'}</td>
            `;
        } else {
            // "Viaje Terminado" format
            // The details string is like: "Cliente: CHANGAN | Obs: ... | Viaje: {"cliente":"CHANGAN","destino"...}"
            let parsed = {};
            let commentTxt = '';
            let clientTxt = '---';
            try {
                const parts = (row.details || '').split('| Viaje: ');
                if (parts.length > 1) {
                     parsed = JSON.parse(parts[1].trim());
                }
                const p1 = parts[0].split('| Obs: ');
                if (p1.length > 1) {
                     commentTxt = p1[1].trim();
                }
                const p0 = p1[0].split('Cliente: ');
                if (p0.length > 1) {
                    clientTxt = p0[1].trim();
                }
            } catch(e) {}
            
            const origen = parsed.origen || '---';
            const destino = parsed.destino || '---';
            const viaje = parsed.viaje || parsed.bol || '---';
            
            const cp = parsed.checkpoints || {};
            const formatShort = (dtStr) => {
                if (!dtStr) return '---';
                return new Date(dtStr).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
            };
            
            // Re-stringify row to pass to modal
            const rowDataStr = encodeURIComponent(JSON.stringify(row));

            tr.innerHTML = `
                <td class="px-5 py-4 whitespace-nowrap text-gray-500 text-xs font-bold">${formatDate(row.timestamp)}</td>
                <td class="px-5 py-4 whitespace-nowrap font-black text-gray-800 bg-white group-hover:bg-orange-50/30 sticky left-0 z-10">
                    <div class="text-lg">${row.units?.economic_number || 'N/A'}</div>
                    <div class="text-[10px] font-mono text-gray-400">VIAJE / BOL: ${viaje}</div>
                </td>
                <td class="px-5 py-4 whitespace-nowrap font-bold text-blue-700">${clientTxt}</td>
                <td class="px-5 py-4 whitespace-nowrap text-xs">
                    <div><b>Origen:</b> ${origen}</div>
                    <div class="mt-1"><b>Destino:</b> ${destino}</div>
                </td>
                <td class="px-5 py-4 text-[10px] text-gray-500 text-center leading-tight">
                    <div><span class="text-gray-400 border-b border-gray-100 pb-0.5">Fin Carga:</span> <br><b>${formatShort(cp.trip_load_end || cp.llegadaCarga)}</b></div>
                    <div class="mt-1"><span class="text-gray-400 border-b border-gray-100 pb-0.5">Entrega:</span> <br><b>${formatShort(cp.trip_unload_end || cp.finDescarga)}</b></div>
                </td>
                <td class="px-5 py-4 text-xs text-gray-600 truncate max-w-[200px]" title="${commentTxt}">${commentTxt || '<i class="text-gray-300">Ninguna</i>'}</td>
                <td class="px-5 py-4 text-center">
                    <button onclick="window.openTripDetailsModal('${rowDataStr}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded font-bold text-xs transition shadow-sm border border-indigo-200">
                        <i class="fas fa-search-plus mr-1"></i> Ver Desglose
                    </button>
                </td>
            `;
        }
        
        list.appendChild(tr);
    });
}

function updateTableHeaders() {
    const thead = document.querySelector('#history-table-thead');
    if (!thead) return;
    if (currentMode === 'auditoria') {
        thead.innerHTML = `
            <tr>
                <th class="px-5 py-4 font-black">Fecha y Hora</th>
                <th class="px-5 py-4 font-black bg-white shadow-sm sticky left-0 z-20">Económico</th>
                <th class="px-5 py-4 font-black text-center">Acción / Tipo</th>
                <th class="px-5 py-4 font-black">Detalles Auditados</th>
                <th class="px-5 py-4 font-black">Usuario (Torre de Control)</th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr>
                <th class="px-5 py-4 font-black">Fecha de Término</th>
                <th class="px-5 py-4 font-black bg-white shadow-sm sticky left-0 z-20">Unidad</th>
                <th class="px-5 py-4 font-black">Cliente</th>
                <th class="px-5 py-4 font-black">Ruta (Origen/Destino)</th>
                <th class="px-5 py-4 font-black text-center">Tiempos Registrados</th>
                <th class="px-5 py-4 font-black">Observaciones</th>
                <th class="px-5 py-4 font-black text-center">Detalles</th>
            </tr>
        `;
    }
}

function generatePDF() {
    if (currentData.length === 0) {
        alert("No hay datos para exportar. Realiza una búsqueda primero.");
        return;
    }

    // Initialize jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape'); // Oriented landscape for better table layout

    const getBase64Image = (imgUrl, callback) => {
        const img = new Image();
        img.src = imgUrl;
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("getContext");
            if(ctx) {
                ctx.drawImage(img, 0, 0);
            } else {
                canvas.getContext("2d").drawImage(img, 0, 0);
            }
            const dataURL = canvas.toDataURL("image/png");
            callback(dataURL);
        };
        img.onerror = () => {
            // Si falla la imagen, creamos el PDF sin ella.
            callback(null);
        };
    };

    const buildPdf = (logoData) => {
        // Headers
        if (logoData) {
            doc.addImage(logoData, 'PNG', 14, 10, 40, 15);
        }
        
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text("Bitácora de Reportes Históricos", 14, 35);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        const startDt = document.getElementById('filter-start-date').value;
        const endDt = document.getElementById('filter-end-date').value;
        const unitText = document.getElementById('filter-unit').options[document.getElementById('filter-unit').selectedIndex].text;
        
        doc.text(`Periodo: ${startDt || 'Inicio'} a ${endDt || 'Hoy'}   |   Unidad: ${unitText}   |   Generado el: ${new Date().toLocaleString()}`, 14, 43);

        // Prepare Table Data
        let tableColumn = [];
        let tableRows = [];

        if (currentMode === 'auditoria') {
            tableColumn = ["Fecha y Hora", "Unidad", "Acción/Tipo", "Detalles", "Elaboró"];
            currentData.forEach(row => {
                const rowData = [
                    formatDate(row.timestamp),
                    row.units?.economic_number || 'N/A',
                    row.action_type,
                    row.details || '',
                    row.modified_by || 'Sistema'
                ];
                tableRows.push(rowData);
            });
        } else {
            tableColumn = ["Término", "Unidad", "BOL/Viaje", "Cliente", "Ruta", "Obs"];
            currentData.forEach(row => {
                let parsed = {};
                let commentTxt = '';
                let clientTxt = '---';
                try {
                    const parts = (row.details || '').split('| Viaje: ');
                    if (parts.length > 1) parsed = JSON.parse(parts[1].trim());
                    const p1 = parts[0].split('| Obs: ');
                    if (p1.length > 1) commentTxt = p1[1].trim();
                    const p0 = p1[0].split('Cliente: ');
                    if (p0.length > 1) clientTxt = p0[1].trim();
                } catch(e) {}
                
                tableRows.push([
                    formatDate(row.timestamp),
                    row.units?.economic_number || 'N/A',
                    parsed.viaje || parsed.bol || '---',
                    clientTxt,
                    (parsed.origen && parsed.destino) ? `${parsed.origen} a ${parsed.destino}` : '---',
                    commentTxt
                ]);
            });
        }

        // Generate Table
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 50,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { top: 50 },
            columnStyles: {
                3: { cellWidth: 100 } // Detalles column wider
            }
        });

        const filename = `Reporte_Bitacora_${new Date().getTime()}.pdf`;
        doc.save(filename);
    };

    const logoUrl = './logo/logo.png';
    getBase64Image(logoUrl, buildPdf);
}

window.openTripDetailsModal = (encodedRowData) => {
    const row = JSON.parse(decodeURIComponent(encodedRowData));
    
    let parsed = {};
    let commentTxt = '';
    let clientTxt = '---';
    try {
        const parts = (row.details || '').split('| Viaje: ');
        if (parts.length > 1) parsed = JSON.parse(parts[1].trim());
        const p1 = parts[0].split('| Obs: ');
        if (p1.length > 1) commentTxt = p1[1].trim();
        const p0 = p1[0].split('Cliente: ');
        if (p0.length > 1) clientTxt = p0[1].trim();
    } catch(e) {}
    
    const cp = parsed.checkpoints || {};
    const asDateStr = (raw) => raw ? new Date(raw).toLocaleString() : '<span class="text-gray-300 italic">No registrado</span>';
    
    // Checkpoints en orden logico
    const steps = [
        { label: 'Fecha de Programación', val: parsed.scheduled_trip || parsed.assignment_date },
        { label: 'Llegada a Carga', val: cp.trip_load_arrival || cp.llegadaCarga },
        { label: 'Fin de Carga / Ins. Ruta', val: cp.trip_load_end || cp.finCarga },
        { label: 'Inicio de Ruta (Punta a Punta)', val: cp.trip_route_start },
        { label: 'Llegada a Descarga (ETA Cumplido)', val: cp.trip_unload_arrival },
        { label: 'Fin de Ruta (Punta a Punta)', val: cp.trip_route_end },
        { label: 'Fin de Descarga (Entrega Final)', val: cp.trip_unload_end || cp.finDescarga },
        { label: 'Cierre de Viaje en Sistema', val: row.timestamp }
    ];

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in';
    
    let stepsHtml = '';
    steps.forEach((step, idx) => {
        const isLast = idx === steps.length - 1;
        const colorClass = step.val ? 'bg-indigo-500' : 'bg-gray-200';
        const textClass = step.val ? 'text-gray-800 font-bold' : 'text-gray-400';
        
        stepsHtml += `
            <div class="flex relative pb-4">
                ${!isLast ? '<div class="absolute top-4 left-2.5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></div>' : ''}
                <div class="relative flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${colorClass} mt-0.5 shadow ring-4 ring-white"></div>
                <div class="ml-4 min-w-0 flex-1">
                    <p class="text-[10px] uppercase font-bold text-gray-500 tracking-wider">${step.label}</p>
                    <p class="text-sm ${textClass} mt-0.5">${asDateStr(step.val)}</p>
                </div>
            </div>
        `;
    });

    modal.innerHTML = `
        <div class="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden">
            
            <!-- Header -->
            <div class="bg-gradient-to-r from-slate-800 to-slate-900 p-6 flex justify-between items-start">
                <div>
                    <h3 class="text-xl font-black text-white flex items-center gap-2">
                        <i class="fas fa-route text-indigo-400"></i> Desglose Detallado de Viaje
                    </h3>
                    <div class="flex gap-4 mt-3">
                        <span class="bg-slate-700/50 text-slate-200 px-3 py-1 rounded-lg text-xs font-bold font-mono">ECO: ${row.units?.economic_number || 'N/A'}</span>
                        <span class="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-lg text-xs font-bold border border-indigo-500/30">BOL/VJ: ${parsed.viaje || parsed.bol || 'N/A'}</span>
                    </div>
                </div>
                <button onclick="this.closest('.fixed').remove()" class="text-white/50 hover:text-white transition-colors">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>

            <!-- Body Container (Scrollable) -->
            <div class="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50">
                
                <div class="grid grid-cols-2 gap-4 mb-8 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div>
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Cliente</p>
                        <p class="font-black text-gray-800">${clientTxt}</p>
                    </div>
                    <div>
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Destinatario</p>
                        <p class="font-bold text-gray-700">${parsed.destinatario || '---'}</p>
                    </div>
                    <div class="col-span-2 border-t pt-3 mt-1">
                        <div class="flex items-center gap-3">
                            <div class="flex-1">
                                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Origen</p>
                                <p class="font-bold text-orange-600 truncate" title="${parsed.origen || '---'}">${parsed.origen || '---'}</p>
                            </div>
                            <i class="fas fa-arrow-right text-gray-300"></i>
                            <div class="flex-1 text-right">
                                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Destino</p>
                                <p class="font-bold text-blue-600 truncate" title="${parsed.destino || '---'}">${parsed.destino || '---'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <!-- Timeline -->
                    <div>
                        <h4 class="text-sm font-black text-slate-800 border-b pb-2 mb-4 flex items-center gap-2">
                            <i class="fas fa-history text-slate-400"></i> Cronología del Viaje
                        </h4>
                        <div class="pl-2">
                            ${stepsHtml}
                        </div>
                    </div>

                    <!-- Extra Info -->
                    <div class="flex flex-col gap-4">
                        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-gray-50 pb-2">Odómetro Registrado</h4>
                            <div class="grid grid-cols-2 gap-2 text-sm">
                                <div><span class="text-gray-500">Inicial:</span> <br><b>${cp.odoInit ? cp.odoInit + ' km' : '---'}</b></div>
                                <div><span class="text-gray-500">Final:</span> <br><b>${cp.odoEnd ? cp.odoEnd + ' km' : '---'}</b></div>
                            </div>
                        </div>
                        
                        <div class="bg-yellow-50/50 p-4 rounded-xl border border-yellow-100 shadow-sm flex-1">
                            <h4 class="text-xs font-black text-yellow-600 uppercase tracking-widest mb-2 border-b border-yellow-200/50 pb-2">Observaciones de Término</h4>
                            <p class="text-sm text-gray-700 italic leading-relaxed">${commentTxt || 'Sin observaciones registradas al momento del cierre.'}</p>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Footer -->
            <div class="bg-white border-t p-4 flex justify-between items-center text-xs text-gray-500">
                <span><i class="fas fa-user-check mr-1"></i> Cerrado por: <b>${row.modified_by || 'Sistema'}</b></span>
                <button onclick="this.closest('.fixed').remove()" class="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded-lg transition-colors">
                    Cerrar Detalle
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};
