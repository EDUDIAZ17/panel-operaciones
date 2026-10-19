import { getLogisticsNetworkSuggestionsAI } from '../services/gemini.js';

// ================================================================
// RED LOGÍSTICA AUTOMOTRIZ DE MÉXICO
// La red es fija: todos los nodos y todas las líneas se dibujan al
// cargar, sin tener que seleccionar nada. Hacer clic en un punto solo
// abre su ficha con la ubicación exacta.
//
// Simbología:
//   verde   = puerto de exportación
//   azul    = puerto de importación (verde/azul si hace ambas)
//   morado  = exportación terrestre por tren
//   amarillo= ciudades grandes, destino de viajes domésticos Nissan
//   rojo    = recorrido en vacío al punto de carga más cercano
// ================================================================

const NETWORK_NODES = [
    // ---------------- ARMADORAS ----------------
    { id: 'gm-silao', tipo: 'planta', nombre: 'GM Complejo Silao', empresa: 'General Motors', estado: 'Guanajuato', ciudad: 'Silao', lat: 20.9010, lng: -101.4360, marcas: 'Silverado, Sierra, Cheyenne', capacidad: '~430,000 u/año', nota: 'Ensamble, estampado y transmisiones. Nodo pesado del Bajío.' },
    { id: 'gm-ramos', tipo: 'planta', nombre: 'GM Ramos Arizpe', empresa: 'General Motors', estado: 'Coahuila', ciudad: 'Ramos Arizpe', lat: 25.5470, lng: -100.9930, marcas: 'Blazer EV, Equinox EV', capacidad: '~250,000 u/año', nota: 'Complejo con motores y estampado.' },
    { id: 'gm-slp', tipo: 'planta', nombre: 'GM San Luis Potosí', empresa: 'General Motors', estado: 'San Luis Potosí', ciudad: 'San Luis Potosí', lat: 22.0290, lng: -100.9080, marcas: 'Equinox, Trax', capacidad: '~200,000 u/año', nota: 'Sobre el corredor MEX-57 (NAFTA Highway).' },
    { id: 'gm-toluca', tipo: 'planta', nombre: 'GM Complejo Toluca', empresa: 'General Motors', estado: 'Estado de México', ciudad: 'Toluca', lat: 19.2740, lng: -99.6420, marcas: 'Motores y componentes', capacidad: 'Componentes', nota: 'Complejo de propulsión: genera flujo de partes, no de unidades terminadas.' },
    { id: 'ford-hermosillo', tipo: 'planta', nombre: 'Ford Hermosillo', empresa: 'Ford Motor Company', estado: 'Sonora', ciudad: 'Hermosillo', lat: 29.0180, lng: -110.8890, marcas: 'Bronco Sport, Maverick', capacidad: '~300,000 u/año', nota: 'La armadora más alejada de los puertos de autos del país.' },
    { id: 'ford-cuautitlan', tipo: 'planta', nombre: 'Ford Cuautitlán', empresa: 'Ford Motor Company', estado: 'Estado de México', ciudad: 'Cuautitlán Izcalli', lat: 19.6740, lng: -99.2050, marcas: 'Mustang Mach-E', capacidad: '~180,000 u/año', nota: 'Zona metropolitana: restricciones de horario y de doble remolque.' },
    { id: 'stellantis-toluca', tipo: 'planta', nombre: 'Stellantis Toluca', empresa: 'Stellantis', estado: 'Estado de México', ciudad: 'Toluca', lat: 19.2810, lng: -99.6360, marcas: 'Jeep Compass, Hornet', capacidad: '~250,000 u/año', nota: 'Exporta principalmente vía Veracruz.' },
    { id: 'stellantis-van', tipo: 'planta', nombre: 'Stellantis Saltillo Van (Derramadero)', empresa: 'Stellantis', estado: 'Coahuila', ciudad: 'Derramadero, Saltillo', lat: 25.2340, lng: -101.1490, marcas: 'Ram ProMaster', capacidad: '~150,000 u/año', nota: 'Complejo Derramadero, alta densidad de proveedores.' },
    { id: 'stellantis-truck', tipo: 'planta', nombre: 'Stellantis Saltillo Truck', empresa: 'Stellantis', estado: 'Coahuila', ciudad: 'Saltillo', lat: 25.4290, lng: -100.9370, marcas: 'Ram 1500 / 2500 / 3500', capacidad: '~450,000 u/año', nota: 'Uno de los mayores exportadores terrestres del país.' },
    { id: 'nissan-a1', tipo: 'planta', nissan: true, nombre: 'Nissan Aguascalientes A1', empresa: 'Nissan', estado: 'Aguascalientes', ciudad: 'Aguascalientes', lat: 21.8240, lng: -102.2610, marcas: 'Versa, March, Kicks', capacidad: '~450,000 u/año', nota: 'Principal origen de viajes domésticos Nissan.' },
    { id: 'nissan-a2', tipo: 'planta', nissan: true, nombre: 'Nissan Aguascalientes A2', empresa: 'Nissan', estado: 'Aguascalientes', ciudad: 'Aguascalientes', lat: 21.9550, lng: -102.2170, marcas: 'Sentra', capacidad: '~175,000 u/año', nota: 'Alta exportación a Estados Unidos y Canadá.' },
    { id: 'compas-ags', tipo: 'planta', nissan: true, nombre: 'Planta COMPAS Aguascalientes', empresa: 'Nissan (ex COMPAS)', estado: 'Aguascalientes', ciudad: 'Aguascalientes', lat: 21.9860, lng: -102.1210, marcas: 'Infiniti QX50 / QX55', capacidad: '~100,000 u/año', nota: 'Vehículos premium: conviene madrina cerrada o cubierta.' },
    { id: 'nissan-civac', tipo: 'planta', nissan: true, nombre: 'Nissan CIVAC', empresa: 'Nissan', estado: 'Morelos', ciudad: 'Jiutepec', lat: 18.8890, lng: -99.1710, marcas: 'NP300 Frontier', capacidad: '~150,000 u/año', nota: 'Origen natural de los viajes domésticos al centro y sureste.' },
    { id: 'vw-puebla', tipo: 'planta', nombre: 'Volkswagen Puebla', empresa: 'Volkswagen', estado: 'Puebla', ciudad: 'Puebla', lat: 19.1600, lng: -98.2320, marcas: 'Jetta, Tiguan, Taos', capacidad: '~400,000 u/año', nota: 'Principal usuario del puerto de Veracruz para exportación a Europa.' },
    { id: 'audi-chiapa', tipo: 'planta', nombre: 'Audi San José Chiapa', empresa: 'Audi México', estado: 'Puebla', ciudad: 'San José Chiapa', lat: 19.2810, lng: -97.7010, marcas: 'Audi Q5', capacidad: '~150,000 u/año', nota: 'Premium: exporta casi todo vía Veracruz.' },
    { id: 'toyota-gto', tipo: 'planta', nombre: 'Toyota Guanajuato', empresa: 'Toyota', estado: 'Guanajuato', ciudad: 'Apaseo el Grande', lat: 20.5390, lng: -100.6690, marcas: 'Tacoma', capacidad: '~130,000 u/año', nota: 'Exportación mayoritaria a EE.UU.' },
    { id: 'toyota-tij', tipo: 'planta', nombre: 'Toyota Baja California', empresa: 'Toyota', estado: 'Baja California', ciudad: 'Tijuana', lat: 32.4560, lng: -116.8480, marcas: 'Cajas Tacoma', capacidad: '~100,000 u/año', nota: 'Pegada a la frontera, lejos de los puertos de autos.' },
    { id: 'honda-celaya', tipo: 'planta', nombre: 'Honda Celaya', empresa: 'Honda', estado: 'Guanajuato', ciudad: 'Celaya', lat: 20.4610, lng: -100.8790, marcas: 'HR-V', capacidad: '~200,000 u/año', nota: 'Bajío: compiten Lázaro Cárdenas y Manzanillo como salida.' },
    { id: 'mazda-salamanca', tipo: 'planta', nombre: 'Mazda Salamanca', empresa: 'Mazda', estado: 'Guanajuato', ciudad: 'Salamanca', lat: 20.5450, lng: -101.1600, marcas: 'Mazda2, Mazda3, CX-30', capacidad: '~250,000 u/año', nota: 'Exporta fuerte a Sudamérica y Asia por Lázaro Cárdenas.' },
    { id: 'kia-pesqueria', tipo: 'planta', nombre: 'KIA Pesquería', empresa: 'KIA', estado: 'Nuevo León', ciudad: 'Pesquería', lat: 25.7590, lng: -100.0630, marcas: 'Forte, K3, Rio', capacidad: '~400,000 u/año', nota: 'Cerca de la terminal de Ferromex en Monterrey y del puerto de Altamira.' },
    { id: 'bmw-slp', tipo: 'planta', nombre: 'BMW San Luis Potosí', empresa: 'BMW Group', estado: 'San Luis Potosí', ciudad: 'Villa de Reyes', lat: 21.8330, lng: -100.9440, marcas: 'Serie 3, M2', capacidad: '~175,000 u/año', nota: 'Premium: requiere unidad cerrada.' },
    { id: 'jac-sahagun', tipo: 'planta', nombre: 'Giant Motors / JAC Ciudad Sahagún', empresa: 'Giant Motors', estado: 'Hidalgo', ciudad: 'Ciudad Sahagún', lat: 19.7710, lng: -98.5820, marcas: 'JAC (SUV y pick-ups)', capacidad: '~40,000 u/año', nota: 'Enfocada al mercado nacional.' },
    { id: 'daimler-saltillo', tipo: 'planta', nombre: 'Daimler Truck Santiago (Saltillo)', empresa: 'Daimler Truck México', estado: 'Coahuila', ciudad: 'Saltillo', lat: 25.4150, lng: -100.9800, marcas: 'Freightliner (tractocamiones)', capacidad: 'Vehículo pesado', nota: 'Carga pesada: requiere plataforma o autotransporte especializado.' },
    { id: 'navistar-escobedo', tipo: 'planta', nombre: 'Navistar Escobedo', empresa: 'International', estado: 'Nuevo León', ciudad: 'Gral. Escobedo', lat: 25.7970, lng: -100.3200, marcas: 'International (camiones)', capacidad: 'Vehículo pesado', nota: 'A minutos de la terminal de Ferromex Monterrey.' },
    { id: 'kenworth-mexicali', tipo: 'planta', nombre: 'Kenworth Mexicali (PACCAR)', empresa: 'PACCAR', estado: 'Baja California', ciudad: 'Mexicali', lat: 32.6260, lng: -115.4270, marcas: 'Kenworth (tractocamiones)', capacidad: 'Vehículo pesado', nota: 'Pegada a la frontera, lejos de los puertos de autos.' },

    // ---------------- PUERTOS DE AUTOS ----------------
    { id: 'pto-lazaro', tipo: 'puerto', exporta: true, importa: true, nombre: 'Puerto Lázaro Cárdenas', empresa: 'ASIPONA Lázaro Cárdenas', estado: 'Michoacán', ciudad: 'Lázaro Cárdenas', lat: 17.9560, lng: -102.1770, marcas: 'Mazda, Honda, Toyota, KIA', capacidad: 'Terminal especializada de autos', nota: 'Puerta del Bajío hacia Asia y Sudamérica. Importa vehículos asiáticos: el regreso puede ir cargado.' },
    { id: 'pto-veracruz', tipo: 'puerto', exporta: true, importa: true, nombre: 'Puerto de Veracruz', empresa: 'ASIPONA Veracruz', estado: 'Veracruz', ciudad: 'Veracruz', lat: 19.2020, lng: -96.1300, marcas: 'VW, Audi, Stellantis, GM', capacidad: 'Principal terminal de autos del país', nota: 'Salida a Europa y Sudamérica. Alta congestión en temporada alta.' },
    { id: 'pto-mazatlan', tipo: 'puerto', exporta: true, importa: true, nombre: 'Puerto de Mazatlán', empresa: 'ASIPONA Mazatlán', estado: 'Sinaloa', ciudad: 'Mazatlán', lat: 23.1880, lng: -106.4200, marcas: 'Importación asiática, exportación noroeste', capacidad: 'Terminal multipropósito', nota: 'El puerto de autos más cercano al noroeste del país.' },
    { id: 'pto-manzanillo', tipo: 'puerto', exporta: true, importa: true, nombre: 'Puerto de Manzanillo', empresa: 'ASIPONA Manzanillo', estado: 'Colima', ciudad: 'Manzanillo', lat: 19.0640, lng: -104.3140, marcas: 'Importación y exportación mixta', capacidad: 'Puerto más movido del Pacífico', nota: 'Fuerte en importación de vehículos asiáticos.' },
    { id: 'pto-altamira', tipo: 'puerto', exporta: true, importa: false, nombre: 'Puerto de Altamira', empresa: 'ASIPONA Altamira', estado: 'Tamaulipas', ciudad: 'Altamira', lat: 22.4750, lng: -97.8750, marcas: 'BMW, KIA, Nissan', capacidad: 'Terminal de vehículos y carga general', nota: 'Solo exportación: el regreso sale en vacío.' },

    // ---------------- EXPORTACIÓN TERRESTRE POR TREN ----------------
    { id: 'tren-fxe-mty', tipo: 'tren', aproximada: true, nombre: 'Ferromex Monterrey (Terminal Intermodal)', empresa: 'Ferromex / GMXT', estado: 'Nuevo León', ciudad: 'Gral. Escobedo', lat: 25.7900, lng: -100.3350, marcas: 'Monterrey - Eagle Pass - EE.UU.', capacidad: 'Dos vías de 1,000 m, ~200 movimientos/día', nota: 'Autopista Periférico Monterrey 4101, C.P. 66060. Ruta Monterrey-Chicago con Union Pacific.' },
    { id: 'tren-fxe-silao', tipo: 'tren', aproximada: true, nombre: 'Ferromex Silao-Bajío (Guanajuato Puerto Interior)', empresa: 'Ferromex / GMXT', estado: 'Guanajuato', ciudad: 'Silao', lat: 20.9790, lng: -101.4430, marcas: 'Armadoras del Bajío', capacidad: 'Terminal intermodal', nota: 'Conecta el clúster automotriz del Bajío con la frontera por tren.' },
    { id: 'tren-fxe-pantaco', tipo: 'tren', aproximada: true, nombre: 'Ferromex Pantaco (Ciudad de México)', empresa: 'Ferromex / GMXT', estado: 'Ciudad de México', ciudad: 'Azcapotzalco', lat: 19.4800, lng: -99.1650, marcas: 'Valle de México', capacidad: 'Terminal intermodal', nota: 'Salida ferroviaria del centro del país hacia la frontera norte.' },

    // ---------------- CIUDADES GRANDES (VIAJES DOMÉSTICOS NISSAN) ----------------
    { id: 'cd-cdmx', tipo: 'ciudad', nombre: 'Ciudad de México', estado: 'Ciudad de México', ciudad: 'Ciudad de México', lat: 19.4326, lng: -99.1332, nota: 'Mayor mercado de autos nuevos del país.' },
    { id: 'cd-gdl', tipo: 'ciudad', nombre: 'Guadalajara', estado: 'Jalisco', ciudad: 'Guadalajara', lat: 20.6597, lng: -103.3496, nota: 'Segundo mercado del país.' },
    { id: 'cd-mty', tipo: 'ciudad', nombre: 'Monterrey', estado: 'Nuevo León', ciudad: 'Monterrey', lat: 25.6866, lng: -100.3161, nota: 'Tercer mercado del país.' },
    { id: 'cd-puebla', tipo: 'ciudad', nombre: 'Puebla', estado: 'Puebla', ciudad: 'Puebla', lat: 19.0414, lng: -98.2063, nota: 'Mercado regional del centro-oriente.' },
    { id: 'cd-toluca', tipo: 'ciudad', nombre: 'Toluca', estado: 'Estado de México', ciudad: 'Toluca', lat: 19.2826, lng: -99.6557, nota: 'Rodeada de armadoras: retorno cargado muy probable.' },
    { id: 'cd-tijuana', tipo: 'ciudad', nombre: 'Tijuana', estado: 'Baja California', ciudad: 'Tijuana', lat: 32.5149, lng: -117.0382, nota: 'El viaje doméstico más largo de la red.' },
    { id: 'cd-leon', tipo: 'ciudad', nombre: 'León', estado: 'Guanajuato', ciudad: 'León', lat: 21.1250, lng: -101.6860, nota: 'Bajío: a un paso de Nissan Aguascalientes.' },
    { id: 'cd-qro', tipo: 'ciudad', nombre: 'Querétaro', estado: 'Querétaro', ciudad: 'Querétaro', lat: 20.5888, lng: -100.3899, nota: 'Mercado en crecimiento del Bajío.' },
    { id: 'cd-juarez', tipo: 'ciudad', nombre: 'Ciudad Juárez', estado: 'Chihuahua', ciudad: 'Ciudad Juárez', lat: 31.6904, lng: -106.4245, nota: 'Frontera norte, lejos de cualquier punto de carga.' },
    { id: 'cd-merida', tipo: 'ciudad', nombre: 'Mérida', estado: 'Yucatán', ciudad: 'Mérida', lat: 20.9674, lng: -89.5926, nota: 'Sureste: regreso largo en vacío.' },
    { id: 'cd-cancun', tipo: 'ciudad', nombre: 'Cancún', estado: 'Quintana Roo', ciudad: 'Cancún', lat: 21.1619, lng: -86.8515, nota: 'Sureste: el regreso en vacío más largo del Golfo.' },
    { id: 'cd-hermosillo', tipo: 'ciudad', nombre: 'Hermosillo', estado: 'Sonora', ciudad: 'Hermosillo', lat: 29.0729, lng: -110.9559, nota: 'Tiene la planta Ford a pocos kilómetros.' },
    { id: 'cd-chihuahua', tipo: 'ciudad', nombre: 'Chihuahua', estado: 'Chihuahua', ciudad: 'Chihuahua', lat: 28.6320, lng: -106.0691, nota: 'Norte del país.' },
    { id: 'cd-culiacan', tipo: 'ciudad', nombre: 'Culiacán', estado: 'Sinaloa', ciudad: 'Culiacán', lat: 24.8091, lng: -107.3940, nota: 'Cerca del puerto de Mazatlán (importación).' },
    { id: 'cd-slp', tipo: 'ciudad', nombre: 'San Luis Potosí', estado: 'San Luis Potosí', ciudad: 'San Luis Potosí', lat: 22.1565, lng: -100.9855, nota: 'Con GM y BMW en la misma zona.' }
];

