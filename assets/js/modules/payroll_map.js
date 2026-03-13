import { supabase } from '../services/supabaseClient.js';
import { GOOGLE_MAPS_API_KEY } from '../config/config.js';
import { getHeavyVehicleRouteWithAI, estimateTollsWithAI } from '../services/gemini.js';

let map = null;
let directionsService = null;
let directionsRenderer = null;
let geocoder = null;
let infoWindow = null;
let waypointCount = 0;

export function renderPayrollMap(container) {
    container.innerHTML = `
        <div class="h-full flex flex-col md:flex-row bg-[#020617] p-2 gap-2 fade-in font-sans text-[13px] text-white overflow-hidden">
            
            <!-- Panel Izquierdo: Creador Avanzado de Rutas (Ultra Contrast) -->
            <div class="w-full md:w-[460px] bg-slate-900 border border-slate-700 flex flex-col overflow-hidden rounded-xl shadow-2xl h-full max-h-[92vh]">
                
                <!-- Navegación por Tabs (Premium Stylized) -->
                <div class="flex bg-slate-950 p-1 border-b border-slate-700">
                    <button id="tab-btn-creator" class="tab-btn flex-1 py-3 text-[10px] font-black uppercase tracking-tighter transition-all rounded-lg bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" data-tab="tab-crear-ruta">
                        <i class="fas fa-drafting-compass mr-2"></i> Diseñar Ruta
                    </button>
                    <button id="tab-btn-report" class="tab-btn flex-1 py-3 text-[10px] font-black uppercase tracking-tighter transition-all rounded-lg text-slate-500 hover:text-slate-300" data-tab="tab-reporte-ruta">
                        <i class="fas fa-chart-pie mr-2"></i> Análisis Ruta
                    </button>
                    <button id="tab-btn-security" class="tab-btn flex-1 py-3 text-[10px] font-black uppercase tracking-tighter transition-all rounded-lg text-slate-500 hover:text-slate-300" data-tab="tab-seguridad">
                        <i class="fas fa-shield-alt mr-2"></i> Seguridad
                    </button>
                </div>
                
                <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 bg-slate-900">
                    
                    <!-- TAB 1: CREACIÓN -->
                    <div id="tab-crear-ruta" class="space-y-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                <div class="w-1 h-3 bg-emerald-500 rounded-full"></div> CONFIGURACIÓN DE TRANSPORTE
                            </label>
                            <select id="map-unit-type" class="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-inner outline-none">
                                <option value="t3s2">Tracto Sencillo (T3-S2) - 45T</option>
                                <option value="t3s3">Tracto Sencillo (T3-S3) - 50T</option>
                                <option value="t3s2r4">Tracto Full (T3-S2-R4) - 75T</option>
                                <option value="t3s3r2">Tracto Full (T3-S3-R2) - 75T</option>
                                <option value="c3r3" selected>Tracto Full (C3-R3) - 75T</option>
                                <option value="thor">Unidad Liviana (L2) - 3.5T</option>
                            </select>
                        </div>

                        <div class="space-y-4 pt-2">
                            <label class="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                <div class="w-1 h-3 bg-emerald-500 rounded-full"></div> PARÁMETROS OPERATIVOS
                            </label>
                            
                            <div class="grid grid-cols-2 gap-3">
                                <div class="flex flex-col gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700 shadow-sm">
                                    <label class="flex items-center gap-3 cursor-pointer group">
                                        <div class="relative flex items-center">
                                            <input type="checkbox" id="pref-avoid-tolls" class="peer hidden">
                                            <div class="w-5 h-5 border-2 border-slate-600 rounded-md peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all flex items-center justify-center">
                                                <i class="fas fa-check text-[10px] text-white scale-0 peer-checked:scale-100 transition-transform"></i>
                                            </div>
                                        </div>
                                        <span class="text-xs font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">Evitar Casetas</span>
                                    </label>
                                    <label class="flex items-center gap-3 cursor-pointer group">
                                        <div class="relative flex items-center">
                                            <input type="checkbox" id="pref-avoid-ferries" class="peer hidden" checked>
                                            <div class="w-5 h-5 border-2 border-slate-600 rounded-md peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all flex items-center justify-center">
                                                <i class="fas fa-check text-[10px] text-white scale-0 peer-checked:scale-100 transition-transform"></i>
                                            </div>
                                        </div>
                                        <span class="text-xs font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">Evitar Ferrys</span>
                                    </label>
                                </div>
                                <div class="flex flex-col gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700 shadow-sm">
                                    <label class="flex items-center gap-3 cursor-pointer group">
                                        <div class="relative flex items-center">
                                            <input type="checkbox" id="pref-heavy-vehicle" class="peer hidden" checked>
                                            <div class="w-5 h-5 border-2 border-slate-600 rounded-md peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all flex items-center justify-center">
                                                <i class="fas fa-check text-[10px] text-white scale-0 peer-checked:scale-100 transition-transform"></i>
                                            </div>
                                        </div>
                                        <span class="text-xs font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">Ruta Pesada</span>
                                    </label>
                                    <label class="flex items-center gap-3 cursor-pointer group">
                                        <div class="relative flex items-center">
                                            <input type="checkbox" id="pref-opt-nom" class="peer hidden" checked>
                                            <div class="w-5 h-5 border-2 border-slate-600 rounded-md peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all flex items-center justify-center">
                                                <i class="fas fa-check text-[10px] text-white scale-0 peer-checked:scale-100 transition-transform"></i>
                                            </div>
                                        </div>
                                        <span class="text-xs font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">Opt. NOM-012</span>
                                    </label>
                                </div>
                                
                                <div class="col-span-2 pt-2 border-t border-slate-700 mt-2 flex flex-col gap-4">
                                    <div class="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700">
                                        <span class="text-[11px] font-black text-slate-200 uppercase tracking-tighter">Velocidad Crucero:</span>
                                        <div class="flex items-center bg-slate-900 rounded-lg border border-slate-600 p-1">
                                             <button id="btn-speed-down" class="w-8 h-8 flex items-center justify-center rounded text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-xl font-black">-</button>
                                             <input type="number" id="map-speed" value="70" class="w-12 bg-transparent text-center text-sm text-emerald-400 font-black focus:outline-none" readonly>
                                             <button id="btn-speed-up" class="w-8 h-8 flex items-center justify-center rounded text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-xl font-black">+</button>
                                        </div>
                                    </div>
                                    
                                    <div class="grid grid-cols-2 gap-3">
                                        <div class="bg-slate-950 p-3 rounded-xl border border-slate-700 shadow-inner text-center">
                                            <p class="text-[9px] text-emerald-400 uppercase font-black tracking-widest mb-1">Diesel (Km/L)</p>
                                            <input type="number" id="pref-kpl" value="2.5" step="0.1" class="w-full bg-slate-800 border-none rounded text-white font-black text-center focus:ring-0">
                                        </div>
                                        <div class="bg-slate-950 p-3 rounded-xl border border-slate-700 shadow-inner text-center">
                                            <p class="text-[9px] text-emerald-400 uppercase font-black tracking-widest mb-1">Ejes Totales</p>
                                            <input type="number" id="map-axles" value="6" class="w-full bg-slate-800 border-none rounded text-white font-black text-center focus:ring-0">
                                        </div>
                                        <div class="bg-slate-950 p-3 rounded-xl border border-slate-700 shadow-inner col-span-2 text-center">
                                            <p class="text-[9px] text-emerald-400 uppercase font-black tracking-widest mb-1">Peso Bruto Vehicular (Ton PBV)</p>
                                            <input type="number" id="map-weight" value="75" class="w-full bg-slate-800 border-none rounded text-white font-black text-center focus:ring-0">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-4 pt-2">
                             <label class="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                <div class="w-1 h-3 bg-emerald-500 rounded-full"></div> PLAN DE RUTA (WAYPOINTS)
                            </label>
                            
                            <div class="bg-slate-800 rounded-2xl border border-slate-600 overflow-hidden shadow-xl">
                                <div class="p-4 space-y-4">
                                    <div class="flex items-center gap-3">
                                        <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse outline outline-emerald-500/30"></div>
                                        <input type="text" id="map-origen" class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-all" placeholder="Origen de despacho...">
                                    </div>
                                    
                                    <div id="waypoints-container" class="space-y-3"></div>
                                    
                                    <div class="flex items-center gap-3">
                                        <div class="w-3 h-3 rounded-full bg-rose-500 outline outline-rose-500/30"></div>
                                        <input type="text" id="map-destino" class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-all" placeholder="Destino final...">
                                    </div>
                                </div>
                                <button id="btn-add-waypoint" class="w-full py-4 bg-slate-750 hover:bg-slate-700 text-[10px] font-black text-slate-300 hover:text-white transition-all flex items-center justify-center gap-3 border-t border-slate-600 uppercase">
                                    <i class="fas fa-plus-circle text-emerald-500"></i> AÑADIR PARADA ESTRATÉGICA...
                                </button>
                            </div>
                        </div>

                        <div class="flex gap-4 pt-4 pb-8">
                            <button id="btn-calc-route" class="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-4 rounded-xl shadow-xl shadow-emerald-900/40 active:scale-95 transition-all text-[11px] uppercase tracking-widest flex items-center justify-center gap-3">
                                <i class="fas fa-route text-lg"></i> GENERAR RUTA REAL
                            </button>
                            <button id="btn-clear-route" class="w-16 bg-slate-800 hover:bg-rose-900 border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center rounded-xl transition-all active:scale-95 group">
                                <i class="fas fa-trash-alt group-hover:animate-bounce"></i>
                            </button>
                        </div>
                    </                    <!-- TAB 2: REPORTE RUTA -->
                    <div id="tab-reporte-ruta" class="space-y-6 hidden">
                        <div class="bg-emerald-600/10 border border-emerald-500/40 rounded-xl p-5 shadow-2xl">
                             <div class="flex flex-col gap-4">
                                 <div class="flex items-center gap-4">
                                     <div class="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white border border-emerald-500 shadow-lg font-black italic">A</div>
                                     <div class="flex-1">
                                         <p class="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Punto de Partida</p>
                                         <p class="text-white text-sm font-black truncate" id="rep-origen">No Definido</p>
                                     </div>
                                 </div>
                                 <div class="w-px h-6 bg-emerald-500/30 ml-5 border-l-2 border-dashed border-emerald-500/50"></div>
                                 <div class="flex items-center gap-4">
                                     <div class="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white border border-rose-500 shadow-lg font-black italic">B</div>
                                     <div class="flex-1">
                                         <p class="text-[10px] text-rose-400 font-black uppercase tracking-widest">Destino Logístico</p>
                                         <p class="text-white text-sm font-black truncate" id="rep-destino">No Definido</p>
                                     </div>
                                 </div>
                             </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                              <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl text-center">
                                  <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 text-center">Recorrido</p>
                                  <p class="text-3xl font-black text-white" id="rep-dist-total">0 <span class="text-xs font-normal text-slate-500 uppercase tracking-tighter">km</span></p>
                                  <span id="rep-dist-vacio" class="hidden">0</span>
                              </div>
                              <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl text-center">
                                  <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 text-center">ETA</p>
                                  <p class="text-3xl font-black text-indigo-400" id="rep-time-total">0:00 <span class="text-xs font-normal text-slate-500 uppercase tracking-tighter">h</span></p>
                              </div>
                        </div>

                        <div class="bg-slate-950 rounded-2xl border-2 border-slate-700 overflow-hidden shadow-2xl">
                             <div class="px-5 py-4 bg-slate-800 flex justify-between items-center border-b border-slate-700">
                                 <span class="text-xs font-black text-white uppercase tracking-widest">Costeo Operativo</span>
                                 <span class="text-lg font-black text-emerald-400" id="rep-cost-total">$0.00</span>
                             </div>
                             <div class="p-5 space-y-4">
                                 <div class="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                                     <div class="flex items-center gap-3 text-slate-300 font-bold"><i class="fas fa-road text-amber-500"></i> Peajes</div>
                                     <span id="rep-cost-tolls" class="text-white font-black">$0.00</span>
                                 </div>
                                 <div class="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                                     <div class="flex items-center gap-3 text-slate-300 font-bold"><i class="fas fa-gas-pump text-blue-500"></i> Combustible</div>
                                     <span id="rep-cost-fuel" class="text-white font-black">$0.00</span>
                                 </div>
                                 <div class="flex justify-between items-center text-sm">
                                     <div class="flex items-center gap-3 text-slate-300 font-bold"><i class="fas fa-user-tie text-indigo-500"></i> Operador</div>
                                     <span id="rep-cost-driver" class="text-white font-black">$0.00</span>
                                 </div>
                             </div>
                        </div>

                        <div class="grid grid-cols-1 gap-4 pb-10">
                             <button id="btn-show-tolls-list" class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 transition-all">
                                 <i class="fas fa-list-ol text-emerald-500"></i> Listado de Casetas
                             </button>
                             <button id="btn-ai-audit" class="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white py-6 rounded-2xl shadow-2xl transition-all flex items-center justify-center gap-4">
                                 <i class="fas fa-microchip text-2xl animate-pulse"></i>
                                 <span class="text-sm font-black uppercase tracking-widest">Auditoría Inteligente Gemini</span>
                             </button>
                        </div>
                    </div>
                </div>
            </div>
       </div>        </div>

            <!-- Panel Derecho: Google Maps (Ultra Clarity) -->
            <div class="flex-1 relative bg-[#020617] rounded-xl border border-slate-700 overflow-hidden shadow-2xl min-h-[550px] md:min-h-0">
                <div id="map-canvas" class="w-full h-full" style="min-height: 550px; background-color: #020617;"></div>
                
                <div id="map-loading" class="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-10 flex flex-col items-center justify-center text-white gap-4 hidden">
                    <div class="spinner border-t-emerald-500 w-16 h-16"></div>
                    <div class="text-lg font-black tracking-widest animate-pulse uppercase text-emerald-400">Trazando Ruta Logística...</div>
                </div>

                <!-- Legend Overlay -->
                <div class="absolute bottom-6 right-6 bg-slate-900/95 border border-slate-700 p-5 rounded-2xl shadow-2xl backdrop-blur-xl z-10 hidden md:block">
                    <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">Simbología Federal</div>
                    <div class="space-y-3">
                        <div class="flex items-center gap-3">
                            <div class="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20"></div>
                            <span class="text-[10px] font-black text-slate-200">TRAZO SEGURO</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="w-3 h-3 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/20"></div>
                            <span class="text-[10px] font-black text-slate-200">FEDERAL / CUOTA</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="w-3 h-3 rounded-full bg-amber-500 shadow-lg shadow-amber-500/20"></div>
                            <span class="text-[10px] font-black text-slate-200">CASETA AUTORIZADA</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Caseta Modal Container (Premium Dark) -->
        <div id="modal-casetas" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] hidden flex items-center justify-center p-4">
            <div class="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
                <!-- Modal Header -->
                <div class="bg-slate-800/50 border-b border-white/5 flex justify-between items-center px-5 py-4">
                    <div class="flex items-center gap-3">
                         <div class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                         <span class="font-bold text-slate-100 text-base tracking-tight">Desglose de Peajes Autorizados</span>
                    </div>
                    <button class="modal-casetas-close w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white transition-all">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <!-- Modal Content -->
                <div class="p-4 flex-1 overflow-hidden flex flex-col">
                    <div class="bg-indigo-600/10 border border-indigo-500/20 rounded-xl mb-4 p-4 flex justify-between items-center">
                         <div class="flex flex-col">
                             <span class="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Inversión en Trayecto</span>
                             <span class="text-xs text-slate-400">Ruta Tarifada Oficialmente</span>
                         </div>
                         <span class="font-black text-slate-100 text-2xl" id="casetas-gran-total">$0.00</span>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/50 custom-scrollbar">
                        <table class="w-full text-xs text-left">
                            <thead class="bg-slate-800/50 border-b border-slate-700 text-slate-400 font-bold sticky top-0">
                                <tr>
                                    <th class="py-3 px-4 w-12 text-center"><i class="fas fa-hashtag text-[10px]"></i></th>
                                    <th class="py-3 px-2">Plaza de Cobro / Caseta</th>
                                    <th class="py-3 px-2 text-right">Tramo</th>
                                    <th class="py-3 px-2 text-center italic">ETA</th>
                                    <th class="py-3 px-4 text-right text-emerald-400">Tarifa</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-white/5 text-slate-300" id="casetas-table-body">
                                <tr><td colspan="5" class="py-12 text-center text-slate-600 italic font-black uppercase tracking-tighter">No hay registros dinámicos aún.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <!-- Modal Footer -->
                <div class="px-5 py-4 bg-slate-800/50 border-t border-white/5 flex justify-end">
                    <button class="modal-casetas-close px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-lg transition-all text-xs uppercase tracking-widest">
                        Cerrar Desglose
                    </button>
                </div>
            </div>
        </div>
    `;

    initMap();
    bindWaypointLogic();
    bindTabsAndUI();
    
    document.getElementById('btn-calc-route').addEventListener('click', calculateMapRoute);
    document.getElementById('btn-clear-route').addEventListener('click', clearMapRoute);
    
    // Check for both possible IDs (new and old) to ensure compatibility
    const btnShowTollsList = document.getElementById('btn-show-tolls-list');
    const btnShowTollsOld = document.getElementById('btn-show-tolls');
    if (btnShowTollsList) btnShowTollsList.addEventListener('click', openTollsModal);
    if (btnShowTollsOld) btnShowTollsOld.addEventListener('click', openTollsModal);

    document.querySelectorAll('.modal-casetas-close').forEach(btn => {
        btn.addEventListener('click', closeTollsModal);
    });

    const btnShareWA = document.getElementById('btn-share-whatsapp');
    if (btnShareWA) btnShareWA.addEventListener('click', shareRouteWhatsApp);

    // AI Audit Button
    const btnAiAudit = document.getElementById('btn-ai-audit');
    if (btnAiAudit) {
        btnAiAudit.addEventListener('click', () => {
             const data = window.currentRouteData;
             if (!data || !data.origen || !data.destino) {
                 Swal.fire({
                     icon: 'info',
                     title: 'Sin Datos de Ruta',
                     text: 'Primero debe trazar una ruta en el primer tab para auditar.',
                     confirmButtonColor: '#4f46e5'
                 });
                 return;
             }
             
             Swal.fire({
                 title: 'Auditoría Inteligente NOM-012',
                 html: '<div class="text-center py-6"><div class="spinner-border text-indigo-500 mb-4 h-10 w-10 border-4 border-t-transparent animate-spin rounded-full inline-block"></div><p class="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Analizando rutas, pesos y clasificaciones SCT...</p></div>',
                 showConfirmButton: false,
                 allowOutsideClick: false,
                 background: '#020617',
                 color: '#f8fafc'
             });

             if (window.generateLogisticsReportAI) {
                 window.generateLogisticsReportAI(data.origen, data.destino, data.waypointNames, data.unitTypeName)
                 .then(html => {
                     Swal.fire({
                         width: '850px',
                         html: `<div class="bg-[#020617] text-slate-200 p-2 text-left">${html}</div>`,
                         confirmButtonText: '<i class="fas fa-check"></i> Entendido',
                         confirmButtonColor: '#4f46e5',
                         background: '#020617',
                         color: '#f8fafc'
                     });
                 })
                 .catch(err => {
                     console.error(err);
                     Swal.fire({
                         icon: 'error',
                         title: 'Falla en IA',
                         text: 'No se pudo generar la auditoría en este momento.',
                         background: '#020617',
                         color: '#f8fafc'
                     });
                 });
             }
        });
    }

    // Initialize state
    window.currentRouteData = {
        origen: '',
        destino: '',
        waypointNames: [],
        distance: 0,
        unitTypeName: 'Tractocamión Full (C3-R3)'
    };
}

