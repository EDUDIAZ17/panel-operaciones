import { renderDashboard } from './modules/dashboard.js';
import { renderAssignments } from './modules/assignments.js';
import { renderExpenses } from './modules/expenses.js';
import { renderAdmin } from './modules/admin.js';
import { renderReports } from './modules/reports.js';
import { renderObservations } from './modules/observations.js';

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
                'otros_usuarios': 'Usuario General',
                'admin': 'Admin'
            };
            return map[role] || role.toUpperCase();
        };

        if (roleEl) roleEl.textContent = formatRole(currentUser.role);
        if (displayEl) displayEl.textContent = `Bienvenido, ${currentUser.name}`;

        // Role-based UI restrictions
        const role = currentUser.role;

        // Torre de Control: todo excepto gastos y rh
        if (role === 'torre_control') {
            document.getElementById('nav-expenses')?.classList.add('hidden-section');
            document.getElementById('nav-observations')?.classList.add('hidden-section');
        }

        // RH: solo panel(dashboard) y su seccion (observaciones)
        if (role === 'rh') {
            document.getElementById('nav-assignments')?.classList.add('hidden-section');
            document.getElementById('nav-expenses')?.classList.add('hidden-section');
            document.getElementById('nav-reports')?.classList.add('hidden-section');
            document.getElementById('nav-admin')?.classList.add('hidden-section');
        }

        // Direccion general: panel (dashboard), gastos, graficos (reportes)
        if (role === 'direccion_general') {
            document.getElementById('nav-assignments')?.classList.add('hidden-section');
            document.getElementById('nav-observations')?.classList.add('hidden-section');
            document.getElementById('nav-admin')?.classList.add('hidden-section');
        }

        // Otros usuarios: puro panel (dashboard)
        if (role === 'otros_usuarios') {
            document.getElementById('nav-assignments')?.classList.add('hidden-section');
            document.getElementById('nav-expenses')?.classList.add('hidden-section');
            document.getElementById('nav-observations')?.classList.add('hidden-section');
            document.getElementById('nav-reports')?.classList.add('hidden-section');
            document.getElementById('nav-admin')?.classList.add('hidden-section');
        }

        // Operaciones: panel, asignaciones, gastos. (Ocultamos RH, reportes, admin por defecto a menos que se solicite distinto, pero según prompt: "operaciones acceso a panel, asignaciones y a gastos")
        if (role === 'operaciones') {
            document.getElementById('nav-observations')?.classList.add('hidden-section');
            document.getElementById('nav-reports')?.classList.add('hidden-section');
            document.getElementById('nav-admin')?.classList.add('hidden-section');
        }
    }
} catch (e) {
    console.warn("User profile setup failed:", e);
}

// Navigation Logic
function setActiveNav(id) {
    navButtons.forEach(btn => {
        // Reset styles (Tailwind)
        btn.classList.remove('bg-white/10', 'border-l-4', 'border-emerald-500', 'text-white');
        btn.classList.add('text-gray-300', 'hover:bg-white/5');
    });
    // Add active style to selected
    const activeBtn = document.getElementById(id);
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-300', 'hover:bg-white/5');
        activeBtn.classList.add('bg-white/10', 'border-l-4', 'border-emerald-500', 'text-white');
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
    }
}

// Event Listeners
const attachNav = (id, view) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => loadView(view));
};

attachNav('nav-dashboard', 'dashboard');
attachNav('nav-assignments', 'assignments');
attachNav('nav-expenses', 'expenses');
attachNav('nav-reports', 'reports');
attachNav('nav-observations', 'observations');
attachNav('nav-admin', 'admin');

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
