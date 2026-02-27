-- ⚠️ PANEL DE OPERACIONES V2 - FULL SETUP ⚠️
-- This script resets the database and adds new fields for the requested upgrades.

-- 1. DROP TABLES (Clean Slate)
DROP TABLE IF EXISTS expenses CASCADE;

DROP TABLE IF EXISTS observations CASCADE;
-- NEW
DROP TABLE IF EXISTS assignments_history CASCADE;

DROP TABLE IF EXISTS units CASCADE;

DROP TABLE IF EXISTS operators CASCADE;

DROP TYPE IF EXISTS unit_type CASCADE;

DROP TYPE IF EXISTS unit_status CASCADE;

-- 2. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. CREATE TABLES

-- Operators (Updated with Phone)
CREATE TABLE operators (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  phone text, -- NEW: Numero de contacto
  active boolean DEFAULT true,
  created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Types
CREATE TYPE unit_type AS ENUM ('Madrina', 'Pipa', 'Contenedor');

CREATE TYPE unit_status AS ENUM (
  'Vacia', 
  'Cargada', 
  'En Taller', 
  'Sin Operador', 
  'Transito Vacio', 
  'Transito Carga'
);

-- Units (Updated with Placas & Details)
CREATE TABLE units (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  economic_number text UNIQUE NOT NULL,
  type unit_type NOT NULL,
  placas text, -- NEW
  details text, -- NEW: Datos adicionales de la unidad
  status unit_status DEFAULT 'Sin Operador',
  current_operator_id uuid REFERENCES operators(id),
  last_status_update timestamp WITH time zone DEFAULT timezone('utc'::text, now()),
  last_modified_by text,
  created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- History
CREATE TABLE assignments_history (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  unit_id uuid REFERENCES units(id) ON DELETE CASCADE, -- Cascade delete if unit removed
  previous_operator_id uuid REFERENCES operators(id),
  new_operator_id uuid REFERENCES operators(id),
  action_type text NOT NULL,
  modified_by text NOT NULL,
  details jsonb,
  timestamp timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Expenses (Updated with 'verified' flag?)
CREATE TABLE expenses (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  operator_id uuid REFERENCES operators(id),
  route text NOT NULL,
  total_amount numeric,
  details jsonb, -- Stores the full breakdown
  verified boolean DEFAULT false,
  created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Observations (NEW: For HR/Admin)
CREATE TABLE observations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  operator_id uuid REFERENCES operators(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'Conducta', 'Diesel', 'Alcoholimetria', 'Accidente', 'Otro'
  description text NOT NULL,
  incident_date timestamp WITH time zone DEFAULT now(),
  reported_by text, -- HR or Admin email/name
  created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. RLS POLICIES (Allow Access)
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

ALTER TABLE assignments_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access Operators" ON operators FOR ALL USING (true);

CREATE POLICY "Public Access Units" ON units FOR ALL USING (true);

CREATE POLICY "Public Access History" ON assignments_history FOR ALL USING (true);

CREATE POLICY "Public Access Expenses" ON expenses FOR ALL USING (true);

CREATE POLICY "Public Access Observations" ON observations FOR ALL USING (true);

-- 5. POPULATE DATA (Preserving original list + Placeholders for new fields)

-- Insert Operators
INSERT INTO
    operators (name, phone)
VALUES (
        'ALVARO PEÑA ZAMORA',
        '5500000001'
    ),
    (
        'SERGIO MOSQUEDA TORRES',
        '5500000002'
    ),
    (
        'ALEJANDRO MAYA ZACAPANTZI',
        '5500000003'
    ),
    (
        'RICARDO MARTIN DOMINGUEZ OLVERA',
        '5500000004'
    ),
    (
        'ALFREDO ROMERO GONZALEZ',
        '5500000005'
    ),
    ('JUAN CARLOS BOBADILLA', NULL),
    (
        'CARLOS ALANIS HERNANDEZ',
        NULL
    ),
    (
        'JESUS BECERRIL ESTEBAN',
        NULL
    ),
    ('EDGAR ROMERO GONZALEZ', NULL),
    ('LUIS ALBERTO REYES', NULL),
    ('ANTONIO JUAREZ MEDINA', NULL),
    (
        'URIEL SANCHEZ DE LA CRUZ',
        NULL
    ),
    (
        'JUAN CARLOS SANCHEZ MORENO',
        NULL
    ),
    ('VALENTIN MARTINEZ', NULL),
    ('BENJAMIN SANCHEZ', NULL),
    (
        'ISRAEL HERNANDEZ PARDO',
        NULL
    ),
    ('GERARDO DELGADO', NULL),
    ('LUIS ALFREDO ROSAS', NULL),
    (
        'JOSE EDUARDO CEDILLO SALDAÑA',
        NULL
    ),
    ('PEDRO HINOJOSA', NULL),
    (
        'JOSE JAVIER SANCHEZ GOMEZ',
        NULL
    ),
    (
        'ANTONIO BIBRIESCA MUÑOZ',
        NULL
    ),
    ('MARCO AVILA JR', NULL),
    ('RICARDO IBARRA BAZAN', NULL),
    ('ROBERTO LUGO MURILLO', NULL),
    ('ALFREDO LOPEZ CUADROS', NULL),
    ('DANIEL NAVARRO', NULL),
    ('EDGAR TORRES RIOS', NULL),
    ('CARLOS TORRES RIOS', NULL),
    ('BRAYAN SALAS GUZMAN', NULL),
    (
        'RAUL MARQUEZ VELAZQUEZ',
        NULL
    ),
    ('HECTOR VARGAS ROSALES', NULL),
    ('CARLOS IBARRA BAZAN', NULL),
    (
        'FELIPE ZEPEDA NEPOMUCENO',
        NULL
    ),
    ('BERNARDO JUAREZ', NULL);

-- Insert Units (Using DO block for logic) using PLACAS from image if visible, else placeholder
DO $$
DECLARE
    op_id uuid;
BEGIN
    -- ATM01 - 51BB2W
    SELECT id INTO op_id FROM operators WHERE name = 'ALVARO PEÑA ZAMORA';
    INSERT INTO units (economic_number, type, placas, status, current_operator_id) VALUES ('ATM01', 'Madrina', '51BB2W', 'Cargada', op_id);

-- ATM02 - 49BB2W
INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM02',
        'Madrina',
        '49BB2W',
        'Sin Operador',
        NULL
    );

-- ATM03 - 50BB2W
SELECT id INTO op_id
FROM operators
WHERE
    name = 'SERGIO MOSQUEDA TORRES';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM03',
        'Madrina',
        '50BB2W',
        'Cargada',
        op_id
    );

-- ATM04 - 50BD8T
SELECT id INTO op_id
FROM operators
WHERE
    name = 'ALEJANDRO MAYA ZACAPANTZI';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM04',
        'Madrina',
        '50BD8T',
        'Cargada',
        op_id
    );

-- ATM05 - 48BD8T
SELECT id INTO op_id
FROM operators
WHERE
    name = 'RICARDO MARTIN DOMINGUEZ OLVERA';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM05',
        'Madrina',
        '48BD8T',
        'Cargada',
        op_id
    );

-- ATM06 - 49BD8T
SELECT id INTO op_id
FROM operators
WHERE
    name = 'ALFREDO ROMERO GONZALEZ';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM06',
        'Madrina',
        '49BD8T',
        'Cargada',
        op_id
    );

