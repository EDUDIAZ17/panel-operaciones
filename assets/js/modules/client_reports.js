import { supabase } from '../services/supabaseClient.js';
import { fetchSamsaraLocations } from '../services/samsara.js';

export async function renderClientReports(container) {
    container.innerHTML = `
        <div id="view-client-reports" class="p-6 fade-in h-full flex flex-col gap-6">
            <div class="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-blue-100">
                <h3 class="text-xl font-bold text-gray-800"><i class="fas fa-file-contract text-blue-500 mr-2"></i> Reportes Específicos de Clientes</h3>
                <div class="flex gap-2">
                    <select id="client-report-type" class="border p-2 rounded-lg text-sm outline-none focus:border-blue-500 font-bold bg-gray-50 text-blue-700">
                        <option value="BYD">Reporte BYD</option>
                        <option value="CHANGAN">Reporte CHANGAN (Madrinas)</option>
                    </select>
                    <button id="btn-refresh-client-report" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg shadow-md transition font-bold" title="Actualizar Datos">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button id="btn-print-client-report" class="bg-gray-800 hover:bg-black text-white px-3 py-2 rounded-lg shadow-md transition font-bold" title="Imprimir PDF / Excel">
                        <i class="fas fa-print"></i>
                    </button>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
                <div class="p-3 border-b bg-gray-50 flex justify-between items-center text-xs text-gray-500 font-bold">
                    <span id="client-report-title">Mostrando Reporte BYD</span>
                    <span>Los datos se obtienen de las asignaciones activas. Campos vacíos requieren llenado manual posterior.</span>
                </div>
                <div class="overflow-auto flex-1 p-0">
                    <table class="w-full text-left border-collapse min-w-[1200px] whitespace-nowrap" id="table-client-report">
                        <thead id="client-report-head" class="bg-white sticky top-0 shadow-sm z-10 text-xs uppercase tracking-wider text-gray-500 border-b">
                        </thead>
                        <tbody id="client-report-body" class="divide-y divide-gray-100 text-sm">
                            <tr><td colspan="15" class="p-8 text-center text-gray-400 font-medium">Cargando reporte... <i class="fas fa-spinner fa-spin"></i></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.getElementById('client-report-type').addEventListener('change', loadClientReport);
    document.getElementById('btn-refresh-client-report').addEventListener('click', loadClientReport);
    document.getElementById('btn-print-client-report').addEventListener('click', () => {
        window.print();
    });

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

    const sortedUnits = (units || []).sort((a,b) => a.economic_number.localeCompare(b.economic_number, undefined, {numeric: true}));

    const activeUnits = sortedUnits.filter(u => !['Vacia', 'En Taller'].includes(u.status) || u.details?.cliente); 
    
    // For these specific reports, we just filter those explicitly assigned to the client.
    // If we want to show all simply to be filled out later, we can show them, but matching client is cleaner.
    const filteredUnits = activeUnits.filter(u => {
        const clienteStr = u.details?.cliente?.toUpperCase() || '';
        if (type === 'BYD') return clienteStr.includes('BYD');
        if (type === 'CHANGAN') return clienteStr.includes('CHANGAN');
        return true; 
    });

    let html = '';

    if (type === 'BYD') {
        thead.innerHTML = `
            <tr>
                <th class="p-3 font-bold bg-blue-50 text-blue-900 border-r border-gray-100">BOL</th>
                <th class="p-3 font-bold bg-blue-50 text-blue-900 border-r border-gray-100">ECONOMICO</th>
                <th class="p-3 font-bold bg-blue-50 text-blue-900 border-r border-gray-100">DESTINO</th>
                <th class="p-3 font-bold bg-blue-50 text-blue-900 border-r border-gray-100">FECHA PROG.</th>
                <th class="p-3 font-bold bg-blue-50 text-blue-900 border-r border-gray-100">FECHA CARGA</th>
                <th class="p-3 font-bold bg-blue-50 text-blue-900 border-r border-gray-100">FECHA INICIO RUTA</th>
                <th class="p-3 font-bold bg-blue-50 text-blue-900 border-r border-gray-100">ETA</th>
                <th class="p-3 font-bold bg-blue-50 text-blue-900 border-r border-gray-100">FECHA ENTREGA FINAL</th>
                <th class="p-3 font-bold bg-blue-50 text-blue-900 border-r border-gray-100">STATUS</th>
                <th class="p-3 font-bold bg-blue-50 text-blue-900 border-r border-gray-100">UBICACION</th>
                <th class="p-3 font-bold bg-blue-50 text-blue-900">COMENTARIOS</th>
            </tr>
        `;

        if (filteredUnits.length === 0) {
            html = `<tr><td colspan="11" class="p-8 text-center text-gray-500">No hay unidades asignadas al cliente BYD. Ve a Asignaciones y asigna el cliente a una unidad para verla aquí.</td></tr>`;
        } else {
            filteredUnits.forEach(u => {
                const destino = u.details?.destino || '---';
                const fProg = u.details?.scheduled_trip ? new Date(u.details.scheduled_trip).toLocaleString() : '---';
                const fCarga = '---'; 
                const fRuta = '---';
                const eta = '---';
                const fEntrega = '---';
                const comentarios = u.details?.comments || '---';

                const samsaraVeh = samsaraData.find(v => v.name.includes(u.economic_number) || (u.placas && v.name.includes(u.placas)));
                const ubicacion = samsaraVeh ? `<a href="https://www.google.com/maps?q=${samsaraVeh.location.latitude},${samsaraVeh.location.longitude}" target="_blank" class="text-blue-500 hover:text-blue-700 font-bold flex items-center gap-1"><i class="fas fa-map-marker-alt"></i> Ver Mapa</a>` : '<span class="text-gray-400">Sin Señal</span>';

                html += `
                    <tr class="hover:bg-blue-50 transition border-b">
                        <td class="p-3 border-r border-gray-100 text-gray-400">---</td>
                        <td class="p-3 border-r border-gray-100 font-bold text-gray-800">${u.economic_number}</td>
                        <td class="p-3 border-r border-gray-100 font-mono text-xs">${destino}</td>
                        <td class="p-3 border-r border-gray-100 text-xs text-gray-600">${fProg}</td>
                        <td class="p-3 border-r border-gray-100 text-xs text-gray-400">${fCarga}</td>
                        <td class="p-3 border-r border-gray-100 text-xs text-gray-400">${fRuta}</td>
                        <td class="p-3 border-r border-gray-100 text-xs text-gray-400">${eta}</td>
                        <td class="p-3 border-r border-gray-100 text-xs text-gray-400">${fEntrega}</td>
                        <td class="p-3 border-r border-gray-100"><span class="px-2 py-1 bg-gray-100 rounded text-xs font-bold">${u.status}</span></td>
                        <td class="p-3 border-r border-gray-100 text-xs">${ubicacion}</td>
                        <td class="p-3 text-xs text-gray-500 truncate max-w-xs" title="${comentarios}">${comentarios}</td>
                    </tr>
                `;
            });
        }
    } else if (type === 'CHANGAN') {
        thead.innerHTML = `
            <tr>
                <th class="p-3 font-bold bg-teal-50 text-teal-900 border-r border-gray-100">UNIDAD</th>
                <th class="p-3 font-bold bg-teal-50 text-teal-900 border-r border-gray-100">OPERADOR</th>
                <th class="p-3 font-bold bg-teal-50 text-teal-900 border-r border-gray-100">FECHA CARGA</th>
                <th class="p-3 font-bold bg-teal-50 text-teal-900 border-r border-gray-100">CLIENTE</th>
                <th class="p-3 font-bold bg-teal-50 text-teal-900 border-r border-gray-100">VIAJE</th>
                <th class="p-3 font-bold bg-teal-50 text-teal-900 border-r border-gray-100">ORIGEN</th>
                <th class="p-3 font-bold bg-teal-50 text-teal-900 border-r border-gray-100">DESTINO</th>
                <th class="p-3 font-bold bg-teal-50 text-teal-900 border-r border-gray-100">ETA</th>
                <th class="p-3 font-bold bg-teal-50 text-teal-900 border-r border-gray-100">ESTATUS</th>
                <th class="p-3 font-bold bg-teal-50 text-teal-900 border-r border-gray-100">UBICACION</th>
                <th class="p-3 font-bold bg-teal-50 text-teal-900">OBSERVACIONES</th>
            </tr>
        `;

        if (filteredUnits.length === 0) {
            html = `<tr><td colspan="11" class="p-8 text-center text-gray-500">No hay unidades asignadas al cliente CHANGAN. Ve a Asignaciones y asigna el cliente a una unidad para verla aquí.</td></tr>`;
        } else {
            filteredUnits.forEach(u => {
                const opName = u.operators?.name || '---';
                const fCarga = '---';
                const cliente = u.details?.cliente || 'CHANGAN';
                const viaje = '---';
                const origen = u.details?.origen || '---';
                const destino = u.details?.destino || '---';
                const eta = '---';
                const obs = u.details?.comments || '---';
                
                const samsaraVeh = samsaraData.find(v => v.name.includes(u.economic_number) || (u.placas && v.name.includes(u.placas)));
                const ubicacion = samsaraVeh ? `<a href="https://www.google.com/maps?q=${samsaraVeh.location.latitude},${samsaraVeh.location.longitude}" target="_blank" class="text-teal-600 hover:text-teal-800 font-bold flex items-center gap-1"><i class="fas fa-map-marker-alt"></i> Ver Mapa</a>` : '<span class="text-gray-400">Sin Señal</span>';

                 html += `
                    <tr class="hover:bg-teal-50 transition border-b">
                        <td class="p-3 border-r border-gray-100 font-bold text-gray-800">${u.economic_number}</td>
                        <td class="p-3 border-r border-gray-100 text-xs text-gray-700">${opName}</td>
                        <td class="p-3 border-r border-gray-100 text-xs text-gray-400">${fCarga}</td>
                        <td class="p-3 border-r border-gray-100 font-bold text-teal-700 text-xs">${cliente}</td>
                        <td class="p-3 border-r border-gray-100 text-xs text-gray-400">${viaje}</td>
                        <td class="p-3 border-r border-gray-100 font-mono text-xs text-gray-600">${origen}</td>
                        <td class="p-3 border-r border-gray-100 font-mono text-xs text-gray-600">${destino}</td>
                        <td class="p-3 border-r border-gray-100 text-xs text-gray-400">${eta}</td>
                        <td class="p-3 border-r border-gray-100"><span class="px-2 py-1 bg-gray-100 rounded text-xs font-bold">${u.status}</span></td>
                        <td class="p-3 border-r border-gray-100 text-xs">${ubicacion}</td>
                        <td class="p-3 text-xs text-gray-500 truncate max-w-xs" title="${obs}">${obs}</td>
                    </tr>
                `;
            });
        }
    }

    tbody.innerHTML = html;
}
