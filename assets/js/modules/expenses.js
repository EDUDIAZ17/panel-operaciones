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
                            <div><label class="block text-xs font-bold text-gray-700 mb-1">Casetas</label><input type="number" id="exp-tolls" class="w-full border border-gray-300 p-2 rounded fixed-cost focus:border-indigo-500 outline-none" placeholder="$0"></div>
                            <div><label class="block text-xs font-bold text-gray-700 mb-1">Combustible</label><input type="number" id="exp-fuel" class="w-full border border-gray-300 p-2 rounded fixed-cost focus:border-indigo-500 outline-none" placeholder="$0"></div>
                            <div><label class="block text-xs font-bold text-gray-700 mb-1">Guía / Tránsito</label><input type="number" id="exp-guide" class="w-full border border-gray-300 p-2 rounded fixed-cost focus:border-indigo-500 outline-none" placeholder="$0"></div>
                            <div><label class="block text-xs font-bold text-gray-700 mb-1">Sanitarias</label><input type="number" id="exp-sanitary" class="w-full border border-gray-300 p-2 rounded fixed-cost focus:border-indigo-500 outline-none" placeholder="$0"></div>
                            <div><label class="block text-xs font-bold text-gray-700 mb-1">Báscula</label><input type="number" id="exp-scale" class="w-full border border-gray-300 p-2 rounded fixed-cost focus:border-indigo-500 outline-none" placeholder="$0"></div>
                            <div><label class="block text-xs font-bold text-gray-700 mb-1">Pensiones</label><input type="number" id="exp-pensions" class="w-full border border-gray-300 p-2 rounded fixed-cost focus:border-indigo-500 outline-none" placeholder="$0"></div>
                            <div><label class="block text-xs font-bold text-gray-700 mb-1">Estadías</label><input type="number" id="exp-stays" class="w-full border border-gray-300 p-2 rounded fixed-cost focus:border-indigo-500 outline-none" placeholder="$0"></div>
                            
                            <div class="col-span-1">
                                <label class="block text-xs font-bold text-gray-700 mb-1">Mantenimiento</label>
                                <input type="number" id="exp-maintenance" class="w-full border border-gray-300 p-2 rounded fixed-cost focus:border-indigo-500 outline-none" placeholder="$0">
                                <textarea id="exp-maintenance-obs" class="w-full border border-gray-300 mt-1 p-2 text-[10px] rounded focus:border-indigo-500 outline-none text-gray-700" placeholder="Observaciones Manto."></textarea>
                            </div>
                            
                            <div class="col-span-1">
                                <label class="block text-xs font-bold text-gray-700 mb-1">Otros</label>
                                <input type="number" id="exp-other" class="w-full border border-gray-300 p-2 rounded fixed-cost focus:border-indigo-500 outline-none" placeholder="$0">
                                <textarea id="exp-other-obs" class="w-full border border-gray-300 mt-1 p-2 text-[10px] rounded focus:border-indigo-500 outline-none text-gray-700" placeholder="Observaciones Otros"></textarea>
                            </div>
                        </div>
                    </div>

                    <div class="border-t pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                         <div class="w-full md:w-1/2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Saldo Pendiente Anterior <span class="text-xs text-gray-400 font-normal ml-1">(Click en +/- para móvil)</span></label>
                            <div class="flex gap-2 relative">
                                <div class="relative w-1/3 flex shadow-sm">
                                    <button type="button" id="btn-toggle-sign" class="bg-red-100 text-red-700 px-3 border border-r-0 border-red-200 rounded-l-md font-bold focus:outline-none focus:ring-2 focus:ring-red-500 hover:bg-red-200 transition" title="Cambiar signo (Positivo/Negativo)">
                                        <i class="fas fa-exchange-alt"></i> +/-
                                    </button>
                                    <input type="number" step="any" id="exp-balance" class="flex-1 min-w-0 block w-full border border-red-200 bg-red-50 rounded-r-md p-2 focus:border-red-500 outline-none transition" placeholder="0.00">
                                </div>
                                <textarea id="exp-balance-obs" class="flex-1 border p-2 text-xs rounded-md focus:border-red-500 outline-none" placeholder="¿Por qué es este saldo? (Obl. si es negativo)"></textarea>
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
            <div class="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6 md:p-8 mt-6 relative">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
                    <h3 class="text-xl font-bold text-gray-800"><i class="fas fa-history text-indigo-500 mr-2"></i> Historial Reciente</h3>
                    <div class="flex flex-wrap gap-2">
                        <button id="btn-export-excel" class="text-xs bg-green-50 text-green-700 hover:bg-green-100 font-bold border border-green-300 px-4 py-2 rounded-lg transition hidden flex items-center shadow-sm">
                            <i class="fas fa-file-excel mr-2"></i> EXCEL (TODOS)
                        </button>
                        <button id="btn-clear-history" class="text-xs bg-red-50 text-red-600 hover:bg-red-100 font-bold border border-red-200 px-4 py-2 rounded-lg transition flex items-center shadow-sm">
                            <i class="fas fa-trash-alt mr-2"></i> LIMPIAR
                        </button>
                    </div>
                </div>

                <!-- Buscador / Filtro Principal -->
                <div class="bg-gray-50 p-4 rounded-xl border mb-6 shadow-inner">
                    <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2"><i class="fas fa-search"></i> Búsqueda Rápida Multisectorial</label>
                    <input type="text" id="expenses-filter" class="w-full p-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition shadow-sm" placeholder="🔍 Buscar por nombre de ruta, operador, número de unidad o cantidad total...">
                    <p class="text-[10px] text-gray-400 mt-2 px-1">Escribe cualquier texto y la tabla se filtrará en tiempo real.</p>
                </div>

                <!-- Tabla de Resultados -->
                <div class="border rounded-xl bg-white shadow-sm overflow-hidden">
                    <div class="max-h-[500px] overflow-x-auto overflow-y-auto custom-scrollbar">
                        <table class="w-full text-left text-sm whitespace-nowrap">
                            <thead class="bg-gray-100 border-b sticky top-0 z-10 shadow-sm text-xs uppercase tracking-wider">
                                <tr class="text-gray-600 font-bold">
                                    <th class="p-4"><i class="far fa-calendar-alt mr-1"></i> Fecha</th>
                                    <th class="p-4"><i class="fas fa-truck mr-1"></i> Unidad</th>
                                    <th class="p-4"><i class="fas fa-user-tie mr-1"></i> Operador</th>
                                    <th class="p-4"><i class="fas fa-route mr-1"></i> Ruta</th>
                                    <th class="p-4 text-right"><i class="fas fa-money-bill-wave mr-1"></i> Total</th>
                                </tr>
                            </thead>
                            <tbody id="expenses-history-body" class="divide-y divide-gray-50">
                                <tr><td colspan="5" class="p-6 text-center text-gray-400 font-medium">Cargando historial de gastos...</td></tr>
                            </tbody>
                        </table>
                    </div>
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
    
    // Mobile +/- toggle for exp-balance
    document.getElementById('btn-toggle-sign').addEventListener('click', () => {
        const inp = document.getElementById('exp-balance');
        let val = parseFloat(inp.value) || 0;
        if (val !== 0) {
            inp.value = (val * -1);
            calculate(); // Update totals
        } else {
            Swal.fire({
                toast: true,
                position: 'top',
                icon: 'info',
                title: 'Escriba primero la cantidad en "Saldo Pendiente" y luego presione +/- para cambiar su signo a negativo.',
                showConfirmButton: false,
                timer: 4000
            });
        }
    });

    document.getElementById('btn-ai-report').addEventListener('click', generateAIReport);
    document.getElementById('btn-clear-history').addEventListener('click', clearExpenseHistory);
    document.getElementById('expenses-filter').addEventListener('keyup', filterExpenseHistory);
    
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const userRole = currentUser?.role ? currentUser.role.toLowerCase().trim() : '';
    
    if (currentUser && ['admin', 'torre_control', 'contabilidad', 'direccion_general', 'mantenimiento', 'manto', 'maintenance'].includes(userRole)) {
        document.getElementById('btn-export-excel').classList.remove('hidden');
        document.getElementById('btn-export-excel').addEventListener('click', window.exportExcelExpenses);
    }
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
        .limit(1000); // Increased limit to show "all" with scrollbar without completely crashing on massive datasets

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-red-500">Error: ${error.message}</td></tr>`;
        return;
    }

    window.allExpensesHistory = expenses || [];
    renderExpenseHistory(window.allExpensesHistory);
}

