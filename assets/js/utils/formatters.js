// utils/formatters.js

export function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

export function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-MX', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    }).format(date);
}

export function calculateTimeElapsed(dateString) {
    if (!dateString) return 0;
    const start = new Date(dateString);
    const now = new Date();
    const diffMs = now - start;
    return diffMs / (1000 * 60 * 60); // Return hours
}

export function getSemaphoreStatus(hoursElapsed) {
    if (hoursElapsed < 12) return 'green';
    if (hoursElapsed >= 12 && hoursElapsed < 24) return 'yellow';
    return 'red';
}

export function calculateFinancialLoss(hoursElapsed) {
    if (hoursElapsed < 24) return 0;
    // Rule: 24h = 8000 pesos lost. 
    // Is it flat 8000 after 24h? Or 8000 per 24h period? 
    // User said: "UNA UNIDAD PARADA POR 24 HORAS SE PIERDE 8000 PESOS"
    // Interpretation: Pro-rate after 24h or just assume linear loss?
    // Let's make it simple: If > 24h, we calculate loss. 
    // Let's assume linear loss based on 8000/24h rate for the *total* time if it exceeds 24h?
    // Or just the time excess?
    // "SI ESTA MENOS DE 12 HORAS PARADO ES EN VERDE... SI PASA MAS DE 24 HORAS ES EN ROJO. TAMBIEN DEBE DE HACER UN CALCULO DE DINERO PERDIDO"
    // I will implementation: (Total Hours / 24) * 8000.
    return (hoursElapsed / 24) * 8000;
}
