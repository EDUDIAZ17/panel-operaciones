// =====================================================================
// billing-api
// Unica puerta de entrada al modulo fiscal (CxC / CxP / CFDI).
//
// Las tablas fiscales no tienen policies de RLS y la anon key no tiene
// privilegios sobre ellas, asi que el frontend NO puede tocarlas
// directamente: todo pasa por aqui, con la service-role key que solo
// existe del lado del servidor.
//
// Autenticacion propia: la accion "login" valida el hash contra
// app_users y devuelve un JWT HS256 firmado aqui. El resto de acciones
// exige ese token en el header Authorization.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-billing-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET_RAW = Deno.env.get("BILLING_JWT_SECRET") ?? SERVICE_KEY;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// Roles con acceso al modulo fiscal.
const ROLES_ESCRITURA = ["admin", "contabilidad"];
const ROLES_LECTURA = ["admin", "contabilidad", "direccion_general"];

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

let cachedKey: CryptoKey | null = null;
async function jwtKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET_RAW),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return cachedKey;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

// ---------------------------------------------------------------------
// Sesion
// ---------------------------------------------------------------------
async function login(email: string, password: string) {
  if (!email || !password) throw new Error("Correo y contrasena son obligatorios.");

  const hash = await sha256Hex(password);
  const { data: user, error } = await db
    .from("app_users")
    .select("id, email, name, role")
    .eq("email", email.toLowerCase().trim())
    .eq("password_hash", hash)
    .maybeSingle();

  if (error) throw new Error("Error al validar credenciales.");
  if (!user) throw new Error("Credenciales invalidas.");

  const role = (user.role || "").toLowerCase().trim();
  if (!ROLES_LECTURA.includes(role)) {
    throw new Error("Este usuario no tiene acceso al modulo fiscal.");
  }

  const exp = Math.floor(Date.now() / 1000) + 8 * 60 * 60; // 8 horas
  const token = await create(
    { alg: "HS256", typ: "JWT" },
    { sub: user.id, email: user.email, name: user.name, role, exp },
    await jwtKey(),
  );

  return { token, user: { name: user.name, email: user.email, role } };
}

type Session = { sub: string; email: string; name: string; role: string };

async function requireSession(req: Request, escritura = false): Promise<Session> {
  const auth = req.headers.get("x-billing-token") || "";
  if (!auth) throw new Error("Sesion fiscal no iniciada.");

  let payload: Session;
  try {
    payload = (await verify(auth, await jwtKey())) as unknown as Session;
  } catch {
    throw new Error("Sesion fiscal expirada o invalida. Vuelve a iniciar sesion.");
  }

  const allowed = escritura ? ROLES_ESCRITURA : ROLES_LECTURA;
  if (!allowed.includes(payload.role)) {
    throw new Error("Tu rol no permite esta operacion.");
  }
  return payload;
}

// ---------------------------------------------------------------------
// Constancia de Situacion Fiscal -> datos estructurados (Gemini)
// ---------------------------------------------------------------------
async function parseConstancia(base64: string, mimeType: string) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY no esta configurada.");

  const prompt = `Extrae los datos fiscales de esta Constancia de Situacion Fiscal del SAT (Mexico).
Devuelve UNICAMENTE un objeto JSON, sin markdown ni explicaciones, con estas llaves exactas:
{
  "rfc": "RFC del contribuyente",
  "razon_social": "denominacion o razon social; si es persona fisica, nombre completo",
  "regimen_fiscal": "clave numerica de 3 digitos del regimen (ej. 601, 612, 626)",
  "codigo_postal": "codigo postal del domicilio fiscal",
  "domicilio": "domicilio fiscal completo en una linea"
}
Si algun dato no aparece en el documento, pon null en esa llave. No inventes valores.`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Gemini no pudo leer la constancia.");

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No se pudo extraer texto de la constancia.");

  try {
    return JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
  } catch {
    throw new Error("La respuesta de la IA no fue un JSON valido.");
  }
}

