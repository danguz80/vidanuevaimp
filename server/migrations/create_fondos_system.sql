-- ============================================================
-- Sistema de Fondos de Donaciones
-- ============================================================

-- Tabla de fondos con sus metas
CREATE TABLE IF NOT EXISTS fondos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  meta DECIMAL(12, 2) NOT NULL DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insertar los 5 fondos iniciales
INSERT INTO fondos (nombre, descripcion, meta) VALUES
  ('Ofrendas',           'Ofrenda general para el ministerio',         500000),
  ('Sala de Control',    'Equipamiento sala de control audiovisual',   3000000),
  ('Ampliación Cocina',  'Ampliación y mejoras de la cocina',          2000000),
  ('Construcción Escala','Construcción de escala/escalera',            5000000),
  ('Cuotas',             'Cuotas de membresía',                        1000000)
ON CONFLICT DO NOTHING;

-- Agregar columna fondo_id a la tabla donaciones (si no existe)
ALTER TABLE donaciones ADD COLUMN IF NOT EXISTS fondo_id INTEGER REFERENCES fondos(id) DEFAULT 1;

-- Índice para consultas por fondo
CREATE INDEX IF NOT EXISTS idx_donaciones_fondo ON donaciones(fondo_id);
