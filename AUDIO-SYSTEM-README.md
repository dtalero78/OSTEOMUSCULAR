# 🔊 Sistema de Audio Pre-cargado

Sistema híbrido de audio con archivos MP3 pre-grabados profesionales y fallback a Web Speech API.

## 📋 Estado Actual

✅ **Sistema completamente funcional en producción**
✅ **21 archivos MP3 profesionales generados y deployados**
✅ **Compatible con iOS/Safari (fix cloneNode aplicado)**
✅ **Funcionando en DigitalOcean**

## 🎯 Arquitectura

```
┌─────────────────────────────────────┐
│  Paciente se conecta al médico     │
│                                     │
│  ↓ AudioManager.initialize()       │
│                                     │
│  📥 Pre-carga 21 archivos MP3       │
│     (~1.3MB total, 2-4 segundos)    │
│                                     │
│  ✅ Audios en cache (memoria)       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Durante el examen (paciente a 2m)  │
│                                     │
│  Médico envía instrucción           │
│  ↓                                  │
│  speak(text)                        │
│  ↓                                  │
│  ¿Hay MP3 para este texto?          │
│  ├─ SÍ → Reproduce MP3 (0ms)       │
│  └─ NO → speechSynthesis (voz del   │
│          navegador)                 │
└─────────────────────────────────────┘
```

## 📁 Archivos del Sistema

### Código JavaScript
- `/public/js/audio-manager.js` - Clase para pre-carga y reproducción
- `/public/js/audio-text-mapper.js` - Mapea textos a archivos MP3
- `telemedicine-patient.js` - Modificado para usar AudioManager

### Configuración
- `/public/audio/audio-map.json` - Mapa de rutas de archivos
- `audio-phrases.json` - Lista de frases para generar

### Scripts de Generación
- `generate-audio.js` - Script con Google Cloud TTS (requiere API key)
- `generate-audio-simple.js` - Instrucciones para generar manualmente

## 🎙️ Cómo Generar los Audios

### Opción 1: Google Cloud TTS (Recomendada)

1. **Ve a**: https://cloud.google.com/text-to-speech
2. **Configuración**:
   - Idioma: `Spanish (US)`
   - Voz: `es-US-Neural2-A` (femenina, neuronal)
   - Velocidad: `0.85` (15% más lento para claridad)
3. **Ejecuta**:
   ```bash
   node generate-audio-simple.js
   ```
   Esto te dará la lista completa de 21 frases para copiar/pegar

4. **Guarda cada MP3 en**: `/public/audio/` con el nombre exacto

### Opción 2: TTSMaker (Gratis)

1. Ve a: https://ttsmaker.com
2. Selecciona: Spanish (Latin America) - Female
3. Velocidad: Slow
4. Copia cada frase de `generate-audio-simple.js`
5. Descarga el MP3 con el nombre correcto

### Opción 3: Script Automatizado (si tienes API key)

```bash
npm install @google-cloud/text-to-speech
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
node generate-audio.js
```

## 📦 Lista de Archivos MP3 Necesarios

### System (2 archivos)
- `system_audio_activado.mp3`
- `system_audio_instrucciones_activado.mp3`

### Exam Control (3 archivos)
- `exam_examen_iniciado.mp3`
- `exam_examen_finalizado.mp3`
- `exam_secuencia_completada.mp3`

### Guided Sequence (8 archivos)
- `guided_preparacion.mp3`
- `guided_posicion_inicial.mp3`
- `guided_cabeza_erguida.mp3`
- `guided_brazos_horizontal.mp3`
- `guided_brazos_arriba.mp3`
- `guided_brazos_bajar.mp3`
- `guided_analisis_simetria.mp3`
- `guided_captura_final.mp3`

### Dynamic Instructions (8 archivos)
- `instruction_1.mp3` - "Colóquese más cerca de la cámara"
- `instruction_2.mp3` - "Retroceda un poco"
- `instruction_3.mp3` - "Muévase hacia la derecha"
- `instruction_4.mp3` - "Muévase hacia la izquierda"
- `instruction_5.mp3` - "Perfecto, mantenga esa posición"
- `instruction_6.mp3` - "Relaje los hombros"
- `instruction_7.mp3` - "Enderece la espalda"
- `instruction_8.mp3` - "Mire al frente"

