# Guía de Configuración del Sistema de Donaciones

## Configuración del Backend

### 1. Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env` en la carpeta `server/`:

```bash
cd server
cp .env.example .env
```

Luego edita el archivo `.env` con tus credenciales reales.

### 2. Configurar Email para Comprobantes

**Si usas Gmail:**

1. Ve a tu cuenta de Google: https://myaccount.google.com
2. Activa la verificación en 2 pasos si no lo has hecho
3. Ve a: https://myaccount.google.com/apppasswords
4. Genera una "App Password" para la aplicación
5. Usa esa contraseña en `EMAIL_PASSWORD` (NO tu contraseña normal)

**Variables necesarias:**
```env
EMAIL_USER=tu_email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # App Password de 16 caracteres
```

**Si usas otro proveedor de email:**

Modifica el archivo `server/emailService.js` línea 8-14:

```javascript
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.tu-proveedor.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};
```

### 3. Crear la Tabla de Donaciones

Ejecuta el script SQL para crear la tabla en PostgreSQL:

```bash
cd server
node --input-type=module -e "
import dotenv from 'dotenv';
import pkg from 'pg';
import fs from 'fs';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT),
  ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync('./migrations/create_donaciones_table.sql', 'utf8');

pool.query(sql)
  .then(() => {
    console.log('✅ Tabla donaciones creada exitosamente');
    pool.end();
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    pool.end();
    process.exit(1);
  });
"
```

O manualmente en tu cliente PostgreSQL:

```sql
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

CREATE INDEX IF NOT EXISTS idx_donaciones_fecha ON donaciones(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_donaciones_email ON donaciones(email);
```

### 4. Iniciar el Servidor

```bash
cd server
npm run dev
```

## Configuración del Frontend

### 1. Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env` en la carpeta `client/`:

```bash
cd client
cp .env.example .env
```

Edita `VITE_API_URL` según tu entorno:

- **Desarrollo local:** `http://localhost:3001`
- **Producción:** `https://tu-servidor.com`

### 2. Iniciar el Cliente

```bash
cd client
npm run dev
```

## Flujo de Funcionamiento

1. **Usuario ingresa datos:**
   - Selecciona monto en CLP (o ingresa monto personalizado)
   - Opcionalmente ingresa su email

2. **Conversión automática:**
   - El sistema convierte CLP a USD usando tasa de cambio actual
   - PayPal procesa el pago en USD

3. **Procesamiento exitoso:**
   - Se guarda la donación en la base de datos
   - Si hay email, se genera un PDF con el comprobante
   - Se envía el PDF por email al donante
   - Usuario recibe confirmación

## Estructura de la Base de Datos

### Tabla: donaciones

| Campo      | Tipo          | Descripción                    |
|------------|---------------|--------------------------------|
| id         | SERIAL        | ID único autoincremental       |
| order_id   | VARCHAR(255)  | ID de PayPal (único)          |
| email      | VARCHAR(255)  | Email del donante (opcional)   |
| payer_name | VARCHAR(255)  | Nombre del donante (opcional)  |
| amount_clp | DECIMAL(10,2) | Monto en Pesos Chilenos       |
| amount_usd | DECIMAL(10,2) | Monto en Dólares              |
| fecha      | TIMESTAMP     | Fecha de la donación          |
| created_at | TIMESTAMP     | Fecha de registro             |

## Endpoints de la API

### POST /api/donaciones

Registra una nueva donación y envía comprobante por email.

**Request Body:**
```json
{
  "orderId": "PAYPAL_ORDER_ID",
  "email": "donante@email.com",
  "payerName": "Juan Pérez",
  "amountCLP": 10000,
  "amountUSD": 11.11
}
```

**Response:**
```json
{
  "success": true,
  "donation": {
    "id": 1,
    "order_id": "PAYPAL_ORDER_ID",
    "email": "donante@email.com",
    "payer_name": "Juan Pérez",
    "amount_clp": 10000,
    "amount_usd": 11.11,
    "fecha": "2024-02-07T10:30:00Z"
  },
  "emailSent": true
}
```

## Troubleshooting

### Error: No se envían emails

1. Verifica que `EMAIL_USER` y `EMAIL_PASSWORD` estén correctos
2. Si usas Gmail, asegúrate de usar una App Password
3. Verifica que la cuenta tenga 2FA activado
4. Revisa los logs del servidor para más detalles

### Error: No se guarda en la base de datos

1. Verifica las credenciales de PostgreSQL en `.env`
2. Asegúrate de que la tabla `donaciones` existe
3. Verifica que el servidor pueda conectarse a la base de datos

### Error: Conversión de CLP a USD incorrecta

1. El sistema obtiene la tasa de cambio de exchangerate-api.com
2. Si la API falla, usa una tasa de 900 CLP = 1 USD como fallback
3. La tasa se actualiza cada 24 horas automáticamente

## Seguridad

- Nunca subas el archivo `.env` a GitHub (ya está en `.gitignore`)
- Usa App Passwords de Gmail, no tu contraseña real
- En producción, usa HTTPS para todas las comunicaciones
- Considera implementar rate limiting en el endpoint de donaciones
- Valida y sanitiza todos los inputs del usuario

## Personalización

### Cambiar el diseño del PDF

Edita el archivo `server/emailService.js`, función `generateReceiptPDF()`.

### Cambiar el contenido del email

Edita el archivo `server/emailService.js`, función `sendDonationReceipt()`, propiedad `html`.

### Cambiar el remitente del email

Modifica `EMAIL_USER` en `.env` y la línea `from` en `sendDonationReceipt()`.
