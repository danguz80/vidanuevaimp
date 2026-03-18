-- Tabla para almacenar donaciones
CREATE TABLE IF NOT EXISTS donaciones (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  payer_name VARCHAR(255),
  amount_clp DECIMAL(10, 2) NOT NULL,
  amount_usd DECIMAL(10, 2) NOT NULL,
  fecha TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para búsquedas rápidas por fecha
CREATE INDEX idx_donaciones_fecha ON donaciones(fecha DESC);

-- Índice para búsquedas por email
CREATE INDEX idx_donaciones_email ON donaciones(email);
