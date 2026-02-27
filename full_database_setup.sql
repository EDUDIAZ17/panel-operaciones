-- ⚠️ WARNING: THIS SCRIPT WILL RESET THE ENTIRE DATABASE ⚠️
-- It drops existing tables and recreates them to ensure a clean state.

-- 1. DROP TABLES (Clean Slate)
DROP TABLE IF EXISTS expenses CASCADE;

DROP TABLE IF EXISTS assignments_history CASCADE;

DROP TABLE IF EXISTS units CASCADE;

DROP TABLE IF EXISTS operators CASCADE;

DROP TYPE IF EXISTS unit_type CASCADE;

DROP TYPE IF EXISTS unit_status CASCADE;

-- 2. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. CREATE TABLES

-- Operators
CREATE TABLE operators (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
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

-- Units
CREATE TABLE units (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  economic_number text UNIQUE NOT NULL,
  type unit_type NOT NULL,
  status unit_status DEFAULT 'Sin Operador',
  current_operator_id uuid REFERENCES operators(id),
  last_status_update timestamp WITH time zone DEFAULT timezone('utc'::text, now()),
  last_modified_by text,
  created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- History
CREATE TABLE assignments_history (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  unit_id uuid REFERENCES units(id),
  previous_operator_id uuid REFERENCES operators(id),
  new_operator_id uuid REFERENCES operators(id),
  action_type text NOT NULL,
  modified_by text NOT NULL,
  details jsonb,
  timestamp timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Expenses
CREATE TABLE expenses (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  operator_id uuid REFERENCES operators(id),
  route text NOT NULL,
  total_amount numeric,
  details jsonb,
  created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. RLS POLICIES (Allow Access)
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

ALTER TABLE assignments_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access Operators" ON operators FOR ALL USING (true);

CREATE POLICY "Public Access Units" ON units FOR ALL USING (true);

CREATE POLICY "Public Access History" ON assignments_history FOR ALL USING (true);

CREATE POLICY "Public Access Expenses" ON expenses FOR ALL USING (true);

-- 5. POPULATE DATA (Inserts)

-- Insert Operators
INSERT INTO
    operators (name)
VALUES ('ALVARO PEÑA ZAMORA'),
    ('SERGIO MOSQUEDA TORRES'),
    ('ALEJANDRO MAYA ZACAPANTZI'),
    (
        'RICARDO MARTIN DOMINGUEZ OLVERA'
    ),
    ('ALFREDO ROMERO GONZALEZ'),
    ('JUAN CARLOS BOBADILLA'),
    ('CARLOS ALANIS HERNANDEZ'),
    ('JESUS BECERRIL ESTEBAN'),
    ('EDGAR ROMERO GONZALEZ'),
    ('LUIS ALBERTO REYES'),
    ('ANTONIO JUAREZ MEDINA'),
    ('URIEL SANCHEZ DE LA CRUZ'),
    ('JUAN CARLOS SANCHEZ MORENO'),
    ('VALENTIN MARTINEZ'),
    ('BENJAMIN SANCHEZ'),
    ('ISRAEL HERNANDEZ PARDO'),
    ('GERARDO DELGADO'),
    ('LUIS ALFREDO ROSAS'),
    (
        'JOSE EDUARDO CEDILLO SALDAÑA'
    ),
    ('PEDRO HINOJOSA'),
    ('JOSE JAVIER SANCHEZ GOMEZ'),
    ('ANTONIO BIBRIESCA MUÑOZ'),
    ('MARCO AVILA JR'),
    ('RICARDO IBARRA BAZAN'),
    ('ROBERTO LUGO MURILLO'),
    ('ALFREDO LOPEZ CUADROS'),
    ('DANIEL NAVARRO'),
    ('EDGAR TORRES RIOS'),
    ('CARLOS TORRES RIOS'),
    ('BRAYAN SALAS GUZMAN'),
    ('RAUL MARQUEZ VELAZQUEZ'),
    ('HECTOR VARGAS ROSALES'),
    ('CARLOS IBARRA BAZAN'),
    ('FELIPE ZEPEDA NEPOMUCENO'),
    ('BERNARDO JUAREZ');

-- Insert Units (Using DO block for logic)
DO $$
DECLARE
    op_id uuid;
BEGIN
    -- ATM01
    SELECT id INTO op_id FROM operators WHERE name = 'ALVARO PEÑA ZAMORA';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM01', 'Madrina', 'Cargada', op_id);

-- ATM02 (Sin Operador)
INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM02',
        'Madrina',
        'Sin Operador',
        NULL
    );

-- ATM03
SELECT id INTO op_id
FROM operators
WHERE
    name = 'SERGIO MOSQUEDA TORRES';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM03',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM04
SELECT id INTO op_id
FROM operators
WHERE
    name = 'ALEJANDRO MAYA ZACAPANTZI';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM04',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM05
SELECT id INTO op_id
FROM operators
WHERE
    name = 'RICARDO MARTIN DOMINGUEZ OLVERA';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM05',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM06
SELECT id INTO op_id
FROM operators
WHERE
    name = 'ALFREDO ROMERO GONZALEZ';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM06',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM08 (skipped 7 per list)
SELECT id INTO op_id
FROM operators
WHERE
    name = 'JUAN CARLOS BOBADILLA';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM08',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM09
SELECT id INTO op_id
FROM operators
WHERE
    name = 'CARLOS ALANIS HERNANDEZ';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM09',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM10
SELECT id INTO op_id
FROM operators
WHERE
    name = 'JESUS BECERRIL ESTEBAN';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM10',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM11
SELECT id INTO op_id
FROM operators
WHERE
    name = 'EDGAR ROMERO GONZALEZ';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM11',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM12
SELECT id INTO op_id
FROM operators
WHERE
    name = 'LUIS ALBERTO REYES';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM12',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM15
SELECT id INTO op_id
FROM operators
WHERE
    name = 'ANTONIO JUAREZ MEDINA';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM15',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM16
SELECT id INTO op_id
FROM operators
WHERE
    name = 'URIEL SANCHEZ DE LA CRUZ';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM16',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM17
SELECT id INTO op_id
FROM operators
WHERE
    name = 'JUAN CARLOS SANCHEZ MORENO';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM17',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM18
SELECT id INTO op_id FROM operators WHERE name = 'VALENTIN MARTINEZ';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM18',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM19
SELECT id INTO op_id FROM operators WHERE name = 'BENJAMIN SANCHEZ';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM19',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM20
SELECT id INTO op_id
FROM operators
WHERE
    name = 'ISRAEL HERNANDEZ PARDO';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM20',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM21
SELECT id INTO op_id FROM operators WHERE name = 'GERARDO DELGADO';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM21',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM22
SELECT id INTO op_id
FROM operators
WHERE
    name = 'LUIS ALFREDO ROSAS';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM22',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM23
SELECT id INTO op_id
FROM operators
WHERE
    name = 'JOSE EDUARDO CEDILLO SALDAÑA';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM23',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM24
SELECT id INTO op_id FROM operators WHERE name = 'PEDRO HINOJOSA';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM24',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM25
SELECT id INTO op_id
FROM operators
WHERE
    name = 'JOSE JAVIER SANCHEZ GOMEZ';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM25',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM26
SELECT id INTO op_id
FROM operators
WHERE
    name = 'ANTONIO BIBRIESCA MUÑOZ';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM26',
        'Madrina',
        'Cargada',
        op_id
    );

-- ATM27
SELECT id INTO op_id FROM operators WHERE name = 'MARCO AVILA JR';

INSERT INTO
    units (
        economic_number,
        type,
        status,
        current_operator_id
    )
VALUES (
        'ATM27',
        'Madrina',
        'Cargada',
        op_id
    );

-- PIPS (AT)
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

-- ATM13 (As per list)
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