-- ATM08 - 65BG8R
SELECT id INTO op_id
FROM operators
WHERE
    name = 'JUAN CARLOS BOBADILLA';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM08',
        'Madrina',
        '65BG8R',
        'Cargada',
        op_id
    );

-- ATM09 - 66BG8R
SELECT id INTO op_id
FROM operators
WHERE
    name = 'CARLOS ALANIS HERNANDEZ';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM09',
        'Madrina',
        '66BG8R',
        'Cargada',
        op_id
    );

-- ATM10 - 30BH2D
SELECT id INTO op_id
FROM operators
WHERE
    name = 'JESUS BECERRIL ESTEBAN';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM10',
        'Madrina',
        '30BH2D',
        'Cargada',
        op_id
    );

-- ATM11 - 29BH2D
SELECT id INTO op_id
FROM operators
WHERE
    name = 'EDGAR ROMERO GONZALEZ';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM11',
        'Madrina',
        '29BH2D',
        'Cargada',
        op_id
    );

-- ATM12 - 41BH4X
SELECT id INTO op_id
FROM operators
WHERE
    name = 'LUIS ALBERTO REYES';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM12',
        'Madrina',
        '41BH4X',
        'Cargada',
        op_id
    );

-- ATM15 - 22BD5T
SELECT id INTO op_id
FROM operators
WHERE
    name = 'ANTONIO JUAREZ MEDINA';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM15',
        'Madrina',
        '22BD5T',
        'Cargada',
        op_id
    );

-- ATM16 - 42BH4X
SELECT id INTO op_id
FROM operators
WHERE
    name = 'URIEL SANCHEZ DE LA CRUZ';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM16',
        'Madrina',
        '42BH4X',
        'Cargada',
        op_id
    );

-- ATM17 - 43BH4X
SELECT id INTO op_id
FROM operators
WHERE
    name = 'JUAN CARLOS SANCHEZ MORENO';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM17',
        'Madrina',
        '43BH4X',
        'Cargada',
        op_id
    );

-- ATM18 - 44BH4X
SELECT id INTO op_id FROM operators WHERE name = 'VALENTIN MARTINEZ';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM18',
        'Madrina',
        '44BH4X',
        'Cargada',
        op_id
    );