function bindTabsAndUI() {
    const tabCreateBtn = document.getElementById('tab-btn-create');
    const tabReportBtn = document.getElementById('tab-btn-report');
    const tabPointsBtn = document.getElementById('tab-btn-points');
    
    const tabCreateContent = document.getElementById('tab-crear-ruta');
    const tabReportContent = document.getElementById('tab-reporte-ruta');

    function switchTab(activeBtn, activeContent) {
        // Reset buttons
        [tabCreateBtn, tabReportBtn, tabPointsBtn].forEach(btn => {
            btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-lg', 'shadow-indigo-500/20');
            btn.classList.add('text-slate-400', 'hover:bg-slate-800/80', 'hover:text-slate-200');
        });
        
        // Hide contents
        tabCreateContent.classList.add('hidden');
        tabReportContent.classList.add('hidden');
        
        // Set active
        activeBtn.classList.remove('text-slate-400', 'hover:bg-slate-800/80', 'hover:text-slate-200');
        activeBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-lg', 'shadow-indigo-500/20');
        if(activeContent) activeContent.classList.remove('hidden');
    }

    tabCreateBtn.addEventListener('click', () => switchTab(tabCreateBtn, tabCreateContent));
    tabReportBtn.addEventListener('click', () => switchTab(tabReportBtn, tabReportContent));
    tabPointsBtn.addEventListener('click', () => switchTab(tabPointsBtn, null));

    // Speed controls
    const speedInput = document.getElementById('map-speed');
    document.getElementById('btn-speed-up').addEventListener('click', () => {
        speedInput.value = parseInt(speedInput.value || 70) + 5;
    });
    document.getElementById('btn-speed-down').addEventListener('click', () => {
        speedInput.value = Math.max(10, parseInt(speedInput.value || 70) - 5);
    });
}

