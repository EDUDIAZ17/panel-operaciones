import { supabase } from '../services/supabaseClient.js';
import { fetchSamsaraLocations, fetchSamsaraStats } from '../services/samsara.js';

let currentFilteredUnits = [];
let currentType = 'TODOS';
let currentSamsaraData = [];

const geoCache = new Map();

async function reverseGeocodeStatic(lat, lng, elementId) {
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
                let shortAddress = results[0].formatted_address.split(',').slice(0, 2).join(', ');
                const localityMatch = results.find(r => r.types.includes('locality') || r.types.includes('sublocality') || r.types.includes('route'));
                if (localityMatch) shortAddress = localityMatch.formatted_address.split(',')[0];

                geoCache.set(key, shortAddress);
                const el = document.getElementById(elementId);
                if (el) el.innerText = shortAddress;
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

export async function renderATCReports(container) {
    console.log("Rendering ATC Reports structure...");
    try {
        container.innerHTML = `
            <div id="view-atc-reports" class="p-6 fade-in h-full flex flex-col gap-6">
                <div class="flex justify-between items-center bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-indigo-50/50">
                    <h3 class="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
                        <i class="fas fa-shipping-fast text-indigo-500 mr-3 text-2xl drop-shadow-sm"></i> Reporte Logístico Integral (ATC)
                    </h3>
                    <div class="flex gap-3">
                        <input type="text" id="atc-filter-unidad" placeholder="Buscar por Unidad / Operador..." class="border border-indigo-100 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]" />
                        <select id="atc-filter-status" class="border border-indigo-100 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                            <option value="">Todos los Estatus</option>
                            <option value="En Patio">En Patio</option>
                            <option value="En Taller">En Taller</option>
                            <option value="Transito">En Tránsito</option>
                            <option value="Cargada">Cargada</option>
                            <option value="Vacia">Vacía</option>
                        </select>

                        <select id="atc-report-type" class="border border-indigo-100 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold bg-gray-50 text-indigo-800 shadow-sm cursor-pointer transition">
                            <option value="TODOS">TODOS LOS CLIENTES</option>
                        </select>
                        <button id="btn-refresh-atc-report" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2.5 rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all font-bold group" title="Actualizar Datos">
                            <i class="fas fa-sync-alt group-hover:rotate-180 transition-transform duration-500"></i>
                        </button>
                        <button id="btn-export-atc-report" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-xl shadow-lg hover:shadow-emerald-500/30 transition-all font-bold" title="Exportar Excel / PDF">
                            <i class="fas fa-file-export"></i>
                        </button>
                    </div>
                </div>

                <div class="bg-white/90 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 flex-1 overflow-hidden flex flex-col">
                    <div class="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center text-xs font-bold text-gray-500">
                        <div class="flex items-center gap-2">
                            <div class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                            <span id="atc-report-title" class="text-indigo-900 uppercase tracking-widest">Cargando Reporte...</span>
                        </div>
                        <span class="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full"><i class="fas fa-clock mr-1"></i> Tiempos Logísticos Incluidos</span>
                    </div>
                    <div class="overflow-x-auto custom-scrollbar w-full flex-1 pb-4">
                        <table class="w-full text-left border-collapse min-w-[2200px] whitespace-nowrap" id="table-atc-report">
                            <thead class="bg-white/90 backdrop-blur-sm sticky top-0 shadow-sm z-10 text-[10px] md:text-xs uppercase tracking-widest text-gray-500 border-b">
                                <tr>
                                    <th class="p-4 font-black bg-indigo-50 text-indigo-900 border-r border-gray-100 sticky left-0 z-20">UNIDAD</th>
                                    <th class="p-4 font-bold bg-indigo-50/50 text-indigo-800">OPERADOR</th>
                                    <th class="p-4 font-bold bg-indigo-50/50 text-indigo-800">CLIENTE</th>
                                    <th class="p-4 font-bold bg-indigo-50/50 text-indigo-800">VIAJE / BOL</th>
                                    <th class="p-4 font-bold bg-indigo-50/50 text-indigo-800">ORIGEN</th>
                                    <th class="p-4 font-bold bg-indigo-50/50 text-indigo-800">DESTINO</th>
                                    <th class="p-4 font-bold bg-indigo-50/50 text-indigo-800 text-center">STATUS</th>
                                    <th class="p-4 font-bold bg-indigo-50/50 text-indigo-800 text-center">UBICACION</th>
                                    
                                    <!-- Tiempos Logísticos Headers -->
                                    <th class="p-4 font-black bg-blue-50 text-blue-900 border-l border-blue-100">LLEGADA CARGA</th>
                                    <th class="p-4 font-black bg-blue-50 text-blue-900">INICIO CARGA</th>
                                    <th class="p-4 font-black bg-blue-50 text-blue-900">FIN CARGA</th>
                                    <th class="p-4 font-black bg-purple-50 text-purple-900 border-l border-purple-100">INICIO RUTA</th>
                                    <th class="p-4 font-black bg-purple-50 text-purple-900">FIN RUTA</th>
                                    <th class="p-4 font-black bg-teal-50 text-teal-900 border-l border-teal-100">LLEGADA DESC. (ETA)</th>
                                    <th class="p-4 font-black bg-teal-50 text-teal-900">INICIO DESC.</th>
                                    <th class="p-4 font-black bg-teal-50 text-teal-900">FIN DESC. (ENTREGA)</th>
                                    
                                    <th class="p-4 font-bold bg-gray-50 text-gray-800">COMENTARIOS</th>
                                </tr>
                            </thead>
                            <tbody id="atc-report-body" class="divide-y divide-gray-50 text-sm bg-white">
                                <tr><td colspan="17" class="p-12 text-center text-gray-400 font-medium">Cargando inteligencia de datos logísticos... <i class="fas fa-spinner fa-spin ml-2 text-indigo-500"></i></td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Load clients dynamically for the filter
        const { data: clients, error: clientErr } = await supabase.from('clients').select('*').order('name');
        if (clientErr) console.error("Error fetching clients for filter:", clientErr);
        
        const clientSelect = document.getElementById('atc-report-type');
        if (clients && clientSelect) {
            clients.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = c.name;
                clientSelect.appendChild(opt);
            });
        }

        // Attach Listeners with safety checks
        const addEvent = (id, event, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, fn);
            else console.warn(`Element ${id} not found to attach ${event}`);
        };

        addEvent('atc-report-type', 'change', loadATCReport);
        addEvent('atc-filter-status', 'change', loadATCReport);
        addEvent('atc-filter-unidad', 'keyup', (e) => {
            if(e.key === 'Enter') loadATCReport();
        });
        addEvent('btn-refresh-atc-report', 'click', loadATCReport);
        addEvent('btn-export-atc-report', 'click', exportATCReport);

        console.log("Initialization complete, loading data...");
        loadATCReport();
    } catch (err) {
        console.error("Critical error in renderATCReports:", err);
        container.innerHTML = `<div class="p-10 text-red-500 font-bold bg-red-50 rounded-xl m-6">Error al cargar el reporte: ${err.message}</div>`;
    }
}

async function loadATCReport() {
    console.log("Loading ATC Report data...");
    try {
        const typeEl = document.getElementById('atc-report-type');
        const filterTxtEl = document.getElementById('atc-filter-unidad');
        const filterStatusEl = document.getElementById('atc-filter-status');
        const tbody = document.getElementById('atc-report-body');
        const title = document.getElementById('atc-report-title');

        if (!tbody || !title) {
            console.error("Critical DOM elements for ATC report not found");
            return;
        }

        const type = typeEl ? typeEl.value : 'TODOS';
        const filterTxt = filterTxtEl ? filterTxtEl.value.toLowerCase() : '';
        const filterStatus = filterStatusEl ? filterStatusEl.value : '';

        title.textContent = `Reporte Logístico: ${type}`;
        tbody.innerHTML = `<tr><td colspan="17" class="p-8 text-center text-gray-400 font-medium">Sincronizando con base de datos... <i class="fas fa-spinner fa-spin"></i></td></tr>`;

        const { data: units, error } = await supabase
            .from('units')
            .select('*, operators(name)')
            .order('economic_number');

        if (error) throw error;

        const samsaraData = await fetchSamsaraLocations();

        const sortedUnits = (units || []).sort((a,b) => (a.economic_number || '').localeCompare(b.economic_number || '', undefined, {numeric: true}));

        const filteredUnits = sortedUnits.filter(u => {
            let det = u.details;
            if (typeof det === 'string') { try { det = JSON.parse(det); } catch(e) { det = {}; } }
            det = det || {};
            u.details = det;

            const clienteStr = (det.cliente || '').toUpperCase();
            
            let matchClient = (type === 'TODOS' || clienteStr.includes(type.toUpperCase())); 
            let matchTxt = !filterTxt || (u.economic_number || '').toLowerCase().includes(filterTxt) || (u.operators?.name || '').toLowerCase().includes(filterTxt);
            let matchStatus = !filterStatus || (u.status || '').toLowerCase().includes(filterStatus.toLowerCase());

            return matchClient && matchTxt && matchStatus;
        });

        currentFilteredUnits = filteredUnits;
        currentType = type;
        currentSamsaraData = samsaraData;

        const formatCP = (dateStr) => {
            if (!dateStr) return '<span class="text-gray-300">---</span>';
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return '<span class="text-gray-300">---</span>';
                return `<div class="font-bold text-gray-700">${d.toLocaleDateString('es-MX')}</div><div class="text-[10px] text-gray-400">${d.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}</div>`;
            } catch (e) {
                return '<span class="text-gray-300">---</span>';
            }
        };

        let html = '';
        if (filteredUnits.length === 0) {
            html = `<tr><td colspan="17" class="p-12 text-center text-gray-500 italic">No se encontraron unidades con los filtros seleccionados.</td></tr>`;
        } else {
            filteredUnits.forEach((u, idx) => {
                const det = u.details || {};
                const cp = det.checkpoints || {};
                const opName = u.operators?.name || '<span class="text-gray-400 italic">Sin Asignar</span>';
                const cliente = det.cliente || '---';
                const viaje = det.viaje || det.bol || '---';
                const origen = det.origen || '---';
                const destino = det.destino || '---';
                const comments = det.comments || '';

                const samsaraVeh = samsaraData.find(v => v.name && (v.name.includes(u.economic_number) || (u.placas && v.name.includes(u.placas))));
                let geoId = `atc-geo-${u.id}`;
                let ubicacion = '';
                if (samsaraVeh) {
                    ubicacion = `<div id="${geoId}" class="text-[10px] font-bold text-gray-700 bg-gray-100/80 px-2 py-1 rounded-md border border-gray-200 text-center w-full truncate whitespace-normal leading-tight min-h-[32px] flex items-center justify-center break-words">Analizando...</div>`;
                    setTimeout(() => reverseGeocodeStatic(samsaraVeh.location.latitude, samsaraVeh.location.longitude, geoId), idx * 50);
                } else {
                    ubicacion = `<div class="text-[10px] text-gray-400 italic">Sin GPS Activo</div>`;
                }

                let statusClass = "bg-gray-100 text-gray-600";
                const uStatus = u.status || '';
                if(uStatus.includes('Transito') || uStatus === 'Cargada') statusClass = "bg-green-100 text-green-700 border border-green-200 shadow-sm";
                else if(uStatus === 'En Taller') statusClass = "bg-red-100 text-red-700 border border-red-200 shadow-sm animate-pulse";
                else if(uStatus === 'Vacia') statusClass = "bg-yellow-100 text-yellow-700 border border-yellow-200 shadow-sm";

                html += `
                    <tr class="hover:bg-indigo-50/30 transition-colors group">
                        <td class="p-4 border-r border-gray-100 font-black text-gray-800 bg-white group-hover:bg-indigo-50/50 sticky left-0 z-10 transition-colors shadow-sm">
                            ${u.economic_number}
                        </td>
                        <td class="p-4 font-bold text-gray-600 text-sm">${opName}</td>
                        <td class="p-4 font-bold text-indigo-700 text-sm tracking-wide">${cliente}</td>
                        <td class="p-4 text-gray-500 font-mono text-xs">${viaje}</td>
                        <td class="p-4 font-bold text-gray-600 text-sm">${origen}</td>
                        <td class="p-4 font-bold text-gray-600 text-sm">${destino}</td>
                        <td class="p-4 text-center"><span class="px-3 py-1.5 rounded-lg text-xs font-bold ${statusClass}">${uStatus}</span></td>
                        <td class="p-4 text-center max-w-[150px]">${ubicacion}</td>
                        
                        <td class="p-4 border-l border-blue-50 text-center bg-blue-50/10">${formatCP(cp.trip_load_arrival)}</td>
                        <td class="p-4 text-center bg-blue-50/10">${formatCP(cp.trip_load_start)}</td>
                        <td class="p-4 text-center bg-blue-50/10">${formatCP(cp.trip_load_end)}</td>
                        <td class="p-4 border-l border-purple-50 text-center bg-purple-50/10">${formatCP(cp.trip_route_start)}</td>
                        <td class="p-4 text-center bg-purple-50/10">${formatCP(cp.trip_route_end)}</td>
                        <td class="p-4 border-l border-teal-50 text-center bg-teal-50/10 font-bold text-teal-800">${formatCP(cp.trip_unload_arrival || det.eta)}</td>
                        <td class="p-4 text-center bg-teal-50/10">${formatCP(cp.trip_unload_start)}</td>
                        <td class="p-4 text-center bg-teal-50/10">${formatCP(cp.trip_unload_end)}</td>
                        
                        <td class="p-4 text-sm text-gray-500 truncate max-w-[200px]" title="${comments}">${comments || '---'}</td>
                    </tr>
                `;
            });
        }
        tbody.innerHTML = html;
        console.log("ATC Report loaded successfully");
    } catch (err) {
        console.error("Error loading ATC Report:", err);
        const tbody = document.getElementById('atc-report-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="17" class="p-8 text-center text-red-500 font-bold">Error al cargar datos: ${err.message}</td></tr>`;
    }
}

function exportATCReport() {
    if (currentFilteredUnits.length === 0) {
        Swal.fire('Atención', 'No hay datos para exportar con los filtros actuales.', 'info');
        return;
    }

    Swal.fire({
        title: 'Exportar Reporte ATC',
        text: '¿En qué formato deseas descargar la información logistica?',
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-file-pdf"></i> PDF',
        denyButtonText: '<i class="fas fa-file-excel"></i> Excel',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#e74c3c',
        denyButtonColor: '#27ae60'
    }).then((result) => {
        if (result.isConfirmed) {
            executePDFExport();
        } else if (result.isDenied) {
            executeExcelExport();
        }
    });
}

function executeExcelExport() {
    try {
        const tableColumn = [
            "UNIDAD", "OPERADOR", "CLIENTE", "VIAJE / BOL", "ORIGEN", "DESTINO", "STATUS", 
            "LLEGADA CARGA", "INICIO CARGA", "FIN CARGA", 
            "INICIO RUTA", "FIN RUTA", 
            "LLEGADA DESC. (ETA)", "INICIO DESC.", "FIN DESC. (ENTREGA)", 
            "COMENTARIOS"
        ];
        
        const formatDateTxt = (dateStr) => {
            if (!dateStr) return '---';
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return '---';
                return d.toLocaleString('es-MX').replace(',', '');
            } catch (e) { return '---'; }
        };

        const tableRows = currentFilteredUnits.map(u => {
            const det = u.details || {};
            const cp = det.checkpoints || {};
            return [
                u.economic_number,
                u.operators?.name || 'S/A',
                det.cliente || '---',
                det.viaje || det.bol || '---',
                det.origen || '---',
                det.destino || '---',
                u.status || '---',
                formatDateTxt(cp.trip_load_arrival),
                formatDateTxt(cp.trip_load_start),
                formatDateTxt(cp.trip_load_end),
                formatDateTxt(cp.trip_route_start),
                formatDateTxt(cp.trip_route_end),
                formatDateTxt(cp.trip_unload_arrival || det.eta),
                formatDateTxt(cp.trip_unload_start),
                formatDateTxt(cp.trip_unload_end),
                det.comments || ''
            ];
        });

        const wsData = [tableColumn, ...tableRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte Logistico");
        XLSX.writeFile(wb, `Reporte_ATC_Integral_${currentType}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
        console.error("Excel Export Error:", err);
        Swal.fire('Error', 'No se pudo generar el archivo Excel: ' + err.message, 'error');
    }
}

function executePDFExport() {
    try {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) throw new Error("Librería jsPDF no cargada");

        const doc = new jsPDF('l', 'mm', 'a3'); 

        doc.setFontSize(22);
        doc.setTextColor(79, 70, 229); 
        doc.text("ALEXA TRANSPORTES - REPORTE LOGÍSTICO INTEGRAL (ATC)", 14, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Cliente: ${currentType} | Fecha: ${new Date().toLocaleString()}`, 14, 30);

        const tableColumn = [
            "Unidad", "Operador", "Cliente", "Viaje", "Destino", "Status",
            "Lleg. Carga", "Fin Carga", "Ini. Ruta", "Fin Ruta", "Lleg. Desc.", "Entrega"
        ];

        const formatDateTxt = (dateStr) => {
            if (!dateStr) return '---';
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return '---';
                return d.toLocaleString('es-MX', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
            } catch (e) { return '---'; }
        };

        const tableRows = currentFilteredUnits.map(u => {
            const det = u.details || {};
            const cp = det.checkpoints || {};
            return [
                u.economic_number,
                u.operators?.name || 'S/A',
                det.cliente || '---',
                det.viaje || det.bol || '---',
                det.destino || '---',
                u.status || '---',
                formatDateTxt(cp.trip_load_arrival),
                formatDateTxt(cp.trip_load_end),
                formatDateTxt(cp.trip_route_start),
                formatDateTxt(cp.trip_route_end),
                formatDateTxt(cp.trip_unload_arrival || det.eta),
                formatDateTxt(cp.trip_unload_end)
            ];
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 20 },
                4: { cellWidth: 40 }
            }
        });

        doc.save(`Reporte_ATC_Integral_${currentType}_${Date.now()}.pdf`);
    } catch (err) {
        console.error("PDF Export Error:", err);
        Swal.fire('Error', 'No se pudo generar el archivo PDF: ' + err.message, 'error');
    }
}
