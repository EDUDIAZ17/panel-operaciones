import { renderDashboard } from './modules/dashboard.js';
import { renderAssignments } from './modules/assignments.js';
import { renderExpenses } from './modules/expenses.js';
import { renderAdmin } from './modules/admin.js';
import { renderReports } from './modules/reports.js';
import { renderObservations } from './modules/observations.js';
import { renderCameras } from './modules/cameras.js';
import { renderIncidents } from './modules/incidents.js';
import { renderClientReports } from './modules/client_reports.js';
import { renderHistoryReports } from './modules/history_reports.js';
import { renderTripLogs } from './modules/trip_logs.js';
import { renderPayrollMap } from './modules/payroll_map.js';
import { supabase } from './services/supabaseClient.js';

// DOM Elements
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
const navButtons = document.querySelectorAll('.nav-btn');

// State
const state = {
    currentView: 'dashboard'
};

// Config User Display
try {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (currentUser) {
        const nameEl = document.querySelector('.user-profile .name');
        const roleEl = document.querySelector('.user-profile .role');
        const displayEl = document.getElementById('current-user-display');
        
        if (nameEl) nameEl.textContent = currentUser.name;
        
        // Format role nicely
        const formatRole = (role) => {
            const map = {
                'operaciones': 'Operaciones',
                'torre_control': 'Torre de Control',
                'rh': 'Recursos Humanos',
                'direccion_general': 'Dirección General',
                'contabilidad': 'Contabilidad',
                'otros_usuarios': 'Usuario General',
                'admin': 'Admin',
                'atc': 'Atención a Clientes'
            };
            return map[role] || role.toUpperCase();
        };

        if (roleEl) roleEl.textContent = formatRole(currentUser.role);
        if (displayEl) displayEl.textContent = `Bienvenido, ${currentUser.name}`;

        // Role-based UI restrictions
        const role = currentUser.role;
        window.userRole = role; // Export role to window so other modules can handle granular element visibility (e.g. hiding edit buttons)

        const allNavs = [
            'nav-assignments', 'nav-trip-logs', 'nav-expenses', 'nav-reports', 
            'nav-client-reports', 'nav-history-reports', 'nav-observations', 
            'nav-cameras', 'nav-incidents', 'nav-admin', 'nav-payroll-map'
        ]; // nav-dashboard is always visible to everyone

        if (role === 'mantenimiento') {
            allNavs.forEach(nav => {
                if(nav !== 'nav-expenses' && nav !== 'nav-payroll-map') document.getElementById(nav)?.classList.add('hidden-section');
            });
        } 
        else if (role === 'direccion_general') {
            document.getElementById('nav-admin')?.classList.add('hidden-section');
            // Can see the rest, editing will be disabled within modules
            // Re-order nav items and add padlocks to non-expenses sections
            setTimeout(() => {
                const nav = document.querySelector('nav');
                if (nav) {
                    const dashboard = document.getElementById('nav-dashboard');
                    const expenses = document.getElementById('nav-expenses');
                    const reports = document.getElementById('nav-reports');
                    
                    if (dashboard) nav.appendChild(dashboard);
                    if (expenses) nav.appendChild(expenses);
                    if (reports) nav.appendChild(reports);
                    
                    const others = Array.from(nav.children).filter(child => 
                        !['nav-dashboard', 'nav-expenses', 'nav-reports'].includes(child.id)
                    );
                    
                    others.forEach(child => {
                        const span = child.querySelector('span');
                        if (span && !child.querySelector('.fa-lock') && !child.classList.contains('hidden-section')) {
                            const icon = document.createElement('i');
                            icon.className = 'fas fa-lock ml-2 text-slate-400';
                            icon.style.fontSize = '0.7rem';
                            span.appendChild(icon);
                        }
                        nav.appendChild(child);
                    });
                }
            }, 0);

            // Hide action buttons in modules that don't natively check for role
            const style = document.createElement('style');
            style.innerHTML = `
                #view-cameras #btn-new-log,
                #view-incidents #btn-new-incident,
                #view-incidents #btn-settings,
                #view-incidents button[onclick^='window.resolveIncident'] {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        } 
        else if (role === 'rh') {
            allNavs.forEach(nav => {
                if(nav !== 'nav-observations' && nav !== 'nav-payroll-map') document.getElementById(nav)?.classList.add('hidden-section');
            });
        } 
        else if (role === 'operaciones') {
            allNavs.forEach(nav => {
                if(nav !== 'nav-assignments' && nav !== 'nav-expenses' && nav !== 'nav-payroll-map' && nav !== 'nav-admin') document.getElementById(nav)?.classList.add('hidden-section');
            });
        } 
        else if (role === 'otros_usuarios') {
            allNavs.forEach(nav => {
                if(nav !== 'nav-payroll-map') document.getElementById(nav)?.classList.add('hidden-section');
            });
        } 
        else if (role === 'torre_control') {
            // Torre de Control view logic
            document.getElementById('nav-expenses')?.classList.add('hidden-section');
            document.getElementById('nav-observations')?.classList.add('hidden-section');
            document.getElementById('nav-reports')?.classList.add('hidden-section');
            // nav-payroll-map is NOT hidden for Torre de Control now
        } 
        else if (role === 'contabilidad') {
            allNavs.forEach(nav => {
                if(nav !== 'nav-expenses' && nav !== 'nav-reports' && nav !== 'nav-payroll-map') document.getElementById(nav)?.classList.add('hidden-section');
            });
        }
        else if (role === 'atc') {
            allNavs.forEach(nav => {
                if(nav !== 'nav-client-reports') document.getElementById(nav)?.classList.add('hidden-section');
            });
            // Hide edit actions naturally handled by window.userRole checks in modules
        }
        else if (role === 'admin') {
            // Everything is visible
        }
    }
} catch (e) {
    console.warn("User profile setup failed:", e);
}

// Navigation Logic
function setActiveNav(id) {
    navButtons.forEach(btn => {
        // Reset styles (Tailwind)
        btn.classList.remove('bg-indigo-50', 'border-l-4', 'border-indigo-600', 'text-indigo-700', 'font-black');
        btn.classList.add('text-slate-600', 'hover:bg-slate-50', 'font-bold');
    });
    // Add active style to selected
    const activeBtn = document.getElementById(id);
    if(activeBtn) {
        activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-50', 'font-bold');
        activeBtn.classList.add('bg-indigo-50', 'border-l-4', 'border-indigo-600', 'text-indigo-700', 'font-black');
    }
}

function loadView(view) {
    state.currentView = view;
    switch(view) {
        case 'dashboard':
            pageTitle.textContent = 'Tablero General (Operaciones)';
            setActiveNav('nav-dashboard');
            renderDashboard(contentArea);
            break;
        case 'assignments':
            pageTitle.textContent = 'Control de Asignaciones';
            setActiveNav('nav-assignments');
            renderAssignments(contentArea);
            break;
        case 'trip-logs':
            pageTitle.textContent = 'Bitácora de Viajes (Logística)';
            setActiveNav('nav-trip-logs');
            renderTripLogs(contentArea);
            break;
        case 'expenses':
            pageTitle.textContent = 'Reporte de Gastos';
            setActiveNav('nav-expenses');
            renderExpenses(contentArea);
            break;
        case 'admin':
            pageTitle.textContent = 'Gestión Administrativa';
            setActiveNav('nav-admin');
            renderAdmin(contentArea);
            break;
        case 'reports':
            pageTitle.textContent = 'Reportes Financieros y Operativos';
            setActiveNav('nav-reports');
            renderReports(contentArea);
            break;
        case 'observations':
            pageTitle.textContent = 'Control de Incidencias RH';
            setActiveNav('nav-observations');
            renderObservations(contentArea);
            break;
        case 'cameras':
            pageTitle.textContent = 'Bitácora de Cámaras';
            setActiveNav('nav-cameras');
            renderCameras(contentArea);
            break;
        case 'incidents':
            pageTitle.textContent = 'Incidencias Automáticas';
            setActiveNav('nav-incidents');
            renderIncidents(contentArea);
            break;
        case 'client-reports':
            pageTitle.textContent = 'Reportes Específicos de Clientes';
            setActiveNav('nav-client-reports');
            renderClientReports(contentArea);
            break;
        case 'history-reports':
            pageTitle.textContent = 'Reportes Históricos (Bitácora)';
            setActiveNav('nav-history-reports');
            renderHistoryReports(contentArea);
            break;
        case 'payroll-map':
            pageTitle.textContent = 'Mapa EDY (Torre / Operaciones / RH)';
            setActiveNav('nav-payroll-map');
            renderPayrollMap(contentArea);
            break;
    }
}

// RH Notification Badge Logic
async function checkRHNotifications() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!currentUser || currentUser.role !== 'rh') return;

    try {
        const { count, error } = await supabase
            .from('observations')
            .select('*', { count: 'exact', head: true });
            
        if (!error && count !== null) {
            const lastSeenCount = parseInt(localStorage.getItem('last_seen_obs_count') || '0');
            const navBtn = document.getElementById('nav-observations');
            
            // Remove existing badge if any
            const existingBadge = navBtn.querySelector('.rh-badge');
            if (existingBadge) existingBadge.remove();

            if (count > lastSeenCount) {
                // Add badge
                const badge = document.createElement('span');
                badge.className = 'rh-badge ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]';
                badge.innerText = 'NUEVO';
                navBtn.appendChild(badge);
            }
            
            // When RH clicks the observations tab, update the last seen count and remove badge
            navBtn.addEventListener('click', () => {
                localStorage.setItem('last_seen_obs_count', count.toString());
                const b = navBtn.querySelector('.rh-badge');
                if (b) b.remove();
            });
        }
    } catch (err) {
        console.warn('Could not fetch notifications:', err);
    }
}
checkRHNotifications();

// Event Listeners
const attachNav = (id, view) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => loadView(view));
};

attachNav('nav-dashboard', 'dashboard');
attachNav('nav-assignments', 'assignments');
attachNav('nav-trip-logs', 'trip-logs');
attachNav('nav-expenses', 'expenses');
attachNav('nav-reports', 'reports');
attachNav('nav-observations', 'observations');
attachNav('nav-admin', 'admin');
attachNav('nav-cameras', 'cameras');
attachNav('nav-incidents', 'incidents');
attachNav('nav-client-reports', 'client-reports');
attachNav('nav-history-reports', 'history-reports');
attachNav('nav-payroll-map', 'payroll-map');

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    });
}

// Clock
setInterval(() => {
    const now = new Date();
    document.getElementById('current-time').textContent = now.toLocaleTimeString();
}, 1000);

// Sidebar Toggle Logic
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-menu-btn');
const mobileOverlay = document.getElementById('mobile-overlay');

function toggleSidebar() {
    const isClosed = sidebar.classList.contains('-translate-x-full');
    
    if (isClosed) {
        // Open sidebar
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.remove('md:-translate-x-full'); // For desktop explicitly
        sidebar.classList.remove('md:-ml-64'); // Remove negative margin to reclaim space
        mobileOverlay.classList.remove('hidden');
    } else {
        // Close sidebar
        sidebar.classList.add('-translate-x-full');
        sidebar.classList.add('md:-translate-x-full'); // For desktop explicitly
        sidebar.classList.add('md:-ml-64'); // Add negative margin to expand main content
        mobileOverlay.classList.add('hidden');
    }
}

if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleSidebar);
}

if (mobileOverlay) {
    mobileOverlay.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        sidebar.classList.add('md:-translate-x-full');
        sidebar.classList.add('md:-ml-64');
        mobileOverlay.classList.add('hidden');
    });
}

// Close sidebar on Esc or on navigation for mobile
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.add('-translate-x-full');
        sidebar.classList.add('md:-translate-x-full');
        sidebar.classList.add('md:-ml-64');
        if (mobileOverlay) mobileOverlay.classList.add('hidden');
    }
});

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if(window.innerWidth < 768) {
            sidebar.classList.add('-translate-x-full');
            sidebar.classList.add('md:-translate-x-full');
            sidebar.classList.add('md:-ml-64');
            if (mobileOverlay) mobileOverlay.classList.add('hidden');
        }
    });
});

// Init
const init = () => {
    loadView('dashboard');
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
