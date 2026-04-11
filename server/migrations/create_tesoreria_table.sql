-- ============================================================
-- Sistema de Tesorería
-- ============================================================

CREATE TABLE IF NOT EXISTS tesoreria_movimientos (
  id            SERIAL PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  categoria     TEXT NOT NULL,
  monto         DECIMAL(12, 0) NOT NULL CHECK (monto > 0),
  descripcion   TEXT,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  registrado_por INTEGER REFERENCES admin_users(id),
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tesoreria_tipo  ON tesoreria_movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_tesoreria_fecha ON tesoreria_movimientos(fecha);