function clearMapRoute() {
    document.getElementById('map-origen').value = '';
    document.getElementById('map-destino').value = '';
    document.getElementById('waypoints-container').innerHTML = '';
    if (directionsRenderer) directionsRenderer.setDirections({routes: []});
    if (window.tollMarkers) {
        window.tollMarkers.forEach(m => m.setMap(null));
    }
    window.tollMarkers = [];
}

window.removeWaypoint = (btn) => {
    btn.parentElement.remove();
};

function bindWaypointLogic() {
    const btnAdd = document.getElementById('btn-add-waypoint');
    const container = document.getElementById('waypoints-container');
    
    btnAdd.addEventListener('click', () => {
        waypointCount++;
        const id = `waypoint-${waypointCount}`;
        const div = document.createElement('div');
        div.className = 'px-4 py-2 bg-slate-900/10 flex items-center gap-3 border-b border-white/5 fade-in';
        div.innerHTML = `
            <div class="w-1 h-1 rounded-full bg-slate-600"></div>
            <div class="flex-1 relative">
                <input type="text" id="${id}" class="waypoint-input bg-transparent w-full py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none" placeholder="Parada intermedia...">
            </div>
            <button class="text-slate-600 hover:text-rose-400 transition" onclick="window.removeWaypoint(this)" title="Eliminar"><i class="fas fa-times"></i></button>
        `;
        container.appendChild(div);
        
        if (window.google && window.google.maps && window.google.maps.places) {
            new google.maps.places.Autocomplete(document.getElementById(id), { componentRestrictions: { country: 'mx' }});
        }
    });
}

