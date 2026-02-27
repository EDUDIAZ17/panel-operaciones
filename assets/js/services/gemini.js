import { GOOGLE_API_KEY } from '../config/config.js';

export async function analyzeExpensesWithAI(expensesData) {
    if (!GOOGLE_API_KEY) {
        throw new Error('API Key de Google no configurada');
    }

    // Sanitize and simplify data to prevent context overloads or complex JSON parsing errors
    const simplifiedData = expensesData.map(e => ({
        fecha: e.created_at.split('T')[0],
        operador: e.operators?.name || 'Desc.',
        ruta: e.route,
        total: e.total_amount,
        fijos: parseFloat(e.details?.totalFixed) || 0,
        alimentos: parseFloat(e.details?.totalFood) || 0,
        maniobras: parseFloat(e.details?.totalManeuver) || 0,
        saldo: parseFloat(e.details?.balance) || 0
    }));

    const prompt = `
        Actúa como un analista financiero experto en logística y transporte.
        Analiza los siguientes registros de gastos de viaje de la flota:
        ${JSON.stringify(simplifiedData)}

        Genera un reporte ejecutivo breve (en formato HTML simple, usar <b>, <ul>, <br>) que incluya:
        1. Total de gastos del periodo.
        2. Operador con mayor gasto.
        3. Detección de anomalías o incidencias financieras (si las hay).
        4. Recomendación de optimización.
        
        Mantén el tono profesional y directo. No uses markdown de bloques de código.
    `;

    const modelsToTry = [
        'gemini-1.5-flash-latest', 
        'gemini-1.5-flash',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-2.0-pro',
        'gemini-pro', 
        'gemini-1.0-pro'
    ];
    let lastError = null;

    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                console.warn(`Model ${model} failed:`, data);
                lastError = new Error(data.error?.message || 'Error desconocido');
                continue; // Try next model
            }

            const textOption = data.candidates?.[0]?.content?.parts?.[0]?.text;
            return textOption || "El modelo no generó una respuesta.";
            
        } catch (error) {
            console.warn(`Fetch error for model ${model}:`, error);
            lastError = error;
        }
    }
    
    // If all models fail
    console.error("All Gemini models failed. Last error:", lastError);
    throw lastError;
}
