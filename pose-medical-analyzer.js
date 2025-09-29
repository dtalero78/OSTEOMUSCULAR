/**
 * Examen Osteomuscular Virtual - Analizador de Pose Médico
 * Utiliza MediaPipe Pose Landmarker para análisis clínico
 */

class MedicalPoseAnalyzer {
    constructor() {
        this.poseLandmarker = null;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.isAnalyzing = false;
        this.currentExamType = 'postura';
        this.patientData = {
            name: '',
            results: [],
            session: Date.now()
        };

        // Métricas en tiempo real
        this.currentMetrics = {
            posture: {},
            joints: {},
            symmetry: {}
        };

        // Sistema de instrucciones guiadas
        this.instructionSystem = {
            currentStep: 0,
            isActive: false,
            audioEnabled: true,
            speechSynthesis: window.speechSynthesis
        };

        // Secuencias de examen por tipo
        this.examSequences = {
            postura: [
                {
                    icon: '🧍',
                    title: 'Posición Inicial',
                    text: 'Colóquese de pie, relajado, con los brazos a los costados. Mire hacia la cámara.',
                    duration: 5000,
                    audio: 'Colóquese de pie, relajado, con los brazos a los costados. Mire hacia la cámara.',
                    validation: 'checkBasicStance'
                },
                {
                    icon: '👀',
                    title: 'Vista Frontal',
                    text: 'Mantenga la cabeza erguida y mire directamente a la cámara. Respiración normal.',
                    duration: 8000,
                    audio: 'Mantenga la cabeza erguida y mire directamente a la cámara. Respiración normal.',
                    validation: 'checkFrontalView'
                },
                {
                    icon: '💪',
                    title: 'Brazos Naturales',
                    text: 'Deje los brazos caer naturalmente a los costados. No fuerce la posición.',
                    duration: 6000,
                    audio: 'Deje los brazos caer naturalmente a los costados. No fuerce la posición.',
                    validation: 'checkArmPosition'
                },
                {
                    icon: '📸',
                    title: 'Captura Final',
                    text: 'Perfecto. Mantenga esta posición mientras capturamos los datos.',
                    duration: 10000,
                    audio: 'Perfecto. Mantenga esta posición mientras capturamos los datos.',
                    validation: 'checkFinalCapture'
                }
            ],
            rangos: [
                {
                    icon: '🧍',
                    title: 'Posición Base',
                    text: 'Colóquese en posición inicial: de pie, brazos a los costados.',
                    duration: 4000,
                    audio: 'Colóquese en posición inicial: de pie, brazos a los costados.',
                    validation: 'checkBasicStance'
                },
                {
                    icon: '🙋‍♀️',
                    title: 'Elevar Brazos',
                    text: 'Levante lentamente ambos brazos hacia los lados hasta la altura de los hombros.',
                    duration: 8000,
                    audio: 'Levante lentamente ambos brazos hacia los lados hasta la altura de los hombros.',
                    validation: 'checkArmRaise'
                },
                {
                    icon: '🙌',
                    title: 'Brazos Arriba',
                    text: 'Ahora levante los brazos completamente por encima de la cabeza.',
                    duration: 8000,
                    audio: 'Ahora levante los brazos completamente por encima de la cabeza.',
                    validation: 'checkArmsUp'
                },
                {
                    icon: '🔄',
                    title: 'Rotación de Hombros',
                    text: 'Baje los brazos y haga círculos lentos con los hombros hacia atrás.',
                    duration: 10000,
                    audio: 'Baje los brazos y haga círculos lentos con los hombros hacia atrás.',
                    validation: 'checkShoulderRotation'
                },
                {
                    icon: '🦵',
                    title: 'Flexión de Cadera',
                    text: 'Levante una pierna, flexionando la rodilla a 90 grados. Mantenga el equilibrio.',
                    duration: 8000,
                    audio: 'Levante una pierna, flexionando la rodilla a 90 grados. Mantenga el equilibrio.',
                    validation: 'checkHipFlexion'
                }
            ],
            simetria: [
                {
                    icon: '🧍',
                    title: 'Postura Simétrica',
                    text: 'Colóquese con los pies separados al ancho de los hombros, peso distribuido igual.',
                    duration: 6000,
                    audio: 'Colóquese con los pies separados al ancho de los hombros, peso distribuido igual.',
                    validation: 'checkSymmetricStance'
                },
                {
                    icon: '⚖️',
                    title: 'Verificación de Balance',
                    text: 'Mantenga esta posición. Vamos a analizar la simetría de sus hombros y caderas.',
                    duration: 10000,
                    audio: 'Mantenga esta posición. Vamos a analizar la simetría de sus hombros y caderas.',
                    validation: 'checkBalance'
                }
            ],
            completo: [
                {
                    icon: '🏥',
                    title: 'Examen Completo',
                    text: 'Realizaremos un análisis integral. Siga todas las instrucciones cuidadosamente.',
                    duration: 5000,
                    audio: 'Realizaremos un análisis integral. Siga todas las instrucciones cuidadosamente.',
                    validation: 'checkReadiness'
                }
            ]
        };

        // Configuración de landmarks (33 puntos de MediaPipe)
        this.landmarkIndices = {
            // Cabeza y cuello
            nose: 0,
            leftEye: 1,
            rightEye: 4,
            leftEar: 7,
            rightEar: 8,

            // Hombros
            leftShoulder: 11,
            rightShoulder: 12,

            // Brazos
            leftElbow: 13,
            rightElbow: 14,
            leftWrist: 15,
            rightWrist: 16,

            // Torso
            leftHip: 23,
            rightHip: 24,

            // Piernas
            leftKnee: 25,
            rightKnee: 26,
            leftAnkle: 27,
            rightAnkle: 28
        };

        this.initializeApp();
    }

