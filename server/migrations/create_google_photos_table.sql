-- Tabla para almacenar los álbumes de Google Photos configurados
CREATE TABLE IF NOT EXISTS google_photos_albums (
  id         SERIAL PRIMARY KEY,
  nombre     VARCHAR(255) NOT NULL,
  album_id   VARCHAR(512) NOT NULL UNIQUE,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla para cachear los resultados de la API de Google Photos
-- Evita llamadas excesivas y resuelve el límite de quota
CREATE TABLE IF NOT EXISTS google_photos_cache (
  id         SERIAL PRIMARY KEY,
  album_id   VARCHAR(512) NOT NULL UNIQUE,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
