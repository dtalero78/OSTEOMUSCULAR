# 🔧 Troubleshooting: Twilio Error 20103 - Invalid Access Token issuer/subject

## 🚨 Error Detectado

**Código de error**: `20103`
**Mensaje**: `Invalid Access Token issuer/subject`
**Tipo**: `TwilioError`

**Caso real**: Sesión K15IKZ (Dr. SIXTA - Paciente CAMILA MUÑOZ) - 17/10/2025, 11:27:23

---

## 🔍 Diagnóstico

### Resultado del Script de Diagnóstico:

✅ **Token JWT se genera correctamente** (credenciales con formato válido)
❌ **API de Twilio rechaza autenticación** (problema con la cuenta)

### ¿Qué significa este error?

El error 20103 ocurre cuando:

1. **Account SID y API Key no coinciden** (de cuentas diferentes)
2. **API Key fue revocada** en Twilio Console
3. **Cuenta de Twilio suspendida** por falta de pago
4. **Cuenta de Twilio desactivada** o en período de prueba vencido
5. **Límites de cuenta excedidos** (free tier agotado)

---

## 💰 ¿Será por Pago? (PROBABLE)

### Indicadores que sugieren problema de pago:

1. ✅ **Token JWT se genera** → Credenciales técnicamente correctas
2. ❌ **API rechaza autenticación** → Cuenta con restricciones
3. ❌ **Error específico 20103** → Problema de "issuer" (emisor del token)

### Posibles Causas Relacionadas con Pago:

#### A) Cuenta de Prueba Vencida
- Twilio da **$15 USD de crédito inicial**
- Después de gastar los $15, **la cuenta se suspende**
- **Solución**: Agregar tarjeta de crédito y recargar saldo

#### B) Saldo Insuficiente
- Twilio cobra por uso (minutos de video, participantes)
- Si el saldo llega a **$0**, la cuenta se suspende temporalmente
- **Solución**: Recargar saldo en la cuenta

#### C) Pago Rechazado
- Tarjeta de crédito expirada o rechazada
- Twilio suspende servicios hasta resolver el pago
- **Solución**: Actualizar método de pago

#### D) Límites de Free Tier Excedidos
- Plan gratuito tiene límites (ej: 10 salas concurrentes)
- Al exceder, se requiere upgrade a plan pago
- **Solución**: Upgrade a plan pago

---

## ✅ Soluciones Paso a Paso

### 1. Verificar Estado de la Cuenta de Twilio

1. **Ir a Twilio Console**: https://console.twilio.com/
2. **Iniciar sesión** con la cuenta asociada al Account SID (`ACbae12b4b...`)
3. **Revisar el banner superior**:
   - ¿Aparece un mensaje de "Suspended" o "Trial expired"?
   - ¿Hay una alerta de pago pendiente?
4. **Ir a Billing**: https://console.twilio.com/billing/overview
   - Ver saldo actual
   - Ver estado de la cuenta (Active / Suspended / Trial)

### 2. Verificar Saldo y Agregar Fondos

**Si el saldo está en $0 o la cuenta está suspendida**:

1. Ir a: https://console.twilio.com/billing/manage-billing
2. Click en **"Add Funds"** o **"Recharge Balance"**
3. Agregar al menos **$20 USD** para uso mensual
4. Esperar 2-5 minutos a que se active la cuenta

**Costo estimado mensual**:
- **50 sesiones/día** (médico + paciente = 2 participantes)
- **10 minutos promedio por sesión**
- **Costo**: ~$0.002/min/participante
- **Total**: 50 × 10min × 2 × $0.002 = **$2/día** → **~$60/mes**

### 3. Verificar API Key Activa

1. Ir a: https://console.twilio.com/develop/api-keys/project-api-keys
2. Buscar la API Key con SID: `SK35758657...`
3. Verificar estado:
   - ✅ **Active** → La key está activa
   - ❌ **Revoked** → Necesitas crear una nueva API Key

**Si está revocada, crear nueva API Key**:

