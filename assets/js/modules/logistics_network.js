import { getLogisticsNetworkSuggestionsAI } from '../services/gemini.js';

// ================================================================
// RED LOGÍSTICA ALEXA TRANSPORTES
//
// La red se ve desde el patio de San Mateo Atenco: de ahí salen las
// líneas cian hacia los puertos, las terminales de tren y las plantas
// de los clientes actuales.
//
// Puntos de carga ("los grandes"): armadoras, los 5 puertos y las
// terminales de tren. Con contenedores en el portafolio, cualquier
// puerto o terminal intermodal es un lugar donde volver a cargar.
//
// Destinos domésticos (amarillo): ciudades donde una unidad termina
// su viaje, venga de donde venga. La línea roja va de cada destino al
// punto de carga más cercano: son los kilómetros en vacío. Si pasan
// del umbral, el destino es un PUNTO MUERTO: ahí se pierde dinero y
// es donde conviene buscar carga de regreso.
//
// Hay dos vistas: la normal dentro del panel y el Modo TV, a pantalla
// completa, pensado para dejarlo fijo en una pantalla.
// ================================================================

const PATIO = {
    id: 'patio-alexa', tipo: 'patio', nombre: 'Patio Alexa Transportes',
    empresa: 'Autotransporte y Logística Especializada XA', estado: 'Estado de México',
    ciudad: 'San Mateo Atenco', lat: 19.2736, lng: -99.5361,
    marcas: 'Nodrizas · Pipas grado alimenticio y jaulas · Contenedores',
    capacidad: 'Flota 100% propia',
    nota: 'Base de operaciones: Av. Rancho Don Pepe 300, Col. Francisco I. Madero, C.P. 52106.'
};

