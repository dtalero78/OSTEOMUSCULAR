/**
 * Cliente del Médico - Telemedicina
 * Recibe y visualiza datos de pose del paciente en tiempo real
 */

class TelemedicineDoctor {
    constructor() {
        this.socket = io();
        this.canvas = null;
        this.ctx = null;

        this.sessionCode = null;
        this.isSessionActive = false;
        this.patientConnected = false;
        this.isExamRunning = false;

        // Datos del médico
        this.doctorData = {
            name: '',
            specialty: 'traumatologia',
            sessionId: null
        };

        // Datos del paciente conectado
        this.patientData = null;

        // Métricas recibidas del paciente
        this.currentMetrics = {
            posture: {},
            joints: {},
            symmetry: {}
        };

        // Estadísticas de transmisión
        this.transmissionStats = {
            fps: 0,
            latency: 0,
            frameCount: 0,
            lastFrameTime: 0,
            qualityScore: 'Esperando...'
        };

        // Capturas realizadas
        this.snapshots = [];

        // Landmarks recibidos
        this.receivedLandmarks = null;

        this.initializeInterface();
    }

    async initializeInterface() {
        console.log('👨‍⚕️ Inicializando interfaz del médico...');

        try {
            // Inicializar elementos DOM
            this.initializeDOMElements();

            // Configurar event listeners
            this.setupEventListeners();

            // Configurar Socket.io events
            this.setupSocketEvents();

            console.log('✅ Interfaz del médico lista');

        } catch (error) {
            console.error('❌ Error inicializando interfaz:', error);
        }
    }

    initializeDOMElements() {
        // Elementos de configuración del médico
        this.doctorNameInput = document.getElementById('doctorName');
        this.doctorSpecialtySelect = document.getElementById('doctorSpecialty');
        this.createSessionBtn = document.getElementById('createSessionBtn');

        // Elementos de sesión
        this.sessionCodeContainer = document.getElementById('sessionCodeContainer');
        this.sessionCodeDisplay = document.getElementById('sessionCodeDisplay');
        this.connectionStatus = document.getElementById('connectionStatus');

        // Elementos de información del paciente
        this.patientInfo = document.getElementById('patientInfo');
        this.patientName = document.getElementById('patientName');
        this.patientAge = document.getElementById('patientAge');
        this.connectionTime = document.getElementById('connectionTime');

        // Elementos de video
        this.patientVideoContainer = document.getElementById('patientVideoContainer');
        this.canvas = document.getElementById('patientCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.noPatientMessage = document.getElementById('noPatientMessage');

        // Controles de examen
        this.startExamBtn = document.getElementById('startExamBtn');
        this.stopExamBtn = document.getElementById('stopExamBtn');
        this.countdownBtn = document.getElementById('countdownBtn');

        // Instrucciones
        this.customInstructionInput = document.getElementById('customInstruction');
        this.sendInstructionBtn = document.getElementById('sendInstructionBtn');

        // Métricas
        this.metricElements = {
            cervicalAlign: document.getElementById('cervicalAlign'),
            pelvicTilt: document.getElementById('pelvicTilt'),
            lateralDev: document.getElementById('lateralDev'),
            rightShoulder: document.getElementById('rightShoulder'),
            leftShoulder: document.getElementById('leftShoulder'),
            rightHip: document.getElementById('rightHip'),
            leftHip: document.getElementById('leftHip'),
            shoulderSymmetry: document.getElementById('shoulderSymmetry'),
            hipSymmetry: document.getElementById('hipSymmetry'),
            overallBalance: document.getElementById('overallBalance')
        };

        // Otros elementos
        this.captureBtn = document.getElementById('captureBtn');
        this.snapshotsList = document.getElementById('snapshotsList');
        this.transmissionStatsEl = document.getElementById('transmissionStats');
        this.doctorNotes = document.getElementById('doctorNotes');
        this.generateReportBtn = document.getElementById('generateReportBtn');
        this.endSessionBtn = document.getElementById('endSessionBtn');
    }

    setupEventListeners() {
        // Crear sesión
        this.createSessionBtn.addEventListener('click', () => this.createSession());

        // Controles de examen
        this.startExamBtn.addEventListener('click', () => this.startExam());
        this.stopExamBtn.addEventListener('click', () => this.stopExam());
        this.countdownBtn.addEventListener('click', () => this.startCountdown());

        // Instrucciones
        this.sendInstructionBtn.addEventListener('click', () => this.sendCustomInstruction());

        this.customInstructionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendCustomInstruction();
        });

