// config/users.js
// CONFIGURACIÓN DE USUARIOS
import { supabase } from '../services/supabaseClient.js';

// Hardcoded Master Admin
const MASTER_ADMIN = {
    email: 'eduardo.garduno@alexatransportes.com.mx',
    password: 'admin', // Default password, ideally would be hashed or managed by backend
    name: 'Eduardo Garduño (Admin)',
    role: 'admin' // Admin gets all access
};

export async function authenticate(email, password) {
    const normalizedEmail = email.toLowerCase().trim();

    // Special check for master admin to ensure access even if LS/DB is cleared
    if(normalizedEmail === MASTER_ADMIN.email && password === MASTER_ADMIN.password) {
        return { name: MASTER_ADMIN.name, email: MASTER_ADMIN.email, role: MASTER_ADMIN.role, isMaster: true };
    }

    const { data: user, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('password', password)
        .single();
        
    if (user && !error) {
        return { name: user.name, email: user.email, role: user.role };
    }
    return null;
}

export async function registerUser(userData) {
    const normalizedEmail = userData.email.toLowerCase().trim();
    
    const { error } = await supabase
        .from('app_users')
        .insert({
            email: normalizedEmail,
            name: userData.name,
            password: userData.password,
            role: userData.role
        });

    if (error) {
        console.error("Error registering user:", error);
        return false;
    }
    return true;
}