// ---------------------------------------------------------------------
// Importacion de CFDI ya parseados en el navegador
// ---------------------------------------------------------------------
function calcVencimiento(fecha: string, dias: number): string {
  const d = new Date(fecha);
  d.setDate(d.getDate() + (dias || 0));
  return d.toISOString().slice(0, 10);
}

async function importBatch(docs: any[], session: Session) {
  const { data: settings } = await db
    .from("fiscal_settings")
    .select("rfc, folio_actual, serie")
    .eq("id", 1)
    .single();

  const miRfc = (settings?.rfc || "").toUpperCase();
  const resumen = {
    emitidas: 0,
    recibidas: 0,
    clientes_nuevos: 0,
    proveedores_nuevos: 0,
    duplicados: 0,
    errores: [] as string[],
  };
  let folioMax = settings?.folio_actual || 0;

  for (const doc of docs) {
    try {
      const emisorRfc = (doc.emisor?.rfc || "").toUpperCase();
      const esEmitida = emisorRfc === miRfc;

      if (doc.uuid) {
        const tabla = esEmitida ? "invoices" : "supplier_bills";
        const { data: existente } = await db
          .from(tabla)
          .select("id")
          .eq("uuid", doc.uuid)
          .maybeSingle();
        if (existente) {
          resumen.duplicados++;
          continue;
        }
      }

      if (esEmitida) {
        // ----- CFDI emitido: cliente + factura (CxC) -----
        const rfc = (doc.receptor?.rfc || "").toUpperCase();
        if (!rfc) throw new Error("CFDI sin RFC de receptor");

        let { data: cliente } = await db
          .from("billing_clients")
          .select("id, dias_credito")
          .eq("rfc", rfc)
          .maybeSingle();

        if (!cliente) {
          const { data: nuevo, error } = await db
            .from("billing_clients")
            .insert({
              rfc,
              razon_social: doc.receptor?.nombre || rfc,
              regimen_fiscal: doc.receptor?.regimen_fiscal || "601",
              codigo_postal: doc.receptor?.codigo_postal || "",
              uso_cfdi: doc.receptor?.uso_cfdi || "G03",
              metodo_pago: doc.metodo_pago || "PPD",
              forma_pago: doc.forma_pago || "99",
            })
            .select("id, dias_credito")
            .single();
          if (error) throw new Error(`Cliente ${rfc}: ${error.message}`);
          cliente = nuevo;
          resumen.clientes_nuevos++;
        }

        const folio = parseInt(doc.folio, 10);
        if (!isNaN(folio) && folio > folioMax) folioMax = folio;

        const { data: factura, error: errFactura } = await db
          .from("invoices")
          .insert({
            billing_client_id: cliente!.id,
            serie: doc.serie || "ALEXA",
            folio: isNaN(folio) ? null : folio,
            uuid: doc.uuid,
            tipo_comprobante: doc.tipo_comprobante || "I",
            version: doc.version || "4.0",
            fecha: doc.fecha,
            fecha_timbrado: doc.fecha_timbrado,
            lugar_expedicion: doc.lugar_expedicion,
            exportacion: doc.exportacion || "01",
            subtotal: doc.subtotal || 0,
            descuento: doc.descuento || 0,
            iva_trasladado: doc.iva_trasladado || 0,
            iva_retenido: doc.iva_retenido || 0,
            isr_retenido: doc.isr_retenido || 0,
            total: doc.total || 0,
            moneda: doc.moneda || "MXN",
            tipo_cambio: doc.tipo_cambio,
            metodo_pago: doc.metodo_pago || "PPD",
            forma_pago: doc.forma_pago || "99",
            uso_cfdi: doc.receptor?.uso_cfdi || "G03",
            fecha_vencimiento: calcVencimiento(doc.fecha, cliente!.dias_credito ?? 30),
            status: doc.uuid ? "timbrada" : "borrador",
            saldo: doc.metodo_pago === "PUE" ? 0 : (doc.total || 0),
            no_certificado: doc.no_certificado,
            sello: doc.sello,
            no_certificado_sat: doc.no_certificado_sat,
            sello_sat: doc.sello_sat,
            rfc_prov_certif: doc.rfc_prov_certif,
            operador: doc.operador,
            unidad: doc.unidad,
            remolque: doc.remolque,
            origen: doc.origen,
            destino: doc.destino,
            order_no: doc.order_no,
            customer: doc.customer,
            rfc_importador: doc.rfc_importador,
            carta_porte: doc.carta_porte ?? null,
            addenda: doc.addenda ?? null,
            xml: doc.xml ?? null,
            origen_registro: "importado",
            created_by: session.email,
          })
          .select("id")
          .single();

        if (errFactura) throw new Error(`Factura ${doc.serie}${doc.folio}: ${errFactura.message}`);

        const conceptos = (doc.conceptos || []).map((c: any, i: number) => ({
          invoice_id: factura!.id,
          orden: i + 1,
          clave_prod_serv: c.clave_prod_serv || "78101800",
          no_identificacion: c.no_identificacion,
          cantidad: c.cantidad || 1,
          clave_unidad: c.clave_unidad || "E48",
          unidad: c.unidad,
          descripcion: c.descripcion || "Flete",
          valor_unitario: c.valor_unitario || 0,
          importe: c.importe || 0,
          descuento: c.descuento || 0,
          objeto_imp: c.objeto_imp || "02",
          impuestos: c.impuestos ?? null,
        }));
        if (conceptos.length) await db.from("invoice_items").insert(conceptos);

        resumen.emitidas++;
      } else {
        // ----- CFDI recibido: proveedor + factura por pagar (CxP) -----
        if (!emisorRfc) throw new Error("CFDI sin RFC de emisor");

        let { data: proveedor } = await db
          .from("suppliers")
          .select("id, dias_credito")
          .eq("rfc", emisorRfc)
          .maybeSingle();

        if (!proveedor) {
          const { data: nuevo, error } = await db
            .from("suppliers")
            .insert({
              rfc: emisorRfc,
              razon_social: doc.emisor?.nombre || emisorRfc,
              regimen_fiscal: doc.emisor?.regimen_fiscal,
            })
            .select("id, dias_credito")
            .single();
          if (error) throw new Error(`Proveedor ${emisorRfc}: ${error.message}`);
          proveedor = nuevo;
          resumen.proveedores_nuevos++;
        }

        const { error: errBill } = await db.from("supplier_bills").insert({
          supplier_id: proveedor!.id,
          uuid: doc.uuid,
          serie: doc.serie,
          folio: doc.folio,
          tipo_comprobante: doc.tipo_comprobante || "I",
          fecha: doc.fecha,
          fecha_vencimiento: calcVencimiento(doc.fecha, proveedor!.dias_credito ?? 30),
          subtotal: doc.subtotal || 0,
          iva_trasladado: doc.iva_trasladado || 0,
          iva_retenido: doc.iva_retenido || 0,
          isr_retenido: doc.isr_retenido || 0,
          total: doc.total || 0,
          moneda: doc.moneda || "MXN",
          metodo_pago: doc.metodo_pago,
          forma_pago: doc.forma_pago,
          concepto: doc.conceptos?.[0]?.descripcion,
          status: doc.metodo_pago === "PUE" ? "pagada" : "pendiente",
          saldo: doc.metodo_pago === "PUE" ? 0 : (doc.total || 0),
          xml: doc.xml ?? null,
          origen_registro: "importado",
          created_by: session.email,
        });
        if (errBill) throw new Error(`Factura proveedor ${doc.uuid}: ${errBill.message}`);

        resumen.recibidas++;
      }
    } catch (e) {
      resumen.errores.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (folioMax > (settings?.folio_actual || 0)) {
    await db.from("fiscal_settings").update({ folio_actual: folioMax }).eq("id", 1);
  }

  return resumen;
}

// ---------------------------------------------------------------------
// Cobros
// ---------------------------------------------------------------------
async function registrarCobro(payload: any, session: Session) {
  const { data: factura, error } = await db
    .from("invoices")
    .select("id, total, saldo, metodo_pago, status")
    .eq("id", payload.invoice_id)
    .single();

  if (error || !factura) throw new Error("Factura no encontrada.");
  if (factura.status === "cancelada") throw new Error("La factura esta cancelada.");

  const monto = Number(payload.monto);
  if (!monto || monto <= 0) throw new Error("El monto debe ser mayor a cero.");
  if (monto > Number(factura.saldo) + 0.01) {
    throw new Error(`El monto excede el saldo pendiente (${factura.saldo}).`);
  }

  const saldoAnterior = Number(factura.saldo);
  const saldoNuevo = Math.round((saldoAnterior - monto) * 100) / 100;

  const { count } = await db
    .from("invoice_payments")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", factura.id);

  const { error: errPago } = await db.from("invoice_payments").insert({
    invoice_id: factura.id,
    fecha_pago: payload.fecha_pago || new Date().toISOString(),
    monto,
    forma_pago: payload.forma_pago || "03",
    moneda: payload.moneda || "MXN",
    num_parcialidad: (count || 0) + 1,
    saldo_anterior: saldoAnterior,
    saldo_insoluto: saldoNuevo,
    referencia: payload.referencia,
    banco_origen: payload.banco_origen,
    // Si la factura es PPD, este cobro obliga a timbrar un REP.
    rep_status: factura.metodo_pago === "PPD" ? "pendiente" : "no_aplica",
    notas: payload.notas,
    created_by: session.email,
  });
  if (errPago) throw new Error(errPago.message);

  await db.from("invoices").update({ saldo: saldoNuevo, updated_at: new Date().toISOString() })
    .eq("id", factura.id);

  return { saldo: saldoNuevo, rep_requerido: factura.metodo_pago === "PPD" };
}

async function registrarPagoProveedor(payload: any, session: Session) {
  const { data: bill, error } = await db
    .from("supplier_bills")
    .select("id, saldo, status")
    .eq("id", payload.bill_id)
    .single();
  if (error || !bill) throw new Error("Factura de proveedor no encontrada.");

  const monto = Number(payload.monto);
  if (!monto || monto <= 0) throw new Error("El monto debe ser mayor a cero.");
  if (monto > Number(bill.saldo) + 0.01) {
    throw new Error(`El monto excede el saldo pendiente (${bill.saldo}).`);
  }

  const saldoNuevo = Math.round((Number(bill.saldo) - monto) * 100) / 100;

  const { error: errPago } = await db.from("supplier_payments").insert({
    bill_id: bill.id,
    fecha_pago: payload.fecha_pago || new Date().toISOString(),
    monto,
    forma_pago: payload.forma_pago || "03",
    referencia: payload.referencia,
    notas: payload.notas,
    created_by: session.email,
  });
  if (errPago) throw new Error(errPago.message);

  await db.from("supplier_bills").update({
    saldo: saldoNuevo,
    status: saldoNuevo <= 0.009 ? "pagada" : "parcial",
  }).eq("id", bill.id);

  return { saldo: saldoNuevo };
}

// ---------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case "login":
        return json(await login(body.email, body.password));

      case "bootstrap": {
        const session = await requireSession(req);
        const [settings, clientes, aging] = await Promise.all([
          db.from("fiscal_settings").select("*").eq("id", 1).single(),
          db.from("billing_clients").select("*").order("razon_social"),
          db.from("ar_aging").select("*"),
        ]);
        return json({
          session: { name: session.name, role: session.role, puede_editar: ROLES_ESCRITURA.includes(session.role) },
          settings: settings.data,
          clientes: clientes.data || [],
          aging: aging.data || [],
        });
      }

      case "clients_list": {
        await requireSession(req);
        const { data, error } = await db.from("billing_clients").select("*").order("razon_social");
        if (error) throw new Error(error.message);
        return json({ clientes: data });
      }

      case "client_save": {
        const session = await requireSession(req, true);
        const c = body.cliente || {};
        if (!c.rfc || !c.razon_social || !c.codigo_postal) {
          throw new Error("RFC, razon social y codigo postal son obligatorios.");
        }
        const row = {
          rfc: String(c.rfc).toUpperCase().trim(),
          razon_social: c.razon_social.trim(),
          regimen_fiscal: c.regimen_fiscal || "601",
          codigo_postal: String(c.codigo_postal).trim(),
          uso_cfdi: c.uso_cfdi || "G03",
          domicilio: c.domicilio,
          metodo_pago: c.metodo_pago || "PPD",
          forma_pago: c.forma_pago || "99",
          dias_credito: c.dias_credito ?? 30,
          emails: c.emails || [],
          emails_cc: c.emails_cc || [],
          asunto_correo: c.asunto_correo,
          mensaje_personalizado: c.mensaje_personalizado,
          constancia_extraida: c.constancia_extraida ?? null,
          notas: c.notas,
          activo: c.activo !== false,
          updated_at: new Date().toISOString(),
        };
        const { data, error } = c.id
          ? await db.from("billing_clients").update(row).eq("id", c.id).select().single()
          : await db.from("billing_clients").insert(row).select().single();
        if (error) throw new Error(error.message);
        await db.from("fiscal_documents").insert({
          tipo: "constancia",
          nombre_archivo: c.constancia_nombre || "captura manual",
          relacionado_tipo: "billing_client",
          relacionado_id: data.id,
          metadatos: c.constancia_extraida ?? null,
          subido_por: session.email,
        });
        return json({ cliente: data });
      }

      case "parse_constancia": {
        await requireSession(req, true);
        return json({ datos: await parseConstancia(body.base64, body.mime_type || "application/pdf") });
      }

      case "import_batch": {
        const session = await requireSession(req, true);
        return json({ resumen: await importBatch(body.docs || [], session) });
      }

      case "invoices_list": {
        await requireSession(req);
        let q = db
          .from("invoices")
          .select("*, billing_clients(rfc, razon_social), invoice_payments(id, fecha_pago, monto, rep_status, rep_uuid)")
          .order("fecha", { ascending: false })
          .limit(body.limit || 500);
        if (body.status) q = q.eq("status", body.status);
        if (body.client_id) q = q.eq("billing_client_id", body.client_id);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return json({ facturas: data });
      }

      case "bills_list": {
        await requireSession(req);
        const { data, error } = await db
          .from("supplier_bills")
          .select("*, suppliers(rfc, razon_social), supplier_payments(id, fecha_pago, monto)")
          .order("fecha", { ascending: false })
          .limit(body.limit || 500);
        if (error) throw new Error(error.message);
        return json({ facturas: data });
      }

      case "payment_register":
        return json(await registrarCobro(body, await requireSession(req, true)));

      case "bill_payment_register":
        return json(await registrarPagoProveedor(body, await requireSession(req, true)));

      case "settings_save": {
        const session = await requireSession(req, true);
        const s = body.settings || {};
        const { data, error } = await db.from("fiscal_settings").update({
          serie: s.serie,
          folio_actual: s.folio_actual,
          pac_proveedor: s.pac_proveedor,
          pac_modo: s.pac_modo,
          correo_remitente: s.correo_remitente,
          correo_copia_oculta: s.correo_copia_oculta,
          updated_at: new Date().toISOString(),
          updated_by: session.email,
        }).eq("id", 1).select().single();
        if (error) throw new Error(error.message);
        return json({ settings: data });
      }

      default:
        throw new Error(`Accion desconocida: ${action}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const authError = msg.includes("Sesion fiscal") || msg.includes("Credenciales") || msg.includes("rol no permite");
    return json({ error: msg }, authError ? 401 : 400);
  }
});