function initMap() {
    if (typeof google === 'undefined') {
        Swal.fire('Error', 'Google Maps API no pudo cargar. Verifique su conexión y API Key.', 'error');
        return;
    }

    const mexicoCenter = { lat: 23.6345, lng: -102.5528 };
    map = new google.maps.Map(document.getElementById('map-canvas'), {
        zoom: 5,
        center: mexicoCenter,
        mapId: '62e666a4666cf647', // ID for advanced markers
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
    });

    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        draggable: true, // Habilitar arrastre de ruta
        polylineOptions: {
            strokeColor: '#4f46e5',
            strokeOpacity: 0.8,
            strokeWeight: 6
        }
    });

    geocoder = new google.maps.Geocoder();
    infoWindow = new google.maps.InfoWindow();

    // Map click event to see what's there
    map.addListener('click', (e) => {
        geocodeLatLng(e.latLng);
    });

    // Escuchar cuando el usuario arrastre y modifique la ruta
    directionsRenderer.addListener('directions_changed', () => {
        const result = directionsRenderer.getDirections();
        if (result) {
            recalculateTotalsFromDraggedRoute(result);
        }
    });

    // Setup autocomplete
    const inputOrigen = document.getElementById('map-origen');
    const inputDestino = document.getElementById('map-destino');
    new google.maps.places.Autocomplete(inputOrigen, { componentRestrictions: { country: 'mx' }});
    new google.maps.places.Autocomplete(inputDestino, { componentRestrictions: { country: 'mx' }});
}

