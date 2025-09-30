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

        // Tipo de examen médico
        this.currentExamType = 'completo';

        // Sistema de instrucciones guiadas médicas
        this.instructionSystem = {
            currentStep: 0,
            isActive: false,
            audioEnabled: true,
            speechSynthesis: window.speechSynthesis
        };

        // Secuencias de examen médico completas del análisis original
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

        // WebRTC configuration
        this.peerConnection = null;
        this.remoteVideo = null;
        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

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
        this.examTypeSelect = document.getElementById('examType');
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
        this.remoteVideo = document.getElementById('remoteVideo');
        this.videoPlaceholder = document.getElementById('videoPlaceholder');
        this.videoInfo = document.getElementById('videoInfo');
        this.canvas = document.getElementById('patientCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.noPatientMessage = document.getElementById('noPatientMessage');

        // Controles de examen
        this.startExamBtn = document.getElementById('startExamBtn');
        this.startGuidedBtn = document.getElementById('startGuidedBtn');
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
        this.startGuidedBtn.addEventListener('click', () => this.startGuidedSequence());
        this.stopExamBtn.addEventListener('click', () => this.stopExam());
        this.countdownBtn.addEventListener('click', () => this.startCountdown());

        // Selección de tipo de examen
        this.examTypeSelect.addEventListener('change', (e) => {
            this.currentExamType = e.target.value;
            console.log(`🔍 Tipo de examen cambiado a: ${this.currentExamType}`);
        });

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

            // Mostrar área de video con mensaje de espera
            this.patientVideoContainer.classList.remove('hidden');
            this.noPatientMessage.innerHTML = '<h3>👤 Esperando conexión del paciente</h3>';
            this.noPatientMessage.style.display = 'flex';

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
            console.log('📥 Datos de pose recibidos:', {
                landmarksCount: landmarks?.length || 0,
                hasMetrics: !!metrics,
                timestamp: timestamp
            });
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

        // WebRTC signaling - Offer del paciente
        this.socket.on('webrtc-offer', async ({ offer }) => {
            console.log('📹 WebRTC Offer recibido del paciente');
            await this.handleWebRTCOffer(offer);
        });

        // WebRTC ICE candidates
        this.socket.on('webrtc-ice-candidate', async ({ candidate }) => {
            console.log('🧊 ICE candidate recibido');
            if (this.peerConnection && candidate) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

        // Desconexión
        this.socket.on('disconnect', () => {
            console.log('🔌 Desconectado del servidor');
            this.updateConnectionStatus('🔴 Desconectado del servidor', 'error');
            this.resetSession();
        });
    }

    async handleWebRTCOffer(offer) {
        try {
            console.log('🔗 Configurando WebRTC en lado del médico...');
            console.log('📋 Offer recibido:', offer?.type, offer?.sdp?.substring(0, 50) + '...');

            if (!this.sessionCode) {
                console.error('❌ Médico no tiene sessionCode activo');
                return;
            }

            if (!this.patientConnected) {
                console.error('❌ No hay paciente conectado');
                return;
            }

            console.log('✅ Médico listo para aceptar WebRTC con sesión:', this.sessionCode);

            // Crear peer connection
            this.peerConnection = new RTCPeerConnection(this.iceServers);

            // Manejar tracks entrantes (video del paciente)
            this.peerConnection.ontrack = (event) => {
                console.log('📹 Stream recibido:', event.streams[0]);
                this.remoteVideo.srcObject = event.streams[0];

                // Mostrar video y ocultar placeholder
                if (this.videoPlaceholder) {
                    this.videoPlaceholder.style.display = 'none';
                    this.videoPlaceholder.style.visibility = 'hidden';
                }

                // Asegurar que el video sea visible
                this.remoteVideo.style.display = 'block';
                this.remoteVideo.style.visibility = 'visible';
                this.remoteVideo.style.opacity = '1';

                // Actualizar info del video
                this.remoteVideo.onloadedmetadata = () => {
                    const width = this.remoteVideo.videoWidth;
                    const height = this.remoteVideo.videoHeight;
                    this.videoInfo.textContent = `Resolución: ${width}x${height} | En vivo`;
                    console.log('✅ Video del paciente mostrándose:', width, 'x', height);
                };

                // Play automático si está pausado
                this.remoteVideo.play().catch(err => {
                    console.log('⚠️ Autoplay bloqueado, requiere interacción del usuario:', err);
                });
            };

            // Manejar ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('🧊 Enviando ICE candidate al paciente');
                    this.socket.emit('webrtc-ice-candidate', {
                        sessionCode: this.sessionCode,
                        candidate: event.candidate
                    });
                }
            };

            // Manejar estado de conexión
            this.peerConnection.onconnectionstatechange = () => {
                console.log('🔗 Estado WebRTC:', this.peerConnection.connectionState);
                if (this.peerConnection.connectionState === 'connected') {
                    console.log('✅ Video streaming conectado');
                } else if (this.peerConnection.connectionState === 'failed') {
                    console.error('❌ Conexión WebRTC falló');
                    if (this.videoPlaceholder) {
                        this.videoPlaceholder.innerHTML = '<div style="text-align: center; color: #f44336;">❌ Error de conexión<br><small>Intentando reconectar...</small></div>';
                        this.videoPlaceholder.style.display = 'flex';
                    }
                }
            };

            // Establecer remote description (offer del paciente)
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            // Crear answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            // Enviar answer al paciente
            console.log('📤 Enviando WebRTC answer al paciente');
            console.log('📋 Answer SDP:', answer.type, answer.sdp?.substring(0, 50) + '...');
            this.socket.emit('webrtc-answer', {
                sessionCode: this.sessionCode,
                answer: answer
            });
            console.log('✅ Answer enviado con sessionCode:', this.sessionCode);

        } catch (error) {
            console.error('❌ Error configurando WebRTC:', error);
        }
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

    startGuidedSequence() {
        if (!this.patientConnected) return;

        console.log(`🎯 Iniciando secuencia guiada de tipo: ${this.currentExamType}`);

        // Resetear sistema de instrucciones
        this.instructionSystem.currentStep = 0;
        this.instructionSystem.isActive = true;

        const sequence = this.examSequences[this.currentExamType] || this.examSequences.completo;

        // Enviar primera instrucción al paciente
        this.sendCommand('start_guided_sequence', {
            examType: this.currentExamType,
            totalSteps: sequence.length,
            currentStep: 0,
            instruction: sequence[0]
        });

        // Actualizar estado
        this.isExamRunning = true;
        this.startExamBtn.disabled = true;
        this.startGuidedBtn.disabled = true;
        this.stopExamBtn.disabled = false;
        this.captureBtn.disabled = false;

        this.updateConnectionStatus(`🎯 Secuencia guiada ${this.currentExamType} iniciada`, 'examining');

        // Programar siguiente paso
        this.scheduleNextInstruction(sequence[0].duration);
    }

    scheduleNextInstruction(duration) {
        if (!this.instructionSystem.isActive) return;

        this.instructionTimeout = setTimeout(() => {
            this.nextGuidedStep();
        }, duration);
    }

    nextGuidedStep() {
        if (!this.instructionSystem.isActive) return;

        const sequence = this.examSequences[this.currentExamType] || this.examSequences.completo;
        this.instructionSystem.currentStep++;

        if (this.instructionSystem.currentStep >= sequence.length) {
            this.completeGuidedSequence();
        } else {
            const currentInstruction = sequence[this.instructionSystem.currentStep];

            // Enviar siguiente instrucción
            this.sendCommand('next_guided_step', {
                examType: this.currentExamType,
                totalSteps: sequence.length,
                currentStep: this.instructionSystem.currentStep,
                instruction: currentInstruction
            });

            // Programar siguiente paso
            this.scheduleNextInstruction(currentInstruction.duration);
        }
    }

    completeGuidedSequence() {
        console.log('✅ Secuencia guiada completada');

        this.instructionSystem.isActive = false;

        if (this.instructionTimeout) {
            clearTimeout(this.instructionTimeout);
        }

        // Notificar al paciente
        this.sendCommand('complete_guided_sequence', {
            examType: this.currentExamType,
            message: 'Secuencia completada - Excelente trabajo'
        });

        this.updateConnectionStatus('✅ Secuencia guiada completada - Analizando datos', 'connected');

        // Capturar automáticamente al completar
        setTimeout(() => {
            this.captureSnapshot();
        }, 2000);
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
        this.canvas.width = 600;
        this.canvas.height = 400;

        // Ajustar canvas al contenedor de análisis
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.objectFit = 'contain';

        this.patientVideoContainer.classList.remove('hidden');

        // Mostrar mensaje de espera hasta que lleguen datos
        this.noPatientMessage.innerHTML = '<h3>⏳ Esperando stream de datos del paciente...</h3>';
        this.noPatientMessage.style.display = 'flex';

        console.log('📊 Canvas configurado para análisis de esqueleto:', this.canvas.width, 'x', this.canvas.height);
    }

    drawPoseOnCanvas(landmarks) {
        if (!landmarks || landmarks.length === 0) return;

        // Ocultar mensaje de espera cuando llegan datos
        if (this.noPatientMessage.style.display !== 'none') {
            this.noPatientMessage.style.display = 'none';
        }

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

        // Dibujar información de análisis médico
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(`🦴 Landmarks: ${landmarks.length}`, 10, 25);

        this.ctx.fillStyle = '#ffff00';
        this.ctx.fillText(`📊 FPS: ${this.transmissionStats.fps}`, 10, 45);
        this.ctx.fillText(`⏱️ Latencia: ${this.transmissionStats.latency}ms`, 10, 65);

        // Mostrar calidad de análisis
        const qualityColor = this.transmissionStats.qualityScore === 'Excelente' ? '#00ff00' :
                           this.transmissionStats.qualityScore === 'Buena' ? '#ffff00' : '#ff6600';
        this.ctx.fillStyle = qualityColor;
        this.ctx.fillText(`🎯 Calidad: ${this.transmissionStats.qualityScore}`, 10, 85);

        // Indicador de análisis médico activo
        if (this.isExamRunning) {
            this.ctx.fillStyle = '#ff0080';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.fillText(`🩺 ANÁLISIS MÉDICO ACTIVO`, 10, 110);
        }
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

        // Recomendaciones basadas en alineación cervical
        if (metrics.posture.cervicalAlignment > 15) {
            recommendations.push('🔸 Considerar evaluación de postura cervical - desviación significativa detectada');
            recommendations.push('📋 Recomendaciones: Ejercicios de fortalecimiento cervical y corrección postural');
        } else if (metrics.posture.cervicalAlignment > 10) {
            recommendations.push('⚠️ Alineación cervical en límite superior - monitorear evolución');
        }

        // Recomendaciones basadas en inclinación pélvica
        if (metrics.posture.pelvicTilt > 5) {
            recommendations.push('🔸 Revisar alineación pélvica - inclinación fuera del rango normal');
            recommendations.push('📋 Recomendaciones: Ejercicios de estabilización pélvica y fortalecimiento del core');
        }

        // Recomendaciones basadas en desviación lateral
        if (metrics.posture.lateralDeviation > 30) {
            recommendations.push('🔸 Desviación lateral significativa - requiere atención médica');
            recommendations.push('📋 Recomendaciones: Evaluación ortopédica para descartar escoliosis o desequilibrios musculares');
        } else if (metrics.posture.lateralDeviation > 20) {
            recommendations.push('⚠️ Desviación lateral moderada - ejercicios de corrección recomendados');
        }

        // Recomendaciones basadas en simetría
        if (metrics.symmetry.shoulderSymmetry < 85) {
            recommendations.push('🔸 Asimetría en hombros detectada - considerar evaluación ortopédica');
            recommendations.push('📋 Recomendaciones: Ejercicios de equilibrio muscular y estiramiento específico');
        }

        if (metrics.symmetry.hipSymmetry < 85) {
            recommendations.push('🔸 Asimetría en caderas detectada - evaluación de longitud de miembros');
            recommendations.push('📋 Recomendaciones: Análisis biomecánico y corrección de desequilibrios');
        }

        if (metrics.symmetry.overallBalance < 80) {
            recommendations.push('🔸 Desequilibrio postural general - recomendable fisioterapia postural');
            recommendations.push('📋 Recomendaciones: Programa integral de reeducación postural');
        } else if (metrics.symmetry.overallBalance < 90) {
            recommendations.push('⚠️ Balance postural mejorable - ejercicios de propriocepción recomendados');
        }

        // Recomendaciones basadas en ángulos articulares
        if (metrics.joints.rightShoulderAngle < 160 || metrics.joints.leftShoulderAngle < 160) {
            recommendations.push('🔸 Limitación en rango articular de hombros - evaluación de movilidad');
            recommendations.push('📋 Recomendaciones: Ejercicios de movilización y estiramiento específico');
        }

        if (metrics.joints.rightHipAngle < 170 || metrics.joints.leftHipAngle < 170) {
            recommendations.push('🔸 Posible limitación en extensión de cadera - evaluación funcional');
            recommendations.push('📋 Recomendaciones: Ejercicios de flexibilidad y fortalecimiento de caderas');
        }

        // Recomendaciones específicas por tipo de examen
        if (this.currentExamType === 'rangos') {
            recommendations.push('📋 Evaluación de rangos de movimiento: Considerar análisis biomecánico completo');
        } else if (this.currentExamType === 'simetria') {
            recommendations.push('📋 Análisis de simetría: Monitorear evolución y considerar corrección postural');
        }

        // Si no hay problemas detectados
        if (recommendations.length === 0) {
            recommendations.push('✅ Parámetros posturales dentro de rangos normales');
            recommendations.push('📋 Recomendaciones: Mantener actividad física regular y controles preventivos');
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
        this.startGuidedBtn.disabled = false;
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

        // Solo mostrar mensaje si hay sesión activa
        if (this.isSessionActive) {
            this.noPatientMessage.innerHTML = '<h3>👤 Esperando conexión del paciente</h3>';
            this.noPatientMessage.style.display = 'flex';
        } else {
            this.noPatientMessage.style.display = 'none';
        }
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