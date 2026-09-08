import { getLogisticsNetworkSuggestionsAI } from '../services/gemini.js';

// ================================================================
// RED LOGÍSTICA AUTOMOTRIZ DE MÉXICO
// Nodos: plantas armadoras (origen de vehículos terminados),
// puertos con terminal de automóviles y cruces fronterizos.
// Las coordenadas son de referencia operativa al complejo/terminal.
// ================================================================

const NETWORK_NODES = [
    // ---------------- PLANTAS ARMADORAS ----------------
    { id: 'gm-silao', tipo: 'planta', nombre: 'GM Complejo Silao', empresa: 'General Motors', estado: 'Guanajuato', ciudad: 'Silao', lat: 20.9010, lng: -101.4360, marcas: 'Silverado, Sierra, Cheyenne', capacidad: '~430,000 u/año', nota: 'Ensamble, estampado y transmisiones. Nodo pesado del Bajío.' },
    { id: 'gm-ramos', tipo: 'planta', nombre: 'GM Ramos Arizpe', empresa: 'General Motors', estado: 'Coahuila', ciudad: 'Ramos Arizpe', lat: 25.5470, lng: -100.9930, marcas: 'Blazer EV, Equinox EV', capacidad: '~250,000 u/año', nota: 'Complejo con motores y estampado. Exporta por Nuevo Laredo y Piedras Negras.' },
    { id: 'gm-slp', tipo: 'planta', nombre: 'GM San Luis Potosí', empresa: 'General Motors', estado: 'San Luis Potosí', ciudad: 'San Luis Potosí', lat: 22.0290, lng: -100.9080, marcas: 'Equinox, Trax', capacidad: '~200,000 u/año', nota: 'Sobre el corredor MEX-57 (NAFTA Highway).' },
    { id: 'gm-toluca', tipo: 'planta', nombre: 'GM Complejo Toluca', empresa: 'General Motors', estado: 'Estado de México', ciudad: 'Toluca', lat: 19.2740, lng: -99.6420, marcas: 'Motores y componentes', capacidad: 'Componentes', nota: 'Complejo de propulsión: genera flujo de partes, no de unidades terminadas.' },
    { id: 'ford-hermosillo', tipo: 'planta', nombre: 'Ford Hermosillo', empresa: 'Ford Motor Company', estado: 'Sonora', ciudad: 'Hermosillo', lat: 29.0180, lng: -110.8890, marcas: 'Bronco Sport, Maverick', capacidad: '~300,000 u/año', nota: 'Salida natural por Nogales (terrestre) y Guaymas (marítimo).' },
    { id: 'ford-cuautitlan', tipo: 'planta', nombre: 'Ford Cuautitlán', empresa: 'Ford Motor Company', estado: 'Estado de México', ciudad: 'Cuautitlán Izcalli', lat: 19.6740, lng: -99.2050, marcas: 'Mustang Mach-E', capacidad: '~180,000 u/año', nota: 'Zona metropolitana: restricciones de horario y de doble remolque.' },
    { id: 'stellantis-toluca', tipo: 'planta', nombre: 'Stellantis Toluca', empresa: 'Stellantis', estado: 'Estado de México', ciudad: 'Toluca', lat: 19.2810, lng: -99.6360, marcas: 'Jeep Compass, Hornet', capacidad: '~250,000 u/año', nota: 'Exporta principalmente vía Veracruz y frontera noreste.' },
    { id: 'stellantis-van', tipo: 'planta', nombre: 'Stellantis Saltillo Van (Derramadero)', empresa: 'Stellantis', estado: 'Coahuila', ciudad: 'Derramadero, Saltillo', lat: 25.2340, lng: -101.1490, marcas: 'Ram ProMaster', capacidad: '~150,000 u/año', nota: 'Complejo Derramadero, alta densidad de proveedores.' },
    { id: 'stellantis-truck', tipo: 'planta', nombre: 'Stellantis Saltillo Truck', empresa: 'Stellantis', estado: 'Coahuila', ciudad: 'Saltillo', lat: 25.4290, lng: -100.9370, marcas: 'Ram 1500 / 2500 / 3500', capacidad: '~450,000 u/año', nota: 'Uno de los mayores exportadores terrestres del país.' },
    { id: 'nissan-a1', tipo: 'planta', nombre: 'Nissan Aguascalientes A1', empresa: 'Nissan', estado: 'Aguascalientes', ciudad: 'Aguascalientes', lat: 21.8240, lng: -102.2610, marcas: 'Versa, March, Kicks', capacidad: '~450,000 u/año', nota: 'Complejo con patio ferroviario propio.' },
    { id: 'nissan-a2', tipo: 'planta', nombre: 'Nissan Aguascalientes A2', empresa: 'Nissan', estado: 'Aguascalientes', ciudad: 'Aguascalientes', lat: 21.9550, lng: -102.2170, marcas: 'Sentra', capacidad: '~175,000 u/año', nota: 'Alta exportación a Estados Unidos y Canadá.' },
    { id: 'compas-ags', tipo: 'planta', nombre: 'Planta COMPAS Aguascalientes', empresa: 'Nissan (ex COMPAS)', estado: 'Aguascalientes', ciudad: 'Aguascalientes', lat: 21.9860, lng: -102.1210, marcas: 'Infiniti QX50 / QX55', capacidad: '~100,000 u/año', nota: 'Vehículos premium: conviene madrina cerrada o cubierta.' },
    { id: 'nissan-civac', tipo: 'planta', nombre: 'Nissan CIVAC', empresa: 'Nissan', estado: 'Morelos', ciudad: 'Jiutepec', lat: 18.8890, lng: -99.1710, marcas: 'NP300 Frontier', capacidad: '~150,000 u/año', nota: 'Corredor natural hacia Veracruz y Lázaro Cárdenas.' },
    { id: 'vw-puebla', tipo: 'planta', nombre: 'Volkswagen Puebla', empresa: 'Volkswagen', estado: 'Puebla', ciudad: 'Puebla', lat: 19.1600, lng: -98.2320, marcas: 'Jetta, Tiguan, Taos', capacidad: '~400,000 u/año', nota: 'Principal usuario del puerto de Veracruz para exportación a Europa.' },
    { id: 'audi-chiapa', tipo: 'planta', nombre: 'Audi San José Chiapa', empresa: 'Audi México', estado: 'Puebla', ciudad: 'San José Chiapa', lat: 19.2810, lng: -97.7010, marcas: 'Audi Q5', capacidad: '~150,000 u/año', nota: 'Premium: exporta casi todo vía Veracruz.' },
    { id: 'toyota-gto', tipo: 'planta', nombre: 'Toyota Guanajuato', empresa: 'Toyota', estado: 'Guanajuato', ciudad: 'Apaseo el Grande', lat: 20.5390, lng: -100.6690, marcas: 'Tacoma', capacidad: '~130,000 u/año', nota: 'Exportación mayoritaria a EE.UU. por la frontera noreste.' },
    { id: 'toyota-tij', tipo: 'planta', nombre: 'Toyota Baja California', empresa: 'Toyota', estado: 'Baja California', ciudad: 'Tijuana', lat: 32.4560, lng: -116.8480, marcas: 'Cajas Tacoma', capacidad: '~100,000 u/año', nota: 'Cruce inmediato por Otay Mesa: trayectos muy cortos.' },
    { id: 'honda-celaya', tipo: 'planta', nombre: 'Honda Celaya', empresa: 'Honda', estado: 'Guanajuato', ciudad: 'Celaya', lat: 20.4610, lng: -100.8790, marcas: 'HR-V', capacidad: '~200,000 u/año', nota: 'Bajío: compiten Lázaro Cárdenas y Manzanillo como salida.' },
    { id: 'mazda-salamanca', tipo: 'planta', nombre: 'Mazda Salamanca', empresa: 'Mazda', estado: 'Guanajuato', ciudad: 'Salamanca', lat: 20.5450, lng: -101.1600, marcas: 'Mazda2, Mazda3, CX-30', capacidad: '~250,000 u/año', nota: 'Exporta fuerte a Sudamérica y Asia por Lázaro Cárdenas.' },
    { id: 'kia-pesqueria', tipo: 'planta', nombre: 'KIA Pesquería', empresa: 'KIA', estado: 'Nuevo León', ciudad: 'Pesquería', lat: 25.7590, lng: -100.0630, marcas: 'Forte, K3, Rio', capacidad: '~400,000 u/año', nota: 'Cerca de Colombia y Nuevo Laredo: también embarca por Altamira.' },
    { id: 'bmw-slp', tipo: 'planta', nombre: 'BMW San Luis Potosí', empresa: 'BMW Group', estado: 'San Luis Potosí', ciudad: 'Villa de Reyes', lat: 21.8330, lng: -100.9440, marcas: 'Serie 3, M2', capacidad: '~175,000 u/año', nota: 'Premium: requiere unidad cerrada. Salida por Altamira y Veracruz.' },
    { id: 'jac-sahagun', tipo: 'planta', nombre: 'Giant Motors / JAC Ciudad Sahagún', empresa: 'Giant Motors', estado: 'Hidalgo', ciudad: 'Ciudad Sahagún', lat: 19.7710, lng: -98.5820, marcas: 'JAC (SUV y pick-ups)', capacidad: '~40,000 u/año', nota: 'Enfocada al mercado nacional: distribución interna.' },
    { id: 'daimler-saltillo', tipo: 'planta', nombre: 'Daimler Truck Santiago (Saltillo)', empresa: 'Daimler Truck México', estado: 'Coahuila', ciudad: 'Saltillo', lat: 25.4150, lng: -100.9800, marcas: 'Freightliner (tractocamiones)', capacidad: 'Vehículo pesado', nota: 'Carga pesada: requiere plataforma o autotransporte especializado.' },
    { id: 'navistar-escobedo', tipo: 'planta', nombre: 'Navistar Escobedo', empresa: 'International', estado: 'Nuevo León', ciudad: 'Gral. Escobedo', lat: 25.7970, lng: -100.3200, marcas: 'International (camiones)', capacidad: 'Vehículo pesado', nota: 'Salida terrestre inmediata por Laredo y Colombia.' },
    { id: 'kenworth-mexicali', tipo: 'planta', nombre: 'Kenworth Mexicali (PACCAR)', empresa: 'PACCAR', estado: 'Baja California', ciudad: 'Mexicali', lat: 32.6260, lng: -115.4270, marcas: 'Kenworth (tractocamiones)', capacidad: 'Vehículo pesado', nota: 'Cruce por Mexicali-Calexico, trayecto muy corto.' },

    // ---------------- PUERTOS CON TERMINAL DE AUTOMÓVILES ----------------
    { id: 'pto-veracruz', tipo: 'puerto', nombre: 'Puerto de Veracruz', empresa: 'ASIPONA Veracruz', estado: 'Veracruz', ciudad: 'Veracruz', lat: 19.2020, lng: -96.1300, marcas: 'VW, Audi, Stellantis, GM', capacidad: 'Principal terminal de autos del país', nota: 'Salida a Europa y Sudamérica. Alta congestión en temporada alta.' },
    { id: 'pto-altamira', tipo: 'puerto', nombre: 'Puerto de Altamira', empresa: 'ASIPONA Altamira', estado: 'Tamaulipas', ciudad: 'Altamira', lat: 22.4750, lng: -97.8750, marcas: 'BMW, KIA, Nissan', capacidad: 'Terminal de vehículos y carga general', nota: 'Alternativa a Veracruz para el Noreste y el Bajío norte.' },
    { id: 'pto-lazaro', tipo: 'puerto', nombre: 'Puerto Lázaro Cárdenas', empresa: 'ASIPONA Lázaro Cárdenas', estado: 'Michoacán', ciudad: 'Lázaro Cárdenas', lat: 17.9560, lng: -102.1770, marcas: 'Mazda, Honda, Toyota, KIA', capacidad: 'Terminal especializada de autos', nota: 'Puerta natural del Bajío hacia Asia y Sudamérica.' },
    { id: 'pto-manzanillo', tipo: 'puerto', nombre: 'Puerto de Manzanillo', empresa: 'ASIPONA Manzanillo', estado: 'Colima', ciudad: 'Manzanillo', lat: 19.0640, lng: -104.3140, marcas: 'Importación y exportación mixta', capacidad: 'Puerto más movido del Pacífico', nota: 'Fuerte en importación de vehículos asiáticos.' },
    { id: 'pto-mazatlan', tipo: 'puerto', nombre: 'Puerto de Mazatlán', empresa: 'ASIPONA Mazatlán', estado: 'Sinaloa', ciudad: 'Mazatlán', lat: 23.1880, lng: -106.4200, marcas: 'Carga mixta y cabotaje', capacidad: 'Terminal multipropósito', nota: 'Opción de cabotaje hacia Baja California Sur.' },
    { id: 'pto-guaymas', tipo: 'puerto', nombre: 'Puerto de Guaymas', empresa: 'ASIPONA Guaymas', estado: 'Sonora', ciudad: 'Guaymas', lat: 27.9180, lng: -110.8990, marcas: 'Ford Hermosillo', capacidad: 'Terminal multipropósito', nota: 'Salida marítima natural del noroeste (a ~130 km de Hermosillo).' },
    { id: 'pto-ensenada', tipo: 'puerto', nombre: 'Puerto de Ensenada', empresa: 'ASIPONA Ensenada', estado: 'Baja California', ciudad: 'Ensenada', lat: 31.8480, lng: -116.6260, marcas: 'Carga mixta', capacidad: 'Terminal de contenedores y autos', nota: 'Complemento del cruce de Otay para la península.' },
    { id: 'pto-tuxpan', tipo: 'puerto', nombre: 'Puerto de Tuxpan', empresa: 'ASIPONA Tuxpan', estado: 'Veracruz', ciudad: 'Tuxpan', lat: 20.9670, lng: -97.3300, marcas: 'Carga general', capacidad: 'Puerto más cercano a la CDMX', nota: 'Alternativa para el centro del país cuando Veracruz se satura.' },
    { id: 'pto-coatzacoalcos', tipo: 'puerto', nombre: 'Puerto de Coatzacoalcos', empresa: 'ASIPONA Coatzacoalcos', estado: 'Veracruz', ciudad: 'Coatzacoalcos', lat: 18.1350, lng: -94.4160, marcas: 'Carga general', capacidad: 'Corredor Interoceánico', nota: 'Creciendo por el Corredor Interoceánico del Istmo.' },
    { id: 'pto-progreso', tipo: 'puerto', nombre: 'Puerto de Progreso', empresa: 'ASIPONA Progreso', estado: 'Yucatán', ciudad: 'Progreso', lat: 21.3150, lng: -89.6600, marcas: 'Distribución península', capacidad: 'Terminal de altura', nota: 'Recepción de unidades para la península de Yucatán.' },
    { id: 'pto-topolobampo', tipo: 'puerto', nombre: 'Puerto de Topolobampo', empresa: 'ASIPONA Topolobampo', estado: 'Sinaloa', ciudad: 'Ahome', lat: 25.5980, lng: -109.0510, marcas: 'Carga general', capacidad: 'Terminal multipropósito', nota: 'Conexión ferroviaria Chihuahua-Pacífico.' },
    { id: 'pto-salinacruz', tipo: 'puerto', nombre: 'Puerto de Salina Cruz', empresa: 'ASIPONA Salina Cruz', estado: 'Oaxaca', ciudad: 'Salina Cruz', lat: 16.1660, lng: -95.1970, marcas: 'Corredor Interoceánico', capacidad: 'Terminal en expansión', nota: 'Par del Istmo con Coatzacoalcos.' },

    // ---------------- CRUCES FRONTERIZOS ----------------
    { id: 'fr-nlaredo', tipo: 'frontera', nombre: 'Nuevo Laredo - Puente Mundial de Comercio', empresa: 'Aduana Nuevo Laredo', estado: 'Tamaulipas', ciudad: 'Nuevo Laredo', lat: 27.6300, lng: -99.6250, marcas: 'Todas las armadoras del norte y Bajío', capacidad: 'Cruce comercial #1 de América Latina', nota: 'Alta saturación: considerar Colombia NL como válvula de escape.' },
    { id: 'fr-colombia', tipo: 'frontera', nombre: 'Colombia NL - Puente Solidaridad', empresa: 'Aduana Colombia', estado: 'Nuevo León', ciudad: 'Colombia', lat: 27.7180, lng: -99.8090, marcas: 'KIA, Stellantis, GM', capacidad: 'Cruce comercial de baja congestión', nota: 'Menor tiempo de espera que Nuevo Laredo, suma ~35 km de desvío.' },
    { id: 'fr-piedras', tipo: 'frontera', nombre: 'Piedras Negras - Puente II', empresa: 'Aduana Piedras Negras', estado: 'Coahuila', ciudad: 'Piedras Negras', lat: 28.7050, lng: -100.5200, marcas: 'GM Ramos, Stellantis Saltillo', capacidad: 'Cruce comercial', nota: 'La ruta más corta desde Saltillo y Ramos Arizpe.' },
    { id: 'fr-juarez', tipo: 'frontera', nombre: 'Ciudad Juárez - Zaragoza/Ysleta', empresa: 'Aduana Ciudad Juárez', estado: 'Chihuahua', ciudad: 'Ciudad Juárez', lat: 31.6650, lng: -106.3210, marcas: 'Corredor centro-norte', capacidad: 'Cruce comercial de alto volumen', nota: 'Conecta con la I-10: útil para destinos al oeste de EE.UU.' },
    { id: 'fr-nogales', tipo: 'frontera', nombre: 'Nogales - Mariposa', empresa: 'Aduana Nogales', estado: 'Sonora', ciudad: 'Nogales', lat: 31.3300, lng: -110.9670, marcas: 'Ford Hermosillo', capacidad: 'Cruce comercial', nota: 'Salida terrestre del noroeste hacia Arizona.' },
    { id: 'fr-otay', tipo: 'frontera', nombre: 'Tijuana - Otay Mesa', empresa: 'Aduana Tijuana', estado: 'Baja California', ciudad: 'Tijuana', lat: 32.5410, lng: -116.9420, marcas: 'Toyota Tijuana', capacidad: 'Cruce comercial', nota: 'Trayectos cortos con alta rotación de unidades.' },
    { id: 'fr-mexicali', tipo: 'frontera', nombre: 'Mexicali - Garita II', empresa: 'Aduana Mexicali', estado: 'Baja California', ciudad: 'Mexicali', lat: 32.6560, lng: -115.4400, marcas: 'Kenworth Mexicali', capacidad: 'Cruce comercial', nota: 'Cruce inmediato para la industria de Mexicali.' },
    { id: 'fr-matamoros', tipo: 'frontera', nombre: 'Matamoros - Los Indios', empresa: 'Aduana Matamoros', estado: 'Tamaulipas', ciudad: 'Matamoros', lat: 25.8780, lng: -97.4980, marcas: 'Corredor noreste', capacidad: 'Cruce comercial', nota: 'Alternativa al eje Laredo para destinos al este de Texas.' },
    { id: 'fr-reynosa', tipo: 'frontera', nombre: 'Reynosa - Pharr', empresa: 'Aduana Reynosa', estado: 'Tamaulipas', ciudad: 'Reynosa', lat: 26.0180, lng: -98.2870, marcas: 'Corredor noreste', capacidad: 'Cruce comercial', nota: 'Buen desempeño en tiempos de despacho.' }
];

