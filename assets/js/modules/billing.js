// =====================================================================
// modules/billing.js
// Cuentas por Cobrar / Cuentas por Pagar (CFDI 4.0)
//
// Este modulo NO habla con Supabase directamente: las tablas fiscales
// estan cerradas al anon key. Todo pasa por la Edge Function
// billing-api, que exige una sesion fiscal propia (el usuario
// desbloquea el modulo con su misma contrasena).
// =====================================================================
import {
    billingCall, billingLogin, getBillingToken, setBillingToken,
    parseCFDI, generarPDFFactura, money, fechaCorta
} from '../services/cfdi.js';

let estado = {
    tab: 'resumen',
    settings: null,
    clientes: [],
    aging: [],
    facturas: [],
    bills: [],
    puedeEditar: false,
    cargado: false
};

let contenedor = null;

// ---------------------------------------------------------------------
// Entrada del modulo
// ---------------------------------------------------------------------
export function renderBilling(container) {
    contenedor = container;
    if (getBillingToken()) {
        pintarShell();
        cargarDatos();
    } else {
        pintarDesbloqueo();
    }
}

// ---------------------------------------------------------------------
// Pantalla de desbloqueo (sesion fiscal)
// ---------------------------------------------------------------------
function pintarDesbloqueo(mensajeError = '') {
    const usuario = JSON.parse(sessionStorage.getItem('currentUser') || '{}');

    contenedor.innerHTML = `
        <div class="h-full flex items-center justify-center bg-slate-100 p-6 fade-in">
            <div class="w-full max-w-md bg-white border border-slate-300 rounded-2xl shadow-xl p-8">
                <div class="text-center mb-6">
                    <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-xl shadow-lg shadow-emerald-200 mb-3">
                        <i class="fas fa-lock"></i>
                    </div>
                    <h3 class="text-lg font-black text-slate-900">Modulo fiscal protegido</h3>
                    <p class="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                        Cuentas por cobrar y pagar guardan datos fiscales de terceros.
                        Confirma tu contrasena para abrir una sesion fiscal de 8 horas.
                    </p>
                </div>

                <div class="space-y-3">
                    <div>
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Usuario</label>
                        <input id="bill-email" type="email" value="${usuario.email || ''}"
                            class="w-full mt-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none">
                    </div>
                    <div>
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contrasena</label>
                        <input id="bill-pass" type="password" autocomplete="current-password"
                            class="w-full mt-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none">
                    </div>
                    ${mensajeError ? `<p class="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">${mensajeError}</p>` : ''}
                    <button id="bill-unlock" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-200">
                        <i class="fas fa-unlock mr-2"></i> Abrir sesion fiscal
                    </button>
                </div>
            </div>
        </div>
    `;

    const intentar = async () => {
        const btn = document.getElementById('bill-unlock');
        const email = document.getElementById('bill-email').value.trim();
        const pass = document.getElementById('bill-pass').value;
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner w-4 h-4 inline-block border-t-white"></div>';
        try {
            await billingLogin(email, pass);
            pintarShell();
            cargarDatos();
        } catch (err) {
            pintarDesbloqueo(err.message);
        }
    };

    document.getElementById('bill-unlock').addEventListener('click', intentar);
    document.getElementById('bill-pass').addEventListener('keydown', e => {
        if (e.key === 'Enter') intentar();
    });
}

// ---------------------------------------------------------------------
// Shell con tabs
// ---------------------------------------------------------------------
const TABS = [
    { id: 'resumen', label: 'Resumen', icon: 'fa-chart-pie' },
    { id: 'cxc', label: 'Por Cobrar', icon: 'fa-file-invoice-dollar' },
    { id: 'cxp', label: 'Por Pagar', icon: 'fa-receipt' },
    { id: 'clientes', label: 'Clientes', icon: 'fa-address-book' },
    { id: 'importar', label: 'Importar XML', icon: 'fa-file-import' },
    { id: 'config', label: 'Configuracion', icon: 'fa-gear' }
];

function pintarShell() {
    contenedor.innerHTML = `
        <div class="h-full flex flex-col bg-slate-100 fade-in text-[13px] text-slate-900 overflow-hidden">
            <div class="bg-white border-b border-slate-200 px-4 pt-3 shrink-0">
                <div class="flex gap-1 overflow-x-auto custom-scrollbar">
                    ${TABS.map(t => `
                        <button data-tab="${t.id}" class="bill-tab px-4 py-2.5 rounded-t-lg text-[10px] font-black uppercase tracking-tighter transition-all whitespace-nowrap border-b-2 ${
                            t.id === estado.tab
                                ? 'text-emerald-700 border-emerald-600 bg-emerald-50/60'
                                : 'text-slate-400 border-transparent hover:text-slate-600'
                        }">
                            <i class="fas ${t.icon} mr-1.5"></i>${t.label}
                        </button>
                    `).join('')}
                </div>
            </div>
            <div id="bill-body" class="flex-1 overflow-y-auto custom-scrollbar p-4"></div>
        </div>
    `;

    contenedor.querySelectorAll('.bill-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            estado.tab = btn.dataset.tab;
            pintarShell();
            pintarTab();
        });
    });

    pintarTab();
}

function cuerpo() {
    return document.getElementById('bill-body');
}

function cargando(texto = 'Cargando...') {
    cuerpo().innerHTML = `
        <div class="h-full flex flex-col items-center justify-center py-20 text-slate-400">
            <div class="spinner mb-3 border-t-emerald-500 w-8 h-8"></div>
            <p class="text-[11px] font-black uppercase tracking-tighter">${texto}</p>
        </div>`;
}

