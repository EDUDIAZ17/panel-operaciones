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
        Actúa como un analista logístico experto en rutas terrestres de México con acceso a las tarifas de peaje (casetas) más recientes de CAPUFE y SCT actualizadas a 2024/2025.
        Necesitamos **ESTIMAR EL COSTO TOTAL EXACTO DE CASETAS/PEAJES** para un vehículo pesado de **${axels}** 
        que viaja desde "${origen}" hacia "${destino}"${paradasText}.

        Reglas:
        1. Considera solo rutas de autopistas de cuota (Federales) de México.
        2. Proporciona la estimación numérica en MXN (Pesos Mexicanos) de las casetas, utilizando los costos reales de CAPUFE más recientes conocidos.
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
window.getDetailedTollsAI = async (origen, destino, paradas = [], unitType = 'full') => {
    let paradasText = '';
    if (paradas.length > 0) {
        paradasText = ` haciendo paradas intermedias en: ${paradas.join(', ')}`;
    }

    let axels = "9 ejes (Full)";
    if (unitType === 'sencillo') axels = "5-6 ejes (Sencillo)";
    if (unitType === 'torton') axels = "3 ejes (Torton)";

    const prompt = `
        Actúa como un analista logístico experto en rutas terrestres de México con las tarifas de CAPUFE y SCT actualizadas a 2024/2025.
        Necesitamos obtener el DESGLOSE EXACTO Y REAL DE CASETAS/PEAJES para un vehículo pesado de ${axels} 
        que viaja desde "${origen}" hacia "${destino}"${paradasText}.

        Reglas:
        1. Considera rutas de autopistas de cuota (Federales) que enlazan estos puntos.
        2. Proporciona la respuesta ÚNICAMENTE en formato JSON válido, sin texto adicional ni bloques markdown (\`\`\`json).
        3. El JSON debe cumplir estrictamente esta estructura evaluando el precio real actual de CAPUFE para camiones de ${axels}:
        {
            "totalCost": 4500,
            "tolls": [
                 { "name": "Nombre exacto de la caseta (ej. Tlalpan)", "distance": "120", "time": "1h 30m", "cost": 500 },
                 { "name": "Caseta 2", "distance": "250", "time": "2h 45m", "cost": 1200 }
            ]
        }
        Recuerda: SOLO JSON VÁLIDO. Los costos ("totalCost" y "cost") deben ser números exactos.
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
                console.warn('Model ' + model + ' failed for detailed tolls:', error);
                lastError = error;
                continue;
            }

            let textOption = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textOption) {
                textOption = textOption.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
                return JSON.parse(textOption);
            }
        } catch (error) {
            console.warn('Parse error for model ' + model + ' for detailed tolls:', error);
            lastError = error;
        }
    }
    
    console.error("All Gemini models failed for detailed tolls. Last error:", lastError);
    throw lastError;
};

// =========================================================================
// AGENTE DE AUDITORIA NOM-012 Y RIESGO CARRETERO (ITERACION 6)
// =========================================================================

export async function generateLogisticsReportAI(origen, destino, paradas = [], unitType = 'full', axles = 9, weight = 75.5) {
    let paradasText = '';
    if (paradas.length > 0) {
        paradasText = `\nParadas intermedias: ${paradas.join(', ')}`;
    }

    let unitDesc = unitType === 'full' ? 'Tractocamión T3-S2-R4 (Doble Articulado / Full)' :
                   unitType === 'sencillo' ? 'Tractocamión T3-S2 (Sencillo)' : 'Camión Unitario Torton/Rabón';

    const prompt = `
        Actúa como un Agente de Auditoría Normativa y Despachador Logístico Experto en México (NOM-012-SCT-2-2017).
        
        Se te solicita un "Análisis Logístico Integral" para el siguiente viaje:
        - Origen: "${origen}"
        - Destino: "${destino}"${paradasText}
        - Configuración Vehicular: ${unitDesc}
        - Número de Ejes Totales: ${axles}
        - Peso Bruto / Carga Estimada: ${weight} Toneladas

        TU TAREA:
        Generar un reporte en formato TABLA HTML nativa (limpia, con clases de Tailwind CSS básicas sugeridas como "table-auto w-full text-sm", "border", "bg-gray-50", "text-left", "text-gray-800"). NO uses Markdown (como \`\`\`html), devuelve SOLO el código HTML desde un <div class="overflow-x-auto">.

        REGLAS DE AUDITORÍA:
        1. CLASIFICACIÓN RNC (Red Nacional de Caminos): Para cada tramo principal de la ruta, evalúa si es un camino ET (Ejes de Transporte), A (Red Primaria), B, C, o D. 
           * Si la unidad es un FULL (doble remolque), ADVIERTE CLARAMENTE si un tramo propuesto es B, C o D (Restringido o Prohibido).
           * Valida teóricamente si ${weight} Toneladas es legal para esa configuración en ese tramo.
        2. COSTOS DE CASETA (C${axles}): Identifica las plazas de cobro principales. Estima la tarifa considerando que es un vehículo especial de ${axles} ejes. Trata de diferenciar si es C5 (5 ejes) vs C9 (9 ejes).
        3. RIESGO CARRETERO (Hotspots): Identifica si la ruta cruza focos rojos históricos (ej. Arco Norte de madrugada, Circuito Mexiquense, MEX-150D Cumbres de Maltrata, Carretera 45D Salamanca-León, etc.). Si cruza, propón una "Ruta de Seguridad" o paraderos seguros.

        ESTRUCTURA HTML REQUERIDA (Respetar estrictamente):
        <h3 class="text-lg font-bold text-slate-800 mb-2">Auditoría de Ruta: ${origen} a ${destino}</h3>
        <p class="text-xs text-gray-500 mb-4">Unidad: ${unitDesc} | Ejes: ${axles} | PBV: ${weight} Tons</p>
        
        <div class="overflow-x-auto shadow-sm rounded-lg border border-gray-200 mb-4">
            <table class="w-full text-sm text-left">
                <thead class="bg-slate-800 text-white text-xs uppercase">
                    <tr>
                        <th class="px-3 py-2">Tramo / Caseta</th>
                        <th class="px-3 py-2">Clasificación SCT</th>
                        <th class="px-3 py-2">Validación NOM-012</th>
                        <th class="px-3 py-2">Costo Aprox (${axles} ejes)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white text-gray-800">
                    <!-- Filas <tr> generadas dinámicamente aquí -->
                </tbody>
            </table>
        </div>

        <div class="bg-red-50 border-l-4 border-red-500 p-3 mb-2 rounded-r">
            <h4 class="font-bold text-red-800 text-sm"><i class="fas fa-exclamation-triangle"></i> Análisis de Seguridad / Riesgo Delictivo</h4>
            <p class="text-xs text-red-700 mt-1">[Párrafo de análisis de hotspots y recomendaciones de paraderos seguros]</p>
        </div>

        <div class="text-right font-bold text-lg text-slate-800 mt-3 p-2 bg-gray-100 rounded">
            Peaje Total Estimado (MXN): $[Suma Total]
        </div>

        Sé muy directo en la tabla y usa lenguaje técnico logístico mexicano.
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
                console.warn(`Model ${model} failed via proxy for NOM012:`, error);
                lastError = error;
                continue;
            }

            const textOption = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textOption) return textOption.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '');
        } catch (error) {
            console.warn(`Fetch error for model ${model} for NOM012:`, error);
            lastError = error;
        }
    }
    
    console.error("All Gemini models failed for NOM012. Last error:", lastError);
    // Let it throw to catch it on UI
    throw lastError;
}

window.generateLogisticsReportAI = generateLogisticsReportAI;