const NETWORK_NODES = [
    PATIO,

    // ---------------- ARMADORAS ----------------
    { id: 'gm-silao', tipo: 'planta', nombre: 'GM Complejo Silao', empresa: 'General Motors', estado: 'Guanajuato', ciudad: 'Silao', lat: 20.9010, lng: -101.4360, marcas: 'Silverado, Sierra, Cheyenne', capacidad: '~430,000 u/año', nota: 'Nodo pesado del Bajío.' },
    { id: 'gm-ramos', tipo: 'planta', nombre: 'GM Ramos Arizpe', empresa: 'General Motors', estado: 'Coahuila', ciudad: 'Ramos Arizpe', lat: 25.5470, lng: -100.9930, marcas: 'Blazer EV, Equinox EV', capacidad: '~250,000 u/año', nota: 'Complejo con motores y estampado.' },
    { id: 'gm-slp', tipo: 'planta', nombre: 'GM San Luis Potosí', empresa: 'General Motors', estado: 'San Luis Potosí', ciudad: 'San Luis Potosí', lat: 22.0290, lng: -100.9080, marcas: 'Equinox, Trax', capacidad: '~200,000 u/año', nota: 'Sobre el corredor MEX-57.' },
    { id: 'gm-toluca', tipo: 'planta', nombre: 'GM Complejo Toluca', empresa: 'General Motors', estado: 'Estado de México', ciudad: 'Toluca', lat: 19.2740, lng: -99.6420, marcas: 'Motores y componentes', capacidad: 'Componentes', nota: 'Genera flujo de partes, no de unidades terminadas.' },
    { id: 'ford-hermosillo', tipo: 'planta', nombre: 'Ford Hermosillo', empresa: 'Ford Motor Company', estado: 'Sonora', ciudad: 'Hermosillo', lat: 29.0180, lng: -110.8890, marcas: 'Bronco Sport, Maverick', capacidad: '~300,000 u/año', nota: 'El único punto de carga grande del noroeste.' },
    { id: 'ford-cuautitlan', tipo: 'planta', nombre: 'Ford Cuautitlán', empresa: 'Ford Motor Company', estado: 'Estado de México', ciudad: 'Cuautitlán Izcalli', lat: 19.6740, lng: -99.2050, marcas: 'Mustang Mach-E', capacidad: '~180,000 u/año', nota: 'Zona metropolitana: restricciones de horario y doble remolque.' },
    { id: 'stellantis-toluca', tipo: 'planta', cliente: 'Stellantis', nombre: 'Stellantis Toluca', empresa: 'Stellantis', estado: 'Estado de México', ciudad: 'Toluca', lat: 19.2810, lng: -99.6360, marcas: 'Jeep Compass, Hornet', capacidad: '~250,000 u/año', nota: 'Cliente actual, a minutos del patio.' },
    { id: 'stellantis-van', tipo: 'planta', cliente: 'Stellantis', nombre: 'Stellantis Saltillo Van (Derramadero)', empresa: 'Stellantis', estado: 'Coahuila', ciudad: 'Derramadero, Saltillo', lat: 25.2340, lng: -101.1490, marcas: 'Ram ProMaster', capacidad: '~150,000 u/año', nota: 'Cliente actual.' },
    { id: 'stellantis-truck', tipo: 'planta', cliente: 'Stellantis', nombre: 'Stellantis Saltillo Truck', empresa: 'Stellantis', estado: 'Coahuila', ciudad: 'Saltillo', lat: 25.4290, lng: -100.9370, marcas: 'Ram 1500 / 2500 / 3500', capacidad: '~450,000 u/año', nota: 'Cliente actual.' },
    { id: 'nissan-a1', tipo: 'planta', nombre: 'Nissan Aguascalientes A1', empresa: 'Nissan', estado: 'Aguascalientes', ciudad: 'Aguascalientes', lat: 21.8240, lng: -102.2610, marcas: 'Versa, March, Kicks', capacidad: '~450,000 u/año', nota: 'Gran generador de viajes domésticos.' },
    { id: 'nissan-a2', tipo: 'planta', nombre: 'Nissan Aguascalientes A2', empresa: 'Nissan', estado: 'Aguascalientes', ciudad: 'Aguascalientes', lat: 21.9550, lng: -102.2170, marcas: 'Sentra', capacidad: '~175,000 u/año', nota: 'Alta exportación a EE.UU. y Canadá.' },
    { id: 'compas-ags', tipo: 'planta', nombre: 'Planta COMPAS Aguascalientes', empresa: 'Nissan (ex COMPAS)', estado: 'Aguascalientes', ciudad: 'Aguascalientes', lat: 21.9860, lng: -102.1210, marcas: 'Infiniti QX50 / QX55', capacidad: '~100,000 u/año', nota: 'Premium: conviene madrina cerrada.' },
    { id: 'nissan-civac', tipo: 'planta', nombre: 'Nissan CIVAC', empresa: 'Nissan', estado: 'Morelos', ciudad: 'Jiutepec', lat: 18.8890, lng: -99.1710, marcas: 'NP300 Frontier', capacidad: '~150,000 u/año', nota: 'Punto de carga más cercano para Guerrero.' },
    { id: 'vw-puebla', tipo: 'planta', nombre: 'Volkswagen Puebla', empresa: 'Volkswagen', estado: 'Puebla', ciudad: 'Puebla', lat: 19.1600, lng: -98.2320, marcas: 'Jetta, Tiguan, Taos', capacidad: '~400,000 u/año', nota: 'Principal usuario del puerto de Veracruz.' },
    { id: 'audi-chiapa', tipo: 'planta', nombre: 'Audi San José Chiapa', empresa: 'Audi México', estado: 'Puebla', ciudad: 'San José Chiapa', lat: 19.2810, lng: -97.7010, marcas: 'Audi Q5', capacidad: '~150,000 u/año', nota: 'Premium: exporta casi todo vía Veracruz.' },
    { id: 'toyota-gto', tipo: 'planta', nombre: 'Toyota Guanajuato', empresa: 'Toyota', estado: 'Guanajuato', ciudad: 'Apaseo el Grande', lat: 20.5390, lng: -100.6690, marcas: 'Tacoma', capacidad: '~130,000 u/año', nota: 'Exportación mayoritaria a EE.UU.' },
    { id: 'toyota-tij', tipo: 'planta', nombre: 'Toyota Baja California', empresa: 'Toyota', estado: 'Baja California', ciudad: 'Tijuana', lat: 32.4560, lng: -116.8480, marcas: 'Cajas Tacoma', capacidad: '~100,000 u/año', nota: 'Pegada a la frontera.' },
    { id: 'honda-celaya', tipo: 'planta', nombre: 'Honda Celaya', empresa: 'Honda', estado: 'Guanajuato', ciudad: 'Celaya', lat: 20.4610, lng: -100.8790, marcas: 'HR-V', capacidad: '~200,000 u/año', nota: 'Bajío.' },
    { id: 'mazda-salamanca', tipo: 'planta', nombre: 'Mazda Salamanca', empresa: 'Mazda', estado: 'Guanajuato', ciudad: 'Salamanca', lat: 20.5450, lng: -101.1600, marcas: 'Mazda2, Mazda3, CX-30', capacidad: '~250,000 u/año', nota: 'Exporta por Lázaro Cárdenas.' },
    { id: 'kia-pesqueria', tipo: 'planta', cliente: 'Hyundai Glovis / Kia', nombre: 'KIA Pesquería', empresa: 'KIA', estado: 'Nuevo León', ciudad: 'Pesquería', lat: 25.7590, lng: -100.0630, marcas: 'Forte, K3, Rio', capacidad: '~400,000 u/año', nota: 'Cliente actual vía Hyundai Glovis (Kia Motors México).' },
    { id: 'bmw-slp', tipo: 'planta', nombre: 'BMW San Luis Potosí', empresa: 'BMW Group', estado: 'San Luis Potosí', ciudad: 'Villa de Reyes', lat: 21.8330, lng: -100.9440, marcas: 'Serie 3, M2', capacidad: '~175,000 u/año', nota: 'Premium: requiere unidad cerrada.' },
    { id: 'jac-sahagun', tipo: 'planta', nombre: 'Giant Motors / JAC Ciudad Sahagún', empresa: 'Giant Motors', estado: 'Hidalgo', ciudad: 'Ciudad Sahagún', lat: 19.7710, lng: -98.5820, marcas: 'JAC (SUV y pick-ups)', capacidad: '~40,000 u/año', nota: 'Mercado nacional.' },
    { id: 'daimler-saltillo', tipo: 'planta', nombre: 'Daimler Truck Santiago (Saltillo)', empresa: 'Daimler Truck México', estado: 'Coahuila', ciudad: 'Saltillo', lat: 25.4150, lng: -100.9800, marcas: 'Freightliner (tractocamiones)', capacidad: 'Vehículo pesado', nota: 'Requiere plataforma.' },
    { id: 'navistar-escobedo', tipo: 'planta', nombre: 'Navistar Escobedo', empresa: 'International', estado: 'Nuevo León', ciudad: 'Gral. Escobedo', lat: 25.7970, lng: -100.3200, marcas: 'International (camiones)', capacidad: 'Vehículo pesado', nota: 'Junto a la terminal de Ferromex Monterrey.' },
    { id: 'kenworth-mexicali', tipo: 'planta', nombre: 'Kenworth Mexicali (PACCAR)', empresa: 'PACCAR', estado: 'Baja California', ciudad: 'Mexicali', lat: 32.6260, lng: -115.4270, marcas: 'Kenworth (tractocamiones)', capacidad: 'Vehículo pesado', nota: 'Pegada a la frontera.' },

    // ---------------- PUERTOS ----------------
    { id: 'pto-lazaro', tipo: 'puerto', exporta: true, importa: true, nombre: 'Puerto Lázaro Cárdenas', empresa: 'ASIPONA Lázaro Cárdenas', estado: 'Michoacán', ciudad: 'Lázaro Cárdenas', lat: 17.9560, lng: -102.1770, marcas: 'Autos de exportación e importación · contenedores', capacidad: 'Terminal especializada de autos', nota: 'Entrada de marcas asiáticas: aquí cargan importación clientes como BYD, Changan y Geely.' },
    { id: 'pto-veracruz', tipo: 'puerto', exporta: true, importa: true, nombre: 'Puerto de Veracruz', empresa: 'ASIPONA Veracruz', estado: 'Veracruz', ciudad: 'Veracruz', lat: 19.2020, lng: -96.1300, marcas: 'Autos de exportación e importación · contenedores', capacidad: 'Principal terminal de autos del país', nota: 'El punto de carga más cercano para todo el sureste.' },
    { id: 'pto-mazatlan', tipo: 'puerto', exporta: true, importa: true, nombre: 'Puerto de Mazatlán', empresa: 'ASIPONA Mazatlán', estado: 'Sinaloa', ciudad: 'Mazatlán', lat: 23.1880, lng: -106.4200, marcas: 'Importación Hyundai/Kia · exportación noroeste', capacidad: 'Terminal multipropósito', nota: 'Origen de los viajes de Hyundai Glovis hacia el Bajío y Michoacán.' },
    { id: 'pto-manzanillo', tipo: 'puerto', exporta: true, importa: true, nombre: 'Puerto de Manzanillo', empresa: 'ASIPONA Manzanillo', estado: 'Colima', ciudad: 'Manzanillo', lat: 19.0640, lng: -104.3140, marcas: 'Autos de importación · contenedores', capacidad: 'Puerto más movido del Pacífico', nota: 'Fuerte en importación asiática y en contenedores.' },
    { id: 'pto-altamira', tipo: 'puerto', exporta: true, importa: false, nombre: 'Puerto de Altamira', empresa: 'ASIPONA Altamira', estado: 'Tamaulipas', ciudad: 'Altamira', lat: 22.4750, lng: -97.8750, marcas: 'Autos de exportación · contenedores', capacidad: 'Terminal de vehículos y carga general', nota: 'En autos solo exporta: el regreso se llena con contenedores.' },

    // ---------------- TREN ----------------
    { id: 'tren-fxe-mty', tipo: 'tren', aproximada: true, nombre: 'Ferromex Monterrey (Terminal Intermodal)', empresa: 'Ferromex / GMXT', estado: 'Nuevo León', ciudad: 'Gral. Escobedo', lat: 25.7900, lng: -100.3350, marcas: 'Exportación por tren · contenedores intermodales', capacidad: '~200 movimientos/día', nota: 'Autopista Periférico Monterrey 4101, C.P. 66060.' },
    { id: 'tren-fxe-silao', tipo: 'tren', aproximada: true, nombre: 'Ferromex Silao-Bajío (Guanajuato Puerto Interior)', empresa: 'Ferromex / GMXT', estado: 'Guanajuato', ciudad: 'Silao', lat: 20.9790, lng: -101.4430, marcas: 'Exportación por tren · contenedores intermodales', capacidad: 'Terminal intermodal', nota: 'Salida ferroviaria del clúster del Bajío.' },
    { id: 'tren-fxe-pantaco', tipo: 'tren', aproximada: true, nombre: 'Ferromex Pantaco (Ciudad de México)', empresa: 'Ferromex / GMXT', estado: 'Ciudad de México', ciudad: 'Azcapotzalco', lat: 19.4800, lng: -99.1650, marcas: 'Exportación por tren · contenedores intermodales', capacidad: 'Terminal intermodal', nota: 'Salida ferroviaria del Valle de México.' },

    // ---------------- DESTINOS DOMÉSTICOS ----------------
    { id: 'cd-cdmx', tipo: 'ciudad', nombre: 'Ciudad de México', estado: 'Ciudad de México', ciudad: 'Ciudad de México', lat: 19.4326, lng: -99.1332 },
    { id: 'cd-gdl', tipo: 'ciudad', nombre: 'Guadalajara', estado: 'Jalisco', ciudad: 'Guadalajara', lat: 20.6597, lng: -103.3496 },
    { id: 'cd-mty', tipo: 'ciudad', nombre: 'Monterrey', estado: 'Nuevo León', ciudad: 'Monterrey', lat: 25.6866, lng: -100.3161 },
    { id: 'cd-puebla', tipo: 'ciudad', nombre: 'Puebla', estado: 'Puebla', ciudad: 'Puebla', lat: 19.0414, lng: -98.2063 },
    { id: 'cd-toluca', tipo: 'ciudad', nombre: 'Toluca', estado: 'Estado de México', ciudad: 'Toluca', lat: 19.2826, lng: -99.6557 },
    { id: 'cd-tijuana', tipo: 'ciudad', nombre: 'Tijuana', estado: 'Baja California', ciudad: 'Tijuana', lat: 32.5149, lng: -117.0382 },
    { id: 'cd-mexicali', tipo: 'ciudad', nombre: 'Mexicali', estado: 'Baja California', ciudad: 'Mexicali', lat: 32.6245, lng: -115.4523 },
    { id: 'cd-leon', tipo: 'ciudad', nombre: 'León', estado: 'Guanajuato', ciudad: 'León', lat: 21.1250, lng: -101.6860 },
    { id: 'cd-qro', tipo: 'ciudad', nombre: 'Querétaro', estado: 'Querétaro', ciudad: 'Querétaro', lat: 20.5888, lng: -100.3899 },
    { id: 'cd-slp', tipo: 'ciudad', nombre: 'San Luis Potosí', estado: 'San Luis Potosí', ciudad: 'San Luis Potosí', lat: 22.1565, lng: -100.9855 },
    { id: 'cd-morelia', tipo: 'ciudad', nombre: 'Morelia', estado: 'Michoacán', ciudad: 'Morelia', lat: 19.7060, lng: -101.1950 },
    { id: 'cd-juarez', tipo: 'ciudad', nombre: 'Ciudad Juárez', estado: 'Chihuahua', ciudad: 'Ciudad Juárez', lat: 31.6904, lng: -106.4245 },
    { id: 'cd-chihuahua', tipo: 'ciudad', nombre: 'Chihuahua', estado: 'Chihuahua', ciudad: 'Chihuahua', lat: 28.6320, lng: -106.0691 },
    { id: 'cd-hermosillo', tipo: 'ciudad', nombre: 'Hermosillo', estado: 'Sonora', ciudad: 'Hermosillo', lat: 29.0729, lng: -110.9559 },
    { id: 'cd-culiacan', tipo: 'ciudad', nombre: 'Culiacán', estado: 'Sinaloa', ciudad: 'Culiacán', lat: 24.8091, lng: -107.3940 },
    { id: 'cd-durango', tipo: 'ciudad', nombre: 'Durango', estado: 'Durango', ciudad: 'Durango', lat: 24.0277, lng: -104.6532 },
    { id: 'cd-torreon', tipo: 'ciudad', nombre: 'Torreón', estado: 'Coahuila', ciudad: 'Torreón', lat: 25.5428, lng: -103.4068 },
    { id: 'cd-nlaredo', tipo: 'ciudad', nombre: 'Nuevo Laredo', estado: 'Tamaulipas', ciudad: 'Nuevo Laredo', lat: 27.4769, lng: -99.5160 },
    { id: 'cd-acapulco', tipo: 'ciudad', nombre: 'Acapulco', estado: 'Guerrero', ciudad: 'Acapulco', lat: 16.8531, lng: -99.8237 },
    { id: 'cd-oaxaca', tipo: 'ciudad', nombre: 'Oaxaca', estado: 'Oaxaca', ciudad: 'Oaxaca', lat: 17.0732, lng: -96.7266 },
    { id: 'cd-villahermosa', tipo: 'ciudad', nombre: 'Villahermosa', estado: 'Tabasco', ciudad: 'Villahermosa', lat: 17.9892, lng: -92.9475 },
    { id: 'cd-tuxtla', tipo: 'ciudad', nombre: 'Tuxtla Gutiérrez', estado: 'Chiapas', ciudad: 'Tuxtla Gutiérrez', lat: 16.7528, lng: -93.1152 },
    { id: 'cd-merida', tipo: 'ciudad', nombre: 'Mérida', estado: 'Yucatán', ciudad: 'Mérida', lat: 20.9674, lng: -89.5926 },
    { id: 'cd-cancun', tipo: 'ciudad', nombre: 'Cancún', estado: 'Quintana Roo', ciudad: 'Cancún', lat: 21.1619, lng: -86.8515 },
    { id: 'cd-chetumal', tipo: 'ciudad', nombre: 'Chetumal', estado: 'Quintana Roo', ciudad: 'Chetumal', lat: 18.5001, lng: -88.2961 }
];

