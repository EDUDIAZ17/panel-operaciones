import { supabase } from '../services/supabaseClient.js';

// ----------------------------------------------------------------
// MÓDULO DE COMBUSTIBLE — ALEXA Transportes
// Umbrales de semáforo: ≤2% verde | ≤4% amarillo | >4% rojo
// ----------------------------------------------------------------

export async function renderFuel(container) {
    container.innerHTML = `
        <div id="view-fuel" class="p-6 fade-in space-y-6">
            <div class="flex flex-wrap justify-between items-center gap-3">
                <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <i class="fas fa-gas-pump text-orange-600"></i> Control de Combustible
                </h2>
                <div class="flex flex-wrap gap-2">
                    <button id="fuel-tab-auth"
                        class="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold shadow-sm transition flex items-center gap-1">
                        <i class="fas fa-clipboard-check"></i> Nueva Autorización
                    </button>
                    <button id="fuel-tab-register"
                        class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold shadow-sm transition hover:bg-gray-300 flex items-center gap-1">
                        <i class="fas fa-fill-drip"></i> Registrar Carga
                    </button>
                    <button id="fuel-tab-history"
                        class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold shadow-sm transition hover:bg-gray-300 flex items-center gap-1">
                        <i class="fas fa-history"></i> Historial
                    </button>
                </div>
            </div>

            <div id="fuel-section-auth" class="space-y-4"></div>
            <div id="fuel-section-register" class="hidden space-y-4"></div>
            <div id="fuel-section-history"  class="hidden space-y-4"></div>
            <div id="fuel-modal-container"></div>
        </div>
    `;

    // Marcar autorizaciones vencidas (>48h sin completar)
    markExpiredAuthorizations();

    setupFuelTabs();
    loadAuthSection();
}

// ================================================================
// TABS
// ================================================================

function setupFuelTabs() {
    const tabs = [
        { id: 'auth',     btn: 'fuel-tab-auth',     sec: 'fuel-section-auth',     color: 'orange', load: loadAuthSection },
        { id: 'register', btn: 'fuel-tab-register',  sec: 'fuel-section-register', color: 'blue',   load: loadRegisterSection },
        { id: 'history',  btn: 'fuel-tab-history',   sec: 'fuel-section-history',  color: 'slate',  load: loadHistorySection }
    ];

    tabs.forEach(t => {
        document.getElementById(t.btn)?.addEventListener('click', () => {
            tabs.forEach(x => {
                const b = document.getElementById(x.btn);
                const s = document.getElementById(x.sec);
                if (!b || !s) return;
                if (x.id === t.id) {
                    b.className = `px-4 py-2 bg-${x.color}-600 text-white rounded-lg font-bold shadow-sm transition flex items-center gap-1`;
                    s.classList.remove('hidden');
                } else {
                    b.className = 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold shadow-sm transition hover:bg-gray-300 flex items-center gap-1';
                    s.classList.add('hidden');
                }
            });
            t.load();
        });
    });
}

// ================================================================
// TAB 1 — NUEVA AUTORIZACIÓN DE CARGA
// ================================================================

