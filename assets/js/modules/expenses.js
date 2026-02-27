import { supabase } from '../services/supabaseClient.js';
import { analyzeExpensesWithAI } from '../services/gemini.js';
import { formatCurrency } from '../utils/formatters.js';

export function renderExpenses(container) {
    container.innerHTML = `
        <div id="view-expenses" class="p-6 fade-in">
            <div class="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
                <div class="border-b pb-4 mb-4 flex justify-between items-center">
                    <h3 class="text-xl font-bold text-green-700"><i class="fab fa-whatsapp"></i> Generador de Reporte de Gastos</h3>
                    <button id="btn-ai-report" class="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700">🤖 Reporte IA</button>
                </div>

                <!-- AI Output Area -->
                <div id="ai-result" class="hidden mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-900"></div>

                <form id="expense-form" class="space-y-6">
                    <!-- Datos Generales -->
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Operador</label>
                            <select id="exp-operator" class="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm bg-white">
                                <option>Cargando...</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Unidad</label>
                            <select id="exp-unit" class="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm bg-white">
                                <option>Cargando...</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Ruta</label>
                            <input type="text" id="exp-route" placeholder="Ej: Iztapalapa/MZT" class="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm">
                        </div>
                         <div>
                            <label class="block text-sm font-medium text-gray-700">Trayecto</label>
                            <select id="exp-trip-type" class="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm bg-white">
                                <option value="Cargada">Cargada</option>
                                <option value="Vacía">Vacía</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Fecha</label>
                            <input type="date" id="exp-date" class="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm">
                        </div>
                    </div>

                    <div class="border-t pt-4">
                        <h4 class="text-sm font-bold text-gray-500 mb-2 uppercase">Gastos Variables (Automático)</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <label class="block text-sm font-medium text-blue-800">Kilómetros Recorridos</label>
                                <div class="flex items-center mt-1">
                                    <input type="number" id="exp-km" class="block w-full border-gray-300 rounded-md p-2 border" placeholder="0">
                                    <span class="ml-2 text-gray-500">x $0.45</span>
                                </div>
                                <p class="text-right text-sm font-bold mt-1 text-blue-600" id="res-food">$0.00 (Alimentos)</p>
                            </div>
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <label class="block text-sm font-medium text-blue-800">Unidades Carga/Descarga</label>
                                <div class="flex items-center mt-1">
                                    <input type="number" id="exp-units" class="block w-full border-gray-300 rounded-md p-2 border" placeholder="0">
                                    <span class="ml-2 text-gray-500">x $45.00</span>
                                </div>
                                <p class="text-right text-sm font-bold mt-1 text-blue-600" id="res-maneuver">$0.00 (Maniobras)</p>
                            </div>
                        </div>
                    </div>

                    <div class="border-t pt-4">
                        <h4 class="text-sm font-bold text-gray-500 mb-2 uppercase">Gastos Fijos</h4>
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div><label class="text-xs">Casetas</label><input type="number" id="exp-tolls" class="w-full border p-2 rounded fixed-cost" placeholder="$0"></div>
                            <div><label class="text-xs">Combustible</label><input type="number" id="exp-fuel" class="w-full border p-2 rounded fixed-cost" placeholder="$0"></div>
                            <div><label class="text-xs">Guía / Tránsito</label><input type="number" id="exp-guide" class="w-full border p-2 rounded fixed-cost" placeholder="$0"></div>
                            <div><label class="text-xs">Sanitarias</label><input type="number" id="exp-sanitary" class="w-full border p-2 rounded fixed-cost" placeholder="$0"></div>
                            <div><label class="text-xs">Báscula</label><input type="number" id="exp-scale" class="w-full border p-2 rounded fixed-cost" placeholder="$0"></div>
                            <div><label class="text-xs">Pensiones</label><input type="number" id="exp-pensions" class="w-full border p-2 rounded fixed-cost" placeholder="$0"></div>
                            <div><label class="text-xs">Estadías</label><input type="number" id="exp-stays" class="w-full border p-2 rounded fixed-cost" placeholder="$0"></div>
                            
                            <div class="col-span-1">
                                <label class="text-xs">Mantenimiento</label>
                                <input type="number" id="exp-maintenance" class="w-full border p-2 rounded fixed-cost" placeholder="$0">
                                <textarea id="exp-maintenance-obs" class="w-full border mt-1 p-1 text-[10px] rounded" placeholder="Observaciones Manto."></textarea>
                            </div>
                            
                            <div class="col-span-1">
                                <label class="text-xs">Otros</label>
                                <input type="number" id="exp-other" class="w-full border p-2 rounded fixed-cost" placeholder="$0">
                                <textarea id="exp-other-obs" class="w-full border mt-1 p-1 text-[10px] rounded" placeholder="Observaciones Otros"></textarea>
                            </div>
                        </div>
                    </div>

                    <div class="border-t pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                         <div class="w-full md:w-1/2">
                            <label class="block text-sm font-medium text-gray-700">Saldo Pendiente Anterior</label>
                            <div class="flex gap-2">
                                <input type="number" id="exp-balance" class="block w-1/3 border border-red-200 bg-red-50 rounded-md p-2 shadow-sm" placeholder="0.00">
                                <textarea id="exp-balance-obs" class="flex-1 border p-2 text-xs rounded-md" placeholder="¿Por qué es este saldo? (Obligatorio si es negativo)"></textarea>
                            </div>
                            <p id="balance-warning" class="hidden text-[10px] text-red-600 font-bold mt-1 animate-pulse">⚠️ EL OPERADOR LE DEBE A LA EMPRESA</p>
                        </div>
                        <div class="text-right w-full md:w-auto">
                            <p class="text-sm text-gray-500">TOTAL A DEPOSITAR</p>
                            <p class="text-3xl font-bold text-green-600" id="final-total">$0.00</p>
                        </div>
                    </div>

                    <button type="button" id="btn-send-wa" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg shadow transition transform hover:scale-105 flex justify-center items-center">
                        <i class="fab fa-whatsapp mr-2 text-2xl"></i> GUARDAR Y ENVIAR WHATSAPP
                    </button>
                </form>
            </div>

            <!-- HISTORY SECTION -->
            <div class="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 mt-6 relative">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-gray-800">📜 Historial Reciente</h3>
                    <button id="btn-clear-history" class="text-xs text-red-500 hover:text-red-700 font-bold border border-red-200 px-2 py-1 rounded transition">
                        <i class="fas fa-trash-alt mr-1"></i> LIMPIAR HISTORIAL
                    </button>
                </div>
                <div class="overflow-x-auto border rounded-lg">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-gray-50 border-b">
                            <tr class="text-gray-500 font-bold">
                                <th class="p-4">Fecha</th>
                                <th class="p-4">Operador</th>
                                <th class="p-4">Unidad</th>
                                <th class="p-4">Ruta</th>
                                <th class="p-4 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody id="expenses-history-body">
                            <tr><td colspan="5" class="p-4 text-center text-gray-400">Cargando historial...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div id="expense-modal-container"></div>
        </div>
    `;

    // Init
    loadOperators();
    loadUnits();
    loadExpenseHistory();
    document.getElementById('exp-date').valueAsDate = new Date();
    
    // Listeners for calc
    const inputs = document.querySelectorAll('input[type="number"], textarea');
    inputs.forEach(inp => inp.addEventListener('input', calculate));
    
    document.getElementById('btn-send-wa').addEventListener('click', saveAndSend);
    document.getElementById('btn-ai-report').addEventListener('click', generateAIReport);
    document.getElementById('btn-clear-history').addEventListener('click', clearExpenseHistory);
}