const COLOR = {
    patio: '#22d3ee',
    planta: '#334155',
    exporta: '#16a34a',
    importa: '#2563eb',
    tren: '#7c3aed',
    ciudad: '#eab308',
    vacio: '#dc2626'
};

const LINEAS_NEGOCIO = [
    'Nodrizas: vehículos nuevos y seminuevos, 8 a 12 por unidad',
    'Pipas grado alimenticio de 10,000 a 35,000 L (limpieza Kosher) y jaulas',
    "Contenedores 20', 40' y 40' HC, plataformas, planas y góndolas"
];
const CLIENTES = ['Stellantis', 'Hyundai Glovis (Hyundai/Kia)', 'Changan', 'BYD', 'Geely'];
const SECTORES_PIPAS = ['lácteos', 'aceites y derivados', 'agroindustrial y agroquímico', 'química y farmacéutica'];

// Límites de México: la red se queda fija sobre el país.
const MEXICO_BOUNDS = [[14.3, -118.6], [32.9, -86.4]];

// Factor de corrección de línea recta a kilómetros carreteros reales.
const ROAD_FACTOR = 1.27;
// Debajo de esto el destino está prácticamente junto a un punto de carga.
const KM_ZONA_PRODUCTIVA = 150;
// Más allá de esto no es un corredor de exportación realista en madrina.
const MAX_KM_EXPORT = 1200;

// ---------------- ESTADO DEL MÓDULO ----------------
let netMap = null;
let netRefs = null;
let selectedNodeId = null;
const addressCache = {};

let tv = null; // { map, refs, timers: [], indice }

// ---------------- CLASIFICACIÓN ----------------
// Punto de carga ("uno de los grandes"): donde una unidad vuelve a cargar.
const esCarga = n => n.tipo === 'planta' || n.tipo === 'puerto' || n.tipo === 'tren';
// Salida de exportación de autos: puerto que exporta o terminal de tren.
const esSalidaExport = n => (n.tipo === 'puerto' && n.exporta) || n.tipo === 'tren';
// Destinos conectados al patio con línea cian: nuestra red actual.
const esRedPropia = n => n.tipo === 'puerto' || n.tipo === 'tren' || Boolean(n.cliente);

function tipoLabel(n) {
    if (n.tipo === 'patio') return 'Patio y base de operaciones';
    if (n.tipo === 'planta') return n.cliente ? `Armadora · cliente ${n.cliente}` : 'Armadora';
    if (n.tipo === 'puerto') {
        if (n.exporta && n.importa) return 'Puerto de exportación e importación';
        return n.exporta ? 'Puerto de exportación' : 'Puerto de importación';
    }
    if (n.tipo === 'tren') return 'Exportación terrestre por tren';
    return 'Destino doméstico';
}

function tipoChip(n) {
    if (n.tipo === 'patio') return 'bg-cyan-50 text-cyan-800 border-cyan-300';
    if (n.tipo === 'planta') return n.cliente ? 'bg-cyan-50 text-cyan-800 border-cyan-300' : 'bg-slate-100 text-slate-700 border-slate-300';
    if (n.tipo === 'puerto') return n.importa ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200';
    if (n.tipo === 'tren') return 'bg-violet-50 text-violet-700 border-violet-200';
    return 'bg-yellow-50 text-yellow-800 border-yellow-300';
}

function iconoNodo(n) {
    return { patio: 'fa-warehouse', planta: 'fa-industry', puerto: 'fa-anchor', tren: 'fa-train', ciudad: 'fa-city' }[n.tipo];
}

function fondoNodo(n) {
    if (n.tipo === 'patio') return COLOR.patio;
    if (n.tipo === 'planta') return COLOR.planta;
    if (n.tipo === 'tren') return COLOR.tren;
    if (n.tipo === 'ciudad') return COLOR.ciudad;
    if (n.exporta && n.importa) return `linear-gradient(90deg, ${COLOR.exporta} 50%, ${COLOR.importa} 50%)`;
    return n.exporta ? COLOR.exporta : COLOR.importa;
}

function markerHtml(n, size = 26) {
    const muerto = n.tipo === 'ciudad' && severidad(tramoVacio(n)?.km || 0).nivel === 'muerto';
    const borde = n.cliente ? `3px solid ${COLOR.patio}` : '2px solid #fff';
    const colorIcono = (n.tipo === 'ciudad' || n.tipo === 'patio') ? '#0f172a' : '#fff';
    const pulso = n.tipo === 'patio'
        ? `<span class="rl-pulse" style="color:${COLOR.patio}"></span>`
        : muerto ? `<span class="rl-pulse" style="color:${COLOR.vacio}"></span>` : '';
    return `<div class="rl-mk" style="position:relative;width:${size}px;height:${size}px">
        ${pulso}
        <div style="position:relative;background:${fondoNodo(n)};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${colorIcono};font-size:${Math.round(size * 0.42)}px;box-shadow:0 2px 8px rgba(15,23,42,.45);border:${borde}">
            <i class="fas ${iconoNodo(n)}"></i>
        </div>
    </div>`;
}

