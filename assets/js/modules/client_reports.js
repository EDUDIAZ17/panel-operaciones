import { supabase } from '../services/supabaseClient.js';
import { fetchSamsaraLocations, fetchSamsaraStats } from '../services/samsara.js';
import { getHeavyVehicleRouteWithAI } from '../services/gemini.js';

let currentFilteredUnits = [];
let currentType = 'BYD';
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

export async function renderClientReports(container) {
    container.innerHTML = `
        <div id="view-client-reports" class="p-6 fade-in h-full flex flex-col gap-6">
            <div class="flex justify-between items-center bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-blue-50/50">
                <h3 class="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center">
                    <i class="fas fa-layer-group text-blue-500 mr-3 text-2xl drop-shadow-sm"></i> Panel de Clientes (Torre de Control)
                </h3>
                <div class="flex gap-3">
                    <input type="text" id="filter-unidad" placeholder="Buscar por Unidad / Operador..." class="border border-blue-100 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]" />
                    <select id="filter-status" class="border border-blue-100 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">Todos los Estatus</option>
                        <option value="En Patio">En Patio</option>
                        <option value="En Taller">En Taller</option>
                        <option value="Transito">En Tránsito</option>
                        <option value="Cargada">Cargada</option>
                        <option value="Vacia">Vacía</option>
                    </select>

                    <select id="client-report-type" class="border border-blue-100 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold bg-gray-50 text-blue-800 shadow-sm cursor-pointer transition">
                        <option value="TODOS">TODOS LOS CLIENTES</option>
                        <option value="BYD">BYD</option>
                        <option value="CHANGAN">CHANGAN</option>
                        <option value="GEELY">GEELY</option>
                        <option value="GAC">GAC</option>
                        <option value="MG">MG</option>
                        <option value="FORD">FORD</option>
                        <option value="MOSA">MOSA</option>
                        <option value="PAASA">PAASA</option>
                        <option value="GCM">GCM</option>
                        <option value="BACHOCO">BACHOCO</option>
                        <option value="NESTLE">NESTLE</option>
                        <option value="NUTEC">NUTEC</option>
                        <option value="GRUPESA">GRUPESA</option>
                        <option value="TEPA">TEPA</option>
                        <option value="PC BIOLOGICS">PC BIOLOGICS</option>
                        <option value="Sin Asignación">Sin Asignación</option>
                    </select>
                    <button id="btn-refresh-client-report" class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all font-bold group" title="Actualizar Datos">
                        <i class="fas fa-sync-alt group-hover:rotate-180 transition-transform duration-500"></i>
                    </button>
                    <button id="btn-print-client-report" class="bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white px-4 py-2.5 rounded-xl shadow-lg hover:shadow-gray-900/30 transition-all font-bold" title="Imprimir PDF / Excel">
                        <i class="fas fa-print"></i>
                    </button>
                </div>
            </div>

            <div class="bg-white/90 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 flex-1 overflow-hidden flex flex-col">
                <div class="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center text-xs font-bold text-gray-500">
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span id="client-report-title" class="text-blue-900 uppercase tracking-widest">Mostrando Reporte</span>
                    </div>
                    <span class="bg-blue-50 text-blue-700 px-3 py-1 rounded-full"><i class="fas fa-bolt mr-1"></i> Data Automática de Asignaciones</span>
                </div>
                <div class="overflow-x-auto custom-scrollbar w-full flex-1 pb-4">
                    <table class="w-full text-left border-collapse min-w-[1400px] whitespace-nowrap" id="table-client-report">
                        <thead id="client-report-head" class="bg-white/90 backdrop-blur-sm sticky top-0 shadow-sm z-10 text-[10px] md:text-xs uppercase tracking-widest text-gray-500 border-b">
                        </thead>
                        <tbody id="client-report-body" class="divide-y divide-gray-50 text-sm bg-white">
                            <tr><td colspan="15" class="p-12 text-center text-gray-400 font-medium">Cargando inteligencia de datos... <i class="fas fa-spinner fa-spin ml-2 text-blue-500"></i></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.getElementById('client-report-type').addEventListener('change', loadClientReport);
    document.getElementById('filter-status').addEventListener('change', loadClientReport);
    document.getElementById('filter-unidad').addEventListener('keyup', (e) => {
        if(e.key === 'Enter') loadClientReport();
    });
    document.getElementById('btn-refresh-client-report').addEventListener('click', loadClientReport);
    document.getElementById('btn-print-client-report').addEventListener('click', generatePDF);

    loadClientReport();
}

async function loadClientReport() {
    const type = document.getElementById('client-report-type').value;
    const filterTxt = document.getElementById('filter-unidad').value.toLowerCase();
    const filterStatus = document.getElementById('filter-status').value;

    const thead = document.getElementById('client-report-head');
    const tbody = document.getElementById('client-report-body');
    const title = document.getElementById('client-report-title');

    title.textContent = `Mostrando Reporte ${type}`;
    tbody.innerHTML = `<tr><td colspan="15" class="p-8 text-center text-gray-400 font-medium">Cargando datos de la base de datos... <i class="fas fa-spinner fa-spin"></i></td></tr>`;

    const { data: units, error } = await supabase
        .from('units')
        .select('*, operators(name)')
        .order('economic_number');

    if (error) {
        tbody.innerHTML = `<tr><td colspan="15" class="p-8 text-center text-red-500 font-bold">Error: ${error.message}</td></tr>`;
        return;
    }

    const samsaraData = await fetchSamsaraLocations();
    const samsaraStats = await fetchSamsaraStats();

    const sortedUnits = (units || []).sort((a,b) => a.economic_number.localeCompare(b.economic_number, undefined, {numeric: true}));

    const activeUnits = sortedUnits.filter(u => {
        let det = u.details;
        if (typeof det === 'string') { try { det = JSON.parse(det); } catch(e) { det = {}; } }
        det = det || {};
        u.details = det;
        // Include if they have a client, or if they are in transit/loaded
        return det.cliente || !['Vacia', 'En Taller'].includes(u.status);
    });
    
    // For these specific reports, filter by the selected client and other active filters
    const filteredUnits = activeUnits.filter(u => {
        const clienteStr = (u.details?.cliente || '').toUpperCase();
        
        let matchClient = false;
        if (type === 'TODOS') matchClient = true;
        else if (type === 'Sin Asignación') matchClient = !clienteStr || clienteStr === 'SIN ASIGNACIÓN' || clienteStr === 'SIN ASIGNACIÓN DE CLIENTE';
        else matchClient = clienteStr.includes(type.toUpperCase()); 

        let matchTxt = true;
        if (filterTxt) {
            const eco = (u.economic_number || '').toLowerCase();
            const op = (u.operators?.name || '').toLowerCase();
            matchTxt = eco.includes(filterTxt) || op.includes(filterTxt);
        }

        let matchStatus = true;
        if (filterStatus) {
            matchStatus = (u.status || '').toLowerCase().includes(filterStatus.toLowerCase());
        }

        return matchClient && matchTxt && matchStatus;
    });

    currentFilteredUnits = filteredUnits;
    currentType = type;
    currentSamsaraData = samsaraData;

    let html = '';

    // Function to format checkpoint dates beautifully
    const formatCP = (dateStr) => {
        if (!dateStr) return '<span class="text-gray-300">---</span>';
        const d = new Date(dateStr);
        return `<span class="font-bold text-gray-700">${d.toLocaleDateString()}</span> <span class="text-gray-400 ml-1">${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
    };

    if (type === 'BYD') {
        thead.innerHTML = `
            <tr>
                <th class="p-4 font-black bg-blue-50 text-blue-900 border-r border-gray-100 sticky left-0 z-20">ECONOMICO</th>
                <th class="p-4 font-bold bg-blue-50/50 text-blue-800">BOL</th>
                <th class="p-4 font-bold bg-blue-50/50 text-blue-800">DESTINO</th>
                <th class="p-4 font-bold bg-blue-50/50 text-blue-800">FECHA PROG.</th>
                <th class="p-4 font-bold bg-blue-50/50 text-blue-800">FECHA CARGA</th>
                <th class="p-4 font-bold bg-blue-50/50 text-blue-800">INSERCION RUTA</th>
                <th class="p-4 font-bold bg-blue-50/50 text-blue-800">ETA</th>
                <th class="p-4 font-bold bg-blue-50/50 text-blue-800">ENTREGA FINAL</th>
                <th class="p-4 font-bold bg-blue-50/50 text-blue-800 text-center">STATUS</th>
                <th class="p-4 font-bold bg-blue-50/50 text-blue-800 text-center">UBICACION</th>
                <th class="p-4 font-bold bg-blue-50/50 text-blue-800">COMENTARIOS</th>
            </tr>
        `;

        if (filteredUnits.length === 0) {
            html = `<tr><td colspan="11" class="p-12 text-center text-gray-500 italic">No hay unidades asignadas al cliente BYD activamente.</td></tr>`;
        } else {
            filteredUnits.forEach((u, idx) => {
                const destino = u.details?.destino || '<span class="text-gray-300">---</span>';
                const scheduledDate = u.details?.scheduled_trip || u.details?.assignment_date;
                const fProg = scheduledDate ? formatCP(scheduledDate) : '<span class="text-gray-300">---</span>';
                const cp = u.details?.checkpoints || {};
                
                const fCarga = cp.trip_load_end ? formatCP(cp.trip_load_end) : (cp.trip_load_arrival ? formatCP(cp.trip_load_arrival) : '<span class="text-gray-300">---</span>');
                const fRuta = cp.trip_route_start ? formatCP(cp.trip_route_start) : (cp.trip_load_end ? formatCP(cp.trip_load_end) : '<span class="text-gray-300">---</span>'); 
                const eta = u.details?.eta ? formatCP(u.details.eta) : (cp.trip_unload_arrival ? formatCP(cp.trip_unload_arrival) : '<span class="text-gray-300">---</span>');
                const fEntrega = cp.trip_unload_end ? formatCP(cp.trip_unload_end) : '<span class="text-gray-300">---</span>';
                
                const comentarios = u.details?.comments || '';

                const samsaraVeh = samsaraData.find(v => v.name.includes(u.economic_number) || (u.placas && v.name.includes(u.placas)));
                const samsaraSt = samsaraStats.find(v => v.name.includes(u.economic_number) || (u.placas && v.name.includes(u.placas)));
                
                let kmTraveled = '<span class="text-gray-400 italic text-xs">N/A</span>';
                if (samsaraSt) {
                    const currentOdo = samsaraSt.obdOdometerMeters?.value || samsaraSt.gpsOdometerMeters?.value || 0;
                    if (currentOdo > 0) {
                        const startOdo = parseFloat(cp.odometerInicio) || 0;
                        if (startOdo > 0) {
                            const km = (currentOdo / 1000) - startOdo;
                            kmTraveled = `<span class="font-bold text-blue-600">${km.toFixed(1)} km</span>`;
                        } else {
                            kmTraveled = `<span class="font-bold text-gray-500" title="Odómetro Total">${(currentOdo / 1000).toFixed(0)} km (Total)</span>`;
                        }
                    }
                }

                let geoId = `geo-cr-${u.id}`;
                let ubicacion = '';
                if (samsaraVeh) {
                    ubicacion = `<div class="flex flex-col items-center gap-1 w-full max-w-[140px] mx-auto">
                        <div id="${geoId}" class="text-[10px] font-bold text-gray-700 bg-gray-100/80 px-2 py-1 rounded-md border border-gray-200 shadow-sm text-center w-full truncate whitespace-normal leading-tight min-h-[32px] flex items-center justify-center break-words" title="GPS: ${samsaraVeh.location.latitude}, ${samsaraVeh.location.longitude}">Analizando Zona...</div>
                        <div class="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full border border-blue-100">${kmTraveled}</div>
                    </div>`;
                    setTimeout(() => reverseGeocodeStatic(samsaraVeh.location.latitude, samsaraVeh.location.longitude, geoId), idx * 150);
                } else {
                    ubicacion = `<div class="flex flex-col items-center gap-1">
                        <div class="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded-md border border-red-100 font-bold"><i class="fas fa-signal-slash mr-1"></i> Sin GPS</div>
                    </div>`;
                }

                let statusClass = "bg-gray-100 text-gray-600";
                if(u.status.includes('Transito') || u.status === 'Cargada') statusClass = "bg-green-100 text-green-700 border border-green-200 shadow-sm";
                else if(u.status === 'En Taller') statusClass = "bg-red-100 text-red-700 border border-red-200 shadow-sm animate-pulse";
                else if(u.status === 'Vacia') statusClass = "bg-yellow-100 text-yellow-700 border border-yellow-200 shadow-sm";

                const editBtn = ['admin', 'torre_control', 'operaciones'].includes(window.userRole) ? `<button onclick="window.openClientReportEdit('${u.id}')" title="Editar Detalles" class="text-blue-500 hover:text-blue-700 ml-2 transition drop-shadow-sm"><i class="fas fa-edit"></i></button>` : '';
                html += `
                    <tr class="hover:bg-blue-50/30 transition-colors group">
                        <td class="p-4 border-r border-gray-100 font-black text-gray-800 bg-white group-hover:bg-blue-50/50 sticky left-0 z-10 transition-colors">
                            <div class="flex items-center justify-between">
                                <span>${u.economic_number}</span>
                                ${editBtn}
                            </div>
                        </td>
                        <td class="p-4 text-gray-700 font-mono font-bold text-xs">${u.details?.bol || u.details?.viaje || '---'}</td>
                        <td class="p-4 font-bold text-gray-600 text-sm">${destino}</td>
                        <td class="p-4 text-sm">${fProg}</td>
                        <td class="p-4 text-sm">${fCarga}</td>
                        <td class="p-4 text-sm">${fRuta}</td>
                        <td class="p-4 text-sm">${eta}</td>
                        <td class="p-4 text-sm">${fEntrega}</td>
                        <td class="p-4 text-center"><span class="px-3 py-1.5 rounded-lg text-xs font-bold ${statusClass}">${u.status}</span></td>
                        <td class="p-4 text-center">${ubicacion}</td>
                        <td class="p-4 text-sm text-gray-500 truncate max-w-[200px]" title="${comentarios}">${comentarios || '<span class="text-gray-300">---</span>'}</td>
                    </tr>
                `;
            });
        }
    } else if (type === 'CHANGAN') {
        thead.innerHTML = `
            <tr>
                <th class="p-4 font-black bg-teal-50 text-teal-900 border-r border-gray-100 sticky left-0 z-20 shadow-sm">UNIDAD</th>
                <th class="p-4 font-bold bg-teal-50/50 text-teal-800">OPERADOR</th>
                <th class="p-4 font-bold bg-teal-50/50 text-teal-800">FECHA CARGA</th>
                <th class="p-4 font-bold bg-teal-50/50 text-teal-800">CLIENTE</th>
                <th class="p-4 font-bold bg-teal-50/50 text-teal-800">VIAJE</th>
                <th class="p-4 font-bold bg-teal-50/50 text-teal-800">ORIGEN</th>
                <th class="p-4 font-bold bg-teal-50/50 text-teal-800">DESTINO</th>
                <th class="p-4 font-bold bg-teal-50/50 text-teal-800">ETA</th>
                <th class="p-4 font-bold bg-teal-50/50 text-teal-800 text-center">ESTATUS</th>
                <th class="p-4 font-bold bg-teal-50/50 text-teal-800 text-center">UBICACION</th>
                <th class="p-4 font-bold bg-teal-50/50 text-teal-800">OBSERVACIONES</th>
            </tr>
        `;

        if (filteredUnits.length === 0) {
            html = `<tr><td colspan="11" class="p-12 text-center text-gray-500 italic">No hay unidades asignadas al cliente CHANGAN activamente.</td></tr>`;
        } else {
            filteredUnits.forEach((u, idx) => {
                const opName = u.operators?.name || '<span class="text-gray-400 italic">Sin Asignar</span>';
                const cp = u.details?.checkpoints || {};
                const fCarga = cp.trip_load_end ? formatCP(cp.trip_load_end) : (cp.trip_load_arrival ? formatCP(cp.trip_load_arrival) : '<span class="text-gray-300">---</span>');
                
                const cliente = u.details?.cliente || 'CHANGAN';
                const viaje = u.details?.viaje || u.details?.bol || '<span class="text-gray-300">---</span>';
                const origen = u.details?.origen || '<span class="text-gray-300">---</span>';
                const destino = u.details?.destino || '<span class="text-gray-300">---</span>';
                const eta = u.details?.eta ? formatCP(u.details.eta) : '<span class="text-gray-300">---</span>';
                const obs = u.details?.comments || '';
                
                const samsaraVeh = samsaraData.find(v => v.name.includes(u.economic_number) || (u.placas && v.name.includes(u.placas)));
                const samsaraSt = samsaraStats.find(v => v.name.includes(u.economic_number) || (u.placas && v.name.includes(u.placas)));
                
                let kmTraveled = '<span class="text-gray-400 italic text-xs">N/A</span>';
                if (samsaraSt) {
                    const currentOdo = samsaraSt.obdOdometerMeters?.value || samsaraSt.gpsOdometerMeters?.value || 0;
                    if (currentOdo > 0) {
                        const startOdo = parseFloat(cp.odometerInicio) || 0;
                        if (startOdo > 0) {
                            const km = (currentOdo / 1000) - startOdo;
                            kmTraveled = `<span class="font-bold text-teal-600">${km.toFixed(1)} km</span>`;
                        } else {
                            kmTraveled = `<span class="font-bold text-gray-500" title="Odómetro Total">${(currentOdo / 1000).toFixed(0)} km (Total)</span>`;
                        }
                    }
                }

                let geoId = `geo-cr-${u.id}`;
                let ubicacion = '';
                if (samsaraVeh) {
                    ubicacion = `<div class="flex flex-col items-center gap-1 w-full max-w-[140px] mx-auto">
                        <div id="${geoId}" class="text-[10px] font-bold text-gray-700 bg-gray-100/80 px-2 py-1 rounded-md border border-gray-200 shadow-sm text-center w-full truncate whitespace-normal leading-tight min-h-[32px] flex items-center justify-center break-words" title="GPS: ${samsaraVeh.location.latitude}, ${samsaraVeh.location.longitude}">Analizando Zona...</div>
                        <div class="text-[10px] bg-teal-50 text-teal-800 px-2 py-0.5 rounded-full border border-teal-100">${kmTraveled}</div>
                    </div>`;
                    setTimeout(() => reverseGeocodeStatic(samsaraVeh.location.latitude, samsaraVeh.location.longitude, geoId), idx * 150);
                } else {
                    ubicacion = `<div class="flex flex-col items-center gap-1">
                        <div class="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded-md border border-red-100 font-bold"><i class="fas fa-signal-slash mr-1"></i> Sin GPS</div>
                    </div>`;
                }

                let statusClass = "bg-gray-100 text-gray-600";
                if(u.status.includes('Transito') || u.status === 'Cargada') statusClass = "bg-green-100 text-green-700 border border-green-200 shadow-sm";
                else if(u.status === 'En Taller') statusClass = "bg-red-100 text-red-700 border border-red-200 shadow-sm animate-pulse";
                else if(u.status === 'Vacia') statusClass = "bg-yellow-100 text-yellow-700 border border-yellow-200 shadow-sm";

                const editBtn = ['admin', 'torre_control', 'operaciones'].includes(window.userRole) ? `<button onclick="window.openClientReportEdit('${u.id}')" title="Editar Detalles" class="text-teal-600 hover:text-teal-800 ml-2 transition drop-shadow-sm"><i class="fas fa-edit"></i></button>` : '';

                 html += `
                    <tr class="hover:bg-teal-50/30 transition-colors group">
                        <td class="p-4 border-r border-gray-100 font-black text-gray-800 bg-white group-hover:bg-teal-50/50 sticky left-0 z-10 transition-colors shadow-sm">
                            <div class="flex items-center justify-between">
                                <span>${u.economic_number}</span>
                                ${editBtn}
                            </div>
                        </td>
                        <td class="p-4 font-bold text-gray-600 text-sm">${opName}</td>
                        <td class="p-4 text-sm">${fCarga}</td>
                        <td class="p-4 font-bold text-teal-700 text-sm tracking-wide">${cliente}</td>
                        <td class="p-4 text-gray-500 font-mono text-xs">${viaje}</td>
                        <td class="p-4 font-bold text-gray-600 text-sm">${origen}</td>
                        <td class="p-4 font-bold text-gray-600 text-sm">${destino}</td>
                        <td class="p-4 text-sm">${eta}</td>
                        <td class="p-4 text-center"><span class="px-3 py-1.5 rounded-lg text-xs font-bold ${statusClass}">${u.status}</span></td>
                        <td class="p-4 text-center">${ubicacion}</td>
                        <td class="p-4 text-sm text-gray-500 truncate max-w-[200px]" title="${obs}">${obs || '<span class="text-gray-300">---</span>'}</td>
                    </tr>
                `;
            });
        }
    } else {
        // GENERIC CLIENT VIEW
        thead.innerHTML = `
            <tr>
                <th class="p-4 font-black bg-gray-50 text-gray-900 border-r border-gray-100 sticky left-0 z-20 shadow-sm">UNIDAD</th>
                <th class="p-4 font-bold bg-gray-50/50 text-gray-800">TIPO / PLACAS</th>
                <th class="p-4 font-bold bg-gray-50/50 text-gray-800">OPERADOR</th>
                <th class="p-4 font-bold bg-gray-50/50 text-gray-800">CLIENTE</th>
                <th class="p-4 font-bold bg-gray-50/50 text-gray-800">ORIGEN</th>
                <th class="p-4 font-bold bg-gray-50/50 text-gray-800">DESTINO</th>
                <th class="p-4 font-bold bg-gray-50/50 text-gray-800">ESTATUS</th>
                <th class="p-4 font-bold bg-gray-50/50 text-gray-800 text-center">UBICACION</th>
                <th class="p-4 font-bold bg-gray-50/50 text-gray-800">OBSERVACIONES</th>
            </tr>
        `;

        if (filteredUnits.length === 0) {
            html = `<tr><td colspan="9" class="p-12 text-center text-gray-500 italic">No hay unidades asignadas a este cliente (${type}) activamente.</td></tr>`;
        } else {
            filteredUnits.forEach((u, idx) => {
                const opName = u.operators?.name || '<span class="text-gray-400 italic">Sin Asignar</span>';
                const placas = u.placas || '---';
                const cliente = u.details?.cliente || '---';
                const origen = u.details?.origen || '---';
                const destino = u.details?.destino || '---';
                const obs = u.details?.comments || '';
                
                const samsaraVeh = samsaraData.find(v => v.name.includes(u.economic_number) || (u.placas && v.name.includes(u.placas)));
                const samsaraSt = samsaraStats.find(v => v.name.includes(u.economic_number) || (u.placas && v.name.includes(u.placas)));
                const currentOdo = samsaraSt ? (samsaraSt.obdOdometerMeters?.value || samsaraSt.gpsOdometerMeters?.value || 0) : 0;
                let kmTraveled = currentOdo ? `<span class="font-bold text-gray-500" title="Odómetro Total">${(currentOdo / 1000).toFixed(0)} km (Total)</span>` : '<span class="text-gray-400 italic text-xs">N/A</span>';

                let geoId = `geo-cr-${u.id}`;
                let ubicacion = '';
                if (samsaraVeh) {
                    ubicacion = `<div class="flex flex-col items-center gap-1 w-full max-w-[140px] mx-auto">
                        <div id="${geoId}" class="text-[10px] font-bold text-gray-700 bg-gray-100/80 px-2 py-1 rounded-md border border-gray-200 shadow-sm text-center w-full truncate whitespace-normal leading-tight min-h-[32px] flex items-center justify-center break-words" title="GPS: ${samsaraVeh.location.latitude}, ${samsaraVeh.location.longitude}">Analizando Zona...</div>
                        <div class="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full border border-blue-100">${kmTraveled}</div>
                    </div>`;
                    setTimeout(() => reverseGeocodeStatic(samsaraVeh.location.latitude, samsaraVeh.location.longitude, geoId), idx * 150);
                } else {
                    ubicacion = `<div class="flex flex-col items-center gap-1">
                        <div class="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded-md border border-red-100 font-bold"><i class="fas fa-signal-slash mr-1"></i> Sin GPS</div>
                    </div>`;
                }

                let statusClass = "bg-gray-100 text-gray-600";
                if(u.status.includes('Transito') || u.status === 'Cargada') statusClass = "bg-green-100 text-green-700 border border-green-200 shadow-sm";
                else if(u.status === 'En Taller') statusClass = "bg-red-100 text-red-700 border border-red-200 shadow-sm animate-pulse";
                else if(u.status === 'Vacia') statusClass = "bg-yellow-100 text-yellow-700 border border-yellow-200 shadow-sm";

                const editBtn = ['admin', 'torre_control', 'operaciones'].includes(window.userRole) ? `<button onclick="window.openClientReportEdit('${u.id}')" title="Editar Detalles" class="text-blue-500 hover:text-blue-700 ml-2 transition drop-shadow-sm"><i class="fas fa-edit"></i></button>` : '';

                 html += `
                    <tr class="hover:bg-gray-50/30 transition-colors group">
                        <td class="p-4 border-r border-gray-100 font-black text-gray-800 bg-white group-hover:bg-gray-50/50 sticky left-0 z-10 shadow-sm">
                            <div class="flex items-center justify-between">
                                <span>${u.economic_number}</span>
                                ${editBtn}
                            </div>
                        </td>
                        <td class="p-4 text-gray-600 font-mono text-xs"><b>${u.type}</b> / ${placas}</td>
                        <td class="p-4 font-bold text-gray-600 text-sm">${opName}</td>
                        <td class="p-4 font-bold text-gray-800 text-sm tracking-wide">${cliente}</td>
                        <td class="p-4 font-bold text-gray-600 text-sm">${origen}</td>
                        <td class="p-4 font-bold text-gray-600 text-sm">${destino}</td>
                        <td class="p-4 text-center"><span class="px-3 py-1.5 rounded-lg text-xs font-bold ${statusClass}">${u.status}</span></td>
                        <td class="p-4 text-center">${ubicacion}</td>
                        <td class="p-4 text-sm text-gray-500 truncate max-w-[200px]" title="${obs}">${obs || '<span class="text-gray-300">---</span>'}</td>
                    </tr>
                `;
            });
        }
    }

    tbody.innerHTML = html;
}