async function cargarDatos() {
    cargando('Abriendo modulo fiscal...');
    try {
        const data = await billingCall('bootstrap');
        estado.settings = data.settings;
        estado.clientes = data.clientes;
        estado.aging = data.aging;
        estado.puedeEditar = data.session.puede_editar;
        estado.cargado = true;
        pintarTab();
    } catch (err) {
        if (err.status === 401) {
            setBillingToken(null);
            pintarDesbloqueo(err.message);
        } else {
            error(err.message);
        }
    }
}

function error(msg) {
    cuerpo().innerHTML = `
        <div class="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
            <i class="fas fa-triangle-exclamation mr-2"></i>${msg}
        </div>`;
}

function pintarTab() {
    if (!estado.cargado) return;
    switch (estado.tab) {
        case 'resumen': return tabResumen();
        case 'cxc': return tabCxC();
        case 'cxp': return tabCxP();
        case 'clientes': return tabClientes();
        case 'importar': return tabImportar();
        case 'config': return tabConfig();
    }
}

// ---------------------------------------------------------------------
// Resumen: KPIs + antiguedad de saldos
// ---------------------------------------------------------------------
const CUBETAS = [
    { id: 'por_vencer', label: 'Por vencer', color: 'bg-emerald-500' },
    { id: 'v_1_30', label: '1 a 30 dias', color: 'bg-amber-400' },
    { id: 'v_31_60', label: '31 a 60 dias', color: 'bg-orange-500' },
    { id: 'v_61_90', label: '61 a 90 dias', color: 'bg-red-500' },
    { id: 'v_mas_90', label: 'Mas de 90 dias', color: 'bg-red-800' }
];