function calculateMapRoute() {
    const origen = document.getElementById('map-origen').value;
    const destino = document.getElementById('map-destino').value;

    if (!origen || !destino) {
        Swal.fire('Atención', 'Por favor, ingrese un origen y un destino.', 'warning');
        return;
    }

    const speedKmH = parseFloat(document.getElementById('map-speed').value) || 70;
    const unitTypeOptions = document.getElementById('map-unit-type');
    const unitTypeName = unitTypeOptions.options[unitTypeOptions.selectedIndex].text;

    const waypointInputs = document.querySelectorAll('.waypoint-input');
    const routeWaypoints = [];
    const waypointNames = [];
    waypointInputs.forEach(input => {
        if (input.value.trim()) {
            routeWaypoints.push({
                location: input.value.trim(),
                stopover: true
            });
            waypointNames.push(input.value.trim());
        }
    });

    const loading = document.getElementById('map-loading');
    loading.classList.remove('hidden');

    const request = {
        origin: origen,
        destination: destino,
        waypoints: routeWaypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
        avoidTolls: document.getElementById('pref-avoid-tolls').checked,
        avoidFerries: document.getElementById('pref-avoid-ferries').checked
    };

    directionsService.route(request, async (result, status) => {
        loading.classList.add('hidden');
        if (status == 'OK') {
            directionsRenderer.setDirections(result);
            
            // Remove previous toll markers
            if (window.tollMarkers) window.tollMarkers.forEach(m => m.setMap(null));
            window.tollMarkers = [];
            
            let totalDistanceMeters = 0;
            result.routes[0].legs.forEach(leg => {
                totalDistanceMeters += leg.distance.value;
                // Add basic orange markers for tolls from Google
                leg.steps.forEach(step => {
                    const instructions = step.instructions.toLowerCase();
                    if (instructions.includes('cuota') || instructions.includes('peaje') || instructions.includes('toll')) {
                        const marker = new google.maps.Marker({
                            position: step.start_location,
                            map: map,
                            icon: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
                            title: 'Caseta de Cobro'
                        });
                        window.tollMarkers.push(marker);
                    }
                });
            });
            
            const distanceValueKm = totalDistanceMeters / 1000;
            
            // Time breakdown
            const drivingTimeH = distanceValueKm / speedKmH;
            const stopTimeH = waypointNames.length * 0.5; // Assume 30 mins per stop for now
            const restTimeH = document.getElementById('pref-opt-nom').checked ? Math.floor(drivingTimeH / 5) * 0.5 : 0; // NOM-012 rest (30 min every 5h)
            
            const totalTimeH = drivingTimeH + stopTimeH + restTimeH;
            
            function formatTime(hoursDecimal) {
                const hours = Math.floor(hoursDecimal);
                const minutes = Math.round((hoursDecimal - hours) * 60);
                return `${hours}h:${minutes.toString().padStart(2, '0')}m`;
            }
            
            // Populate Reporte Ruta
            const today = new Date().toLocaleDateString('es-MX');
            const repOrig = document.getElementById('rep-origen');
            const repDest = document.getElementById('rep-destino');
            const repDate = document.getElementById('rep-fecha');
            const repVeh = document.getElementById('rep-vehiculo');
            const repDTotal = document.getElementById('rep-dist-total');
            const repDVacio = document.getElementById('rep-dist-vacio');
            const repTTotal = document.getElementById('rep-time-total');
            const repTDrive = document.getElementById('rep-time-drive');

            if (repOrig) repOrig.textContent = origen;
            if (repDest) repDest.textContent = destino;
            if (repDate) repDate.textContent = today;
            if (repVeh) repVeh.textContent = unitTypeName;
            
            if (repDTotal) repDTotal.textContent = distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 0}) + ' Kms';
            if (repDVacio) repDVacio.textContent = distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 0}) + ' Kms';
            
            if (repTTotal) repTTotal.textContent = formatTime(totalTimeH);
            if (repTDrive) repTDrive.textContent = formatTime(drivingTimeH);
            
            window.currentRouteData = {
                origen, destino, waypointNames, distance: distanceValueKm, unitTypeName
            };
            
            // Switch to Report Tab
            document.getElementById('tab-btn-report').click();
            
            // Trigger AI Tolls & Payroll Calc
            triggerTollCalculationAndPayroll(distanceValueKm, unitTypeName);

        } else {
            console.error("Directions requests failed: ", status);
            Swal.fire('Ruta no encontrada', 'No se pudo trazar la ruta entre estos puntos.', 'error');
        }
    });
}

