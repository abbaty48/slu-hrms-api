-- ============================================================
-- MIGRATION: Faculty Table + Department Faculty Mapping
-- Institution: Sule Lamido University (SLU)
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1: Create the faculties table
-- ------------------------------------------------------------

DROP TABLE IF EXISTS faculties CASCADE;

CREATE TABLE faculties (
    id          TEXT        PRIMARY KEY,
    name        TEXT        NOT NULL,
    code        TEXT        NOT NULL UNIQUE,
    description TEXT,
    dean_id     TEXT,           -- can be linked to staff(id) later
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- STEP 2: Add faculty_id foreign key column to departments
-- ------------------------------------------------------------

ALTER TABLE departments
    ADD COLUMN IF NOT EXISTS faculty_id TEXT REFERENCES faculties(id);

-- ------------------------------------------------------------
-- STEP 3: Insert faculties
-- ------------------------------------------------------------

INSERT INTO faculties (id, name, code, description, dean_id, created_at, updated_at) VALUES
  ('fac_1', 'Faculty of Natural and Applied Sciences',          'FAC001', 'Covers Mathematics, Biology, Chemistry, Physics, Geography and related sciences.',              NULL, '2024-01-01T08:00:00.000Z', '2024-01-01T08:00:00.000Z'),
  ('fac_2', 'Faculty of Education',                             'FAC002', 'Covers teacher training, science education, and educational development programmes.',          NULL, '2024-01-01T08:00:00.000Z', '2024-01-01T08:00:00.000Z'),
  ('fac_3', 'Faculty of Humanities',                            'FAC003', 'Covers Arabic, Islamic Studies, Languages, English, History and related humanities.',         NULL, '2024-01-01T08:00:00.000Z', '2024-01-01T08:00:00.000Z'),
  ('fac_4', 'Faculty of Computing and Information Technology',  'FAC004', 'Covers Computer Science, IT, Cyber Security, Software Engineering and Library Science.',     NULL, '2024-01-01T08:00:00.000Z', '2024-01-01T08:00:00.000Z'),
  ('fac_5', 'Faculty of Social and Management Sciences',        'FAC005', 'Covers Economics, Sociology, Political Science, Accounting, and Business Management.',       NULL, '2024-01-01T08:00:00.000Z', '2024-01-01T08:00:00.000Z'),
  ('fac_6', 'Faculty of Agriculture and Natural Resource Management', 'FAC006', 'Covers Animal Science, Crop Science, Soil Science, and Agricultural Economics.', NULL, '2024-01-01T08:00:00.000Z', '2024-01-01T08:00:00.000Z'),
  ('fac_7', 'Central Administration',                           'FAC007', 'University-wide administrative, support, and service units.',                                NULL, '2024-01-01T08:00:00.000Z', '2024-01-01T08:00:00.000Z'),
  ('fac_8', 'School of Postgraduate Studies',                   'FAC008', 'Coordinates all postgraduate programmes across the university.',                             NULL, '2024-01-01T08:00:00.000Z', '2024-01-01T08:00:00.000Z'),
  ('fac_9', 'School of Preliminary and Continuing Education',   'FAC009', 'Manages preliminary studies and continuing education programmes.',                          NULL, '2024-01-01T08:00:00.000Z', '2024-01-01T08:00:00.000Z');

-- ------------------------------------------------------------
-- STEP 4: Map each department to its faculty
-- ------------------------------------------------------------

-- ── Faculty of Natural and Applied Sciences (fac_1) ──────────
UPDATE departments SET faculty_id = 'fac_1' WHERE id IN (
    'dept_6',   -- Faculty of Natural and Applied Sciences (faculty-level node)
    'dept_8',   -- Department of Mathematics
    'dept_16',  -- Department of Biology
    'dept_19',  -- Department of Chemistry
    'dept_20',  -- Department of Physics
    'dept_25',  -- Department of Geography
    'dept_45'   -- Department of Natural and Applied Sciences
);

-- ── Faculty of Education (fac_2) ─────────────────────────────
UPDATE departments SET faculty_id = 'fac_2' WHERE id IN (
    'dept_9',   -- Faculty of Education (faculty-level node)
    'dept_13',  -- Department of Science Education
    'dept_18',  -- Department of Education
    'dept_27'   -- Department of Preliminary Studies
);

-- ── Faculty of Humanities (fac_3) ────────────────────────────
UPDATE departments SET faculty_id = 'fac_3' WHERE id IN (
    'dept_22',  -- Faculty of Humanities (faculty-level node)
    'dept_10',  -- Department of Arabic
    'dept_14',  -- Department of Nigeria Languages
    'dept_15',  -- Department of Islamic Studies
    'dept_17',  -- Department of Languages
    'dept_23',  -- Department of English and Literary Studies
    'dept_26',  -- Department of History and International Studies
    'dept_55'   -- Department of Humanities
);

-- ── Faculty of Computing and Information Technology (fac_4) ──
UPDATE departments SET faculty_id = 'fac_4' WHERE id IN (
    'dept_24',  -- Faculty of Computing and Information Technology (faculty-level node)
    'dept_11',  -- Department of Information Technology
    'dept_12',  -- Department of Computer Science
    'dept_28',  -- Department of Library and Information Science
    'dept_52',  -- Department of Cyber Security
    'dept_53'   -- Department of Software Engineering
);

-- ── Faculty of Social and Management Sciences (fac_5) ────────
UPDATE departments SET faculty_id = 'fac_5' WHERE id IN (
    'dept_31',  -- Faculty of Social and Management Sciences (faculty-level node)
    'dept_21',  -- Department of Economics
    'dept_29',  -- Department of Business Management
    'dept_32',  -- Department of Sociology
    'dept_33',  -- Department of Political Science
    'dept_35'   -- Department of Accounting
);

-- ── Faculty of Agriculture and Natural Resource Management (fac_6) ──
UPDATE departments SET faculty_id = 'fac_6' WHERE id IN (
    'dept_37',  -- Faculty of Agriculture and Natural Resource Management (faculty-level node)
    'dept_30',  -- Department of Animal Science
    'dept_34',  -- Department of Crop Science
    'dept_36',  -- Department of Agricultural Economic and Extension
    'dept_38'   -- Department of Soil Science
);

-- ── Central Administration (fac_7) ───────────────────────────
UPDATE departments SET faculty_id = 'fac_7' WHERE id IN (
    'dept_1',   -- Vice Chancellor's Office
    'dept_3',   -- Registry Department
    'dept_4',   -- Haruna Wakili Library
    'dept_5',   -- Guidance and Human Development Center
    'dept_7',   -- Department of Physical Planning and Maintenance Services
    'dept_39',  -- Bursary Department
    'dept_40',  -- Directorate of Internal Audit
    'dept_41',  -- Directorate of Academic Planning
    'dept_42',  -- University Medical Services
    'dept_43',  -- Directorate of Information and Communication Technology
    'dept_44',  -- Students Affairs Division
    'dept_46',  -- Maintenance Services Unit
    'dept_47',  -- Directorate of Research, Innovation and Partnership
    'dept_48',  -- Directorate of Security Services
    'dept_49',  -- University Staff School
    'dept_50',  -- Internal Audit Unit
    'dept_51',  -- Management Information System
    'dept_56'   -- Training Unit
);

-- ── School of Postgraduate Studies (fac_8) ───────────────────
UPDATE departments SET faculty_id = 'fac_8' WHERE id IN (
    'dept_2'    -- School of Postgraduate Studies
);

-- ── School of Preliminary and Continuing Education (fac_9) ───
UPDATE departments SET faculty_id = 'fac_9' WHERE id IN (
    'dept_54'   -- School of Preliminary and Continuing Education
);

-- ------------------------------------------------------------
-- VERIFICATION QUERY (optional — run to confirm mapping)
-- ------------------------------------------------------------
-- SELECT f.name AS faculty, d.name AS department
-- FROM   departments d
-- JOIN   faculties   f ON f.id = d.faculty_id
-- ORDER  BY f.name, d.name;
--
-- -- Check for any unmapped departments:
-- SELECT id, name FROM departments WHERE faculty_id IS NULL;
-- ============================================================