**Total: 21 archivos (~500KB)**

## 🚀 Cómo Funciona

### 1. Pre-carga al Conectarse

```javascript
// En showExamScreen()
audioManager.initialize(); // Pre-carga los 21 MP3
```

### 2. Reproducción Durante Examen

```javascript
// En speak(text)
// 1. Busca si hay MP3 para este texto
const audioData = findAudioForText(text);

// 2. Si existe, reproduce MP3
if (audioData) {
    audioManager.play(audioData.category, audioData.key);
}

// 3. Si no, usa speechSynthesis (fallback)
else {
    speechSynthesis.speak(utterance);
}
```

### 3. Ventajas

✅ **Voz consistente** para todos los usuarios
✅ **Alta calidad** - voz profesional femenina
✅ **Latencia 0ms** - reproducción instantánea desde cache
✅ **Funciona offline** después de pre-carga
✅ **Fallback automático** si falta algún MP3

## 🧪 Testing

### 1. Sin archivos MP3 (fallback)
```bash
# Funciona con speechSynthesis
npm start
# Abre: http://localhost:3000/paciente
```

### 2. Con archivos MP3
```bash
# Coloca los 21 MP3 en /public/audio/
npm start
# Consola mostrará: "🔊 Reproduciendo MP3: exam.examen_iniciado"
```

### 3. Debug mode
```
http://localhost:3000/paciente?debug
# Muestra Eruda para ver logs detallados
```

## 📊 Verificación

### Logs de Éxito (con MP3):
```
🔊 AudioManager: Iniciando pre-carga de audios...
📥 Encontrados 21 archivos de audio
  ✓ Cargado: /audio/system_audio_activado.mp3
  ✓ Cargado: /audio/exam_examen_iniciado.mp3
  ...
✅ AudioManager: Todos los audios pre-cargados
🔊 Reproduciendo MP3: exam.examen_iniciado
```

### Logs de Fallback (sin MP3):
```
⚠️ AudioManager: Error cargando audios, usando fallback
🔊 Fallback speechSynthesis: "El médico ha iniciado el examen..." (es-MX)
```

## 🔄 Rollback

Si hay problemas, restaurar a versión anterior:

```bash
git checkout v1.0-stable-web-speech-api
```

Ver [RESTORE.md](RESTORE.md) para más opciones.

## 💰 Costos

### Google Cloud TTS (Generación Única)
- 21 frases × ~50 caracteres = ~1,050 caracteres
- Costo: **~$0.004 USD** (prácticamente gratis)

### Hosting
- 21 archivos MP3 × ~65KB = ~1.3MB total
- Incluido en cualquier plan de hosting
- Voz: es-US-Neural2-A (femenina, velocidad 0.85x)

### Uso (después de generación)
- **$0/mes** - los archivos se sirven como assets estáticos
- Sin llamadas a APIs externas
- Sin límites de uso

## 📝 Historial de Implementación

1. ✅ Código implementado (commit 1858dcb)
2. ✅ 21 archivos MP3 generados con voz profesional (commit c7cbe8f)
3. ✅ Archivos copiados a `/public/audio/`
4. ✅ Configuración de servidor Express (commits 470a7f3, 3a80d54)
5. ✅ Fix compatibilidad iOS/Safari - cloneNode() (commit eb41918)
6. ✅ Sistema probado y funcionando en producción
7. ✅ Deployado en DigitalOcean

## 🐛 Problemas Resueltos

### Fix 1: Archivos MP3 no se cargaban
**Problema**: AudioManager no encontraba los archivos
**Solución**: Agregar `app.use('/audio', express.static('public/audio'))` en server.js

### Fix 2: Scripts JS no se cargaban
**Problema**: audio-manager.js y audio-text-mapper.js retornaban 404
**Solución**: Agregar `app.use('/js', express.static('public/js'))` en server.js

### Fix 3: Error de reproducción en iOS/Safari
**Problema**: DOMException al reproducir audio clonado con `cloneNode()`
**Solución**: Usar `audio.currentTime = 0` en vez de clonar el elemento

## 🆘 Soporte

- Issues: https://github.com/tu-repo/issues
- Docs: Este archivo + [CLAUDE.md](CLAUDE.md)
- Restore: [RESTORE.md](RESTORE.md)