const COLOR = {
    planta: '#334155',
    exporta: '#16a34a',
    importa: '#2563eb',
    tren: '#7c3aed',
    ciudad: '#eab308',
    vacio: '#dc2626',
    domestico: '#ca8a04'
};

// ---------------- ESTADO DEL MÓDULO ----------------
let netMap = null;
let netMarkers = {};
let fixedLayers = [];
let selectedNodeId = null;
const addressCache = {};

// Límites de México: la red se queda fija sobre el país.
const MEXICO_BOUNDS = [[14.3, -118.6], [32.9, -86.4]];

// ---------------- CLASIFICACIÓN ----------------
// Punto de carga: donde una madrina puede subir vehículos.
const esCarga = n => n.tipo === 'planta' || (n.tipo === 'puerto' && n.importa);
// Salida de exportación: puerto que exporta o terminal ferroviaria.
const esSalidaExport = n => (n.tipo === 'puerto' && n.exporta) || n.tipo === 'tren';
// Punto de descarga: donde la madrina queda vacía después de entregar.
const esDescarga = n => esSalidaExport(n) || n.tipo === 'ciudad';

function tipoLabel(n) {
    if (n.tipo === 'planta') return n.nissan ? 'Armadora Nissan' : 'Armadora';
    if (n.tipo === 'puerto') {
        if (n.exporta && n.importa) return 'Puerto de exportación e importación';
        return n.exporta ? 'Puerto de exportación' : 'Puerto de importación';
    }
    if (n.tipo === 'tren') return 'Exportación terrestre por tren';
    return 'Ciudad · viajes domésticos Nissan';
}