// ---------------- CÁLCULOS ----------------
function getCostParams() {
    const val = (id, def) => {
        const v = parseFloat(document.getElementById(id)?.value);
        return (isNaN(v) || v <= 0) ? def : v;
    };
    return {
        kpl: val('rl-kpl', 2.5),
        diesel: val('rl-diesel', 24.5),
        tollPerKm: val('rl-toll', 3.2),
        umbral: val('rl-umbral', 400)
    };
}

function haversineKm(a, b) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
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

function km(n) {
    return Math.round(n).toLocaleString('es-MX') + ' km';
}

function getNode(id) {
    return NETWORK_NODES.find(n => n.id === id);
}

function cercanos(origen, filtro, limit = 3) {
    const p = getCostParams();
    return NETWORK_NODES
        .filter(n => n.id !== origen.id && filtro(n))
        .map(n => {
            const d = roadKm(origen, n);
            return { node: n, km: d, costo: tripCost(d, p) };
        })
        .sort((a, b) => a.km - b.km)
        .slice(0, limit);
}

// Kilómetros en vacío: de un destino al punto de carga más cercano.
function tramoVacio(n) {
    if (n.tipo !== 'ciudad') return null;
    return cercanos(n, esCarga, 1)[0] || null;
}

function severidad(kmVacio) {
    const { umbral } = getCostParams();
    if (kmVacio > umbral) return { nivel: 'muerto', label: 'Punto muerto', peso: 4.5, opacidad: 0.95 };
    if (kmVacio > KM_ZONA_PRODUCTIVA) return { nivel: 'medio', label: 'Vacío medio', peso: 2.5, opacidad: 0.7 };
    return { nivel: 'productivo', label: 'Zona productiva', peso: 1.5, opacidad: 0.45 };
}

function analisisDestinos() {
    return NETWORK_NODES
        .filter(n => n.tipo === 'ciudad')
        .map(ciudad => {
            const v = tramoVacio(ciudad);
            const patioKm = roadKm(PATIO, ciudad);
            return {
                ciudad,
                hub: v.node,
                km: v.km,
                costo: v.costo,
                sev: severidad(v.km),
                patioKm,
                patioCosto: tripCost(patioKm)
            };
        })
        .sort((a, b) => b.km - a.km);
}

function oportunidad(d) {
    if (d.sev.nivel === 'muerto') {
        return `Buscar carga de regreso en ${d.ciudad.estado} con pipas grado alimenticio o contenedores para no regresar ${km(d.km)} vacíos, o cotizar el vacío dentro de la tarifa (${money(d.costo)} por viaje).`;
    }
    if (d.sev.nivel === 'medio') {
        return `Reposicionar a ${d.hub.nombre} (${km(d.km)}) o amarrar una carga de pipas o contenedores en la zona para el regreso.`;
    }
    return `Zona productiva: ${d.hub.nombre} queda a ${km(d.km)} para volver a cargar.`;
}

function kpis() {
    const destinos = analisisDestinos();
    return {
        destinos,
        muertos: destinos.filter(d => d.sev.nivel === 'muerto'),
        kmVacio: destinos.reduce((s, d) => s + d.km, 0),
        costoVacio: destinos.reduce((s, d) => s + d.costo, 0),
        nodos: NETWORK_NODES.length
    };
}

// ---------------- ESTILOS (compartidos por la vista normal y la TV) ----------------
function asegurarEstilos() {
    if (document.getElementById('rl-styles')) return;
    const style = document.createElement('style');
    style.id = 'rl-styles';
    style.textContent = `
        .rl-flow-red { stroke-dasharray: 6 10; animation: rl-flow 1.8s linear infinite; }
        .rl-flow-vacio { stroke-dasharray: 10 6; animation: rl-flow 1.1s linear infinite; }
        @keyframes rl-flow { to { stroke-dashoffset: -32; } }
        .rl-pulse { position:absolute; inset:-9px; border-radius:50%; border:3px solid currentColor; animation: rl-pulse 2s ease-out infinite; pointer-events:none; }
        @keyframes rl-pulse { 0% { transform: scale(.55); opacity: .95; } 100% { transform: scale(1.7); opacity: 0; } }
        .rl-mk { transition: transform .5s ease; }
        .rl-spot .rl-mk { transform: scale(1.9); }
        .rl-tv-dark .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(.82) contrast(.92) saturate(.55); }
        .rl-tv-dark { background: #0b1220; }
        .rl-tv-label { background: rgba(15,23,42,.88); color: #e2e8f0; border: 1px solid #334155; border-radius: 6px; font-weight: 800; font-size: 12px; letter-spacing: .04em; box-shadow: none; padding: 2px 8px; }
        .rl-tv-label::before { display: none; }
        .rl-tv-progress { animation: rl-progress linear forwards; }
        @keyframes rl-progress { from { width: 0%; } to { width: 100%; } }
        @media (prefers-reduced-motion: reduce) {
            .rl-flow-red, .rl-flow-vacio, .rl-pulse, .rl-tv-progress { animation: none; }
        }
        /* La IA devuelve su propio HTML con clases de Tailwind: se normaliza para el panel. */
        #rl-ai-html, #rl-ai-html * { font-size: 11px !important; line-height: 1.5 !important; }
        #rl-ai-html h1, #rl-ai-html h2, #rl-ai-html h3, #rl-ai-html h4 { font-size: 12px !important; margin: 0 0 4px; }
        #rl-ai-html ul { list-style: disc; padding-left: 16px; }
        #rl-ai-html [class*="grid-cols"] { grid-template-columns: 1fr !important; }
        #rl-ai-html .flex { flex-wrap: wrap !important; }
    `;
    document.head.appendChild(style);
}

// ---------------- CONSTRUCCIÓN DE LA RED SOBRE UN MAPA ----------------
// Dibuja la red completa (fija) sobre cualquier mapa: la vista normal y
// el Modo TV usan exactamente la misma red.
function construirRed(map, { escala = 1, onClick = null } = {}) {
    const refs = { markers: {}, vacios: {}, capas: [] };
    const p = getCostParams();

    // Nuestra red: del patio a puertos, tren y clientes actuales.
    NETWORK_NODES.filter(esRedPropia).forEach(n => {
        const d = roadKm(PATIO, n);
        const linea = L.polyline([[PATIO.lat, PATIO.lng], [n.lat, n.lng]], {
            color: COLOR.patio,
            weight: 1.6 * escala,
            opacity: 0.7,
            className: 'rl-flow-red'
        }).addTo(map);
        linea.bindTooltip(`Patio → ${n.nombre} · ${km(d)} · ${money(tripCost(d, p))}`, { sticky: true });
        refs.capas.push(linea);
    });

    // Vacíos: de cada destino al punto de carga más cercano.
    analisisDestinos().forEach(d => {
        const linea = L.polyline([[d.ciudad.lat, d.ciudad.lng], [d.hub.lat, d.hub.lng]], {
            color: COLOR.vacio,
            weight: d.sev.peso * escala,
            opacity: d.sev.opacidad,
            className: 'rl-flow-vacio'
        }).addTo(map);
        linea.bindTooltip(`${d.sev.label}: ${d.ciudad.nombre} → ${d.hub.nombre} · ${km(d.km)} vacíos · ${money(d.costo)}`, { sticky: true });
        refs.vacios[d.ciudad.id] = { linea, peso: d.sev.peso * escala };
        refs.capas.push(linea);
    });

    NETWORK_NODES.forEach(node => {
        const base = node.tipo === 'patio' ? 32 : node.tipo === 'ciudad' ? 22 : 26;
        const size = Math.round(base * escala);
        const icon = L.divIcon({
            className: '',
            html: markerHtml(node, size),
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            popupAnchor: [0, -size / 2]
        });

        const marker = L.marker([node.lat, node.lng], {
            icon,
            title: node.nombre,
            zIndexOffset: node.tipo === 'patio' ? 1000 : 0
        }).addTo(map);

        if (onClick) {
            marker.bindPopup(`<div style="min-width:180px">
                <b>${node.nombre}</b><br>
                <span style="font-weight:700;font-size:11px">${tipoLabel(node)}</span><br>
                <span style="font-size:11px">${node.ciudad}, ${node.estado}</span><br>
                <span style="font-size:10px;color:#64748b">${node.lat.toFixed(5)}, ${node.lng.toFixed(5)}</span>
            </div>`);
            marker.on('click', () => onClick(node.id));
        } else {
            marker.bindTooltip(node.nombre, { direction: 'top', offset: [0, -size / 2] });
        }

        refs.markers[node.id] = marker;
    });

    return refs;
}

