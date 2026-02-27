-- Clean up existing data to avoid duplicates (optional, use with caution)
-- delete from active_assignments; -- If you had this table
delete from units;

delete from operators;

-- 1. Insert Operators (Extracting unique names from the list)
-- Note: In a real script we might do this dynamically, but SQL requires IDs.
-- For simplicity in this "RAPIDA" constraint, we will insert operators and then units.

-- We'll use a temporary function to help link them, or just simple inserts.
-- Actually, since we need to link them, it's easier to do this:
-- Insert all operators first.

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

-- 2. Insert Units & Assign Operators
-- We use a CTE or subqueries to find the operator ID.

DO $$
DECLARE
    op_id uuid;
BEGIN
    -- Helper to get ID. If not found, leaves it null (Sin Operador)
    
    -- ATM01
    SELECT id INTO op_id FROM operators WHERE name = 'ALVARO PEÑA ZAMORA';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM01', 'Madrina', 'Cargada', op_id);
    
    -- ATM02 (Sin Operador)
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM02', 'Madrina', 'Sin Operador', NULL);
    
    -- ATM03
    SELECT id INTO op_id FROM operators WHERE name = 'SERGIO MOSQUEDA TORRES';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM03', 'Madrina', 'Cargada', op_id);
    
    -- ATM04
    SELECT id INTO op_id FROM operators WHERE name = 'ALEJANDRO MAYA ZACAPANTZI';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM04', 'Madrina', 'Cargada', op_id);

    -- ATM05
    SELECT id INTO op_id FROM operators WHERE name = 'RICARDO MARTIN DOMINGUEZ OLVERA';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM05', 'Madrina', 'Cargada', op_id);

    -- ATM06
    SELECT id INTO op_id FROM operators WHERE name = 'ALFREDO ROMERO GONZALEZ';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM06', 'Madrina', 'Cargada', op_id);

    -- ATM08
    SELECT id INTO op_id FROM operators WHERE name = 'JUAN CARLOS BOBADILLA';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM08', 'Madrina', 'Cargada', op_id);

    -- ATM09
    SELECT id INTO op_id FROM operators WHERE name = 'CARLOS ALANIS HERNANDEZ';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM09', 'Madrina', 'Cargada', op_id);

    -- ATM10
    SELECT id INTO op_id FROM operators WHERE name = 'JESUS BECERRIL ESTEBAN';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM10', 'Madrina', 'Cargada', op_id);

    -- ATM11
    SELECT id INTO op_id FROM operators WHERE name = 'EDGAR ROMERO GONZALEZ';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM11', 'Madrina', 'Cargada', op_id);

    -- ATM12
    SELECT id INTO op_id FROM operators WHERE name = 'LUIS ALBERTO REYES';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM12', 'Madrina', 'Cargada', op_id);

    -- ATM15
    SELECT id INTO op_id FROM operators WHERE name = 'ANTONIO JUAREZ MEDINA';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM15', 'Madrina', 'Cargada', op_id);

    -- ATM16
    SELECT id INTO op_id FROM operators WHERE name = 'URIEL SANCHEZ DE LA CRUZ';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM16', 'Madrina', 'Cargada', op_id);

    -- ATM17
    SELECT id INTO op_id FROM operators WHERE name = 'JUAN CARLOS SANCHEZ MORENO';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM17', 'Madrina', 'Cargada', op_id);

    -- ATM18
    SELECT id INTO op_id FROM operators WHERE name = 'VALENTIN MARTINEZ';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM18', 'Madrina', 'Cargada', op_id);

    -- ATM19
    SELECT id INTO op_id FROM operators WHERE name = 'BENJAMIN SANCHEZ';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM19', 'Madrina', 'Cargada', op_id);

    -- ATM20
    SELECT id INTO op_id FROM operators WHERE name = 'ISRAEL HERNANDEZ PARDO';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM20', 'Madrina', 'Cargada', op_id);

    -- ATM21
    SELECT id INTO op_id FROM operators WHERE name = 'GERARDO DELGADO';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM21', 'Madrina', 'Cargada', op_id);

    -- ATM22
    SELECT id INTO op_id FROM operators WHERE name = 'LUIS ALFREDO ROSAS';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM22', 'Madrina', 'Cargada', op_id);

    -- ATM23
    SELECT id INTO op_id FROM operators WHERE name = 'JOSE EDUARDO CEDILLO SALDAÑA';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM23', 'Madrina', 'Cargada', op_id);

    -- ATM24
    SELECT id INTO op_id FROM operators WHERE name = 'PEDRO HINOJOSA';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM24', 'Madrina', 'Cargada', op_id);

    -- ATM25
    SELECT id INTO op_id FROM operators WHERE name = 'JOSE JAVIER SANCHEZ GOMEZ';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM25', 'Madrina', 'Cargada', op_id);

    -- ATM26
    SELECT id INTO op_id FROM operators WHERE name = 'ANTONIO BIBRIESCA MUÑOZ';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM26', 'Madrina', 'Cargada', op_id);

    -- ATM27
    SELECT id INTO op_id FROM operators WHERE name = 'MARCO AVILA JR';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM27', 'Madrina', 'Cargada', op_id);

    -- PIPRAS (AT)
    -- AT08
    SELECT id INTO op_id FROM operators WHERE name = 'RICARDO IBARRA BAZAN';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('AT08', 'Pipa', 'Cargada', op_id);

    -- AT16
    SELECT id INTO op_id FROM operators WHERE name = 'ROBERTO LUGO MURILLO';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('AT16', 'Pipa', 'Cargada', op_id);

    -- AT17
    SELECT id INTO op_id FROM operators WHERE name = 'ALFREDO LOPEZ CUADROS';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('AT17', 'Pipa', 'Cargada', op_id);

    -- AT22
    SELECT id INTO op_id FROM operators WHERE name = 'DANIEL NAVARRO';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('AT22', 'Pipa', 'Cargada', op_id);

    -- AT23
    SELECT id INTO op_id FROM operators WHERE name = 'EDGAR TORRES RIOS';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('AT23', 'Pipa', 'Cargada', op_id);

    -- ATM13 (Listed in 2nd table, likely Madrina based on prefix?) Assuming Madrina unless AT prefix.
    -- Table had "ATM13" with "CARLOS TORRES RIOS"
    SELECT id INTO op_id FROM operators WHERE name = 'CARLOS TORRES RIOS';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM13', 'Madrina', 'Cargada', op_id);

    -- AT26
    SELECT id INTO op_id FROM operators WHERE name = 'BRAYAN SALAS GUZMAN';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('AT26', 'Pipa', 'Cargada', op_id);

    -- AT28
    SELECT id INTO op_id FROM operators WHERE name = 'RAUL MARQUEZ VELAZQUEZ';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('AT28', 'Pipa', 'Cargada', op_id);

    -- AT29
    SELECT id INTO op_id FROM operators WHERE name = 'HECTOR VARGAS ROSALES';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('AT29', 'Pipa', 'Cargada', op_id);

    -- AT30
    SELECT id INTO op_id FROM operators WHERE name = 'CARLOS IBARRA BAZAN';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('AT30', 'Pipa', 'Cargada', op_id);

    -- AT31
    SELECT id INTO op_id FROM operators WHERE name = 'FELIPE ZEPEDA NEPOMUCENO';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('AT31', 'Pipa', 'Cargada', op_id);

    -- ATM14
    SELECT id INTO op_id FROM operators WHERE name = 'BERNARDO JUAREZ';
    INSERT INTO units (economic_number, type, status, current_operator_id) VALUES ('ATM14', 'Madrina', 'Cargada', op_id);

END $$;