    async initializeApp() {
        console.log('🏥 Inicializando Analizador Médico de Pose...');

        try {
            // Inicializar elementos DOM
            this.initializeDOMElements();

            // Configurar event listeners
            this.setupEventListeners();

            // Inicializar MediaPipe
            await this.initializeMediaPipe();

            // Asegurar que el overlay esté oculto al inicio
            this.hideInstructionsOverlay();

            console.log('✅ Sistema listo para examen médico');
            this.updateStatus('🟡 Sistema listo - Presione "Iniciar Examen"', 'ready');
        } catch (error) {
            console.error('❌ Error durante la inicialización:', error);
            this.updateStatus('❌ Error durante la inicialización del sistema', 'error');
        }
    }

    initializeDOMElements() {
        this.video = document.getElementById('webcam');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.captureBtn = document.getElementById('captureBtn');
        this.exportBtn = document.getElementById('exportBtn');

        this.statusElement = document.getElementById('status');
        this.fpsElement = document.getElementById('fps');
        this.metricsDisplay = document.getElementById('metricsDisplay');

        // Elementos de instrucciones
        this.instructionsOverlay = document.getElementById('instructionsOverlay');
        this.instructionTitle = document.getElementById('instructionTitle');
        this.instructionText = document.getElementById('instructionText');
        this.instructionIcon = document.querySelector('.instruction-icon');
        this.progressBar = document.getElementById('progressBar');
        this.skipBtn = document.getElementById('skipBtn');
        this.audioToggle = document.getElementById('audioToggle');

        // Elementos de resultados
        this.resultElements = {
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
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startExam());
        this.stopBtn.addEventListener('click', () => this.stopExam());
        this.captureBtn.addEventListener('click', () => this.captureSnapshot());
        this.exportBtn.addEventListener('click', () => this.exportReport());

        document.getElementById('examType').addEventListener('change', (e) => {
            this.currentExamType = e.target.value;
            this.updateInstructions();
        });

        document.getElementById('patientName').addEventListener('change', (e) => {
            this.patientData.name = e.target.value;
        });

        // Event listeners para instrucciones
        this.skipBtn.addEventListener('click', () => this.skipCurrentInstruction());
        this.audioToggle.addEventListener('click', () => this.toggleAudio());
    }

