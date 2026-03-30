-- Tabla de familias (agrupación de miembros con relación familiar)
CREATE TABLE IF NOT EXISTS familias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100),          -- ej. "Familia Guzmán" (opcional)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de relaciones: un miembro pertenece a una familia con un parentesco
CREATE TABLE IF NOT EXISTS familia_miembros (
  id SERIAL PRIMARY KEY,
  familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  miembro_id INTEGER NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
  parentesco VARCHAR(50) NOT NULL DEFAULT 'otro',
  -- parentesco sugerido: cónyuge, padre, madre, hijo, hija, hermano, hermana,
  --                       abuelo, abuela, nieto, nieta, tío, tía, otro
  UNIQUE (familia_id, miembro_id)
);

CREATE INDEX IF NOT EXISTS idx_familia_miembros_familia ON familia_miembros(familia_id);
CREATE INDEX IF NOT EXISTS idx_familia_miembros_miembro ON familia_miembros(miembro_id);