function tipoChip(n) {
    if (n.tipo === 'planta') return 'bg-slate-100 text-slate-700 border-slate-300';
    if (n.tipo === 'puerto') return n.importa ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200';
    if (n.tipo === 'tren') return 'bg-violet-50 text-violet-700 border-violet-200';
    return 'bg-yellow-50 text-yellow-800 border-yellow-300';
}

function iconoNodo(n) {
    return { planta: 'fa-industry', puerto: 'fa-anchor', tren: 'fa-train', ciudad: 'fa-city' }[n.tipo];
}

function fondoNodo(n) {
    if (n.tipo === 'planta') return COLOR.planta;
    if (n.tipo === 'tren') return COLOR.tren;
    if (n.tipo === 'ciudad') return COLOR.ciudad;
    if (n.exporta && n.importa) return `linear-gradient(90deg, ${COLOR.exporta} 50%, ${COLOR.importa} 50%)`;
    return n.exporta ? COLOR.exporta : COLOR.importa;
}

function markerHtml(n, size = 26) {
    const borde = n.nissan ? `3px solid ${COLOR.ciudad}` : '2px solid #fff';
    const colorIcono = n.tipo === 'ciudad' ? '#422006' : '#fff';
    return `<div style="background:${fondoNodo(n)};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${colorIcono};font-size:${Math.round(size * 0.42)}px;box-shadow:0 2px 8px rgba(15,23,42,.45);border:${borde}">
        <i class="fas ${iconoNodo(n)}"></i>
    </div>`;
}

