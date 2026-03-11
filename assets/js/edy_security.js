// edy_security.js - Inteligencia de Riesgo (Hotspots y Paraderos)

let hotspotsLayer = null;
let safeStopsMarkers = [];

export function renderSecurityOverlay(map) {
    // Definimos datos falsos/simulados para la demostración
    
    const hotspotData = [
        new google.maps.LatLng(19.29, -98.65), // San Marcos - San Martin (Mex-Puebla)
        new google.maps.LatLng(19.32, -98.60),
        new google.maps.LatLng(19.35, -98.55),
        
        new google.maps.LatLng(20.00, -99.30), // Arco Norte
        new google.maps.LatLng(20.05, -99.20),
    ];

    hotspotsLayer = new google.maps.visualization.HeatmapLayer({
        data: hotspotData,
        radius: 40,
        gradient: [
            'rgba(0, 255, 255, 0)',
            'rgba(255, 255, 0, 0.8)',
            'rgba(255, 0, 0, 1)'
        ]
    });

    // Paraderos Seguros (Certificados SICT simulados)
    const paraderos = [
        { lat: 19.30, lng: -98.61, name: "Paradero Seguro San Martín - Cert. SICT 042" },
        { lat: 20.02, lng: -99.25, name: "Macroplaza Arco Norte - Circuito Cerrado 24/7" }
    ];

    paraderos.forEach(p => {
        const marker = new google.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#10b981',
                fillOpacity: 1,
                strokeColor: '#064e3b',
                strokeWeight: 2,
                scale: 8
            },
            title: p.name
        });
        
        const info = new google.maps.InfoWindow({
            content: `<div style="color:black"><b>${p.name}</b><br>Seguridad Guardia Nacional / Iluminación LED</div>`
        });

        marker.addListener('click', () => info.open(map, marker));
        marker.mapRef = map; // Store reference to map
        safeStopsMarkers.push(marker);
    });
}

export function toggleHotspots(isActive) {
    if (!hotspotsLayer) return;
    hotspotsLayer.setMap(isActive ? window.edyMap || hotspotsLayer.getMap() || document.getElementById('edy-map-canvas').__vue__ /* hacky fallback */ : null);
    
    // Asignación directa si conocemos el mapa, edy_app lo pasa global o lo inyecta
    // The clean way is keeping map ref passed in renderSecurityOverlay:
    if(isActive) {
        hotspotsLayer.setMap(safeStopsMarkers[0].mapRef);
    } else {
        hotspotsLayer.setMap(null);
    }
}

export function toggleSafeStops(isActive) {
    safeStopsMarkers.forEach(m => {
        m.setMap(isActive ? m.mapRef : null);
    });
}