function leyendaHtml(oscura = false) {
    const txt = oscura ? 'text-slate-200' : 'text-slate-700';
    const punto = (estilo, texto) => `<div class="flex items-center gap-2 text-[10px] font-bold ${txt}">
        <span class="w-3 h-3 rounded-full shrink-0" style="${estilo}"></span> ${texto}</div>`;
    const linea = (estilo, texto) => `<div class="flex items-center gap-2 text-[10px] font-bold ${txt}">
        <span class="w-5 shrink-0" style="${estilo}"></span> ${texto}</div>`;

    return `
        ${punto(`background:${COLOR.patio}`, 'Patio Alexa')}
        ${punto(`background:${COLOR.exporta}`, 'Puerto de exportación')}
        ${punto(`background:${COLOR.importa}`, 'Puerto de importación')}
        ${punto(`background:linear-gradient(90deg, ${COLOR.exporta} 50%, ${COLOR.importa} 50%)`, 'Exporta e importa')}
        ${punto(`background:${COLOR.tren}`, 'Exportación por tren')}
        ${punto(`background:${COLOR.planta}`, 'Armadora')}
        ${punto(`background:${COLOR.planta};box-shadow:0 0 0 2px ${COLOR.patio}`, 'Armadora cliente')}
        ${punto(`background:${COLOR.ciudad}`, 'Destino doméstico')}
        ${punto(`background:${COLOR.ciudad};box-shadow:0 0 0 3px ${COLOR.vacio}`, 'Punto muerto')}
        <div class="col-span-2 pt-1.5 mt-1.5 border-t ${oscura ? 'border-slate-700' : 'border-slate-200'} space-y-1.5">
            ${linea(`border-top:2px dashed ${COLOR.patio}`, 'Nuestra red desde el patio')}
            ${linea(`border-top:3px dashed ${COLOR.vacio}`, 'Vacío al punto de carga más cercano')}
        </div>`;
}

// ================================================================
// VISTA NORMAL
// ================================================================
export function renderLogisticsNetwork(container) {
    asegurarEstilos();
    const conteo = t => NETWORK_NODES.filter(n => n.tipo === t).length;

    container.innerHTML = `
        <div class="h-full flex flex-col lg:flex-row bg-slate-100 p-2 gap-2 fade-in font-sans text-[13px] text-slate-900 overflow-hidden">

            <!-- PANEL IZQUIERDO -->
            <div class="w-full lg:w-[320px] bg-white border border-slate-300 rounded-xl shadow-xl flex flex-col overflow-hidden shrink-0 max-h-[45vh] lg:max-h-full">
                <div class="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 class="text-sm font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                        <i class="fas fa-diagram-project text-indigo-600"></i> Nodos de la red
                    </h3>
                    <p class="text-[10px] text-slate-500 font-bold mt-1">
                        ${conteo('planta')} armadoras · ${conteo('puerto')} puertos · ${conteo('tren')} terminales de tren · ${conteo('ciudad')} destinos
                    </p>
                    <div class="relative mt-3">
                        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input id="rl-search" type="text" placeholder="Buscar planta, puerto, ciudad o estado..."
                            class="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm">
                    </div>
                </div>

                <div id="rl-node-list" class="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100"></div>

                <div class="p-3 border-t border-slate-200 bg-slate-50 grid grid-cols-2 gap-2">
                    ${parametro('rl-kpl', 'Diesel Km/L', 2.5, 0.1)}
                    ${parametro('rl-diesel', 'Precio diesel', 24.5, 0.1)}
                    ${parametro('rl-toll', 'Casetas $/km', 3.2, 0.1)}
                    ${parametro('rl-umbral', 'Punto muerto (km)', 400, 25)}
                </div>
            </div>

            <!-- MAPA -->
            <div class="flex-1 relative bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden min-h-[320px]">
                <div id="rl-map-canvas" class="w-full h-full z-0"></div>

                <div class="absolute bottom-4 left-4 z-[500] bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg p-3 space-y-1.5">
                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Leyenda</p>
                    ${leyendaHtml(false)}
                </div>

                <div class="absolute top-4 right-4 z-[500] flex gap-2">
                    <button id="rl-reset-view" class="bg-white border border-slate-300 rounded-lg shadow-lg px-3 py-2 text-[10px] font-black uppercase tracking-tighter text-slate-600 hover:bg-slate-50">
                        <i class="fas fa-crosshairs mr-1 text-indigo-600"></i> Centrar
                    </button>
                    <button id="rl-tv-btn" class="bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-lg px-3 py-2 text-[10px] font-black uppercase tracking-tighter">
                        <i class="fas fa-tv mr-1 text-cyan-400"></i> Modo TV
                    </button>
                </div>
            </div>

            <!-- PANEL DERECHO -->
            <div class="w-full lg:w-[380px] flex flex-col gap-2 shrink-0 overflow-hidden max-h-[50vh] lg:max-h-full">
                <div id="rl-detail" class="bg-white border border-slate-300 rounded-xl shadow-xl overflow-y-auto custom-scrollbar flex-1 min-h-[180px]">
                    <div class="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                        <i class="fas fa-map-location-dot text-4xl mb-3 text-slate-300"></i>
                        <p class="text-xs font-black uppercase tracking-tighter">Ubicación exacta</p>
                        <p class="text-[11px] font-medium mt-1">Haz clic en cualquier punto para ver su ubicación exacta, su distancia al patio y sus kilómetros en vacío.</p>
                    </div>
                </div>

                <div class="bg-white border border-slate-300 rounded-xl shadow-xl flex flex-col overflow-hidden flex-1 min-h-[200px]">
                    <div class="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                        <h3 class="text-xs font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                            <i class="fas fa-skull-crossbones text-red-600"></i> Donde perdemos
                        </h3>
                        <button id="rl-ai-btn" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-lg shadow-indigo-200">
                            <i class="fas fa-wand-magic-sparkles mr-1"></i> Oportunidades IA
                        </button>
                    </div>
                    <div id="rl-ai-result" class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2"></div>
                </div>
            </div>
        </div>
    `;

    initNetworkMap();
    renderNodeList();
    renderPuntosMuertos();
    bindNetworkUI();

    if (location.hash === '#tv') abrirModoTV();
}

function parametro(id, etiqueta, valor, paso) {
    return `<div class="text-center">
        <p class="text-[8px] font-black text-slate-500 uppercase tracking-tighter">${etiqueta}</p>
        <input id="${id}" type="number" step="${paso}" value="${valor}" class="rl-param w-full bg-white border border-slate-300 rounded-lg text-center text-xs font-black text-slate-800 py-1 focus:ring-indigo-500 outline-none">
    </div>`;
}

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

    netRefs = construirRed(netMap, { onClick: selectNode });

    setTimeout(() => {
        netMap.invalidateSize();
        netMap.fitBounds(MEXICO_BOUNDS);
    }, 250);
}

function redibujarRed() {
    if (!netMap) return;
    Object.values(netRefs.markers).forEach(m => netMap.removeLayer(m));
    netRefs.capas.forEach(c => netMap.removeLayer(c));
    netRefs = construirRed(netMap, { onClick: selectNode });
}

// ---------------- LISTADO ----------------
const ORDEN_TIPO = { patio: 0, puerto: 1, tren: 2, planta: 3, ciudad: 4 };