async function loadAuthSection() {
    const section = document.getElementById('fuel-section-auth');
    if (!section) return;

    section.innerHTML = `<div class="text-center py-8 text-gray-400"><div class="spinner border-t-orange-500 w-8 h-8 mx-auto mb-2"></div>Cargando...</div>`;

    const [{ data: units }, { data: operators }] = await Promise.all([
        supabase.from('units').select('id, economic_number, type, capacidad_tanque_litros, current_operator_id').order('economic_number'),
        supabase.from('operators').select('id, name').eq('active', true).order('name')
    ]);

    window._fuelUnits     = units     || [];
    window._fuelOperators = operators || [];

    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    section.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 class="text-lg font-bold text-gray-700 flex items-center mb-6">
                <i class="fas fa-clipboard-check text-orange-600 mr-2"></i>
                Nueva Autorización de Carga
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <!-- Unidad -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">UNIDAD *</label>
                    <select id="fuel-unidad" class="w-full border p-3 rounded-xl bg-gray-50 font-bold" required>
                        <option value="">— Seleccionar unidad —</option>
                        ${(units || []).map(u => `
                            <option value="${u.id}"
                                data-eco="${u.economic_number}"
                                data-cap="${u.capacidad_tanque_litros || 0}"
                                data-op="${u.current_operator_id || ''}">
                                ${u.economic_number} (${u.type}) — ${u.capacidad_tanque_litros || 0} L
                            </option>`).join('')}
                    </select>
                </div>

                <!-- Operador -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">OPERADOR *</label>
                    <select id="fuel-operador" class="w-full border p-3 rounded-xl bg-gray-50" required>
                        <option value="">— Seleccionar operador —</option>
                        ${(operators || []).map(o => `<option value="${o.id}">${o.name}</option>`).join('')}
                    </select>
                </div>

                <!-- Remolque -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">REMOLQUE (opcional)</label>
                    <input type="text" id="fuel-remolque" class="w-full border p-3 rounded-xl bg-gray-50"
                        placeholder="Ej: 27UZ7U" />
                </div>

                <!-- Fecha -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">FECHA Y HORA *</label>
                    <input type="datetime-local" id="fuel-fecha" class="w-full border p-3 rounded-xl bg-gray-50"
                        value="${now}" required />
                </div>

                <!-- Combustible actual + preview -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">COMBUSTIBLE ACTUAL (litros) *</label>
                    <input type="number" id="fuel-actual" class="w-full border p-3 rounded-xl bg-gray-50"
                        min="0" step="0.001" placeholder="Litros que trae la unidad" required />
                    <div id="fuel-auth-preview" class="hidden mt-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
                        <div class="text-sm text-gray-600">
                            Capacidad máxima: <span id="fuel-cap-display" class="font-bold text-gray-800">—</span>
                        </div>
                        <div class="text-2xl font-black text-orange-700 mt-1">
                            AUTORIZAR: <span id="fuel-autorizar-display">—</span> L
                        </div>
                    </div>
                </div>

                <!-- Precio por litro -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">PRECIO POR LITRO ($) (Opcional)</label>
                    <input type="number" id="fuel-precio" class="w-full border p-3 rounded-xl bg-gray-50"
                        min="0" step="0.01" placeholder="Ej: 27.78" />
                </div>

                <!-- Ubicación -->
                <div class="md:col-span-2">
                    <label class="block text-xs font-bold text-gray-500 mb-1">UBICACIÓN (Google Maps URL)</label>
                    <input type="url" id="fuel-ubicacion" class="w-full border p-3 rounded-xl bg-gray-50"
                        placeholder="https://maps.app.goo.gl/..." />
                </div>

                <!-- Notas -->
                <div class="md:col-span-2">
                    <label class="block text-xs font-bold text-gray-500 mb-1">NOTAS / OBSERVACIONES</label>
                    <textarea id="fuel-notas" class="w-full border p-3 rounded-xl bg-gray-50" rows="3"
                        placeholder="Observaciones adicionales..."></textarea>
                </div>

                <!-- Elaboró -->
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">ELABORÓ *</label>
                    <input type="text" id="fuel-elaboro" class="w-full border p-3 rounded-xl bg-gray-50"
                        value="${currentUser.name || ''}" placeholder="Nombre de quien autoriza" required />
                </div>
            </div>

            <div class="mt-6 flex justify-end">
                <button id="btn-generar-auth"
                    class="px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl shadow-lg transition flex items-center gap-2">
                    <i class="fas fa-check-circle"></i> Generar Autorización
                </button>
            </div>
        </div>

        <div id="auth-ticket-container"></div>
    `;

    setupAuthListeners();
}

function setupAuthListeners() {
    document.getElementById('fuel-unidad')?.addEventListener('change', () => {
        const sel = getSelectedUnitOption();
        const opId = sel?.dataset.op;
        if (opId) {
            const opSel = document.getElementById('fuel-operador');
            if (opSel) opSel.value = opId;
        }
        updateAuthPreview();
    });

    document.getElementById('fuel-actual')?.addEventListener('input', updateAuthPreview);
    document.getElementById('btn-generar-auth')?.addEventListener('click', saveAutorizacion);
}

function getSelectedUnitOption() {
    const sel = document.getElementById('fuel-unidad');
    if (!sel?.value) return null;
    return sel.options[sel.selectedIndex];
}

function updateAuthPreview() {
    const opt   = getSelectedUnitOption();
    const actual = parseFloat(document.getElementById('fuel-actual')?.value);
    const preview = document.getElementById('fuel-auth-preview');

    if (!opt || isNaN(actual)) { preview?.classList.add('hidden'); return; }

    const cap       = parseFloat(opt.dataset.cap) || 0;
    const autorizar = Math.max(0, cap - actual);

    document.getElementById('fuel-cap-display').textContent      = cap.toLocaleString('es-MX');
    document.getElementById('fuel-autorizar-display').textContent = autorizar.toFixed(3);
    preview?.classList.remove('hidden');
}

async function saveAutorizacion() {
    const btn       = document.getElementById('btn-generar-auth');
    const opt       = getSelectedUnitOption();
    const unidadId  = document.getElementById('fuel-unidad')?.value;
    const operadorId = document.getElementById('fuel-operador')?.value;
    const fecha     = document.getElementById('fuel-fecha')?.value;
    const actual    = parseFloat(document.getElementById('fuel-actual')?.value);
    const precio    = parseFloat(document.getElementById('fuel-precio')?.value) || 0;
    const elaboro   = document.getElementById('fuel-elaboro')?.value?.trim();

    if (!unidadId || !operadorId || !fecha || isNaN(actual) || !elaboro) {
        Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Complete todos los campos obligatorios (*).', confirmButtonColor: '#f97316' });
        return;
    }

    const cap = parseFloat(opt.dataset.cap) || 0;
    if (actual > cap) {
        Swal.fire({ icon: 'error', title: 'Dato incorrecto', text: `El combustible actual (${actual} L) no puede superar la capacidad del tanque (${cap} L).`, confirmButtonColor: '#f97316' });
        return;
    }

    const litros_autorizar = Math.max(0, cap - actual);

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Guardando...';

    const { data, error } = await supabase.from('cargas_combustible').insert({
        unidad_id:         unidadId,
        unidad_eco_txt:    opt.dataset.eco || null,
        operador_id:       operadorId,
        remolque:          document.getElementById('fuel-remolque')?.value?.trim() || null,
        fecha_carga:       new Date(fecha).toISOString(),
        precio_litro:      precio,
        combustible_actual: actual,
        capacidad_maxima:  cap,
        litros_autorizar,
        ubicacion_url:     document.getElementById('fuel-ubicacion')?.value?.trim() || null,
        notes:             document.getElementById('fuel-notas')?.value?.trim() || null, // Note: DB column is 'notas' but Deno uses it as 'notas' too. Let's make sure it is 'notas'
        notas:             document.getElementById('fuel-notas')?.value?.trim() || null,
        elaboro,
        status:            'pendiente_carga'
    }).select().single();

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Generar Autorización';

    if (error) {
        Swal.fire({ icon: 'error', title: 'Error al guardar', text: error.message });
        return;
    }

    const opName   = (window._fuelOperators || []).find(o => o.id === operadorId)?.name || '—';
    const eco      = opt.dataset.eco;
    const fechaStr = new Date(fecha).toLocaleString('es-MX');
    const precioFmt = precio.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    const ticket = document.getElementById('auth-ticket-container');
    if (ticket) {
        ticket.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg border-2 border-green-200 p-6 fade-in">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xl">
                        <i class="fas fa-check"></i>
                    </div>
                    <div>
                        <div class="font-black text-green-800 text-lg">AUTORIZACIÓN GENERADA</div>
                        <div class="text-xs text-gray-400 font-mono">#${data.id.slice(0, 8).toUpperCase()}</div>
                    </div>
                </div>
                <div class="bg-gray-50 rounded-xl p-5 font-mono text-sm border space-y-1 text-gray-700">
                    <div class="text-center text-green-700 font-black text-base mb-3">✅ AUTORIZACIÓN DE CARGA</div>
                    <div>Unidad: <strong>${eco}</strong> &nbsp;|&nbsp; Operador: <strong>${opName}</strong></div>
                    ${data.remolque ? `<div>Remolque: <strong>${data.remolque}</strong></div>` : ''}
                    <div>Fecha: <strong>${fechaStr}</strong></div>
                    <div>Combustible actual: <strong>${actual.toLocaleString('es-MX')} L</strong></div>
                    <div>Capacidad máxima: <strong>${cap.toLocaleString('es-MX')} L</strong></div>
                    <div class="border-t border-gray-300 my-2"></div>
                    <div class="text-xl font-black text-orange-700">LITROS A CARGAR: ${litros_autorizar.toFixed(3)} L</div>
                    <div>Precio estimado: <strong>${precioFmt}/L</strong></div>
                    ${data.ubicacion_url ? `<div>Ubicación: <a href="${data.ubicacion_url}" target="_blank" class="text-blue-600 underline">Ver en Maps</a></div>` : ''}
                </div>
                <div class="mt-4 flex gap-3">
                    <button onclick="document.getElementById('auth-ticket-container').innerHTML=''"
                        class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-bold transition text-sm">
                        Cerrar
                    </button>
                    <button id="btn-print-auth-ticket"
                        class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition text-sm flex items-center gap-1">
                        <i class="fas fa-file-pdf"></i> Descargar Ticket PDF
                    </button>
                </div>
            </div>
        `;
        ticket.scrollIntoView({ behavior: 'smooth' });

        document.getElementById('btn-print-auth-ticket')?.addEventListener('click', async () => {
            const btn = document.getElementById('btn-print-auth-ticket');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Generando...';
            btn.disabled = true;

            try {
                const { jsPDF } = window.jspdf;
                // Formato de ticket tipo POS (80mm x 170mm)
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 170] });
                
                // Intentar cargar logo (./logo/logo.png)
                const logoData = await new Promise(resolve => {
                    const img = new Image();
                    img.src = './logo/logo.png';
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    img.onerror = () => resolve(null);
                });

                let startY = 10;
                if (logoData) {
                    // Logo de 30x30mm centrado (80/2 - 15 = 25)
                    doc.addImage(logoData, 'PNG', 25, startY, 30, 30);
                    startY += 34;
                }

                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('ALEXA TRANSPORTES', 40, startY, { align: 'center' });
                
                startY += 5;
                doc.setFontSize(8);
                doc.setFont(undefined, 'normal');
                doc.text('AUTOTRANSPORTES Y LOGÍSTICA', 40, startY, { align: 'center' });
                startY += 3.5;
                doc.text('ESPECIALIZADA', 40, startY, { align: 'center' });
                
                startY += 6;
                doc.setDrawColor(0);
                doc.setLineDash([1, 1], 0);
                doc.line(5, startY, 75, startY);
                
                startY += 6;
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text('TICKET DE AUTORIZACIÓN', 40, startY, { align: 'center' });
                
                startY += 5;
                doc.setFontSize(9);
                doc.text(`FOLIO: #${data.id.slice(0, 8).toUpperCase()}`, 40, startY, { align: 'center' });

                startY += 4;
                doc.setLineDash([], 0);
                doc.line(5, startY, 75, startY);

                startY += 6;
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                doc.text(`Fecha: ${fechaStr}`, 5, startY); startY += 5;
                doc.text(`Unidad: ${eco}`, 5, startY); startY += 5;
                doc.text(`Operador: ${opName}`, 5, startY); startY += 5;
                if (data.remolque) {
                    doc.text(`Remolque: ${data.remolque}`, 5, startY); startY += 5;
                }
                
                startY += 2;
                doc.setLineDash([1, 1], 0);
                doc.line(5, startY, 75, startY);
                startY += 6;

                doc.text(`Tanque actual: ${actual.toFixed(2)} L`, 5, startY); startY += 5;
                doc.text(`Capacidad máx: ${cap.toFixed(2)} L`, 5, startY); startY += 5;
                
                startY += 3;
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.text(`AUTORIZADO: ${litros_autorizar.toFixed(2)} L`, 40, startY, { align: 'center' });
                
                startY += 6;
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                doc.text(`Precio est: ${precioFmt}/L`, 5, startY); startY += 5;

                if (data.notas) {
                    startY += 2;
                    doc.text(`Notas: ${data.notas}`, 5, startY, { maxWidth: 70 });
                    startY += 10;
                }
                
                startY += 2;
                doc.setLineDash([], 0);
                doc.line(5, startY, 75, startY);
                startY += 6;

                doc.setFontSize(8);
                doc.text('ESTE TICKET ES UN COMPROBANTE', 40, startY, { align: 'center' });
                startY += 4;
                doc.text('INTERNO DE AUTORIZACIÓN', 40, startY, { align: 'center' });

                doc.save(`Ticket_Combustible_${eco}_${data.id.slice(0,6)}.pdf`);
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'No se pudo generar el ticket PDF', 'error');
            } finally {
                btn.innerHTML = '<i class="fas fa-file-pdf"></i> Descargar Ticket PDF';
                btn.disabled = false;
            }
        });
    }
}