async function loadOperators() {
    const select = document.getElementById('exp-operator');
    const { data: ops } = await supabase.from('operators').select('*').order('name');
    select.innerHTML = ops.map(op => `<option value="${op.id}" data-name="${op.name}">${op.name}</option>`).join('');
}

async function loadUnits() {
    const select = document.getElementById('exp-unit');
    const { data: units } = await supabase.from('units').select('*').order('economic_number');
    select.innerHTML = units.map(u => `<option value="${u.id}">${u.economic_number} (${u.type})</option>`).join('');
}

async function loadExpenseHistory() {
    const tbody = document.getElementById('expenses-history-body');
    const { data: expenses, error } = await supabase
        .from('expenses')
        .select(`*, operators(name), units(economic_number)`)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-red-500">Error: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = expenses.map(ex => {
        const opName = ex.operators?.name || ex.details?.opName || 'Desc.';
        const unitEco = ex.units?.economic_number || ex.details?.unitEco || '---';

        return `
            <tr class="border-b hover:bg-green-50 cursor-pointer transition expense-row" data-id="${ex.id}">
                <td class="p-4 text-gray-600 font-medium">${new Date(ex.created_at).toLocaleDateString('es-MX', {day:'2-digit', month:'short', year:'numeric'})}</td>
                <td class="p-4 font-bold text-gray-800">${opName}</td>
                <td class="p-4 text-blue-600 font-mono font-bold">${unitEco}</td>
                <td class="p-4 text-gray-600 italic">${ex.route}</td>
                <td class="p-4 text-right font-mono text-green-600 font-bold text-lg">${formatCurrency(ex.total_amount)}</td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.expense-row').forEach(row => {
        row.onclick = () => showExpenseDetail(expenses.find(e => e.id === row.dataset.id));
    });
}

function calculate() {
    const km = parseFloat(document.getElementById('exp-km').value) || 0;
    const units = parseFloat(document.getElementById('exp-units').value) || 0;
    const balance = parseFloat(document.getElementById('exp-balance').value) || 0;

    const totalFood = km * 0.45;
    const totalManeuver = units * 45.00;

    document.getElementById('res-food').innerText = formatCurrency(totalFood);
    document.getElementById('res-maneuver').innerText = formatCurrency(totalManeuver);

    const totalFixed = Array.from(document.querySelectorAll('.fixed-cost')).reduce((acc, inp) => acc + (parseFloat(inp.value) || 0), 0);
    
    const tolls = parseFloat(document.getElementById('exp-tolls').value) || 0;
    const fuel = parseFloat(document.getElementById('exp-fuel').value) || 0;
    const guide = parseFloat(document.getElementById('exp-guide').value) || 0;
    const sanitary = parseFloat(document.getElementById('exp-sanitary').value) || 0;
    const scale = parseFloat(document.getElementById('exp-scale').value) || 0;
    const stays = parseFloat(document.getElementById('exp-stays').value) || 0;
    const pensions = parseFloat(document.getElementById('exp-pensions').value) || 0;
    const maintenance = parseFloat(document.getElementById('exp-maintenance').value) || 0;
    const other = parseFloat(document.getElementById('exp-other').value) || 0;

    const grandTotal = totalFood + totalManeuver + totalFixed + balance;
    document.getElementById('final-total').innerText = formatCurrency(grandTotal);

    // Negative Balance Warning
    const warning = document.getElementById('balance-warning');
    if (balance < 0) warning.classList.remove('hidden');
    else warning.classList.add('hidden');

    return { 
        totalFood, totalManeuver, totalFixed, grandTotal, balance, km, units, 
        tolls, fuel, guide, sanitary, scale, stays, pensions, maintenance, other,
        maintenance_obs: document.getElementById('exp-maintenance-obs').value,
        other_obs: document.getElementById('exp-other-obs').value,
        balance_obs: document.getElementById('exp-balance-obs').value,
        trip_type: document.getElementById('exp-trip-type').value
    };
}

async function saveAndSend() {
    const calcs = calculate();
    const opSelect = document.getElementById('exp-operator');
    const opName = opSelect.options[opSelect.selectedIndex].text;
    const unitSelect = document.getElementById('exp-unit');
    const unitEco = unitSelect.options[unitSelect.selectedIndex].text;
    const route = document.getElementById('exp-route').value;
    const date = document.getElementById('exp-date').value;

    if (calcs.balance < 0 && !calcs.balance_obs.trim()) {
        alert("Debes poner el motivo del saldo negativo (El operador le debe a la empresa).");
        return;
    }

    // Save to DB
    const { error } = await supabase.from('expenses').insert({
        operator_id: opSelect.value,
        unit_id: unitSelect.value,
        route,
        total_amount: calcs.grandTotal,
        details: { ...calcs, date, unitEco, opName },
        created_at: new Date().toISOString()
    });

    if (error) alert('Error guardando en BD (pero se abrirá WA): ' + error.message);
    else {
        loadExpenseHistory();
    }

    // Build WA Message (Clean Text - No Emojis)
    let msg = `*REPORTE DE GASTOS - LOGISTICS*\n\n`;
    msg += `*Operador:* ${opName}\n`;
    msg += `*Unidad:* ${unitEco}\n`;
    msg += `*Trayecto:* ${calcs.trip_type}\n`;
    msg += `*Fecha:* ${date}\n`;
    msg += `*Ruta:* ${route}\n`;
    msg += `----------------------------------\n`;
    
    msg += `*CALCULOS VARIABLES:*\n`;
    msg += `- Alimentos: ${calcs.km}km x $0.45 = *$${formatCurrency(calcs.totalFood).replace('$', '')}*\n`;
    msg += `- Maniobras: ${calcs.units}uds x $45 = *$${formatCurrency(calcs.totalManeuver).replace('$', '')}*\n\n`;
    
    msg += `*GASTOS FIJOS (DESGLOSE):*\n`;
    const fixedInputs = document.querySelectorAll('.fixed-cost');
    fixedInputs.forEach(inp => {
        const val = parseFloat(inp.value) || 0;
        if (val > 0) {
            const label = inp.previousElementSibling.innerText;
            msg += `- ${label}: *$${val.toLocaleString('es-MX', {minimumFractionDigits: 2})}*\n`;
            if (inp.id === 'exp-maintenance' && calcs.maintenance_obs) msg += `  (Obs: ${calcs.maintenance_obs})\n`;
            if (inp.id === 'exp-other' && calcs.other_obs) msg += `  (Obs: ${calcs.other_obs})\n`;
        }
    });
    
    if (calcs.balance !== 0) {
        msg += `\n*SALDO PENDIENTE ANTERIOR:* $${calcs.balance.toLocaleString('es-MX', {minimumFractionDigits: 2})}\n`;
        if (calcs.balance < 0) msg += `*EL OPERADOR DEBE A LA EMPRESA*\n`;
        if (calcs.balance_obs) msg += `Motivo: ${calcs.balance_obs}\n`;
    }

    msg += `----------------------------------\n`;
    msg += `*TOTAL A DEPOSITAR:*\n`;
    msg += `*${formatCurrency(calcs.grandTotal)}*\n`;
    msg += `----------------------------------`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

async function generateAIReport() {
    const div = document.getElementById('ai-result');
    div.classList.remove('hidden');
    div.innerHTML = '<div class="spinner"></div> Analizando gastos con Gemini AI...';
    
    // Fetch last 50 expenses for better context
    const { data: expenses } = await supabase
        .from('expenses')
        .select('*, operators(name)')
        .order('created_at', { ascending: false })
        .limit(50);
        
    if(!expenses || expenses.length === 0) {
        div.innerHTML = "No hay datos suficientes para el análisis.";
        return;
    }

    try {
        const report = await analyzeExpensesWithAI(expenses);
        div.innerHTML = `<strong>🤖 Reporte Gemini:</strong><br><div class="mt-2 text-gray-700">${report}</div>`;
    } catch (e) {
        div.innerHTML = '<span class="text-red-600">Error IA: ' + e.message + '</span>';
    }
}

async function clearExpenseHistory() {
    const password = prompt("Ingresa la contraseña para borrar el historial:");
    if (password !== 'edu17') {
        alert("Contraseña incorrecta.");
        return;
    }

    if (confirm("¿Estás seguro de que deseas borrar TODO el historial de pruebas? Esta acción es irreversible.")) {
        const { error } = await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        if (error) alert("Error: " + error.message);
        else {
            alert("Historial limpiado correctamente.");
            loadExpenseHistory();
        }
    }
}

function showExpenseDetail(ex) {
    const container = document.getElementById('expense-modal-container');
    const details = ex.details || {};
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 fade-in';
    modal.innerHTML = `
        <div class="bg-gray-50 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white scale-in">
            <div class="p-8">
                <div class="flex justify-between items-start mb-8">
                    <div>
                        <h2 class="text-3xl font-black text-gray-900 tracking-tight">Detalle de Gasto</h2>
                        <p class="text-gray-500 font-medium">${new Date(ex.created_at).toLocaleString('es-MX')}</p>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="bg-white p-3 rounded-full shadow-sm hover:bg-gray-100 transition">
                        <i class="fas fa-times text-gray-400"></i>
                    </button>
                </div>

                <!-- Cabecera Principal -->
                <div class="grid grid-cols-2 gap-6 mb-8">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p class="text-[10px] font-black text-blue-500 uppercase mb-1">Operador</p>
                        <p class="text-xl font-bold text-gray-800">${details.opName || '---'}</p>
                    </div>
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p class="text-[10px] font-black text-orange-500 uppercase mb-1">Unidad</p>
                        <p class="text-xl font-bold text-gray-800 font-mono">${details.unitEco || '---'}</p>
                    </div>
                </div>

                <!-- Desglose de Gastos -->
                <div class="space-y-6">
                    <div class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="text-xs font-black text-gray-400 uppercase mb-4 tracking-widest">Desglose de Conceptos</h4>
                        <div class="space-y-3">
                            <div class="flex justify-between text-sm py-2 border-b border-gray-50">
                                <span class="text-gray-600 font-medium">Kilometraje (${details.km}km)</span>
                                <span class="font-bold text-gray-800">${formatCurrency(details.totalFood || 0)}</span>
                            </div>
                            <div class="flex justify-between text-sm py-2 border-b border-gray-50">
                                <span class="text-gray-600 font-medium">Maniobras (${details.units}uds)</span>
                                <span class="font-bold text-gray-800">${formatCurrency(details.totalManeuver || 0)}</span>
                            </div>
                            
                            <!-- Gastos Fijos -->
                            <div class="pt-4 space-y-2">
                                ${Object.keys(details).filter(k => !['km', 'units', 'opName', 'unitEco', 'totalFood', 'totalManeuver', 'grandTotal', 'balance', 'balance_obs', 'trip_type', 'maintenance_obs', 'other_obs', 'date'].includes(k) && typeof details[k] === 'number' && details[k] > 0).map(k => `
                                    <div class="flex justify-between text-sm py-1">
                                        <span class="text-gray-500 capitalize">${k.replace('exp-', '')}</span>
                                        <span class="font-bold text-gray-800">${formatCurrency(details[k])}</span>
                                    </div>
                                `).join('')}
                            </div>

                            ${details.balance !== 0 ? `
                                <div class="bg-red-50 p-4 rounded-xl mt-4 border border-red-100">
                                    <div class="flex justify-between font-bold text-red-700">
                                        <span>Saldo Pendiente</span>
                                        <span>${formatCurrency(details.balance)}</span>
                                    </div>
                                    ${details.balance_obs ? `<p class="text-[10px] text-red-500 mt-1 italic">${details.balance_obs}</p>` : ''}
                                </div>
                            ` : ''}
                        </div>

                        <div class="mt-8 pt-6 border-t border-dashed border-gray-200 flex justify-between items-center">
                            <span class="text-lg font-black text-gray-900 uppercase">Total Depositado</span>
                            <span class="text-3xl font-black text-green-600">${formatCurrency(ex.total_amount)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    container.appendChild(modal);
}
