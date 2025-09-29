# 🏥 Examen Osteomuscular Virtual

Sistema de análisis postural y articular en tiempo real usando MediaPipe Pose Landmarker para evaluaciones médicas no invasivas.

## ✨ Características Principales

### 🎯 Análisis Médico Especializado
- **Evaluación Postural**: Alineación cervical, inclinación pélvica, desviación lateral
- **Análisis Articular**: Ángulos de hombros, caderas, codos, rodillas
- **Simetría Corporal**: Balance entre lado izquierdo y derecho
- **Métricas en Tiempo Real**: Visualización instantánea de parámetros

### 🔬 Capacidades Clínicas
- Detección de **33 puntos corporales** con precisión médica
- Cálculo automático de **ángulos articulares**
- Evaluación de **rangos de movimiento**
- Análisis de **simetría bilateral**
- Generación de **reportes médicos** exportables

### 💻 Tecnología Web Avanzada
- **100% Web**: No requiere instalación de software
- **Tiempo Real**: Análisis instantáneo con cámara web
- **Responsive**: Funciona en cualquier dispositivo
- **Exportable**: Reportes en formato JSON

## 🚀 Inicio Rápido

### 1. Requisitos del Sistema
```
✅ Navegador web moderno (Chrome, Firefox, Safari)
✅ Cámara web funcional
✅ Conexión a internet (para cargar MediaPipe)
✅ Iluminación adecuada
✅ Espacio de 2-3 metros frente a la cámara
```

### 2. Instalación
```bash
# Clonar el repositorio
git clone https://github.com/google-ai-edge/mediapipe-samples
cd mediapipe-samples/examen_osteomuscular_web

# Servir archivos (usando Python)
python3 -m http.server 8000

# O usando Node.js
npx http-server -p 8000

# Abrir en navegador
http://localhost:8000
```

### 3. Uso Médico

#### 🏥 Preparación del Paciente
1. **Posicionamiento**: Paciente de pie a 2 metros de la cámara
2. **Vestimenta**: Ropa ajustada que permita ver articulaciones
3. **Iluminación**: Luz uniforme sin sombras marcadas
4. **Fondo**: Preferiblemente liso y contrastado

#### 📋 Tipos de Examen

**🔸 Evaluación Postural**
- Análisis estático de alineación corporal
- Detección de desviaciones cervicales
- Medición de inclinación pélvica
- Cálculo de desviación lateral

**🔸 Rangos de Movimiento**
- Evaluación dinámica de articulaciones
- Medición de flexión/extensión
- Análisis de abducción/aducción
- Seguimiento de rotaciones

**🔸 Análisis de Simetría**
- Comparación bilateral de estructuras
- Detección de asimetrías
- Cálculo de balance corporal
- Evaluación de compensaciones

**🔸 Examen Completo**
- Combinación de todas las evaluaciones
- Reporte integral del paciente
- Recomendaciones clínicas
- Seguimiento temporal

## 📊 Métricas Médicas

### 🏃‍♀️ Parámetros Posturales

| Métrica | Rango Normal | Unidad | Descripción |
|---------|--------------|--------|-------------|
| Alineación Cervical | 0-10° | Grados | Desviación de cabeza respecto a hombros |
| Inclinación Pélvica | 0-5° | Grados | Desnivel entre caderas izquierda y derecha |
| Desviación Lateral | 0-20mm | Milímetros | Desplazamiento del eje central corporal |

### 🦴 Ángulos Articulares

| Articulación | Rango Normal | Evaluación |
|--------------|--------------|------------|
| Hombro | 170-180° | Extensión completa |
| Codo | 0-150° | Flexión máxima |
| Cadera | 170-180° | Extensión en bipedestación |
| Rodilla | 170-180° | Extensión completa |

### ⚖️ Índices de Simetría

| Índice | Rango Normal | Interpretación |
|--------|--------------|----------------|
| Simetría Hombros | >90% | Equilibrio bilateral |
| Simetría Caderas | >90% | Balance pélvico |
| Balance General | >80% | Compensación global |

## 🔧 Funcionalidades Técnicas

### 📸 Captura de Datos
```javascript
// Captura instantánea para reporte
captureSnapshot() {
    const snapshot = {
        timestamp: new Date().toISOString(),
        patientName: this.patientData.name,
        examType: this.currentExamType,
        metrics: this.currentMetrics
    };

    this.patientData.results.push(snapshot);
}
```

### 📈 Cálculos Médicos
```javascript
// Cálculo de ángulo articular entre 3 puntos
calculateAngle(point1, point2, point3) {
    const vector1 = {
        x: point1.x - point2.x,
        y: point1.y - point2.y
    };

    const vector2 = {
        x: point3.x - point2.x,
        y: point3.y - point2.y
    };

    const dot = vector1.x * vector2.x + vector1.y * vector2.y;
    const mag1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
    const mag2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);

    return Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
}
```

