# 🔒 Solución: Error de Permisos de Cámara/Micrófono (Médico)

## ⚠️ Problema Detectado

El sistema no puede acceder a tu cámara/micrófono. Esto impide la conexión de video con el paciente.

---

## ✅ Soluciones Paso a Paso

### **Opción 1: Permitir Permisos en el Popup (Más Común)**

1. **Recargar la página** del médico (`Ctrl+R` o `F5`)
2. Crear nueva sesión
3. **Esperar el popup** que dice: "¿Permitir acceso a cámara y micrófono?"
4. **Hacer clic en "Permitir"**
5. Esperar conexión del paciente

---

### **Opción 2: Desbloquear Permisos en Chrome (Si ya rechazaste antes)**

#### En Chrome:

1. **Hacer clic en el candado** 🔒 a la izquierda de la URL
2. Buscar **"Cámara"** y **"Micrófono"**
3. Cambiar de **"Bloquear"** a **"Permitir"**
4. **Recargar la página** (`Ctrl+R`)
5. Crear nueva sesión

#### Ruta alternativa:

1. Ir a: `chrome://settings/content/camera`
2. En **"Bloqueados"**, buscar tu URL (ej: `https://osteomuscular.com`)
3. Hacer clic en el ícono de **basura** para eliminarlo
4. Hacer lo mismo para micrófono: `chrome://settings/content/microphone`
5. **Recargar la página**

---

### **Opción 3: Verificar HTTPS (Producción)**

#### ⚠️ Problema de Seguridad:

Chrome **NO permite** acceso a cámara/micrófono en **HTTP** (sin candado 🔒).

#### Verificar:

1. Mirar la barra de direcciones
2. ¿Dice `http://` o `https://`?
3. **Si es HTTP**, necesitas:
   - Configurar certificado SSL en el servidor
   - O usar **ngrok/localtunnel** para desarrollo local

#### Solución temporal (desarrollo):

```bash
# Usar ngrok para crear túnel HTTPS
ngrok http 3000

# Usar la URL HTTPS que te da ngrok
# Ejemplo: https://abc123.ngrok.io/medico
```

---

### **Opción 4: Verificar Antivirus/Firewall Corporativo**

Algunos antivirus empresariales bloquean acceso a cámara/micrófono.

#### Verificar:

1. **Desactivar temporalmente** el antivirus
2. Intentar conectar nuevamente
3. Si funciona, **agregar excepción** en el antivirus para tu dominio

#### Configuraciones comunes:

- **Windows Defender**: Configuración → Privacidad → Cámara/Micrófono
- **McAfee/Norton**: Agregar sitio a lista blanca

---

### **Opción 5: Verificar Permisos del Sistema Operativo**

#### En Windows 10/11:

1. **Configuración** → **Privacidad** → **Cámara**
2. Activar: **"Permitir que las aplicaciones accedan a la cámara"**
3. Activar: **"Permitir que las aplicaciones de escritorio accedan a la cámara"**
4. Repetir para **Micrófono**
5. **Reiniciar Chrome**

#### En macOS:

1. **Preferencias del Sistema** → **Seguridad y Privacidad**
2. Pestaña **"Privacidad"**
3. Seleccionar **"Cámara"** en el panel izquierdo
4. Marcar la casilla junto a **Google Chrome**
5. Repetir para **Micrófono**
6. **Reiniciar Chrome**

---

## 🧪 Prueba Rápida

### Test de Cámara/Micrófono:

1. Ir a: **https://webcamtests.com/**
2. Hacer clic en **"Test my cam"**
3. **Si funciona aquí pero NO en tu app** → Problema de permisos específico del dominio
4. **Si NO funciona aquí** → Problema de hardware o sistema operativo

---

## 📞 Soporte Técnico

Si ninguna solución funciona:

1. **Compartir captura de pantalla** del error
2. **Indicar navegador y versión** (Chrome 141.0.0.0 en tu caso)
3. **Sistema operativo** (Windows 10/11, macOS, etc.)
4. **URL exacta** que estás usando (HTTP o HTTPS)

---

## 🔧 Configuración Técnica (Para Desarrolladores)

### Verificar código de permisos en `telemedicine-doctor.js`:

```javascript
// Verificar que se estén solicitando permisos correctamente
const localTracks = await Video.createLocalTracks({
    audio: true,
    video: { width: 640, height: 480 }
});
```

### Agregar mejor manejo de errores:

```javascript
try {
    const localTracks = await Video.createLocalTracks({
        audio: true,
        video: { width: 640, height: 480 }
    });
} catch (error) {
    if (error.name === 'NotAllowedError') {
        alert('⚠️ PERMISOS DENEGADOS\n\n' +
              'Por favor, permite el acceso a tu cámara y micrófono.\n\n' +
              '1. Haz clic en el candado 🔒 en la barra de direcciones\n' +
              '2. Cambia "Cámara" y "Micrófono" a "Permitir"\n' +
              '3. Recarga la página');
    }
    throw error;
}
```

---

## ✅ Verificación Final

Después de aplicar la solución:

1. **Recargar la página** del médico
2. **Crear nueva sesión**
3. **Verificar que aparece el video local** del médico
4. **Conectar paciente**
5. **Verificar video bidireccional**

---

**Última actualización**: 17/10/2025
**Caso de referencia**: Sesión D86BYE (Dr. JUAN - Paciente YEISSON ORTIZ)