const TIPO_META = {
    planta:   { label: 'Planta armadora',  color: '#4f46e5', icon: 'fa-industry',     chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    puerto:   { label: 'Puerto',           color: '#0891b2', icon: 'fa-anchor',       chip: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    frontera: { label: 'Cruce fronterizo', color: '#059669', icon: 'fa-road-barrier', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
};

// ---------------- ESTADO DEL MÓDULO ----------------
let netMap = null;
let netMarkers = {};
let netLines = [];
let selectedNodeId = null;
const netFilters = { planta: true, puerto: true, frontera: true };
const addressCache = {};

// ---------------- CÁLCULOS ----------------
// Factor de corrección de línea recta a kilómetros carreteros reales.
const ROAD_FACTOR = 1.27;

function getCostParams() {
    const val = (id, def) => {
        const v = parseFloat(document.getElementById(id)?.value);
        return (isNaN(v) || v <= 0) ? def : v;
    };
    return {
        kpl: val('rl-kpl', 2.5),
        diesel: val('rl-diesel', 24.5),
        tollPerKm: val('rl-toll', 3.2)
    };
}

function haversineKm(a, b) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

function roadKm(a, b) {
    return haversineKm(a, b) * ROAD_FACTOR;
}

function tripCost(km, p) {
    const params = p || getCostParams();
    return (km / params.kpl) * params.diesel + km * params.tollPerKm;
}

function money(n) {
    return '$' + Math.round(n).toLocaleString('es-MX');
}

function getNode(id) {
    return NETWORK_NODES.find(n => n.id === id);
}

// Puertos y fronteras ordenados por cercanía a una planta.
function gatewaysFor(node, limit = 3) {
    const p = getCostParams();
    return NETWORK_NODES
        .filter(n => n.tipo === 'puerto' || n.tipo === 'frontera')
        .map(n => {
            const km = roadKm(node, n);
            return { node: n, km, costo: tripCost(km, p) };
        })
        .sort((a, b) => a.km - b.km)
        .slice(0, limit);
}

// Plantas más cercanas a un puerto o frontera (carga potencial de retorno).
function plantsFor(node, limit = 3) {
    const p = getCostParams();
    return NETWORK_NODES
        .filter(n => n.tipo === 'planta')
        .map(n => {
            const km = roadKm(node, n);
            return { node: n, km, costo: tripCost(km, p) };
        })
        .sort((a, b) => a.km - b.km)
        .slice(0, limit);
}

// Triangulación: en lugar de regresar vacío de la puerta de salida a la planta
// de origen, cargar en la planta más cercana a esa puerta de salida.
function triangulationFor(planta, gateway) {
    const p = getCostParams();
    const candidatos = NETWORK_NODES
        .filter(n => n.tipo === 'planta' && n.id !== planta.id)
        .map(n => ({ node: n, km: roadKm(gateway, n) }))
        .sort((a, b) => a.km - b.km);

    if (!candidatos.length) return null;

    const mejor = candidatos[0];
    const kmRegresoVacio = roadKm(gateway, planta);
    const ahorroKm = kmRegresoVacio - mejor.km;
    if (ahorroKm <= 20) return null; // sin beneficio relevante

    return {
        planta_retorno: mejor.node,
        km_regreso_vacio: kmRegresoVacio,
        km_hasta_carga: mejor.km,
        ahorro_km: ahorroKm,
        ahorro_mxn: tripCost(ahorroKm, p)
    };
}

// Oportunidades de toda la red, ordenadas por ahorro estimado.
function computeOpportunities(limit = 10) {
    const p = getCostParams();
    const out = [];

    NETWORK_NODES.filter(n => n.tipo === 'planta').forEach(planta => {
        const gws = gatewaysFor(planta, 3);
        if (!gws.length) return;
        const mejor = gws[0];
        const alterna = gws[1] || null;
        const tri = triangulationFor(planta, mejor.node);

        out.push({
            planta_id: planta.id,
            planta: planta.nombre,
            estado: planta.estado,
            salida_optima: mejor.node.nombre,
            salida_id: mejor.node.id,
            salida_tipo: TIPO_META[mejor.node.tipo].label,
            km_optimo: Math.round(mejor.km),
            costo_optimo: Math.round(mejor.costo),
            alternativa: alterna ? alterna.node.nombre : null,
            km_alternativa: alterna ? Math.round(alterna.km) : null,
            sobrecosto_alternativa: alterna ? Math.round(alterna.costo - mejor.costo) : null,
            triangulacion: tri ? {
                cargar_en: tri.planta_retorno.nombre,
                cargar_en_id: tri.planta_retorno.id,
                km_evitados: Math.round(tri.ahorro_km),
                ahorro_mxn: Math.round(tri.ahorro_mxn)
            } : null,
            ahorro_estimado: Math.round(tri ? tri.ahorro_mxn : 0)
        });
    });

    return {
        parametros: { km_por_litro: p.kpl, precio_diesel_litro: p.diesel, casetas_por_km: p.tollPerKm, factor_carretero: ROAD_FACTOR },
        oportunidades: out.sort((a, b) => b.ahorro_estimado - a.ahorro_estimado).slice(0, limit)
    };
}

// ================================================================
// RENDER
// ================================================================
export function renderLogisticsNetwork(container) {
    container.innerHTML = `
        <style>
            /* La IA devuelve su propio HTML con clases de Tailwind (incluidos text-2xl y
               similares). Normalizamos el tamaño para que quepa en el panel lateral. */
            #rl-ai-html, #rl-ai-html * { font-size: 11px !important; line-height: 1.5 !important; }
            #rl-ai-html h1, #rl-ai-html h2, #rl-ai-html h3, #rl-ai-html h4 { font-size: 12px !important; margin: 0 0 4px; }
            #rl-ai-html i { font-size: 11px !important; }
            #rl-ai-html ul { list-style: disc; padding-left: 16px; }
            /* El panel es angosto: forzamos una sola columna aunque la IA devuelva grids. */
            #rl-ai-html [class*="grid-cols"] { grid-template-columns: 1fr !important; }
            #rl-ai-html .flex { flex-wrap: wrap !important; }
        </style>
        <div class="h-full flex flex-col lg:flex-row bg-slate-100 p-2 gap-2 fade-in font-sans text-[13px] text-slate-900 overflow-hidden">

            <!-- PANEL IZQUIERDO: FILTROS + LISTADO -->
            <div class="w-full lg:w-[340px] bg-white border border-slate-300 rounded-xl shadow-xl flex flex-col overflow-hidden shrink-0 max-h-[45vh] lg:max-h-full">
                <div class="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 class="text-sm font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                        <i class="fas fa-diagram-project text-indigo-600"></i> Nodos de la red
                    </h3>
                    <p class="text-[10px] text-slate-500 font-bold mt-1">Plantas armadoras, puertos y cruces fronterizos de México</p>

                    <div class="flex gap-1 mt-3">
                        <button data-tipo="planta" class="rl-filter flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter border transition-all bg-indigo-600 text-white border-indigo-600 shadow">
                            <i class="fas fa-industry mr-1"></i> Plantas
                        </button>
                        <button data-tipo="puerto" class="rl-filter flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter border transition-all bg-cyan-600 text-white border-cyan-600 shadow">
                            <i class="fas fa-anchor mr-1"></i> Puertos
                        </button>
                        <button data-tipo="frontera" class="rl-filter flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter border transition-all bg-emerald-600 text-white border-emerald-600 shadow">
                            <i class="fas fa-road-barrier mr-1"></i> Fronteras
                        </button>
                    </div>

                    <div class="relative mt-3">
                        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input id="rl-search" type="text" placeholder="Buscar planta, puerto, estado o marca..."
                            class="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm">
                    </div>
                </div>

                <div id="rl-node-list" class="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100"></div>

                <div class="p-3 border-t border-slate-200 bg-slate-50 grid grid-cols-3 gap-2">
                    <div class="text-center">
                        <p class="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Diesel Km/L</p>
                        <input id="rl-kpl" type="number" step="0.1" value="2.5" class="rl-param w-full bg-white border border-slate-300 rounded-lg text-center text-xs font-black text-slate-800 py-1 focus:ring-indigo-500 outline-none">
                    </div>
                    <div class="text-center">
                        <p class="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Precio Diesel</p>
                        <input id="rl-diesel" type="number" step="0.1" value="24.5" class="rl-param w-full bg-white border border-slate-300 rounded-lg text-center text-xs font-black text-slate-800 py-1 focus:ring-indigo-500 outline-none">
                    </div>
                    <div class="text-center">
                        <p class="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Casetas $/Km</p>
                        <input id="rl-toll" type="number" step="0.1" value="3.2" class="rl-param w-full bg-white border border-slate-300 rounded-lg text-center text-xs font-black text-slate-800 py-1 focus:ring-indigo-500 outline-none">
                    </div>
                </div>
            </div>

            <!-- MAPA -->
            <div class="flex-1 relative bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden min-h-[300px]">
                <div id="rl-map-canvas" class="w-full h-full z-0"></div>

                <div class="absolute bottom-4 left-4 z-[500] bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg p-3 space-y-2">
                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Leyenda</p>
                    <div class="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                        <span class="w-3 h-3 rounded-full" style="background:#4f46e5"></span> Planta armadora
                    </div>
                    <div class="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                        <span class="w-3 h-3 rounded-full" style="background:#0891b2"></span> Puerto (terminal de autos)
                    </div>
                    <div class="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                        <span class="w-3 h-3 rounded-full" style="background:#059669"></span> Cruce fronterizo
                    </div>
                </div>

                <button id="rl-reset-view" class="absolute top-4 right-4 z-[500] bg-white border border-slate-300 rounded-lg shadow-lg px-3 py-2 text-[10px] font-black uppercase tracking-tighter text-slate-600 hover:bg-slate-50 transition-all">
                    <i class="fas fa-crosshairs mr-1 text-indigo-600"></i> Ver todo México
                </button>
            </div>

            <!-- PANEL DERECHO: DETALLE + IA -->
            <div class="w-full lg:w-[400px] flex flex-col gap-2 shrink-0 overflow-hidden max-h-[50vh] lg:max-h-full">

                <div id="rl-detail" class="bg-white border border-slate-300 rounded-xl shadow-xl overflow-y-auto custom-scrollbar flex-1 min-h-[180px]">
                    <div class="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                        <i class="fas fa-map-location-dot text-4xl mb-3 text-slate-300"></i>
                        <p class="text-xs font-black uppercase tracking-tighter">Selecciona un nodo</p>
                        <p class="text-[11px] font-medium mt-1">Haz clic en un punto del mapa o en la lista para ver su ubicación exacta y sus rutas óptimas.</p>
                    </div>
                </div>

                <div class="bg-white border border-slate-300 rounded-xl shadow-xl flex flex-col overflow-hidden flex-1 min-h-[200px]">
                    <div class="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                        <h3 class="text-xs font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                            <i class="fas fa-robot text-indigo-600"></i> Optimización de viajes
                        </h3>
                        <button id="rl-ai-btn" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all shadow-lg shadow-indigo-200">
                            <i class="fas fa-wand-magic-sparkles mr-1"></i> Analizar con IA
                        </button>
                    </div>
                    <div id="rl-ai-result" class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2"></div>
                </div>
            </div>
        </div>
    `;

    initNetworkMap();
    renderNodeList();
    renderOpportunities();
    bindNetworkUI();
}

// ---------------- MAPA ----------------
function initNetworkMap() {
    const mexicoCenter = [23.6345, -102.5528];
    netMap = L.map('rl-map-canvas', { zoomControl: true }).setView(mexicoCenter, 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(netMap);

    NETWORK_NODES.forEach(node => {
        const meta = TIPO_META[node.tipo];
        const icon = L.divIcon({
            className: '',
            html: `<div style="background:${meta.color};width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;box-shadow:0 2px 8px rgba(15,23,42,.45);border:2px solid #fff">
                     <i class="fas ${meta.icon}"></i>
                   </div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            popupAnchor: [0, -14]
        });

        const marker = L.marker([node.lat, node.lng], { icon, title: node.nombre })
            .addTo(netMap)
            .bindPopup(`<div style="min-width:180px">
                <b>${node.nombre}</b><br>
                <span style="color:${meta.color};font-weight:700;font-size:11px">${meta.label}</span><br>
                <span style="font-size:11px">${node.ciudad}, ${node.estado}</span><br>
                <span style="font-size:10px;color:#64748b">${node.lat.toFixed(5)}, ${node.lng.toFixed(5)}</span>
            </div>`);

        marker.on('click', () => selectNode(node.id, false));
        netMarkers[node.id] = marker;
    });

    // Leaflet necesita recalcular el tamaño cuando el contenedor se monta dinámicamente.
    setTimeout(() => netMap.invalidateSize(), 250);
}

function clearNetworkLines() {
    netLines.forEach(l => netMap.removeLayer(l));
    netLines = [];
}

function drawCorridor(from, to, color, label) {
    const line = L.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
        color,
        weight: 3,
        opacity: 0.75,
        dashArray: '8, 8'
    }).addTo(netMap);
    line.bindTooltip(label, { sticky: true });
    netLines.push(line);
}

function applyMarkerFilters() {
    NETWORK_NODES.forEach(node => {
        const marker = netMarkers[node.id];
        if (!marker) return;
        if (netFilters[node.tipo]) {
            if (!netMap.hasLayer(marker)) marker.addTo(netMap);
        } else if (netMap.hasLayer(marker)) {
            netMap.removeLayer(marker);
        }
    });
}

// ---------------- LISTADO ----------------
function renderNodeList() {
    const list = document.getElementById('rl-node-list');
    if (!list) return;

    const term = (document.getElementById('rl-search')?.value || '').toLowerCase().trim();

    const visibles = NETWORK_NODES.filter(n => {
        if (!netFilters[n.tipo]) return false;
        if (!term) return true;
        return [n.nombre, n.empresa, n.estado, n.ciudad, n.marcas].join(' ').toLowerCase().includes(term);
    });

    if (!visibles.length) {
        list.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs font-black uppercase tracking-tighter">Sin resultados</div>`;
        return;
    }

    list.innerHTML = visibles.map(n => {
        const meta = TIPO_META[n.tipo];
        const active = n.id === selectedNodeId ? 'bg-indigo-50' : '';
        return `
            <button class="rl-node-item w-full text-left px-4 py-3 hover:bg-slate-50 transition-all ${active}" data-id="${n.id}">
                <div class="flex items-start gap-3">
                    <span class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] shrink-0 shadow" style="background:${meta.color}">
                        <i class="fas ${meta.icon}"></i>
                    </span>
                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-black text-slate-800 truncate">${n.nombre}</p>
                        <p class="text-[10px] text-slate-500 font-bold truncate">${n.ciudad}, ${n.estado}</p>
                        <p class="text-[10px] text-slate-400 font-medium truncate">${n.marcas}</p>
                    </div>
                </div>
            </button>
        `;
    }).join('');

    list.querySelectorAll('.rl-node-item').forEach(btn => {
        btn.addEventListener('click', () => selectNode(btn.dataset.id, true));
    });
}

// ---------------- DETALLE DEL NODO ----------------
function selectNode(id, fly) {
    const node = getNode(id);
    if (!node) return;

    selectedNodeId = id;
    renderNodeList();
    renderNodeDetail(node);

    clearNetworkLines();
    const conexiones = node.tipo === 'planta' ? gatewaysFor(node, 3) : plantsFor(node, 3);
    conexiones.forEach((c, i) => {
        drawCorridor(node, c.node, i === 0 ? '#4f46e5' : '#94a3b8',
            `${node.nombre} → ${c.node.nombre}: ${Math.round(c.km)} km · ${money(c.costo)}`);
    });

    if (fly) netMap.flyTo([node.lat, node.lng], 8, { duration: 0.8 });
    netMarkers[id]?.openPopup();
}

function renderNodeDetail(node) {
    const panel = document.getElementById('rl-detail');
    if (!panel) return;

    const meta = TIPO_META[node.tipo];
    const esPlanta = node.tipo === 'planta';
    const conexiones = esPlanta ? gatewaysFor(node, 3) : plantsFor(node, 3);
    const tri = esPlanta && conexiones[0] ? triangulationFor(node, conexiones[0].node) : null;
    const coords = `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`;

    panel.innerHTML = `
        <div class="p-4 space-y-4">
            <div class="flex items-start gap-3">
                <span class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-base shrink-0 shadow-lg" style="background:${meta.color}">
                    <i class="fas ${meta.icon}"></i>
                </span>
                <div class="min-w-0">
                    <p class="text-sm font-black text-slate-900 leading-tight">${node.nombre}</p>
                    <span class="inline-block mt-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-tighter ${meta.chip}">${meta.label}</span>
                </div>
            </div>

            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div class="flex justify-between gap-3 text-[11px]">
                    <span class="text-slate-500 font-bold uppercase tracking-tighter">Operador</span>
                    <span class="text-slate-800 font-black text-right">${node.empresa}</span>
                </div>
                <div class="flex justify-between gap-3 text-[11px]">
                    <span class="text-slate-500 font-bold uppercase tracking-tighter">Ubicación</span>
                    <span class="text-slate-800 font-black text-right">${node.ciudad}, ${node.estado}</span>
                </div>
                <div class="flex justify-between gap-3 text-[11px]">
                    <span class="text-slate-500 font-bold uppercase tracking-tighter">${esPlanta ? 'Modelos' : 'Flujo'}</span>
                    <span class="text-slate-800 font-black text-right">${node.marcas}</span>
                </div>
                <div class="flex justify-between gap-3 text-[11px]">
                    <span class="text-slate-500 font-bold uppercase tracking-tighter">Capacidad</span>
                    <span class="text-slate-800 font-black text-right">${node.capacidad}</span>
                </div>
            </div>

            <div class="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3">
                <p class="text-[9px] font-black text-indigo-700 uppercase tracking-widest mb-2">
                    <i class="fas fa-location-crosshairs mr-1"></i> Ubicación exacta
                </p>
                <p class="font-mono text-xs text-slate-800 font-bold">${coords}</p>
                <p id="rl-detail-address" class="text-[11px] text-slate-500 font-medium mt-1 italic">Obteniendo dirección...</p>
                <div class="flex gap-2 mt-3">
                    <a href="https://www.google.com/maps/search/?api=1&query=${node.lat},${node.lng}" target="_blank" rel="noopener"
                       class="flex-1 text-center px-2 py-2 bg-white border border-slate-300 rounded-lg text-[9px] font-black uppercase tracking-tighter text-slate-700 hover:bg-slate-50 transition-all">
                        <i class="fas fa-map-pin mr-1 text-red-500"></i> Google Maps
                    </a>
                    <button id="rl-copy-coords" data-coords="${coords}"
                       class="flex-1 px-2 py-2 bg-white border border-slate-300 rounded-lg text-[9px] font-black uppercase tracking-tighter text-slate-700 hover:bg-slate-50 transition-all">
                        <i class="fas fa-copy mr-1 text-indigo-500"></i> Copiar
                    </button>
                </div>
            </div>

            <div>
                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    <i class="fas fa-route mr-1 text-indigo-600"></i>
                    ${esPlanta ? 'Puertas de salida más económicas' : 'Plantas más cercanas (carga potencial)'}
                </p>
                <div class="space-y-2">
                    ${conexiones.map((c, i) => `
                        <div class="border ${i === 0 ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-white'} rounded-xl p-3">
                            <div class="flex items-center justify-between gap-2">
                                <p class="text-[11px] font-black text-slate-800 truncate">
                                    ${i === 0 ? '<i class="fas fa-star text-amber-500 mr-1"></i>' : ''}${c.node.nombre}
                                </p>
                                <span class="text-[10px] font-black text-slate-500 shrink-0">${Math.round(c.km)} km</span>
                            </div>
                            <div class="flex items-center justify-between gap-2 mt-2">
                                <span class="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Costo estimado del viaje</span>
                                <span class="text-xs font-black text-emerald-700">${money(c.costo)}</span>
                            </div>
                            <button class="rl-route-ai mt-2 w-full py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-tighter hover:bg-indigo-50 transition-all"
                                data-origen="${node.nombre}, ${node.ciudad}, ${node.estado}"
                                data-destino="${c.node.nombre}, ${c.node.ciudad}, ${c.node.estado}">
                                <i class="fas fa-diamond-turn-right mr-1"></i> Trazar ruta con IA
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>

            ${tri ? `
            <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p class="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-2">
                    <i class="fas fa-arrows-spin mr-1"></i> Triangulación sugerida (evita regreso vacío)
                </p>
                <p class="text-[11px] text-slate-700 font-medium leading-relaxed">
                    Tras descargar en <b>${conexiones[0].node.nombre}</b>, en lugar de regresar vacío
                    (${Math.round(tri.km_regreso_vacio)} km) cargar en
                    <b>${tri.planta_retorno.nombre}</b>, a solo ${Math.round(tri.km_hasta_carga)} km.
                </p>
                <div class="flex items-center justify-between mt-3 pt-2 border-t border-emerald-200">
                    <span class="text-[9px] font-black text-emerald-700 uppercase tracking-tighter">Ahorro estimado por vuelta</span>
                    <span class="text-sm font-black text-emerald-700">${money(tri.ahorro_mxn)}</span>
                </div>
            </div>` : ''}

            <div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p class="text-[11px] text-slate-700 font-medium leading-relaxed">
                    <i class="fas fa-circle-info text-amber-600 mr-1"></i> ${node.nota}
                </p>
            </div>
        </div>
    `;

    // Dirección exacta por geocodificación inversa (utilidad global ya existente).
    const addressEl = document.getElementById('rl-detail-address');
    if (addressEl) {
        if (addressCache[node.id]) {
            addressEl.textContent = addressCache[node.id];
        } else if (window.freeReverseGeocodeQueue) {
            window.freeReverseGeocodeQueue(node.lat, node.lng, (short, full) => {
                const text = full || short || 'Dirección no disponible';
                addressCache[node.id] = text;
                if (selectedNodeId === node.id) {
                    const el = document.getElementById('rl-detail-address');
                    if (el) el.textContent = text;
                }
            });
        } else {
            addressEl.textContent = 'Dirección no disponible';
        }
    }

    const copyBtn = document.getElementById('rl-copy-coords');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(copyBtn.dataset.coords);
                copyBtn.innerHTML = '<i class="fas fa-check mr-1 text-emerald-500"></i> Copiado';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fas fa-copy mr-1 text-indigo-500"></i> Copiar';
                }, 1800);
            } catch (err) {
                console.warn('No se pudo copiar al portapapeles:', err);
            }
        });
    }

    panel.querySelectorAll('.rl-route-ai').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.openAIRoute) {
                window.openAIRoute(btn.dataset.origen, btn.dataset.destino, 'full');
            }
        });
    });
}

// ---------------- OPORTUNIDADES (CÁLCULO LOCAL) ----------------
function renderOpportunities() {
    const box = document.getElementById('rl-ai-result');
    if (!box) return;

    const { oportunidades } = computeOpportunities(8);

    box.innerHTML = `
        <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">
            Top oportunidades calculadas (sin IA)
        </p>
        ${oportunidades.map(o => `
            <button class="rl-opp w-full text-left border border-slate-200 rounded-xl p-3 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all" data-id="${o.planta_id}">
                <div class="flex items-start justify-between gap-2">
                    <p class="text-[11px] font-black text-slate-800 leading-tight">${o.planta}</p>
                    ${o.ahorro_estimado > 0
                        ? `<span class="text-[10px] font-black text-emerald-700 shrink-0">+${money(o.ahorro_estimado)}</span>`
                        : ''}
                </div>
                <p class="text-[10px] text-slate-500 font-bold mt-1">
                    <i class="fas fa-arrow-right-long mr-1 text-indigo-500"></i>${o.salida_optima} · ${o.km_optimo} km · ${money(o.costo_optimo)}
                </p>
                ${o.triangulacion
                    ? `<p class="text-[10px] text-emerald-700 font-bold mt-1"><i class="fas fa-arrows-spin mr-1"></i>Retorno: cargar en ${o.triangulacion.cargar_en} (${o.triangulacion.km_evitados} km vacíos evitados)</p>`
                    : ''}
            </button>
        `).join('')}
    `;

    box.querySelectorAll('.rl-opp').forEach(btn => {
        btn.addEventListener('click', () => selectNode(btn.dataset.id, true));
    });
}

// ---------------- ANÁLISIS CON IA ----------------
async function runNetworkAI() {
    const box = document.getElementById('rl-ai-result');
    const btn = document.getElementById('rl-ai-btn');
    if (!box) return;

    const payload = computeOpportunities(10);
    const focus = selectedNodeId ? getNode(selectedNodeId) : null;
    if (focus) {
        payload.nodo_en_foco = {
            nombre: focus.nombre,
            tipo: TIPO_META[focus.tipo].label,
            ciudad: focus.ciudad,
            estado: focus.estado
        };
    }

    box.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center py-10 text-center">
            <div class="spinner mb-3 border-t-indigo-500 w-8 h-8"></div>
            <p class="text-[11px] font-black text-slate-500 uppercase tracking-tighter">Analizando la red con Gemini AI...</p>
        </div>
    `;
    if (btn) btn.disabled = true;

    try {
        const html = await getLogisticsNetworkSuggestionsAI(payload);
        box.innerHTML = `
            <div class="space-y-3">
                <div id="rl-ai-html" class="text-[11px] leading-relaxed text-slate-700">${html}</div>
                <button id="rl-back-calc" class="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border border-slate-300">
                    <i class="fas fa-calculator mr-1"></i> Ver cálculo local
                </button>
            </div>
        `;
        document.getElementById('rl-back-calc')?.addEventListener('click', renderOpportunities);
    } catch (err) {
        console.error('Error en análisis IA de red logística:', err);
        box.innerHTML = `
            <div class="p-4 bg-red-50 border border-red-200 rounded-xl text-center text-red-600 text-[11px] font-bold">
                <i class="fas fa-exclamation-triangle mr-1"></i> No se pudo completar el análisis con IA.
            </div>
        `;
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ---------------- EVENTOS ----------------
function bindNetworkUI() {
    document.querySelectorAll('.rl-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            const tipo = btn.dataset.tipo;
            netFilters[tipo] = !netFilters[tipo];
            const meta = TIPO_META[tipo];

            if (netFilters[tipo]) {
                btn.style.background = meta.color;
                btn.style.borderColor = meta.color;
                btn.classList.add('text-white', 'shadow');
                btn.classList.remove('text-slate-400', 'bg-white');
            } else {
                btn.style.background = '#fff';
                btn.style.borderColor = '#cbd5e1';
                btn.classList.remove('text-white', 'shadow');
                btn.classList.add('text-slate-400');
            }

            applyMarkerFilters();
            renderNodeList();
        });
    });

    document.getElementById('rl-search')?.addEventListener('input', renderNodeList);

    document.querySelectorAll('.rl-param').forEach(input => {
        input.addEventListener('change', () => {
            renderOpportunities();
            if (selectedNodeId) selectNode(selectedNodeId, false);
        });
    });

    document.getElementById('rl-reset-view')?.addEventListener('click', () => {
        clearNetworkLines();
        netMap.flyTo([23.6345, -102.5528], 5, { duration: 0.8 });
    });

    document.getElementById('rl-ai-btn')?.addEventListener('click', runNetworkAI);
}