-- ATM19 - 52BK9B
SELECT id INTO op_id FROM operators WHERE name = 'BENJAMIN SANCHEZ';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM19',
        'Madrina',
        '52BK9B',
        'Cargada',
        op_id
    );

-- ATM20 - 51BK9B
SELECT id INTO op_id
FROM operators
WHERE
    name = 'ISRAEL HERNANDEZ PARDO';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM20',
        'Madrina',
        '51BK9B',
        'Cargada',
        op_id
    );

-- ATM21 - 53BK9B
SELECT id INTO op_id FROM operators WHERE name = 'GERARDO DELGADO';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM21',
        'Madrina',
        '53BK9B',
        'Cargada',
        op_id
    );

-- ATM22 - 39BK5C
SELECT id INTO op_id
FROM operators
WHERE
    name = 'LUIS ALFREDO ROSAS';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM22',
        'Madrina',
        '39BK5C',
        'Cargada',
        op_id
    );

-- ATM23 - 91BK7C
SELECT id INTO op_id
FROM operators
WHERE
    name = 'JOSE EDUARDO CEDILLO SALDAÑA';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM23',
        'Madrina',
        '91BK7C',
        'Cargada',
        op_id
    );

-- ATM24 - 63BK3V
SELECT id INTO op_id FROM operators WHERE name = 'PEDRO HINOJOSA';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM24',
        'Madrina',
        '63BK3V',
        'Cargada',
        op_id
    );

-- ATM25 - 64BK3V
SELECT id INTO op_id
FROM operators
WHERE
    name = 'JOSE JAVIER SANCHEZ GOMEZ';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM25',
        'Madrina',
        '64BK3V',
        'Cargada',
        op_id
    );

-- ATM26 - 66BK3Y
SELECT id INTO op_id
FROM operators
WHERE
    name = 'ANTONIO BIBRIESCA MUÑOZ';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM26',
        'Madrina',
        '66BK3Y',
        'Cargada',
        op_id
    );

-- ATM27 - 65BK3Y
SELECT id INTO op_id FROM operators WHERE name = 'MARCO AVILA JR';

INSERT INTO
    units (
        economic_number,
        type,
        placas,
        status,
        current_operator_id
    )
VALUES (
        'ATM27',
        'Madrina',
        '65BK3Y',
        'Cargada',
        op_id
    );

-- PIPRAS (AT)
-- AT08
SELECT id INTO op_id
FROM operators
WHERE
    name = 'RICARDO IBARRA BAZAN';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'AT08',
        'Pipa',
        'Cargada',
        op_id
    );

-- AT16
SELECT id INTO op_id
FROM operators
WHERE
    name = 'ROBERTO LUGO MURILLO';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'AT16',
        'Pipa',
        'Cargada',
        op_id
    );

-- AT17
SELECT id INTO op_id
FROM operators
WHERE
    name = 'ALFREDO LOPEZ CUADROS';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'AT17',
        'Pipa',
        'Cargada',
        op_id
    );

-- AT22
SELECT id INTO op_id FROM operators WHERE name = 'DANIEL NAVARRO';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'AT22',
        'Pipa',
        'Cargada',
        op_id
    );

-- AT23
SELECT id INTO op_id FROM operators WHERE name = 'EDGAR TORRES RIOS';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'AT23',
        'Pipa',
        'Cargada',
        op_id
    );

-- ATM13
SELECT id INTO op_id
FROM operators
WHERE
    name = 'CARLOS TORRES RIOS';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM13',
        'Madrina',
        'Cargada',
        op_id
    );

-- AT26
SELECT id INTO op_id
FROM operators
WHERE
    name = 'BRAYAN SALAS GUZMAN';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'AT26',
        'Pipa',
        'Cargada',
        op_id
    );

-- AT28
SELECT id INTO op_id
FROM operators
WHERE
    name = 'RAUL MARQUEZ VELAZQUEZ';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'AT28',
        'Pipa',
        'Cargada',
        op_id
    );

-- AT29
SELECT id INTO op_id
FROM operators
WHERE
    name = 'HECTOR VARGAS ROSALES';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'AT29',
        'Pipa',
        'Cargada',
        op_id
    );

-- AT30
SELECT id INTO op_id
FROM operators
WHERE
    name = 'CARLOS IBARRA BAZAN';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'AT30',
        'Pipa',
        'Cargada',
        op_id
    );

-- AT31
SELECT id INTO op_id
FROM operators
WHERE
    name = 'FELIPE ZEPEDA NEPOMUCENO';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'AT31',
        'Pipa',
        'Cargada',
        op_id
    );

-- ATM14
SELECT id INTO op_id FROM operators WHERE name = 'BERNARDO JUAREZ';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM14',
        'Madrina',
        'Cargada',
        op_id
    );

END $$;