### 📄 Generación de Reportes
```javascript
// Exportar reporte médico completo
exportReport() {
    const report = {
        patientInfo: {
            name: this.patientData.name,
            date: new Date().toLocaleDateString('es-ES'),
            examType: this.currentExamType
        },
        summary: this.currentMetrics,
        snapshots: this.patientData.results,
        recommendations: this.generateRecommendations()
    };

    // Descargar como JSON
    const blob = new Blob([JSON.stringify(report, null, 2)],
                         { type: 'application/json' });
}
```

## 🏥 Aplicaciones Clínicas

### 🔬 Fisioterapia
- **Evaluación inicial** de pacientes
- **Seguimiento** de progreso en rehabilitación
- **Detección temprana** de descompensaciones
- **Educación** postural del paciente

### 🦴 Ortopedia
- **Screening** de alteraciones posturales
- **Evaluación** de asimetrías
- **Seguimiento** post-quirúrgico
- **Planificación** de tratamientos

### 🏃‍♀️ Medicina Deportiva
- **Análisis** de patrones de movimiento
- **Prevención** de lesiones
- **Optimización** del rendimiento
- **Evaluación** funcional

### 👥 Medicina Ocupacional
- **Evaluación** de riesgos ergonómicos
- **Screening** laboral
- **Prevención** de lesiones laborales
- **Adaptación** de puestos de trabajo

## ⚙️ Configuración Avanzada

### 🎛️ Parámetros de MediaPipe
```javascript
const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
        modelAssetPath: 'pose_landmarker_lite.task',
        delegate: 'GPU'  // Aceleración por hardware
    },
    runningMode: 'VIDEO',
    numPoses: 1,  // Un solo paciente
    minPoseDetectionConfidence: 0.5,  // Umbral de detección
    minPosePresenceConfidence: 0.5,   // Umbral de presencia
    minTrackingConfidence: 0.5        // Umbral de seguimiento
});
```

### 📊 Personalización de Métricas
```javascript
// Umbral personalizable para alertas médicas
const MEDICAL_THRESHOLDS = {
    cervicalAlignment: 15,    // Grados
    pelvicTilt: 5,           // Grados
    lateralDeviation: 30,    // Milímetros
    shoulderSymmetry: 85,    // Porcentaje
    overallBalance: 80       // Porcentaje
};
```

## 🔒 Consideraciones de Privacidad

### 📋 Datos del Paciente
- **Sin almacenamiento**: Los datos no se envían a servidores externos
- **Procesamiento local**: Todo el análisis se realiza en el navegador
- **Control total**: El usuario controla la exportación de datos
- **Cumplimiento**: Compatible con normativas de privacidad médica

### 🛡️ Seguridad
- **HTTPS obligatorio**: Para acceso a cámara web
- **Sin cookies**: No se almacenan datos persistentes
- **Sin tracking**: No hay seguimiento de usuarios
- **Código abierto**: Transparencia total del procesamiento

## 🚨 Limitaciones y Disclaimers

### ⚠️ Uso Médico
```
🔸 Esta herramienta es para APOYO al diagnóstico, no reemplaza la evaluación médica profesional
🔸 Los resultados deben ser interpretados por profesionales de la salud cualificados
🔸 No debe usarse como única herramienta para tomar decisiones clínicas
🔸 Recomendamos validación con métodos de referencia estándar
```

### 🎯 Precisión Técnica
- **Dependiente de calidad** de imagen y iluminación
- **Sensible a movimiento** durante la captura
- **Requiere calibración** para medidas absolutas
- **Validar** con instrumentos de referencia

## 🤝 Contribución y Desarrollo

### 📝 Estructura del Código
```
examen_osteomuscular_web/
├── index.html                 # Interfaz principal
├── styles.css                # Estilos responsivos
├── pose-medical-analyzer.js   # Lógica de análisis médico
└── README.md                 # Esta documentación
```

### 🔧 Extensiones Posibles
- **Integración con PACS** médicos
- **Análisis temporal** de múltiples sesiones
- **Machine Learning** para detección automática de patologías
- **Realidad Aumentada** para feedback visual
- **Integración con wearables** para datos complementarios

## 📞 Soporte y Contacto

### 🐛 Reporte de Problemas
- Crear issue en el repositorio de GitHub
- Incluir información del navegador y sistema operativo
- Adjuntar logs de consola si es posible

### 💡 Solicitud de Características
- Describir el caso de uso médico específico
- Proporcionar referencias científicas si aplica
- Considerar la viabilidad técnica con MediaPipe

---

**⚕️ Desarrollado para profesionales de la salud que buscan herramientas innovadoras de evaluación postural y articular.**