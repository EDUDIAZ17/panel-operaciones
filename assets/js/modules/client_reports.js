import { supabase } from '../services/supabaseClient.js';
import { fetchSamsaraLocations, fetchSamsaraStats } from '../services/samsara.js';
import { getHeavyVehicleRouteWithAI } from '../services/gemini.js';

let currentFilteredUnits = [];
let currentType = 'BYD';
let currentSamsaraData = [];

export async function renderClientReports(container) {
    container.innerHTML = `
        <div id="view-client-reports" class="p-6 fade-in h-full flex flex-col gap-6">
            <div class="flex justify-between items-center bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-blue-50/50">
                <h3 class="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center">
                    <i class="fas fa-layer-group text-blue-500 mr-3 text-2xl drop-shadow-sm"></i> Panel de Clientes (Torre de Control)
                </h3>
                <div class="flex gap-3">
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
                <div class="overflow-auto flex-1 p-0 custom-scrollbar">
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
    document.getElementById('btn-refresh-client-report').addEventListener('click', loadClientReport);
    document.getElementById('btn-print-client-report').addEventListener('click', generatePDF);

    loadClientReport();
}

async function loadClientReport() {
    const type = document.getElementById('client-report-type').value;
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

    const activeUnits = sortedUnits.filter(u => !['Vacia', 'En Taller'].includes(u.status) || u.details?.cliente); 
    
    // For these specific reports, we just filter those explicitly assigned to the client.
    // If we want to show all simply to be filled out later, we can show them, but matching client is cleaner.
    const filteredUnits = activeUnits.filter(u => {
        const clienteStr = u.details?.cliente?.toUpperCase() || '';
        if (type === 'TODOS') return true;
        return clienteStr.includes(type); 
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
            filteredUnits.forEach(u => {
                const destino = u.details?.destino || '<span class="text-gray-300">---</span>';
                const fProg = u.details?.scheduled_trip ? formatCP(u.details.scheduled_trip) : '<span class="text-gray-300">---</span>';
                const cp = u.details?.checkpoints || {};
                
                const fCarga = cp.finCarga ? formatCP(cp.finCarga) : (cp.llegadaCarga ? formatCP(cp.llegadaCarga) : '<span class="text-gray-300">---</span>');
                const fRuta = cp.finCarga ? formatCP(cp.finCarga) : '<span class="text-gray-300">---</span>'; 
                const eta = u.details?.eta ? formatCP(u.details.eta) : '<span class="text-gray-300">---</span>';
                const fEntrega = cp.finDescarga ? formatCP(cp.finDescarga) : '<span class="text-gray-300">---</span>';
                
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

                let ubicacion = '';
                if (samsaraVeh) {
                    ubicacion = `<div class="flex flex-col items-center gap-1">
                        <a href="https://www.google.com/maps?q=${samsaraVeh.location.latitude},${samsaraVeh.location.longitude}" target="_blank" class="text-blue-500 hover:text-blue-700 hover:underline font-bold flex items-center justify-center gap-1 transition"><i class="fas fa-location-arrow text-blue-400"></i> Localizar</a>
                        <div class="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full border border-blue-100">${kmTraveled}</div>
                    </div>`;
                } else {
                    ubicacion = `<div class="flex flex-col items-center gap-1">
                        <button onclick="window.openAIRoute('${u.details?.origen || ''}', '${u.details?.destino || ''}')" class="text-purple-600 hover:text-purple-800 hover:underline font-bold flex items-center justify-center gap-1 transition"><i class="fas fa-robot"></i> Ruta IA</button>
                        <span class="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100"><i class="fas fa-signal-slash mr-1"></i> Sin GPS</span>
                    </div>`;
                }

                let statusClass = "bg-gray-100 text-gray-600";
                if(u.status.includes('Transito') || u.status === 'Cargada') statusClass = "bg-green-100 text-green-700 border border-green-200 shadow-sm";
                else if(u.status === 'En Taller') statusClass = "bg-red-100 text-red-700 border border-red-200 shadow-sm animate-pulse";
                else if(u.status === 'Vacia') statusClass = "bg-yellow-100 text-yellow-700 border border-yellow-200 shadow-sm";

                html += `
                    <tr class="hover:bg-blue-50/30 transition-colors group">
                        <td class="p-4 border-r border-gray-100 font-black text-gray-800 bg-white group-hover:bg-blue-50/50 sticky left-0 z-10 transition-colors">${u.economic_number}</td>
                        <td class="p-4 text-gray-400 font-mono text-xs">---</td>
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
            filteredUnits.forEach(u => {
                const opName = u.operators?.name || '<span class="text-gray-400 italic">Sin Asignar</span>';
                const cp = u.details?.checkpoints || {};
                const fCarga = cp.finCarga ? formatCP(cp.finCarga) : (cp.llegadaCarga ? formatCP(cp.llegadaCarga) : '<span class="text-gray-300">---</span>');
                
                const cliente = u.details?.cliente || 'CHANGAN';
                const viaje = u.details?.viaje || '<span class="text-gray-300">---</span>';
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

                let ubicacion = '';
                if (samsaraVeh) {
                    ubicacion = `<div class="flex flex-col items-center gap-1">
                        <a href="https://www.google.com/maps?q=${samsaraVeh.location.latitude},${samsaraVeh.location.longitude}" target="_blank" class="text-teal-600 hover:text-teal-700 hover:underline font-bold flex items-center justify-center gap-1 transition"><i class="fas fa-location-arrow text-teal-400"></i> Localizar</a>
                        <div class="text-[10px] bg-teal-50 text-teal-800 px-2 py-0.5 rounded-full border border-teal-100">${kmTraveled}</div>
                    </div>`;
                } else {
                    ubicacion = `<div class="flex flex-col items-center gap-1">
                        <button onclick="window.openAIRoute('${origen}', '${destino}')" class="text-purple-600 hover:text-purple-800 hover:underline font-bold flex items-center justify-center gap-1 transition"><i class="fas fa-robot"></i> Ruta IA</button>
                        <span class="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100"><i class="fas fa-signal-slash mr-1"></i> Sin GPS</span>
                    </div>`;
                }

                let statusClass = "bg-gray-100 text-gray-600";
                if(u.status.includes('Transito') || u.status === 'Cargada') statusClass = "bg-green-100 text-green-700 border border-green-200 shadow-sm";
                else if(u.status === 'En Taller') statusClass = "bg-red-100 text-red-700 border border-red-200 shadow-sm animate-pulse";
                else if(u.status === 'Vacia') statusClass = "bg-yellow-100 text-yellow-700 border border-yellow-200 shadow-sm";

                 html += `
                    <tr class="hover:bg-teal-50/30 transition-colors group">
                        <td class="p-4 border-r border-gray-100 font-black text-gray-800 bg-white group-hover:bg-teal-50/50 sticky left-0 z-10 transition-colors shadow-sm">${u.economic_number}</td>
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
            filteredUnits.forEach(u => {
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

                let ubicacion = '';
                if (samsaraVeh) {
                    ubicacion = `<div class="flex flex-col items-center gap-1">
                        <a href="https://www.google.com/maps?q=${samsaraVeh.location.latitude},${samsaraVeh.location.longitude}" target="_blank" class="text-blue-500 hover:text-blue-700 hover:underline font-bold flex items-center justify-center gap-1 transition"><i class="fas fa-location-arrow text-blue-400"></i> Localizar</a>
                        <div class="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full border border-blue-100">${kmTraveled}</div>
                    </div>`;
                } else {
                    ubicacion = `<div class="flex flex-col items-center gap-1">
                        <button onclick="window.openAIRoute('${origen}', '${destino}')" class="text-purple-600 hover:text-purple-800 hover:underline font-bold flex items-center justify-center gap-1 transition"><i class="fas fa-robot"></i> Ruta IA</button>
                        <span class="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100"><i class="fas fa-signal-slash mr-1"></i> Sin GPS</span>
                    </div>`;
                }

                let statusClass = "bg-gray-100 text-gray-600";
                if(u.status.includes('Transito') || u.status === 'Cargada') statusClass = "bg-green-100 text-green-700 border border-green-200 shadow-sm";
                else if(u.status === 'En Taller') statusClass = "bg-red-100 text-red-700 border border-red-200 shadow-sm animate-pulse";
                else if(u.status === 'Vacia') statusClass = "bg-yellow-100 text-yellow-700 border border-yellow-200 shadow-sm";

                 html += `
                    <tr class="hover:bg-gray-50/30 transition-colors group">
                        <td class="p-4 border-r border-gray-100 font-black text-gray-800 bg-white group-hover:bg-gray-50/50 sticky left-0 z-10 shadow-sm">${u.economic_number}</td>
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
                const fCarga = cp.finCarga ? formatCPTxt(cp.finCarga) : (cp.llegadaCarga ? formatCPTxt(cp.llegadaCarga) : '---');
                const fRuta = cp.finCarga ? formatCPTxt(cp.finCarga) : '---'; 
                const eta = u.details?.eta ? formatCPTxt(u.details.eta) : '---';
                const fEntrega = cp.finDescarga ? formatCPTxt(cp.finDescarga) : '---';
                const comentarios = u.details?.comments || '';

                tableRows.push([
                    "---",
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
                const fCarga = cp.finCarga ? formatCPTxt(cp.finCarga) : (cp.llegadaCarga ? formatCPTxt(cp.llegadaCarga) : '---');
                const cliente = u.details?.cliente || 'CHANGAN';
                const viaje = u.details?.viaje || '---';
                const origen = u.details?.origen || '---';
                const destino = u.details?.destino || '---';
                const eta = u.details?.eta ? formatCPTxt(u.details.eta) : '---';
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

