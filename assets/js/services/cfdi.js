// =====================================================================
// services/cfdi.js
// Lectura de CFDI 4.0 (con Complemento Carta Porte 3.1 y addenda),
// cliente de la Edge Function billing-api y generador del PDF con el
// mismo formato que imprime Alexa hoy.
//
// El XML se parsea aqui, en el navegador, con DOMParser: es nativo,
// maneja namespaces y evita subir archivos grandes al servidor. Al
// backend solo viaja el JSON normalizado.
// =====================================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/config.js';

const BILLING_URL = `${SUPABASE_URL}/functions/v1/billing-api`;

// ---------------------------------------------------------------------
// Cliente de la API fiscal
// ---------------------------------------------------------------------
export function getBillingToken() {
    return sessionStorage.getItem('billingToken');
}

export function setBillingToken(token) {
    if (token) sessionStorage.setItem('billingToken', token);
    else sessionStorage.removeItem('billingToken');
}

export async function billingCall(action, payload = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    };
    const token = getBillingToken();
    if (token) headers['x-billing-token'] = token;

    const res = await fetch(BILLING_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, ...payload })
    });

    const data = await res.json().catch(() => ({ error: 'Respuesta ilegible del servidor.' }));
    if (!res.ok) {
        const err = new Error(data.error || `Error ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

export async function billingLogin(email, password) {
    const data = await billingCall('login', { email, password });
    setBillingToken(data.token);
    return data.user;
}

// ---------------------------------------------------------------------
// Utilidades de XML con namespaces
// ---------------------------------------------------------------------
function findAll(root, localName) {
    if (!root) return [];
    return Array.from(root.getElementsByTagName('*'))
        .filter(el => el.localName === localName);
}

function findOne(root, localName) {
    return findAll(root, localName)[0] || null;
}

function attr(el, name, fallback = null) {
    if (!el) return fallback;
    const v = el.getAttribute(name);
    return v === null || v === '' ? fallback : v;
}

function num(el, name, fallback = 0) {
    const v = attr(el, name);
    if (v === null) return fallback;
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
}

// ---------------------------------------------------------------------
// Parser principal: XML string -> objeto normalizado
// ---------------------------------------------------------------------
export function parseCFDI(xmlString, nombreArchivo = '') {
    const doc = new DOMParser().parseFromString(xmlString, 'application/xml');

    if (doc.getElementsByTagName('parsererror').length) {
        throw new Error(`${nombreArchivo || 'XML'}: archivo mal formado.`);
    }

    const comp = doc.documentElement;
    if (!comp || comp.localName !== 'Comprobante') {
        throw new Error(`${nombreArchivo || 'XML'}: no es un CFDI.`);
    }

    const emisor = findOne(comp, 'Emisor');
    const receptor = findOne(comp, 'Receptor');
    const timbre = findOne(comp, 'TimbreFiscalDigital');

    // --- Conceptos ---
    const conceptos = findAll(findOne(comp, 'Conceptos'), 'Concepto').map(c => {
        const impuestos = findOne(c, 'Impuestos');
        return {
            clave_prod_serv: attr(c, 'ClaveProdServ'),
            no_identificacion: attr(c, 'NoIdentificacion'),
            cantidad: num(c, 'Cantidad', 1),
            clave_unidad: attr(c, 'ClaveUnidad'),
            unidad: attr(c, 'Unidad'),
            descripcion: attr(c, 'Descripcion', 'Flete'),
            valor_unitario: num(c, 'ValorUnitario'),
            importe: num(c, 'Importe'),
            descuento: num(c, 'Descuento'),
            objeto_imp: attr(c, 'ObjetoImp', '02'),
            impuestos: impuestos ? {
                traslados: findAll(findOne(impuestos, 'Traslados'), 'Traslado').map(t => ({
                    base: num(t, 'Base'), impuesto: attr(t, 'Impuesto'),
                    tipo_factor: attr(t, 'TipoFactor'), tasa: num(t, 'TasaOCuota'),
                    importe: num(t, 'Importe')
                })),
                retenciones: findAll(findOne(impuestos, 'Retenciones'), 'Retencion').map(r => ({
                    base: num(r, 'Base'), impuesto: attr(r, 'Impuesto'),
                    tipo_factor: attr(r, 'TipoFactor'), tasa: num(r, 'TasaOCuota'),
                    importe: num(r, 'Importe')
                }))
            } : null
        };
    });

    // --- Impuestos del comprobante (el nodo Impuestos hijo directo) ---
    const impuestosComp = Array.from(comp.children).find(el => el.localName === 'Impuestos');
    let ivaTrasladado = 0, ivaRetenido = 0, isrRetenido = 0;

    if (impuestosComp) {
        findAll(findOne(impuestosComp, 'Traslados'), 'Traslado').forEach(t => {
            if (attr(t, 'Impuesto') === '002') ivaTrasladado += num(t, 'Importe');
        });
        findAll(findOne(impuestosComp, 'Retenciones'), 'Retencion').forEach(r => {
            const imp = attr(r, 'Impuesto');
            if (imp === '002') ivaRetenido += num(r, 'Importe');
            if (imp === '001') isrRetenido += num(r, 'Importe');
        });
    }

    // --- Complemento Carta Porte 3.1 ---
    const cp = findOne(comp, 'CartaPorte');
    let cartaPorte = null, operador = null, unidad = null, remolque = null;
    let origen = null, destino = null;

    if (cp) {
        const ubicaciones = findAll(findOne(cp, 'Ubicaciones'), 'Ubicacion').map(u => {
            const dom = findOne(u, 'Domicilio');
            return {
                tipo: attr(u, 'TipoUbicacion'),
                id_ubicacion: attr(u, 'IDUbicacion'),
                rfc: attr(u, 'RFCRemitenteDestinatario'),
                nombre: attr(u, 'NombreRemitenteDestinatario'),
                fecha: attr(u, 'FechaHoraSalidaLlegada'),
                distancia: num(u, 'DistanciaRecorrida', null),
                domicilio: dom ? {
                    calle: attr(dom, 'Calle'),
                    numero: attr(dom, 'NumeroExterior'),
                    estado: attr(dom, 'Estado'),
                    municipio: attr(dom, 'Municipio'),
                    cp: attr(dom, 'CodigoPostal'),
                    pais: attr(dom, 'Pais')
                } : null
            };
        });

        const mercanciasNode = findOne(cp, 'Mercancias');
        const mercancias = findAll(mercanciasNode, 'Mercancia').map(m => ({
            bienes_transp: attr(m, 'BienesTransp'),
            descripcion: attr(m, 'Descripcion'),
            cantidad: num(m, 'Cantidad', 1),
            clave_unidad: attr(m, 'ClaveUnidad'),
            peso_kg: num(m, 'PesoEnKg')
        }));

        const auto = findOne(cp, 'Autotransporte');
        const vehiculo = findOne(auto, 'IdentificacionVehicular');
        const seguros = findOne(auto, 'Seguros');
        const rem = findOne(auto, 'Remolque');
        const figura = findOne(cp, 'TiposFigura');

        operador = attr(figura, 'NombreFigura');
        unidad = attr(vehiculo, 'PlacaVM');
        remolque = attr(rem, 'Placa');

        const ubOrigen = ubicaciones.find(u => u.tipo === 'Origen');
        const destinos = ubicaciones.filter(u => u.tipo === 'Destino');
        origen = ubOrigen ? (ubOrigen.nombre || ubOrigen.domicilio?.cp) : null;
        destino = destinos.length
            ? destinos.map(d => d.nombre).filter(Boolean).join(' / ')
            : null;

        cartaPorte = {
            version: attr(cp, 'Version', '3.1'),
            id_ccp: attr(cp, 'IdCCP'),
            transp_internac: attr(cp, 'TranspInternac'),
            total_dist_rec: num(cp, 'TotalDistRec'),
            ubicaciones,
            mercancias,
            peso_bruto_total: num(mercanciasNode, 'PesoBrutoTotal'),
            unidad_peso: attr(mercanciasNode, 'UnidadPeso'),
            num_total_mercancias: num(mercanciasNode, 'NumTotalMercancias'),
            autotransporte: auto ? {
                perm_sct: attr(auto, 'PermSCT'),
                num_permiso: attr(auto, 'NumPermisoSCT'),
                config_vehicular: attr(vehiculo, 'ConfigVehicular'),
                peso_bruto_vehicular: num(vehiculo, 'PesoBrutoVehicular'),
                placa: attr(vehiculo, 'PlacaVM'),
                anio_modelo: attr(vehiculo, 'AnioModeloVM'),
                aseguradora: attr(seguros, 'AseguraRespCivil'),
                poliza: attr(seguros, 'PolizaRespCivil'),
                remolque_placa: attr(rem, 'Placa'),
                remolque_subtipo: attr(rem, 'SubTipoRem')
            } : null,
            figura: figura ? {
                tipo: attr(figura, 'TipoFigura'),
                rfc: attr(figura, 'RFCFigura'),
                licencia: attr(figura, 'NumLicencia'),
                nombre: attr(figura, 'NombreFigura')
            } : null
        };
    }

    // --- Addenda (Order_No, Customer, VINs) ---
    const addendaNode = findOne(comp, 'Addenda');
    let addenda = null, orderNo = null, customer = null, rfcImportador = null;

    if (addendaNode) {
        const vins = findAll(addendaNode, 'VINSerie').map(v => v.textContent.trim());
        const rfcImpNode = findOne(addendaNode, 'RFCImportador_Exportador');
        orderNo = attr(addendaNode, 'Order_No');
        customer = attr(addendaNode, 'Customer');
        rfcImportador = rfcImpNode ? rfcImpNode.textContent.trim() : null;
        addenda = { order_no: orderNo, customer, rfc_importador: rfcImportador, vins };
    }

    return {
        version: attr(comp, 'Version', '4.0'),
        serie: attr(comp, 'Serie'),
        folio: attr(comp, 'Folio'),
        uuid: attr(timbre, 'UUID'),
        fecha: attr(comp, 'Fecha'),
        fecha_timbrado: attr(timbre, 'FechaTimbrado'),
        tipo_comprobante: attr(comp, 'TipoDeComprobante', 'I'),
        lugar_expedicion: attr(comp, 'LugarExpedicion'),
        exportacion: attr(comp, 'Exportacion', '01'),
        subtotal: num(comp, 'SubTotal'),
        descuento: num(comp, 'Descuento'),
        total: num(comp, 'Total'),
        moneda: attr(comp, 'Moneda', 'MXN'),
        tipo_cambio: num(comp, 'TipoCambio', null),
        metodo_pago: attr(comp, 'MetodoPago'),
        forma_pago: attr(comp, 'FormaPago'),
        condiciones_pago: attr(comp, 'CondicionesDePago'),
        iva_trasladado: Math.round(ivaTrasladado * 100) / 100,
        iva_retenido: Math.round(ivaRetenido * 100) / 100,
        isr_retenido: Math.round(isrRetenido * 100) / 100,
        no_certificado: attr(comp, 'NoCertificado'),
        sello: attr(comp, 'Sello'),
        no_certificado_sat: attr(timbre, 'NoCertificadoSAT'),
        sello_sat: attr(timbre, 'SelloSAT'),
        rfc_prov_certif: attr(timbre, 'RfcProvCertif'),
        emisor: {
            rfc: attr(emisor, 'Rfc'),
            nombre: attr(emisor, 'Nombre'),
            regimen_fiscal: attr(emisor, 'RegimenFiscal')
        },
        receptor: {
            rfc: attr(receptor, 'Rfc'),
            nombre: attr(receptor, 'Nombre'),
            regimen_fiscal: attr(receptor, 'RegimenFiscalReceptor'),
            codigo_postal: attr(receptor, 'DomicilioFiscalReceptor'),
            uso_cfdi: attr(receptor, 'UsoCFDI', 'G03')
        },
        conceptos,
        carta_porte: cartaPorte,
        addenda,
        operador,
        unidad,
        remolque,
        origen,
        destino,
        order_no: orderNo,
        customer,
        rfc_importador: rfcImportador,
        archivo: nombreArchivo,
        xml: xmlString
    };
}

// ---------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------
export const money = n =>
    '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fechaCorta = f => {
    if (!f) return '—';
    // Una fecha sin hora (YYYY-MM-DD) la interpreta el navegador como UTC,
    // lo que la recorre un dia hacia atras en horario de Mexico. Se arma
    // explicitamente en hora local.
    const soloFecha = /^\d{4}-\d{2}-\d{2}$/.exec(String(f));
    const d = soloFecha
        ? new Date(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)))
        : new Date(f);
    return isNaN(d) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Importe con letra para el PDF (el SAT lo exige en el formato impreso).
export function numeroALetra(monto) {
    const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ',
        'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
    const DECENAS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
        'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    function menorMil(n) {
        if (n === 0) return '';
        if (n === 100) return 'CIEN';
        let txt = '';
        const c = Math.floor(n / 100), resto = n % 100;
        if (c) txt += CENTENAS[c] + ' ';
        if (resto <= 20) {
            txt += UNIDADES[resto];
        } else {
            const d = Math.floor(resto / 10), u = resto % 10;
            txt += DECENAS[d] + (u ? ' Y ' + UNIDADES[u] : '');
        }
        return txt.trim();
    }

    const entero = Math.floor(Math.abs(monto));
    const centavos = Math.round((Math.abs(monto) - entero) * 100);

    let texto;
    if (entero === 0) {
        texto = 'CERO';
    } else {
        const millones = Math.floor(entero / 1000000);
        const miles = Math.floor((entero % 1000000) / 1000);
        const resto = entero % 1000;
        const partes = [];
        if (millones) partes.push(millones === 1 ? 'UN MILLON' : menorMil(millones) + ' MILLONES');
        if (miles) partes.push(miles === 1 ? 'MIL' : menorMil(miles) + ' MIL');
        if (resto) partes.push(menorMil(resto));
        texto = partes.join(' ');
    }

    return `${texto} PESOS ${String(centavos).padStart(2, '0')}/100 M.N.`;
}

// ---------------------------------------------------------------------
// URL de verificacion del SAT (la que va dentro del codigo QR)
// ---------------------------------------------------------------------
export function urlVerificacionSAT(factura) {
    if (!factura.uuid) return null;
    const sello = factura.sello || '';
    const fe = sello.slice(-8);
    const tt = Number(factura.total || 0).toFixed(6);
    return 'https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx' +
        `?id=${factura.uuid}&re=${factura.emisor_rfc || ''}&rr=${factura.receptor_rfc || ''}` +
        `&tt=${tt}&fe=${encodeURIComponent(fe)}`;
}

function qrDataUrl(texto) {
    if (!texto || typeof window.qrcode !== 'function') return null;
    try {
        const qr = window.qrcode(0, 'M');
        qr.addData(texto);
        qr.make();
        return qr.createDataURL(6, 0);
    } catch (err) {
        console.warn('No se pudo generar el QR:', err);
        return null;
    }
}

// ---------------------------------------------------------------------
// PDF con el formato de Alexa
// ---------------------------------------------------------------------
export function generarPDFFactura(factura, emisor) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const M = 12;
    let y = 14;

    const cliente = factura.billing_clients || {};
    const cp = factura.carta_porte || {};
    const add = factura.addenda || {};

    // --- Encabezado ---
    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text(emisor?.razon_social || 'AUTOTRANSPORTE Y LOGISTICA ESPECIALIZADA XA', M, y);
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    y += 4;
    doc.text(`RFC: ${emisor?.rfc || ''}`, M, y);
    y += 3.2;
    doc.text(`REGIMEN FISCAL: ${emisor?.regimen_fiscal || '601'} General de Ley Personas Morales`, M, y);
    y += 3.2;
    doc.text(doc.splitTextToSize(emisor?.domicilio || '', 95), M, y);

    // Bloque derecho: identificacion del comprobante
    let yr = 14;
    doc.setFont('helvetica', 'bold').setFontSize(9);
    doc.text('FACTURA ELECTRONICA (CFDI)', W - M, yr, { align: 'right' });
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    const derecha = [
        ['SERIE Y FOLIO', `${factura.serie || ''}${factura.folio || ''}`],
        ['FECHA EMISION', new Date(factura.fecha).toLocaleString('es-MX')],
        ['TIPO COMPROBANTE', `${factura.tipo_comprobante || 'I'} Ingreso`],
        ['LUGAR EXPEDICION', factura.lugar_expedicion || ''],
        ['FOLIO FISCAL', factura.uuid || 'SIN TIMBRAR'],
        ['CERTIFICADO', factura.no_certificado || ''],
        ['CERTIFICADO SAT', factura.no_certificado_sat || ''],
        ['RFC PAC', factura.rfc_prov_certif || '']
    ];
    // La etiqueta se alinea a la izquierda de la columna y el valor a la
    // derecha: el folio fiscal mide 36 caracteres y con ambos alineados a
    // la derecha se encimaba.
    const COL = 92;
    derecha.forEach(([k, v]) => {
        yr += 4;
        doc.setFont('helvetica', 'bold').text(`${k}:`, W - M - COL, yr);
        doc.setFont('helvetica', 'normal').text(String(v).slice(0, 46), W - M, yr, { align: 'right' });
    });

    y = Math.max(y + 10, yr + 6);

    // --- Cliente ---
    doc.setFillColor(241, 245, 249).rect(M, y, W - M * 2, 5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(30, 41, 59);
    doc.text('CLIENTE', M + 2, y + 3.5);
    y += 8;
    doc.setFontSize(7.5).setFont('helvetica', 'normal');
    doc.text(`NOMBRE O RAZON SOCIAL: ${cliente.razon_social || ''}`, M, y); y += 3.4;
    doc.text(`RFC: ${cliente.rfc || ''}`, M, y);
    doc.text(`USO CFDI: ${factura.uso_cfdi || 'G03'}`, M + 70, y); y += 3.4;
    doc.text(doc.splitTextToSize(`DOMICILIO FISCAL: ${cliente.domicilio || cliente.codigo_postal || ''}`, W - M * 2), M, y);
    y += 7;

    // --- Origen / destino (Carta Porte) ---
    if (cp.ubicaciones?.length) {
        doc.setFillColor(241, 245, 249).rect(M, y, W - M * 2, 5, 'F');
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text('ORIGEN Y DESTINO (CARTA PORTE ' + (cp.version || '3.1') + ')', M + 2, y + 3.5);
        y += 8;
        doc.setFont('helvetica', 'normal').setFontSize(7);
        cp.ubicaciones.forEach(u => {
            const dom = u.domicilio || {};
            const linea = `${u.tipo?.toUpperCase() || ''} · ${u.nombre || ''} · ${[dom.calle, dom.numero, dom.estado, dom.cp].filter(Boolean).join(', ')}` +
                (u.distancia ? ` · ${u.distancia} km` : '');
            doc.text(doc.splitTextToSize(linea, W - M * 2), M, y);
            y += 3.2;
        });
        if (cp.total_dist_rec) {
            doc.setFont('helvetica', 'bold');
            doc.text(`DISTANCIA TOTAL RECORRIDA: ${cp.total_dist_rec} km`, M, y);
            y += 4;
        }
    }

    // --- Conceptos ---
    const items = factura.invoice_items || [];
    doc.autoTable({
        startY: y + 2,
        head: [['CLAVE', 'CANT', 'UNIDAD', 'DESCRIPCION', 'VALOR UNIT.', 'IMPORTE']],
        body: items.length
            ? items.map(i => [
                i.clave_prod_serv, i.cantidad, i.clave_unidad, i.descripcion,
                money(i.valor_unitario), money(i.importe)
            ])
            : [['78101800', '1', 'E48', 'Flete', money(factura.subtotal), money(factura.subtotal)]],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7 },
        columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
        margin: { left: M, right: M }
    });

    y = doc.lastAutoTable.finalY + 4;

    // --- Totales ---
    const totales = [
        ['IMPORTE', factura.subtotal],
        ['DESCUENTO', factura.descuento],
        ['IVA 16%', factura.iva_trasladado],
        ['RETENCION IVA 4%', -Math.abs(factura.iva_retenido || 0)],
        ['TOTAL', factura.total]
    ];
    const xt = W - M - 60;
    totales.forEach(([k, v], i) => {
        const esTotal = i === totales.length - 1;
        doc.setFont('helvetica', esTotal ? 'bold' : 'normal').setFontSize(esTotal ? 9 : 7.5);
        doc.text(k, xt, y);
        doc.text(money(v), W - M, y, { align: 'right' });
        y += esTotal ? 5.5 : 4;
    });

    // --- Condiciones de pago ---
    let yc = doc.lastAutoTable.finalY + 4;
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    [
        ['MONEDA', factura.moneda || 'MXN'],
        ['FORMA DE PAGO', factura.forma_pago || '99'],
        ['METODO DE PAGO', `${factura.metodo_pago || 'PPD'} ${factura.metodo_pago === 'PPD' ? 'Pago en parcialidades o diferido' : 'Pago en una sola exhibicion'}`],
        ['VENCIMIENTO', fechaCorta(factura.fecha_vencimiento)],
        ['EXPORTACION', factura.exportacion || '01']
    ].forEach(([k, v]) => {
        doc.setFont('helvetica', 'bold').text(`${k}:`, M, yc);
        doc.setFont('helvetica', 'normal').text(String(v), M + 30, yc);
        yc += 4;
    });

    y = Math.max(y, yc) + 2;
    doc.setFont('helvetica', 'bold').setFontSize(7.5);
    doc.text(`IMPORTE CON LETRA: ${numeroALetra(factura.total)}`, M, y);
    y += 6;

    // --- Datos operativos ---
    doc.setFillColor(241, 245, 249).rect(M, y, W - M * 2, 5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(8).text('DATOS DEL SERVICIO', M + 2, y + 3.5);
    y += 8;
    doc.setFont('helvetica', 'normal').setFontSize(7);
    [
        ['OPERADOR', factura.operador],
        ['UNIDAD', factura.unidad],
        ['REMOLQUE', factura.remolque],
        ['ORDENES DE SERVICIO / CARTAS PORTE', factura.ordenes_servicio],
        ['ORDER NO.', factura.order_no],
        ['CUSTOMER', factura.customer],
        ['RFC IMPORTADOR / EXPORTADOR', factura.rfc_importador]
    ].filter(([, v]) => v).forEach(([k, v]) => {
        doc.setFont('helvetica', 'bold').text(`${k}:`, M, y);
        doc.setFont('helvetica', 'normal').text(doc.splitTextToSize(String(v), W - M * 2 - 55), M + 55, y);
        y += 3.6;
    });

    if (add.vins?.length) {
        y += 1;
        doc.setFont('helvetica', 'bold').text(`VINS (${add.vins.length}):`, M, y);
        doc.setFont('helvetica', 'normal');
        doc.text(doc.splitTextToSize(add.vins.join(', '), W - M * 2 - 20), M + 20, y);
        y += 3.6 * Math.ceil(add.vins.length / 4);
    }

    // --- Timbre fiscal + QR ---
    if (factura.uuid) {
        y += 4;
        const qrTexto = urlVerificacionSAT({
            ...factura,
            emisor_rfc: emisor?.rfc,
            receptor_rfc: cliente.rfc
        });
        const qr = qrDataUrl(qrTexto);
        if (qr) doc.addImage(qr, 'GIF', M, y, 28, 28);

        doc.setFont('helvetica', 'bold').setFontSize(6);
        doc.text('SELLO DIGITAL DEL CFDI', M + 32, y + 3);
        doc.setFont('courier', 'normal').setFontSize(5);
        doc.text(doc.splitTextToSize(factura.sello || '', W - M * 2 - 34), M + 32, y + 6);

        doc.setFont('helvetica', 'bold').setFontSize(6);
        doc.text('SELLO DEL SAT', M + 32, y + 16);
        doc.setFont('courier', 'normal').setFontSize(5);
        doc.text(doc.splitTextToSize(factura.sello_sat || '', W - M * 2 - 34), M + 32, y + 19);
        y += 30;
    } else {
        y += 6;
        doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(180, 83, 9);
        doc.text('*** DOCUMENTO SIN VALOR FISCAL — FACTURA NO TIMBRADA ***', W / 2, y, { align: 'center' });
        doc.setTextColor(30, 41, 59);
    }

    doc.setFont('helvetica', 'normal').setFontSize(5.5).setTextColor(100, 116, 139);
    doc.text('Este documento es una representacion impresa de un CFDI.', W / 2,
        doc.internal.pageSize.getHeight() - 8, { align: 'center' });

    return doc;
}
