// config/users.js
// CONFIGURACIÓN DE USUARIOS

// Hardcoded Master Admin
const MASTER_ADMIN = {
    email: 'eduardo.garduno@alexatransportes.com.mx',
    password: '***REDACTED***', // Default password, ideally would be hashed or managed by backend
    name: 'Eduardo Garduño (Admin)',
    role: 'admin' // Admin gets all access
};

// Initial system users
const DEFAULT_USERS = [
    MASTER_ADMIN,
    {
        email: 'rh@alexatransportes.com.mx',
        password: '***REDACTED***',
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
    const normalizedEmail = email.toLowerCase().trim();

    // Special check for master admin to ensure access even if LS is cleared
    if(normalizedEmail === MASTER_ADMIN.email && password === MASTER_ADMIN.password) {
        return { name: MASTER_ADMIN.name, email: MASTER_ADMIN.email, role: MASTER_ADMIN.role, isMaster: true };
    }

    const user = users.find(u => u.email.toLowerCase() === normalizedEmail && u.password === password);
    if (user) {
        return { name: user.name, email: user.email, role: user.role };
    }
    return null;
}

export function registerUser(userData) {
    const users = loadUsers();
    const normalizedEmail = userData.email.toLowerCase().trim();
    
    // Check if user exists (case-insensitive)
    if (users.find(u => u.email.toLowerCase() === normalizedEmail)) {
        return false;
    }

    const newUser = {
        ...userData,
        email: normalizedEmail
    };

    users.push(newUser);
    localStorage.setItem('appUsers', JSON.stringify(users));
    return true;
}
