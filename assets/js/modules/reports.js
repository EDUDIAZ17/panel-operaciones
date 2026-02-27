import { supabase } from '../services/supabaseClient.js';
import { formatCurrency } from '../utils/formatters.js';

export async function renderReports(container) {
    container.innerHTML = `
        <div id="view-reports" class="p-6 fade-in space-y-6">
            <!-- Totales Card -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
                    <p class="text-xs text-gray-500 uppercase font-bold">Total Depositado</p>
                    <p id="stat-total-deposited" class="text-2xl font-bold text-gray-800">$0.00</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                    <p class="text-xs text-gray-500 uppercase font-bold">Gastos Operativos</p>
                    <p id="stat-total-fixed" class="text-2xl font-bold text-gray-800">$0.00</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
                    <p class="text-xs text-gray-500 uppercase font-bold">Alimentos & Maniobras</p>
                    <p id="stat-total-var" class="text-2xl font-bold text-gray-800">$0.00</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
                    <p class="text-xs text-gray-500 uppercase font-bold">Saldos Pendientes</p>
                    <p id="stat-total-balance" class="text-2xl font-bold text-gray-800">$0.00</p>
                </div>
            </div>

            <!-- Filters -->
            <div class="bg-white p-4 rounded-lg shadow flex flex-wrap gap-4 items-end">
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">OPERADOR</label>
                    <select id="rpt-filter-op" class="border p-2 rounded text-sm w-48">
                        <option value="all">Todos</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">UNIDAD</label>
                    <select id="rpt-filter-unit" class="border p-2 rounded text-sm w-48">
                        <option value="all">Todas</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">DESDE</label>
                    <input type="date" id="rpt-filter-start" class="border p-2 rounded text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">HASTA</label>
                    <input type="date" id="rpt-filter-end" class="border p-2 rounded text-sm">
                </div>
                <button id="btn-apply-rpt" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition font-bold text-sm">FILTRAR</button>
            </div>

            <!-- Dashboard Charts -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white p-6 rounded-lg shadow">
                    <h4 class="font-bold text-gray-700 mb-4">Distribución de Gastos</h4>
                    <canvas id="chart-expenses-pie"></canvas>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <h4 class="font-bold text-gray-700 mb-4">Gasto por Operador (Total)</h4>
                    <canvas id="chart-operators-bar"></canvas>
                </div>
            </div>

            <!-- Summary Table -->
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="p-4 bg-gray-50 border-b">
                    <h4 class="font-bold text-gray-700 uppercase text-sm">Desglose por Operador</h4>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm whitespace-nowrap">
                        <thead class="bg-gray-100 border-b">
                            <tr>
                                <th class="p-4">Operador</th>
                                <th class="p-4 text-right">Alimentos</th>
                                <th class="p-4 text-right">Maniobras</th>
                                <th class="p-4 text-right text-gray-400">| Casetas</th>
                                <th class="p-4 text-right text-gray-400">Combustible</th>
                                <th class="p-4 text-right text-gray-400">Guía/Tránsito</th>
                                <th class="p-4 text-right text-gray-400">Sanitarias</th>
                                <th class="p-4 text-right text-gray-400">Báscula</th>
                                <th class="p-4 text-right text-gray-400">Pensiones</th>
                                <th class="p-4 text-right text-gray-400">Estadías</th>
                                <th class="p-4 text-right text-gray-400">Mantenimiento</th>
                                <th class="p-4 text-right text-gray-400">Otros</th>
                                <th class="p-4 text-right text-gray-500">Total Fijos</th>
                                <th class="p-4 text-right">Saldo</th>
                                <th class="p-4 text-right font-bold">GRAN TOTAL</th>
                            </tr>
                        </thead>
                        <tbody id="rpt-table-body">
                            <tr><td colspan="15" class="p-8 text-center text-gray-500">Calculando reporte...</td></tr>
                        </tbody>
                        <tfoot id="rpt-table-foot" class="bg-gray-50 font-bold">
                            <!-- Totals here -->
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Initialize UI and Load Data
    setupFilters();
    loadReportData();
    document.getElementById('btn-apply-rpt').onclick = loadReportData;
}

async function setupFilters() {
    const { data: ops } = await supabase.from('operators').select('*').order('name');
    const { data: units } = await supabase.from('units').select('*').order('economic_number');

    const opSelect = document.getElementById('rpt-filter-op');
    const unitSelect = document.getElementById('rpt-filter-unit');

    if(ops) ops.forEach(op => {
        opSelect.innerHTML += `<option value="${op.id}">${op.name}</option>`;
    });

    if(units) units.forEach(u => {
        unitSelect.innerHTML += `<option value="${u.id}">${u.economic_number}</option>`;
    });

    // Default dates (current month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('rpt-filter-start').valueAsDate = firstDay;
    document.getElementById('rpt-filter-end').valueAsDate = now;
}

let currentCharts = {};

async function loadReportData() {
    const opId = document.getElementById('rpt-filter-op').value;
    const unitId = document.getElementById('rpt-filter-unit').value;
    const start = document.getElementById('rpt-filter-start').value;
    const end = document.getElementById('rpt-filter-end').value;

    let query = supabase.from('expenses').select('*, operators(name)').order('created_at', { ascending: false });

    if (opId !== 'all') query = query.eq('operator_id', opId);
    if (unitId !== 'all') query = query.eq('unit_id', unitId);
    if (start) query = query.gte('created_at', start);
    if (end) query = query.lte('created_at', end + 'T23:59:59');

    const { data, error } = await query;

    if (error) {
        console.error(error);
        return;
    }

    renderSummary(data);
    renderCharts(data);
}

function renderSummary(data) {
    const tbody = document.getElementById('rpt-table-body');
    const tfoot = document.getElementById('rpt-table-foot');
    
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-500">No se encontraron registros en este periodo.</td></tr>';
        tfoot.innerHTML = '';
        updateStats(0, 0, 0, 0);
        return;
    }

    // Aggregate by operator
    const aggregated = {};
    let totalVar = 0, totalFixed = 0, totalBalance = 0, grandTotal = 0;
    // Granular fixed cost totals for the footer
    const globalFixed = { tolls: 0, fuel: 0, guide: 0, sanitary: 0, scale: 0, stays: 0, pensions: 0, maintenance: 0, other: 0 };

    data.forEach(ex => {
        const opName = ex.operators?.name || 'Otro / Desconocido';
        const d = ex.details || {};
        
        if (!aggregated[opName]) {
            aggregated[opName] = { food: 0, maneuver: 0, balance: 0, total: 0, fixed: 0,
                                   tolls: 0, fuel: 0, guide: 0, sanitary: 0, scale: 0, stays: 0, pensions: 0, maintenance: 0, other: 0 };
        }

        const food = parseFloat(d.totalFood) || 0;
        const maneuver = parseFloat(d.totalManeuver) || 0;
        const fixed = parseFloat(d.totalFixed) || 0;
        
        const tolls = parseFloat(d.tolls) || 0;
        const fuel = parseFloat(d.fuel) || 0;
        const guide = parseFloat(d.guide) || 0;
        const sanitary = parseFloat(d.sanitary) || 0;
        const scale = parseFloat(d.scale) || 0;
        const stays = parseFloat(d.stays) || 0;
        const pensions = parseFloat(d.pensions) || 0;
        const maintenance = parseFloat(d.maintenance) || 0;
        const other = parseFloat(d.other) || 0;
        
        // Use details.balance if available, else derive it (fallback)
        let balance = parseFloat(d.balance);
        if (isNaN(balance)) balance = parseFloat(ex.total_amount - (food + maneuver + fixed)) || 0;
        
        const total = parseFloat(ex.total_amount) || 0;

        aggregated[opName].food += food;
        aggregated[opName].maneuver += maneuver;
        aggregated[opName].tolls += tolls;
        aggregated[opName].fuel += fuel;
        aggregated[opName].guide += guide;
        aggregated[opName].sanitary += sanitary;
        aggregated[opName].scale += scale;
        aggregated[opName].stays += stays;
        aggregated[opName].pensions += pensions;
        aggregated[opName].maintenance += maintenance;
        aggregated[opName].other += other;
        
        aggregated[opName].fixed += fixed;
        aggregated[opName].balance += balance;
        aggregated[opName].total += total;

        // Global Accums
        globalFixed.tolls += tolls;
        globalFixed.fuel += fuel;
        globalFixed.guide += guide;
        globalFixed.sanitary += sanitary;
        globalFixed.scale += scale;
        globalFixed.stays += stays;
        globalFixed.pensions += pensions;
        globalFixed.maintenance += maintenance;
        globalFixed.other += other;

        totalVar += (food + maneuver);
        totalFixed += fixed;
        totalBalance += balance;
        grandTotal += total;
    });

    tbody.innerHTML = Object.entries(aggregated).map(([name, stats]) => `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-4 font-bold text-gray-800">${name}</td>
            <td class="p-4 text-right">${formatCurrency(stats.food)}</td>
            <td class="p-4 text-right">${formatCurrency(stats.maneuver)}</td>
            <td class="p-4 text-right text-gray-400">${formatCurrency(stats.tolls)}</td>
            <td class="p-4 text-right text-gray-400">${formatCurrency(stats.fuel)}</td>
            <td class="p-4 text-right text-gray-400">${formatCurrency(stats.guide)}</td>
            <td class="p-4 text-right text-gray-400">${formatCurrency(stats.sanitary)}</td>
            <td class="p-4 text-right text-gray-400">${formatCurrency(stats.scale)}</td>
            <td class="p-4 text-right text-gray-400">${formatCurrency(stats.pensions)}</td>
            <td class="p-4 text-right text-gray-400">${formatCurrency(stats.stays)}</td>
            <td class="p-4 text-right text-gray-400">${formatCurrency(stats.maintenance)}</td>
            <td class="p-4 text-right text-gray-400">${formatCurrency(stats.other)}</td>
            <td class="p-4 text-right bg-gray-50 font-bold text-gray-600">${formatCurrency(stats.fixed)}</td>
            <td class="p-4 text-right ${stats.balance < 0 ? 'text-red-500 font-bold' : ''}">${formatCurrency(stats.balance)}</td>
            <td class="p-4 text-right font-bold text-green-700 bg-green-50">${formatCurrency(stats.total)}</td>
        </tr>
    `).join('');

    const finalFood = Object.values(aggregated).reduce((a, b) => a + b.food, 0);
    const finalManeuver = Object.values(aggregated).reduce((a, b) => a + b.maneuver, 0);
    
    tfoot.innerHTML = `
        <tr class="bg-gray-200">
            <td class="p-4">TOTAL GENERAL</td>
            <td class="p-4 text-right">${formatCurrency(finalFood)}</td>
            <td class="p-4 text-right">${formatCurrency(finalManeuver)}</td>
            <td class="p-4 text-right text-gray-500">${formatCurrency(globalFixed.tolls)}</td>
            <td class="p-4 text-right text-gray-500">${formatCurrency(globalFixed.fuel)}</td>
            <td class="p-4 text-right text-gray-500">${formatCurrency(globalFixed.guide)}</td>
            <td class="p-4 text-right text-gray-500">${formatCurrency(globalFixed.sanitary)}</td>
            <td class="p-4 text-right text-gray-500">${formatCurrency(globalFixed.scale)}</td>
            <td class="p-4 text-right text-gray-500">${formatCurrency(globalFixed.pensions)}</td>
            <td class="p-4 text-right text-gray-500">${formatCurrency(globalFixed.stays)}</td>
            <td class="p-4 text-right text-gray-500">${formatCurrency(globalFixed.maintenance)}</td>
            <td class="p-4 text-right text-gray-500">${formatCurrency(globalFixed.other)}</td>
            <td class="p-4 text-right font-bold text-gray-700">${formatCurrency(totalFixed)}</td>
            <td class="p-4 text-right font-bold">${formatCurrency(totalBalance)}</td>
            <td class="p-4 text-right text-lg text-green-800">${formatCurrency(grandTotal)}</td>
        </tr>
    `;

    updateStats(grandTotal, totalFixed, totalVar, totalBalance);
}

function updateStats(total, fixed, variable, balance) {
    document.getElementById('stat-total-deposited').innerText = formatCurrency(total);
    document.getElementById('stat-total-fixed').innerText = formatCurrency(fixed);
    document.getElementById('stat-total-var').innerText = formatCurrency(variable);
    document.getElementById('stat-total-balance').innerText = formatCurrency(balance);
}

function renderCharts(data) {
    const pieCtx = document.getElementById('chart-expenses-pie')?.getContext('2d');
    const barCtx = document.getElementById('chart-operators-bar')?.getContext('2d');

    if (!pieCtx || !barCtx) return;

    // Data for Pie
    let food = 0, maneuver = 0, tolls = 0, fuel = 0, maint = 0, otherFix = 0, balance = 0;
    data.forEach(ex => {
        const d = ex.details || {};
        food += parseFloat(d.totalFood) || 0;
        maneuver += parseFloat(d.totalManeuver) || 0;
        tolls += parseFloat(d.tolls) || 0;
        fuel += parseFloat(d.fuel) || 0;
        maint += parseFloat(d.maintenance) || 0;
        
        let subOthers = (parseFloat(d.guide)||0) + (parseFloat(d.sanitary)||0) + (parseFloat(d.scale)||0) + (parseFloat(d.stays)||0) + (parseFloat(d.pensions)||0) + (parseFloat(d.other)||0);
        otherFix += subOthers;
        
        let bal = parseFloat(d.balance);
        if(isNaN(bal)) bal = parseFloat(ex.total_amount - ((d.totalFood||0) + (d.totalManeuver||0) + (d.totalFixed||0))) || 0;
        balance += bal;
    });

    if (currentCharts.pie) currentCharts.pie.destroy();
    currentCharts.pie = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: ['Alimentos', 'Maniobras', 'Casetas', 'Combustible', 'Mantenimiento', 'Otros Fijos', 'Saldos'],
            datasets: [{
                data: [food, maneuver, tolls, fuel, maint, otherFix, Math.max(0, balance)],
                backgroundColor: ['#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#6B7280', '#000000']
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    // Data for Bar (Top 10 Operators)
    const opTotals = {};
    data.forEach(ex => {
        const name = ex.operators?.name || 'Desc.';
        opTotals[name] = (opTotals[name] || 0) + ex.total_amount;
    });

    const sortedOps = Object.entries(opTotals).sort((a,b) => b[1] - a[1]).slice(0, 10);

    if (currentCharts.bar) currentCharts.bar.destroy();
    currentCharts.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: sortedOps.map(i => i[0]),
            datasets: [{
                label: 'Total Depositado',
                data: sortedOps.map(i => i[1]),
                backgroundColor: '#6366F1'
            }]
        },
        options: { 
            responsive: true, 
            indexAxis: 'y',
            plugins: { legend: { display: false } } 
        }
    });
}