// ---------------- CÁLCULOS ----------------
// Factor de corrección de línea recta a kilómetros carreteros reales.
const ROAD_FACTOR = 1.27;

// Más allá de esto no es un corredor de exportación realista en madrina:
// las plantas pegadas a la frontera (Tijuana, Mexicali) exportan cruzando
// directo a EE.UU., algo que no forma parte de esta red.
const MAX_KM_EXPORT = 1200;

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

function cercanos(origen, filtro, limit = 3) {
    const p = getCostParams();
    return NETWORK_NODES
        .filter(n => n.id !== origen.id && filtro(n))
        .map(n => {
            const km = roadKm(origen, n);
            return { node: n, km, costo: tripCost(km, p) };
        })
        .sort((a, b) => a.km - b.km)
        .slice(0, limit);
}

// Recorrido en vacío: desde un punto de descarga hasta el punto de carga
// más cercano. Si el punto de descarga también es punto de carga (puerto
// que importa), la madrina regresa cargada y no hay tramo en vacío.
function tramoVacio(n) {
    if (!esDescarga(n) || esCarga(n)) return null;
    return cercanos(n, esCarga, 1)[0] || null;
}

// Viaje doméstico: cada ciudad la abastece la planta Nissan más cercana.
function plantaNissanPara(ciudad) {
    return cercanos(ciudad, n => n.tipo === 'planta' && n.nissan, 1)[0] || null;
}

