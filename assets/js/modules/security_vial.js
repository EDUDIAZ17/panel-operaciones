// assets/js/modules/security_vial.js
import { supabase } from '../services/supabaseClient.js';


// --- state definition ---
const defaultAnswers = {
    // 1. Mantenimiento (200 pts)
    'req1_1': 0, 'req1_2': 0, 'req1_3': 0, 'req1_4': 0,
    // 2. Operaciones (200 pts)
    'req2_1': 0, 'req2_2': 0, 'req2_3': 0, 'req2_4': 0,
    // 3. Monitoreo (160 pts)
    'req3_1': 0, 'req3_2': 0, 'req3_3': 0, 'req3_4': 0,
    // 4. RH (150 pts)
    'req4_1': 0, 'req4_2': 0, 'req4_3': 0, 'req4_4': 0, 'req4_5': 0,
    // 5. Sistemas (90 pts)
    'req5_1': 0, 'req5_2': 0,
    // 6. Administración (100 pts)
    'req6_1': 0, 'req6_2': 0,
    // 7. Calidad (50 pts)
    'req7_1': 0, 'req7_2': 0,
    // 8. Atención Cliente (50 pts)
    'req8_1': 0, 'req8_2': 0
};

const state = {
    companyName: '',
    auditorName: '',
    auditDate: new Date().toISOString().split('T')[0],
    answers: { ...defaultAnswers },
    risks: [],
    reportsHistory: [],
    currentTab: 'dashboard'
};

// --- ISO 39001 Areas and Criteria Configuration ---
const areaConfig = {
    mantenimiento: {
        title: 'Mantenimiento y Control Vehicular',
        weight: '20%',
        maxPoints: 200,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-100',
        badgeColor: 'bg-orange-100 text-orange-800',
        criteria: [
            { id: 'req1_1', name: 'Req 1.1', label: 'Plan de Mantenimiento Preventivo digitalizado para el 100% de la flota.', max: 50 },
            { id: 'req1_2', name: 'Req 1.2', label: 'Checklists pre-operativos mecánicos diarios obligatorios y auditables.', max: 50 },
            { id: 'req1_3', name: 'Req 1.3', label: 'Control y renovación de elementos de seguridad activa y pasiva (ABS, ADAS, llantas).', max: 50 },
            { id: 'req1_4', name: 'Req 1.4', label: 'Protocolo de desincorporación de vehículos con fallas críticas en ruta.', max: 50 }
        ]
    },
    operaciones: {
        title: 'Operaciones',
        weight: '20%',
        maxPoints: 200,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-100',
        badgeColor: 'bg-blue-100 text-blue-800',
        criteria: [
            { id: 'req2_1', name: 'Req 2.1', label: 'Planificación y programación horaria de rutas que evite presiones de velocidad.', max: 50 },
            { id: 'req2_2', name: 'Req 2.2', label: 'Auditoría y control de peso, dimensiones y trincado de la carga.', max: 50 },
            { id: 'req2_3', name: 'Req 2.3', label: 'Evaluación, selección y homologación de seguridad vial a transportistas tercerizados.', max: 50 },
            { id: 'req2_4', name: 'Req 2.4', label: 'Definición y mapeo de rutas seguras (zonas de descanso, rampas de frenado, puntos ciegos).', max: 50 }
        ]
    },
    monitoreo: {
        title: 'Monitoreo / Torre de Control',
        weight: '16%',
        maxPoints: 160,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-100',
        badgeColor: 'bg-purple-100 text-purple-800',
        criteria: [
            { id: 'req3_1', name: 'Req 3.1', label: 'Sistema de telemetría GPS activo con alertas en tiempo real de excesos de velocidad.', max: 40 },
            { id: 'req3_2', name: 'Req 3.2', label: 'Protocolos activos de reacción ante alertas de pánico, desvíos o paradas no autorizadas.', max: 40 },
            { id: 'req3_3', name: 'Req 3.3', label: 'Análisis previo de rutas (clima, tráfico, alertas de delincuencia) previo al despacho.', max: 40 },
            { id: 'req3_4', name: 'Req 3.4', label: 'Inducción obligatoria a operadores sobre políticas de seguridad vial y telemetría, con cursos mensuales obligatorios de actualización de seguridad vial.', max: 40 }
        ]
    },
    rh: {
        title: 'RH / Capital Humano',
        weight: '15%',
        maxPoints: 150,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-100',
        badgeColor: 'bg-emerald-100 text-emerald-800',
        criteria: [
            { id: 'req4_1', name: 'Req 4.1', label: 'Exámenes psicométricos y aptitud física/mental de conductores antes de contratación.', max: 30 },
            { id: 'req4_2', name: 'Req 4.2', label: 'Política activa de gestión de fatiga (límites de horas de manejo continuo) y pruebas de dopaje.', max: 30 },
            { id: 'req4_3', name: 'Req 4.3', label: 'Programa continuo de capacitación en conducción defensiva e incidentes viales.', max: 30 },
            { id: 'req4_4', name: 'Req 4.4', label: 'Protocolo formal de contratación para operadores que exige exámenes de conocimientos teórico-prácticos, pruebas prácticas de carga/descarga y exámenes químicos de antidopaje.', max: 30 },
            { id: 'req4_5', name: 'Req 4.5', label: 'Programa auditable de dotación de Equipo de Protección Personal (EPP) al inicio de contrato, con esquema de recambio programado cada 3 meses.', max: 30 }
        ]
    },
    sistemas: {
        title: 'Sistemas IT',
        weight: '9%',
        maxPoints: 90,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-100',
        badgeColor: 'bg-indigo-100 text-indigo-800',
        criteria: [
            { id: 'req5_1', name: 'Req 5.1', label: 'Redundancia y alta disponibilidad de la infraestructura y bases de datos de telemetría.', max: 45 },
            { id: 'req5_2', name: 'Req 5.2', label: 'Bloqueo automático (MDM) de aplicaciones de mensajería en dispositivos corporativos en tránsito.', max: 45 }
        ]
    },
    direccion: {
        title: 'Administración y Dirección General',
        weight: '10%',
        maxPoints: 100,
        color: 'text-teal-600',
        bgColor: 'bg-teal-50',
        borderColor: 'border-teal-100',
        badgeColor: 'bg-teal-100 text-teal-800',
        criteria: [
            { id: 'req6_1', name: 'Req 6.1', label: 'Política formal de Seguridad Vial firmada y Comité de Seguridad Vial activo.', max: 50 },
            { id: 'req6_2', name: 'Req 6.2', label: 'Presupuesto financiero asignado y exclusivo para mantenimiento correctivo urgente y capacitación.', max: 50 }
        ]
    },
    calidad: {
        title: 'Calidad',
        weight: '5%',
        maxPoints: 50,
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-50',
        borderColor: 'border-cyan-100',
        badgeColor: 'bg-cyan-100 text-cyan-800',
        criteria: [
            { id: 'req7_1', name: 'Req 7.1', label: 'Registro e investigación del 100% de los incidentes viales con Análisis de Causa Raíz.', max: 25 },
            { id: 'req7_2', name: 'Req 7.2', label: 'Auditorías internas periódicas documentadas del Sistema de Gestión de Seguridad Vial.', max: 25 }
        ]
    },
    clientes: {
        title: 'Atención a Cliente',
        weight: '5%',
        maxPoints: 50,
        color: 'text-pink-600',
        bgColor: 'bg-pink-50',
        borderColor: 'border-pink-100',
        badgeColor: 'bg-pink-100 text-pink-800',
        criteria: [
            { id: 'req8_1', name: 'Req 8.1', label: 'Canal visible de quejas viales de terceros ("¿Cómo conduzco?") y tratamiento interno.', max: 25 },
            { id: 'req8_2', name: 'Req 8.2', label: 'Sensibilización contractual al cliente para no penalizar retrasos causados por seguridad vial.', max: 25 }
        ]
    }
};



// --- Score Algorithm ---
function calculateISO39001(answers) {
    let breakdown = {
        mantenimiento: 0,
        operaciones: 0,
        monitoreo: 0,
        rh: 0,
        sistemas: 0,
        direccion: 0,
        calidad: 0,
        clientes: 0
    };

    // Calculate score per area
    Object.keys(areaConfig).forEach(areaKey => {
        let areaScore = 0;
        areaConfig[areaKey].criteria.forEach(crit => {
            const factor = answers[crit.id] || 0; // 0, 0.25, 0.50, 0.75, 1.00
            areaScore += factor * crit.max;
        });
        breakdown[areaKey] = areaScore;
    });

    const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
    const compliancePercentage = (totalScore / 1000) * 100;

    return {
        breakdown,
        totalScore,
        compliancePercentage
    };
}