function tabResumen() {
    const abiertas = estado.aging.filter(a => Number(a.saldo) > 0);
    const totalCobrar = abiertas.reduce((s, a) => s + Number(a.saldo), 0);
    const vencido = abiertas
        .filter(a => a.cubeta !== 'por_vencer' && a.cubeta !== 'sin_vencimiento')
        .reduce((s, a) => s + Number(a.saldo), 0);

    const porCubeta = CUBETAS.map(c => ({
        ...c,
        monto: abiertas.filter(a => a.cubeta === c.id).reduce((s, a) => s + Number(a.saldo), 0),
        n: abiertas.filter(a => a.cubeta === c.id).length
    }));
    const maxCubeta = Math.max(1, ...porCubeta.map(c => c.monto));

    const porCliente = {};
    abiertas.forEach(a => {
        const k = a.razon_social || a.rfc || 'Sin cliente';
        porCliente[k] = (porCliente[k] || 0) + Number(a.saldo);
    });
    const topClientes = Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 8);

    cuerpo().innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            ${kpi('Total por cobrar', money(totalCobrar), `${abiertas.length} facturas abiertas`, 'fa-hand-holding-dollar', 'emerald')}
            ${kpi('Vencido', money(vencido), totalCobrar > 0 ? `${Math.round(vencido / totalCobrar * 100)}% de la cartera` : 'Sin cartera', 'fa-triangle-exclamation', 'red')}
            ${kpi('Clientes con saldo', String(Object.keys(porCliente).length), `${estado.clientes.length} clientes registrados`, 'fa-address-book', 'indigo')}
            ${kpi('Folio actual', `${estado.settings?.serie || ''}${estado.settings?.folio_actual || ''}`, `PAC: ${estado.settings?.pac_proveedor || 'sin configurar'}`, 'fa-hashtag', 'slate')}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div class="bg-white border border-slate-300 rounded-xl shadow-sm p-4">
                <h3 class="text-xs font-black text-slate-800 uppercase tracking-tighter mb-4">
                    <i class="fas fa-layer-group text-emerald-600 mr-2"></i>Antiguedad de saldos
                </h3>
                <div class="space-y-3">
                    ${porCubeta.map(c => `
                        <div>
                            <div class="flex justify-between text-[11px] font-bold mb-1">
                                <span class="text-slate-600">${c.label} <span class="text-slate-400">(${c.n})</span></span>
                                <span class="text-slate-900 font-black">${money(c.monto)}</span>
                            </div>
                            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div class="${c.color} h-full rounded-full transition-all" style="width:${(c.monto / maxCubeta * 100).toFixed(1)}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="bg-white border border-slate-300 rounded-xl shadow-sm p-4">
                <h3 class="text-xs font-black text-slate-800 uppercase tracking-tighter mb-4">
                    <i class="fas fa-ranking-star text-indigo-600 mr-2"></i>Saldo por cliente
                </h3>
                ${topClientes.length ? `
                    <div class="space-y-2">
                        ${topClientes.map(([nombre, monto]) => `
                            <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                                <span class="text-[11px] font-bold text-slate-700 truncate pr-3">${nombre}</span>
                                <span class="text-[11px] font-black text-slate-900 shrink-0">${money(monto)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : vacio('Aun no hay facturas cargadas. Usa la pestana Importar XML.')}
            </div>
        </div>
    `;
}

function kpi(titulo, valor, pie, icono, color) {
    return `
        <div class="bg-white border border-slate-300 rounded-xl shadow-sm p-4">
            <div class="flex items-start justify-between">
                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">${titulo}</p>
                <i class="fas ${icono} text-${color}-500"></i>
            </div>
            <p class="text-2xl font-black text-slate-900 mt-2">${valor}</p>
            <p class="text-[10px] text-slate-400 font-bold mt-1">${pie}</p>
        </div>`;
}

function vacio(msg) {
    return `<div class="py-10 text-center text-slate-400 text-[11px] font-bold">${msg}</div>`;
}

// ---------------------------------------------------------------------
// Cuentas por cobrar
// ---------------------------------------------------------------------
async function tabCxC() {
    cargando('Cargando facturas emitidas...');
    try {
        const { facturas } = await billingCall('invoices_list', {});
        estado.facturas = facturas || [];
    } catch (err) {
        return error(err.message);
    }

    const repPendientes = estado.facturas
        .flatMap(f => f.invoice_payments || [])
        .filter(p => p.rep_status === 'pendiente').length;

    cuerpo().innerHTML = `
        ${repPendientes ? `
            <div class="mb-3 bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-3">
                <i class="fas fa-triangle-exclamation text-amber-600 mt-0.5"></i>
                <div class="text-[11px] text-amber-900 font-medium leading-relaxed">
                    <b>${repPendientes} cobro(s) sin Complemento de Pago.</b>
                    Tus facturas son PPD: el SAT exige timbrar el REP a mas tardar el dia 5 del mes siguiente al cobro.
                    El timbrado llega en la Fase 2, por ahora quedan marcados aqui.
                </div>
            </div>` : ''}

        <div class="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 class="text-xs font-black text-slate-800 uppercase tracking-tighter">
                    <i class="fas fa-file-invoice-dollar text-emerald-600 mr-2"></i>Facturas emitidas (${estado.facturas.length})
                </h3>
                <input id="cxc-buscar" type="text" placeholder="Buscar cliente, folio o UUID..."
                    class="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] font-medium w-64 outline-none focus:ring-2 focus:ring-emerald-500">
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-[11px]">
                    <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-tighter text-[9px]">
                        <tr>
                            <th class="px-3 py-2 text-left">Folio</th>
                            <th class="px-3 py-2 text-left">Cliente</th>
                            <th class="px-3 py-2 text-left">Fecha</th>
                            <th class="px-3 py-2 text-left">Vence</th>
                            <th class="px-3 py-2 text-right">Total</th>
                            <th class="px-3 py-2 text-right">Saldo</th>
                            <th class="px-3 py-2 text-center">Estado</th>
                            <th class="px-3 py-2 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="cxc-tbody" class="divide-y divide-slate-100"></tbody>
                </table>
            </div>
        </div>
    `;

    const pintarFilas = (filtro = '') => {
        const f = filtro.toLowerCase();
        const lista = estado.facturas.filter(x =>
            !f || `${x.serie}${x.folio} ${x.billing_clients?.razon_social || ''} ${x.uuid || ''}`.toLowerCase().includes(f)
        );

        document.getElementById('cxc-tbody').innerHTML = lista.length ? lista.map(x => {
            const vencida = x.saldo > 0 && x.fecha_vencimiento && new Date(x.fecha_vencimiento) < new Date();
            return `
            <tr class="hover:bg-slate-50">
                <td class="px-3 py-2 font-black text-slate-800">${x.serie || ''}${x.folio || ''}</td>
                <td class="px-3 py-2 text-slate-700 max-w-[220px] truncate" title="${x.billing_clients?.razon_social || ''}">
                    ${x.billing_clients?.razon_social || '—'}
                    <span class="block text-[9px] text-slate-400 font-mono">${x.billing_clients?.rfc || ''}</span>
                </td>
                <td class="px-3 py-2 text-slate-500">${fechaCorta(x.fecha)}</td>
                <td class="px-3 py-2 ${vencida ? 'text-red-600 font-black' : 'text-slate-500'}">${fechaCorta(x.fecha_vencimiento)}</td>
                <td class="px-3 py-2 text-right font-bold text-slate-700">${money(x.total)}</td>
                <td class="px-3 py-2 text-right font-black ${x.saldo > 0 ? 'text-slate-900' : 'text-emerald-600'}">${money(x.saldo)}</td>
                <td class="px-3 py-2 text-center">${badgeEstado(x)}</td>
                <td class="px-3 py-2">
                    <div class="flex items-center justify-center gap-1">
                        <button data-pdf="${x.id}" title="PDF" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"><i class="fas fa-file-pdf text-[10px]"></i></button>
                        ${x.xml ? `<button data-xml="${x.id}" title="XML" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"><i class="fas fa-code text-[10px]"></i></button>` : ''}
                        ${estado.puedeEditar && x.saldo > 0 ? `<button data-cobro="${x.id}" title="Registrar cobro" class="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"><i class="fas fa-hand-holding-dollar text-[10px]"></i></button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('') : `<tr><td colspan="8">${vacio('Sin facturas. Importa tus XML en la pestana Importar.')}</td></tr>`;

        document.querySelectorAll('[data-pdf]').forEach(b =>
            b.addEventListener('click', () => descargarPDF(b.dataset.pdf)));
        document.querySelectorAll('[data-xml]').forEach(b =>
            b.addEventListener('click', () => descargarXML(b.dataset.xml)));
        document.querySelectorAll('[data-cobro]').forEach(b =>
            b.addEventListener('click', () => modalCobro(b.dataset.cobro)));
    };

    pintarFilas();
    document.getElementById('cxc-buscar').addEventListener('input', e => pintarFilas(e.target.value));
}

function badgeEstado(x) {
    if (x.status === 'cancelada') return '<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-black">CANCELADA</span>';
    if (x.status === 'borrador') return '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black">BORRADOR</span>';
    if (Number(x.saldo) <= 0) return '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black">PAGADA</span>';
    const parcial = (x.invoice_payments || []).length > 0;
    return `<span class="px-2 py-0.5 rounded-full bg-${parcial ? 'blue' : 'indigo'}-100 text-${parcial ? 'blue' : 'indigo'}-700 text-[9px] font-black">${parcial ? 'PARCIAL' : 'TIMBRADA'}</span>`;
}

function descargarPDF(id) {
    const factura = estado.facturas.find(f => f.id === id);
    if (!factura) return;
    try {
        const doc = generarPDFFactura(factura, estado.settings);
        doc.save(`${factura.serie || 'CFDI'}${factura.folio || ''}.pdf`);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'No se pudo generar el PDF', text: err.message });
    }
}

function descargarXML(id) {
    const factura = estado.facturas.find(f => f.id === id);
    if (!factura?.xml) return;
    const blob = new Blob([factura.xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${factura.serie || 'CFDI'}${factura.folio || ''}.xml`;
    a.click();
    URL.revokeObjectURL(a.href);
}

async function modalCobro(id) {
    const factura = estado.facturas.find(f => f.id === id);
    if (!factura) return;

    const { value: form } = await Swal.fire({
        title: `Registrar cobro · ${factura.serie}${factura.folio}`,
        html: `
            <div class="text-left text-sm space-y-3">
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                    <div class="flex justify-between"><span class="text-slate-500 font-bold">Cliente</span><span class="font-black">${factura.billing_clients?.razon_social || ''}</span></div>
                    <div class="flex justify-between mt-1"><span class="text-slate-500 font-bold">Saldo pendiente</span><span class="font-black text-emerald-700">${money(factura.saldo)}</span></div>
                </div>
                <label class="block text-[10px] font-black text-slate-500 uppercase">Monto cobrado</label>
                <input id="sw-monto" type="number" step="0.01" value="${factura.saldo}" class="swal2-input m-0 w-full">
                <label class="block text-[10px] font-black text-slate-500 uppercase">Fecha de pago</label>
                <input id="sw-fecha" type="date" value="${new Date().toISOString().slice(0, 10)}" class="swal2-input m-0 w-full">
                <label class="block text-[10px] font-black text-slate-500 uppercase">Forma de pago</label>
                <select id="sw-forma" class="swal2-input m-0 w-full">
                    <option value="03">03 Transferencia electronica</option>
                    <option value="01">01 Efectivo</option>
                    <option value="02">02 Cheque nominativo</option>
                    <option value="04">04 Tarjeta de credito</option>
                    <option value="28">28 Tarjeta de debito</option>
                </select>
                <label class="block text-[10px] font-black text-slate-500 uppercase">Referencia</label>
                <input id="sw-ref" type="text" placeholder="Folio de transferencia" class="swal2-input m-0 w-full">
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Registrar cobro',
        confirmButtonColor: '#059669',
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        preConfirm: () => ({
            monto: parseFloat(document.getElementById('sw-monto').value),
            fecha_pago: document.getElementById('sw-fecha').value,
            forma_pago: document.getElementById('sw-forma').value,
            referencia: document.getElementById('sw-ref').value
        })
    });

    if (!form) return;

    try {
        const res = await billingCall('payment_register', { invoice_id: id, ...form });
        await Swal.fire({
            icon: 'success',
            title: 'Cobro registrado',
            html: `Saldo restante: <b>${money(res.saldo)}</b>` +
                (res.rep_requerido
                    ? '<p class="text-xs text-amber-700 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2">Esta factura es PPD: queda pendiente timbrar el Complemento de Pago (REP).</p>'
                    : '')
        });
        tabCxC();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'No se pudo registrar', text: err.message });
    }
}

// ---------------------------------------------------------------------
// Cuentas por pagar
// ---------------------------------------------------------------------
async function tabCxP() {
    cargando('Cargando facturas de proveedores...');
    try {
        const { facturas } = await billingCall('bills_list', {});
        estado.bills = facturas || [];
    } catch (err) {
        return error(err.message);
    }

    const totalPagar = estado.bills.reduce((s, b) => s + Number(b.saldo || 0), 0);
    const vencidas = estado.bills.filter(b =>
        Number(b.saldo) > 0 && b.fecha_vencimiento && new Date(b.fecha_vencimiento) < new Date());

    cuerpo().innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            ${kpi('Total por pagar', money(totalPagar), `${estado.bills.length} facturas`, 'fa-receipt', 'orange')}
            ${kpi('Vencidas', String(vencidas.length), money(vencidas.reduce((s, b) => s + Number(b.saldo), 0)), 'fa-clock', 'red')}
            ${kpi('Proveedores', String(new Set(estado.bills.map(b => b.supplier_id)).size), 'con facturas registradas', 'fa-truck-field', 'slate')}
        </div>

        <div class="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 class="text-xs font-black text-slate-800 uppercase tracking-tighter">
                    <i class="fas fa-receipt text-orange-600 mr-2"></i>Facturas recibidas
                </h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-[11px]">
                    <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-tighter text-[9px]">
                        <tr>
                            <th class="px-3 py-2 text-left">Folio</th>
                            <th class="px-3 py-2 text-left">Proveedor</th>
                            <th class="px-3 py-2 text-left">Fecha</th>
                            <th class="px-3 py-2 text-left">Vence</th>
                            <th class="px-3 py-2 text-right">Total</th>
                            <th class="px-3 py-2 text-right">Saldo</th>
                            <th class="px-3 py-2 text-center">Estado</th>
                            <th class="px-3 py-2 text-center">Pago</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${estado.bills.length ? estado.bills.map(b => {
                            const vencida = Number(b.saldo) > 0 && b.fecha_vencimiento && new Date(b.fecha_vencimiento) < new Date();
                            return `
                            <tr class="hover:bg-slate-50">
                                <td class="px-3 py-2 font-black text-slate-800">${b.serie || ''}${b.folio || ''}</td>
                                <td class="px-3 py-2 text-slate-700 max-w-[220px] truncate">
                                    ${b.suppliers?.razon_social || '—'}
                                    <span class="block text-[9px] text-slate-400 font-mono">${b.suppliers?.rfc || ''}</span>
                                </td>
                                <td class="px-3 py-2 text-slate-500">${fechaCorta(b.fecha)}</td>
                                <td class="px-3 py-2 ${vencida ? 'text-red-600 font-black' : 'text-slate-500'}">${fechaCorta(b.fecha_vencimiento)}</td>
                                <td class="px-3 py-2 text-right font-bold">${money(b.total)}</td>
                                <td class="px-3 py-2 text-right font-black">${money(b.saldo)}</td>
                                <td class="px-3 py-2 text-center">
                                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${
                                        b.status === 'pagada' ? 'bg-emerald-100 text-emerald-700'
                                        : b.status === 'parcial' ? 'bg-blue-100 text-blue-700'
                                        : 'bg-amber-100 text-amber-700'}">${b.status.toUpperCase()}</span>
                                </td>
                                <td class="px-3 py-2 text-center">
                                    ${estado.puedeEditar && Number(b.saldo) > 0
                                        ? `<button data-pago="${b.id}" class="w-7 h-7 rounded-lg bg-orange-600 hover:bg-orange-700 text-white"><i class="fas fa-money-bill-wave text-[10px]"></i></button>`
                                        : ''}
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="8">${vacio('Sin facturas de proveedores. Importa sus XML en la pestana Importar.')}</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.querySelectorAll('[data-pago]').forEach(b =>
        b.addEventListener('click', () => modalPagoProveedor(b.dataset.pago)));
}

async function modalPagoProveedor(id) {
    const bill = estado.bills.find(b => b.id === id);
    if (!bill) return;

    const { value: form } = await Swal.fire({
        title: 'Registrar pago a proveedor',
        html: `
            <div class="text-left text-sm space-y-3">
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                    <div class="flex justify-between"><span class="text-slate-500 font-bold">Proveedor</span><span class="font-black">${bill.suppliers?.razon_social || ''}</span></div>
                    <div class="flex justify-between mt-1"><span class="text-slate-500 font-bold">Saldo</span><span class="font-black text-orange-700">${money(bill.saldo)}</span></div>
                </div>
                <label class="block text-[10px] font-black text-slate-500 uppercase">Monto</label>
                <input id="sw-monto" type="number" step="0.01" value="${bill.saldo}" class="swal2-input m-0 w-full">
                <label class="block text-[10px] font-black text-slate-500 uppercase">Referencia</label>
                <input id="sw-ref" type="text" class="swal2-input m-0 w-full">
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Registrar pago',
        confirmButtonColor: '#ea580c',
        preConfirm: () => ({
            monto: parseFloat(document.getElementById('sw-monto').value),
            referencia: document.getElementById('sw-ref').value
        })
    });

    if (!form) return;
    try {
        await billingCall('bill_payment_register', { bill_id: id, ...form });
        tabCxP();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'No se pudo registrar', text: err.message });
    }
}

// ---------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------
function tabClientes() {
    cuerpo().innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-black text-slate-800 uppercase tracking-tighter">
                <i class="fas fa-address-book text-indigo-600 mr-2"></i>Clientes fiscales (${estado.clientes.length})
            </h3>
            ${estado.puedeEditar ? `
                <button id="cli-nuevo" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-indigo-200">
                    <i class="fas fa-plus mr-1"></i> Nuevo cliente
                </button>` : ''}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            ${estado.clientes.length ? estado.clientes.map(c => `
                <div class="bg-white border border-slate-300 rounded-xl shadow-sm p-4">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <p class="text-xs font-black text-slate-900 truncate">${c.razon_social}</p>
                            <p class="text-[10px] font-mono text-slate-500 mt-0.5">${c.rfc}</p>
                        </div>
                        ${estado.puedeEditar ? `<button data-editar="${c.id}" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"><i class="fas fa-pen text-[10px]"></i></button>` : ''}
                    </div>
                    <div class="mt-3 space-y-1 text-[10px]">
                        <div class="flex justify-between"><span class="text-slate-400 font-bold">Regimen</span><span class="font-bold text-slate-700">${c.regimen_fiscal}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400 font-bold">CP</span><span class="font-bold text-slate-700">${c.codigo_postal || '—'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400 font-bold">Uso CFDI</span><span class="font-bold text-slate-700">${c.uso_cfdi}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400 font-bold">Credito</span><span class="font-bold text-slate-700">${c.dias_credito} dias</span></div>
                    </div>
                    <div class="mt-3 pt-3 border-t border-slate-100">
                        ${c.emails?.length
                            ? `<p class="text-[10px] text-slate-600 font-bold truncate"><i class="fas fa-envelope text-indigo-500 mr-1"></i>${c.emails.join(', ')}</p>`
                            : '<p class="text-[10px] text-amber-600 font-black"><i class="fas fa-triangle-exclamation mr-1"></i>Sin correo para envio automatico</p>'}
                    </div>
                </div>
            `).join('') : `<div class="md:col-span-2 xl:col-span-3 bg-white border border-slate-300 rounded-xl">${vacio('Sin clientes. Se crean solos al importar tus XML, o da de alta uno con su Constancia de Situacion Fiscal.')}</div>`}
        </div>
    `;

    document.getElementById('cli-nuevo')?.addEventListener('click', () => modalCliente(null));
    document.querySelectorAll('[data-editar]').forEach(b =>
        b.addEventListener('click', () => modalCliente(estado.clientes.find(c => c.id === b.dataset.editar))));
}

async function modalCliente(cliente) {
    const c = cliente || {};
    const { value: form } = await Swal.fire({
        title: cliente ? 'Editar cliente' : 'Nuevo cliente',
        width: 640,
        html: `
            <div class="text-left space-y-3">
                ${!cliente ? `
                <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                    <p class="text-[11px] font-black text-indigo-800 uppercase tracking-tighter mb-2">
                        <i class="fas fa-wand-magic-sparkles mr-1"></i> Llenado automatico
                    </p>
                    <p class="text-[11px] text-slate-600 mb-2">Sube la Constancia de Situacion Fiscal y se llenan solos RFC, razon social, regimen, CP y domicilio.</p>
                    <input type="file" id="sw-csf" accept="application/pdf,image/*" class="text-[11px] w-full">
                    <p id="sw-csf-status" class="text-[11px] font-bold mt-2"></p>
                </div>` : ''}
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="text-[10px] font-black text-slate-500 uppercase">RFC *</label>
                        <input id="sw-rfc" value="${c.rfc || ''}" class="swal2-input m-0 w-full uppercase"></div>
                    <div><label class="text-[10px] font-black text-slate-500 uppercase">CP *</label>
                        <input id="sw-cp" value="${c.codigo_postal || ''}" class="swal2-input m-0 w-full"></div>
                </div>
                <div><label class="text-[10px] font-black text-slate-500 uppercase">Razon social *</label>
                    <input id="sw-razon" value="${c.razon_social || ''}" class="swal2-input m-0 w-full"></div>
                <div class="grid grid-cols-3 gap-2">
                    <div><label class="text-[10px] font-black text-slate-500 uppercase">Regimen</label>
                        <input id="sw-regimen" value="${c.regimen_fiscal || '601'}" class="swal2-input m-0 w-full"></div>
                    <div><label class="text-[10px] font-black text-slate-500 uppercase">Uso CFDI</label>
                        <input id="sw-uso" value="${c.uso_cfdi || 'G03'}" class="swal2-input m-0 w-full"></div>
                    <div><label class="text-[10px] font-black text-slate-500 uppercase">Dias credito</label>
                        <input id="sw-dias" type="number" value="${c.dias_credito ?? 30}" class="swal2-input m-0 w-full"></div>
                </div>
                <div><label class="text-[10px] font-black text-slate-500 uppercase">Domicilio</label>
                    <input id="sw-dom" value="${c.domicilio || ''}" class="swal2-input m-0 w-full"></div>
                <div><label class="text-[10px] font-black text-slate-500 uppercase">Correos (separados por coma)</label>
                    <input id="sw-emails" value="${(c.emails || []).join(', ')}" placeholder="cuentas@cliente.com, pagos@cliente.com" class="swal2-input m-0 w-full"></div>
                <div><label class="text-[10px] font-black text-slate-500 uppercase">Copia (CC)</label>
                    <input id="sw-cc" value="${(c.emails_cc || []).join(', ')}" class="swal2-input m-0 w-full"></div>
                <div><label class="text-[10px] font-black text-slate-500 uppercase">Asunto del correo</label>
                    <input id="sw-asunto" value="${c.asunto_correo || ''}" placeholder="Factura {{folio}} - Alexa Transportes" class="swal2-input m-0 w-full"></div>
                <div><label class="text-[10px] font-black text-slate-500 uppercase">Mensaje personalizado</label>
                    <textarea id="sw-msg" rows="3" placeholder="Estimados, adjuntamos la factura {{folio}} por {{total}} con vencimiento {{vencimiento}}."
                        class="swal2-textarea m-0 w-full text-sm">${c.mensaje_personalizado || ''}</textarea>
                    <p class="text-[10px] text-slate-400 mt-1">Variables: {{folio}}, {{total}}, {{vencimiento}}, {{cliente}}, {{uuid}}</p></div>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        confirmButtonColor: '#4f46e5',
        width: 640,
        didOpen: () => {
            const input = document.getElementById('sw-csf');
            if (!input) return;
            input.addEventListener('change', async () => {
                const file = input.files[0];
                if (!file) return;
                const status = document.getElementById('sw-csf-status');
                status.className = 'text-[11px] font-bold mt-2 text-indigo-600';
                status.textContent = 'Leyendo constancia con IA...';
                try {
                    const base64 = await fileToBase64(file);
                    const { datos } = await billingCall('parse_constancia', {
                        base64, mime_type: file.type || 'application/pdf'
                    });
                    if (datos.rfc) document.getElementById('sw-rfc').value = datos.rfc;
                    if (datos.razon_social) document.getElementById('sw-razon').value = datos.razon_social;
                    if (datos.regimen_fiscal) document.getElementById('sw-regimen').value = datos.regimen_fiscal;
                    if (datos.codigo_postal) document.getElementById('sw-cp').value = datos.codigo_postal;
                    if (datos.domicilio) document.getElementById('sw-dom').value = datos.domicilio;
                    status.className = 'text-[11px] font-bold mt-2 text-emerald-600';
                    status.textContent = 'Datos extraidos. Revisalos antes de guardar.';
                } catch (err) {
                    status.className = 'text-[11px] font-bold mt-2 text-red-600';
                    status.textContent = err.message;
                }
            });
        },
        preConfirm: () => {
            const lista = id => document.getElementById(id).value
                .split(',').map(s => s.trim()).filter(Boolean);
            return {
                id: c.id,
                rfc: document.getElementById('sw-rfc').value,
                razon_social: document.getElementById('sw-razon').value,
                codigo_postal: document.getElementById('sw-cp').value,
                regimen_fiscal: document.getElementById('sw-regimen').value,
                uso_cfdi: document.getElementById('sw-uso').value,
                dias_credito: parseInt(document.getElementById('sw-dias').value, 10),
                domicilio: document.getElementById('sw-dom').value,
                emails: lista('sw-emails'),
                emails_cc: lista('sw-cc'),
                asunto_correo: document.getElementById('sw-asunto').value,
                mensaje_personalizado: document.getElementById('sw-msg').value
            };
        }
    });

    if (!form) return;
    try {
        await billingCall('client_save', { cliente: form });
        const { clientes } = await billingCall('clients_list');
        estado.clientes = clientes;
        tabClientes();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err.message });
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ---------------------------------------------------------------------
// Importador de XML
// ---------------------------------------------------------------------
function tabImportar() {
    cuerpo().innerHTML = `
        <div class="max-w-3xl mx-auto space-y-4">
            <div class="bg-white border border-slate-300 rounded-xl shadow-sm p-6">
                <h3 class="text-xs font-black text-slate-800 uppercase tracking-tighter mb-2">
                    <i class="fas fa-file-import text-emerald-600 mr-2"></i>Importar CFDI
                </h3>
                <p class="text-[11px] text-slate-500 font-medium mb-4 leading-relaxed">
                    Arrastra tus archivos XML. El sistema distingue solo si es una factura
                    <b>emitida</b> (va a Cuentas por Cobrar) o <b>recibida</b> (va a Cuentas por Pagar),
                    comparando el RFC del emisor contra el tuyo, y crea los clientes y proveedores que falten.
                    Los CFDI repetidos se ignoran.
                </p>

                <div id="drop" class="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center transition-all hover:border-emerald-500 hover:bg-emerald-50/40 cursor-pointer">
                    <i class="fas fa-cloud-arrow-up text-3xl text-slate-300 mb-3"></i>
                    <p class="text-xs font-black text-slate-600 uppercase tracking-tighter">Arrastra los XML aqui</p>
                    <p class="text-[11px] text-slate-400 font-bold mt-1">o haz clic para seleccionarlos</p>
                    <input type="file" id="drop-input" accept=".xml,text/xml,application/xml" multiple class="hidden">
                </div>
            </div>
            <div id="import-result"></div>
        </div>
    `;

    const drop = document.getElementById('drop');
    const input = document.getElementById('drop-input');

    drop.addEventListener('click', () => input.click());
    drop.addEventListener('dragover', e => {
        e.preventDefault();
        drop.classList.add('border-emerald-500', 'bg-emerald-50/60');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('border-emerald-500', 'bg-emerald-50/60'));
    drop.addEventListener('drop', e => {
        e.preventDefault();
        drop.classList.remove('border-emerald-500', 'bg-emerald-50/60');
        procesarArchivos(Array.from(e.dataTransfer.files));
    });
    input.addEventListener('change', () => procesarArchivos(Array.from(input.files)));
}

async function procesarArchivos(files) {
    const xmls = files.filter(f => f.name.toLowerCase().endsWith('.xml'));
    const salida = document.getElementById('import-result');

    if (!xmls.length) {
        salida.innerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[11px] font-bold text-amber-800">
            No se encontraron archivos .xml. El PDF no sirve para importar: el que tiene los datos fiscales es el XML.
        </div>`;
        return;
    }

    salida.innerHTML = `<div class="bg-white border border-slate-300 rounded-xl p-6 text-center">
        <div class="spinner mx-auto mb-3 border-t-emerald-500 w-8 h-8"></div>
        <p class="text-[11px] font-black text-slate-500 uppercase tracking-tighter">Leyendo ${xmls.length} archivo(s)...</p>
    </div>`;

    const docs = [];
    const fallidos = [];

    for (const file of xmls) {
        try {
            docs.push(parseCFDI(await file.text(), file.name));
        } catch (err) {
            fallidos.push(err.message);
        }
    }

    if (!docs.length) {
        salida.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-[11px] font-bold text-red-700">
            Ningun archivo se pudo leer.<br>${fallidos.join('<br>')}
        </div>`;
        return;
    }

    try {
        // Se mandan en lotes para no exceder el limite de la Edge Function.
        const resumen = { emitidas: 0, recibidas: 0, clientes_nuevos: 0, proveedores_nuevos: 0, duplicados: 0, errores: [] };
        const LOTE = 25;
        for (let i = 0; i < docs.length; i += LOTE) {
            const res = await billingCall('import_batch', { docs: docs.slice(i, i + LOTE) });
            resumen.emitidas += res.resumen.emitidas;
            resumen.recibidas += res.resumen.recibidas;
            resumen.clientes_nuevos += res.resumen.clientes_nuevos;
            resumen.proveedores_nuevos += res.resumen.proveedores_nuevos;
            resumen.duplicados += res.resumen.duplicados;
            resumen.errores.push(...res.resumen.errores);
        }

        salida.innerHTML = `
            <div class="bg-white border border-slate-300 rounded-xl shadow-sm p-6">
                <p class="text-xs font-black text-emerald-700 uppercase tracking-tighter mb-4">
                    <i class="fas fa-circle-check mr-2"></i>Importacion terminada
                </p>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                    ${[
                        ['Por cobrar', resumen.emitidas, 'emerald'],
                        ['Por pagar', resumen.recibidas, 'orange'],
                        ['Clientes nuevos', resumen.clientes_nuevos, 'indigo'],
                        ['Proveedores nuevos', resumen.proveedores_nuevos, 'blue'],
                        ['Duplicados', resumen.duplicados, 'slate']
                    ].map(([l, v, c]) => `
                        <div class="bg-${c}-50 border border-${c}-200 rounded-xl p-3">
                            <p class="text-xl font-black text-${c}-700">${v}</p>
                            <p class="text-[9px] font-black text-slate-500 uppercase tracking-tighter mt-1">${l}</p>
                        </div>`).join('')}
                </div>
                ${(resumen.errores.length || fallidos.length) ? `
                    <div class="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                        <p class="text-[10px] font-black text-red-700 uppercase mb-1">Con problemas</p>
                        ${[...fallidos, ...resumen.errores].map(e => `<p class="text-[10px] text-red-600 font-medium">· ${e}</p>`).join('')}
                    </div>` : ''}
                <button id="ir-cxc" class="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
                    Ver cuentas por cobrar
                </button>
            </div>`;

        document.getElementById('ir-cxc').addEventListener('click', async () => {
            const data = await billingCall('bootstrap');
            estado.clientes = data.clientes;
            estado.aging = data.aging;
            estado.tab = 'cxc';
            pintarShell();
        });
    } catch (err) {
        salida.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-[11px] font-bold text-red-700">${err.message}</div>`;
    }
}

// ---------------------------------------------------------------------
// Configuracion fiscal
// ---------------------------------------------------------------------
function tabConfig() {
    const s = estado.settings || {};
    const vence = s.certificado_valido_hasta ? new Date(s.certificado_valido_hasta) : null;
    const diasVence = vence ? Math.ceil((vence - new Date()) / 86400000) : null;

    cuerpo().innerHTML = `
        <div class="max-w-3xl mx-auto space-y-4">
            <div class="bg-white border border-slate-300 rounded-xl shadow-sm p-6">
                <h3 class="text-xs font-black text-slate-800 uppercase tracking-tighter mb-4">
                    <i class="fas fa-building text-slate-600 mr-2"></i>Emisor
                </h3>
                <div class="grid grid-cols-2 gap-3 text-[11px]">
                    ${[['RFC', s.rfc], ['Razon social', s.razon_social], ['Regimen fiscal', s.regimen_fiscal],
                       ['Lugar de expedicion', s.codigo_postal]].map(([k, v]) => `
                        <div class="bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">${k}</p>
                            <p class="font-black text-slate-800 mt-1">${v || '—'}</p>
                        </div>`).join('')}
                </div>
            </div>

            <div class="bg-white border border-slate-300 rounded-xl shadow-sm p-6">
                <h3 class="text-xs font-black text-slate-800 uppercase tracking-tighter mb-4">
                    <i class="fas fa-gear text-slate-600 mr-2"></i>Folios y timbrado
                </h3>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="text-[10px] font-black text-slate-500 uppercase">Serie</label>
                        <input id="cfg-serie" value="${s.serie || 'ALEXA'}" class="w-full mt-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"></div>
                    <div><label class="text-[10px] font-black text-slate-500 uppercase">Ultimo folio usado</label>
                        <input id="cfg-folio" type="number" value="${s.folio_actual || 0}" class="w-full mt-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"></div>
                    <div><label class="text-[10px] font-black text-slate-500 uppercase">PAC</label>
                        <input id="cfg-pac" value="${s.pac_proveedor || ''}" placeholder="Nombre del proveedor de timbrado" class="w-full mt-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"></div>
                    <div><label class="text-[10px] font-black text-slate-500 uppercase">Modo</label>
                        <select id="cfg-modo" class="w-full mt-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold outline-none">
                            <option value="sandbox" ${s.pac_modo === 'sandbox' ? 'selected' : ''}>Pruebas (sandbox)</option>
                            <option value="produccion" ${s.pac_modo === 'produccion' ? 'selected' : ''}>Produccion</option>
                        </select></div>
                    <div class="col-span-2"><label class="text-[10px] font-black text-slate-500 uppercase">Correo remitente</label>
                        <input id="cfg-correo" value="${s.correo_remitente || ''}" placeholder="facturacion@alexatransportes.com.mx" class="w-full mt-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"></div>
                </div>

                ${diasVence !== null ? `
                    <div class="mt-4 p-3 rounded-xl border ${diasVence < 30 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}">
                        <p class="text-[11px] font-black">
                            <i class="fas fa-certificate mr-1"></i>
                            Certificado vigente hasta ${fechaCorta(s.certificado_valido_hasta)} (${diasVence} dias)
                        </p>
                    </div>` : `
                    <div class="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <p class="text-[11px] font-bold text-slate-500">
                            <i class="fas fa-circle-info mr-1"></i>
                            Aun no se ha cargado el CSD. Se hace en la Fase 2, junto con el timbrado.
                        </p>
                    </div>`}

                ${estado.puedeEditar ? `
                    <button id="cfg-guardar" class="mt-4 w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
                        Guardar configuracion
                    </button>` : ''}
            </div>
        </div>
    `;

    document.getElementById('cfg-guardar')?.addEventListener('click', async () => {
        try {
            const { settings } = await billingCall('settings_save', {
                settings: {
                    serie: document.getElementById('cfg-serie').value,
                    folio_actual: parseInt(document.getElementById('cfg-folio').value, 10),
                    pac_proveedor: document.getElementById('cfg-pac').value,
                    pac_modo: document.getElementById('cfg-modo').value,
                    correo_remitente: document.getElementById('cfg-correo').value
                }
            });
            estado.settings = settings;
            Swal.fire({ icon: 'success', title: 'Configuracion guardada', timer: 1400, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err.message });
        }
    });
}