function filterExpenseHistory() {
    const term = document.getElementById('expenses-filter').value.toLowerCase();
    if (!term) {
        renderExpenseHistory(window.allExpensesHistory);
        return;
    }

    const filtered = window.allExpensesHistory.filter(ex => {
        const opName = (ex.operators?.name || ex.details?.opName || '').toLowerCase();
        const unitEco = (ex.units?.economic_number || ex.details?.unitEco || '').toLowerCase();
        const route = (ex.route || '').toLowerCase();
        const total = (ex.total_amount || '').toString();
        const dateStr = new Date(ex.created_at).toLocaleDateString('es-MX').toLowerCase();
        
        return opName.includes(term) || unitEco.includes(term) || route.includes(term) || total.includes(term) || dateStr.includes(term);
    });

    renderExpenseHistory(filtered);
}

function renderExpenseHistory(expenses) {
    const tbody = document.getElementById('expenses-history-body');
    if (expenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">No se encontraron resultados</td></tr>`;
        return;
    }

    tbody.innerHTML = expenses.map(ex => {
        const opName = ex.operators?.name || ex.details?.opName || 'Desc.';
        const unitEco = ex.units?.economic_number || ex.details?.unitEco || '---';

        return `
            <tr class="border-b hover:bg-indigo-50 cursor-pointer transition expense-row group" data-id="${ex.id}">
                <td class="p-4 text-gray-500 font-medium text-xs whitespace-nowrap">${new Date(ex.created_at).toLocaleDateString('es-MX', {day:'2-digit', month:'short', year:'numeric'})}</td>
                <td class="p-4">
                    <span class="bg-gray-100 text-gray-700 font-mono font-bold px-2 py-1 rounded shadow-sm text-xs group-hover:bg-indigo-100 group-hover:text-indigo-800 transition-colors">${unitEco}</span>
                </td>
                <td class="p-4 font-bold text-gray-800 text-xs">${opName}</td>
                <td class="p-4 text-gray-600 truncate max-w-[150px] md:max-w-xs text-xs" title="${ex.route}">${ex.route}</td>
                <td class="p-4 text-right font-mono text-green-600 font-bold text-base md:text-lg whitespace-nowrap">${formatCurrency(ex.total_amount)}</td>
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
    // Truco para iOS: abrir la ventana síncronamente en el momento del click, antes de cualquier await.
    const waWindow = window.open('', '_blank');

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

    const currentUserParams = JSON.parse(sessionStorage.getItem('currentUser')) || {};
    const recordedBy = currentUserParams.name || 'Sistema';

    // Check for Duplicates (1 hour window)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    
    // Omit wait if it's not needed, but here we query Supabase
    const { data: duplicates } = await supabase.from('expenses')
        .select('id, created_at')
        .eq('operator_id', opSelect.value)
        .eq('unit_id', unitSelect.value)
        .eq('route', route)
        .eq('total_amount', calcs.grandTotal)
        .gte('created_at', oneHourAgo);

    if (duplicates && duplicates.length > 0) {
        waWindow.close(); // Close the preemptive window we opened
        const result = await Swal.fire({
            title: '¡Posible Gasto Duplicado!',
            html: `Se ha detectado un gasto idéntico registrado en la última hora por <b>${formatCurrency(calcs.grandTotal)}</b>.<br><br>¿Deseas registrar este duplicado o prefieres ir al historial para reenviar el de hace rato?`,
            icon: 'warning',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Sí, Duplicarlo',
            denyButtonText: 'Ir al Historial',
            cancelButtonText: 'Cancelar'
        });

        if (result.isDenied) {
            document.getElementById('view-expenses').scrollIntoView({ behavior: 'smooth' });
            return;
        } else if (!result.isConfirmed) {
            return; // Cancelled
        }
        // If confirmed, continue with saving and we need a new window for WA
        window.open('', '_blank'); // Actually, since it's async now, browser might block this.
        // Let's just alert that it will open directly, or we handle it gracefully later.
    }

    let currentWaWindow = duplicates && duplicates.length > 0 ? null : waWindow; // If duplicated, we closed the sync window, so we'll have to rely on standard popup (might be blocked on iOS but user consented)

    // Save to DB
    const { error } = await supabase.from('expenses').insert({
        operator_id: opSelect.value,
        unit_id: unitSelect.value,
        route,
        total_amount: calcs.grandTotal,
        details: { ...calcs, date, unitEco, opName, recordedBy },
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

    window.shareToWhatsApp(msg, currentWaWindow);
    
    // Reset Form
    document.querySelectorAll('#expense-form input[type="number"], #expense-form textarea').forEach(inp => inp.value = '');
    document.getElementById('exp-route').value = '';
    document.getElementById('exp-date').valueAsDate = new Date();
    document.getElementById('res-food').innerText = '$0.00';
    document.getElementById('res-maneuver').innerText = '$0.00';
    document.getElementById('final-total').innerText = '$0.00';
    document.getElementById('balance-warning').classList.add('hidden');
}

window.shareToWhatsApp = async (msg, preOpenedWindow = null) => {
    // Intentar copiar al portapapeles primero (crucial para iPhone)
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(msg);
        }
    } catch(e) { console.warn("Clipboard api failed", e); }
    
    // Intentar abrir con el esquema de app nativo primero
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
        if (preOpenedWindow) preOpenedWindow.close(); // No lo necesitamos en móvil nativo directo
        window.location.href = `whatsapp://send?text=${encodeURIComponent(msg)}`;
        // Fallback porsi no tiene whatsapp instalado
        setTimeout(() => {
            window.location.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        }, 1200);
    } else {
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
        if (preOpenedWindow) {
            preOpenedWindow.location.href = url;
        } else {
            window.open(url, '_blank');
        }
    }
};

window.exportExcelExpenses = async () => {
    Swal.fire({
        title: 'Generando Excel...',
        text: 'Obteniendo historial completo, por favor espera.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const { data: expenses, error } = await supabase
            .from('expenses')
            .select('id, created_at, operator_id, unit_id, route, total_amount, details, operators(name), units(economic_number)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!expenses || expenses.length === 0) {
            Swal.fire('Atención', 'No hay datos de gastos para exportar.', 'info');
            return;
        }

        // Prepare data for Excel
        const excelData = expenses.map(ex => {
            const date = new Date(ex.created_at).toLocaleDateString('es-MX', {day:'2-digit', month:'2-digit', year:'numeric'});
            const det = ex.details || {};
            
            return {
                'ID Gasto': ex.id,
                'Fecha': det.date || date,
                'Registrado Por': det.recordedBy || 'N/A',
                'Operador': ex.operators?.name || det.opName || '---',
                'Unidad': ex.units?.economic_number || det.unitEco || '---',
                'Ruta': ex.route,
                'Trayecto': det.trip_type || '',
                'Kilómetros': det.km || 0,
                'Monto Alimentos': det.totalFood || 0,
                'Unidades Maniobra': det.units || 0,
                'Monto Maniobras': det.totalManeuver || 0,
                'Casetas': det.tolls || 0,
                'Combustible': det.fuel || 0,
                'Guía/Tránsito': det.guide || 0,
                'Sanitarias': det.sanitary || 0,
                'Báscula': det.scale || 0,
                'Pensiones': det.pensions || 0,
                'Estadías': det.stays || 0,
                'Mantenimiento': det.maintenance || 0,
                'Obs. Mantenimiento': det.maintenance_obs || '',
                'Otros Gastos': det.other || 0,
                'Obs. Otros': det.other_obs || '',
                'Saldo Anterior': det.balance || 0,
                'Obs. Saldo': det.balance_obs || '',
                'Total Depósito': ex.total_amount
            };
        });

        // Create a new workbook and add the worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Auto-size columns slightly
        const colWidths = [
            { wch: 38 }, // ID
            { wch: 12 }, // Fecha
            { wch: 25 }, // Registrado
            { wch: 30 }, // Operador
            { wch: 15 }, // Unidad
            { wch: 30 }, // Ruta
            { wch: 15 }, // Trayecto
            { wch: 12 }, { wch: 15 }, // KM/Alimentos
            { wch: 12 }, { wch: 15 }, // Unidades/Maniobras
            { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, // Fijos
            { wch: 15 }, { wch: 30 }, // Manto
            { wch: 15 }, { wch: 30 }, // Otros
            { wch: 15 }, { wch: 30 }, // Saldo
            { wch: 15 }  // Total
        ];
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, "Gastos Alexa");
        
        // Generate Excel file and trigger download
        const fileName = `Reporte_Gastos_Transportes_Alexa_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        Swal.close();

    } catch (err) {
        console.error("Error exporting to Excel:", err);
        Swal.fire('Error', 'Hubo un problema al generar el Excel', 'error');
    }
};

window.rebuildWAMessage = (details, totalAmount, dateStr) => {
    let msg = `*REPORTE DE GASTOS - LOGISTICS*\n\n`;
    msg += `*Operador:* ${details.opName || '---'}\n`;
    msg += `*Unidad:* ${details.unitEco || '---'}\n`;
    msg += `*Trayecto:* ${details.trip_type || 'N/A'}\n`;
    msg += `*Fecha:* ${details.date || dateStr}\n`;
    msg += `*Ruta:* ${details.route || '---'}\n`;
    msg += `----------------------------------\n`;
    
    msg += `*CALCULOS VARIABLES:*\n`;
    msg += `- Alimentos: ${details.km || 0}km x $0.45 = *$${formatCurrency(details.totalFood || 0).replace('$', '')}*\n`;
    msg += `- Maniobras: ${details.units || 0}uds x $45 = *$${formatCurrency(details.totalManeuver || 0).replace('$', '')}*\n\n`;
    
    msg += `*GASTOS FIJOS (DESGLOSE):*\n`;
    const labelMapping = {
        tolls: 'Casetas',
        fuel: 'Combustible',
        guide: 'Guía / Tránsito',
        sanitary: 'Sanitarias',
        scale: 'Báscula',
        pensions: 'Pensiones',
        stays: 'Estadías',
        maintenance: 'Mantenimiento',
        other: 'Otros'
    };

    ['tolls', 'fuel', 'guide', 'sanitary', 'scale', 'pensions', 'stays', 'maintenance', 'other'].forEach(k => {
        if (details[k] > 0) {
            msg += `- ${labelMapping[k]}: *$${details[k].toLocaleString('es-MX', {minimumFractionDigits: 2})}*\n`;
            if (k === 'maintenance' && details.maintenance_obs) msg += `  (Obs: ${details.maintenance_obs})\n`;
            if (k === 'other' && details.other_obs) msg += `  (Obs: ${details.other_obs})\n`;
        }
    });
    
    if (details.balance !== 0 && details.balance !== undefined) {
        msg += `\n*SALDO PENDIENTE ANTERIOR:* $${(details.balance || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}\n`;
        if (details.balance < 0) msg += `*EL OPERADOR DEBE A LA EMPRESA*\n`;
        if (details.balance_obs) msg += `Motivo: ${details.balance_obs}\n`;
    }

    msg += `----------------------------------\n`;
    msg += `*TOTAL A DEPOSITAR:*\n`;
    msg += `*${formatCurrency(totalAmount)}*\n`;
    msg += `----------------------------------`;
    return msg;
};

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
    
    const waMsgText = rebuildWAMessage(details, ex.total_amount, new Date(ex.created_at).toLocaleDateString());
    window.currentWAMsg = waMsgText; // Guardar temporalmente para el boton de copiar

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 fade-in';
    modal.innerHTML = `
        <div class="bg-gray-50 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white scale-in">
            <div class="p-8">
                <div class="flex justify-between items-start mb-8">
                    <div>
                        <h2 class="text-3xl font-black text-gray-900 tracking-tight">Detalle de Gasto</h2>
                        <p class="text-gray-500 font-medium">${new Date(ex.created_at).toLocaleString('es-MX')} <span class="text-gray-400 text-xs ml-2">Registrado por: <b>${details.recordedBy || 'Sistema'}</b></span></p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="window.deleteSingleExpense('${ex.id}')" class="bg-red-50 text-red-600 px-4 py-2 rounded-full shadow-sm hover:bg-red-100 transition font-bold text-sm border border-red-200">
                            <i class="fas fa-trash-alt mr-1"></i> Borrar
                        </button>
                        <button onclick="this.closest('.fixed').remove()" class="bg-white p-3 rounded-full shadow-sm hover:bg-gray-100 transition">
                            <i class="fas fa-times text-gray-400"></i>
                        </button>
                    </div>
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
                        
                        <div class="mt-8 flex gap-3 justify-end">
                            <button onclick="navigator.clipboard.writeText(window.currentWAMsg).then(()=>alert('Copiado al portapapeles'))" class="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition flex items-center gap-2">
                                <i class="fas fa-copy"></i> Copiar Texto
                            </button>
                            <button onclick="window.shareToWhatsApp(window.currentWAMsg)" class="bg-[#25D366] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#1ebe5d] transition shadow-lg shadow-[#25D366]/30 flex items-center gap-2">
                                <i class="fab fa-whatsapp text-lg"></i> Enviar a WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    container.appendChild(modal);
}

// Hook Global para borrar gastos individualmente
window.deleteSingleExpense = async (id) => {
    const password = prompt("Ingresa la contraseña para borrar este registro:");
    if (password !== 'edu17') {
        alert("Contraseña incorrecta.");
        return;
    }

    if (confirm("¿Estás seguro de querer borrar este gasto en específico? Esta acción es irreversible.")) {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) {
            alert("Error al borrar el gasto: " + error.message);
        } else {
            alert("Gasto borrado correctamente.");
            document.getElementById('expense-modal-container').innerHTML = ''; // Cierra el modal
            // Usamos un pequeño delay o recargamos para que se actualice la lista
            setTimeout(() => {
                document.getElementById('nav-expenses').click();
            }, 300);
        }
    }
};