function getMaturityLevel(totalScore) {
    if (totalScore >= 900) {
        return {
            name: 'NIVEL DE EXCELENCIA VIAL',
            desc: 'Cumplimiento normativo óptimo, listo para certificación externa.',
            colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-300',
            bgBadge: 'bg-emerald-500',
            hexColor: '#10b981'
        };
    } else if (totalScore >= 750) {
        return {
            name: 'NIVEL SATISFACTORIO',
            desc: 'SGSV robusto, requiere correcciones en desviaciones menores.',
            colorClass: 'text-blue-700 bg-blue-100 border-blue-300',
            bgBadge: 'bg-blue-500',
            hexColor: '#3b82f6'
        };
    } else if (totalScore >= 500) {
        return {
            name: 'NIVEL DEFICIENTE',
            desc: 'Estructura básica existente pero con brechas críticas operacionales.',
            colorClass: 'text-amber-700 bg-amber-100 border-amber-300',
            bgBadge: 'bg-amber-500',
            hexColor: '#f59e0b'
        };
    } else {
        return {
            name: 'NIVEL CRÍTICO',
            desc: 'Falta grave de controles viales, alto riesgo de siniestralidad y consecuencias penales/legales.',
            colorClass: 'text-red-700 bg-red-100 border-red-300',
            bgBadge: 'bg-red-500',
            hexColor: '#ef4444'
        };
    }
}

// --- HTML Template and Tabs Render ---
export async function renderSecurityVial(container) {
    // Load state from localStorage if available to keep state during session
    const cachedState = localStorage.getItem('iso39001_session_state');
    if (cachedState) {
        try {
            const parsed = JSON.parse(cachedState);
            state.companyName = parsed.companyName || '';
            state.auditorName = parsed.auditorName || '';
            state.auditDate = parsed.auditDate || new Date().toISOString().split('T')[0];
            state.answers = { ...defaultAnswers, ...parsed.answers };
            state.risks = parsed.risks || [];
        } catch (e) {
            console.warn("Error parsing cached state:", e);
        }
    }

    container.innerHTML = `
        <div id="view-security-vial" class="p-6 fade-in h-full flex flex-col space-y-6">
            <!-- Header section -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h2 class="text-3xl font-extrabold text-slate-800 flex items-center">
                        <i class="fas fa-shield-halved text-emerald-600 mr-3"></i> 
                        Seguridad Vial ISO 39001
                    </h2>
                    <p class="text-slate-500 text-sm mt-1">Diagnóstico de madurez vial (1,000 puntos) y Matriz de Riesgos corporativos (ISO 39001:2012).</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <div class="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border">
                        <label class="text-xs font-bold text-slate-500">EMPRESA:</label>
                        <input type="text" id="vial-company-meta" class="bg-transparent font-bold text-sm text-slate-800 outline-none w-36 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 transition" placeholder="Alexa Transportes" value="${state.companyName}" />
                    </div>
                    <div class="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border">
                        <label class="text-xs font-bold text-slate-500">AUDITOR:</label>
                        <input type="text" id="vial-auditor-meta" class="bg-transparent font-bold text-sm text-slate-800 outline-none w-32 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 transition" placeholder="Nombre Auditor" value="${state.auditorName}" />
                    </div>
                    <div class="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border">
                        <label class="text-xs font-bold text-slate-500">FECHA:</label>
                        <input type="date" id="vial-date-meta" class="bg-transparent font-bold text-sm text-slate-800 outline-none border-b border-transparent hover:border-slate-300 focus:border-indigo-500 transition" value="${state.auditDate}" />
                    </div>
                </div>
            </div>

            <!-- Tab Buttons -->
            <div class="flex border-b border-slate-200 bg-white rounded-xl shadow-sm p-1.5 gap-1 shrink-0">
                <button class="vial-tab-btn flex-1 py-3 text-sm font-black rounded-lg transition flex items-center justify-center gap-2 active-vial-tab" data-tab="dashboard">
                    <i class="fas fa-chart-pie"></i> Dashboard
                </button>
                <button class="vial-tab-btn flex-1 py-3 text-sm font-black rounded-lg transition text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2" data-tab="questions">
                    <i class="fas fa-list-check"></i> Cuestionario 1000 Pts
                </button>
                <button class="vial-tab-btn flex-1 py-3 text-sm font-black rounded-lg transition text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2" data-tab="matrix">
                    <i class="fas fa-grid-2"></i> Matriz de Riesgos
                </button>
                <button class="vial-tab-btn flex-1 py-3 text-sm font-black rounded-lg transition text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2" data-tab="report">
                    <i class="fas fa-file-invoice"></i> Reporte Analítico
                </button>
                <button class="vial-tab-btn flex-1 py-3 text-sm font-black rounded-lg transition text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2" data-tab="history">
                    <i class="fas fa-clock-rotate-left"></i> Historial
                </button>
            </div>

            <!-- Tab Contents -->
            <div class="flex-1 min-h-0 relative">
                <div id="vial-tab-content-dashboard" class="vial-tab-pane space-y-6"></div>
                <div id="vial-tab-content-questions" class="vial-tab-pane hidden space-y-6"></div>
                <div id="vial-tab-content-matrix" class="vial-tab-pane hidden space-y-6"></div>
                <div id="vial-tab-content-report" class="vial-tab-pane hidden space-y-6"></div>
                <div id="vial-tab-content-history" class="vial-tab-pane hidden space-y-6"></div>
            </div>
        </div>

        <style>
            .active-vial-tab {
                background-color: #10b981 !important;
                color: #ffffff !important;
                box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2), 0 2px 4px -2px rgba(16, 185, 129, 0.2);
            }
            .vial-tab-pane {
                animation: fadeIn 0.2s ease-in-out;
            }
        </style>
    `;

    // Add event listeners to metadata inputs to sync with state
    const companyInput = container.querySelector('#vial-company-meta');
    const auditorInput = container.querySelector('#vial-auditor-meta');
    const dateInput = container.querySelector('#vial-date-meta');

    const syncMetadata = () => {
        state.companyName = companyInput.value;
        state.auditorName = auditorInput.value;
        state.auditDate = dateInput.value;
        saveLocalSession();
    };

    companyInput.addEventListener('input', syncMetadata);
    auditorInput.addEventListener('input', syncMetadata);
    dateInput.addEventListener('change', syncMetadata);

    // Navigation logic
    const tabButtons = container.querySelectorAll('.vial-tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => {
                b.classList.remove('active-vial-tab');
                b.classList.add('text-slate-500', 'hover:text-slate-700', 'hover:bg-slate-50');
            });
            btn.classList.remove('text-slate-500', 'hover:text-slate-700', 'hover:bg-slate-50');
            btn.classList.add('active-vial-tab');

            // Hide all tab content panes
            container.querySelectorAll('.vial-tab-pane').forEach(pane => pane.classList.add('hidden'));

            // Show selected pane
            const selectedTab = btn.dataset.tab;
            state.currentTab = selectedTab;
            const targetPane = container.querySelector(`#vial-tab-content-${selectedTab}`);
            targetPane.classList.remove('hidden');

            renderCurrentTab(selectedTab, targetPane);
        });
    });

    // Default load Dashboard tab
    renderCurrentTab('dashboard', container.querySelector('#vial-tab-content-dashboard'));
}

function saveLocalSession() {
    localStorage.setItem('iso39001_session_state', JSON.stringify({
        companyName: state.companyName,
        auditorName: state.auditorName,
        auditDate: state.auditDate,
        answers: state.answers,
        risks: state.risks
    }));
}

function renderCurrentTab(tab, pane) {
    if (tab === 'dashboard') {
        renderDashboardTab(pane);
    } else if (tab === 'questions') {
        renderQuestionsTab(pane);
    } else if (tab === 'matrix') {
        renderMatrixTab(pane);
    } else if (tab === 'report') {
        renderReportTab(pane);
    } else if (tab === 'history') {
        renderHistoryTab(pane);
    }
}