// Nueva función extraída para calcular casetas y no repetir código al arrastrar
async function triggerTollCalculationAndPayroll(distanceKm, unitTypeName) {
    const origen = window.currentRouteData.origen;
    const destino = window.currentRouteData.destino;
    const waypoints = window.currentRouteData.waypointNames;
    const avoidTolls = document.getElementById('pref-avoid-tolls').checked;

    const repTolls = document.getElementById('rep-cost-tolls');
    if (repTolls) repTolls.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
    
    let tollsCost = 0;

    if (avoidTolls) {
        if (repTolls) repTolls.textContent = '$0.00';
        populateCasetasModal([]);
    } else {
        try {
            // This will be handled by Gemini to get detailed info
            if(window.getDetailedTollsAI) {
                const response = await window.getDetailedTollsAI(origen, destino, waypoints, unitTypeName);
                if (response && response.tolls) {
                    tollsCost = response.totalCost || 0;
                    document.getElementById('rep-cost-tolls').textContent = '$' + tollsCost.toLocaleString('es-MX', {minimumFractionDigits: 2});
                    populateCasetasModal(response.tolls, tollsCost);
                } else {
                    document.getElementById('rep-cost-tolls').textContent = 'Error IA';
                    populateCasetasModal([]);
                }
            } else {
                 document.getElementById('rep-cost-tolls').textContent = 'IA No Lista';
                 populateCasetasModal([]);
            }
        } catch (e) {
            console.error("Error estimando casetas con IA:", e);
            document.getElementById('rep-cost-tolls').textContent = 'Error IA';
            populateCasetasModal([]);
        }
    }

    // Rendimiento/Fuel based on Unit type (approx)
    let kpl = Math.max(1, parseFloat(document.getElementById('pref-kpl').value) || 2.5); // Km/L
    let dieselPrice = 24.50; // Approximated
    let fuelCost = (distanceKm / kpl) * dieselPrice;
    
    // Sueldo/Driver (based on km usually)
    let driverRateKm = document.getElementById('pref-opt-truck').checked ? 1.50 : 1.20; 
    let driverCost = distanceKm * driverRateKm;

    // Maintenance factor per km
    let maintCost = distanceKm * 0.85; 

    // Tires factor per km
    let tiresCost = distanceKm * 0.60;

    const repFuel = document.getElementById('rep-cost-fuel');
    const repDriver = document.getElementById('rep-cost-driver');
    const repMaint = document.getElementById('rep-cost-maint');
    const repTires = document.getElementById('rep-cost-tires');
    const repTotal = document.getElementById('rep-cost-total');
    const repTitCost = document.getElementById('rep-tit-cost');
    const repKm = document.getElementById('rep-cost-km');

    if (repFuel) repFuel.textContent = '$' + fuelCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (repDriver) repDriver.textContent = '$' + driverCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (repMaint) repMaint.textContent = '$' + maintCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (repTires) repTires.textContent = '$' + tiresCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    let masterTotal = tollsCost + fuelCost + driverCost + maintCost + tiresCost;
    if (repTotal) repTotal.textContent = '$' + masterTotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (repTitCost) repTitCost.textContent = '$' + masterTotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 0}) + ' MXN';

    let costPerKm = distanceKm > 0 ? (masterTotal / distanceKm) : 0;
    if (repKm) repKm.textContent = '$' + costPerKm.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    window.currentRouteData.calculatedCosts = {
         tolls: tollsCost, fuel: fuelCost, driver: driverCost, maint: maintCost, tires: tiresCost, total: masterTotal, perKm: costPerKm
    };
}

function populateCasetasModal(tollsArray, totalCost) {
    const tbody = document.getElementById('casetas-table-body');
    const totalSpan = document.getElementById('casetas-gran-total');
    
    if(!tollsArray || tollsArray.length === 0) {
         if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-slate-600 italic">No se detectaron registros de peaje en esta configuración de ruta.</td></tr>`;
         if (totalSpan) totalSpan.textContent = "$0.00";
         return;
    }

    if (totalSpan) totalSpan.textContent = "$" + (totalCost || 0).toLocaleString('es-MX', {minimumFractionDigits: 2});
    
    if (tbody) tbody.innerHTML = '';
    tollsArray.forEach((toll, index) => {
         const tr = document.createElement('tr');
         tr.className = "hover:bg-white/5 transition-colors border-b border-white/5 last:border-0";
         tr.innerHTML = `
             <td class="py-4 px-4 text-center text-slate-500 font-mono text-[10px]">${index + 1}</td>
             <td class="py-4 px-2">
                 <div class="flex flex-col">
                     <span class="font-bold text-slate-200">${toll.name}</span>
                     <span class="text-[9px] text-slate-500 uppercase tracking-tighter">Plaza de Cobro</span>
                 </div>
             </td>
             <td class="py-4 px-2 text-right text-slate-400 font-medium">${toll.distance || '-'} km</td>
             <td class="py-4 px-2 text-center text-slate-500 font-mono uppercase text-[10px]">${toll.time || '-'}</td>
             <td class="py-4 px-4 text-right font-black text-emerald-400">$${(toll.cost || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
         `;
         tbody.appendChild(tr);
    });
}

