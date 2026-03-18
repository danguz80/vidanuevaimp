# Sistema de Autenticación - Instrucciones de Configuración

## Configuración del Backend

### 1. Agregar JWT_SECRET al archivo .env

Agrega esta línea a tu archivo `.env` en el servidor:

```bash
JWT_SECRET=tu_clave_secreta_jwt_muy_segura_y_aleatoria
```

Puedes generar una clave segura con este comando en la terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Crear la tabla de usuarios en PostgreSQL

Ejecuta estos comandos SQL en tu base de datos:

```sql
-- Crear tabla usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear usuario admin por defecto
-- Usuario: admin
-- Contraseña: admin123
INSERT INTO usuarios (username, password_hash) 
VALUES ('admin', '$2a$10$8ZqE.gXqJxGqO0FqYMZQnOy8bKFXGEJzLzPQlZq7YqVZfQoKJO4Hq')
ON CONFLICT (username) DO NOTHING;
```

### 3. Alternativa: Ejecutar el script automatizado

Desde el directorio del servidor, ejecuta:

```bash
node create_admin_user.js
```

Este script creará automáticamente:
- La tabla `usuarios` si no existe
- Un usuario admin con las credenciales:
  - **Usuario:** admin
  - **Contraseña:** admin123

⚠️ **IMPORTANTE:** Cambia la contraseña del usuario admin después del primer login.

## Uso del Sistema

### Acceder al Panel de Administración

1. Ve a `/login` en tu sitio web
2. Ingresa las credenciales:
   - Usuario: `admin`
   - Contraseña: `admin123`
3. Serás redirigido al panel de administración

### Botón Admin en el Header

- Cuando **NO** estás logueado: aparece un botón verde "Admin" que te lleva al login
- Cuando estás logueado: aparece un botón morado "Admin" y un botón "Salir"

### Rutas Protegidas

Las siguientes rutas ahora requieren autenticación:
- `/admin` - Panel principal
- `/admin/mensajes` - Gestión de mensajes de contacto
- `/admin/videos` - Gestión de videos/sermones
- `/admin/hero` - Gestión del hero/slider

## Cambiar la Contraseña

Para cambiar la contraseña del usuario admin, ejecuta este SQL:

```sql
-- Reemplaza 'nueva_contraseña' con tu contraseña deseada
UPDATE usuarios 
SET password_hash = '$2a$10$[nuevo_hash]'
WHERE username = 'admin';
```

O usa este script Node.js:

```javascript
import bcrypt from 'bcryptjs';

const newPassword = 'tu_nueva_contraseña';
const hash = await bcrypt.hash(newPassword, 10);
console.log('Nuevo hash:', hash);
// Copia el hash y actualizalo en la BD
```

## Crear Nuevos Usuarios

Puedes crear nuevos usuarios ejecutando este SQL:

```sql
-- Primero genera el hash de la contraseña con bcrypt
-- Luego inserta el nuevo usuario
INSERT INTO usuarios (username, password_hash) 
VALUES ('nuevo_usuario', 'hash_generado_con_bcrypt');
```

## Notas de Seguridad

- ✅ Las contraseñas se almacenan hasheadas con bcrypt
- ✅ Los tokens JWT expiran después de 24 horas
- ✅ Las rutas admin están protegidas en el backend
- ✅ Las rutas admin están protegidas en el frontend
- ⚠️ Asegúrate de usar HTTPS en producción
- ⚠️ Cambia la contraseña por defecto inmediatamente
