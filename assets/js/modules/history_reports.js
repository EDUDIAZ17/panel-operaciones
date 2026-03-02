import { supabase } from '../services/supabaseClient.js';
import { formatDate } from '../utils/formatters.js';

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
                        <thead class="text-[10px] text-gray-400 uppercase tracking-widest bg-gray-50/90 backdrop-blur-sm sticky top-0 border-b border-gray-100 z-10">
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
        const selectedOpName = document.getElementById('filter-operator').options[document.getElementById('filter-operator').selectedIndex].text;
        filteredData = filteredData.filter(d => 
            (d.details && d.details.includes(selectedOpName)) || 
            (d.new_operator_id === opId) || 
            (d.previous_operator_id === opId)
        );
    }

    currentData = filteredData;

    if (filteredData.length === 0) {
        noData.classList.remove('hidden');
        return;
    }

    filteredData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-orange-50/50 transition-colors group bg-white';

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
        list.appendChild(tr);
    });
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
        const tableColumn = ["Fecha y Hora", "Unidad", "Acción/Tipo", "Detalles", "Elaboró"];
        const tableRows = [];

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