// Triangulación de una exportación planta -> salida.
function triangulationFor(planta, salida) {
    const p = getCostParams();
    const kmRegresoVacio = roadKm(salida, planta);

    if (esCarga(salida)) {
        // El mismo puerto importa: se regresa cargado, cero kilómetros en vacío.
        return {
            mismo_punto: true,
            carga_en: salida,
            km_regreso_vacio: kmRegresoVacio,
            km_hasta_carga: 0,
            ahorro_km: kmRegresoVacio,
            ahorro_mxn: tripCost(kmRegresoVacio, p)
        };
    }

    const mejor = cercanos(salida, n => esCarga(n) && n.id !== planta.id, 1)[0];
    if (!mejor) return null;

    const ahorroKm = kmRegresoVacio - mejor.km;
    if (ahorroKm <= 20) return null;

    return {
        mismo_punto: false,
        carga_en: mejor.node,
        km_regreso_vacio: kmRegresoVacio,
        km_hasta_carga: mejor.km,
        ahorro_km: ahorroKm,
        ahorro_mxn: tripCost(ahorroKm, p)
    };
}

function computeOpportunities(limit = 10) {
    const p = getCostParams();
    const out = [];

    NETWORK_NODES.filter(n => n.tipo === 'planta').forEach(planta => {
        const salidas = cercanos(planta, esSalidaExport, 2);
        if (!salidas.length || salidas[0].km > MAX_KM_EXPORT) return;
        const mejor = salidas[0];
        const tri = triangulationFor(planta, mejor.node);

        out.push({
            planta_id: planta.id,
            planta: planta.nombre,
            estado: planta.estado,
            salida_optima: mejor.node.nombre,
            salida_tipo: tipoLabel(mejor.node),
            km_optimo: Math.round(mejor.km),
            costo_optimo: Math.round(mejor.costo),
            alternativa: salidas[1]?.node.nombre || null,
            sobrecosto_alternativa: salidas[1] ? Math.round(salidas[1].costo - mejor.costo) : null,
            triangulacion: tri ? {
                cargar_en: tri.carga_en.nombre,
                mismo_punto: tri.mismo_punto,
                km_evitados: Math.round(tri.ahorro_km),
                ahorro_mxn: Math.round(tri.ahorro_mxn)
            } : null,
            ahorro_estimado: Math.round(tri ? tri.ahorro_mxn : 0)
        });
    });

    const vacios = NETWORK_NODES
        .map(n => ({ n, v: tramoVacio(n) }))
        .filter(x => x.v)
        .map(x => ({ desde: x.n.nombre, hacia: x.v.node.nombre, km_vacio: Math.round(x.v.km), costo: Math.round(x.v.costo) }))
        .sort((a, b) => b.km_vacio - a.km_vacio);

    return {
        parametros: { km_por_litro: p.kpl, precio_diesel_litro: p.diesel, casetas_por_km: p.tollPerKm, factor_carretero: ROAD_FACTOR },
        oportunidades: out.sort((a, b) => b.ahorro_estimado - a.ahorro_estimado).slice(0, limit),
        recorridos_en_vacio: vacios.slice(0, limit)
    };
}

