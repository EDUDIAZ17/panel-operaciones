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
        <div class="h-full flex flex-col md:flex-row bg-slate-100 p-2 gap-2 fade-in font-sans text-[13px] text-slate-900 overflow-hidden">
            
            <!-- Panel Izquierdo: Creador Avanzado de Rutas (High Contrast Light) -->
            <div class="w-full md:w-[460px] bg-white border border-slate-300 flex flex-col overflow-hidden rounded-xl shadow-xl h-full max-h-[92vh]">
                
                <!-- Navegación por Tabs (Light Stylized) -->
                <div class="flex bg-slate-50 p-1 border-b border-slate-200">
                    <button id="tab-btn-create" class="tab-btn flex-1 py-3 text-[10px] font-black uppercase tracking-tighter transition-all rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-200" data-tab="tab-crear-ruta">
                        <i class="fas fa-drafting-compass mr-2"></i> Diseñar Ruta
                    </button>
                    <button id="tab-btn-report" class="tab-btn flex-1 py-3 text-[10px] font-black uppercase tracking-tighter transition-all rounded-lg text-slate-400 hover:text-slate-600" data-tab="tab-reporte-ruta">
                        <i class="fas fa-chart-pie mr-2"></i> Análisis Ruta
                    </button>
                    <button id="tab-btn-security" class="tab-btn flex-1 py-3 text-[10px] font-black uppercase tracking-tighter transition-all rounded-lg text-slate-400 hover:text-slate-600" data-tab="tab-seguridad">
                        <i class="fas fa-shield-alt mr-2"></i> Seguridad
                    </button>
                </div>
                
                <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 bg-white">
                    
                    <!-- TAB 1: CREACIÓN -->
                    <div id="tab-crear-ruta" class="space-y-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                                <div class="w-1 h-3 bg-emerald-600 rounded-full"></div> CONFIGURACIÓN DE TRANSPORTE
                            </label>
                            <select id="map-unit-type" class="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm outline-none">
                                <option value="t3s2">Tracto Sencillo (T3-S2) - 45T</option>
                                <option value="t3s3">Tracto Sencillo (T3-S3) - 50T</option>
                                <option value="t3s2r4">Tracto Full (T3-S2-R4) - 75T</option>
                                <option value="t3s3r2">Tracto Full (T3-S3-R2) - 75T</option>
                                <option value="c3r3" selected>Tracto Full (C3-R3) - 75T</option>
                                <option value="thor">Unidad Liviana (L2) - 3.5T</option>
                            </select>
                            <label class="flex items-center gap-3 mt-2 cursor-pointer group">
                                <div class="relative flex items-center">
                                    <input type="checkbox" id="pref-opt-truck" class="peer hidden" checked>
                                    <div class="w-4 h-4 border-2 border-slate-300 rounded peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                                        <i class="fas fa-check text-[8px] text-white scale-0 peer-checked:scale-100 transition-transform"></i>
                                    </div>
                                </div>
                                <span class="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Configuración Premium / Doble Remolque</span>
                            </label>
                        </div>

                        <div class="space-y-4 pt-2">
                            <label class="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                                <div class="w-1 h-3 bg-emerald-600 rounded-full"></div> PARÁMETROS OPERATIVOS
                            </label>
                            
                            <div class="grid grid-cols-2 gap-3">
                                <div class="flex flex-col gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                                    <label class="flex items-center gap-3 cursor-pointer group">
                                        <div class="relative flex items-center">
                                            <input type="checkbox" id="pref-avoid-tolls" class="peer hidden">
                                            <div class="w-5 h-5 border-2 border-slate-300 rounded-md peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all flex items-center justify-center">
                                                <i class="fas fa-check text-[10px] text-white scale-0 peer-checked:scale-100 transition-transform"></i>
                                            </div>
                                        </div>
                                        <span class="text-xs font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">Evitar Casetas</span>
                                    </label>
                                    <label class="flex items-center gap-3 cursor-pointer group">
                                        <div class="relative flex items-center">
                                            <input type="checkbox" id="pref-avoid-ferries" class="peer hidden" checked>
                                            <div class="w-5 h-5 border-2 border-slate-300 rounded-md peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all flex items-center justify-center">
                                                <i class="fas fa-check text-[10px] text-white scale-0 peer-checked:scale-100 transition-transform"></i>
                                            </div>
                                        </div>
                                        <span class="text-xs font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">Evitar Ferrys</span>
                                    </label>
                                </div>
                                <div class="flex flex-col gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                                    <label class="flex items-center gap-3 cursor-pointer group">
                                        <div class="relative flex items-center">
                                            <input type="checkbox" id="pref-heavy-vehicle" class="peer hidden" checked>
                                            <div class="w-5 h-5 border-2 border-slate-300 rounded-md peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all flex items-center justify-center">
                                                <i class="fas fa-check text-[10px] text-white scale-0 peer-checked:scale-100 transition-transform"></i>
                                            </div>
                                        </div>
                                        <span class="text-xs font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">Ruta Pesada</span>
                                    </label>
                                    <label class="flex items-center gap-3 cursor-pointer group">
                                        <div class="relative flex items-center">
                                            <input type="checkbox" id="pref-opt-nom" class="peer hidden" checked>
                                            <div class="w-5 h-5 border-2 border-slate-300 rounded-md peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all flex items-center justify-center">
                                                <i class="fas fa-check text-[10px] text-white scale-0 peer-checked:scale-100 transition-transform"></i>
                                            </div>
                                        </div>
                                        <span class="text-xs font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">Opt. NOM-012</span>
                                    </label>
                                </div>
                                
                                <div class="col-span-2 pt-2 border-t border-slate-200 mt-2 flex flex-col gap-4">
                                    <div class="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <span class="text-[11px] font-black text-slate-600 uppercase tracking-tighter">Velocidad Crucero:</span>
                                        <div class="flex items-center bg-white rounded-lg border border-slate-300 p-1">
                                             <button id="btn-speed-down" class="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all text-xl font-black">-</button>
                                             <input type="number" id="map-speed" value="70" class="w-12 bg-transparent text-center text-sm text-indigo-600 font-black focus:outline-none" readonly>
                                             <button id="btn-speed-up" class="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all text-xl font-black">+</button>
                                        </div>
                                    </div>
                                    
                                    <div class="grid grid-cols-2 gap-3">
                                        <div class="bg-slate-100 p-3 rounded-xl border border-slate-200 shadow-inner text-center">
                                            <p class="text-[9px] text-emerald-700 uppercase font-black tracking-widest mb-1">Diesel (Km/L)</p>
                                            <input type="number" id="pref-kpl" value="2.5" step="0.1" class="w-full bg-white border border-slate-300 rounded text-slate-900 font-black text-center focus:ring-emerald-500">
                                        </div>
                                        <div class="bg-slate-100 p-3 rounded-xl border border-slate-200 shadow-inner text-center">
                                            <p class="text-[9px] text-emerald-700 uppercase font-black tracking-widest mb-1">Ejes Totales</p>
                                            <input type="number" id="map-axles" value="6" class="w-full bg-white border border-slate-300 rounded text-slate-900 font-black text-center focus:ring-emerald-500">
                                        </div>
                                        <div class="bg-slate-100 p-3 rounded-xl border border-slate-200 shadow-inner col-span-2 text-center">
                                            <p class="text-[9px] text-emerald-700 uppercase font-black tracking-widest mb-1">Peso Bruto Vehicular (Ton PBV)</p>
                                            <input type="number" id="map-weight" value="75" class="w-full bg-white border border-slate-300 rounded text-slate-900 font-black text-center focus:ring-emerald-500">
                                        </div>
                                    </div>
                                 </div>
                            </div>
                        </div>

                        <div class="space-y-4 pt-4 border-t border-slate-200">
                             <label class="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                                <div class="w-1 h-3 bg-emerald-600 rounded-full"></div> CONFIGURACIÓN FINANCIERA (Viáticos)
                            </label>
                            
                            <div class="grid grid-cols-3 gap-2">
                                <div class="bg-slate-100 p-2 rounded-xl border border-slate-200 shadow-inner text-center">
                                    <p class="text-[8px] text-slate-700 uppercase font-black mb-1" title="Precio Diesel por Litro">Precio Diesel</p>
                                    <input type="number" id="pref-diesel-price" value="24.5" step="0.1" class="w-full bg-white border border-slate-300 rounded text-slate-900 font-bold text-center focus:ring-emerald-500 text-xs py-1">
                                </div>
                                <div class="bg-slate-100 p-2 rounded-xl border border-slate-200 shadow-inner text-center">
                                    <p class="text-[8px] text-slate-700 uppercase font-black mb-1" title="Pago Operador (Cargado) x KM">Operador (Carg.)</p>
                                    <input type="number" id="pref-rate-loaded" value="1.8" step="0.01" class="w-full bg-white border border-slate-300 rounded text-slate-900 font-bold text-center focus:ring-emerald-500 text-xs py-1">
                                </div>
                                <div class="bg-slate-100 p-2 rounded-xl border border-slate-200 shadow-inner text-center">
                                    <p class="text-[8px] text-slate-700 uppercase font-black mb-1" title="Pago Operador (Vacío) x KM">Operador (Vac.)</p>
                                    <input type="number" id="pref-rate-empty" value="1.5" step="0.01" class="w-full bg-white border border-slate-300 rounded text-slate-900 font-bold text-center focus:ring-emerald-500 text-xs py-1">
                                </div>
                                <div class="bg-slate-100 p-2 rounded-xl border border-slate-200 shadow-inner text-center">
                                    <p class="text-[8px] text-slate-700 uppercase font-black mb-1" title="Mantenimiento x KM">Manto. (Km)</p>
                                    <input type="number" id="pref-rate-maint" value="0.85" step="0.01" class="w-full bg-white border border-slate-300 rounded text-slate-900 font-bold text-center focus:ring-emerald-500 text-xs py-1">
                                </div>
                                <div class="bg-slate-100 p-2 rounded-xl border border-slate-200 shadow-inner text-center">
                                    <p class="text-[8px] text-slate-700 uppercase font-black mb-1" title="Llantas x KM">Llantas (Km)</p>
                                    <input type="number" id="pref-rate-tires" value="0.6" step="0.01" class="w-full bg-white border border-slate-300 rounded text-slate-900 font-bold text-center focus:ring-emerald-500 text-xs py-1">
                                </div>
                                <div class="bg-slate-100 p-2 rounded-xl border border-slate-200 shadow-inner text-center">
                                    <p class="text-[8px] text-slate-700 uppercase font-black mb-1" title="Alimentos x KM">Alim. (Km)</p>
                                    <input type="number" id="pref-rate-food" value="0.45" step="0.01" class="w-full bg-white border border-slate-300 rounded text-slate-900 font-bold text-center focus:ring-emerald-500 text-xs py-1">
                                </div>
                                <div class="bg-slate-100 p-2 rounded-xl border border-slate-200 shadow-inner text-center col-span-2">
                                    <p class="text-[8px] text-slate-700 uppercase font-black mb-1">Costo Maniobra (Unitario)</p>
                                    <input type="number" id="pref-rate-maneuver" value="45" step="1" class="w-full bg-white border border-slate-300 rounded text-slate-900 font-bold text-center focus:ring-emerald-500 text-xs py-1">
                                </div>
                                <div class="bg-slate-100 p-2 rounded-xl border border-slate-200 shadow-inner text-center">
                                    <p class="text-[8px] text-slate-700 uppercase font-black mb-1">Cant. Maniobras</p>
                                    <input type="number" id="pref-maneuver-count" value="2" step="1" class="w-full bg-white border border-slate-300 rounded text-slate-900 font-bold text-center focus:ring-emerald-500 text-xs py-1">
                                </div>
                            </div>
                        </div>

                        <div class="space-y-4 pt-4 border-t border-slate-200">
                             <label class="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                                <div class="w-1 h-3 bg-emerald-600 rounded-full"></div> PLAN DE RUTA (WAYPOINTS)
                            </label>
                            
                            <div class="bg-slate-50 rounded-2xl border border-slate-300 overflow-hidden shadow-lg">
                                <div class="p-4 space-y-4">
                                    <div class="flex items-center gap-3">
                                        <div class="w-3 h-3 rounded-full bg-emerald-500 shadow-md"></div>
                                        <input type="text" id="map-origen" class="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none transition-all shadow-sm" placeholder="Origen de despacho...">
                                    </div>
                                    
                                    <div id="waypoints-container" class="space-y-3"></div>
                                    
                                    <div class="flex items-center gap-3">
                                        <div class="w-3 h-3 rounded-full bg-rose-500 shadow-md"></div>
                                        <input type="text" id="map-destino" class="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none transition-all shadow-sm" placeholder="Destino final...">
                                    </div>
                                </div>
                                <button id="btn-add-waypoint" class="w-full py-4 bg-slate-100 hover:bg-slate-200 text-[10px] font-black text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center gap-3 border-t border-slate-200 uppercase tracking-widest">
                                    <i class="fas fa-plus-circle text-indigo-600"></i> AÑADIR PARADA ESTRATÉGICA...
                                </button>
                            </div>
                        </div>

                        <div class="flex gap-4 pt-4 pb-8">
                            <button id="btn-calc-route" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all text-[11px] uppercase tracking-widest flex items-center justify-center gap-3">
                                <i class="fas fa-route text-lg"></i> GENERAR RUTA REAL
                            </button>
                            <button id="btn-clear-route" class="w-16 bg-slate-100 hover:bg-rose-50 border border-slate-300 text-slate-400 hover:text-rose-600 flex items-center justify-center rounded-xl transition-all active:scale-95 group">
                                <i class="fas fa-trash-alt group-hover:animate-bounce"></i>
                            </button>
                        </div>
                    </div>

                    <!-- TAB 2: REPORTE RUTA -->
                    <div id="tab-reporte-ruta" class="space-y-6 hidden">
                        <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-5 shadow-sm">
                             <div class="flex flex-col gap-4">
                                 <div class="flex items-center gap-4">
                                     <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white border border-indigo-500 shadow-md font-black italic">A</div>
                                     <div class="flex-1">
                                         <p class="text-[10px] text-indigo-700 font-black uppercase tracking-widest">Punto de Partida (<span id="rep-fecha">--/--/--</span>)</p>
                                         <p class="text-slate-900 text-sm font-black truncate" id="rep-origen">No Definido</p>
                                     </div>
                                 </div>
                                 <div class="w-px h-6 bg-slate-300 ml-5 border-l-2 border-dashed border-slate-400"></div>
                                 <div class="flex items-center gap-4">
                                     <div class="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white border border-rose-500 shadow-md font-black italic">B</div>
                                     <div class="flex-1">
                                         <p class="text-[10px] text-rose-700 font-black uppercase tracking-widest">Destino Logístico (<span id="rep-vehiculo">Unidad</span>)</p>
                                         <p class="text-slate-900 text-sm font-black truncate" id="rep-destino">No Definido</p>
                                     </div>
                                 </div>
                             </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                              <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-lg text-center">
                                  <p class="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 text-center">Recorrido</p>
                                  <p class="text-3xl font-black text-slate-900" id="rep-dist-total">0 <span class="text-xs font-normal text-slate-400 uppercase tracking-tighter">km</span></p>
                                  <span id="rep-dist-vacio" class="hidden">0</span>
                                  <div class="mt-2 text-[10px] text-slate-400 font-black uppercase">Dir: <span id="rep-time-drive">0h:00m</span></div>
                              </div>
                              <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-lg text-center">
                                  <p class="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 text-center">ETA Estimado</p>
                                  <p class="text-3xl font-black text-indigo-600" id="rep-time-total">0:00 <span class="text-xs font-normal text-slate-400 uppercase tracking-tighter">h</span></p>
                                  <div class="mt-2 text-[10px] font-black text-emerald-600 uppercase" id="rep-tit-cost">$0.00 MXN</div>
                              </div>
                        </div>

                        <div class="bg-slate-50 rounded-2xl border-2 border-slate-200 overflow-hidden shadow-xl">
                              <div class="px-5 py-4 bg-slate-100 flex justify-between items-center border-b border-slate-200">
                                 <span class="text-xs font-black text-slate-700 uppercase tracking-widest">Costeo Operativo (<span id="rep-cost-km">$0.00</span> / KM)</span>
                                 <span class="text-lg font-black text-emerald-700" id="rep-cost-total">$0.00</span>
                             </div>
                             <div class="p-5 space-y-4 bg-white">
                                 <div class="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                                     <div class="flex items-center gap-3 text-slate-600 font-bold"><i class="fas fa-road text-amber-600"></i> Peajes</div>
                                     <span id="rep-cost-tolls" class="text-slate-900 font-black">$0.00</span>
                                 </div>
                                 <div class="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                                     <div class="flex items-center gap-3 text-slate-600 font-bold"><i class="fas fa-gas-pump text-blue-600"></i> Combustible</div>
                                     <span id="rep-cost-fuel" class="text-slate-900 font-black">$0.00</span>
                                 </div>
                                 <div class="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                                     <div class="flex items-center gap-3 text-slate-600 font-bold"><i class="fas fa-user-tie text-indigo-600"></i> Sueldo Operador</div>
                                     <span id="rep-cost-driver" class="text-slate-900 font-black">$0.00</span>
                                 </div>
                                 <div class="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                                     <div class="flex items-center gap-3 text-slate-600 font-bold"><i class="far fa-credit-card text-emerald-600"></i> Alimentos y Maniobras</div>
                                     <span id="rep-cost-misc" class="text-slate-900 font-black">$0.00</span>
                                 </div>
                                 <div class="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                                     <div class="flex items-center gap-3 text-slate-600 font-bold"><i class="fas fa-tools text-orange-600"></i> Mantenimiento Prev.</div>
                                     <span id="rep-cost-maint" class="text-slate-900 font-black">$0.00</span>
                                 </div>
                                 <div class="flex justify-between items-center text-sm">
                                     <div class="flex items-center gap-3 text-slate-600 font-bold"><i class="fas fa-circle-notch text-slate-400"></i> Desgaste Llantas</div>
                                     <span id="rep-cost-tires" class="text-slate-900 font-black">$0.00</span>
                                 </div>
                             </div>
                        </div>

                        <div class="grid grid-cols-1 gap-4">
                             <button id="btn-share-whatsapp" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95">
                                 <i class="fab fa-whatsapp text-lg"></i> ENVIAR LINK DE RUTA
                             </button>
                             <button id="btn-show-tolls-list" class="w-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-black py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm">
                                 <i class="fas fa-list-ol text-emerald-600"></i> Listado de Casetas
                             </button>
                             <button id="btn-ai-audit" class="w-full bg-slate-900 hover:bg-black text-white py-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-4">
                                 <i class="fas fa-microchip text-2xl animate-pulse text-indigo-400"></i>
                                 <span class="text-sm font-black uppercase tracking-widest">Auditoría Inteligente Gemini</span>
                             </button>
                        </div>
                    </div>

                    <!-- TAB 3: SEGURIDAD -->
                    <div id="tab-seguridad" class="space-y-6 hidden">
                         <div class="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                              <i class="fas fa-shield-virus absolute -right-4 -bottom-4 text-white/10 text-8xl"></i>
                              <p class="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-80">Módulo de Seguridad</p>
                              <h3 class="text-xl font-black leading-tight">Seguimiento de Protocolos</h3>
                              <div class="mt-6 space-y-3">
                                   <div class="flex items-center justify-between bg-white/10 p-3 rounded-xl backdrop-blur-md">
                                        <span class="text-xs font-bold font-black">Botón de Pánico</span>
                                        <div class="w-10 h-5 bg-rose-500 rounded-full relative shadow-inner">
                                             <div class="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                                        </div>
                                   </div>
                                   <div class="flex items-center justify-between bg-white/10 p-3 rounded-xl backdrop-blur-md">
                                        <span class="text-xs font-bold font-black">Geo-Cercas Activas</span>
                                        <div class="w-10 h-5 bg-emerald-500 rounded-full relative shadow-inner">
                                             <div class="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                                        </div>
                                   </div>
                              </div>
                         </div>
                    </div>
                </div>
            </div>

            <!-- Panel Derecho: Google Maps (High Visibility) -->
            <div class="flex-1 relative bg-white rounded-xl border border-slate-300 overflow-hidden shadow-xl min-h-[550px] md:min-h-0">
                <div id="map-canvas" class="w-full h-full" style="min-height: 550px; background-color: #f8fafc;"></div>
                
                <div id="map-loading" class="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-slate-900 gap-4 hidden">
                    <div class="spinner-border text-indigo-600 w-16 h-16 border-4 border-t-transparent animate-spin rounded-full"></div>
                    <div class="text-lg font-black tracking-widest animate-pulse uppercase text-indigo-700">Trazando Ruta Logística...</div>
                </div>

                <!-- Legend Overlay -->
                <div class="absolute bottom-6 right-6 bg-white border border-slate-200 p-5 rounded-2xl shadow-xl z-10 hidden md:block">
                    <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Simbología Federal</div>
                    <div class="space-y-3">
                        <div class="flex items-center gap-3">
                            <div class="w-3 h-3 rounded-full bg-emerald-500 shadow-md"></div>
                            <span class="text-[10px] font-black text-slate-700">TRAZO SEGURO</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="w-3 h-3 rounded-full bg-indigo-500 shadow-md"></div>
                            <span class="text-[10px] font-black text-slate-700">FEDERAL / CUOTA</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="w-3 h-3 rounded-full bg-amber-500 shadow-md"></div>
                            <span class="text-[10px] font-black text-slate-700">CASETA AUTORIZADA</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Caseta Modal Container (Light Contrast) -->
        <div id="modal-casetas" class="fixed inset-0 bg-slate-200/50 backdrop-blur-sm z-[2000] hidden flex items-center justify-center p-4">
            <div class="bg-white border border-slate-300 shadow-2xl rounded-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
                <!-- Modal Header -->
                <div class="bg-slate-50 border-b border-slate-200 flex justify-between items-center px-5 py-4">
                    <div class="flex items-center gap-3">
                         <div class="w-2 h-2 rounded-full bg-amber-500 shadow-md"></div>
                         <span class="font-black text-slate-800 text-base tracking-tight uppercase tracking-widest text-[12px]">Desglose de Peajes Autorizados</span>
                    </div>
                    <button class="modal-casetas-close w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-rose-600 hover:text-white transition-all">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <!-- Modal Content -->
                <div class="p-4 flex-1 overflow-hidden flex flex-col">
                    <div class="bg-indigo-50 border border-indigo-200 rounded-xl mb-4 p-4 flex justify-between items-center shadow-sm">
                         <div class="flex flex-col">
                             <span class="text-[10px] text-indigo-700 font-black uppercase tracking-widest">Inversión en Trayecto</span>
                             <span class="text-xs text-slate-500 font-bold">Ruta Tarifada Oficialmente</span>
                         </div>
                         <span class="font-black text-slate-900 text-2xl" id="casetas-gran-total">$0.00</span>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-inner custom-scrollbar">
                        <table class="w-full text-xs text-left">
                            <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-black sticky top-0 uppercase tracking-tighter">
                                <tr>
                                    <th class="py-3 px-4 w-12 text-center"><i class="fas fa-hashtag text-[10px]"></i></th>
                                    <th class="py-3 px-2">Plaza de Cobro / Caseta</th>
                                    <th class="py-3 px-2 text-right">Tramo</th>
                                    <th class="py-3 px-2 text-center italic">ETA</th>
                                    <th class="py-3 px-4 text-right text-emerald-700">Tarifa</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 text-slate-700" id="casetas-table-body">
                                <tr><td colspan="5" class="py-12 text-center text-slate-400 font-black uppercase tracking-tighter italic">No hay registros dinámicos aún.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <!-- Modal Footer -->
                <div class="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button class="modal-casetas-close px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-lg transition-all text-xs uppercase tracking-widest border border-slate-300">
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
                     confirmButtonColor: '#4f46e5',
                     background: '#ffffff',
                     color: '#0f172a'
                 });
                 return;
             }
             
             Swal.fire({
                 title: 'Auditoría Inteligente NOM-012',
                 html: '<div class="text-center py-6"><div class="spinner-border text-indigo-600 mb-4 h-10 w-10 border-4 border-t-transparent animate-spin rounded-full inline-block"></div><p class="text-xs text-slate-500 font-black uppercase tracking-widest mt-2">Analizando rutas, pesos y clasificaciones SCT...</p></div>',
                 showConfirmButton: false,
                 allowOutsideClick: false,
                 background: '#ffffff',
                 color: '#0f172a'
             });

             if (window.generateLogisticsReportAI) {
                 window.generateLogisticsReportAI(data.origen, data.destino, data.waypointNames, data.unitTypeName)
                 .then(html => {
                     Swal.fire({
                         width: '850px',
                         html: `<div class="bg-white text-slate-900 p-2 text-left">${html}</div>`,
                         confirmButtonText: '<i class="fas fa-check"></i> Entendido',
                         confirmButtonColor: '#4f46e5',
                         background: '#ffffff',
                         color: '#0f172a'
                     });
                 })
                 .catch(err => {
                     console.error(err);
                     Swal.fire({
                         icon: 'error',
                         title: 'Falla en IA',
                         text: 'No se pudo generar la auditoría en este momento.',
                         background: '#ffffff',
                         color: '#0f172a'
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
    const tabSecurityBtn = document.getElementById('tab-btn-security');
    const tabPointsBtn = document.getElementById('tab-btn-points');
    
    const tabCreateContent = document.getElementById('tab-crear-ruta');
    const tabReportContent = document.getElementById('tab-reporte-ruta');
    const tabSecurityContent = document.getElementById('tab-seguridad');

    function switchTab(activeBtn, activeContent) {
        // Reset buttons
        [tabCreateBtn, tabReportBtn, tabPointsBtn, tabSecurityBtn].forEach(btn => {
            if(btn) {
                btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-lg');
                btn.classList.add('text-slate-500', 'hover:bg-slate-100', 'hover:text-slate-900');
            }
        });
        
        // Hide contents
        if(tabCreateContent) tabCreateContent.classList.add('hidden');
        if(tabReportContent) tabReportContent.classList.add('hidden');
        if(tabSecurityContent) tabSecurityContent.classList.add('hidden');
        
        // Set active
        if(activeBtn) {
            activeBtn.classList.remove('text-slate-500', 'hover:bg-slate-100', 'hover:text-slate-900');
            activeBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-lg');
        }
        if(activeContent) activeContent.classList.remove('hidden');
    }

    if(tabCreateBtn) tabCreateBtn.addEventListener('click', () => switchTab(tabCreateBtn, tabCreateContent));
    if(tabReportBtn) tabReportBtn.addEventListener('click', () => switchTab(tabReportBtn, tabReportContent));
    if(tabSecurityBtn) tabSecurityBtn.addEventListener('click', () => switchTab(tabSecurityBtn, tabSecurityContent));
    if(tabPointsBtn) tabPointsBtn.addEventListener('click', () => switchTab(tabPointsBtn, null));

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
        div.className = 'px-4 py-2 bg-slate-50 flex items-center gap-3 border-b border-slate-100 fade-in';
        div.innerHTML = `
            <div class="w-1 h-1 rounded-full bg-slate-400"></div>
            <div class="flex-1 relative">
                <input type="text" id="${id}" class="waypoint-input bg-transparent w-full py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none" placeholder="Parada intermedia...">
            </div>
            <button class="text-slate-400 hover:text-rose-600 transition" onclick="window.removeWaypoint(this)" title="Eliminar"><i class="fas fa-times"></i></button>
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
                        const marker = new google.maps.marker.AdvancedMarkerElement({
                            position: step.start_location,
                            map: map,
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
            const repTTotal = document.getElementById('rep-time-total');
            const repTDrive = document.getElementById('rep-time-drive');
            const repDTotal = document.getElementById('rep-dist-total');
            const repDVacio = document.getElementById('rep-dist-vacio');
            const repTitCost = document.getElementById('rep-tit-cost');

            if (repOrig) repOrig.textContent = origen;
            if (repDest) repDest.textContent = destino;
            if (repDate) repDate.textContent = today;
            if (repVeh) repVeh.textContent = unitTypeName;
            
            if (repDTotal) repDTotal.innerHTML = `${distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 0})} <span class="text-xs font-normal text-slate-400 uppercase tracking-tighter">km</span>`;
            if (repDVacio) repDVacio.textContent = distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 0});
            
            if (repTTotal) repTTotal.innerHTML = `${formatTime(totalTimeH)} <span class="text-xs font-normal text-slate-400 uppercase tracking-tighter">h</span>`;
            if (repTDrive) repTDrive.textContent = formatTime(drivingTimeH);
            if (repTitCost) repTitCost.textContent = 'Calculando...';
            
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
            if(window.getDetailedTollsAI) {
                const response = await window.getDetailedTollsAI(origen, destino, waypoints, unitTypeName);
                if (response && response.tolls) {
                    tollsCost = response.totalCost || 0;
                    if (repTolls) repTolls.textContent = '$' + tollsCost.toLocaleString('es-MX', {minimumFractionDigits: 2});
                    populateCasetasModal(response.tolls, tollsCost);
                } else {
                    if (repTolls) repTolls.textContent = 'Error IA';
                    populateCasetasModal([]);
                }
            } else {
                 if (repTolls) repTolls.textContent = 'IA No Lista';
                 populateCasetasModal([]);
            }
        } catch (e) {
            console.error("Error estimando casetas con IA:", e);
            if (repTolls) repTolls.textContent = 'Error IA';
            populateCasetasModal([]);
        }
    }

    // New Operational Parameters from UI
    const kpl = Math.max(0.1, parseFloat(document.getElementById('pref-kpl').value) || 2.1);
    const dieselPrice = parseFloat(document.getElementById('pref-diesel-price').value) || 24.5;
    const rateLoaded = parseFloat(document.getElementById('pref-rate-loaded').value) || 1.8;
    const rateEmpty = parseFloat(document.getElementById('pref-rate-empty').value) || 1.5;
    const rateMaint = parseFloat(document.getElementById('pref-rate-maint').value) || 0.85;
    const rateTires = parseFloat(document.getElementById('pref-rate-tires').value) || 0.6;
    const rateFood = parseFloat(document.getElementById('pref-rate-food').value) || 0.45;
    const rateManeuver = parseFloat(document.getElementById('pref-rate-maneuver').value) || 45;
    const maneuverCount = parseInt(document.getElementById('pref-maneuver-count').value) || 2;

    // Fuel Cost
    const fuelCost = (distanceKm / kpl) * dieselPrice;
    
    // Sueldo Operator (Differentiating between loaded and empty would require trip state, for now we average or use loaded if specified)
    // For this estimator, we will assume "Cargado" by default as it's the conservative estimate.
    const driverCost = distanceKm * rateLoaded;

    // Maintenance & Tires
    const maintCost = distanceKm * rateMaint;
    const tiresCost = distanceKm * rateTires;

    // Food & Maneuvers (Misc)
    const miscCost = (distanceKm * rateFood) + (rateManeuver * maneuverCount);

    const repFuel = document.getElementById('rep-cost-fuel');
    const repDriver = document.getElementById('rep-cost-driver');
    const repMisc = document.getElementById('rep-cost-misc');
    const repMaint = document.getElementById('rep-cost-maint');
    const repTires = document.getElementById('rep-cost-tires');
    const repTotal = document.getElementById('rep-cost-total');
    const repTitCost = document.getElementById('rep-tit-cost');
    const repKm = document.getElementById('rep-cost-km');

    if (repFuel) repFuel.textContent = '$' + fuelCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (repDriver) repDriver.textContent = '$' + driverCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (repMisc) repMisc.textContent = '$' + miscCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (repMaint) repMaint.textContent = '$' + maintCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (repTires) repTires.textContent = '$' + tiresCost.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    let masterTotal = tollsCost + fuelCost + driverCost + maintCost + tiresCost + miscCost;
    if (repTotal) repTotal.textContent = '$' + masterTotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (repTitCost) repTitCost.textContent = '$' + masterTotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' MXN';

    let costPerKm = distanceKm > 0 ? (masterTotal / distanceKm) : 0;
    if (repKm) repKm.textContent = '$' + costPerKm.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    window.currentRouteData.calculatedCosts = {
         tolls: tollsCost, fuel: fuelCost, driver: driverCost, maint: maintCost, tires: tiresCost, misc: miscCost, total: masterTotal, perKm: costPerKm
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
        if(leg.start_address) legWaypoints.push(leg.start_address);

        leg.steps.forEach(step => {
            const instructions = step.instructions.toLowerCase();
            if (instructions.includes('cuota') || instructions.includes('peaje') || instructions.includes('toll')) {
                const marker = new google.maps.marker.AdvancedMarkerElement({
                    position: step.start_location,
                    map: map,
                    title: 'Caseta de Cobro'
                });

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
    const speedKmH = parseFloat(document.getElementById('map-speed').value) || 75;
    const stopTimeH = legWaypoints.length * 0.5;
    const drivingTimeH = distanceValueKm / speedKmH;
    const restTimeH = document.getElementById('pref-opt-nom').checked ? Math.floor(drivingTimeH / 5) * 0.5 : 0;
    const totalTimeH = drivingTimeH + stopTimeH + restTimeH;
    
    function formatTime(hoursDecimal) {
        const h = Math.floor(hoursDecimal);
        const m = Math.round((hoursDecimal - h) * 60);
        return `${h}h:${m.toString().padStart(2, '0')}m`;
    }
    
    // Update Report tab
    const repOrig = document.getElementById('rep-origen');
    const repDest = document.getElementById('rep-destino');
    const repDate = document.getElementById('rep-fecha');
    const repVeh = document.getElementById('rep-vehiculo');
    const repTTotal = document.getElementById('rep-time-total');
    const repTDrive = document.getElementById('rep-time-drive');
    const repDTotal = document.getElementById('rep-dist-total');
    const repDVacio = document.getElementById('rep-dist-vacio');
    const repTitCost = document.getElementById('rep-tit-cost');

    if (repOrig) repOrig.textContent = origen;
    if (repDest) repDest.textContent = destino;
    if (repDate) repDate.textContent = new Date().toLocaleDateString('es-MX');
    if (repVeh) repVeh.textContent = document.getElementById('map-unit-type').options[document.getElementById('map-unit-type').selectedIndex].text;
    
    if (repDTotal) repDTotal.innerHTML = `${distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 0})} <span class="text-xs font-normal text-slate-400 uppercase tracking-tighter">km</span>`;
    if (repDVacio) repDVacio.textContent = distanceValueKm.toLocaleString('es-MX', {maximumFractionDigits: 0});
    
    if (repTTotal) repTTotal.innerHTML = `${formatTime(totalTimeH)} <span class="text-xs font-normal text-slate-400 uppercase tracking-tighter">h</span>`;
    if (repTDrive) repTDrive.textContent = formatTime(drivingTimeH);
    if (repTitCost) repTitCost.textContent = 'Calculando...';

    // Actualizar datos globales
    window.currentRouteData = {
        origen,
        destino,
        waypointNames: legWaypoints.slice(1, -1),
        distance: distanceValueKm,
        unitTypeName: document.getElementById('map-unit-type').options[document.getElementById('map-unit-type').selectedIndex].text
    };

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