// ==========================================
// 1. DASHBOARD TAB
// ==========================================
function renderDashboardTab(pane) {
    const { breakdown, totalScore, compliancePercentage } = calculateISO39001(state.answers);
    const maturity = getMaturityLevel(totalScore);

    // Calculate critical risk alerts
    const criticalRiskCount = state.risks.filter(r => r.criticality >= 16).length;
    const highRiskCount = state.risks.filter(r => r.criticality >= 10 && r.criticality < 16).length;

    pane.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left Panel: Puntuación y Nivel de Madurez -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between items-center text-center">
                <h3 class="text-lg font-bold text-slate-700 mb-4 self-start">Resultado Global de Cumplimiento</h3>
                
                <div class="relative flex items-center justify-center my-6">
                    <svg class="w-48 h-48 transform -rotate-90">
                        <circle cx="96" cy="96" r="80" stroke="#f1f5f9" stroke-width="16" fill="transparent" />
                        <circle cx="96" cy="96" r="80" stroke="${maturity.hexColor}" stroke-width="16" fill="transparent" 
                                stroke-dasharray="502.6" 
                                stroke-dashoffset="${502.6 - (502.6 * compliancePercentage) / 100}"
                                stroke-linecap="round" class="transition-all duration-1000" />
                    </svg>
                    <div class="absolute flex flex-col items-center">
                        <span class="text-4xl font-extrabold text-slate-800">${totalScore}</span>
                        <span class="text-xs text-slate-400 font-bold uppercase tracking-wider">de 1000 Puntos</span>
                        <span class="text-sm font-bold text-slate-600 mt-1">${compliancePercentage.toFixed(1)}%</span>
                    </div>
                </div>

                <div class="w-full mt-4 p-4 rounded-xl border text-center ${maturity.colorClass}">
                    <div class="text-xs font-black uppercase tracking-widest">Nivel de Madurez</div>
                    <div class="text-lg font-extrabold mt-1">${maturity.name}</div>
                    <div class="text-xs mt-2 opacity-90">${maturity.desc}</div>
                </div>
            </div>

            <!-- Middle Panel: Desglose por Áreas -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
                <h3 class="text-lg font-bold text-slate-700 mb-6 flex items-center">
                    <i class="fas fa-chart-column text-emerald-600 mr-2"></i> Desempeño por Áreas Evaluadas
                </h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${Object.keys(areaConfig).map(areaKey => {
                        const area = areaConfig[areaKey];
                        const points = breakdown[areaKey];
                        const pct = (points / area.maxPoints) * 100;
                        let barColor = 'bg-emerald-500';
                        if (pct < 50) barColor = 'bg-red-500';
                        else if (pct < 75) barColor = 'bg-amber-500';

                        return `
                            <div class="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-xs font-black text-slate-700 truncate w-3/4">${area.title}</span>
                                    <span class="text-xs font-extrabold text-slate-500">${points} / ${area.maxPoints} pts</span>
                                </div>
                                <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                    <div class="${barColor} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                                </div>
                                <div class="flex justify-between text-[10px] font-bold text-slate-400 mt-1.5">
                                    <span>Peso: ${area.weight}</span>
                                    <span>${pct.toFixed(0)}%</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Left Bottom Panel: Alertas Rápidas de Riesgos -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                    <h3 class="text-lg font-bold text-slate-700 mb-4 flex items-center">
                        <i class="fas fa-triangle-exclamation text-red-500 mr-2"></i> Alertas de Riesgos Críticos & Altos
                    </h3>
                    <p class="text-slate-400 text-xs mb-6">Amenazas identificadas en la ruta con criticidad severa o crítica.</p>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div class="p-4 rounded-xl border border-red-100 bg-red-50/30 text-center">
                            <div class="text-2xl font-extrabold text-red-600">${criticalRiskCount}</div>
                            <div class="text-xs font-bold text-red-700 mt-1 uppercase">Riesgos Críticos</div>
                        </div>
                        <div class="p-4 rounded-xl border border-amber-100 bg-amber-50/30 text-center">
                            <div class="text-2xl font-extrabold text-amber-600">${highRiskCount}</div>
                            <div class="text-xs font-bold text-amber-700 mt-1 uppercase">Riesgos Altos</div>
                        </div>
                    </div>
                </div>

                <div class="mt-6 border-t pt-4 text-center">
                    <button class="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition" onclick="document.querySelector('.vial-tab-btn[data-tab=\\'matrix\\']').click()">
                        Gestionar Matriz de Riesgos <i class="fas fa-arrow-right ml-1"></i>
                    </button>
                </div>
            </div>

            <!-- Right Bottom Panel: Acciones Rápidas -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                    <h3 class="text-lg font-bold text-slate-700 mb-4 flex items-center">
                        <i class="fas fa-bolt-lightning text-amber-500 mr-2"></i> Acceso Rápido al Diagnóstico
                    </h3>
                    <p class="text-slate-400 text-xs mb-6">Completa el diagnóstico o carga un reporte anterior para evaluar tu madurez de seguridad vial.</p>
                    
                    <div class="space-y-3">
                        <button class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2" onclick="document.querySelector('.vial-tab-btn[data-tab=\\'questions\\']').click()">
                            <i class="fas fa-play"></i> Iniciar Cuestionario de Auditoría
                        </button>
                        <button class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm border border-slate-200 transition flex items-center justify-center gap-2" onclick="document.querySelector('.vial-tab-btn[data-tab=\\'report\\']').click()">
                            <i class="fas fa-file-signature"></i> Ver Reporte y Plan de Acción
                        </button>
                    </div>
                </div>

                <div class="mt-6 border-t pt-4 text-center">
                    <span class="text-xs text-slate-400 font-medium">Estándar ISO 39001:2012 Road Traffic Safety (RTS)</span>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// 2. QUESTIONS TAB
// ==========================================
function renderQuestionsTab(pane) {
    pane.innerHTML = `
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div class="flex justify-between items-center border-b pb-4 mb-6">
                <div>
                    <h3 class="text-xl font-extrabold text-slate-800">Cuestionario Evaluativo (1000 Puntos Máximos)</h3>
                    <p class="text-slate-400 text-xs mt-1">Califica cada requisito para obtener el diagnóstico. Los cambios se calculan en tiempo real.</p>
                </div>
                <div class="text-right">
                    <span class="text-xs font-bold text-slate-400 block uppercase">Puntaje Acumulado</span>
                    <span id="questions-live-score" class="text-2xl font-black text-emerald-600">0 / 1000 pts</span>
                </div>
            </div>

            <!-- Areas Accordion/List -->
            <div class="space-y-6">
                ${Object.keys(areaConfig).map(areaKey => {
                    const area = areaConfig[areaKey];
                    return `
                        <div class="border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition">
                            <!-- Area Header -->
                            <div class="${area.bgColor} p-4 border-b ${area.borderColor} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div>
                                    <h4 class="text-sm font-black ${area.color} uppercase tracking-wider flex items-center">
                                        <span class="h-2.5 w-2.5 rounded-full ${area.color.replace('text-', 'bg-')} inline-block mr-2"></span>
                                        ${area.title}
                                    </h4>
                                    <span class="text-[10px] text-slate-400 font-bold uppercase mt-1 block">Peso: ${area.weight} | Máx: ${area.maxPoints} Puntos</span>
                                </div>
                                <div class="bg-white px-3 py-1.5 rounded-lg border border-slate-100 font-extrabold text-xs text-slate-600">
                                    Puntos en área: <span id="area-score-${areaKey}" class="${area.color} font-black">0</span> / ${area.maxPoints}
                                </div>
                            </div>

                            <!-- Area Requirements -->
                            <div class="divide-y divide-slate-100">
                                ${area.criteria.map(crit => {
                                    const savedVal = state.answers[crit.id] || 0;
                                    return `
                                        <div class="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:bg-slate-50/50 transition">
                                            <div class="flex-1">
                                                <div class="flex items-center gap-2 mb-1.5">
                                                    <span class="px-2 py-0.5 rounded text-[10px] font-black tracking-wide bg-slate-100 text-slate-600 uppercase">${crit.name}</span>
                                                    <span class="text-[10px] font-bold text-slate-400">Puntos Máximos: ${crit.max} pts</span>
                                                </div>
                                                <p class="text-sm font-bold text-slate-700 leading-relaxed">${crit.label}</p>
                                            </div>

                                            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                                                <div class="flex flex-col">
                                                    <label class="text-[10px] font-bold text-slate-400 uppercase mb-1">Nivel de Cumplimiento</label>
                                                    <select class="req-compliance-select bg-slate-50 hover:bg-slate-100 border rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-56" data-req-id="${crit.id}" data-max-pts="${crit.max}" data-area="${areaKey}">
                                                        <option value="0"    ${savedVal === 0 ? 'selected' : ''}>Nulo - 0% (0 pts)</option>
                                                        <option value="0.25" ${savedVal === 0.25 ? 'selected' : ''}>Inicial - 25% (${crit.max * 0.25} pts)</option>
                                                        <option value="0.5"  ${savedVal === 0.5 ? 'selected' : ''}>Parcial - 50% (${crit.max * 0.5} pts)</option>
                                                        <option value="0.75" ${savedVal === 0.75 ? 'selected' : ''}>Avanzado - 75% (${crit.max * 0.75} pts)</option>
                                                        <option value="1.0"  ${savedVal === 1.0 ? 'selected' : ''}>Total - 100% (${crit.max} pts)</option>
                                                    </select>
                                                </div>
                                                <div class="hidden sm:flex flex-col items-center justify-center h-12 w-16 bg-slate-50 border rounded-xl">
                                                    <span id="req-score-display-${crit.id}" class="text-sm font-black text-slate-800">0</span>
                                                    <span class="text-[8px] text-slate-400 font-bold uppercase">pts</span>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // Hook events for compliance changes
    const selectElements = pane.querySelectorAll('.req-compliance-select');
    selectElements.forEach(select => {
        const updateRequirementScore = () => {
            const reqId = select.dataset.reqId;
            const maxPts = parseFloat(select.dataset.maxPts);
            const value = parseFloat(select.value);
            
            // Update state
            state.answers[reqId] = value;
            saveLocalSession();

            // Update individual display
            const displayEl = pane.querySelector(`#req-score-display-${reqId}`);
            if (displayEl) displayEl.innerText = (maxPts * value).toFixed(0);

            // Update area score & total score
            updateLiveCalculations();
        };

        select.addEventListener('change', updateRequirementScore);
        // Initial trigger for each select
        updateRequirementScore();
    });

    function updateLiveCalculations() {
        const { breakdown, totalScore } = calculateISO39001(state.answers);
        
        // Update total score display
        const totalScoreEl = pane.querySelector('#questions-live-score');
        if (totalScoreEl) totalScoreEl.innerText = `${totalScore} / 1000 pts`;

        // Update area displays
        Object.keys(breakdown).forEach(areaKey => {
            const areaScoreEl = pane.querySelector(`#area-score-${areaKey}`);
            if (areaScoreEl) areaScoreEl.innerText = breakdown[areaKey].toFixed(0);
        });
    }
}

// ==========================================
// 3. MATRIX TAB
// ==========================================
function renderMatrixTab(pane) {
    pane.innerHTML = `
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <!-- Left Side: Register threat and list -->
            <div class="space-y-6">
                <!-- Threat registration form -->
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 class="text-lg font-bold text-slate-700 mb-4 flex items-center">
                        <i class="fas fa-circle-plus text-emerald-600 mr-2"></i> Registrar Amenaza Vial
                    </h3>
                    
                    <form id="vial-risk-form" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-black text-slate-500 mb-1.5 uppercase">ÁREA DE EVALUACIÓN</label>
                                <select id="risk-area" class="w-full bg-slate-50 border rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" required>
                                    ${Object.keys(areaConfig).map(key => `<option value="${key}">${areaConfig[key].title}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-black text-slate-500 mb-1.5 uppercase">DESCRIPCIÓN DEL RIESGO</label>
                                <input type="text" id="risk-desc" class="w-full bg-slate-50 border rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Exceso de velocidad en ruta federal..." required />
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-black text-slate-500 mb-1.5 uppercase">CONSECUENCIA POSIBLE</label>
                                <input type="text" id="risk-consequence" class="w-full bg-slate-50 border rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Siniestro vial grave, daño a la mercancía..." required />
                            </div>
                            <div>
                                <label class="block text-xs font-black text-slate-500 mb-1.5 uppercase">MEDIDA DE MITIGACIÓN RECOMENDADA</label>
                                <input type="text" id="risk-mitigation" class="w-full bg-slate-50 border rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Instalar telemetría ADAS con sensores anti-colisión..." required />
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div>
                                <label class="block text-xs font-black text-slate-500 mb-1.5 uppercase">PROBABILIDAD (1 a 5)</label>
                                <select id="risk-prob" class="w-full bg-white border rounded-xl p-2.5 text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500">
                                    <option value="1">1 - Muy Baja</option>
                                    <option value="2">2 - Baja</option>
                                    <option value="3">3 - Media</option>
                                    <option value="4">4 - Alta</option>
                                    <option value="5">5 - Muy Alta</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-black text-slate-500 mb-1.5 uppercase">SEVERIDAD DEL IMPACTO (1 a 5)</label>
                                <select id="risk-sev" class="w-full bg-white border rounded-xl p-2.5 text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500">
                                    <option value="1">1 - Insignificante</option>
                                    <option value="2">2 - Menor</option>
                                    <option value="3">3 - Moderado</option>
                                    <option value="4">4 - Mayor</option>
                                    <option value="5">5 - Catastrófico</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2">
                            <i class="fas fa-plus"></i> Agregar a la Matriz
                        </button>
                    </form>
                </div>

                <!-- Threat list table -->
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 class="text-lg font-bold text-slate-700 mb-4 flex items-center">
                        <i class="fas fa-table-list text-indigo-600 mr-2"></i> Riesgos Registrados
                    </h3>
                    
                    <div class="overflow-x-auto max-h-96 custom-scrollbar border rounded-xl">
                        <table class="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr class="bg-slate-50 border-b border-slate-100 text-slate-500 font-black uppercase">
                                    <th class="p-3">Área</th>
                                    <th class="p-3">Riesgo / Consecuencia</th>
                                    <th class="p-3 text-center">P x S</th>
                                    <th class="p-3 text-center">Criticidad</th>
                                    <th class="p-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="vial-risks-table-body" class="divide-y divide-slate-100">
                                <!-- Loads dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Right Side: 5x5 Heatmap Matrix -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                <h3 class="text-lg font-bold text-slate-700 mb-2 flex items-center">
                    <i class="fas fa-fire text-red-500 mr-2"></i> Mapa de Calor Interactivo 5x5
                </h3>
                <p class="text-slate-400 text-xs mb-6">Distribución visual de los riesgos de la sesión actual en base a su Probabilidad y Severidad.</p>
                
                <div class="flex-1 flex flex-col justify-center items-center">
                    <!-- Matrix Grid Container -->
                    <div class="flex w-full max-w-[480px] gap-2">
                        <!-- Y-Axis Label (Severity) -->
                        <div class="flex flex-col justify-between text-right text-[10px] font-black text-slate-400 w-12 pb-12 pt-6">
                            <span>5 - Catastrófico</span>
                            <span>4 - Mayor</span>
                            <span>3 - Moderado</span>
                            <span>2 - Menor</span>
                            <span>1 - Insignificante</span>
                        </div>

                        <!-- Main Grid and X-Axis Container -->
                        <div class="flex-1 flex flex-col gap-2">
                            <!-- 5x5 Grid Box -->
                            <div class="grid grid-cols-5 grid-rows-5 gap-1.5 aspect-square border-2 border-slate-200 p-1.5 rounded-xl bg-slate-50" id="vial-matrix-grid">
                                <!-- Generated Dynamically by JS -->
                            </div>
                            
                            <!-- X-Axis Label (Probability) -->
                            <div class="grid grid-cols-5 text-center text-[10px] font-black text-slate-400 pt-1">
                                <span>1 - Muy Baja</span>
                                <span>2 - Baja</span>
                                <span>3 - Media</span>
                                <span>4 - Alta</span>
                                <span>5 - Muy Alta</span>
                            </div>
                            <div class="text-center text-xs font-black text-slate-500 mt-2 uppercase tracking-widest">
                                Probabilidad &rarr;
                            </div>
                        </div>
                    </div>
                    
                    <!-- Color legend -->
                    <div class="flex justify-center gap-6 mt-6 w-full max-w-xs border-t pt-4">
                        <div class="flex items-center gap-1.5">
                            <span class="h-3 w-3 rounded bg-emerald-500 inline-block border"></span>
                            <span class="text-[10px] font-bold text-slate-500 uppercase">Bajo (1-4)</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="h-3 w-3 rounded bg-amber-500 inline-block border"></span>
                            <span class="text-[10px] font-bold text-slate-500 uppercase">Medio/Alto (5-15)</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="h-3 w-3 rounded bg-red-500 inline-block border"></span>
                            <span class="text-[10px] font-bold text-slate-500 uppercase">Crítico (16-25)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Handle Risk Add
    const form = pane.querySelector('#vial-risk-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const area = pane.querySelector('#risk-area').value;
        const description = pane.querySelector('#risk-desc').value.trim();
        const consequence = pane.querySelector('#risk-consequence').value.trim();
        const mitigation = pane.querySelector('#risk-mitigation').value.trim();
        const probability = parseInt(pane.querySelector('#risk-prob').value);
        const severity = parseInt(pane.querySelector('#risk-sev').value);
        const criticality = probability * severity;

        const newRisk = {
            id: 'risk_' + Date.now(),
            area,
            description,
            consequence,
            mitigation,
            probability,
            severity,
            criticality
        };

        state.risks.push(newRisk);
        saveLocalSession();
        form.reset();

        renderRisksListAndGrid(pane);
    });

    renderRisksListAndGrid(pane);
}

function renderRisksListAndGrid(pane) {
    const listContainer = pane.querySelector('#vial-risks-table-body');
    const gridContainer = pane.querySelector('#vial-matrix-grid');

    if (!listContainer || !gridContainer) return;

    // 1. Render Table List
    if (state.risks.length === 0) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="5" class="p-6 text-center text-slate-400 font-medium italic">No se han registrado riesgos para esta sesión.</td>
            </tr>
        `;
    } else {
        listContainer.innerHTML = state.risks.map(r => {
            const areaTitle = areaConfig[r.area]?.title || r.area;
            const critClass = r.criticality >= 16 ? 'bg-red-100 text-red-700 font-bold border-red-200' :
                              r.criticality >= 10 ? 'bg-orange-100 text-orange-700 font-bold border-orange-200' :
                              r.criticality >= 5 ? 'bg-amber-100 text-amber-700 font-bold border-amber-200' :
                              'bg-green-100 text-green-700 font-bold border-green-200';
                              
            return `
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-3 font-bold text-slate-700 align-top">${areaTitle}</td>
                    <td class="p-3 align-top">
                        <div class="font-bold text-slate-800">${r.description}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5"><span class="font-bold text-slate-500">Consecuencia:</span> ${r.consequence}</div>
                        <div class="text-[10px] text-slate-500 mt-1"><span class="font-bold text-indigo-500"><i class="fas fa-shield"></i> Mitigación:</span> ${r.mitigation}</div>
                    </td>
                    <td class="p-3 text-center font-mono align-top text-slate-600">${r.probability} x ${r.severity}</td>
                    <td class="p-3 text-center align-top">
                        <span class="px-2 py-0.5 rounded border text-[10px] uppercase ${critClass}">
                            ${r.criticality}
                        </span>
                    </td>
                    <td class="p-3 text-right align-top">
                        <button class="text-red-500 hover:bg-red-50 p-1.5 rounded transition remove-risk-btn" data-risk-id="${r.id}" title="Eliminar Riesgo">
                            <i class="fas fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach delete events
        listContainer.querySelectorAll('.remove-risk-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.riskId;
                state.risks = state.risks.filter(r => r.id !== id);
                saveLocalSession();
                renderRisksListAndGrid(pane);
            };
        });
    }

    // 2. Render 5x5 Heatmap Grid
    gridContainer.innerHTML = '';
    // Rows go Severity from 5 to 1
    for (let r = 5; r >= 1; r--) {
        // Columns go Probability from 1 to 5
        for (let c = 1; c <= 5; c++) {
            const cellScore = r * c;
            
            // Determine BG color based on cell score (criticality)
            let cellBg = 'bg-emerald-500/80 hover:bg-emerald-600/80';
            if (cellScore >= 16) cellBg = 'bg-red-500/90 hover:bg-red-600/90';
            else if (cellScore >= 5) cellBg = 'bg-amber-500/85 hover:bg-amber-600/85';

            // Find risks matching this Probability and Severity
            const cellRisks = state.risks.filter(risk => risk.probability === c && risk.severity === r);
            const hasRisks = cellRisks.length > 0;

            const gridCell = document.createElement('div');
            gridCell.className = `${cellBg} border border-white/20 rounded-lg flex items-center justify-center relative text-white font-mono font-bold text-xs select-none shadow-sm cursor-pointer transition duration-200 group`;
            
            if (hasRisks) {
                // Render a pulsing bubble representing risk counts
                gridCell.innerHTML = `
                    <span class="h-6 w-6 rounded-full bg-white text-slate-800 flex items-center justify-center font-extrabold shadow-md border animate-bounce scale-110">
                        ${cellRisks.length}
                    </span>
                    <!-- Tooltip hover list -->
                    <div class="absolute z-20 bottom-full mb-2 hidden group-hover:block bg-slate-900/95 backdrop-blur-sm text-white text-[10px] p-3 rounded-xl shadow-xl w-48 border border-white/10 text-left pointer-events-none scale-in">
                        <div class="font-extrabold uppercase text-emerald-400 border-b border-white/10 pb-1 mb-1.5">Riesgos en celda (${c}x${r}):</div>
                        <ul class="list-disc pl-3.5 space-y-1 font-sans">
                            ${cellRisks.map(cr => `<li class="truncate"><span class="font-bold">${areaConfig[cr.area]?.title.slice(0,10)}:</span> ${cr.description}</li>`).join('')}
                        </ul>
                    </div>
                `;
            } else {
                // Display the raw score in muted text
                gridCell.innerHTML = `
                    <span class="text-white/25">${cellScore}</span>
                `;
            }

            // Click cell to show SweetAlert info
            gridCell.onclick = () => {
                if (cellRisks.length === 0) return;
                
                const listHtml = cellRisks.map((cr, idx) => `
                    <div class="text-left bg-slate-50 p-4 border rounded-xl mb-3 shadow-inner">
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-xs font-black text-indigo-700 uppercase">[Riesgo #${idx+1} - ${areaConfig[cr.area]?.title || cr.area}]</span>
                            <span class="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-black border">Criticidad ${cr.criticality}</span>
                        </div>
                        <p class="text-sm font-bold text-slate-800 mb-1">${cr.description}</p>
                        <p class="text-xs text-slate-500 mb-2"><span class="font-bold">Consecuencia:</span> ${cr.consequence}</p>
                        <div class="border-t pt-2 mt-2">
                            <p class="text-xs font-bold text-emerald-700"><i class="fas fa-shield-halved"></i> Mitigación Recomendada:</p>
                            <p class="text-xs text-slate-700 mt-0.5">${cr.mitigation}</p>
                        </div>
                    </div>
                `).join('');

                Swal.fire({
                    title: `Riesgos en Celda (Probabilidad: ${c} / Severidad: ${r})`,
                    html: `<div class="max-h-96 overflow-y-auto custom-scrollbar pr-2 mt-4">${listHtml}</div>`,
                    confirmButtonText: 'Cerrar',
                    confirmButtonColor: '#10b981'
                });
            };

            gridContainer.appendChild(gridCell);
        }
    }
}

// ==========================================
// 4. REPORT TAB
// ==========================================
function renderReportTab(pane) {
    const { breakdown, totalScore, compliancePercentage } = calculateISO39001(state.answers);
    const maturity = getMaturityLevel(totalScore);

    // Identify gaps: list areas sorted by lowest compliance percent
    const areaCompliance = Object.keys(areaConfig).map(areaKey => {
        const area = areaConfig[areaKey];
        const points = breakdown[areaKey];
        const pct = (points / area.maxPoints) * 100;
        return {
            key: areaKey,
            title: area.title,
            points,
            maxPoints: area.maxPoints,
            percentage: pct
        };
    }).sort((a, b) => a.percentage - b.percentage);

    const lowestAreas = areaCompliance.slice(0, 3); // Top 3 worst performing areas

    // Critical/High risk alerts
    const alerts = state.risks.filter(r => r.criticality >= 10);

    // Technical Mitigation Actions Recommendations based on lowest compliance areas
    const recommendations = {
        mantenimiento: 'Digitalización inmediata de la orden de trabajo de mantenimiento preventivo e implementación de sensores automáticos de desgaste.',
        operaciones: 'Auditar la capacidad de estiba, peso por eje y planificar paradas en la Red Federal SCT para descanso de conductores.',
        monitoreo: 'Integración de telemetría Samsara en vivo con alertas automáticas sonoras en cabina ante excesiones de velocidad en zonas de riesgo.',
        rh: 'Implementación de pruebas aleatorias de sustancias y obligatoriedad del programa de capacitación NOM-087 de descanso obligatorio.',
        sistemas: 'Implantar un sistema MDM (Mobile Device Management) corporativo en los teléfonos de los operadores para bloquear mensajería instantánea en tránsito.',
        direccion: 'Creación formal del Comité de Seguridad Vial y dotación de fondos de contingencia para reparaciones en ruta.',
        calidad: 'Establecer auditorías cruzadas internas semestrales y registrar los incidentes viales bajo el método de espina de pescado (Ishikawa).',
        clientes: 'Sensibilización contractual al cliente mediante adendas para excluir penalizaciones por retrasos derivados de incidentes climáticos, accidentes o cierres viales.'
    };

    pane.innerHTML = `
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <!-- Save and Actions Header -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                <div>
                    <h3 class="text-md font-extrabold text-slate-700">Guardado Oficial y Reporte</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Almacena el reporte actual en las bases corporativas</p>
                </div>
                <div class="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button id="vial-save-db-btn" class="flex-1 sm:flex-none py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-md transition flex items-center justify-center gap-2">
                        <i class="fas fa-floppy-disk"></i> Guardar Reporte (Supabase)
                    </button>
                    <button id="vial-export-pdf-btn" class="flex-1 sm:flex-none py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs shadow-md transition flex items-center justify-center gap-2">
                        <i class="fas fa-file-pdf"></i> Exportar PDF
                    </button>
                    <button id="vial-export-excel-btn" class="flex-1 sm:flex-none py-2.5 px-4 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold text-xs shadow-md transition flex items-center justify-center gap-2">
                        <i class="fas fa-file-excel"></i> Exportar Excel
                    </button>
                </div>
            </div>

            <!-- 1. General Summary Card -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="p-6 rounded-2xl border border-slate-150 bg-slate-50/50">
                    <h4 class="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Resumen de Calificación</h4>
                    <div class="flex items-baseline gap-2">
                        <span class="text-4xl font-extrabold text-slate-800">${totalScore}</span>
                        <span class="text-slate-400 font-extrabold text-xs">/ 1,000 PUNTOS MÁXIMOS</span>
                    </div>
                    <div class="text-sm font-extrabold text-slate-600 mt-1">${compliancePercentage.toFixed(1)}% de cumplimiento general</div>
                </div>

                <div class="p-6 rounded-2xl border ${maturity.colorClass}">
                    <h4 class="text-xs font-black opacity-80 uppercase tracking-widest mb-1">Nivel de Madurez</h4>
                    <div class="text-2xl font-black">${maturity.name}</div>
                    <p class="text-xs mt-2 opacity-90 leading-relaxed">${maturity.desc}</p>
                </div>
            </div>

            <hr class="border-slate-150" />

            <!-- 2. Gap Identification -->
            <div>
                <h4 class="text-sm font-black text-slate-700 mb-3 flex items-center">
                    <i class="fas fa-chart-line-down text-red-500 mr-2"></i> Identificación de Brechas Críticas (Áreas Críticas)
                </h4>
                <p class="text-slate-400 text-xs mb-4">Las áreas peor evaluadas requieren atención inmediata para reducir la exposición al riesgo en ruta.</p>
                
                <div class="space-y-3">
                    ${lowestAreas.map((la, idx) => `
                        <div class="flex items-center justify-between p-3 bg-red-50/20 border border-red-100 rounded-xl">
                            <div class="flex items-center gap-3">
                                <span class="h-6 w-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-extrabold text-xs">#${idx+1}</span>
                                <div>
                                    <span class="text-sm font-bold text-slate-800">${la.title}</span>
                                    <span class="text-[10px] text-slate-400 font-bold block mt-0.5">Peso asignado: ${areaConfig[la.key]?.weight}</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="text-sm font-black text-red-600">${la.percentage.toFixed(0)}%</span>
                                <span class="text-[9px] text-slate-400 font-bold block">${la.points} / ${la.maxPoints} pts</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <hr class="border-slate-150" />

            <!-- 3. Risk Alerts -->
            <div>
                <h4 class="text-sm font-black text-slate-700 mb-3 flex items-center">
                    <i class="fas fa-triangle-exclamation text-orange-500 mr-2"></i> Alertas de Riesgos de Ruta (Severos/Críticos)
                </h4>
                <p class="text-slate-400 text-xs mb-4">Amenazas registradas en la matriz que rebasan el umbral de tolerancia al riesgo (P x S >= 10).</p>
                
                ${alerts.length === 0 ? `
                    <div class="p-4 bg-emerald-50/20 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                        <i class="fas fa-circle-check text-sm text-emerald-600"></i> No se registran amenazas que rebasen los niveles aceptables en la sesión actual.
                    </div>
                ` : `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${alerts.map(r => {
                            const isCritical = r.criticality >= 16;
                            const pillColor = isCritical ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200';
                            return `
                                <div class="p-4 bg-slate-50 border rounded-xl shadow-sm hover:shadow transition">
                                    <div class="flex justify-between items-start mb-2">
                                        <span class="px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${pillColor}">
                                            ${isCritical ? 'Crítico' : 'Alto'} - PxS: ${r.criticality}
                                        </span>
                                        <span class="text-[9px] font-extrabold text-slate-400 uppercase">${areaConfig[r.area]?.title}</span>
                                    </div>
                                    <h5 class="text-sm font-extrabold text-slate-800">${r.description}</h5>
                                    <p class="text-[10px] text-slate-400 mt-1"><span class="font-bold text-slate-500">Consecuencia:</span> ${r.consequence}</p>
                                    <div class="mt-3 bg-white p-2 rounded border border-slate-100">
                                        <span class="text-[9px] font-black text-indigo-700 block uppercase"><i class="fas fa-shield-halved"></i> Mitigación</span>
                                        <p class="text-[10px] text-slate-700 mt-0.5">${r.mitigation}</p>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>

            <hr class="border-slate-150" />

            <!-- 4. Prioritized Mitigation Plan -->
            <div>
                <h4 class="text-sm font-black text-slate-700 mb-3 flex items-center">
                    <i class="fas fa-list-check text-emerald-600 mr-2"></i> Acciones de Mitigación Prioritarias (Plan de Acción)
                </h4>
                <p class="text-slate-400 text-xs mb-4">Recomendaciones técnicas del sistema para mitigar brechas críticas identificadas en el cuestionario.</p>
                
                <div class="space-y-4">
                    ${lowestAreas.map((la, idx) => {
                        const recText = recommendations[la.key] || 'Establecer controles operacionales y revisiones periódicas del criterio normativo.';
                        return `
                            <div class="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-200 transition">
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${areaConfig[la.key]?.badgeColor}">
                                        ${la.title}
                                    </span>
                                    <span class="text-[10px] font-bold text-red-500 uppercase">Prioridad #${idx+1}</span>
                                </div>
                                <p class="text-xs font-bold text-slate-800">${recText}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    // Hook events for save, pdf and excel
    pane.querySelector('#vial-save-db-btn').onclick = () => saveReportToDatabases(pane);
    pane.querySelector('#vial-export-pdf-btn').onclick = () => exportReportPDF(totalScore, compliancePercentage, maturity, lowestAreas, alerts);
    pane.querySelector('#vial-export-excel-btn').onclick = () => exportReportExcel(totalScore, compliancePercentage, maturity);
}

// ==========================================
// 5. HISTORY TAB
// ==========================================
async function renderHistoryTab(pane) {
    pane.innerHTML = `
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
            <div class="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                <div>
                    <h3 class="text-xl font-extrabold text-slate-800">Historial de Auditorías ISO 39001</h3>
                    <p class="text-slate-400 text-xs mt-1">Carga o visualiza reportes oficiales anteriores guardados en las bases corporativas.</p>
                </div>
                <button id="vial-sync-history-btn" class="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-4 rounded-lg text-xs font-bold border border-slate-200 transition flex items-center gap-2">
                    <i class="fas fa-arrows-rotate"></i> Actualizar
                </button>
            </div>

            <!-- Loader -->
            <div id="vial-history-loading" class="flex-1 flex flex-col items-center justify-center py-10">
                <div class="spinner border-t-emerald-500 w-10 h-10 mb-2"></div>
                <span class="text-xs text-slate-400 font-bold uppercase">Cargando Historial...</span>
            </div>

            <!-- Table -->
            <div id="vial-history-content" class="hidden flex-1 overflow-auto custom-scrollbar">
                <div class="overflow-x-auto border rounded-xl">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-100 text-slate-500 font-black uppercase">
                                <th class="p-3">Fecha</th>
                                <th class="p-3">Empresa</th>
                                <th class="p-3">Auditor</th>
                                <th class="p-3 text-center">Puntaje</th>
                                <th class="p-3 text-center">Madurez</th>
                                <th class="p-3 text-center">Base de Datos</th>
                                <th class="p-3 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="vial-history-table-body" class="divide-y divide-slate-100">
                            <!-- Dynamically loaded -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    pane.querySelector('#vial-sync-history-btn').onclick = () => loadHistoryData(pane);
    loadHistoryData(pane);
}

async function loadHistoryData(pane) {
    const loadingEl = pane.querySelector('#vial-history-loading');
    const contentEl = pane.querySelector('#vial-history-content');
    const tbody = pane.querySelector('#vial-history-table-body');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (contentEl) contentEl.classList.add('hidden');

    let combinedReports = [];

    // 1. Load from Supabase
    try {
        const { data: supabaseReports, error } = await supabase
            .from('iso39001_reports')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && supabaseReports) {
            supabaseReports.forEach(r => {
                combinedReports.push({
                    id: r.id,
                    companyName: r.company_name,
                    auditorName: r.auditor,
                    auditDate: r.audit_date,
                    totalScore: r.total_score,
                    compliancePercentage: parseFloat(r.compliance_percentage),
                    maturityLevel: r.maturity_level,
                    answers: r.answers,
                    risks: r.risk_matrix,
                    source: 'Supabase',
                    createdAt: r.created_at
                });
            });
        } else {
            console.warn("Error cargando historial de Supabase:", error);
        }
    } catch (e) {
        console.warn("Error de conexión con Supabase:", e);
    }

    // Sort by audit date descending
    combinedReports.sort((a, b) => new Date(b.auditDate) - new Date(a.auditDate));

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.classList.remove('hidden');

    if (combinedReports.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-6 text-center text-slate-400 font-medium italic">No se encontraron reportes históricos en las bases de datos.</td>
            </tr>
        `;
    } else {
        tbody.innerHTML = combinedReports.map(r => {
            const dateStr = r.auditDate;
            const maturity = getMaturityLevel(r.totalScore);
            return `
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-3 font-mono font-bold text-slate-700">${dateStr}</td>
                    <td class="p-3 font-bold text-slate-800">${r.companyName || 'Alexa Transportes'}</td>
                    <td class="p-3 font-medium text-slate-600">${r.auditorName || '---'}</td>
                    <td class="p-3 text-center font-extrabold text-slate-800">${r.totalScore} / 1000</td>
                    <td class="p-3 text-center">
                        <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase ${maturity.colorClass} border">
                            ${r.maturityLevel}
                        </span>
                    </td>
                    <td class="p-3 text-center">
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            ${r.source}
                        </span>
                    </td>
                    <td class="p-3 text-right">
                        <button class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black transition load-report-btn" data-report-index="${combinedReports.indexOf(r)}">
                            Cargar Auditoría
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Hook load buttons
        tbody.querySelectorAll('.load-report-btn').forEach(btn => {
            btn.onclick = () => {
                const r = combinedReports[parseInt(btn.dataset.reportIndex)];
                
                // Populate session state
                state.companyName = r.companyName || '';
                state.auditorName = r.auditorName || '';
                state.auditDate = r.auditDate || new Date().toISOString().split('T')[0];
                state.answers = { ...defaultAnswers, ...r.answers };
                state.risks = r.risks || [];

                saveLocalSession();

                // Refresh UI metadata inputs
                const companyInput = document.getElementById('vial-company-meta');
                const auditorInput = document.getElementById('vial-auditor-meta');
                const dateInput = document.getElementById('vial-date-meta');
                if (companyInput) companyInput.value = state.companyName;
                if (auditorInput) auditorInput.value = state.auditorName;
                if (dateInput) dateInput.value = state.auditDate;

                Swal.fire({
                    icon: 'success',
                    title: 'Auditoría Cargada con Éxito',
                    text: `Se cargó el reporte del día ${r.auditDate} de la empresa ${r.companyName}.`,
                    confirmButtonText: 'Ver Dashboard',
                    confirmButtonColor: '#10b981'
                }).then(() => {
                    // Navigate to Dashboard tab
                    document.querySelector('.vial-tab-btn[data-tab="dashboard"]').click();
                });
            };
        });
    }
}

// ==========================================
// WRITE/SAVE ACTION LOGIC (SUPABASE)
// ==========================================
async function saveReportToDatabases(pane) {
    // 1. Collect inputs
    const companyInput = document.getElementById('vial-company-meta');
    const auditorInput = document.getElementById('vial-auditor-meta');
    const dateInput = document.getElementById('vial-date-meta');

    const companyName = companyInput ? companyInput.value.trim() : '';
    const auditor = auditorInput ? auditorInput.value.trim() : '';
    const auditDate = dateInput ? dateInput.value : '';

    if (!companyName || !auditor || !auditDate) {
        Swal.fire({
            icon: 'warning',
            title: 'Metadatos Incompletos',
            text: 'Por favor, ingresa el nombre de la Empresa, el Auditor y la Fecha del reporte en la cabecera superior antes de guardar.',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#f59e0b'
        });
        return;
    }

    const { breakdown, totalScore, compliancePercentage } = calculateISO39001(state.answers);
    const maturity = getMaturityLevel(totalScore);

    // Show loading alert
    Swal.fire({
        title: 'Guardando Reporte Oficial...',
        html: '<div class="spinner border-t-emerald-500 w-10 h-10 my-4"></div><p class="text-xs text-slate-500">Registrando datos en Supabase...</p>',
        showConfirmButton: false,
        allowOutsideClick: false
    });

    let savedToSupabase = false;
    let errorMsg = '';

    try {
        const { error: sbError } = await supabase
            .from('iso39001_reports')
            .insert({
                company_name: companyName,
                auditor: auditor,
                audit_date: auditDate,
                total_score: totalScore,
                compliance_percentage: parseFloat(compliancePercentage.toFixed(2)),
                maturity_level: maturity.name,
                answers: state.answers,
                risk_matrix: state.risks
            });

        if (sbError) {
            console.error("Supabase write failed:", sbError);
            errorMsg = sbError.message;
        } else {
            savedToSupabase = true;
        }
    } catch (e) {
        console.error("Supabase write exception:", e);
        errorMsg = e.message || e;
    }

    // Process outcome
    Swal.close();

    if (savedToSupabase) {
        Swal.fire({
            icon: 'success',
            title: 'Reporte Guardado Exitosamente',
            text: 'El diagnóstico ISO 39001 se ha registrado de forma inalterable en la base de datos Supabase.',
            confirmButtonText: 'Excelente',
            confirmButtonColor: '#10b981'
        });
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Error al Guardar en Supabase',
            html: `
                <div class="text-left text-xs text-slate-600">
                    <p class="mb-2">No se pudo guardar el reporte en la base de datos Supabase debido al siguiente error:</p>
                    <pre class="bg-red-50 border p-2 rounded text-[10px] text-red-700 overflow-x-auto mb-3 font-mono">${errorMsg || 'Tabla no disponible'}</pre>
                    <p class="font-bold text-slate-800">Solución recomendada para el Administrador:</p>
                    <p class="mt-1">Asegúrate de haber ejecutado el script de migración <code class="bg-slate-100 p-0.5 rounded border text-[10px] font-bold">v12_iso39001_reports.sql</code> en el editor SQL de tu Supabase Dashboard para crear la tabla correspondiente.</p>
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#ef4444'
        });
    }
}

// ==========================================
// PDF EXPORT FUNCTION
// ==========================================
function exportReportPDF(totalScore, compliancePercentage, maturity, lowestAreas, alerts) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        Swal.fire({
            icon: 'error',
            title: 'Librería jsPDF no disponible',
            text: 'No se pudo cargar la librería jsPDF. Asegúrate de tener conexión a internet.',
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#ef4444'
        });
        return;
    }

    try {
        const doc = new jsPDF();
        const logoImg = './logo/logo.png';

        // 1. Header with styling
        doc.setFillColor(15, 23, 42); // Navy Slate
        doc.rect(0, 0, 210, 35, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("PANEL ALEXA - AUDITORÍA SEGURIDAD VIAL", 15, 17);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Norma Internacional ISO 39001:2012 · Diagnóstico y Matriz de Riesgos`, 15, 25);
        
        // Metadata table info
        doc.setFillColor(248, 250, 252);
        doc.rect(15, 45, 180, 20, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(15, 45, 180, 20, 'S');

        doc.setTextColor(51, 65, 85);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Empresa:", 20, 52);
        doc.text("Auditor:", 20, 60);
        doc.text("Fecha:", 120, 52);
        doc.text("Maturidad:", 120, 60);

        doc.setFont("helvetica", "normal");
        doc.text(state.companyName || "Alexa Transportes", 40, 52);
        doc.text(state.auditorName || "SGSV Auditor", 40, 60);
        doc.text(state.auditDate, 140, 52);
        doc.setFont("helvetica", "bold");
        doc.text(`${maturity.name} (${totalScore} pts / ${compliancePercentage.toFixed(1)}%)`, 140, 60);

        // 2. Score breakdown table
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("DESGLOSE DE PUNTUACIÓN POR ÁREA", 15, 76);

        const { breakdown } = calculateISO39001(state.answers);
        const tableData = Object.keys(areaConfig).map(areaKey => {
            const area = areaConfig[areaKey];
            const points = breakdown[areaKey];
            const pct = ((points / area.maxPoints) * 100).toFixed(0) + '%';
            return [area.title, area.weight, `${points} / ${area.maxPoints} pts`, pct];
        });

        doc.autoTable({
            startY: 81,
            head: [['Área de Evaluación', 'Peso', 'Puntos Obtenidos', 'Cumplimiento']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [16, 185, 129] }, // Emerald Green
            styles: { fontSize: 8.5 }
        });

        let currentY = doc.autoTable.previous.finalY + 12;

        // 3. Gap Identification
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("BRECHAS CRÍTICAS IDENTIFICADAS", 15, currentY);
        
        currentY += 5;
        lowestAreas.forEach((la, idx) => {
            doc.setFillColor(254, 242, 242); // Red 50
            doc.rect(15, currentY, 180, 10, 'F');
            doc.setDrawColor(254, 226, 226); // Red 200
            doc.rect(15, currentY, 180, 10, 'S');

            doc.setTextColor(185, 28, 28); // Red 700
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.text(`Prioridad #${idx+1} - ${la.title}:`, 20, currentY + 6.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(51, 65, 85);
            doc.text(`Cumplimiento de ${la.percentage.toFixed(0)}% · Puntos: ${la.points} / ${la.maxPoints}`, 78, currentY + 6.5);
            
            currentY += 13;
        });

        // Add page break if running out of space
        if (currentY > 210) {
            doc.addPage();
            currentY = 25;
        }

        // 4. Critical risks
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("ALERTAS DE AMENAZAS EN RUTA (PxS >= 10)", 15, currentY);
        currentY += 5;

        if (alerts.length === 0) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text("No se registran amenazas viales críticas en la sesión.", 15, currentY);
            currentY += 8;
        } else {
            const riskRows = alerts.map(r => [
                areaConfig[r.area]?.title || r.area,
                r.description,
                r.probability + ' x ' + r.severity,
                r.criticality,
                r.mitigation
            ]);

            doc.autoTable({
                startY: currentY,
                head: [['Área', 'Descripción de Riesgo', 'PxS', 'Criticidad', 'Medida de Mitigación']],
                body: riskRows,
                theme: 'grid',
                headStyles: { fillColor: [239, 68, 68] }, // Red
                styles: { fontSize: 8 },
                columnStyles: {
                    4: { cellWidth: 55 }
                }
            });
            currentY = doc.autoTable.previous.finalY + 12;
        }

        // Footer signature line
        if (currentY > 240) {
            doc.addPage();
            currentY = 40;
        }
        
        doc.setLineWidth(0.5);
        doc.setDrawColor(200);
        doc.line(15, currentY + 15, 85, currentY + 15);
        doc.line(125, currentY + 15, 195, currentY + 15);
        
        doc.setTextColor(100);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text("Firma de Auditor Interno", 30, currentY + 20);
        doc.text("Firma Dirección General", 140, currentY + 20);

        doc.save(`Auditoria_ISO39001_${state.companyName || 'Alexa'}_${state.auditDate}.pdf`);

        Swal.fire({
            icon: 'success',
            title: 'PDF Generado Correctamente',
            text: 'El reporte de auditoría se ha descargado en tu dispositivo.',
            confirmButtonText: 'Excelente',
            confirmButtonColor: '#10b981'
        });

    } catch (e) {
        console.error("PDF generation failed:", e);
        Swal.fire({
            icon: 'error',
            title: 'Error al Exportar PDF',
            text: 'Hubo un error al compilar el documento PDF: ' + e.message,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#ef4444'
        });
    }
}

// ==========================================
// EXCEL EXPORT FUNCTION
// ==========================================
function exportReportExcel(totalScore, compliancePercentage, maturity) {
    if (!window.XLSX) {
        Swal.fire({
            icon: 'error',
            title: 'Librería SheetJS no disponible',
            text: 'No se pudo cargar la librería XLSX para exportar Excel.',
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#ef4444'
        });
        return;
    }

    try {
        const XLSX = window.XLSX;
        
        // 1. Create a new Workbook
        const wb = XLSX.utils.book_new();

        // ========================================================
        // SHEET 1: RESUMEN EJECUTIVO
        // ========================================================
        const summaryData = [
            ["REPORTE EJECUTIVO DE AUDITORÍA - SEGURIDAD VIAL ISO 39001:2012"],
            [],
            ["METADATOS GENERALES"],
            ["Empresa / Organización:", state.companyName || 'Alexa Transportes'],
            ["Auditor Responsable:", state.auditorName || '---'],
            ["Fecha de Auditoría:", state.auditDate],
            [],
            ["RESULTADOS DEL DIAGNÓSTICO"],
            ["Puntaje Acumulado:", `${totalScore} / 1,000 puntos`],
            ["Porcentaje de Cumplimiento:", `${compliancePercentage.toFixed(2)}%`],
            ["Nivel de Madurez Vial:", maturity.name],
            ["Descripción de Madurez:", maturity.desc],
            [],
            ["DESGLOSE DE CUMPLIMIENTO POR ÁREA"],
            ["Área Corporativa", "Peso", "Puntos Obtenidos", "Puntos Máximos", "% Cumplimiento"]
        ];

        const { breakdown } = calculateISO39001(state.answers);
        Object.keys(areaConfig).forEach(areaKey => {
            const area = areaConfig[areaKey];
            const score = breakdown[areaKey] || 0;
            const pct = (score / area.maxPoints) * 100;
            summaryData.push([
                area.title,
                area.weight,
                score,
                area.maxPoints,
                `${pct.toFixed(1)}%`
            ]);
        });

        // Add action plans
        summaryData.push([], ["RECOMENDACIONES Y PLAN DE ACCIÓN PRIORITARIO"]);
        const areaCompliance = Object.keys(areaConfig).map(areaKey => {
            const score = breakdown[areaKey] || 0;
            const pct = (score / areaConfig[areaKey].maxPoints) * 100;
            return { key: areaKey, title: areaConfig[areaKey].title, pct };
        });
        // Sort lowest compliance first
        areaCompliance.sort((a, b) => a.pct - b.pct);
        const lowestThree = areaCompliance.slice(0, 3);
        
        lowestThree.forEach((la, idx) => {
            let actionText = "";
            if (la.key === 'mantenimiento') {
                actionText = "Digitalizar el 100% de checklists pre-operativos mecánicos y programar mantenimientos preventivos sistemáticos con alertas automatizadas.";
            } else if (la.key === 'operaciones') {
                actionText = "Implementar auditorías rigurosas de trincado, peso de la carga y mapeo georreferenciado de rutas de alto riesgo.";
            } else if (la.key === 'monitoreo') {
                actionText = "Establecer protocolos inmediatos de reacción frente a excesos de velocidad y capacitar mensualmente en seguridad vial.";
            } else if (la.key === 'rh') {
                actionText = "Fortalecer exámenes teóricos de conocimientos, pruebas prácticas de carga/descarga y programa auditable de dotación trimestral de EPP.";
            } else if (la.key === 'sistemas') {
                actionText = "Activar redundancia e implementar políticas de bloqueo de pantalla y mensajería en dispositivos corporativos en tránsito.";
            } else if (la.key === 'direccion') {
                actionText = "Constituir el Comité de Seguridad Vial y asignar presupuesto exclusivo protegido para reparaciones urgentes.";
            } else if (la.key === 'calidad') {
                actionText = "Auditar formalmente el SGSV de forma semestral y registrar todo siniestro bajo el método de Análisis de Causa Raíz.";
            } else if (la.key === 'clientes') {
                actionText = "Habilitar canal público de quejas de conducción e integrar cláusulas de exención de demoras por motivos de seguridad.";
            }
            summaryData.push([`Brecha #${idx + 1} - ${la.title}:`, actionText]);
        });

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

        // Styling widths and merges for summary sheet
        wsSummary['!cols'] = [
            { wch: 30 }, // A
            { wch: 75 }, // B
            { wch: 18 }, // C
            { wch: 18 }, // D
            { wch: 18 }  // E
        ];

        // Merge title
        wsSummary['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
        ];

        XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Ejecutivo");

        // ========================================================
        // SHEET 2: CUESTIONARIO DETALLADO
        // ========================================================
        const questData = [
            ["EVALUACIÓN DETALLADA DE REQUISITOS - ISO 39001"],
            [],
            ["ID", "Área Corporativa", "Criterio de Evaluación", "Nivel de Cumplimiento", "Puntos Obtenidos", "Puntos Máximos"]
        ];

        Object.keys(areaConfig).forEach(areaKey => {
            const area = areaConfig[areaKey];
            area.criteria.forEach(crit => {
                const compliance = state.answers[crit.id] || 0;
                const points = compliance * crit.max;
                const complianceText = compliance === 0 ? "Nulo (0%)" :
                                     compliance === 0.25 ? "Inicial (25%)" :
                                     compliance === 0.50 ? "Parcial (50%)" :
                                     compliance === 0.75 ? "Avanzado (75%)" : "Total (100%)";
                questData.push([
                    crit.name,
                    area.title,
                    crit.label,
                    complianceText,
                    points,
                    crit.max
                ]);
            });
        });

        const wsQuest = XLSX.utils.aoa_to_sheet(questData);
        wsQuest['!cols'] = [
            { wch: 10 }, // A: ID
            { wch: 25 }, // B: Area
            { wch: 85 }, // C: Requisito
            { wch: 22 }, // D: Cumplimiento
            { wch: 18 }, // E: Obtenidos
            { wch: 18 }  // F: Max
        ];
        wsQuest['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }
        ];

        XLSX.utils.book_append_sheet(wb, wsQuest, "Cuestionario Evaluativo");

        // ========================================================
        // SHEET 3: MATRIZ DE RIESGOS
        // ========================================================
        const riskData = [
            ["MATRIZ DE RIESGOS VIALES (CRITICIDAD 5x5)"],
            [],
            ["ID", "Área", "Descripción del Riesgo", "Consecuencia", "Probabilidad", "Severidad", "Nivel (PxS)", "Criticidad", "Medidas de Mitigación"]
        ];

        if (state.risks && state.risks.length > 0) {
            state.risks.forEach((r, idx) => {
                const pxs = r.probability * r.severity;
                let classification = 'BAJO';
                if (pxs >= 16) classification = 'CRÍTICO';
                else if (pxs >= 10) classification = 'ALTO';
                else if (pxs >= 5) classification = 'MEDIO';

                riskData.push([
                    `R-${idx + 1}`,
                    areaConfig[r.area]?.title || r.area,
                    r.description,
                    r.consequence,
                    r.probability,
                    r.severity,
                    pxs,
                    classification,
                    r.mitigation
                ]);
            });
        } else {
            riskData.push(["No se registraron riesgos en esta auditoría."]);
        }

        const wsRisk = XLSX.utils.aoa_to_sheet(riskData);
        wsRisk['!cols'] = [
            { wch: 8 },  // A: ID
            { wch: 25 }, // B: Area
            { wch: 45 }, // C: Descripcion
            { wch: 35 }, // D: Consecuencia
            { wch: 12 }, // E: Probabilidad
            { wch: 10 }, // F: Severidad
            { wch: 12 }, // G: PxS
            { wch: 12 }, // H: Criticidad
            { wch: 55 }  // I: Mitigacion
        ];
        wsRisk['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }
        ];

        XLSX.utils.book_append_sheet(wb, wsRisk, "Matriz de Riesgos");

        // 4. Trigger Download
        const companyClean = (state.companyName || 'Alexa').replace(/[^a-zA-Z0-9]/g, '_');
        XLSX.writeFile(wb, `Auditoria_ISO39001_${companyClean}_${state.auditDate}.xlsx`);

        Swal.fire({
            icon: 'success',
            title: 'Excel Generado Correctamente',
            text: 'El libro de Excel de auditoría se ha descargado en tu dispositivo.',
            confirmButtonText: 'Excelente',
            confirmButtonColor: '#10b981'
        });

    } catch (e) {
        console.error("Excel generation failed:", e);
        Swal.fire({
            icon: 'error',
            title: 'Error al Exportar Excel',
            text: 'Hubo un error al compilar el documento Excel: ' + e.message,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#ef4444'
        });
    }
}