// ================================================================
// RENDER
// ================================================================
export function renderLogisticsNetwork(container) {
    const conteo = t => NETWORK_NODES.filter(n => n.tipo === t).length;

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

            <!-- PANEL IZQUIERDO: LISTADO -->
            <div class="w-full lg:w-[320px] bg-white border border-slate-300 rounded-xl shadow-xl flex flex-col overflow-hidden shrink-0 max-h-[45vh] lg:max-h-full">
                <div class="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 class="text-sm font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                        <i class="fas fa-diagram-project text-indigo-600"></i> Nodos de la red
                    </h3>
                    <p class="text-[10px] text-slate-500 font-bold mt-1">
                        ${conteo('planta')} armadoras · ${conteo('puerto')} puertos · ${conteo('tren')} terminales de tren · ${conteo('ciudad')} ciudades
                    </p>
                    <div class="relative mt-3">
                        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input id="rl-search" type="text" placeholder="Buscar planta, puerto, ciudad o estado..."
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

            <!-- MAPA (RED FIJA) -->
            <div class="flex-1 relative bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden min-h-[320px]">
                <div id="rl-map-canvas" class="w-full h-full z-0"></div>

                <div class="absolute bottom-4 left-4 z-[500] bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg p-3 space-y-1.5 max-w-[250px]">
                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Leyenda</p>
                    ${leyendaPunto(`background:${COLOR.exporta}`, 'Puerto de exportación')}
                    ${leyendaPunto(`background:${COLOR.importa}`, 'Puerto de importación')}
                    ${leyendaPunto(`background:linear-gradient(90deg, ${COLOR.exporta} 50%, ${COLOR.importa} 50%)`, 'Exporta e importa')}
                    ${leyendaPunto(`background:${COLOR.tren}`, 'Exportación terrestre por tren')}
                    ${leyendaPunto(`background:${COLOR.planta}`, 'Armadora')}
                    ${leyendaPunto(`background:${COLOR.planta};box-shadow:0 0 0 2px ${COLOR.ciudad}`, 'Armadora Nissan')}
                    ${leyendaPunto(`background:${COLOR.ciudad}`, 'Ciudad grande (viaje doméstico)')}
                    <div class="pt-1.5 mt-1.5 border-t border-slate-200 space-y-1.5">
                        ${leyendaLinea(`border-top:2px solid ${COLOR.domestico}`, 'Viaje doméstico desde Nissan')}
                        ${leyendaLinea(`border-top:2px dashed ${COLOR.vacio}`, 'Vacío al punto de carga más cercano')}
                    </div>
                </div>

                <button id="rl-reset-view" class="absolute top-4 right-4 z-[500] bg-white border border-slate-300 rounded-lg shadow-lg px-3 py-2 text-[10px] font-black uppercase tracking-tighter text-slate-600 hover:bg-slate-50 transition-all">
                    <i class="fas fa-crosshairs mr-1 text-indigo-600"></i> Centrar México
                </button>
            </div>

            <!-- PANEL DERECHO: DETALLE + IA -->
            <div class="w-full lg:w-[380px] flex flex-col gap-2 shrink-0 overflow-hidden max-h-[50vh] lg:max-h-full">

                <div id="rl-detail" class="bg-white border border-slate-300 rounded-xl shadow-xl overflow-y-auto custom-scrollbar flex-1 min-h-[180px]">
                    <div class="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                        <i class="fas fa-map-location-dot text-4xl mb-3 text-slate-300"></i>
                        <p class="text-xs font-black uppercase tracking-tighter">Ubicación exacta</p>
                        <p class="text-[11px] font-medium mt-1">Haz clic en cualquier punto del mapa o de la lista para ver su ubicación exacta, su recorrido en vacío y sus viajes.</p>
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

function leyendaPunto(estilo, texto) {
    return `<div class="flex items-center gap-2 text-[10px] font-bold text-slate-700">
        <span class="w-3 h-3 rounded-full shrink-0" style="${estilo}"></span> ${texto}
    </div>`;
}

function leyendaLinea(estilo, texto) {
    return `<div class="flex items-center gap-2 text-[10px] font-bold text-slate-700">
        <span class="w-5 shrink-0" style="${estilo}"></span> ${texto}
    </div>`;
}

// ---------------- MAPA ----------------
function initNetworkMap() {
    netMap = L.map('rl-map-canvas', {
        zoomControl: true,
        maxBounds: L.latLngBounds(MEXICO_BOUNDS).pad(0.15),
        maxBoundsViscosity: 1.0,
        minZoom: 4
    });
    netMap.fitBounds(MEXICO_BOUNDS);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(netMap);

    drawFixedNetwork();

    NETWORK_NODES.forEach(node => {
        const size = node.tipo === 'ciudad' ? 22 : 26;
        const icon = L.divIcon({
            className: '',
            html: markerHtml(node, size),
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            popupAnchor: [0, -size / 2]
        });

        const marker = L.marker([node.lat, node.lng], { icon, title: node.nombre })
            .addTo(netMap)
            .bindPopup(`<div style="min-width:180px">
                <b>${node.nombre}</b><br>
                <span style="font-weight:700;font-size:11px">${tipoLabel(node)}</span><br>
                <span style="font-size:11px">${node.ciudad}, ${node.estado}</span><br>
                <span style="font-size:10px;color:#64748b">${node.lat.toFixed(5)}, ${node.lng.toFixed(5)}</span>
            </div>`);

        marker.on('click', () => selectNode(node.id));
        netMarkers[node.id] = marker;
    });

    // Leaflet necesita recalcular el tamaño cuando el contenedor se monta dinámicamente.
    setTimeout(() => {
        netMap.invalidateSize();
        netMap.fitBounds(MEXICO_BOUNDS);
    }, 250);
}

// Dibuja todas las líneas de la red. No depende de ninguna selección.
function drawFixedNetwork() {
    fixedLayers.forEach(l => netMap.removeLayer(l));
    fixedLayers = [];

    // Viajes domésticos: cada ciudad desde su planta Nissan más cercana.
    NETWORK_NODES.filter(n => n.tipo === 'ciudad').forEach(ciudad => {
        const origen = plantaNissanPara(ciudad);
        if (!origen) return;
        const linea = L.polyline([[origen.node.lat, origen.node.lng], [ciudad.lat, ciudad.lng]], {
            color: COLOR.domestico,
            weight: 2,
            opacity: 0.75
        }).addTo(netMap);
        linea.bindTooltip(`Doméstico: ${origen.node.nombre} → ${ciudad.nombre} · ${Math.round(origen.km)} km · ${money(origen.costo)}`, { sticky: true });
        fixedLayers.push(linea);
    });

    // Vacíos: de cada punto de descarga al punto de carga más cercano.
    NETWORK_NODES.forEach(n => {
        const v = tramoVacio(n);
        if (!v) return;
        const linea = L.polyline([[n.lat, n.lng], [v.node.lat, v.node.lng]], {
            color: COLOR.vacio,
            weight: 2.5,
            opacity: 0.85,
            dashArray: '6, 6'
        }).addTo(netMap);
        linea.bindTooltip(`Vacío: ${n.nombre} → ${v.node.nombre} · ${Math.round(v.km)} km · ${money(v.costo)}`, { sticky: true });
        fixedLayers.push(linea);
    });
}

// ---------------- LISTADO ----------------
const ORDEN_TIPO = { puerto: 0, tren: 1, planta: 2, ciudad: 3 };

function renderNodeList() {
    const list = document.getElementById('rl-node-list');
    if (!list) return;

    const term = (document.getElementById('rl-search')?.value || '').toLowerCase().trim();

    const visibles = NETWORK_NODES
        .filter(n => !term || [n.nombre, n.empresa, n.estado, n.ciudad, n.marcas, tipoLabel(n)].join(' ').toLowerCase().includes(term))
        .sort((a, b) => ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo]);

    if (!visibles.length) {
        list.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs font-black uppercase tracking-tighter">Sin resultados</div>`;
        return;
    }

    list.innerHTML = visibles.map(n => `
        <button class="rl-node-item w-full text-left px-4 py-3 hover:bg-slate-50 transition-all ${n.id === selectedNodeId ? 'bg-indigo-50' : ''}" data-id="${n.id}">
            <div class="flex items-start gap-3">
                <span class="shrink-0">${markerHtml(n, 26)}</span>
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-black text-slate-800 truncate">${n.nombre}</p>
                    <p class="text-[10px] text-slate-500 font-bold truncate">${tipoLabel(n)}</p>
                    <p class="text-[10px] text-slate-400 font-medium truncate">${n.ciudad}, ${n.estado}</p>
                </div>
            </div>
        </button>
    `).join('');

    list.querySelectorAll('.rl-node-item').forEach(btn => {
        btn.addEventListener('click', () => selectNode(btn.dataset.id));
    });
}