        // Instrucciones rápidas
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const instruction = btn.dataset.instruction;
                this.sendInstruction('instruction', {
                    title: 'Instrucción',
                    text: instruction
                });
            });
        });

        // Captura
        this.captureBtn.addEventListener('click', () => this.captureSnapshot());

        // Acciones finales
        this.generateReportBtn.addEventListener('click', () => this.generateReport());
        this.endSessionBtn.addEventListener('click', () => this.endSession());
    }

    setupSocketEvents() {
        // Conexión establecida
        this.socket.on('connect', () => {
            console.log('🔌 Médico conectado al servidor');
        });

        // Sesión creada
        this.socket.on('session-created', ({ sessionCode, message }) => {
            console.log('✅ Sesión creada:', sessionCode);

            this.sessionCode = sessionCode;
            this.isSessionActive = true;

            this.sessionCodeDisplay.textContent = sessionCode;
            this.sessionCodeContainer.classList.remove('hidden');
            this.updateConnectionStatus('🟡 Sesión creada - Esperando paciente', 'waiting');

            // Habilitar algunos controles
            this.createSessionBtn.disabled = true;
        });

        // Paciente conectado
        this.socket.on('patient-connected', ({ sessionCode, patientData, message }) => {
            console.log('👤 Paciente conectado:', patientData);

            this.patientData = patientData;
            this.patientConnected = true;

            // Actualizar interfaz
            this.updateConnectionStatus('🟢 Paciente conectado', 'connected');
            this.showPatientInfo();
            this.enableExamControls();

            // Configurar canvas para video
            this.setupCanvas();
        });

        // Datos de pose recibidos
        this.socket.on('receive-pose-data', ({ landmarks, metrics, timestamp }) => {
            this.handlePoseData(landmarks, metrics, timestamp);
        });

        // Paciente desconectado
        this.socket.on('patient-disconnected', ({ message }) => {
            console.log('👤 Paciente desconectado:', message);

            this.patientConnected = false;
            this.isExamRunning = false;

            this.updateConnectionStatus('🟡 Paciente desconectado', 'waiting');
            this.hidePatientInfo();
            this.disableExamControls();
            this.clearCanvas();
        });

        // Snapshot capturado
        this.socket.on('snapshot-captured', ({ snapshotData, timestamp }) => {
            console.log('📸 Confirmación de snapshot');
        });

        // Desconexión
        this.socket.on('disconnect', () => {
            console.log('🔌 Desconectado del servidor');
            this.updateConnectionStatus('🔴 Desconectado del servidor', 'error');
            this.resetSession();
        });
    }

    createSession() {
        const doctorName = this.doctorNameInput.value.trim();
        const specialty = this.doctorSpecialtySelect.value;

        if (!doctorName) {
            alert('Por favor ingrese su nombre');
            return;
        }

        this.doctorData = {
            name: doctorName,
            specialty: specialty,
            sessionId: Date.now()
        };

        console.log('🚀 Creando sesión médica...');

        this.socket.emit('doctor-register', this.doctorData);
    }

    startExam() {
        if (!this.patientConnected) return;

        console.log('▶️ Iniciando examen...');
        this.isExamRunning = true;

        // Enviar comando al paciente
        this.sendCommand('start_exam', {
            timestamp: Date.now(),
            examType: 'completo'
        });

        // Actualizar controles
        this.startExamBtn.disabled = true;
        this.stopExamBtn.disabled = false;
        this.captureBtn.disabled = false;

        this.updateConnectionStatus('🔬 Examen en progreso', 'examining');
    }

    stopExam() {
        console.log('⏹️ Deteniendo examen...');
        this.isExamRunning = false;

        // Enviar comando al paciente
        this.sendCommand('stop_exam', {
            timestamp: Date.now()
        });

        // Actualizar controles
        this.startExamBtn.disabled = false;
        this.stopExamBtn.disabled = true;
        this.captureBtn.disabled = true;

        this.updateConnectionStatus('🟢 Paciente conectado - Examen detenido', 'connected');
    }

    startCountdown(seconds = 5) {
        if (!this.patientConnected) return;

        console.log(`⏰ Iniciando cuenta regresiva de ${seconds} segundos`);

        this.sendCommand('countdown', {
            seconds: seconds,
            message: `Iniciando en ${seconds} segundos`
        });
    }

    sendCustomInstruction() {
        const instruction = this.customInstructionInput.value.trim();
        if (!instruction) return;

        this.sendInstruction('instruction', {
            title: 'Instrucción Personalizada',
            text: instruction
        });

        this.customInstructionInput.value = '';
    }

    sendInstruction(type, data) {
        if (!this.patientConnected) return;

        this.sendCommand(type, data);
        console.log('📋 Instrucción enviada:', data.text);
    }

    sendCommand(command, data) {
        if (!this.sessionCode) return;

        this.socket.emit('doctor-command', {
            sessionCode: this.sessionCode,
            command: command,
            data: data
        });
    }

    captureSnapshot() {
        if (!this.patientConnected || !this.receivedLandmarks) return;

        console.log('📸 Capturando snapshot médico...');

        const snapshot = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            patientData: this.patientData,
            landmarks: this.receivedLandmarks,
            metrics: { ...this.currentMetrics },
            notes: this.doctorNotes.value || '',
            doctorData: this.doctorData
        };

        this.snapshots.push(snapshot);

        // Enviar comando de captura al paciente
        this.sendCommand('capture_snapshot', {
            snapshotId: snapshot.id,
            timestamp: snapshot.timestamp
        });

        // Actualizar lista de snapshots
        this.updateSnapshotsList();
    }

    handlePoseData(landmarks, metrics, timestamp) {
        if (!this.patientConnected) return;

        // Guardar datos recibidos
        this.receivedLandmarks = landmarks;
        this.currentMetrics = metrics;

        // Actualizar estadísticas de transmisión
        this.updateTransmissionStats(timestamp);

        // Dibujar pose en canvas
        this.drawPoseOnCanvas(landmarks);

        // Actualizar métricas en interfaz
        this.updateMetricsDisplay();
    }

    setupCanvas() {
        // Configurar canvas para mostrar pose del paciente
        this.canvas.width = 640;
        this.canvas.height = 480;

        this.patientVideoContainer.classList.remove('hidden');
        this.noPatientMessage.style.display = 'none';
    }

    drawPoseOnCanvas(landmarks) {
        if (!landmarks || landmarks.length === 0) return;

        // Limpiar canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Configurar estilos de dibujo
        const pointRadius = 6;
        const lineWidth = 3;

        // Definir conexiones del esqueleto
        const connections = [
            [11, 12], // hombros
            [11, 13], [13, 15], // brazo izquierdo
            [12, 14], [14, 16], // brazo derecho
            [11, 23], [12, 24], // torso
            [23, 24], // caderas
            [23, 25], [25, 27], // pierna izquierda
            [24, 26], [26, 28]  // pierna derecha
        ];

        // Dibujar conexiones
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];

            if (startPoint && endPoint) {
                this.ctx.moveTo(
                    startPoint.x * this.canvas.width,
                    startPoint.y * this.canvas.height
                );
                this.ctx.lineTo(
                    endPoint.x * this.canvas.width,
                    endPoint.y * this.canvas.height
                );
            }
        });

        this.ctx.stroke();

        // Dibujar puntos importantes
        const importantLandmarks = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

        landmarks.forEach((landmark, index) => {
            const x = landmark.x * this.canvas.width;
            const y = landmark.y * this.canvas.height;

            // Color según importancia
            let color = '#00ff00';
            if (importantLandmarks.includes(index)) {
                color = '#ff0000';
            }

            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
            this.ctx.fill();

            // Contorno blanco
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        });

        // Dibujar información de calidad
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Landmarks: ${landmarks.length}`, 10, 25);
        this.ctx.fillText(`FPS: ${this.transmissionStats.fps}`, 10, 50);
        this.ctx.fillText(`Latencia: ${this.transmissionStats.latency}ms`, 10, 75);
    }

    updateMetricsDisplay() {
        const metrics = this.currentMetrics;

        // Actualizar valores
        this.metricElements.cervicalAlign.textContent = `${metrics.posture.cervicalAlignment?.toFixed(1) || '--'}°`;
        this.metricElements.pelvicTilt.textContent = `${metrics.posture.pelvicTilt?.toFixed(1) || '--'}°`;
        this.metricElements.lateralDev.textContent = `${metrics.posture.lateralDeviation?.toFixed(0) || '--'}mm`;

        this.metricElements.rightShoulder.textContent = `${metrics.joints.rightShoulderAngle?.toFixed(0) || '--'}°`;
        this.metricElements.leftShoulder.textContent = `${metrics.joints.leftShoulderAngle?.toFixed(0) || '--'}°`;
        this.metricElements.rightHip.textContent = `${metrics.joints.rightHipAngle?.toFixed(0) || '--'}°`;
        this.metricElements.leftHip.textContent = `${metrics.joints.leftHipAngle?.toFixed(0) || '--'}°`;

        this.metricElements.shoulderSymmetry.textContent = `${metrics.symmetry.shoulderSymmetry?.toFixed(0) || '--'}%`;
        this.metricElements.hipSymmetry.textContent = `${metrics.symmetry.hipSymmetry?.toFixed(0) || '--'}%`;
        this.metricElements.overallBalance.textContent = `${metrics.symmetry.overallBalance?.toFixed(0) || '--'}%`;

        // Aplicar colores según rangos médicos
        this.applyMetricColors();
    }

    applyMetricColors() {
        const metrics = this.currentMetrics;

        // Colores para alineación cervical
        const cervicalValue = metrics.posture.cervicalAlignment || 0;
        this.metricElements.cervicalAlign.className = 'metric-value ' +
            (cervicalValue < 10 ? 'metric-normal' : cervicalValue < 15 ? 'metric-warning' : 'metric-alert');

        // Colores para inclinación pélvica
        const pelvicValue = metrics.posture.pelvicTilt || 0;
        this.metricElements.pelvicTilt.className = 'metric-value ' +
            (pelvicValue < 5 ? 'metric-normal' : pelvicValue < 10 ? 'metric-warning' : 'metric-alert');

        // Colores para simetría
        const shoulderSymmetry = metrics.symmetry.shoulderSymmetry || 0;
        this.metricElements.shoulderSymmetry.className = 'metric-value ' +
            (shoulderSymmetry > 90 ? 'metric-normal' : shoulderSymmetry > 85 ? 'metric-warning' : 'metric-alert');

        const overallBalance = metrics.symmetry.overallBalance || 0;
        this.metricElements.overallBalance.className = 'metric-value ' +
            (overallBalance > 80 ? 'metric-normal' : overallBalance > 70 ? 'metric-warning' : 'metric-alert');
    }

    updateTransmissionStats(timestamp) {
        const now = Date.now();

        // Calcular FPS
        if (this.transmissionStats.lastFrameTime > 0) {
            const deltaTime = now - this.transmissionStats.lastFrameTime;
            this.transmissionStats.fps = Math.round(1000 / deltaTime);
        }

        // Calcular latencia
        this.transmissionStats.latency = now - timestamp;
        this.transmissionStats.frameCount++;
        this.transmissionStats.lastFrameTime = now;

        // Determinar calidad
        if (this.transmissionStats.fps > 25 && this.transmissionStats.latency < 100) {
            this.transmissionStats.qualityScore = 'Excelente';
        } else if (this.transmissionStats.fps > 15 && this.transmissionStats.latency < 200) {
            this.transmissionStats.qualityScore = 'Buena';
        } else if (this.transmissionStats.fps > 10) {
            this.transmissionStats.qualityScore = 'Regular';
        } else {
            this.transmissionStats.qualityScore = 'Pobre';
        }

        // Actualizar display
        this.transmissionStatsEl.innerHTML = `
            FPS: ${this.transmissionStats.fps}<br>
            Latencia: ${this.transmissionStats.latency}ms<br>
            Frames: ${this.transmissionStats.frameCount}<br>
            Calidad: ${this.transmissionStats.qualityScore}
        `;
    }

    updateSnapshotsList() {
        this.snapshotsList.innerHTML = '';

        this.snapshots.forEach((snapshot, index) => {
            const item = document.createElement('div');
            item.className = 'snapshot-item';
            item.innerHTML = `
                <strong>Captura ${index + 1}</strong><br>
                ${new Date(snapshot.timestamp).toLocaleTimeString()}<br>
                <small>Cervical: ${snapshot.metrics.posture.cervicalAlignment?.toFixed(1)}°</small>
            `;
            this.snapshotsList.appendChild(item);
        });
    }

    generateReport() {
        console.log('📄 Generando informe médico...');

        const report = {
            sessionInfo: {
                sessionCode: this.sessionCode,
                date: new Date().toLocaleDateString('es-ES'),
                time: new Date().toLocaleTimeString('es-ES'),
                duration: 'Calculando...'
            },
            doctorInfo: this.doctorData,
            patientInfo: this.patientData,
            currentMetrics: this.currentMetrics,
            snapshots: this.snapshots,
            doctorNotes: this.doctorNotes.value || '',
            recommendations: this.generateRecommendations()
        };

        // Crear y descargar archivo JSON
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `informe_telemedicina_${this.patientData.name}_${Date.now()}.json`;
        a.click();

        console.log('✅ Informe generado');
    }

    generateRecommendations() {
        const recommendations = [];
        const metrics = this.currentMetrics;

        if (metrics.posture.cervicalAlignment > 15) {
            recommendations.push('🔸 Evaluación cervical recomendada - Desviación significativa detectada');
        }

        if (metrics.posture.pelvicTilt > 5) {
            recommendations.push('🔸 Revisión de alineación pélvica - Inclinación fuera del rango normal');
        }

        if (metrics.symmetry.shoulderSymmetry < 85) {
            recommendations.push('🔸 Asimetría en hombros - Considerar evaluación ortopédica');
        }

        if (metrics.symmetry.overallBalance < 80) {
            recommendations.push('🔸 Desequilibrio postural - Fisioterapia recomendada');
        }

        if (recommendations.length === 0) {
            recommendations.push('✅ Parámetros posturales dentro de rangos normales');
        }

        return recommendations;
    }

    showPatientInfo() {
        this.patientName.textContent = this.patientData.name;
        this.patientAge.textContent = this.patientData.age;
        this.connectionTime.textContent = new Date().toLocaleTimeString();
        this.patientInfo.classList.remove('hidden');
    }

    hidePatientInfo() {
        this.patientInfo.classList.add('hidden');
    }

    enableExamControls() {
        this.startExamBtn.disabled = false;
        this.countdownBtn.disabled = false;
        this.sendInstructionBtn.disabled = false;
        this.generateReportBtn.disabled = false;
        this.endSessionBtn.disabled = false;
    }

    disableExamControls() {
        this.startExamBtn.disabled = true;
        this.stopExamBtn.disabled = true;
        this.countdownBtn.disabled = true;
        this.captureBtn.disabled = true;
        this.sendInstructionBtn.disabled = true;
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.patientVideoContainer.classList.add('hidden');
        this.noPatientMessage.style.display = 'block';
    }

    endSession() {
        console.log('🔚 Finalizando sesión...');

        this.socket.disconnect();
        this.resetSession();

        alert('✅ Sesión finalizada. Puede cerrar la ventana.');
    }

    resetSession() {
        this.sessionCode = null;
        this.isSessionActive = false;
        this.patientConnected = false;
        this.isExamRunning = false;

        this.sessionCodeContainer.classList.add('hidden');
        this.hidePatientInfo();
        this.clearCanvas();
        this.disableExamControls();

        this.createSessionBtn.disabled = false;
        this.updateConnectionStatus('🔴 Sesión finalizada', 'error');
    }

    updateConnectionStatus(message, type) {
        this.connectionStatus.textContent = message;
        this.connectionStatus.className = `connection-status status-${type}`;
    }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    console.log('👨‍⚕️ Iniciando interfaz del médico...');
    window.telemedicineDoctor = new TelemedicineDoctor();
});