# Configuración de Transmisión en Vivo de YouTube

## 🎥 Funcionalidad Implementada

El sitio web ahora detecta automáticamente cuando hay una transmisión en vivo de YouTube activa en el canal de la iglesia y la muestra en la sección Hero de la página principal.

### Características:
- ✅ Detección automática de transmisiones en vivo
- ✅ Actualización cada 2 minutos
- ✅ Badge animado "EN VIVO"
- ✅ Video integrado responsive
- ✅ Caché de 2 minutos para reducir llamadas a la API
- ✅ Fallback al carrusel de slides cuando no hay transmisión

## 📋 Configuración Requerida

### Paso 1: Obtener YouTube API Key

1. **Ir a Google Cloud Console**
   - Visita: https://console.cloud.google.com/

2. **Crear un Proyecto** (si no tienes uno)
   - Clic en el selector de proyectos (arriba)
   - Clic en "Nuevo Proyecto"
   - Nombre: "Iglesia Vida Nueva Web"
   - Clic en "Crear"

3. **Habilitar YouTube Data API v3**
   - En el menú lateral: "APIs y servicios" → "Biblioteca"
   - Buscar: "YouTube Data API v3"
   - Clic en el resultado
   - Clic en "HABILITAR"

4. **Crear Credenciales (API Key)**
   - En el menú lateral: "APIs y servicios" → "Credenciales"
   - Clic en "+ CREAR CREDENCIALES"
   - Seleccionar "Clave de API"
   - Se generará una API Key → **Copiar y guardar**

5. **Restringir la API Key** (Recomendado)
   - Clic en la API Key creada
   - En "Restricciones de API":
     - Seleccionar "Restringir clave"
     - Marcar solo "YouTube Data API v3"
   - En "Restricciones de aplicación":
     - Seleccionar "Direcciones IP"
     - Agregar la IP de tu servidor (o "0.0.0.0/0" para desarrollo)
   - Guardar

### Paso 2: Obtener tu Channel ID de YouTube

Hay varias formas de obtener el Channel ID:

**Opción A: Desde tu URL de YouTube**
- Si tu canal es: `youtube.com/@NombreCanal`
- Ir a: `youtube.com/@NombreCanal/about`
- Clic derecho → "Ver código fuente"
- Buscar: `"channelId"` o `"externalId"`
- El Channel ID tiene el formato: `UC...` (24 caracteres)

**Opción B: Desde YouTube Studio**
- Ir a: https://studio.youtube.com
- Clic en tu foto de perfil (arriba derecha)
- Tu Channel ID aparece debajo del nombre

**Opción C: Usar herramienta online**
- Visita: https://commentpicker.com/youtube-channel-id.php
- Pega la URL de tu canal
- Obtén el Channel ID

### Paso 3: Configurar Variables de Entorno

En el servidor, agrega estas variables al archivo `.env`:

```bash
# YouTube API (para transmisiones en vivo)
YOUTUBE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxxx
```

**Ejemplo real:**
```bash
YOUTUBE_API_KEY=AIzaSyBX7vK5Q2H9N3mR8pL4wT6cY1dE2fG3hI4
YOUTUBE_CHANNEL_ID=UC_x5XG1OV2P6uZZ5FSM9Ttw
```

### Paso 4: Reiniciar el Servidor

```bash
cd server
npm run dev
```

## 🧪 Probar la Funcionalidad

### Método 1: Iniciar una Transmisión Real
1. Ve a YouTube Studio
2. Clic en "Crear" → "Emisión en directo"
3. Configura y comienza tu transmisión
4. Espera 2-3 minutos
5. Recarga tu sitio web → Deberías ver el video en vivo

### Método 2: Probar el Endpoint Directamente
```bash
# Verifica el estado
curl http://localhost:3001/api/youtube/live-status

# Respuesta cuando NO hay transmisión:
# {"isLive":false}

# Respuesta cuando SÍ hay transmisión:
# {
#   "isLive": true,
#   "videoId": "dQw4w9WgXcQ",
#   "title": "Culto Dominical - Iglesia Vida Nueva",
#   "description": "...",
#   "thumbnail": "https://..."
# }
```

## 📊 Límites de la API de YouTube

YouTube Data API v3 tiene cuotas diarias:

- **Cuota por defecto:** 10,000 unidades/día
- **Búsqueda de videos en vivo:** 100 unidades por llamada
- **Con caché de 2 minutos:** ~720 llamadas/día = 72,000 unidades

**Recomendación:** Con el sistema de caché implementado, estás muy dentro del límite. Si necesitas más, puedes aumentar el tiempo de caché a 5 minutos.

## 🔧 Personalización

### Cambiar tiempo de actualización
En `client/src/components/HeroSection.jsx`, línea ~40:

```javascript
// Cambiar de 2 minutos a 5 minutos
const interval = setInterval(checkLiveStatus, 5 * 60 * 1000);
```

### Cambiar duración del caché
En `server/index.js`, línea ~520:

```javascript
// Cambiar de 2 minutos a 5 minutos
const LIVE_STREAM_CACHE_DURATION = 5 * 60 * 1000;
```

### Personalizar el iframe
En `client/src/components/HeroSection.jsx`, línea ~60:

```javascript
// Agregar parámetros al iframe:
// - autoplay=0 : no reproducir automáticamente
// - mute=1 : silenciar por defecto
// - start=30 : comenzar en el segundo 30
src={`https://www.youtube.com/embed/${liveStream.videoId}?autoplay=0&mute=1`}
```

## 🐛 Resolución de Problemas

### No se detecta la transmisión en vivo

1. **Verifica las variables de entorno:**
   ```bash
   cd server
   cat .env | grep YOUTUBE
   ```

2. **Verifica que la transmisión esté realmente en vivo:**
   - Ve a YouTube Studio
   - El estado debe ser "EN DIRECTO" (no "Programado")

3. **Verifica el endpoint manualmente:**
   ```bash
   curl http://localhost:3001/api/youtube/live-status
   ```

4. **Revisa los logs del servidor:**
   - Busca errores relacionados con YouTube API

### Error: "Quota exceeded"

Si alcanzas el límite de cuota de YouTube API:
- Aumenta el tiempo de caché a 5 minutos
- Solicita un aumento de cuota en Google Cloud Console

### El video no se reproduce

- Verifica que el iframe tenga `allowFullScreen`
- Verifica que el dominio esté permitido por YouTube
- Intenta agregar `?autoplay=1&mute=1` al URL del iframe

## 📱 Responsividad

El componente es completamente responsive:
- **Desktop:** Video ocupa el 80% de la altura de la ventana
- **Mobile:** Se ajusta automáticamente manteniendo el aspect ratio 16:9

## 🎨 Diseño Visual

- Badge "EN VIVO" animado con pulse effect
- Transición suave entre carrusel y video en vivo
- Fondo negro para mejor contraste

## ⚠️ Notas Importantes

1. **Privacidad:** Solo funciona con transmisiones públicas
2. **Latencia:** Hay un delay de ~2 minutos para detectar cuando inicia/termina una transmisión
3. **Caché:** El estado se cachea 2 minutos para evitar exceder cuotas de API
4. **Seguridad:** Nunca expongas tu API Key en el frontend

## 📚 Referencias

- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)
- [YouTube Live Streaming API](https://developers.google.com/youtube/v3/live/docs)
- [YouTube Embed Parameters](https://developers.google.com/youtube/player_parameters)