// ---------------- DETALLE DEL NODO ----------------
// La red es fija: seleccionar un punto no mueve el mapa ni cambia las
// líneas, solo muestra su ficha.
function selectNode(id) {
    const node = getNode(id);
    if (!node) return;

    selectedNodeId = id;
    renderNodeList();
    renderNodeDetail(node);
    netMarkers[id]?.openPopup();
}

function tarjetaTramo(titulo, colorBorde, desde, hasta, km, costo, extra = '') {
    return `
        <div class="border rounded-xl p-3" style="border-color:${colorBorde}">
            <p class="text-[9px] font-black uppercase tracking-widest mb-1" style="color:${colorBorde}">${titulo}</p>
            <p class="text-[11px] font-bold text-slate-800">${desde} → ${hasta}</p>
            <div class="flex items-center justify-between mt-2">
                <span class="text-[10px] font-bold text-slate-500">${Math.round(km)} km</span>
                <span class="text-xs font-black text-slate-900">${money(costo)}</span>
            </div>
            ${extra}
        </div>`;
}

function botonRutaIA(origen, destino) {
    return `<button class="rl-route-ai mt-2 w-full py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-tighter hover:bg-indigo-50 transition-all"
        data-origen="${origen.nombre}, ${origen.ciudad}, ${origen.estado}"
        data-destino="${destino.nombre}, ${destino.ciudad}, ${destino.estado}">
        <i class="fas fa-diamond-turn-right mr-1"></i> Trazar ruta con IA
    </button>`;
}