function recalculateTotalsFromDraggedRoute(result) {
    if (window.tollMarkers) {
        window.tollMarkers.forEach(m => m.map = null);
    }
    window.tollMarkers = [];
    
    let totalDistanceMeters = 0;
    const legWaypoints = [];
    const origen = result.request.origin.query || result.request.origin.location.toString();
    const destino = result.request.destination.query || result.request.destination.location.toString();

    result.routes[0].legs.forEach(leg => {
        totalDistanceMeters += leg.distance.value;
        
        // El usuario al arrastrar crea "vía endpoints" o waypoints implícitos
        // Estos no tienen query de texto directo a veces, usamos location
        if(leg.start_address) legWaypoints.push(leg.start_address);

        leg.steps.forEach(step => {
            const instructions = step.instructions.toLowerCase();
            if (instructions.includes('cuota') || instructions.includes('peaje') || instructions.includes('toll')) {
                const marker = new google.maps.marker.AdvancedMarkerElement({
                    position: step.start_location,
                    map: map,
                    title: 'Caseta de Cobro'
                });

                // Agregar interactividad a la caseta al arrastrar
                marker.addListener('mouseover', () => {
                    infoWindow.setContent(`<div class="p-1"><p class="font-bold text-orange-600 text-xs"><i class="fas fa-ticket-alt"></i> Caseta de Peaje (Modificada)</p><p class="text-[10px] text-gray-500">Punto de cobro detectado en la nueva ruta.</p></div>`);
                    infoWindow.open(map, marker);
                });
                marker.addListener('mouseout', () => {
                    infoWindow.close();
                });

                window.tollMarkers.push(marker);
            }
        });
    });

    const distanceValueKm = totalDistanceMeters / 1000;
    const speedKmH = parseFloat(document.getElementById('map-speed').value) || 70;
    const stopTimeH = legWaypoints.length * 0.5;
    
    const drivingTimeH = distanceValueKm / speedKmH;
    const restTimeH = document.getElementById('pref-opt-nom').checked ? Math.floor(drivingTimeH / 5) * 0.5 : 0;
    const totalTimeH = drivingTimeH + stopTimeH + restTimeH;
    
    function formatTime(hoursDecimal) {
        const h = Math.floor(hoursDecimal);
        const m = Math.round((hoursDecimal - h) * 60);
        return `${h}h:${m.toString().padStart(2, '0')}m`;
    }
    
    // Update Report tab manually since dragged
    const repDistTotal = document.getElementById('rep-dist-total');
    const repDistVacio = document.getElementById('rep-dist-vacio');
    const repTimeTotal = document.getElementById('rep-time-total');
    const repTimeDrive = document.getElementById('rep-time-drive');

    if (repDistTotal) repDistTotal.textContent = distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 0}) + ' Kms';
    if (repDistVacio) repDistVacio.textContent = distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 0}) + ' Kms';
    
    if (repTimeTotal) repTimeTotal.textContent = formatTime(totalTimeH) + ' (Modificado)';
    if (repTimeDrive) repTimeDrive.textContent = formatTime(drivingTimeH);

    // Actualizar datos globales para auditoría
    window.currentRouteData.origen = origen;
    window.currentRouteData.destino = destino;
    window.currentRouteData.distance = distanceValueKm;
    window.currentRouteData.waypointNames = legWaypoints.slice(1, -1); 

    // Volver a calcular casetas con los nuevos puntos arrastrados
    triggerTollCalculationAndPayroll(distanceValueKm, window.currentRouteData.unitTypeName);
}

async function fetchTollsViaRoutesAPI(originStr, destinationStr, waypointsArray) {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    
    const requestBody = {
        origin: { address: originStr },
        destination: { address: destinationStr },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        extraComputations: ["TOLLS"]
    };

    if (waypointsArray && waypointsArray.length > 0) {
        requestBody.intermediates = waypointsArray.map(w => ({
            address: w
        }));
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.travelAdvisory.tollInfo'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errDetails = await response.text();
        console.error("Detalle de Error de Google Routes API V2:", errDetails);
        throw new Error(`Google Routes API V2 Error: ${response.status}`);
    }

    const data = JSON.parse(await response.text());
    
    // Calcula el costo total basado en la moneda local
    let costoTotal = 0;
    let currencyCode = "MXN";

    if (data.routes && data.routes[0] && data.routes[0].travelAdvisory && data.routes[0].travelAdvisory.tollInfo) {
        const tollInfo = data.routes[0].travelAdvisory.tollInfo;
        if (tollInfo.estimatedPrice && tollInfo.estimatedPrice.length > 0) {
            costoTotal = parseFloat(tollInfo.estimatedPrice[0].units) || 0;
            const nanos = tollInfo.estimatedPrice[0].nanos || 0;
            costoTotal += (nanos / 1000000000); // 1 nano = 10^-9
            currencyCode = tollInfo.estimatedPrice[0].currencyCode;
        }
    }

    if(costoTotal === 0) {
        return {
            costoTotalFormatted: "Sin Costo de Casetas Libre de Peaje",
            costoTotalNumerical: 0
        };
    }

    return {
         costoTotalFormatted: new Intl.NumberFormat('es-MX', { style: 'currency', currency: currencyCode }).format(costoTotal) + " " + currencyCode,
         costoTotalNumerical: costoTotal
    };
}

// Modals and Share Logic
function openTollsModal() {
    document.getElementById('modal-casetas').classList.remove('hidden');
}

function closeTollsModal() {
    document.getElementById('modal-casetas').classList.add('hidden');
}

