-- =====================================================================
-- v20_billing_ar_ap.sql
-- Modulo fiscal: Cuentas por Cobrar / Cuentas por Pagar + CFDI 4.0
--
-- SEGURIDAD: a diferencia del resto del esquema, estas tablas nacen con
-- RLS activo y SIN policies, y se revocan los privilegios de anon y
-- authenticated. Es decir: la anon key publicada en el frontend NO tiene
-- ningun acceso. Solo las Edge Functions (service_role) pueden leer o
-- escribir aqui, porque esto guarda RFC de terceros, montos y XML
-- timbrados.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Configuracion del emisor (una sola fila)
-- ---------------------------------------------------------------------
create table if not exists fiscal_settings (
    id smallint primary key default 1 check (id = 1),
    rfc text not null default 'ALE090701IT6',
    razon_social text not null default 'AUTOTRANSPORTE Y LOGISTICA ESPECIALIZADA XA',
    regimen_fiscal text not null default '601',
    codigo_postal text not null default '52106',
    domicilio text default 'AVENIDA RANCHO DON PEPE NUM. 300, COL. FRANCISCO I. MADERO, SAN MATEO ATENCO, ESTADO DE MEXICO, C.P. 52106',
    serie text not null default 'ALEXA',
    folio_actual integer not null default 2796,
    pac_proveedor text,
    pac_modo text not null default 'sandbox' check (pac_modo in ('sandbox', 'produccion')),
    no_certificado text,
    certificado_valido_desde timestamptz,
    certificado_valido_hasta timestamptz,
    correo_remitente text,
    correo_copia_oculta text,
    updated_at timestamptz not null default now(),
    updated_by text
);
insert into fiscal_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Clientes con datos fiscales (receptor del CFDI)
--    client_id liga con el catalogo operativo existente (clients).
-- ---------------------------------------------------------------------
create table if not exists billing_clients (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete set null,
    rfc text not null unique,
    razon_social text not null,
    regimen_fiscal text not null default '601',
    codigo_postal text not null,
    uso_cfdi text not null default 'G03',
    domicilio text,
    metodo_pago text not null default 'PPD',
    forma_pago text not null default '99',
    dias_credito integer not null default 30,
    emails text[] not null default '{}',
    emails_cc text[] not null default '{}',
    asunto_correo text,
    mensaje_personalizado text,
    constancia_path text,
    constancia_extraida jsonb,
    notas text,
    activo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists billing_clients_razon_idx on billing_clients (razon_social);
create index if not exists billing_clients_client_idx on billing_clients (client_id);

-- ---------------------------------------------------------------------
-- 3. Facturas emitidas = Cuentas por Cobrar
-- ---------------------------------------------------------------------
create table if not exists invoices (
    id uuid primary key default gen_random_uuid(),
    billing_client_id uuid references billing_clients(id) on delete restrict,

    -- Identificacion CFDI
    serie text not null default 'ALEXA',
    folio integer,
    uuid text unique,
    tipo_comprobante text not null default 'I',
    version text not null default '4.0',
    fecha timestamptz not null default now(),
    fecha_timbrado timestamptz,
    lugar_expedicion text not null default '52106',
    exportacion text not null default '01',

    -- Importes
    subtotal numeric(18, 2) not null default 0,
    descuento numeric(18, 2) not null default 0,
    iva_trasladado numeric(18, 2) not null default 0,
    iva_retenido numeric(18, 2) not null default 0,
    isr_retenido numeric(18, 2) not null default 0,
    total numeric(18, 2) not null default 0,
    moneda text not null default 'MXN',
    tipo_cambio numeric(18, 6),

    -- Condiciones de pago
    metodo_pago text not null default 'PPD',
    forma_pago text not null default '99',
    uso_cfdi text not null default 'G03',
    condiciones_pago text,
    fecha_vencimiento date,

    -- Estado y cobranza
    status text not null default 'borrador'
        check (status in ('borrador', 'timbrada', 'cancelada', 'cancelacion_solicitada')),
    saldo numeric(18, 2) not null default 0,
    motivo_cancelacion text,
    uuid_sustitucion text,

    -- Datos de certificacion
    no_certificado text,
    sello text,
    no_certificado_sat text,
    sello_sat text,
    rfc_prov_certif text,
    cadena_original_sat text,

    -- Datos operativos del viaje (lo que Alexa imprime en su PDF)
    operador text,
    unidad text,
    remolque text,
    origen text,
    destino text,
    ordenes_servicio text,
    order_no text,
    customer text,
    rfc_importador text,

    -- Complemento Carta Porte 3.1 y addenda, tal cual vienen en el XML
    carta_porte jsonb,
    addenda jsonb,

    -- Archivos
    xml text,
    pdf_path text,

    origen_registro text not null default 'manual'
        check (origen_registro in ('manual', 'importado', 'timbrado')),
    notas text,
    created_at timestamptz not null default now(),
    created_by text,
    updated_at timestamptz not null default now()
);
create index if not exists invoices_client_idx on invoices (billing_client_id);
create index if not exists invoices_status_idx on invoices (status);
create index if not exists invoices_vencimiento_idx on invoices (fecha_vencimiento);
create index if not exists invoices_fecha_idx on invoices (fecha desc);
create unique index if not exists invoices_serie_folio_idx on invoices (serie, folio)
    where folio is not null;

-- ---------------------------------------------------------------------
-- 4. Conceptos de la factura
-- ---------------------------------------------------------------------
create table if not exists invoice_items (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references invoices(id) on delete cascade,
    orden integer not null default 1,
    clave_prod_serv text not null default '78101800',
    no_identificacion text,
    cantidad numeric(18, 6) not null default 1,
    clave_unidad text not null default 'E48',
    unidad text default 'Actividad',
    descripcion text not null default 'Flete',
    valor_unitario numeric(18, 6) not null default 0,
    importe numeric(18, 2) not null default 0,
    descuento numeric(18, 2) not null default 0,
    objeto_imp text not null default '02',
    impuestos jsonb
);
create index if not exists invoice_items_invoice_idx on invoice_items (invoice_id);

-- ---------------------------------------------------------------------
-- 5. Cobros y Complemento de Recepcion de Pagos (CFDI tipo P)
--    Obligatorio porque Alexa factura PPD.
-- ---------------------------------------------------------------------
create table if not exists invoice_payments (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references invoices(id) on delete cascade,
    fecha_pago timestamptz not null default now(),
    monto numeric(18, 2) not null check (monto > 0),
    forma_pago text not null default '03',
    moneda text not null default 'MXN',
    tipo_cambio numeric(18, 6),
    num_parcialidad integer,
    saldo_anterior numeric(18, 2),
    saldo_insoluto numeric(18, 2),
    referencia text,
    banco_origen text,
    cuenta_beneficiario text,

    -- CFDI de pago (REP)
    rep_status text not null default 'pendiente'
        check (rep_status in ('pendiente', 'timbrado', 'cancelado', 'no_aplica')),
    rep_uuid text,
    rep_fecha_timbrado timestamptz,
    rep_xml text,
    rep_pdf_path text,

    notas text,
    created_at timestamptz not null default now(),
    created_by text
);
create index if not exists invoice_payments_invoice_idx on invoice_payments (invoice_id);
create index if not exists invoice_payments_rep_idx on invoice_payments (rep_status);

-- ---------------------------------------------------------------------
-- 6. Proveedores y Cuentas por Pagar
-- ---------------------------------------------------------------------
create table if not exists suppliers (
    id uuid primary key default gen_random_uuid(),
    rfc text not null unique,
    razon_social text not null,
    regimen_fiscal text,
    codigo_postal text,
    emails text[] not null default '{}',
    dias_credito integer not null default 30,
    categoria text,
    notas text,
    activo boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists supplier_bills (
    id uuid primary key default gen_random_uuid(),
    supplier_id uuid references suppliers(id) on delete restrict,
    uuid text unique,
    serie text,
    folio text,
    tipo_comprobante text not null default 'I',
    fecha timestamptz not null default now(),
    fecha_vencimiento date,
    subtotal numeric(18, 2) not null default 0,
    iva_trasladado numeric(18, 2) not null default 0,
    iva_retenido numeric(18, 2) not null default 0,
    isr_retenido numeric(18, 2) not null default 0,
    total numeric(18, 2) not null default 0,
    moneda text not null default 'MXN',
    tipo_cambio numeric(18, 6),
    metodo_pago text,
    forma_pago text,
    concepto text,
    status text not null default 'pendiente'
        check (status in ('pendiente', 'parcial', 'pagada', 'cancelada')),
    saldo numeric(18, 2) not null default 0,
    autorizada boolean not null default false,
    autorizada_por text,
    autorizada_en timestamptz,
    xml text,
    pdf_path text,
    raw jsonb,
    origen_registro text not null default 'manual'
        check (origen_registro in ('manual', 'importado')),
    notas text,
    created_at timestamptz not null default now(),
    created_by text
);
create index if not exists supplier_bills_supplier_idx on supplier_bills (supplier_id);
create index if not exists supplier_bills_status_idx on supplier_bills (status);
create index if not exists supplier_bills_vencimiento_idx on supplier_bills (fecha_vencimiento);

create table if not exists supplier_payments (
    id uuid primary key default gen_random_uuid(),
    bill_id uuid not null references supplier_bills(id) on delete cascade,
    fecha_pago timestamptz not null default now(),
    monto numeric(18, 2) not null check (monto > 0),
    forma_pago text not null default '03',
    referencia text,
    notas text,
    created_at timestamptz not null default now(),
    created_by text
);
create index if not exists supplier_payments_bill_idx on supplier_payments (bill_id);

-- ---------------------------------------------------------------------
-- 7. Bitacora de correos enviados al cliente
-- ---------------------------------------------------------------------
create table if not exists billing_email_log (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid references invoices(id) on delete cascade,
    payment_id uuid references invoice_payments(id) on delete cascade,
    destinatarios text[] not null default '{}',
    cc text[] not null default '{}',
    asunto text,
    cuerpo text,
    adjuntos text[] not null default '{}',
    proveedor text,
    provider_message_id text,
    status text not null default 'enviado' check (status in ('enviado', 'error', 'reintento')),
    error text,
    created_at timestamptz not null default now(),
    created_by text
);
create index if not exists billing_email_log_invoice_idx on billing_email_log (invoice_id);

-- ---------------------------------------------------------------------
-- 8. Bitacora de documentos fiscales cargados (CSD, constancias, XML)
--    Nunca guarda el contenido de una llave privada, solo la referencia.
-- ---------------------------------------------------------------------
create table if not exists fiscal_documents (
    id uuid primary key default gen_random_uuid(),
    tipo text not null check (tipo in ('csd_cer', 'efirma_cer', 'constancia', 'xml_emitido', 'xml_recibido', 'otro')),
    nombre_archivo text not null,
    storage_path text,
    relacionado_tipo text,
    relacionado_id uuid,
    hash_sha256 text,
    metadatos jsonb,
    subido_por text,
    created_at timestamptz not null default now()
);
create index if not exists fiscal_documents_rel_idx on fiscal_documents (relacionado_tipo, relacionado_id);

-- ---------------------------------------------------------------------
-- 9. Antiguedad de saldos (CxC). security_invoker para que la vista NO
--    burle el RLS de las tablas base.
-- ---------------------------------------------------------------------
create or replace view ar_aging with (security_invoker = on) as
select
    i.id,
    i.serie,
    i.folio,
    i.uuid,
    i.fecha,
    i.fecha_vencimiento,
    i.total,
    i.saldo,
    i.status,
    c.rfc,
    c.razon_social,
    c.dias_credito,
    greatest(0, current_date - i.fecha_vencimiento) as dias_vencido,
    case
        when i.saldo <= 0 then 'pagada'
        when i.fecha_vencimiento is null then 'sin_vencimiento'
        when current_date <= i.fecha_vencimiento then 'por_vencer'
        when current_date - i.fecha_vencimiento <= 30 then 'v_1_30'
        when current_date - i.fecha_vencimiento <= 60 then 'v_31_60'
        when current_date - i.fecha_vencimiento <= 90 then 'v_61_90'
        else 'v_mas_90'
    end as cubeta
from invoices i
left join billing_clients c on c.id = i.billing_client_id
where i.status <> 'cancelada';

-- ---------------------------------------------------------------------
-- 10. Blindaje: RLS activo, sin policies, y sin privilegios para anon.
-- ---------------------------------------------------------------------
do $$
declare
    t text;
begin
    foreach t in array array[
        'fiscal_settings', 'billing_clients', 'invoices', 'invoice_items',
        'invoice_payments', 'suppliers', 'supplier_bills', 'supplier_payments',
        'billing_email_log', 'fiscal_documents'
    ] loop
        execute format('alter table public.%I enable row level security', t);
        execute format('revoke all on public.%I from anon, authenticated', t);
    end loop;
    execute 'revoke all on public.ar_aging from anon, authenticated';
end $$;