// ================================================================
// TAB 2 — REGISTRAR CARGA REAL
// ================================================================

async function loadRegisterSection() {
    const section = document.getElementById('fuel-section-register');
    if (!section) return;

    section.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div class="flex justify-between items-center mb-5">
                <h3 class="text-lg font-bold text-gray-700 flex items-center">
                    <i class="fas fa-fill-drip text-blue-600 mr-2"></i>
                    Autorizaciones Pendientes
                </h3>
                <button id="btn-refresh-pending"
                    class="text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1 transition font-bold">
                    <i class="fas fa-sync-alt"></i> Actualizar
                </button>
            </div>
            <div id="pending-list">
                <div class="text-center py-8 text-gray-400">
                    <div class="spinner border-t-blue-500 w-8 h-8 mx-auto mb-3"></div>
                    Cargando autorizaciones pendientes...
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-refresh-pending')?.addEventListener('click', loadPendingList);
    await loadPendingList();
}

async function loadPendingList() {
    const list = document.getElementById('pending-list');
    if (!list) return;

    const { data: pending, error } = await supabase
        .from('cargas_combustible')
        .select('*, units(economic_number, type, capacidad_tanque_litros), operators(name)')
        .eq('status', 'pendiente_carga')
        .order('creado_en', { ascending: false });

    if (error) {
        list.innerHTML = `<div class="text-red-500 text-center py-4 font-bold">Error: ${error.message}</div>`;
        return;
    }

    if (pending) {
        pending.forEach(p => {
            if (p.units && p.units.capacidad_tanque_litros > 0) {
                p.capacidad_maxima = p.units.capacidad_tanque_litros;
            }
        });
    }

    if (!pending?.length) {
        list.innerHTML = `
            <div class="text-center py-14 text-gray-400">
                <i class="fas fa-check-circle text-5xl mb-3 text-green-400"></i>
                <div class="font-bold text-lg">Sin pendientes</div>
                <div class="text-sm mt-1">Todas las cargas han sido registradas</div>
            </div>`;
        return;
    }

    list.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${pending.map(p => {
                const horas = (Date.now() - new Date(p.creado_en)) / 3600000;
                const critico = horas > 36;
                const fechaStr = new Date(p.fecha_carga).toLocaleString('es-MX');
                return `
                    <div class="border ${critico ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'} rounded-xl p-4 hover:shadow-md transition">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <div class="font-black text-gray-800 text-xl">${p.units?.economic_number || p.unidad_eco_txt || '—'}</div>
                                <div class="text-xs text-gray-500 uppercase font-bold tracking-wide">${p.units?.type || ''}</div>
                            </div>
                            <span class="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-1 rounded-full">PENDIENTE</span>
                        </div>
                        <div class="text-sm text-gray-600 space-y-1 mb-4">
                            <div><i class="fas fa-user w-5 text-gray-400"></i> ${p.operators?.name || '—'}</div>
                            <div><i class="fas fa-clock w-5 text-gray-400"></i> ${fechaStr}</div>
                            <div><i class="fas fa-tint w-5 text-orange-400"></i>
                                <span class="font-black text-orange-700">${(p.litros_autorizar || 0).toFixed(1)} L</span> autorizados
                            </div>
                            ${p.remolque ? `<div><i class="fas fa-dolly w-5 text-gray-400"></i> ${p.remolque}</div>` : ''}
                        </div>
                        ${critico ? `<div class="text-xs text-amber-700 font-bold mb-2"><i class="fas fa-exclamation-triangle mr-1"></i> Próximo a vencer (&gt;36h)</div>` : ''}
                        <button class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm register-carga-btn"
                            data-id="${p.id}">
                            <i class="fas fa-edit mr-1"></i> Registrar Carga Real
                        </button>
                    </div>`;
            }).join('')}
        </div>`;

    list.querySelectorAll('.register-carga-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const rec = pending.find(p => p.id === btn.dataset.id);
            if (rec) openRegistrarCargaModal(rec);
        });
    });
}

function openRegistrarCargaModal(auth) {
    const container = document.getElementById('fuel-modal-container');
    const modal     = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] fade-in';

    const eco      = auth.units?.economic_number || auth.unidad_eco_txt || '—';
    const opName   = auth.operators?.name         || '—';
    const fechaStr = new Date(auth.fecha_carga).toLocaleString('es-MX');
    const maxAllow = ((auth.litros_autorizar || 0) * 1.05);

    modal.innerHTML = `
        <div class="bg-white rounded-2xl w-full max-w-lg shadow-2xl mx-4 overflow-hidden">
            <div class="bg-blue-600 text-white p-5">
                <h3 class="text-xl font-black">Registrar Carga Real</h3>
                <p class="text-blue-100 text-sm mt-1">${eco} — ${opName}</p>
            </div>
            <div class="p-6 space-y-5">
                <!-- Resumen de autorización -->
                <div class="bg-gray-50 rounded-xl p-4 text-sm border grid grid-cols-2 gap-2 text-gray-600">
                    <div>Fecha: <span class="font-bold text-gray-800">${fechaStr}</span></div>
                    <div>Autorizado: <span class="font-black text-orange-700">${(auth.litros_autorizar || 0).toFixed(3)} L</span></div>
                    <div>Comb. actual: <span class="font-bold">${auth.combustible_actual} L</span></div>
                    <div>Capacidad: <span class="font-bold">${auth.capacidad_maxima} L</span></div>
                    <div>Precio/L: <span class="font-bold">$${auth.precio_litro}</span></div>
                </div>

                <!-- Inputs de carga real -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">LITROS BOMBA (ticket) *</label>
                        <input type="number" id="modal-litros-bomba"
                            class="w-full border-2 border-gray-200 p-3 rounded-xl bg-gray-50 text-lg font-bold transition"
                            min="0" step="0.001" placeholder="0.000" />
                        <div class="text-[10px] text-gray-400 mt-1">Máx recomendado: ${maxAllow.toFixed(1)} L (+5%)</div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">LITROS BOSON (sensor) *</label>
                        <input type="number" id="modal-litros-boson"
                            class="w-full border-2 border-gray-200 p-3 rounded-xl bg-gray-50 text-lg font-bold transition"
                            min="0" step="0.001" placeholder="0.000" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">PRECIO REAL POR LITRO</label>
                        <input type="number" id="modal-precio-litro" value="${auth.precio_litro || 0}"
                            class="w-full border-2 border-gray-200 p-3 rounded-xl bg-gray-50 text-lg font-bold transition" min="0" step="0.01" />
                    </div>
                    <div class="col-span-full">
                        <label class="block text-xs font-bold text-gray-500 mb-1">EVIDENCIAS FOTOGRÁFICAS (Hasta 3)</label>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input type="file" id="modal-evidencia-1" accept="image/*" class="w-full border-2 border-gray-200 p-2 rounded-xl bg-gray-50 text-xs transition" />
                            <input type="file" id="modal-evidencia-2" accept="image/*" class="w-full border-2 border-gray-200 p-2 rounded-xl bg-gray-50 text-xs transition" />
                            <input type="file" id="modal-evidencia-3" accept="image/*" class="w-full border-2 border-gray-200 p-2 rounded-xl bg-gray-50 text-xs transition" />
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">UBICACIÓN (Maps URL)</label>
                        <input type="text" id="modal-ubicacion" value="${auth.ubicacion_url || ''}"
                            class="w-full border-2 border-gray-200 p-3 rounded-xl bg-gray-50 text-sm" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">NOTAS / OBSERVACIONES</label>
                        <input type="text" id="modal-notas" value="${auth.notas || ''}"
                            class="w-full border-2 border-gray-200 p-3 rounded-xl bg-gray-50 text-sm" />
                    </div>
                </div>

                <!-- Semáforo en tiempo real -->
                <div id="modal-semaforo-preview" class="hidden rounded-xl p-4 border text-center transition-all">
                    <div class="grid grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                        <div>Diferencia<br><span id="modal-diff" class="font-black text-gray-900 text-base">—</span></div>
                        <div>Porcentaje<br><span id="modal-pct"  class="font-black text-gray-900 text-base">—</span></div>
                        <div>Monto cobro<br><span id="modal-monto" class="font-black text-gray-900 text-base">—</span></div>
                    </div>
                    <div id="modal-semaforo-text" class="text-lg font-black"></div>
                </div>

                <div class="flex gap-3 pt-2">
                    <button class="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition"
                        onclick="this.closest('.fixed').remove()">Cancelar</button>
                    <button id="btn-save-carga"
                        class="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg transition">
                        <i class="fas fa-save mr-1"></i> Guardar Registro
                    </button>
                </div>
            </div>
        </div>`;

    container.appendChild(modal);

    const bombaInput = document.getElementById('modal-litros-bomba');
    const bosonInput = document.getElementById('modal-litros-boson');
    const precioInput = document.getElementById('modal-precio-litro');

    const updatePreview = () => {
        const bomba = parseFloat(bombaInput?.value) || 0;
        const boson = parseFloat(bosonInput?.value) || 0;
        const precioReal = parseFloat(precioInput?.value) || 0;
        const preview = document.getElementById('modal-semaforo-preview');
        if (!preview) return;

        if (bomba <= 0) { preview.classList.add('hidden'); return; }

        const diff = boson - bomba;
        const pct  = Math.abs(diff / (bomba || 1)) * 100;

        let bgClass, icon, texto, semaforo;
        if (diff >= 0 || pct <= 2) {
            semaforo = 'verde';
            bgClass  = 'bg-green-50 border-green-300';
            icon     = '🟢';
            texto    = diff > 0 ? 'A FAVOR / OK' : 'DENTRO DE TOLERANCIA';
        } else if (diff < 0 && pct <= 4) {
            semaforo = 'amarillo';
            bgClass  = 'bg-yellow-50 border-yellow-300';
            icon     = '🟡';
            texto    = 'EN REVISIÓN — Faltante';
        } else {
            semaforo = 'rojo';
            bgClass  = 'bg-red-50 border-red-300';
            icon     = '🔴';
            const mto = (Math.abs(diff) * precioReal).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
            texto    = `FALTANTE CONFIRMADO — Cobro estimado: ${mto}`;
        }

        const monto = semaforo === 'rojo' ? Math.abs(diff) * precioReal : 0;

        preview.className = `rounded-xl p-4 border text-center transition-all ${bgClass}`;
        preview.classList.remove('hidden');
        document.getElementById('modal-diff').textContent  = `${diff >= 0 ? '+' : ''}${diff.toFixed(3)} L`;
        document.getElementById('modal-pct').textContent   = `${pct.toFixed(2)}%`;
        document.getElementById('modal-monto').textContent = monto > 0
            ? monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '$0.00';
        document.getElementById('modal-semaforo-text').textContent = `${icon} ${texto}`;
    };

    bombaInput?.addEventListener('input', () => {
        const v = parseFloat(bombaInput.value) || 0;
        bombaInput.style.borderColor = v > maxAllow ? '#ef4444' : '';
        updatePreview();
    });
    bosonInput?.addEventListener('input', updatePreview);
    precioInput?.addEventListener('input', updatePreview);

    document.getElementById('btn-save-carga')?.addEventListener('click', async () => {
        const bomba = parseFloat(bombaInput?.value);
        const boson = parseFloat(bosonInput?.value);
        const precioReal = parseFloat(precioInput?.value) || 0;
        const ubicacion = document.getElementById('modal-ubicacion')?.value?.trim() || null;
        const notas = document.getElementById('modal-notas')?.value?.trim() || null;
        const f1 = document.getElementById('modal-evidencia-1')?.files[0];
        const f2 = document.getElementById('modal-evidencia-2')?.files[0];
        const f3 = document.getElementById('modal-evidencia-3')?.files[0];
        const filesArray = [f1, f2, f3];

        if (isNaN(bomba) || isNaN(boson) || bomba <= 0 || boson <= 0) {
            Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Ingrese los litros de bomba y BOSON.', confirmButtonColor: '#3b82f6' });
            return;
        }

        if (bomba > maxAllow) {
            const { isConfirmed } = await Swal.fire({
                icon: 'warning',
                title: '¡Advertencia!',
                text: `Los litros bomba (${bomba} L) exceden el 5% del límite autorizado (${(auth.litros_autorizar || 0).toFixed(1)} L). ¿Desea continuar?`,
                showCancelButton: true,
                confirmButtonText: 'Sí, continuar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#f97316'
            });
            if (!isConfirmed) return;
        }

        await saveRegistroCarga(auth, bomba, boson, precioReal, ubicacion, notas, filesArray, modal);
    });
}

async function saveRegistroCarga(auth, litrosBomba, litrosBoson, precioReal, ubicacion, notas, filesArray, modal) {
    const btn = document.getElementById('btn-save-carga');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...'; }

    let urls = [auth.evidencia_url || null, auth.evidencia_url_2 || null, auth.evidencia_url_3 || null];

    if (filesArray && filesArray.length > 0) {
        for (let i = 0; i < 3; i++) {
            if (filesArray[i]) {
                const f = filesArray[i];
                const ext = f.name.split('.').pop();
                const fileName = `${auth.id}_${Date.now()}_${i}.${ext}`;
                const { error: uploadError } = await supabase.storage.from('evidencias').upload(`combustible/${fileName}`, f);
                if (!uploadError) {
                    const { data: publicData } = supabase.storage.from('evidencias').getPublicUrl(`combustible/${fileName}`);
                    if (publicData) urls[i] = publicData.publicUrl;
                } else {
                    console.warn(`Error subiendo evidencia ${i+1}:`, uploadError);
                }
            }
        }
    }

    const diferencia  = litrosBoson - litrosBomba;
    const porcentaje  = Math.abs(diferencia / (litrosBomba || 1)) * 100;
    let semaforo;
    if (diferencia >= 0 || porcentaje <= 2) {
        semaforo = 'verde';
    } else if (diferencia < 0 && porcentaje <= 4) {
        semaforo = 'amarillo';
    } else {
        semaforo = 'rojo';
    }
    const monto = semaforo === 'rojo' ? Math.abs(diferencia) * precioReal : 0;

    const { error } = await supabase
        .from('cargas_combustible')
        .update({
            litros_bomba:          litrosBomba,
            litros_boson:          litrosBoson,
            precio_litro:          precioReal,
            ubicacion_url:         ubicacion,
            notas:                 notas,
            evidencia_url:         urls[0],
            evidencia_url_2:       urls[1],
            evidencia_url_3:       urls[2],
            diferencia_litros:     diferencia,
            porcentaje_diferencia: porcentaje,
            semaforo,
            monto_cobro:           monto,
            status:                'completado',
            capacidad_maxima:      auth.capacidad_maxima
        })
        .eq('id', auth.id);

    if (error) {
        Swal.fire({ icon: 'error', title: 'Error al guardar', text: error.message });
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar Registro'; }
        return;
    }

    modal.remove();

    const emoji    = semaforo === 'verde' ? '🟢' : semaforo === 'amarillo' ? '🟡' : '🔴';
    const iconType = semaforo === 'verde' ? 'success' : semaforo === 'amarillo' ? 'warning' : 'error';
    const titulo   = semaforo === 'verde' ? 'Dentro de tolerancia' : semaforo === 'amarillo' ? 'En revisión' : 'DESVÍO CONFIRMADO';

    await Swal.fire({
        icon: iconType,
        title: 'Carga Registrada',
        html: `
            <div class="text-center py-2">
                <div class="text-5xl mb-3">${emoji}</div>
                <div class="font-black text-lg">${titulo}</div>
                <div class="text-sm mt-2 text-gray-600">Diferencia: ${diferencia.toFixed(3)} L (${porcentaje.toFixed(2)}%)</div>
                ${monto > 0 ? `<div class="text-red-600 font-black mt-2 text-base">💰 Cobro: ${monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</div>` : ''}
            </div>`,
        confirmButtonColor: semaforo === 'verde' ? '#10b981' : semaforo === 'amarillo' ? '#f59e0b' : '#ef4444'
    });

    await loadPendingList();
}

// ================================================================
// TAB 3 — HISTORIAL Y REPORTES
// ================================================================

async function loadHistorySection() {
    const section = document.getElementById('fuel-section-history');
    if (!section) return;

    const [{ data: units }, { data: operators }] = await Promise.all([
        supabase.from('units').select('id, economic_number, type').order('economic_number'),
        supabase.from('operators').select('id, name').order('name')
    ]);

    section.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-6 space-y-5">
            <div class="flex flex-wrap justify-between items-center gap-3">
                <h3 class="text-lg font-bold text-gray-700 flex items-center">
                    <i class="fas fa-history text-slate-600 mr-2"></i> Historial de Cargas
                </h3>
                <div class="flex gap-2">
                    <button id="btn-export-excel"
                        class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm transition flex items-center gap-1">
                        <i class="fas fa-file-excel"></i> Excel
                    </button>
                    <button id="btn-export-pdf-red"
                        class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition flex items-center gap-1">
                        <i class="fas fa-file-pdf"></i> PDF Desvíos
                    </button>
                </div>
            </div>

            <!-- Filtros -->
            <div class="bg-gray-50 border rounded-xl p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1">UNIDAD</label>
                    <select id="hist-unit" class="w-full border p-2 rounded-lg bg-white text-sm">
                        <option value="">Todas</option>
                        ${(units || []).map(u => `<option value="${u.id}">${u.economic_number}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1">OPERADOR</label>
                    <select id="hist-op" class="w-full border p-2 rounded-lg bg-white text-sm">
                        <option value="">Todos</option>
                        ${(operators || []).map(o => `<option value="${o.id}">${o.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1">DESDE</label>
                    <input type="date" id="hist-desde" class="w-full border p-2 rounded-lg bg-white text-sm" />
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1">HASTA</label>
                    <input type="date" id="hist-hasta" class="w-full border p-2 rounded-lg bg-white text-sm" />
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1">SEMÁFORO</label>
                    <select id="hist-semaforo" class="w-full border p-2 rounded-lg bg-white text-sm">
                        <option value="">Todos</option>
                        <option value="verde">🟢 Verde</option>
                        <option value="amarillo">🟡 Amarillo</option>
                        <option value="rojo">🔴 Rojo</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1">TIPO FLOTA</label>
                    <select id="hist-tipo" class="w-full border p-2 rounded-lg bg-white text-sm">
                        <option value="">Todas</option>
                        <option value="Madrina">Madrinas</option>
                        <option value="Pipa">Pipas</option>
                    </select>
                </div>
            </div>

            <div class="flex justify-end">
                <button id="btn-hist-buscar"
                    class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition flex items-center gap-1">
                    <i class="fas fa-search"></i> Buscar
                </button>
            </div>

            <!-- Tarjetas resumen -->
            <div id="hist-summary" class="hidden grid-cols-2 md:grid-cols-4 gap-4"></div>

            <!-- Tabla -->
            <div id="hist-table-wrap">
                <div class="text-center py-10 text-gray-400">
                    <i class="fas fa-search text-3xl mb-2 block"></i>
                    Use los filtros y presione Buscar
                </div>
            </div>
        </div>`;

    document.getElementById('btn-hist-buscar')?.addEventListener('click',    applyHistoryFilters);
    document.getElementById('btn-export-excel')?.addEventListener('click',   exportHistoryExcel);
    document.getElementById('btn-export-pdf-red')?.addEventListener('click', exportRedPDF);

    // Carga inicial sin filtros
    applyHistoryFilters();
}

async function applyHistoryFilters() {
    const unitId   = document.getElementById('hist-unit')?.value;
    const opId     = document.getElementById('hist-op')?.value;
    const desde    = document.getElementById('hist-desde')?.value;
    const hasta    = document.getElementById('hist-hasta')?.value;
    const semaforo = document.getElementById('hist-semaforo')?.value;
    const tipo     = document.getElementById('hist-tipo')?.value;

    const wrap = document.getElementById('hist-table-wrap');
    if (wrap) wrap.innerHTML = `<div class="text-center py-8 text-gray-400"><div class="spinner border-t-indigo-500 w-8 h-8 mx-auto mb-2"></div>Cargando...</div>`;

    let q = supabase
        .from('cargas_combustible')
        .select('*, units(economic_number, type), operators(name)')
        .eq('status', 'completado')
        .order('fecha_carga', { ascending: false })
        .limit(500);

    if (unitId)   q = q.eq('unidad_id', unitId);
    if (opId)     q = q.eq('operador_id', opId);
    if (semaforo) q = q.eq('semaforo', semaforo);
    if (desde)    q = q.gte('fecha_carga', desde);
    if (hasta)    q = q.lte('fecha_carga', hasta + 'T23:59:59');

    const { data: records, error } = await q;

    if (error) {
        if (wrap) wrap.innerHTML = `<div class="text-red-500 text-center py-4">Error: ${error.message}</div>`;
        return;
    }

    const filtered = tipo ? (records || []).filter(r => r.units?.type === tipo) : (records || []);
    window._fuelHistoryData = filtered;
    renderHistoryData(filtered);
}

function renderHistoryData(records) {
    // Tarjetas resumen
    const summary      = document.getElementById('hist-summary');
    const totalCargas  = records.length;
    const totalLitros  = records.reduce((s, r) => s + (r.litros_bomba || 0), 0);
    const desviosRojos = records.filter(r => r.semaforo === 'rojo').length;
    const totalCobrar  = records.reduce((s, r) => s + (r.monto_cobro || 0), 0);

    if (summary) {
        summary.className = 'grid grid-cols-2 md:grid-cols-4 gap-4';
        summary.innerHTML = [
            { label: 'Total Cargas',   value: totalCargas,   icon: 'fa-gas-pump',          color: 'blue' },
            { label: 'Total Litros',   value: totalLitros.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' L', icon: 'fa-tint', color: 'indigo' },
            { label: 'Desvíos 🔴',     value: desviosRojos,  icon: 'fa-exclamation-triangle', color: 'red' },
            { label: 'Total a Cobrar', value: totalCobrar.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }), icon: 'fa-dollar-sign', color: 'orange' }
        ].map(c => `
            <div class="bg-${c.color}-50 border border-${c.color}-100 rounded-xl p-4 text-center">
                <div class="text-${c.color}-600 text-2xl mb-1"><i class="fas ${c.icon}"></i></div>
                <div class="text-2xl font-black text-${c.color}-800">${c.value}</div>
                <div class="text-xs font-bold text-${c.color}-600 uppercase tracking-wide mt-1">${c.label}</div>
            </div>`).join('');
    }

    const wrap = document.getElementById('hist-table-wrap');
    if (!wrap) return;

    if (!records.length) {
        wrap.innerHTML = `
            <div class="text-center py-12 text-gray-400">
                <i class="fas fa-inbox text-4xl mb-3 block"></i>
                <div class="font-bold">Sin resultados</div>
                <div class="text-sm">No hay registros con esos filtros</div>
            </div>`;
        return;
    }

    const sc = {
        verde:    { bg: 'bg-green-100',  text: 'text-green-700',  label: '🟢 OK' },
        amarillo: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '🟡 REVISAR' },
        rojo:     { bg: 'bg-red-100',    text: 'text-red-700',    label: '🔴 DESVÍO' }
    };

    wrap.innerHTML = `
        <div class="overflow-x-auto rounded-xl border border-gray-200 custom-scrollbar">
            <table class="w-full text-left text-sm">
                <thead class="bg-gray-50 border-b">
                    <tr class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <th class="px-4 py-3">Fecha</th>
                        <th class="px-4 py-3">Unidad</th>
                        <th class="px-4 py-3">Operador</th>
                        <th class="px-4 py-3 text-right">L. Bomba</th>
                        <th class="px-4 py-3 text-right">L. BOSON</th>
                        <th class="px-4 py-3 text-right">Diferencia</th>
                        <th class="px-4 py-3 text-right">% Dif</th>
                        <th class="px-4 py-3 text-center">Estado</th>
                        <th class="px-4 py-3 text-right">Monto Cobro</th>
                        <th class="px-4 py-3 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${records.map(r => {
                        const s    = sc[r.semaforo] || sc.verde;
                        const diff = r.diferencia_litros || 0;
                        const sign = diff >= 0 ? '+' : '';
                        return `
                            <tr class="hover:bg-gray-50 transition">
                                <td class="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                                    ${new Date(r.fecha_carga).toLocaleDateString('es-MX')}
                                </td>
                                <td class="px-4 py-3 font-bold text-gray-800">${r.units?.economic_number || r.unidad_eco_txt || '—'}</td>
                                <td class="px-4 py-3 text-gray-600 text-xs">${r.operators?.name || '—'}</td>
                                <td class="px-4 py-3 text-right font-mono">${(r.litros_bomba || 0).toFixed(3)}</td>
                                <td class="px-4 py-3 text-right font-mono">${(r.litros_boson || 0).toFixed(3)}</td>
                                <td class="px-4 py-3 text-right font-mono font-bold ${diff < 0 ? 'text-red-600' : 'text-gray-700'}">
                                    ${sign}${diff.toFixed(3)}
                                </td>
                                <td class="px-4 py-3 text-right font-mono">${(r.porcentaje_diferencia || 0).toFixed(2)}%</td>
                                <td class="px-4 py-3 text-center">
                                    <span class="px-2 py-1 rounded-full text-[10px] font-black ${s.bg} ${s.text}">${s.label}</span>
                                </td>
                                <td class="px-4 py-3 text-right font-bold ${(r.monto_cobro || 0) > 0 ? 'text-red-600' : 'text-gray-300'}">
                                    ${(r.monto_cobro || 0) > 0
                                        ? r.monto_cobro.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
                                        : '—'}
                                </td>
                                <td class="px-4 py-3 text-center space-x-1">
                                    <button class="btn-hist-print text-indigo-600 hover:text-indigo-800 transition px-1" data-id="${r.id}" title="Imprimir Reporte"><i class="fas fa-print"></i></button>
                                    <button class="btn-hist-edit text-blue-600 hover:text-blue-800 transition px-1" data-id="${r.id}" title="Editar"><i class="fas fa-edit"></i></button>
                                    <button class="btn-hist-delete text-red-600 hover:text-red-800 transition px-1" data-id="${r.id}" title="Borrar"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;

    wrap.querySelectorAll('.btn-hist-print').forEach(btn => {
        btn.addEventListener('click', () => printHistoryReport(records.find(r => r.id === btn.dataset.id)));
    });
    wrap.querySelectorAll('.btn-hist-edit').forEach(btn => {
        btn.addEventListener('click', () => openEditHistoryModal(records.find(r => r.id === btn.dataset.id)));
    });
    wrap.querySelectorAll('.btn-hist-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteHistoryRecord(btn.dataset.id));
    });
}