function shareRouteWhatsApp() {
    if(!window.currentRouteData || !window.currentRouteData.origen) {
        Swal.fire('Atención', 'Debe calcular una ruta primero antes de enviarla.', 'warning');
        return;
    }
    
    let text = `*📍 NUEVA ASIGNACIÓN DE RUTA*\n\n`;
    text += `*🚛 Unidad:* ${window.currentRouteData.unitTypeName || 'No esp.'}\n`;
    text += `*🛣️ Origen:* ${window.currentRouteData.origen}\n`;
    text += `*🏁 Destino:* ${window.currentRouteData.destino}\n`;
    
    let mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(window.currentRouteData.origen)}&destination=${encodeURIComponent(window.currentRouteData.destino)}`;

    if(window.currentRouteData.waypointNames && window.currentRouteData.waypointNames.length > 0) {
        text += `\n*🛑 Paradas Obligatorias:*\n`;
        window.currentRouteData.waypointNames.forEach((w,i) => {
             text += `  ${i+1}. ${w}\n`;
        });
        const waypointsStr = window.currentRouteData.waypointNames.join('|');
        mapsUrl += `&waypoints=${encodeURIComponent(waypointsStr)}`;
    }
    
    if(window.currentRouteData.calculatedCosts) {
        text += `\n*💰 Viáticos Asignados:*\n`;
        text += `  Casetas: $${window.currentRouteData.calculatedCosts.tolls.toLocaleString('es-MX', {minimumFractionDigits: 2})}\n`;
        text += `  Diésel Estimado: $${window.currentRouteData.calculatedCosts.fuel.toLocaleString('es-MX', {minimumFractionDigits: 2})}\n`;
    }
    
    text += `\n*🗺️ Ver Ruta en Google Maps:*\n${mapsUrl}\n`;
    
    text += `\nPor favor, confirme de recibido y registre la salida en su App de Operador (EDY). Buen viaje.`;
    
    const encoded = encodeURIComponent(text);
    // Para simplificar, abrir WhatsApp Web/App hacia el usuario
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

async function checkAIRestrictions() {
    const origen = document.getElementById('map-origen').value;
    const destino = document.getElementById('map-destino').value;
    const unitType = document.getElementById('map-unit-type').value;

    if (!origen || !destino) return;

    Swal.fire({
        title: 'Consultando Restricciones SCT...',
        html: '<div class="spinner my-4"></div><p class="text-sm">Analizando trazado de autopistas federales de cuota y compatibilidad de unidad...</p>',
        allowOutsideClick: false,
        showConfirmButton: false
    });

    const routeAI = await getHeavyVehicleRouteWithAI(origen, destino, unitType);

    Swal.fire({
        icon: 'info',
        title: 'Análisis IA (Restricciones SCT)',
        html: `<div class="text-left text-sm bg-purple-50 p-4 border border-purple-100 rounded-xl shadow-inner mt-4 text-purple-900">${routeAI}</div>`,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#8b5cf6',
        width: 600
    });
}

async function runNOM012Analysis() {
    const origen = document.getElementById('map-origen').value;
    const destino = document.getElementById('map-destino').value;
    const unitType = document.getElementById('map-unit-type').value;
    const axles = document.getElementById('map-axles').value;
    const weight = document.getElementById('map-weight').value;

    if (!origen || !destino) {
        Swal.fire('Atención', 'Ingrese Origen y Destino para el análisis NOM-012.', 'warning');
        return;
    }

    // Get waypoints
    const waypointInputs = document.querySelectorAll('.waypoint-input');
    const waypoints = [];
    waypointInputs.forEach(input => {
        if (input.value.trim()) waypoints.push(input.value.trim());
    });

    Swal.fire({
        title: 'Auditoría Logística (NOM-012)...',
        html: '<div class="spinner my-4"></div><p class="text-sm font-mono text-gray-600">Calculando categorización de vía, Fórmula Puente y extracción Inteligente de Tarifas...</p>',
        allowOutsideClick: false,
        showConfirmButton: false
    });

    try {
        const reportHTML = await window.generateLogisticsReportAI(origen, destino, waypoints, unitType, axles, weight);
        
        Swal.fire({
            title: '<i class="fas fa-shield-alt text-slate-800"></i> Reporte Integral de Operación (NOM-012)',
            html: `<div class="text-left text-sm mt-4 custom-scrollbar overflow-y-auto max-h-[70vh] w-full">${reportHTML}</div>`,
            confirmButtonText: 'Cerrar Reporte',
            confirmButtonColor: '#1e293b',
            width: '800px',
            customClass: {
                popup: 'rounded-xl shadow-2xl',
                htmlContainer: 'p-0 m-0'
            }
        });
    } catch (e) {
        // Error already handled in gemini layer, but dismiss spinner if needed
    }
}

// ---- INTERACTION & UTILITIES ---- //
function geocodeLatLng(latLng) {
    if (!geocoder) return;
    geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === "OK") {
            if (results[0]) {
                infoWindow.setContent(`
                    <div class="p-2 max-w-xs">
                        <p class="font-bold text-gray-800 text-sm mb-1"><i class="fas fa-map-marker-alt text-indigo-500"></i> Ubicación Seleccionada</p>
                        <p class="text-xs text-gray-600 leading-relaxed">${results[0].formatted_address}</p>
                    </div>
                `);
                infoWindow.setPosition(latLng);
                infoWindow.open(map);
            } else {
                infoWindow.setContent('<div class="p-1 text-xs">No se encontraron resultados para esta ubicación.</div>');
                infoWindow.setPosition(latLng);
                infoWindow.open(map);
            }
        }
    });
}

function startMobileNavigation() {
    const origen = document.getElementById('map-origen').value;
    const destino = document.getElementById('map-destino').value;

    if (!origen || !destino) {
        Swal.fire('Atención', 'Calcule la ruta primero antes de iniciar la navegación.', 'warning');
        return;
    }

    const waypointInputs = document.querySelectorAll('.waypoint-input');
    const waypoints = [];
    waypointInputs.forEach(input => {
        if (input.value.trim()) {
            waypoints.push(input.value.trim());
        }
    });

    // Guardar para la App EDY (offline-first simulator)
    localStorage.setItem('edy_pending_route', JSON.stringify({
        origen,
        destino,
        waypoints
    }));

    Swal.fire({
        title: 'Navegación Cabina',
        text: 'Se ha preparado la ruta para la aplicación integral de Cabina.',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-truck"></i> Abrir App EDY',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4f46e5'
    }).then((res) => {
        if(res.isConfirmed) {
            window.open('edy_app.html', '_blank');
        }
    });
}
