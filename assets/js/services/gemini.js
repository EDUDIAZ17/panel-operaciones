import { supabase } from './supabaseClient.js';

export async function getHeavyVehicleRouteWithAI(origen, destino, unitType = 'full') {
    let typeDescription = "Tractocamión con FULL remolque (doble remolque articulado tipo T3-S2-R4, carga pesada)";
    if (unitType === 'sencillo') typeDescription = "Tractocamión T3-S2 (Remolque Sencillo)";
    if (unitType === 'torton') typeDescription = "Camión Unitario Torton/Rabón";

    const prompt = `
        Actúa como un despachador logístico experto en México. 
        Necesitamos la mejor ruta sugerida para un ${typeDescription} que viaja desde: "${origen}" hacia "${destino}".
        
        Reglas estrictas de normativa SCT en México:
        1. Considera el tipo de unidad especificado: ${unitType === 'full' ? 'MUY IMPORTANTE: ES DOBLE ARTICULADO (FULL). Verifica que las carreteras federales recomendadas estén autorizadas por la SCT para Doble Articulado (rutas tipo ET y A). ADVIERTE CLARAMENTE si una carretera común en ese trayecto prohíbe el paso de Fulls.' : 'Es unidad sencilla. No requiere rutas ET obligatoriamente, pero prioriza carreteras seguras.'}
        2. Mencionar las autopistas/carreteras específicas a tomar (ej: MEX-57D).
        3. Indicar zonas de riesgo (curvas peligrosas, zonas de robo frecuentes) brevemente.
        4. Omitir pasos por zonas urbanas estrechas o ciudades.

        Devuelve SOLO la descripción de la ruta en un formato HTML limpio y moderno usando <div class="space-y-2">, <strong>, y un par de <li>. No uses bloques de markdown (como \`\`\`html). Manténlo muy breve, 1 o 2 párrafos máximos.
    `;

    const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-2.5-pro'
    ];
    let lastError = null;

    for (const model of modelsToTry) {
        try {
            const { data, error } = await supabase.functions.invoke('gemini-proxy', {
                body: { model, prompt }
            });
            
            if (error) {
                console.warn(`Model ${model} failed for route via proxy:`, error);
                lastError = error;
                continue;
            }

            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return text.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '');
        } catch (e) {
            console.warn(`Fetch error for model ${model} in routing:`, e);
            lastError = e;
        }
    }
    
    console.error("All Gemini models failed. Last error:", lastError);
    throw lastError;
}

window.openAIRoute = async (origen, destino, unitType = 'full') => {
    if (!origen || !destino || origen === '---' || destino === '---') {
        Swal.fire({ icon: 'warning', title: 'Destinos Inválidos', text: 'Se necesita un origen y un destino válido para generar la ruta IA.' });
        return;
    }

    Swal.fire({
        title: 'Calculando Ruta con Gemini AI...',
        html: '<div class="spinner my-4"></div><p class="text-sm text-gray-500">Analizando restricciones de carreteras...</p>',
        showConfirmButton: false,
        allowOutsideClick: false
    });

    const routeText = await getHeavyVehicleRouteWithAI(origen, destino, unitType);

    Swal.fire({
        icon: 'info',
        title: 'Ruta Inteligente Generada',
        html: `<div class="text-left text-sm bg-gray-50 p-4 border rounded-xl shadow-inner mt-4 text-gray-700">${routeText}</div>`,
        confirmButtonText: '<i class="fas fa-map"></i> Entendido',
        confirmButtonColor: '#8b5cf6'
    });
};

export async function analyzeExpensesWithAI(expensesData) {
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
        'gemini-2.5-flash',
        'gemini-2.5-pro'
    ];
    let lastError = null;

    for (const model of modelsToTry) {
        try {
            const { data, error } = await supabase.functions.invoke('gemini-proxy', {
                body: { model, prompt }
            });
            
            if (error) {
                console.warn(`Model ${model} failed via proxy:`, error);
                lastError = error;
                continue;
            }

            const textOption = data?.candidates?.[0]?.content?.parts?.[0]?.text;
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

export async function estimateTollsWithAI(origen, destino, paradas = [], unitType = 'full') {
    let paradasText = '';
    if (paradas.length > 0) {
        paradasText = ` haciendo paradas intermedias en: ${paradas.join(', ')}`;
    }

    let axels = "9 ejes (Full)";
    if (unitType === 'sencillo') axels = "5-6 ejes (Sencillo)";
    if (unitType === 'torton') axels = "3 ejes (Torton)";

    const prompt = `
        Actúa como un analista logístico experto en rutas terrestres de México.
        Necesitamos **ESTIMAR EL COSTO TOTAL APROXIMADO DE CASETAS/PEAJES** para un vehículo pesado de **${axels}** 
        que viaja desde "${origen}" hacia "${destino}"${paradasText}.

        Reglas:
        1. Considera solo rutas de autopistas de cuota (Federales).
        2. Proporciona solo la estimación numérica en MXN (Pesos Mexicanos) de las casetas.
        3. Formato requerido: Devuelve el resultado en un bloque de HTML simple, resaltando el costo total y dando un brevísimo desglose de 1 a 2 líneas de los principales tramos de cobro.
        4. Sé directo, sin introducciones ni conclusiones largas. Usa la etiqueta <b> para resaltar el monto final (ej. <b>$4,500.00 MXN</b>).
    `;

    const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-2.5-pro'
    ];
    let lastError = null;

    for (const model of modelsToTry) {
        try {
            const { data, error } = await supabase.functions.invoke('gemini-proxy', {
                body: { model, prompt }
            });
            
            if (error) {
                console.warn(`Model ${model} failed via proxy for tolls:`, error);
                lastError = error;
                continue;
            }

            const textOption = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textOption) return textOption.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '');
        } catch (error) {
            console.warn(`Fetch error for model ${model} for tolls:`, error);
            lastError = error;
        }
    }
    
    console.error("All Gemini models failed for tolls. Last error:", lastError);
    throw lastError;
}