function renderNodeList() {
    const list = document.getElementById('rl-node-list');
    if (!list) return;

    const term = (document.getElementById('rl-search')?.value || '').toLowerCase().trim();
    const visibles = NETWORK_NODES
        .filter(n => !term || [n.nombre, n.empresa, n.estado, n.ciudad, n.marcas, n.cliente, tipoLabel(n)].join(' ').toLowerCase().includes(term))
        .sort((a, b) => ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo]);

    if (!visibles.length) {
        list.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs font-black uppercase tracking-tighter">Sin resultados</div>`;
        return;
    }

    list.innerHTML = visibles.map(n => {
        const v = tramoVacio(n);
        const sev = v ? severidad(v.km) : null;
        return `
        <button class="rl-node-item w-full text-left px-4 py-3 hover:bg-slate-50 transition-all ${n.id === selectedNodeId ? 'bg-indigo-50' : ''}" data-id="${n.id}">
            <div class="flex items-start gap-3">
                <span class="shrink-0">${markerHtml(n, 26)}</span>
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-black text-slate-800 truncate">${n.nombre}</p>
                    <p class="text-[10px] text-slate-500 font-bold truncate">${tipoLabel(n)}</p>
                    <p class="text-[10px] font-medium truncate ${sev?.nivel === 'muerto' ? 'text-red-600 font-black' : 'text-slate-400'}">
                        ${sev ? `${sev.label} · ${km(v.km)} en vacío` : `${n.ciudad}, ${n.estado}`}
                    </p>
                </div>
            </div>
        </button>`;
    }).join('');

    list.querySelectorAll('.rl-node-item').forEach(btn => {
        btn.addEventListener('click', () => selectNode(btn.dataset.id));
    });
}

// ---------------- DETALLE ----------------
// La red es fija: seleccionar un punto no mueve el mapa ni cambia las
// líneas, solo muestra su ficha.
function selectNode(id) {
    const node = getNode(id);
    if (!node) return;
    selectedNodeId = id;
    renderNodeList();
    renderNodeDetail(node);
    netRefs?.markers[id]?.openPopup();
}

function tarjetaTramo(titulo, color, desde, hasta, distancia, costo, extra = '') {
    return `
        <div class="border rounded-xl p-3" style="border-color:${color}">
            <p class="text-[9px] font-black uppercase tracking-widest mb-1" style="color:${color}">${titulo}</p>
            <p class="text-[11px] font-bold text-slate-800">${desde} → ${hasta}</p>
            <div class="flex items-center justify-between mt-2">
                <span class="text-[10px] font-bold text-slate-500">${km(distancia)}</span>
                <span class="text-xs font-black text-slate-900">${money(costo)}</span>
            </div>
            ${extra}
        </div>`;
}

function botonRutaIA(origen, destino) {
    return `<button class="rl-route-ai mt-2 w-full py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-tighter hover:bg-indigo-50"
        data-origen="${origen.nombre}, ${origen.ciudad}, ${origen.estado}"
        data-destino="${destino.nombre}, ${destino.ciudad}, ${destino.estado}">
        <i class="fas fa-diamond-turn-right mr-1"></i> Trazar ruta con IA
    </button>`;
}

function filaDato(etiqueta, valor) {
    return `<div class="flex justify-between gap-3 text-[11px]">
        <span class="text-slate-500 font-bold uppercase tracking-tighter">${etiqueta}</span>
        <span class="text-slate-800 font-black text-right">${valor || '—'}</span>
    </div>`;
}

function listaCercanos(titulo, icono, items) {
    return `
        <div>
            <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                <i class="fas ${icono} mr-1"></i> ${titulo}
            </p>
            ${items.map(c => `
                <div class="flex justify-between text-[11px] py-1 border-b border-slate-100">
                    <span class="font-bold text-slate-700 truncate pr-2">${c.node.nombre}</span>
                    <span class="font-black text-slate-900 shrink-0">${km(c.km)}</span>
                </div>`).join('')}
        </div>`;
}