    async initializeMediaPipe() {
        try {
            const { PoseLandmarker, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15');

            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm'
            );

            this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                    delegate: 'GPU'
                },
                runningMode: 'VIDEO',
                numPoses: 1,
                minPoseDetectionConfidence: 0.5,
                minPosePresenceConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            console.log('✅ MediaPipe Pose Landmarker inicializado');
            return true;
        } catch (error) {
            console.error('❌ Error inicializando MediaPipe:', error);
            this.updateStatus('❌ Error inicializando sistema de análisis', 'error');
            return false;
        }
    }

    async startExam() {
        try {
            console.log('🚀 Iniciando examen médico...');

            // Obtener acceso a la cámara
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });

            this.video.srcObject = stream;
            this.video.play();

            this.video.onloadedmetadata = () => {
                console.log('📹 Video cargado:', this.video.videoWidth, 'x', this.video.videoHeight);

                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;

                console.log('🎨 Canvas configurado:', this.canvas.width, 'x', this.canvas.height);

                this.isAnalyzing = true;
                this.updateStatus('🟢 Analizando pose del paciente...', 'analyzing');

                // Habilitar controles
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
                this.captureBtn.disabled = false;

                // Verificar que MediaPipe esté listo
                console.log('🤖 MediaPipe listo:', !!this.poseLandmarker);

                // Iniciar análisis inmediatamente
                this.analyzeFrame();

                // Iniciar sistema de instrucciones guiadas después de un breve retraso
                setTimeout(() => {
                    this.startInstructionSequence();
                }, 1000);
            };

        } catch (error) {
            console.error('❌ Error accediendo a la cámara:', error);
            this.updateStatus('❌ Error: No se puede acceder a la cámara', 'error');
        }
    }

    stopExam() {
        console.log('⏹️ Deteniendo examen...');

        this.isAnalyzing = false;

        // Detener cámara
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }

        // Limpiar canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Resetear controles
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.captureBtn.disabled = true;

        this.updateStatus('🔴 Examen detenido', 'stopped');

        // Detener instrucciones
        this.stopInstructionSequence();
    }

    async analyzeFrame() {
        if (!this.isAnalyzing || !this.poseLandmarker) {
            console.log('⏸️ Análisis pausado - isAnalyzing:', this.isAnalyzing, 'poseLandmarker:', !!this.poseLandmarker);
            return;
        }

        const startTime = performance.now();

        try {
            // Detectar pose
            const results = this.poseLandmarker.detectForVideo(this.video, startTime);

            // Limpiar canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                console.log('✅ Pose detectada con', landmarks.length, 'landmarks');

                // Dibujar landmarks y conexiones
                this.drawPoseLandmarks(landmarks);

                // Calcular métricas médicas
                this.calculateMedicalMetrics(landmarks);

                // Actualizar interfaz
                this.updateRealTimeMetrics();
                this.updateResultsPanel();
            } else {
                console.log('⚠️ No se detectó pose en este frame');
            }

            // Calcular FPS
            const endTime = performance.now();
            const fps = Math.round(1000 / (endTime - startTime));
            this.fpsElement.textContent = `FPS: ${fps}`;

        } catch (error) {
            console.error('❌ Error en análisis de frame:', error);
        }

        // Continuar análisis
        requestAnimationFrame(() => this.analyzeFrame());
    }

    drawPoseLandmarks(landmarks) {
        // Configuración de dibujo
        const pointRadius = 4;
        const lineWidth = 2;

        // Conexiones para dibujar el esqueleto
        const connections = [
            // Cabeza y hombros
            [this.landmarkIndices.leftShoulder, this.landmarkIndices.rightShoulder],

            // Brazos
            [this.landmarkIndices.leftShoulder, this.landmarkIndices.leftElbow],
            [this.landmarkIndices.leftElbow, this.landmarkIndices.leftWrist],
            [this.landmarkIndices.rightShoulder, this.landmarkIndices.rightElbow],
            [this.landmarkIndices.rightElbow, this.landmarkIndices.rightWrist],

            // Torso
            [this.landmarkIndices.leftShoulder, this.landmarkIndices.leftHip],
            [this.landmarkIndices.rightShoulder, this.landmarkIndices.rightHip],
            [this.landmarkIndices.leftHip, this.landmarkIndices.rightHip],

            // Piernas
            [this.landmarkIndices.leftHip, this.landmarkIndices.leftKnee],
            [this.landmarkIndices.leftKnee, this.landmarkIndices.leftAnkle],
            [this.landmarkIndices.rightHip, this.landmarkIndices.rightKnee],
            [this.landmarkIndices.rightKnee, this.landmarkIndices.rightAnkle]
        ];

        // Dibujar conexiones
        this.ctx.strokeStyle = '#3498db';
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

        // Dibujar puntos de landmarks
        landmarks.forEach((landmark, index) => {
            const x = landmark.x * this.canvas.width;
            const y = landmark.y * this.canvas.height;

            // Color según la importancia médica
            let color = '#3498db'; // Azul por defecto

            if (Object.values(this.landmarkIndices).includes(index)) {
                color = '#e74c3c'; // Rojo para puntos médicos importantes
            }

            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
            this.ctx.fill();

            // Agregar outline
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        });
    }

    calculateMedicalMetrics(landmarks) {
        // Obtener puntos clave
        const leftShoulder = landmarks[this.landmarkIndices.leftShoulder];
        const rightShoulder = landmarks[this.landmarkIndices.rightShoulder];
        const leftHip = landmarks[this.landmarkIndices.leftHip];
        const rightHip = landmarks[this.landmarkIndices.rightHip];
        const nose = landmarks[this.landmarkIndices.nose];

        // 1. Análisis Postural
        this.currentMetrics.posture = {
            cervicalAlignment: this.calculateCervicalAlignment(nose, leftShoulder, rightShoulder),
            pelvicTilt: this.calculatePelvicTilt(leftHip, rightHip),
            lateralDeviation: this.calculateLateralDeviation(nose, leftShoulder, rightShoulder, leftHip, rightHip)
        };

        // 2. Análisis de Articulaciones
        this.currentMetrics.joints = {
            rightShoulderAngle: this.calculateShoulderAngle(landmarks, 'right'),
            leftShoulderAngle: this.calculateShoulderAngle(landmarks, 'left'),
            rightHipAngle: this.calculateHipAngle(landmarks, 'right'),
            leftHipAngle: this.calculateHipAngle(landmarks, 'left')
        };

        // 3. Análisis de Simetría
        this.currentMetrics.symmetry = {
            shoulderSymmetry: this.calculateSymmetry(leftShoulder.y, rightShoulder.y),
            hipSymmetry: this.calculateSymmetry(leftHip.y, rightHip.y),
            overallBalance: this.calculateOverallBalance(landmarks)
        };
    }

    calculateCervicalAlignment(nose, leftShoulder, rightShoulder) {
        // Calcular el punto medio de los hombros
        const shoulderMidpoint = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2
        };

        // Calcular ángulo de inclinación cervical
        const deltaX = nose.x - shoulderMidpoint.x;
        const deltaY = nose.y - shoulderMidpoint.y;
        const angle = Math.atan2(deltaX, deltaY) * (180 / Math.PI);

        return Math.abs(angle);
    }

    calculatePelvicTilt(leftHip, rightHip) {
        // Calcular inclinación pélvica
        const deltaY = leftHip.y - rightHip.y;
        const deltaX = leftHip.x - rightHip.x;
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

        return Math.abs(angle);
    }

    calculateLateralDeviation(nose, leftShoulder, rightShoulder, leftHip, rightHip) {
        // Calcular línea central del cuerpo
        const shoulderCenter = (leftShoulder.x + rightShoulder.x) / 2;
        const hipCenter = (leftHip.x + rightHip.x) / 2;
        const bodyCenter = (shoulderCenter + hipCenter) / 2;

        // Desviación de la cabeza respecto al centro
        const deviation = Math.abs(nose.x - bodyCenter) * 1000; // En mm (estimado)

        return deviation;
    }

    calculateShoulderAngle(landmarks, side) {
        const shoulder = side === 'left' ? landmarks[this.landmarkIndices.leftShoulder] : landmarks[this.landmarkIndices.rightShoulder];
        const elbow = side === 'left' ? landmarks[this.landmarkIndices.leftElbow] : landmarks[this.landmarkIndices.rightElbow];
        const wrist = side === 'left' ? landmarks[this.landmarkIndices.leftWrist] : landmarks[this.landmarkIndices.rightWrist];

        return this.calculateAngle(shoulder, elbow, wrist);
    }

    calculateHipAngle(landmarks, side) {
        const hip = side === 'left' ? landmarks[this.landmarkIndices.leftHip] : landmarks[this.landmarkIndices.rightHip];
        const knee = side === 'left' ? landmarks[this.landmarkIndices.leftKnee] : landmarks[this.landmarkIndices.rightKnee];
        const ankle = side === 'left' ? landmarks[this.landmarkIndices.leftAnkle] : landmarks[this.landmarkIndices.rightAnkle];

        return this.calculateAngle(hip, knee, ankle);
    }

    calculateAngle(point1, point2, point3) {
        // Calcular ángulo entre tres puntos
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

        const angle = Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);

        return isNaN(angle) ? 0 : angle;
    }

    calculateSymmetry(leftValue, rightValue) {
        const difference = Math.abs(leftValue - rightValue);
        const average = (leftValue + rightValue) / 2;
        const symmetryPercentage = ((1 - (difference / average)) * 100);

        return Math.max(0, Math.min(100, symmetryPercentage));
    }

    calculateOverallBalance(landmarks) {
        // Calcular balance general basado en múltiples métricas
        const shoulderBalance = this.calculateSymmetry(
            landmarks[this.landmarkIndices.leftShoulder].y,
            landmarks[this.landmarkIndices.rightShoulder].y
        );

        const hipBalance = this.calculateSymmetry(
            landmarks[this.landmarkIndices.leftHip].y,
            landmarks[this.landmarkIndices.rightHip].y
        );

        return (shoulderBalance + hipBalance) / 2;
    }

    updateRealTimeMetrics() {
        const metrics = this.currentMetrics;

        this.metricsDisplay.innerHTML = `
            <div>🏃‍♀️ Postura:</div>
            <div>• Cervical: ${metrics.posture.cervicalAlignment?.toFixed(1)}°</div>
            <div>• Pélvica: ${metrics.posture.pelvicTilt?.toFixed(1)}°</div>
            <div>• Desviación: ${metrics.posture.lateralDeviation?.toFixed(0)}mm</div>
            <div></div>
            <div>🦴 Articulaciones:</div>
            <div>• Hombro D: ${metrics.joints.rightShoulderAngle?.toFixed(0)}°</div>
            <div>• Hombro I: ${metrics.joints.leftShoulderAngle?.toFixed(0)}°</div>
            <div></div>
            <div>⚖️ Simetría:</div>
            <div>• Hombros: ${metrics.symmetry.shoulderSymmetry?.toFixed(0)}%</div>
            <div>• Balance: ${metrics.symmetry.overallBalance?.toFixed(0)}%</div>
        `;
    }

    updateResultsPanel() {
        const metrics = this.currentMetrics;

        // Actualizar elementos de postura
        this.resultElements.cervicalAlign.textContent = `${metrics.posture.cervicalAlignment?.toFixed(1) || '--'}°`;
        this.resultElements.pelvicTilt.textContent = `${metrics.posture.pelvicTilt?.toFixed(1) || '--'}°`;
        this.resultElements.lateralDev.textContent = `${metrics.posture.lateralDeviation?.toFixed(0) || '--'}mm`;

        // Actualizar elementos de articulaciones
        this.resultElements.rightShoulder.textContent = `${metrics.joints.rightShoulderAngle?.toFixed(0) || '--'}°`;
        this.resultElements.leftShoulder.textContent = `${metrics.joints.leftShoulderAngle?.toFixed(0) || '--'}°`;
        this.resultElements.rightHip.textContent = `${metrics.joints.rightHipAngle?.toFixed(0) || '--'}°`;
        this.resultElements.leftHip.textContent = `${metrics.joints.leftHipAngle?.toFixed(0) || '--'}°`;

        // Actualizar elementos de simetría
        this.resultElements.shoulderSymmetry.textContent = `${metrics.symmetry.shoulderSymmetry?.toFixed(0) || '--'}%`;
        this.resultElements.hipSymmetry.textContent = `${metrics.symmetry.hipSymmetry?.toFixed(0) || '--'}%`;
        this.resultElements.overallBalance.textContent = `${metrics.symmetry.overallBalance?.toFixed(0) || '--'}%`;
    }

    captureSnapshot() {
        console.log('📸 Capturando instantánea para el reporte...');

        // Guardar datos actuales
        const snapshot = {
            timestamp: new Date().toISOString(),
            patientName: this.patientData.name,
            examType: this.currentExamType,
            metrics: JSON.parse(JSON.stringify(this.currentMetrics))
        };

        this.patientData.results.push(snapshot);

        // Feedback visual
        this.captureBtn.textContent = '✅ Capturado';
        setTimeout(() => {
            this.captureBtn.textContent = '📸 Capturar';
        }, 1500);

        console.log('✅ Instantánea guardada', snapshot);
    }

    exportReport() {
        console.log('📄 Generando reporte médico...');

        const report = {
            patientInfo: {
                name: this.patientData.name || 'Paciente Sin Nombre',
                date: new Date().toLocaleDateString('es-ES'),
                time: new Date().toLocaleTimeString('es-ES'),
                examType: this.currentExamType
            },
            summary: this.currentMetrics,
            snapshots: this.patientData.results,
            recommendations: this.generateRecommendations()
        };

        // Crear y descargar archivo JSON
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_osteomuscular_${this.patientData.name || 'paciente'}_${Date.now()}.json`;
        a.click();

        console.log('✅ Reporte exportado');
    }

    generateRecommendations() {
        const recommendations = [];
        const metrics = this.currentMetrics;

        // Recomendaciones basadas en alineación cervical
        if (metrics.posture.cervicalAlignment > 15) {
            recommendations.push('🔸 Considerar evaluación de postura cervical - desviación significativa detectada');
        }

        // Recomendaciones basadas en inclinación pélvica
        if (metrics.posture.pelvicTilt > 5) {
            recommendations.push('🔸 Revisar alineación pélvica - inclinación fuera del rango normal');
        }

        // Recomendaciones basadas en simetría
        if (metrics.symmetry.shoulderSymmetry < 85) {
            recommendations.push('🔸 Asimetría en hombros detectada - considerar evaluación ortopédica');
        }

        if (metrics.symmetry.overallBalance < 80) {
            recommendations.push('🔸 Desequilibrio postural general - recomendable fisioterapia postural');
        }

        if (recommendations.length === 0) {
            recommendations.push('✅ Parámetros posturales dentro de rangos normales');
        }

        return recommendations;
    }

    updateInstructions() {
        // Actualizar instrucciones según el tipo de examen
        const instructions = {
            'postura': 'Manténgase de pie en posición natural y relajada',
            'rangos': 'Siga las indicaciones para mover las articulaciones',
            'simetria': 'Posición frontal, brazos a los costados',
            'completo': 'Evaluación completa - siga todas las indicaciones'
        };

        console.log(`📋 Tipo de examen cambiado a: ${this.currentExamType}`);
    }

    updateStatus(message, type = 'info') {
        this.statusElement.textContent = message;
        this.statusElement.className = `status-${type}`;
    }

    // ============================================
    // SISTEMA DE INSTRUCCIONES GUIADAS
    // ============================================

    startInstructionSequence() {
        console.log('🎯 Iniciando secuencia de instrucciones guiadas');

        this.instructionSystem.isActive = true;
        this.instructionSystem.currentStep = 0;

        const sequence = this.examSequences[this.currentExamType] || this.examSequences.postura;

        this.showInstructionsOverlay();
        this.executeInstructionStep(sequence[0]);
    }

    executeInstructionStep(instruction) {
        console.log(`📋 Ejecutando paso: ${instruction.title}`);

        // Actualizar interfaz visual
        this.instructionIcon.textContent = instruction.icon;
        this.instructionTitle.textContent = instruction.title;
        this.instructionText.textContent = instruction.text;

        // Reproducir audio si está habilitado
        if (this.instructionSystem.audioEnabled) {
            this.speakInstruction(instruction.audio);
        }

        // Animar barra de progreso
        this.animateProgressBar(instruction.duration);

        // Programar siguiente paso
        this.instructionTimeout = setTimeout(() => {
            this.nextInstruction();
        }, instruction.duration);
    }

    nextInstruction() {
        const sequence = this.examSequences[this.currentExamType] || this.examSequences.postura;
        this.instructionSystem.currentStep++;

        if (this.instructionSystem.currentStep >= sequence.length) {
            this.completeInstructionSequence();
        } else {
            this.executeInstructionStep(sequence[this.instructionSystem.currentStep]);
        }
    }

    skipCurrentInstruction() {
        console.log('⏭️ Saltando instrucción actual');

        if (this.instructionTimeout) {
            clearTimeout(this.instructionTimeout);
        }

        // Detener audio
        if (this.instructionSystem.speechSynthesis.speaking) {
            this.instructionSystem.speechSynthesis.cancel();
        }

        this.nextInstruction();
    }

    completeInstructionSequence() {
        console.log('✅ Secuencia de instrucciones completada');

        this.instructionSystem.isActive = false;
        this.hideInstructionsOverlay();

        // Mostrar mensaje de finalización
        this.updateStatus('🟢 Instrucciones completadas - Analizando pose...', 'analyzing');

        // Capturar automáticamente después de completar instrucciones
        setTimeout(() => {
            this.captureSnapshot();
        }, 2000);
    }

    stopInstructionSequence() {
        console.log('⏹️ Deteniendo secuencia de instrucciones');

        this.instructionSystem.isActive = false;

        if (this.instructionTimeout) {
            clearTimeout(this.instructionTimeout);
        }

        if (this.instructionSystem.speechSynthesis.speaking) {
            this.instructionSystem.speechSynthesis.cancel();
        }

        this.hideInstructionsOverlay();
    }

    showInstructionsOverlay() {
        this.instructionsOverlay.classList.remove('hidden');
    }

    hideInstructionsOverlay() {
        this.instructionsOverlay.classList.add('hidden');
    }

    animateProgressBar(duration) {
        this.progressBar.style.width = '0%';

        // Animar progreso
        let progress = 0;
        const interval = 50; // ms
        const increment = (interval / duration) * 100;

        const progressAnimation = setInterval(() => {
            progress += increment;

            if (progress >= 100) {
                progress = 100;
                clearInterval(progressAnimation);
            }

            this.progressBar.style.width = `${progress}%`;
        }, interval);
    }

    speakInstruction(text) {
        if (!this.instructionSystem.audioEnabled || !window.speechSynthesis) return;

        // Cancelar cualquier síntesis anterior
        this.instructionSystem.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;

        // Seleccionar voz en español si está disponible
        const voices = this.instructionSystem.speechSynthesis.getVoices();
        const spanishVoice = voices.find(voice => voice.lang.includes('es'));
        if (spanishVoice) {
            utterance.voice = spanishVoice;
        }

        this.instructionSystem.speechSynthesis.speak(utterance);
    }

    toggleAudio() {
        this.instructionSystem.audioEnabled = !this.instructionSystem.audioEnabled;

        this.audioToggle.textContent = this.instructionSystem.audioEnabled ? '🔊 Audio' : '🔇 Audio';
        this.audioToggle.classList.toggle('active', this.instructionSystem.audioEnabled);

        console.log(`🔊 Audio ${this.instructionSystem.audioEnabled ? 'habilitado' : 'deshabilitado'}`);
    }

    // ============================================
    // VALIDACIONES DE POSICIÓN
    // ============================================

    checkBasicStance(landmarks) {
        if (!landmarks || landmarks.length === 0) return false;

        const leftShoulder = landmarks[this.landmarkIndices.leftShoulder];
        const rightShoulder = landmarks[this.landmarkIndices.rightShoulder];
        const leftHip = landmarks[this.landmarkIndices.leftHip];
        const rightHip = landmarks[this.landmarkIndices.rightHip];

        // Verificar que todos los puntos sean visibles
        if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return false;

        // Verificar que el cuerpo esté centrado
        const shoulderCenter = (leftShoulder.x + rightShoulder.x) / 2;
        const hipCenter = (leftHip.x + rightHip.x) / 2;
        const bodyCenter = (shoulderCenter + hipCenter) / 2;

        // El paciente debe estar centrado en el frame (tolerancia del 20%)
        return bodyCenter > 0.3 && bodyCenter < 0.7;
    }

    checkFrontalView(landmarks) {
        if (!landmarks || landmarks.length === 0) return false;

        const nose = landmarks[this.landmarkIndices.nose];
        const leftEye = landmarks[this.landmarkIndices.leftEye];
        const rightEye = landmarks[this.landmarkIndices.rightEye];

        if (!nose || !leftEye || !rightEye) return false;

        // Verificar que los ojos estén aproximadamente al mismo nivel
        const eyeBalance = Math.abs(leftEye.y - rightEye.y);
        return eyeBalance < 0.05; // Tolerancia del 5%
    }

    checkArmPosition(landmarks) {
        if (!landmarks || landmarks.length === 0) return false;

        const leftShoulder = landmarks[this.landmarkIndices.leftShoulder];
        const rightShoulder = landmarks[this.landmarkIndices.rightShoulder];
        const leftWrist = landmarks[this.landmarkIndices.leftWrist];
        const rightWrist = landmarks[this.landmarkIndices.rightWrist];

        if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) return false;

        // Los brazos deben estar a los costados (muñecas debajo de hombros)
        return leftWrist.y > leftShoulder.y && rightWrist.y > rightShoulder.y;
    }

    checkArmRaise(landmarks) {
        if (!landmarks || landmarks.length === 0) return false;

        const leftShoulder = landmarks[this.landmarkIndices.leftShoulder];
        const rightShoulder = landmarks[this.landmarkIndices.rightShoulder];
        const leftWrist = landmarks[this.landmarkIndices.leftWrist];
        const rightWrist = landmarks[this.landmarkIndices.rightWrist];

        if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) return false;

        // Los brazos deben estar a la altura de los hombros
        const leftArmRaised = Math.abs(leftWrist.y - leftShoulder.y) < 0.1;
        const rightArmRaised = Math.abs(rightWrist.y - rightShoulder.y) < 0.1;

        return leftArmRaised && rightArmRaised;
    }

    checkArmsUp(landmarks) {
        if (!landmarks || landmarks.length === 0) return false;

        const leftShoulder = landmarks[this.landmarkIndices.leftShoulder];
        const rightShoulder = landmarks[this.landmarkIndices.rightShoulder];
        const leftWrist = landmarks[this.landmarkIndices.leftWrist];
        const rightWrist = landmarks[this.landmarkIndices.rightWrist];

        if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) return false;

        // Los brazos deben estar por encima de la cabeza
        return leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y;
    }

    checkSymmetricStance(landmarks) {
        return this.checkBasicStance(landmarks);
    }

    checkBalance(landmarks) {
        if (!landmarks || landmarks.length === 0) return false;

        const symmetry = this.currentMetrics.symmetry;
        return symmetry.overallBalance > 80; // Balance mínimo del 80%
    }

    checkFinalCapture(landmarks) {
        return landmarks && landmarks.length > 0;
    }

    checkReadiness(landmarks) {
        return true; // Siempre listo para examen completo
    }

    checkShoulderRotation(landmarks) {
        return landmarks && landmarks.length > 0; // Simplificado por ahora
    }

    checkHipFlexion(landmarks) {
        if (!landmarks || landmarks.length === 0) return false;

        const leftHip = landmarks[this.landmarkIndices.leftHip];
        const rightHip = landmarks[this.landmarkIndices.rightHip];
        const leftKnee = landmarks[this.landmarkIndices.leftKnee];
        const rightKnee = landmarks[this.landmarkIndices.rightKnee];

        if (!leftHip || !rightHip || !leftKnee || !rightKnee) return false;

        // Al menos una pierna debe estar flexionada
        const leftFlexed = leftKnee.y < leftHip.y;
        const rightFlexed = rightKnee.y < rightHip.y;

        return leftFlexed || rightFlexed;
    }
}

// Inicializar la aplicación cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏥 Iniciando Examen Osteomuscular Virtual...');
    window.medicalAnalyzer = new MedicalPoseAnalyzer();
});