window.openAIRoute = async (origen, destino) => {
    if (!origen || !destino || origen === '---' || destino === '---') {
        Swal.fire({ icon: 'warning', title: 'Destinos Inválidos', text: 'Se necesita un origen y un destino válido para generar la ruta IA.' });
        return;
    }

    Swal.fire({
        title: 'Calculando Ruta con Gemini AI...',
        html: '<div class="spinner my-4"></div><p class="text-sm text-gray-500">Analizando restricciones para equipos pesados (Tracto + Doble Remolque)...</p>',
        showConfirmButton: false,
        allowOutsideClick: false
    });

    const routeText = await getHeavyVehicleRouteWithAI(origen, destino);

    Swal.fire({
        icon: 'info',
        title: 'Ruta Inteligente Generada',
        html: `<div class="text-left text-sm bg-gray-50 p-4 border rounded-xl shadow-inner mt-4 text-gray-700">${routeText}</div>`,
        confirmButtonText: '<i class="fas fa-map"></i> Entendido',
        confirmButtonColor: '#8b5cf6'
    });
};

window.openClientReportEdit = (id) => {
    const u = currentFilteredUnits.find(unit => unit.id === id);
    if (!u) return;

    const details = u.details || {};
    const cp = details.checkpoints || {};

    const bol = details.bol || details.viaje || '';
    const origin = details.origen || '';
    const dest = details.destino || '';
    const fProg = details.scheduled_trip || details.assignment_date || '';
    const fpETA = details.eta || '';
    const comments = details.comments || '';

    let container = document.getElementById('cr-modal-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cr-modal-container';
        document.body.appendChild(container);
    }

    container.innerHTML = `
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 fade-in">
            <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl scale-in">
                <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-50 rounded-t-2xl">
                    <h3 class="text-xl font-black text-blue-900"><i class="fas fa-edit text-blue-500 mr-2"></i> Editar Datos de Reporte - ${u.economic_number}</h3>
                    <button onclick="document.getElementById('cr-modal-container').innerHTML=''" class="text-gray-400 hover:text-red-500 transition"><i class="fas fa-times text-xl"></i></button>
                </div>
                <div class="p-6 space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-black text-gray-500 mb-1 uppercase tracking-wider">BOL / Viaje</label>
                            <input type="text" id="cr-edit-bol" value="${bol}" class="w-full border border-blue-100 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                            <label class="block text-xs font-black text-gray-500 mb-1 uppercase tracking-wider">Origen</label>
                            <input type="text" id="cr-edit-origen" value="${origin}" class="w-full border border-blue-100 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                            <label class="block text-xs font-black text-gray-500 mb-1 uppercase tracking-wider">Destino</label>
                            <input type="text" id="cr-edit-destino" value="${dest}" class="w-full border border-blue-100 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                            <label class="block text-xs font-black text-gray-500 mb-1 uppercase tracking-wider">Estatus</label>
                            <select id="cr-edit-status" class="w-full border border-blue-100 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold">
                                <option value="En Patio" ${u.status==='En Patio'?'selected':''}>En Patio</option>
                                <option value="Transito" ${u.status.includes('Transito')?'selected':''}>Transito</option>
                                <option value="Cargada" ${u.status==='Cargada'?'selected':''}>Cargada</option>
                                <option value="Vacia" ${u.status==='Vacia'?'selected':''}>Vacia</option>
                                <option value="En Taller" ${u.status==='En Taller'?'selected':''}>En Taller</option>
                            </select>
                        </div>
                    </div>
                    
                    <h4 class="text-xs font-black text-blue-500 uppercase mt-6 mb-2 border-b border-blue-100 pb-2">Tiempos y Fechas (Sincroniza con Bitácora)</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Fecha Programada</label>
                            <input type="datetime-local" id="cr-edit-fprog" value="${fProg ? new Date(new Date(fProg).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0,16) : ''}" class="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Llegada a Carga</label>
                            <input type="datetime-local" id="cr-edit-llegadac" value="${cp.trip_load_arrival ? new Date(new Date(cp.trip_load_arrival).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0,16) : ''}" class="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Fin Carga / Ins. Ruta</label>
                            <input type="datetime-local" id="cr-edit-finc" value="${cp.trip_load_end ? new Date(new Date(cp.trip_load_end).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0,16) : ''}" class="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">ETA (Estimado Llegada)</label>
                            <input type="datetime-local" id="cr-edit-eta" value="${fpETA ? new Date(new Date(fpETA).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0,16) : ''}" class="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div class="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2">
                            <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Fin Descarga (Entrega Final)</label>
                            <input type="datetime-local" id="cr-edit-find" value="${cp.trip_unload_end ? new Date(new Date(cp.trip_unload_end).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0,16) : ''}" class="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>

                    <div class="mt-4">
                        <label class="block text-xs font-black text-gray-500 mb-1 uppercase">Observaciones del Reporte</label>
                        <textarea id="cr-edit-comments" rows="2" class="w-full border border-blue-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none">${comments}</textarea>
                    </div>

                    <div class="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button onclick="document.getElementById('cr-modal-container').innerHTML=''" class="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition">Cancelar</button>
                        <button onclick="window.saveClientReportEdit('${id}')" id="cr-btn-save" class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-xl hover:from-blue-700 hover:to-indigo-700 transition shadow-lg shadow-blue-500/30 flex items-center">
                            <i class="fas fa-save mr-2"></i> Guardar Modificaciones
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.saveClientReportEdit = async (id) => {
    const u = currentFilteredUnits.find(unit => unit.id === id);
    if (!u) return;
    
    const btn = document.getElementById('cr-btn-save');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Guardando...';
    btn.disabled = true;

    try {
        const details = u.details || {};
        const cp = details.checkpoints || {};

        details.bol = document.getElementById('cr-edit-bol').value;
        details.viaje = details.bol; 
        details.origen = document.getElementById('cr-edit-origen').value;
        details.destino = document.getElementById('cr-edit-destino').value;
        details.scheduled_trip = document.getElementById('cr-edit-fprog').value;
        details.eta = document.getElementById('cr-edit-eta').value;
        details.comments = document.getElementById('cr-edit-comments').value;

        cp.trip_load_arrival = document.getElementById('cr-edit-llegadac').value;
        cp.trip_load_end = document.getElementById('cr-edit-finc').value;
        cp.trip_unload_end = document.getElementById('cr-edit-find').value;

        details.checkpoints = cp;
        const newStatus = document.getElementById('cr-edit-status').value;

        // Si se limpió un date, lo pasamos como null para que no rompa el parsing
        if(!details.scheduled_trip) delete details.scheduled_trip;
        if(!details.eta) delete details.eta;
        if(!cp.trip_load_arrival) delete cp.trip_load_arrival;
        if(!cp.trip_load_end) delete cp.trip_load_end;
        if(!cp.trip_unload_end) delete cp.trip_unload_end;

        const { error } = await supabase.from('units').update({
            details: details,
            status: newStatus,
            last_status_update: new Date().toISOString()
        }).eq('id', id);

        if (error) throw error;

        Swal.fire({ icon: 'success', title: 'Guardado', text: 'Datos actualizados correctamente.', timer: 1500, showConfirmButton: false });
        document.getElementById('cr-modal-container').innerHTML = '';
        
        document.getElementById('btn-refresh-client-report').click();

    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar: ' + e.message });
        btn.innerHTML = '<i class="fas fa-save mr-2"></i> Guardar Modificaciones';
        btn.disabled = false;
    }
};

function generatePDF() {
    if (currentFilteredUnits.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    const getBase64Image = (imgUrl, callback) => {
        const img = new Image();
        img.src = imgUrl;
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if(ctx) {
                ctx.drawImage(img, 0, 0);
            }
            const dataURL = canvas.toDataURL("image/png");
            callback(dataURL);
        };
        img.onerror = () => {
            callback(null);
        };
    };

    const buildPdf = (logoData) => {
        if (logoData) {
            doc.addImage(logoData, 'PNG', 14, 10, 40, 15);
        }
        
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text(`Reporte de Operaciones - Cliente: ${currentType}`, 14, 35);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 43);

        let tableColumn = [];
        let tableRows = [];

        const formatCPTxt = (dateStr) => {
            if (!dateStr) return '---';
            return new Date(dateStr).toLocaleString();
        };

        if (currentType === 'BYD') {
            tableColumn = ["BOL", "ECONOMICO", "DESTINO", "FECHA PROG.", "FECHA CARGA", "INSERCION RUTA", "ETA", "ENTREGA FINAL", "STATUS", "COMENTARIOS"];
            currentFilteredUnits.forEach(u => {
                const destino = u.details?.destino || '---';
                const fProg = u.details?.scheduled_trip ? formatCPTxt(u.details.scheduled_trip) : '---';
                const cp = u.details?.checkpoints || {};
                const fCarga = cp.trip_load_end ? formatCPTxt(cp.trip_load_end) : (cp.trip_load_arrival ? formatCPTxt(cp.trip_load_arrival) : '---');
                const fRuta = cp.trip_route_start ? formatCPTxt(cp.trip_route_start) : (cp.trip_load_end ? formatCPTxt(cp.trip_load_end) : '---'); 
                const eta = u.details?.eta ? formatCPTxt(u.details.eta) : (cp.trip_unload_arrival ? formatCPTxt(cp.trip_unload_arrival) : '---');
                const fEntrega = cp.trip_unload_end ? formatCPTxt(cp.trip_unload_end) : '---';
                const comentarios = u.details?.comments || '';

                tableRows.push([
                    u.details?.bol || u.details?.viaje || '---',
                    u.economic_number,
                    destino,
                    fProg,
                    fCarga,
                    fRuta,
                    eta,
                    fEntrega,
                    u.status,
                    comentarios
                ]);
            });
        } else if (currentType === 'CHANGAN') {
            tableColumn = ["UNIDAD", "OPERADOR", "FECHA CARGA", "CLIENTE", "VIAJE", "ORIGEN", "DESTINO", "ETA", "ESTATUS", "OBSERVACIONES"];
            currentFilteredUnits.forEach(u => {
                const opName = u.operators?.name || 'Sin Asignar';
                const cp = u.details?.checkpoints || {};
                const fCarga = cp.trip_load_end ? formatCPTxt(cp.trip_load_end) : (cp.trip_load_arrival ? formatCPTxt(cp.trip_load_arrival) : '---');
                const cliente = u.details?.cliente || 'CHANGAN';
                const viaje = u.details?.viaje || u.details?.bol || '---';
                const origen = u.details?.origen || '---';
                const destino = u.details?.destino || '---';
                const eta = u.details?.eta ? formatCPTxt(u.details.eta) : (cp.trip_unload_arrival ? formatCPTxt(cp.trip_unload_arrival) : '---');
                const obs = u.details?.comments || '';

                tableRows.push([
                    u.economic_number,
                    opName,
                    fCarga,
                    cliente,
                    viaje,
                    origen,
                    destino,
                    eta,
                    u.status,
                    obs
                ]);
            });
        } else {
            tableColumn = ["UNIDAD", "TIPO / PLACAS", "OPERADOR", "CLIENTE", "ORIGEN", "DESTINO", "ESTATUS", "OBSERVACIONES"];
            currentFilteredUnits.forEach(u => {
                const opName = u.operators?.name || 'Sin Asignar';
                const placas = u.placas || '---';
                const cliente = u.details?.cliente || '---';
                const origen = u.details?.origen || '---';
                const destino = u.details?.destino || '---';
                const obs = u.details?.comments || '';

                tableRows.push([
                    u.economic_number,
                    `${u.type} / ${placas}`,
                    opName,
                    cliente,
                    origen,
                    destino,
                    u.status,
                    obs
                ]);
            });
        }

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 50,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: currentType === 'BYD' ? [41, 128, 185] : [22, 160, 133], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { top: 50 }
        });

        doc.save(`Reporte_Torre_Control_${currentType}_${Date.now()}.pdf`);
    };

    getBase64Image('./logo/logo.png', buildPdf);
}