function renderNodeDetail(node) {
    const panel = document.getElementById('rl-detail');
    if (!panel) return;

    const coords = `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`;
    let secciones = '';

    if (node.tipo !== 'patio') {
        const d = roadKm(PATIO, node);
        secciones += tarjetaTramo('Desde nuestro patio', '#0891b2', PATIO.nombre, node.nombre, d, tripCost(d), botonRutaIA(PATIO, node));
    }

    if (node.tipo === 'patio') {
        const red = NETWORK_NODES.filter(esRedPropia).map(n => ({ node: n, km: roadKm(PATIO, n) })).sort((a, b) => a.km - b.km);
        secciones += `
            <div class="bg-cyan-50 border border-cyan-200 rounded-xl p-3 space-y-1">
                <p class="text-[9px] font-black text-cyan-800 uppercase tracking-widest mb-1">Líneas de negocio</p>
                ${LINEAS_NEGOCIO.map(l => `<p class="text-[11px] text-slate-700 font-medium">• ${l}</p>`).join('')}
            </div>
            ${listaCercanos('Nuestra red desde el patio', 'fa-route text-cyan-600', red)}`;
    }

    if (node.tipo === 'ciudad') {
        const dest = analisisDestinos().find(x => x.ciudad.id === node.id);
        const colorSev = dest.sev.nivel === 'muerto' ? '#dc2626' : dest.sev.nivel === 'medio' ? '#d97706' : '#16a34a';
        secciones = `
            <div class="rounded-xl p-3 text-white" style="background:${colorSev}">
                <p class="text-[10px] font-black uppercase tracking-widest">${dest.sev.label}</p>
                <p class="text-lg font-black leading-tight">${km(dest.km)} en vacío · ${money(dest.costo)}</p>
                <p class="text-[11px] font-medium mt-1 opacity-90">Para volver a cargar en ${dest.hub.nombre}</p>
            </div>
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p class="text-[9px] font-black text-amber-800 uppercase tracking-widest mb-1"><i class="fas fa-lightbulb mr-1"></i> Oportunidad</p>
                <p class="text-[11px] text-slate-700 font-medium leading-relaxed">${oportunidad(dest)}</p>
            </div>
            ${secciones}
            ${listaCercanos('Armadoras más cercanas (nodrizas)', 'fa-industry text-slate-600', cercanos(node, n => n.tipo === 'planta', 3))}
            ${listaCercanos('Puertos más cercanos (importación y contenedores)', 'fa-anchor text-blue-600', cercanos(node, n => n.tipo === 'puerto', 2))}
            ${listaCercanos('Terminal de tren más cercana', 'fa-train text-violet-600', cercanos(node, n => n.tipo === 'tren', 1))}`;
    }

    if (node.tipo === 'planta') {
        const salidas = cercanos(node, esSalidaExport, 3);
        const lejana = salidas[0] && salidas[0].km > MAX_KM_EXPORT;
        if (lejana) {
            secciones += `<div class="bg-amber-50 border border-amber-300 rounded-xl p-3 text-[11px] text-slate-700 font-medium">
                <i class="fas fa-triangle-exclamation text-amber-600 mr-1"></i>
                La salida de exportación más cercana está a <b>${km(salidas[0].km)}</b>: esta planta exporta cruzando directo la frontera.
            </div>`;
        } else {
            secciones += `
                <div>
                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                        <i class="fas fa-ship mr-1 text-green-600"></i> Salidas de exportación más cercanas
                    </p>
                    <div class="space-y-2">
                        ${salidas.map(c => tarjetaTramo(tipoLabel(c.node), c.node.tipo === 'tren' ? COLOR.tren : COLOR.exporta,
                            node.nombre, c.node.nombre, c.km, c.costo,
                            `<p class="text-[10px] text-emerald-700 font-bold mt-2"><i class="fas fa-arrows-spin mr-1"></i>Regreso cargado: ${c.node.importa ? 'importación de autos o contenedores' : 'contenedores'}</p>`
                        )).join('')}
                    </div>
                </div>`;
        }
    }

    if (node.tipo === 'puerto' || node.tipo === 'tren') {
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
        secciones += listaCercanos('Armadoras más cercanas', 'fa-industry text-slate-600', cercanos(node, n => n.tipo === 'planta', 3));
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
                ${filaDato(node.tipo === 'planta' ? 'Modelos' : 'Carga', node.marcas)}
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
                       class="flex-1 text-center px-2 py-2 bg-white border border-slate-300 rounded-lg text-[9px] font-black uppercase tracking-tighter text-slate-700 hover:bg-slate-50">
                        <i class="fas fa-map-pin mr-1 text-red-500"></i> Google Maps
                    </a>
                    <button id="rl-copy-coords" data-coords="${coords}"
                       class="flex-1 px-2 py-2 bg-white border border-slate-300 rounded-lg text-[9px] font-black uppercase tracking-tighter text-slate-700 hover:bg-slate-50">
                        <i class="fas fa-copy mr-1 text-indigo-500"></i> Copiar
                    </button>
                </div>
            </div>

            ${secciones}

            ${node.nota ? `
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p class="text-[11px] text-slate-700 font-medium leading-relaxed">
                    <i class="fas fa-circle-info text-slate-500 mr-1"></i> ${node.nota}
                </p>
            </div>` : ''}
        </div>
    `;

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
    copyBtn?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(copyBtn.dataset.coords);
            copyBtn.innerHTML = '<i class="fas fa-check mr-1 text-emerald-500"></i> Copiado';
            setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy mr-1 text-indigo-500"></i> Copiar'; }, 1800);
        } catch (err) {
            console.warn('No se pudo copiar al portapapeles:', err);
        }
    });

    panel.querySelectorAll('.rl-route-ai').forEach(btn => {
        btn.addEventListener('click', () => window.openAIRoute?.(btn.dataset.origen, btn.dataset.destino, 'full'));
    });
}

// ---------------- DONDE PERDEMOS (CÁLCULO LOCAL) ----------------
function renderPuntosMuertos() {
    const box = document.getElementById('rl-ai-result');
    if (!box) return;

    const k = kpis();
    const conVacio = k.destinos.filter(d => d.sev.nivel !== 'productivo');

    box.innerHTML = `
        <div class="grid grid-cols-3 gap-2">
            ${kpiChico('Puntos muertos', k.muertos.length, 'text-red-600')}
            ${kpiChico('Km en vacío', Math.round(k.kmVacio).toLocaleString('es-MX'), 'text-slate-900')}
            ${kpiChico('Costo vacío', money(k.costoVacio), 'text-slate-900')}
        </div>
        <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 pt-1">
            Destinos donde regresamos vacíos (un viaje por destino)
        </p>
        ${conVacio.map(d => `
            <button class="rl-opp w-full text-left border rounded-xl p-3 transition-all hover:shadow ${d.sev.nivel === 'muerto' ? 'border-red-300 bg-red-50/60' : 'border-amber-200 bg-amber-50/40'}" data-id="${d.ciudad.id}">
                <div class="flex items-start justify-between gap-2">
                    <p class="text-[11px] font-black text-slate-800 leading-tight">${d.ciudad.nombre}, ${d.ciudad.estado}</p>
                    <span class="text-[10px] font-black shrink-0 ${d.sev.nivel === 'muerto' ? 'text-red-700' : 'text-amber-700'}">-${money(d.costo)}</span>
                </div>
                <p class="text-[10px] text-slate-500 font-bold mt-1">
                    <i class="fas fa-arrow-right-long mr-1 text-red-500"></i>${km(d.km)} vacíos a ${d.hub.nombre}
                </p>
                <p class="text-[10px] text-slate-600 font-medium mt-1 leading-snug">${oportunidad(d)}</p>
            </button>
        `).join('')}
    `;

    box.querySelectorAll('.rl-opp').forEach(btn => {
        btn.addEventListener('click', () => selectNode(btn.dataset.id));
    });
}

function kpiChico(etiqueta, valor, color) {
    return `<div class="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
        <p class="text-[8px] font-black text-slate-500 uppercase tracking-tighter">${etiqueta}</p>
        <p class="text-sm font-black ${color} mt-0.5">${valor}</p>
    </div>`;
}

// ---------------- OPORTUNIDADES CON IA ----------------
function payloadIA() {
    const p = getCostParams();
    const k = kpis();
    const fmt = d => ({
        destino: d.ciudad.nombre,
        estado: d.ciudad.estado,
        km_vacio: Math.round(d.km),
        costo_vacio_mxn: Math.round(d.costo),
        punto_de_carga_mas_cercano: d.hub.nombre,
        km_desde_patio: Math.round(d.patioKm)
    });
    const payload = {
        empresa: {
            nombre: 'Alexa Transportes',
            patio: 'San Mateo Atenco, Estado de México',
            lineas_de_negocio: LINEAS_NEGOCIO,
            clientes_automotrices: CLIENTES,
            sectores_atendidos_con_pipas: SECTORES_PIPAS
        },
        parametros: { km_por_litro: p.kpl, precio_diesel_litro: p.diesel, casetas_por_km: p.tollPerKm, umbral_punto_muerto_km: p.umbral },
        puntos_muertos: k.muertos.map(fmt),
        vacios_medios: k.destinos.filter(d => d.sev.nivel === 'medio').map(fmt)
    };
    const foco = selectedNodeId ? getNode(selectedNodeId) : null;
    if (foco) payload.nodo_en_foco = { nombre: foco.nombre, tipo: tipoLabel(foco), estado: foco.estado };
    return payload;
}

async function runNetworkAI() {
    const box = document.getElementById('rl-ai-result');
    const btn = document.getElementById('rl-ai-btn');
    if (!box) return;

    box.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center py-10 text-center">
            <div class="spinner mb-3 border-t-indigo-500 w-8 h-8"></div>
            <p class="text-[11px] font-black text-slate-500 uppercase tracking-tighter">Buscando oportunidades de negocio...</p>
        </div>`;
    if (btn) btn.disabled = true;

    try {
        const html = await getLogisticsNetworkSuggestionsAI(payloadIA());
        box.innerHTML = `
            <div class="space-y-3">
                <div id="rl-ai-html" class="text-[11px] leading-relaxed text-slate-700">${html}</div>
                <button id="rl-back-calc" class="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-slate-300">
                    <i class="fas fa-calculator mr-1"></i> Ver cálculo local
                </button>
            </div>`;
        document.getElementById('rl-back-calc')?.addEventListener('click', renderPuntosMuertos);
    } catch (err) {
        console.error('Error en análisis IA de red logística:', err);
        box.innerHTML = `<div class="p-4 bg-red-50 border border-red-200 rounded-xl text-center text-red-600 text-[11px] font-bold">
            <i class="fas fa-exclamation-triangle mr-1"></i> No se pudo completar el análisis con IA.</div>`;
    } finally {
        if (btn) btn.disabled = false;
    }
}

function bindNetworkUI() {
    document.getElementById('rl-search')?.addEventListener('input', renderNodeList);

    document.querySelectorAll('.rl-param').forEach(input => {
        input.addEventListener('change', () => {
            redibujarRed();
            renderNodeList();
            renderPuntosMuertos();
            if (selectedNodeId) renderNodeDetail(getNode(selectedNodeId));
        });
    });

    document.getElementById('rl-reset-view')?.addEventListener('click', () => {
        netMap.closePopup();
        netMap.fitBounds(MEXICO_BOUNDS);
    });

    document.getElementById('rl-tv-btn')?.addEventListener('click', abrirModoTV);
    document.getElementById('rl-ai-btn')?.addEventListener('click', runNetworkAI);
}

// ================================================================
// MODO TV: pantalla completa, red fija, recorrido automático
// ================================================================
const TV_SEGUNDOS_POR_TARJETA = 9;

function abrirModoTV() {
    if (tv) return;

    const overlay = document.createElement('div');
    overlay.id = 'rl-tv';
    // Posición y tamaño van en estilo inline, no en clases de Tailwind: al abrir
    // con #tv desde el arranque, Leaflet se inicializa antes de que Tailwind
    // genere las clases y el mapa quedaba con altura cero.
    overlay.className = 'bg-slate-950 text-white';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;overflow:hidden;';
    overlay.innerHTML = `
        <div id="rl-tv-map" class="rl-tv-dark" style="position:absolute;inset:0;width:100%;height:100%;"></div>

        <div class="absolute top-0 inset-x-0 z-[1000] pointer-events-none bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent px-8 pt-6 pb-16 flex items-start justify-between">
            <div class="flex items-center gap-4">
                <img src="./logo/logo.png" alt="" class="h-14 drop-shadow-[0_0_14px_rgba(34,211,238,.45)]" onerror="this.style.display='none'">
                <div>
                    <p class="text-3xl font-black tracking-tight">RED LOGÍSTICA</p>
                    <p class="text-sm font-bold text-cyan-300 tracking-[0.3em] uppercase">Alexa Transportes · desde nuestro patio</p>
                </div>
                <span class="ml-4 flex items-center gap-2 bg-red-600 px-3 py-1 rounded-md text-xs font-black tracking-widest">
                    <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span> EN VIVO
                </span>
            </div>
            <div class="text-right">
                <p id="rl-tv-clock" class="text-4xl font-bold tracking-widest" style="font-family:'Share Tech Mono',monospace">--:--:--</p>
                <p id="rl-tv-date" class="text-sm font-bold text-slate-400 uppercase tracking-widest"></p>
            </div>
        </div>

        <!-- Los paneles van sobre zonas vacías del mapa: la leyenda y la tarjeta
             sobre el Pacífico, los indicadores sobre el Golfo y Texas. Así no
             tapan ningún nodo, en especial el sureste. -->
        <div id="rl-tv-legend" class="absolute left-6 top-[27%] z-[1000] bg-slate-900/85 backdrop-blur border border-slate-700 rounded-2xl p-3 grid grid-cols-2 gap-x-4 gap-y-1">
            ${leyendaHtml(true)}
        </div>

        <div id="rl-tv-kpis" class="absolute right-6 top-[17%] z-[1000] grid grid-cols-2 gap-3 w-[min(470px,30vw)]"></div>

        <div id="rl-tv-spot" class="absolute bottom-6 left-6 z-[1000] w-[min(620px,36vw)]"></div>

        <button id="rl-tv-exit" class="absolute top-6 left-1/2 -translate-x-1/2 z-[1001] opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity bg-slate-800/90 border border-slate-600 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest">
            <i class="fas fa-xmark mr-2"></i> Salir del Modo TV (Esc)
        </button>
    `;
    document.body.appendChild(overlay);

    const map = L.map('rl-tv-map', {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
        zoomSnap: 0.25
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    tv = { overlay, map, refs: construirRed(map, { escala: 1.35 }), timers: [], indice: 0, spotId: null };

    // Etiquetas fijas para leer el patio y los puertos desde lejos.
    NETWORK_NODES.filter(n => n.tipo === 'patio' || n.tipo === 'puerto').forEach(n => {
        const texto = n.tipo === 'patio' ? 'PATIO ALEXA' : n.nombre.replace(/^Puerto (de )?/, '');
        tv.refs.markers[n.id]
            .unbindTooltip()
            .bindTooltip(texto, { permanent: true, direction: 'right', offset: [16, 0], className: 'rl-tv-label' })
            .openTooltip();
    });

    encuadrarTV();
    pintarKpisTV();
    relojTV();
    tv.timers.push(setInterval(relojTV, 1000));
    rotarSpotlight();
    tv.timers.push(setInterval(rotarSpotlight, TV_SEGUNDOS_POR_TARJETA * 1000));

    window.addEventListener('resize', encuadrarTV);
    document.addEventListener('fullscreenchange', encuadrarTV);
    document.addEventListener('keydown', teclaTV);
    document.getElementById('rl-tv-exit').addEventListener('click', cerrarModoTV);

    // Pantalla completa real si el navegador lo permite (requiere un clic;
    // abriendo con #tv, la TV puede usar F11 o modo kiosco).
    document.documentElement.requestFullscreen?.().catch(() => {});
}

function encuadrarTV() {
    if (!tv) return;
    tv.map.invalidateSize();
    // Solo se reserva la franja del encabezado; los demás paneles flotan
    // sobre mar y territorio de EE.UU., donde no hay nodos.
    tv.map.fitBounds(MEXICO_BOUNDS, { paddingTopLeft: [24, 110], paddingBottomRight: [24, 24] });
}

function teclaTV(e) {
    if (e.key === 'Escape') cerrarModoTV();
}

function cerrarModoTV() {
    if (!tv) return;
    tv.timers.forEach(t => clearInterval(t));
    window.removeEventListener('resize', encuadrarTV);
    document.removeEventListener('fullscreenchange', encuadrarTV);
    document.removeEventListener('keydown', teclaTV);
    tv.map.remove();
    tv.overlay.remove();
    tv = null;

    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    if (location.hash === '#tv') history.replaceState(null, '', location.pathname + location.search);
}

function relojTV() {
    const ahora = new Date();
    const reloj = document.getElementById('rl-tv-clock');
    const fecha = document.getElementById('rl-tv-date');
    if (reloj) reloj.textContent = ahora.toLocaleTimeString('es-MX', { hour12: false });
    if (fecha) fecha.textContent = ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function pintarKpisTV() {
    const k = kpis();
    const tarjeta = (titulo, valor, pie, color) => `
        <div class="bg-slate-900/85 backdrop-blur border border-slate-700 rounded-2xl px-4 py-3">
            <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest">${titulo}</p>
            <p class="text-3xl font-black ${color} leading-tight mt-1">${valor}</p>
            <p class="text-[11px] font-bold text-slate-500 mt-0.5">${pie}</p>
        </div>`;

    document.getElementById('rl-tv-kpis').innerHTML = `
        ${tarjeta('Puntos muertos', k.muertos.length, `de ${k.destinos.length} destinos domésticos`, 'text-red-500')}
        ${tarjeta('Km en vacío', Math.round(k.kmVacio).toLocaleString('es-MX'), 'un regreso por destino', 'text-white')}
        ${tarjeta('Costo del vacío', money(k.costoVacio), 'diesel + casetas estimados', 'text-amber-400')}
        ${tarjeta('Nodos en la red', k.nodos, 'armadoras, puertos, tren y destinos', 'text-cyan-300')}
    `;
}

function rotarSpotlight() {
    if (!tv) return;
    const lista = kpis().destinos.filter(d => d.sev.nivel !== 'productivo');
    if (!lista.length) return;

    // Quita el resaltado anterior.
    if (tv.spotId) {
        const prevMarker = tv.refs.markers[tv.spotId];
        prevMarker?.getElement()?.classList.remove('rl-spot');
        prevMarker?.closeTooltip();
        const prev = tv.refs.vacios[tv.spotId];
        prev?.linea.setStyle({ weight: prev.peso });
    }

    const d = lista[tv.indice % lista.length];
    tv.indice++;
    tv.spotId = d.ciudad.id;

    // Se resalta el punto en su lugar, sin mover el mapa: la red es fija.
    const marker = tv.refs.markers[d.ciudad.id];
    marker?.getElement()?.classList.add('rl-spot');
    marker?.openTooltip();
    const actual = tv.refs.vacios[d.ciudad.id];
    actual?.linea.setStyle({ weight: actual.peso * 2 });
    actual?.linea.bringToFront();

    const muerto = d.sev.nivel === 'muerto';
    document.getElementById('rl-tv-spot').innerHTML = `
        <div class="bg-slate-900/90 backdrop-blur border ${muerto ? 'border-red-500/70' : 'border-amber-500/60'} rounded-2xl overflow-hidden shadow-2xl">
            <div class="p-5">
                <div class="flex items-center justify-between gap-4">
                    <span class="px-3 py-1 rounded-md text-xs font-black tracking-widest ${muerto ? 'bg-red-600' : 'bg-amber-500 text-slate-950'}">
                        ${muerto ? 'PUNTO MUERTO' : 'VACÍO MEDIO'}
                    </span>
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">${(tv.indice - 1) % lista.length + 1} / ${lista.length}</span>
                </div>
                <p class="text-2xl 2xl:text-3xl font-black mt-3 leading-tight">${d.ciudad.nombre}, ${d.ciudad.estado}</p>
                <p class="text-base 2xl:text-lg font-bold text-slate-300 mt-1">
                    <span class="${muerto ? 'text-red-400' : 'text-amber-400'}">${km(d.km)} en vacío</span>
                    hasta ${d.hub.nombre} · <span class="text-white">${money(d.costo)}</span> por viaje
                </p>
                <p class="text-sm 2xl:text-base text-slate-300 mt-3 leading-snug"><i class="fas fa-lightbulb text-amber-400 mr-2"></i>${oportunidad(d)}</p>
                <p class="text-xs font-bold text-cyan-300 mt-3 uppercase tracking-widest">A ${km(d.patioKm)} de nuestro patio</p>
            </div>
            <div class="h-1 bg-slate-800">
                <div class="h-full ${muerto ? 'bg-red-500' : 'bg-amber-400'} rl-tv-progress" style="animation-duration:${TV_SEGUNDOS_POR_TARJETA}s"></div>
            </div>
        </div>`;
}