// ================================================================
// EXPORTACIÓN
// ================================================================

function exportHistoryExcel() {
    const records = window._fuelHistoryData || [];
    if (!records.length) {
        Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay datos para exportar. Realice una búsqueda primero.', confirmButtonColor: '#10b981' });
        return;
    }

    const rows = records.map(r => ({
        'Fecha':                   new Date(r.fecha_carga).toLocaleString('es-MX'),
        'Unidad':                  r.units?.economic_number || r.unidad_eco_txt || '',
        'Tipo':                    r.units?.type            || '',
        'Operador':                r.operators?.name        || '',
        'Remolque':                r.remolque               || '',
        'Combustible Actual (L)':  r.combustible_actual,
        'Capacidad Máxima (L)':    r.capacidad_maxima,
        'Litros Autorizados (L)':  r.litros_autorizar,
        'Litros Bomba (L)':        r.litros_bomba,
        'Litros BOSON (L)':        r.litros_boson,
        'Diferencia (L)':          r.diferencia_litros,
        '% Diferencia':            r.porcentaje_diferencia,
        'Semáforo':                (r.semaforo || '').toUpperCase(),
        'Precio/Litro ($)':        r.precio_litro,
        'Monto Cobro ($)':         r.monto_cobro,
        'Elaboró':                 r.elaboro       || '',
        'Notas':                   r.notas         || '',
        'URL Ubicación':           r.ubicacion_url || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Combustible');
    XLSX.writeFile(wb, `combustible_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportRedPDF() {
    const records = (window._fuelHistoryData || []).filter(r => r.semaforo === 'rojo');
    if (!records.length) {
        Swal.fire({ icon: 'info', title: 'Sin desvíos', text: 'No hay registros con desvío (rojo) para exportar.', confirmButtonColor: '#ef4444' });
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('REPORTE DE DESVÍOS DE COMBUSTIBLE', 14, 14);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text('AUTOTRANSPORTES Y LOGISTICA ESPECIALIZADA XA S.A.P.I DE CV', 14, 20);
    doc.text(`Formato: RE-DESVC-F001  |  Generado: ${new Date().toLocaleString('es-MX')}`, 14, 25);
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 27, 282, 27);

    doc.autoTable({
        startY: 31,
        head: [['Fecha', 'Unidad', 'Operador', 'Remolque', 'Precio/L', 'L. Bomba', 'L. BOSON', 'Diferencia', '% Dif', 'Monto Cobro']],
        body: records.map(r => [
            new Date(r.fecha_carga).toLocaleDateString('es-MX'),
            r.units?.economic_number || r.unidad_eco_txt || '',
            r.operators?.name        || '',
            r.remolque               || '—',
            `$${r.precio_litro}`,
            (r.litros_bomba  || 0).toFixed(3),
            (r.litros_boson  || 0).toFixed(3),
            (r.diferencia_litros || 0).toFixed(3),
            `${(r.porcentaje_diferencia || 0).toFixed(2)}%`,
            r.monto_cobro ? r.monto_cobro.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '$0.00'
        ]),
        styles:           { fontSize: 7.5, cellPadding: 2.5 },
        headStyles:       { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        columnStyles: { 9: { fontStyle: 'bold', textColor: [185, 28, 28] } }
    });

    const total   = records.reduce((s, r) => s + (r.monto_cobro || 0), 0);
    const finalY  = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text(`TOTAL A COBRAR: ${total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`, 14, finalY);

    doc.save(`desvios_combustible_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ================================================================
// UTILITARIOS
// ================================================================

async function markExpiredAuthorizations() {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await supabase
        .from('cargas_combustible')
        .update({ status: 'vencido' })
        .eq('status', 'pendiente_carga')
        .lt('creado_en', cutoff);
}

// ================================================================
// EDICIÓN Y ELIMINACIÓN (HISTORIAL)
// ================================================================

function openEditHistoryModal(record) {
    const container = document.getElementById('fuel-modal-container');
    const modal     = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] fade-in';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl w-full max-w-lg shadow-2xl mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div class="bg-blue-600 text-white p-5">
                <h3 class="text-xl font-black">Editar Registro (Historial)</h3>
                <p class="text-blue-100 text-sm mt-1">Folio: ${record.id.slice(0,8).toUpperCase()}</p>
            </div>
            <div class="p-6 space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">LITROS BOMBA</label>
                        <input type="number" id="edit-bomba" class="w-full border-2 border-gray-200 p-2 rounded-xl bg-gray-50 font-bold" min="0" step="0.001" value="${record.litros_bomba || 0}" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">LITROS BOSON</label>
                        <input type="number" id="edit-boson" class="w-full border-2 border-gray-200 p-2 rounded-xl bg-gray-50 font-bold" min="0" step="0.001" value="${record.litros_boson || 0}" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">PRECIO/LITRO</label>
                        <input type="number" id="edit-precio" class="w-full border-2 border-gray-200 p-2 rounded-xl bg-gray-50 font-bold" min="0" step="0.01" value="${record.precio_litro || 0}" />
                    </div>
                    <div class="col-span-full">
                        <label class="block text-xs font-bold text-gray-500 mb-1">EVIDENCIAS FOTOGRÁFICAS (Hasta 3)</label>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div class="border-2 border-gray-200 p-2 rounded-xl bg-gray-50">
                                <label class="block text-[10px] text-gray-500 font-bold mb-1">Evidencia 1</label>
                                <input type="file" id="edit-evidencia-1" accept="image/*" class="w-full text-[10px]" />
                                ${record.evidencia_url ? `<div class="mt-2 flex items-center justify-between"><a href="${record.evidencia_url}" target="_blank" class="text-[10px] text-blue-600 underline">Ver actual</a><label class="text-[10px] text-red-600 font-bold cursor-pointer"><input type="checkbox" id="del-ev-1"> Eliminar</label></div>` : ''}
                            </div>
                            <div class="border-2 border-gray-200 p-2 rounded-xl bg-gray-50">
                                <label class="block text-[10px] text-gray-500 font-bold mb-1">Evidencia 2</label>
                                <input type="file" id="edit-evidencia-2" accept="image/*" class="w-full text-[10px]" />
                                ${record.evidencia_url_2 ? `<div class="mt-2 flex items-center justify-between"><a href="${record.evidencia_url_2}" target="_blank" class="text-[10px] text-blue-600 underline">Ver actual</a><label class="text-[10px] text-red-600 font-bold cursor-pointer"><input type="checkbox" id="del-ev-2"> Eliminar</label></div>` : ''}
                            </div>
                            <div class="border-2 border-gray-200 p-2 rounded-xl bg-gray-50">
                                <label class="block text-[10px] text-gray-500 font-bold mb-1">Evidencia 3</label>
                                <input type="file" id="edit-evidencia-3" accept="image/*" class="w-full text-[10px]" />
                                ${record.evidencia_url_3 ? `<div class="mt-2 flex items-center justify-between"><a href="${record.evidencia_url_3}" target="_blank" class="text-[10px] text-blue-600 underline">Ver actual</a><label class="text-[10px] text-red-600 font-bold cursor-pointer"><input type="checkbox" id="del-ev-3"> Eliminar</label></div>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">UBICACIÓN (Maps URL)</label>
                    <input type="text" id="edit-ubicacion" class="w-full border-2 border-gray-200 p-2 rounded-xl bg-gray-50" value="${record.ubicacion_url || ''}" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">NOTAS</label>
                    <input type="text" id="edit-notas" class="w-full border-2 border-gray-200 p-2 rounded-xl bg-gray-50" value="${record.notas || ''}" />
                </div>
                <div class="flex gap-3 pt-4">
                    <button class="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition" onclick="this.closest('.fixed').remove()">Cancelar</button>
                    <button id="btn-save-edit" class="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg transition flex justify-center items-center gap-2">
                        <i class="fas fa-save"></i> Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    `;

    container.appendChild(modal);

    document.getElementById('btn-save-edit').addEventListener('click', async () => {
        const btn = document.getElementById('btn-save-edit');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const bomba = parseFloat(document.getElementById('edit-bomba').value) || 0;
        const boson = parseFloat(document.getElementById('edit-boson').value) || 0;
        const precio = parseFloat(document.getElementById('edit-precio').value) || 0;
        const ubicacion = document.getElementById('edit-ubicacion').value.trim();
        const notas = document.getElementById('edit-notas').value.trim();
        const f1 = document.getElementById('edit-evidencia-1')?.files[0];
        const f2 = document.getElementById('edit-evidencia-2')?.files[0];
        const f3 = document.getElementById('edit-evidencia-3')?.files[0];
        const filesArray = [f1, f2, f3];

        let urls = [record.evidencia_url || null, record.evidencia_url_2 || null, record.evidencia_url_3 || null];

        // Handle deletions
        if (document.getElementById('del-ev-1')?.checked) urls[0] = null;
        if (document.getElementById('del-ev-2')?.checked) urls[1] = null;
        if (document.getElementById('del-ev-3')?.checked) urls[2] = null;

        if (filesArray && filesArray.length > 0) {
            for (let i = 0; i < 3; i++) {
                if (filesArray[i]) {
                    const f = filesArray[i];
                    const ext = f.name.split('.').pop();
                    const fileName = `${record.id}_${Date.now()}_${i}.${ext}`;
                    const { error: uploadError } = await supabase.storage.from('evidencias').upload(`combustible/${fileName}`, f);
                    if (!uploadError) {
                        const { data: publicData } = supabase.storage.from('evidencias').getPublicUrl(`combustible/${fileName}`);
                        if (publicData) urls[i] = publicData.publicUrl;
                    } else {
                        console.warn(`Error subiendo evidencia ${i+1}:`, uploadError);
                    }
                }
            }
        }

        const diferencia = boson - bomba;
        const porcentaje = Math.abs(diferencia / (bomba || 1)) * 100;
        let semaforo = 'verde';
        if (diferencia < 0 && porcentaje > 2 && porcentaje <= 4) semaforo = 'amarillo';
        else if (diferencia < 0 && porcentaje > 4) semaforo = 'rojo';
        
        const monto = semaforo === 'rojo' ? Math.abs(diferencia) * precio : 0;

        const { error } = await supabase.from('cargas_combustible').update({
            litros_bomba: bomba,
            litros_boson: boson,
            precio_litro: precio,
            diferencia_litros: diferencia,
            porcentaje_diferencia: porcentaje,
            semaforo: semaforo,
            monto_cobro: monto,
            ubicacion_url: ubicacion,
            notas: notas,
            evidencia_url: urls[0],
            evidencia_url_2: urls[1],
            evidencia_url_3: urls[2]
        }).eq('id', record.id);

        if (error) {
            Swal.fire('Error', error.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        } else {
            modal.remove();
            applyHistoryFilters();
            Swal.fire({ icon: 'success', title: 'Registro actualizado', timer: 1500, showConfirmButton: false });
        }
    });
}

async function deleteHistoryRecord(id) {
    const { value: password } = await Swal.fire({
        title: 'Eliminar Registro',
        text: 'Ingrese la contraseña de seguridad para confirmar:',
        input: 'password',
        inputPlaceholder: 'Contraseña',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonText: 'Cancelar'
    });

    if (!password) return;

    if (password !== 'BORRAR') {
        Swal.fire('Error', 'Contraseña incorrecta', 'error');
        return;
    }

    const { error } = await supabase.from('cargas_combustible').delete().eq('id', id);
    if (error) {
        Swal.fire('Error', error.message, 'error');
    } else {
        Swal.fire('Eliminado', 'El registro ha sido eliminado correctamente', 'success');
        applyHistoryFilters();
    }
}

async function printHistoryReport(record) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('REPORTE INDIVIDUAL DE CARGA Y DESVÍO', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 105, 26, { align: 'center' });
    
    doc.setDrawColor(200);
    doc.line(15, 30, 195, 30);

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('DATOS DE LA CARGA', 15, 40);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const fechaStr = new Date(record.fecha_carga).toLocaleString('es-MX');
    
    doc.text(`Folio: #${record.id.slice(0,8).toUpperCase()}`, 15, 48);
    doc.text(`Fecha: ${fechaStr}`, 15, 54);
    doc.text(`Unidad: ${record.units?.economic_number || record.unidad_eco_txt || '—'} (${record.units?.type || ''})`, 15, 60);
    doc.text(`Operador: ${record.operators?.name}`, 15, 66);
    if (record.remolque) doc.text(`Remolque: ${record.remolque}`, 15, 72);

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('ANÁLISIS DE COMBUSTIBLE', 110, 40);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Capacidad del Tanque: ${record.capacidad_maxima || 0} L`, 110, 48);
    doc.text(`Litros Autorizados: ${(record.litros_autorizar||0).toFixed(2)} L`, 110, 54);
    doc.text(`Precio por Litro: $${record.precio_litro || 0}`, 110, 60);
    
    doc.line(15, 80, 195, 80);

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('RESULTADO (BOMBA VS SENSOR)', 15, 90);
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Litros Despachados (Bomba): ${(record.litros_bomba||0).toFixed(2)} L`, 15, 98);
    doc.text(`Litros Recibidos (BOSON): ${(record.litros_boson||0).toFixed(2)} L`, 15, 104);
    
    doc.setFont(undefined, 'bold');
    const diff = (record.diferencia_litros||0);
    doc.text(`Diferencia: ${diff > 0 ? '+' : ''}${diff.toFixed(2)} L`, 110, 98);
    doc.text(`Porcentaje de Desvío: ${(record.porcentaje_diferencia||0).toFixed(2)}%`, 110, 104);

    let sColor = [0,0,0], sText = '';
    if (record.semaforo === 'verde') { sColor = [22,163,74]; sText = diff > 0 ? 'A FAVOR / OK' : 'DENTRO DE TOLERANCIA'; }
    else if (record.semaforo === 'amarillo') { sColor = [202,138,4]; sText = 'EN REVISIÓN - Faltante'; }
    else { sColor = [220,38,38]; sText = 'FALTANTE CONFIRMADO'; }

    doc.setTextColor(sColor[0], sColor[1], sColor[2]);
    doc.text(`ESTADO: ${sText}`, 15, 114);
    
    if (record.monto_cobro > 0) {
        doc.text(`MONTO A COBRAR: $${record.monto_cobro.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`, 110, 114);
    }
    doc.setTextColor(0);

    doc.line(15, 122, 195, 122);

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('OBSERVACIONES', 15, 132);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(record.notas || 'Sin notas.', 15, 140, { maxWidth: 170 });

    let yOffset = 160;
    const urls = [record.evidencia_url, record.evidencia_url_2, record.evidencia_url_3].filter(Boolean);

    if (urls.length > 0) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('EVIDENCIA FOTOGRÁFICA', 15, yOffset);
        yOffset += 5;

        for (let i = 0; i < urls.length; i++) {
            try {
                const imgData = await new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.src = urls[i];
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/jpeg'));
                    };
                    img.onerror = () => resolve(null);
                });
                if (imgData) {
                    if (yOffset > 200) {
                        doc.addPage();
                        yOffset = 20;
                    }
                    doc.addImage(imgData, 'JPEG', 15, yOffset, 80, 80, undefined, 'FAST');
                    yOffset += 85;
                }
            } catch (e) {
                console.error(e);
            }
        }
    }

    doc.save(`Reporte_Carga_${record.units?.economic_number || record.unidad_eco_txt || '—'}_${record.id.slice(0,6)}.pdf`);
}
