// config/users.js
// CONFIGURACIÓN DE USUARIOS

// Hardcoded Master Admin
const MASTER_ADMIN = {
    email: 'eduardo.garduno@alexatransportes.com.mx',
    password: 'admin', // Default password, ideally would be hashed or managed by backend
    name: 'Eduardo Garduño (Admin)',
    role: 'admin' // Admin gets all access
};

// Initial system users
const DEFAULT_USERS = [
    MASTER_ADMIN,
    {
        email: 'rh@alexatransportes.com.mx',
        password: 'rh',
        name: 'Recursos Humanos',
        role: 'rh'
    }
];

// Load users from LocalStorage or initialize with defaults
function loadUsers() {
    const saved = localStorage.getItem('appUsers');
    if (saved) return JSON.parse(saved);
    localStorage.setItem('appUsers', JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
}

export function authenticate(email, password) {
    const users = loadUsers();
    // Special check for master admin to ensure access even if LS is cleared
    if(email === MASTER_ADMIN.email && password === MASTER_ADMIN.password) {
        return { name: MASTER_ADMIN.name, email: MASTER_ADMIN.email, role: MASTER_ADMIN.role, isMaster: true };
    }

    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        return { name: user.name, email: user.email, role: user.role };
    }
    return null;
}

export function registerUser(userData) {
    const users = loadUsers();
    
    // Check if user exists
    if (users.find(u => u.email === userData.email)) {
        return false;
    }

    users.push(userData);
    localStorage.setItem('appUsers', JSON.stringify(users));
    return true;
}