function renderNodeDetail(node) {
    const panel = document.getElementById('rl-detail');
    if (!panel) return;

    const coords = `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`;
    const vacio = tramoVacio(node);
    let secciones = '';

    if (node.tipo === 'planta') {
        const salidas = cercanos(node, esSalidaExport, 3);
        const lejana = salidas[0] && salidas[0].km > MAX_KM_EXPORT;
        const tri = salidas[0] && !lejana ? triangulationFor(node, salidas[0].node) : null;

        if (lejana) {
            secciones += `
                <div class="bg-amber-50 border border-amber-300 rounded-xl p-3">
                    <p class="text-[11px] text-slate-700 font-medium leading-relaxed">
                        <i class="fas fa-triangle-exclamation text-amber-600 mr-1"></i>
                        La salida de exportación más cercana de la red está a <b>${Math.round(salidas[0].km)} km</b>.
                        Esta planta exporta cruzando directo la frontera, que no forma parte de esta red.
                    </p>
                </div>`;
        }

        secciones += `
            <div>
                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    <i class="fas fa-route mr-1 text-green-600"></i> Salidas de exportación más económicas
                </p>
                <div class="space-y-2">
                    ${salidas.map((c, i) => tarjetaTramo(
                        `${i === 0 ? '★ ' : ''}${tipoLabel(c.node)}`,
                        c.node.tipo === 'tren' ? COLOR.tren : COLOR.exporta,
                        node.nombre, c.node.nombre, c.km, c.costo,
                        botonRutaIA(node, c.node)
                    )).join('')}
                </div>
            </div>`;

        if (tri) {
            secciones += `
                <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p class="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-2">
                        <i class="fas fa-arrows-spin mr-1"></i> Regreso sugerido
                    </p>
                    <p class="text-[11px] text-slate-700 font-medium leading-relaxed">
                        ${tri.mismo_punto
                            ? `<b>${salidas[0].node.nombre}</b> también importa: carga ahí vehículos importados y regresa <b>sin kilómetros en vacío</b> (evitas ${Math.round(tri.km_regreso_vacio)} km).`
                            : `Tras descargar en <b>${salidas[0].node.nombre}</b>, en lugar de regresar vacío (${Math.round(tri.km_regreso_vacio)} km) carga en <b>${tri.carga_en.nombre}</b>, a ${Math.round(tri.km_hasta_carga)} km.`}
                    </p>
                    <div class="flex items-center justify-between mt-3 pt-2 border-t border-emerald-200">
                        <span class="text-[9px] font-black text-emerald-700 uppercase tracking-tighter">Ahorro estimado por vuelta</span>
                        <span class="text-sm font-black text-emerald-700">${money(tri.ahorro_mxn)}</span>
                    </div>
                </div>`;
        }

        if (node.nissan) {
            const ciudades = NETWORK_NODES
                .filter(n => n.tipo === 'ciudad' && plantaNissanPara(n)?.node.id === node.id)
                .map(c => ({ c, km: roadKm(node, c) }))
                .sort((a, b) => a.km - b.km);

            secciones += `
                <div class="bg-yellow-50 border border-yellow-300 rounded-xl p-3">
                    <p class="text-[9px] font-black text-yellow-800 uppercase tracking-widest mb-2">
                        <i class="fas fa-city mr-1"></i> Viajes domésticos que salen de aquí
                    </p>
                    ${ciudades.length
                        ? ciudades.map(({ c, km }) => `
                            <div class="flex justify-between text-[11px] py-0.5">
                                <span class="font-bold text-slate-700">${c.nombre}</span>
                                <span class="font-black text-slate-900">${Math.round(km)} km · ${money(tripCost(km))}</span>
                            </div>`).join('')
                        : '<p class="text-[11px] text-slate-500">Las ciudades las abastece otra planta Nissan más cercana.</p>'}
                </div>`;
        }
    }

    if (node.tipo === 'puerto') {
        secciones += `
            <div class="flex gap-2">
                <span class="flex-1 text-center px-2 py-2 rounded-lg text-[10px] font-black uppercase ${node.exporta ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}">
                    <i class="fas fa-ship mr-1"></i> ${node.exporta ? 'Exporta' : 'No exporta'}
                </span>
                <span class="flex-1 text-center px-2 py-2 rounded-lg text-[10px] font-black uppercase ${node.importa ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}">
                    <i class="fas fa-anchor mr-1"></i> ${node.importa ? 'Importa' : 'No importa'}
                </span>
            </div>`;
    }

    if (node.tipo === 'ciudad') {
        const origen = plantaNissanPara(node);
        if (origen) {
            secciones += tarjetaTramo('Viaje doméstico Nissan', COLOR.domestico,
                origen.node.nombre, node.nombre, origen.km, origen.costo, botonRutaIA(origen.node, node));
        }
    }

    // Recorrido en vacío (puertos, tren y ciudades).
    if (node.tipo !== 'planta') {
        if (vacio) {
            secciones += tarjetaTramo('Recorrido en vacío al punto de carga más cercano', COLOR.vacio,
                node.nombre, vacio.node.nombre, vacio.km, vacio.costo,
                `<p class="text-[10px] text-slate-500 mt-2">${tipoLabel(vacio.node)} · ahí se puede volver a cargar.</p>`);
        } else if (esCarga(node)) {
            secciones += `
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p class="text-[11px] text-slate-700 font-medium leading-relaxed">
                        <i class="fas fa-circle-check text-blue-600 mr-1"></i>
                        Este puerto importa: después de entregar exportación, la madrina <b>regresa cargada</b> con vehículos importados. Sin tramo en vacío.
                    </p>
                </div>`;
        }

        const plantas = cercanos(node, n => n.tipo === 'planta', 3);
        secciones += `
            <div>
                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    <i class="fas fa-industry mr-1 text-slate-600"></i> Armadoras más cercanas
                </p>
                ${plantas.map(c => `
                    <div class="flex justify-between text-[11px] py-1 border-b border-slate-100">
                        <span class="font-bold text-slate-700 truncate pr-2">${c.node.nombre}</span>
                        <span class="font-black text-slate-900 shrink-0">${Math.round(c.km)} km</span>
                    </div>`).join('')}
            </div>`;
    }

    panel.innerHTML = `
        <div class="p-4 space-y-4">
            <div class="flex items-start gap-3">
                <span class="shrink-0">${markerHtml(node, 40)}</span>
                <div class="min-w-0">
                    <p class="text-sm font-black text-slate-900 leading-tight">${node.nombre}</p>
                    <span class="inline-block mt-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-tighter ${tipoChip(node)}">${tipoLabel(node)}</span>
                </div>
            </div>

            ${node.tipo !== 'ciudad' ? `
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                ${filaDato('Operador', node.empresa)}
                ${filaDato('Ubicación', `${node.ciudad}, ${node.estado}`)}
                ${filaDato(node.tipo === 'planta' ? 'Modelos' : 'Flujo', node.marcas)}
                ${filaDato('Capacidad', node.capacidad)}
            </div>` : ''}

            <div class="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3">
                <p class="text-[9px] font-black text-indigo-700 uppercase tracking-widest mb-2">
                    <i class="fas fa-location-crosshairs mr-1"></i> Ubicación exacta
                </p>
                <p class="font-mono text-xs text-slate-800 font-bold">${coords}</p>
                ${node.aproximada ? '<p class="text-[10px] text-amber-700 font-bold mt-1"><i class="fas fa-triangle-exclamation mr-1"></i>Coordenada de referencia: verificar en sitio.</p>' : ''}
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

            ${secciones}

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

function filaDato(etiqueta, valor) {
    return `<div class="flex justify-between gap-3 text-[11px]">
        <span class="text-slate-500 font-bold uppercase tracking-tighter">${etiqueta}</span>
        <span class="text-slate-800 font-black text-right">${valor || '—'}</span>
    </div>`;
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
                    <i class="fas fa-arrow-right-long mr-1 text-green-600"></i>${o.salida_optima} · ${o.km_optimo} km · ${money(o.costo_optimo)}
                </p>
                ${o.triangulacion
                    ? `<p class="text-[10px] text-emerald-700 font-bold mt-1"><i class="fas fa-arrows-spin mr-1"></i>${
                        o.triangulacion.mismo_punto
                            ? `Regreso cargado con importación (${o.triangulacion.km_evitados} km vacíos evitados)`
                            : `Retorno: cargar en ${o.triangulacion.cargar_en} (${o.triangulacion.km_evitados} km vacíos evitados)`
                    }</p>`
                    : ''}
            </button>
        `).join('')}
    `;

    box.querySelectorAll('.rl-opp').forEach(btn => {
        btn.addEventListener('click', () => selectNode(btn.dataset.id));
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
            tipo: tipoLabel(focus),
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
    document.getElementById('rl-search')?.addEventListener('input', renderNodeList);

    document.querySelectorAll('.rl-param').forEach(input => {
        input.addEventListener('change', () => {
            drawFixedNetwork();
            renderOpportunities();
            if (selectedNodeId) renderNodeDetail(getNode(selectedNodeId));
        });
    });

    document.getElementById('rl-reset-view')?.addEventListener('click', () => {
        netMap.closePopup();
        netMap.fitBounds(MEXICO_BOUNDS);
    });

    document.getElementById('rl-ai-btn')?.addEventListener('click', runNetworkAI);
}