1. Click en **"Create new API Key"**
2. Nombre: `Telemedicina-Video`
3. Copiar el **SID** (SK...) y el **Secret** (alfanumérico)
4. Actualizar `.env`:
   ```bash
   TWILIO_API_KEY_SID=SK...
   TWILIO_API_KEY_SECRET=...
   ```
5. Reiniciar el servidor

### 4. Verificar Account SID y Auth Token

**Es posible que se estén usando credenciales de otra cuenta**:

1. Ir a: https://console.twilio.com/
2. Copiar **Account SID** (AC...) y **Auth Token**
3. Comparar con los valores en `.env`:
   ```bash
   TWILIO_ACCOUNT_SID=ACbae12b4b...
   TWILIO_AUTH_TOKEN=8efd230fa5...
   ```
4. Si son diferentes, **actualizar `.env`** con los correctos
5. Reiniciar el servidor: `npm start`

### 5. Upgrade de Cuenta (Si es Trial)

**Si la cuenta está en período de prueba**:

1. Ir a: https://console.twilio.com/billing/upgrade
2. Click en **"Upgrade Account"**
3. Ingresar tarjeta de crédito válida
4. Aceptar términos y condiciones
5. Esperar confirmación de upgrade (2-5 minutos)

---

## 🧪 Validación Post-Fix

Después de aplicar cualquier solución, **reiniciar el servidor** y probar:

```bash
# Detener servidor actual
pkill -f "node server.js"

# Reiniciar servidor
npm start
```

**Prueba de conexión**:

1. Doctor abre `/medico`
2. Crear sesión (debe generar código)
3. Paciente abre `/paciente` y conecta
4. **Verificar que NO aparezca error 20103**
5. **Verificar que aparezcan videos** de ambos lados

---

## 📊 Monitoreo de Costos

### Cómo evitar sorpresas en la factura:

1. **Configurar alertas de saldo**: https://console.twilio.com/billing/alerts
   - Alerta cuando saldo < $10
   - Alerta cuando gasto diario > $5

2. **Revisar uso diario**: https://console.twilio.com/monitor/usage
   - Minutos de video consumidos
   - Número de salas activas
   - Costo acumulado del mes

3. **Optimizar uso**:
   - Cerrar salas cuando termina la consulta
   - Limitar duración máxima de sesiones (ej: 30 min)
   - Usar calidad de video adaptativa (ya implementado)

---

## 🔍 Logs para Verificar Fix

**Antes del fix** (error):
```
❌ doctor (K15IKZ)
   Error conectando a Twilio
   Detalles: {"error":"Invalid Access Token issuer/subject","errorName":"TwilioError","errorCode":20103}
```

**Después del fix** (exitoso):
```
✅ doctor (K15IKZ)
   Conectado a Twilio Video
   Sala: K15IKZ
   Participantes: 2
```

---

## 📞 Soporte de Twilio

Si ninguna solución funciona:

1. **Twilio Support**: https://support.twilio.com/
2. **Email**: help@twilio.com
3. **Documentación**: https://www.twilio.com/docs/video/troubleshooting
4. **Error 20103 específico**: https://www.twilio.com/docs/iam/errors/20103

---

## 🎯 Resumen Ejecutivo

| Problema | Causa Probable | Solución | Tiempo |
|----------|----------------|----------|--------|
| Error 20103 | Cuenta suspendida por falta de pago | Recargar saldo ($20+ USD) | 5 min |
| Error 20103 | Cuenta en trial vencida | Upgrade a cuenta paga | 5 min |
| Error 20103 | API Key revocada | Crear nueva API Key | 2 min |
| Error 20103 | Credenciales de otra cuenta | Actualizar Account SID/Auth Token | 1 min |

**Acción recomendada**: Verificar saldo en Twilio Console → Recargar si está en $0 → Reiniciar servidor.

---

**Última actualización**: 17/10/2025
**Caso de referencia**: Sesión K15IKZ (Dr. SIXTA - Paciente CAMILA MUÑOZ)
