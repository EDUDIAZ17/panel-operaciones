// config/users.js
// AUTENTICACIÓN SEGURA - Panel Operaciones
import { supabase } from '../services/supabaseClient.js';

// --- Security Utilities ---

/**
 * Hashes a password using SHA-256.
 * Returns hex string for comparison against stored hashes.
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Rate limiting state (per session)
const loginAttempts = {
    count: 0,
    lastAttempt: 0,
    lockedUntil: 0
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minute lockout

/**
 * Authenticates a user against Supabase app_users table.
 * Passwords are hashed client-side before comparison.
 * No hardcoded credentials — all users live in the database.
 */
export async function authenticate(email, password) {
    // Rate limiting check
    const now = Date.now();
    if (loginAttempts.lockedUntil > now) {
        const secondsLeft = Math.ceil((loginAttempts.lockedUntil - now) / 1000);
        throw new Error(`Demasiados intentos. Espera ${secondsLeft} segundos.`);
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    if (!normalizedEmail || !password) {
        throw new Error('Correo y contraseña son obligatorios.');
    }

    const passwordHash = await hashPassword(password);

    // Query Supabase - compare against hashed password
    const { data: user, error } = await supabase
        .from('app_users')
        .select('id, email, name, role')
        .eq('email', normalizedEmail)
        .eq('password_hash', passwordHash)
        .single();
        
    if (user && !error) {
        // Reset rate limiting on success
        loginAttempts.count = 0;
        loginAttempts.lockedUntil = 0;

        // Generate a session token for integrity validation
        const sessionToken = await hashPassword(user.id + user.role + Date.now().toString());

        return { 
            name: user.name, 
            email: user.email, 
            role: user.role,
            sessionToken,
            loginAt: Date.now()
        };
    }

    // Failed attempt - increment rate limiter
    loginAttempts.count++;
    loginAttempts.lastAttempt = now;
    
    if (loginAttempts.count >= MAX_ATTEMPTS) {
        loginAttempts.lockedUntil = now + LOCKOUT_DURATION_MS;
        loginAttempts.count = 0;
        throw new Error('Cuenta bloqueada temporalmente por intentos fallidos. Espera 1 minuto.');
    }

    return null;
}

/**
 * Registers a new user with hashed password.
 * Validates email domain and blocks privileged roles.
 */
export async function registerUser(userData) {
    const normalizedEmail = userData.email.toLowerCase().trim();
    
    // Block privileged roles from self-registration
    const blockedRoles = ['admin', 'atc', 'mantenimiento'];
    if (blockedRoles.includes(userData.role)) {
        console.error('Attempted registration with blocked role:', userData.role);
        throw new Error('Este rol no permite auto-registro. Contacta al administrador.');
    }

    // Validate email domain
    if (!normalizedEmail.endsWith('@alexatransportes.com.mx')) {
        throw new Error('Solo se permiten correos @alexatransportes.com.mx');
    }

    // Validate password strength
    if (userData.password.length < 8) {
        throw new Error('La contraseña debe tener al menos 8 caracteres.');
    }
    if (!/[A-Z]/.test(userData.password)) {
        throw new Error('La contraseña debe incluir al menos una letra mayúscula.');
    }
    if (!/[0-9]/.test(userData.password)) {
        throw new Error('La contraseña debe incluir al menos un número.');
    }

    const passwordHash = await hashPassword(userData.password);

    const { error } = await supabase
        .from('app_users')
        .insert({
            email: normalizedEmail,
            name: userData.name,
            password_hash: passwordHash,
            role: userData.role
        });

    if (error) {
        console.error("Error registering user:", error);
        if (error.code === '23505') {
            throw new Error('Este correo ya está registrado.');
        }
        throw new Error('Error al crear la cuenta. Intenta de nuevo.');
    }
    return true;
}
