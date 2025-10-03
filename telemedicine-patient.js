/**
 * Cliente del Paciente - Telemedicina
 * Envía datos de pose y video al médico en tiempo real
 */

class TelemedicinePatient {
    constructor() {
        this.socket = io();
        this.poseLandmarker = null;
        this.video = null;
        this.canvas = null;
        this.ctx = null;

        this.sessionCode = null;
        this.isConnected = false;
        this.isTransmitting = false;
        this.doctorData = null;

        // Datos del paciente
        this.patientData = {
            name: '',
            age: '',
            sessionId: null
        };

        // Métricas actuales
        this.currentMetrics = {
            posture: {},
            joints: {},
            symmetry: {}
        };

        // Configuración de landmarks MediaPipe
        this.landmarkIndices = {
            nose: 0, leftEye: 1, rightEye: 4, leftEar: 7, rightEar: 8,
            leftShoulder: 11, rightShoulder: 12,
            leftElbow: 13, rightElbow: 14, leftWrist: 15, rightWrist: 16,
            leftHip: 23, rightHip: 24,
            leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28
        };

        this.transmissionStats = {
            frameCount: 0,
            lastUpdate: Date.now()
        };

        this.audioEnabled = true;
        this.speechSynthesis = window.speechSynthesis;

        // WebRTC configuration
        this.peerConnection = null;
        this.localStream = null; // Guardar el stream local para WebRTC
        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.initializeInterface();
    }

    async initializeInterface() {
        console.log('👤 Inicializando interfaz del paciente...');

        try {
            // Inicializar elementos DOM
            this.initializeDOMElements();

            // Configurar event listeners
            this.setupEventListeners();

            // Inicializar MediaPipe
            await this.initializeMediaPipe();

            // Configurar Socket.io events
            this.setupSocketEvents();

            console.log('✅ Interfaz del paciente lista');

        } catch (error) {
            console.error('❌ Error inicializando interfaz:', error);
            this.updateConnectionStatus('Error de inicialización', 'error');
        }
    }

    initializeDOMElements() {
        // Elementos de conexión
        this.sessionCodeInput = document.getElementById('sessionCode');
        this.patientNameInput = document.getElementById('patientName');
        this.patientAgeInput = document.getElementById('patientAge');
        this.connectBtn = document.getElementById('connectBtn');
        this.connectionStatus = document.getElementById('connectionStatus');

        // Elementos de video
        this.video = document.getElementById('patientVideo');
        this.canvas = document.getElementById('poseCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.countdownOverlay = document.getElementById('countdownOverlay');

        // Elementos de interfaz
        this.instructionsPanel = document.getElementById('instructionsPanel');
        this.doctorInstructions = document.getElementById('doctorInstructions');
        this.doctorCommands = document.getElementById('doctorCommands');
        this.currentCommand = document.getElementById('currentCommand');

        // Elementos de instrucciones guiadas
        this.guidedInstructionsOverlay = document.getElementById('guidedInstructionsOverlay');
        this.guidedInstructionIcon = document.getElementById('guidedInstructionIcon');
        this.guidedInstructionTitle = document.getElementById('guidedInstructionTitle');
        this.guidedInstructionText = document.getElementById('guidedInstructionText');
        this.stepCounter = document.getElementById('stepCounter');
        this.guidedProgressBar = document.getElementById('guidedProgressBar');
        this.skipStepBtn = document.getElementById('skipStepBtn');
        this.guidedAudioToggle = document.getElementById('guidedAudioToggle');

        // Controles
        this.testCameraBtn = document.getElementById('testCameraBtn');
        this.toggleAudioBtn = document.getElementById('toggleAudioBtn');
        this.emergencyStopBtn = document.getElementById('emergencyStopBtn');

        // Estado
        this.transmissionStatus = document.getElementById('transmissionStatus');
        this.dataStats = document.getElementById('dataStats');
    }

    setupEventListeners() {
        // Conectar con médico
        this.connectBtn.addEventListener('click', () => this.connectToDoctor());

        // Controles
        this.testCameraBtn.addEventListener('click', () => this.testCamera());
        this.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
        this.emergencyStopBtn.addEventListener('click', () => this.emergencyStop());

        // Controles de instrucciones guiadas
        this.skipStepBtn.addEventListener('click', () => this.skipCurrentStep());
        this.guidedAudioToggle.addEventListener('click', () => this.toggleGuidedAudio());

        // Permitir solo letras/números en código de sesión
        this.sessionCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });

        // Tecla Enter para conectar
        this.sessionCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.connectToDoctor();
        });
    }

    setupSocketEvents() {
        // Conexión establecida
        this.socket.on('connect', () => {
            console.log('🔌 Conectado al servidor');
        });

        // Sesión unida exitosamente
        this.socket.on('session-joined', ({ sessionCode, doctorData, message }) => {
            console.log('✅ Conectado con médico:', message);

            this.sessionCode = sessionCode;
            this.doctorData = doctorData;
            this.isConnected = true;

            this.updateConnectionStatus(`🟢 Conectado con Dr. ${doctorData.name || 'Médico'}`, 'connected');
            this.showInstructionsPanel();
            this.startCamera();
        });

        // Error de sesión
        this.socket.on('session-error', ({ message }) => {
            console.error('❌ Error de sesión:', message);
            this.updateConnectionStatus(`❌ ${message}`, 'error');
        });

        // Comandos del médico
        this.socket.on('receive-command', ({ command, data, timestamp }) => {
            // console.log('📋 Comando recibido:', command, data);
            this.handleDoctorCommand(command, data);
        });

        // Médico desconectado
        this.socket.on('doctor-disconnected', ({ message }) => {
            console.log('👨‍⚕️ Médico desconectado:', message);
            this.updateConnectionStatus('🟡 Médico desconectado - Esperando reconexión', 'disconnected');
            this.isConnected = false;
            this.stopTransmission();
        });

        // Médico listo para WebRTC
        this.socket.on('doctor-ready-for-webrtc', ({ sessionCode, message }) => {
            // Iniciar WebRTC ahora que el médico está listo
            if (this.localStream) {
                this.setupWebRTC(this.localStream);
            } else {
                // Reintentar después de 1 segundo si el stream no está listo
                setTimeout(() => {
                    if (this.localStream) {
                        this.setupWebRTC(this.localStream);
                    } else {
                        console.error('❌ Stream local no disponible después de espera');
                    }
                }, 1000);
            }
        });

        // WebRTC signaling
        this.socket.on('webrtc-answer', async ({ answer }) => {
            if (this.peerConnection) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            }
        });

        this.socket.on('webrtc-ice-candidate', async ({ candidate }) => {
            if (this.peerConnection && candidate) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

        // Snapshot capturado
        this.socket.on('snapshot-captured', ({ snapshotData, timestamp }) => {
            console.log('📸 Snapshot capturado por el médico');
            this.showMessage('📸 El médico ha capturado una imagen para el análisis');
        });

        // Desconexión
        this.socket.on('disconnect', () => {
            console.log('🔌 Desconectado del servidor');
            this.updateConnectionStatus('🔴 Desconectado del servidor', 'disconnected');
            this.isConnected = false;
            this.stopTransmission();
        });
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

            console.log('✅ MediaPipe inicializado');
            return true;
        } catch (error) {
            console.error('❌ Error inicializando MediaPipe:', error);
            return false;
        }
    }

    connectToDoctor() {
        const sessionCode = this.sessionCodeInput.value.trim();
        const patientName = this.patientNameInput.value.trim();
        const patientAge = this.patientAgeInput.value.trim();

        if (!sessionCode || sessionCode.length !== 6) {
            alert('Por favor ingrese un código de sesión válido de 6 caracteres');
            return;
        }

        if (!patientName) {
            alert('Por favor ingrese su nombre');
            return;
        }

        this.patientData = {
            name: patientName,
            age: patientAge || 'No especificada',
            sessionId: Date.now()
        };

        this.updateConnectionStatus('🟡 Conectando con el médico...', 'connecting');

        this.socket.emit('patient-join', {
            sessionCode,
            patientData: this.patientData
        });

        console.log(`🔗 Intentando conectar a sesión: ${sessionCode}`);
    }

    async startCamera() {
        try {
            console.log('📹 Iniciando cámara...');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });

            // Guardar el stream local para WebRTC
            this.localStream = stream;
            console.log('💾 Stream local guardado para WebRTC');

            this.video.srcObject = stream;

            // Configurar handler ANTES de play()
            this.video.onloadedmetadata = async () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;

                // WebRTC se iniciará cuando el servidor envíe 'doctor-ready-for-webrtc'
                this.startTransmission();
            };

            await this.video.play();

        } catch (error) {
            console.error('❌ Error accediendo a la cámara:', error);
            this.updateConnectionStatus('❌ Error: No se puede acceder a la cámara', 'error');
        }
    }

    async setupWebRTC(stream) {
        try {
            if (!this.sessionCode) {
                console.error('❌ No hay sessionCode disponible para WebRTC');
                return;
            }

            // Crear peer connection
            this.peerConnection = new RTCPeerConnection(this.iceServers);

            // Agregar tracks del stream al peer connection
            stream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, stream);
            });

            // Manejar ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('webrtc-ice-candidate', {
                        sessionCode: this.sessionCode,
                        candidate: event.candidate
                    });
                }
            };

            // Manejar estado de conexión
            this.peerConnection.onconnectionstatechange = () => {
                if (this.peerConnection.connectionState === 'connected') {
                    console.log('✅ Video streaming conectado');
                }
            };

            // Crear offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            // Enviar offer al médico
            this.socket.emit('webrtc-offer', {
                sessionCode: this.sessionCode,
                offer: offer
            });

        } catch (error) {
            console.error('❌ Error configurando WebRTC:', error);
        }
    }

    startTransmission() {
        if (this.isTransmitting) return;

        console.log('📡 Iniciando transmisión de datos...');
        this.isTransmitting = true;
        this.transmitPoseData();

        this.updateTransmissionStatus('📡 Transmitiendo datos al médico', 'active');
    }

    stopTransmission() {
        this.isTransmitting = false;
        this.updateTransmissionStatus('📡 Transmisión detenida', 'inactive');
    }

    async transmitPoseData() {
        if (!this.isTransmitting || !this.isConnected || !this.poseLandmarker) {
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

                // Dibujar pose en canvas local
                this.drawPoseLandmarks(landmarks);

                // Calcular métricas
                this.calculateMedicalMetrics(landmarks);

                // Enviar datos al médico
                const dataToSend = {
                    sessionCode: this.sessionCode,
                    landmarks: landmarks,
                    metrics: this.currentMetrics,
                    timestamp: Date.now()
                };

                this.socket.emit('pose-data', dataToSend);

                // Actualizar estadísticas (sin log para no saturar consola)
                this.transmissionStats.frameCount++;
            }

            // Calcular FPS
            const endTime = performance.now();
            const fps = Math.round(1000 / (endTime - startTime));
            this.updateDataStats(fps);

        } catch (error) {
            console.error('❌ Error en transmisión:', error);
        }

        // Continuar transmisión
        if (this.isTransmitting) {
            requestAnimationFrame(() => this.transmitPoseData());
        }
    }

    drawPoseLandmarks(landmarks) {
        // Ocultar mensaje de "esperando análisis" cuando se detectan landmarks
        const noAnalysisMessage = document.getElementById('noAnalysisMessage');
        if (noAnalysisMessage && noAnalysisMessage.style.display !== 'none') {
            noAnalysisMessage.style.display = 'none';
        }

        const pointRadius = 4;
        const lineWidth = 2;

        // Conexiones del esqueleto
        const connections = [
            [this.landmarkIndices.leftShoulder, this.landmarkIndices.rightShoulder],
            [this.landmarkIndices.leftShoulder, this.landmarkIndices.leftElbow],
            [this.landmarkIndices.leftElbow, this.landmarkIndices.leftWrist],
            [this.landmarkIndices.rightShoulder, this.landmarkIndices.rightElbow],
            [this.landmarkIndices.rightElbow, this.landmarkIndices.rightWrist],
            [this.landmarkIndices.leftShoulder, this.landmarkIndices.leftHip],
            [this.landmarkIndices.rightShoulder, this.landmarkIndices.rightHip],
            [this.landmarkIndices.leftHip, this.landmarkIndices.rightHip],
            [this.landmarkIndices.leftHip, this.landmarkIndices.leftKnee],
            [this.landmarkIndices.leftKnee, this.landmarkIndices.leftAnkle],
            [this.landmarkIndices.rightHip, this.landmarkIndices.rightKnee],
            [this.landmarkIndices.rightKnee, this.landmarkIndices.rightAnkle]
        ];

        // Dibujar conexiones
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];

            if (startPoint && endPoint) {
                this.ctx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
                this.ctx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
            }
        });

        this.ctx.stroke();

        // Dibujar puntos
        landmarks.forEach((landmark, index) => {
            const x = landmark.x * this.canvas.width;
            const y = landmark.y * this.canvas.height;

            let color = '#00ff00';
            if (Object.values(this.landmarkIndices).includes(index)) {
                color = '#ff0000';
            }

            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
            this.ctx.fill();

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

        // Calcular métricas médicas (mismas que en la versión original)
        this.currentMetrics = {
            posture: {
                cervicalAlignment: this.calculateCervicalAlignment(nose, leftShoulder, rightShoulder),
                pelvicTilt: this.calculatePelvicTilt(leftHip, rightHip),
                lateralDeviation: this.calculateLateralDeviation(nose, leftShoulder, rightShoulder, leftHip, rightHip)
            },
            joints: {
                rightShoulderAngle: this.calculateShoulderAngle(landmarks, 'right'),
                leftShoulderAngle: this.calculateShoulderAngle(landmarks, 'left'),
                rightHipAngle: this.calculateHipAngle(landmarks, 'right'),
                leftHipAngle: this.calculateHipAngle(landmarks, 'left')
            },
            symmetry: {
                shoulderSymmetry: this.calculateSymmetry(leftShoulder.y, rightShoulder.y),
                hipSymmetry: this.calculateSymmetry(leftHip.y, rightHip.y),
                overallBalance: this.calculateOverallBalance(landmarks)
            }
        };
    }

    // Métodos de cálculo médico (copiados de la versión original)
    calculateCervicalAlignment(nose, leftShoulder, rightShoulder) {
        const shoulderMidpoint = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2
        };

        // CÁLCULO CORREGIDO: Medir desviación lateral (horizontal) de la cabeza
        // En lugar de atan2, usamos directamente la desviación horizontal en grados
        const deltaX = nose.x - shoulderMidpoint.x;
        const deltaY = nose.y - shoulderMidpoint.y;

        // Convertir desviación horizontal a ángulo en grados
        // deltaX representa la fracción de la anchura de la imagen (0-1)
        // Multiplicamos por un factor de escala para obtener grados aproximados
        // Un desplazamiento de 0.1 (10% del ancho) ≈ 5-10 grados de inclinación
        const lateralAngle = Math.abs(deltaX) * 100; // Convertir a grados aproximados

        // DEBUG: Actualizar panel visual cada 15 frames (~0.5 segundos)
        if (!this._cervicalDebugCounter) this._cervicalDebugCounter = 0;
        this._cervicalDebugCounter++;

        if (this._cervicalDebugCounter % 15 === 0) {
            const debugPanel = document.getElementById('cervicalDebugData');
            if (debugPanel) {
                const verticalStatus = deltaY < 0 ? '✅ CABEZA ARRIBA' :
                                      deltaY > 0 ? '⚠️ CABEZA ABAJO' :
                                      '⚠️ NIVEL CON HOMBROS';

                debugPanel.innerHTML = `
                    Nariz Y: ${nose.y.toFixed(3)} | Hombros Y: ${shoulderMidpoint.y.toFixed(3)}<br>
                    Desviación Vertical: ${(deltaY * 100).toFixed(1)}% (${verticalStatus})<br>
                    Desviación Lateral: ${(Math.abs(deltaX) * 100).toFixed(1)}%<br>
                    Ángulo Cervical: <span style="color: ${lateralAngle > 15 ? '#e85d55' : lateralAngle > 10 ? '#f7b928' : '#5ebd6d'}; font-weight: 700;">${lateralAngle.toFixed(1)}°</span>
                `;

                // También log en consola cada 60 frames para debugging
                if (this._cervicalDebugCounter % 60 === 0) {
                    console.log('🔍 Diagnóstico Cervical CORREGIDO:', {
                        nose_y: nose.y.toFixed(4),
                        shoulder_mid_y: shoulderMidpoint.y.toFixed(4),
                        deltaY_percent: (deltaY * 100).toFixed(2) + '%',
                        deltaX_percent: (deltaX * 100).toFixed(2) + '%',
                        lateral_angle: lateralAngle.toFixed(2) + '°'
                    });
                }
            }
        }

        return lateralAngle;
    }

    calculatePelvicTilt(leftHip, rightHip) {
        const deltaY = leftHip.y - rightHip.y;
        const deltaX = leftHip.x - rightHip.x;
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        return Math.abs(angle);
    }

    calculateLateralDeviation(nose, leftShoulder, rightShoulder, leftHip, rightHip) {
        const shoulderCenter = (leftShoulder.x + rightShoulder.x) / 2;
        const hipCenter = (leftHip.x + rightHip.x) / 2;
        const bodyCenter = (shoulderCenter + hipCenter) / 2;
        const deviation = Math.abs(nose.x - bodyCenter) * 1000;
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
        const vector1 = { x: point1.x - point2.x, y: point1.y - point2.y };
        const vector2 = { x: point3.x - point2.x, y: point3.y - point2.y };
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

    handleDoctorCommand(command, data) {
        switch (command) {
            case 'start_exam':
                this.currentCommand.textContent = '▶️ Iniciar examen - Manténgase en posición';
                this.showDoctorCommands();
                if (this.audioEnabled) {
                    this.speak('El médico ha iniciado el examen. Manténgase en posición.');
                }
                break;

            case 'stop_exam':
                this.currentCommand.textContent = '⏹️ Examen detenido - Puede relajarse';
                if (this.audioEnabled) {
                    this.speak('El examen ha finalizado. Puede relajarse.');
                }
                this.hideGuidedInstructions();
                break;

            case 'instruction':
                this.currentCommand.textContent = `📋 ${data.text}`;
                this.doctorInstructions.innerHTML = `<p><strong>${data.title || 'Instrucción'}:</strong> ${data.text}</p>`;
                if (this.audioEnabled && data.text) {
                    this.speak(data.text);
                }
                break;

            case 'countdown':
                this.showCountdown(data.seconds || 5);
                break;

            case 'position_feedback':
                this.doctorInstructions.innerHTML = `<p><strong>Posicionamiento:</strong> ${data.message}</p>`;
                if (this.audioEnabled) {
                    this.speak(data.message);
                }
                break;

            // Comandos de secuencia guiada
            case 'start_guided_sequence':
                this.startGuidedSequence(data);
                break;

            case 'next_guided_step':
                this.nextGuidedStep(data);
                break;

            case 'complete_guided_sequence':
                this.completeGuidedSequence(data);
                break;

            default:
                console.log('Comando desconocido:', command);
        }
    }

    async showCountdown(seconds) {
        this.countdownOverlay.classList.remove('hidden');

        for (let i = seconds; i > 0; i--) {
            this.countdownOverlay.textContent = i.toString();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.countdownOverlay.classList.add('hidden');
    }

    async showLargeCountdown(seconds) {
        console.log('🎬 showLargeCountdown iniciado con', seconds, 'segundos');

        // Crear overlay de countdown grande si no existe
        let countdownBigOverlay = document.getElementById('countdownBigOverlay');

        if (!countdownBigOverlay) {
            countdownBigOverlay = document.createElement('div');
            countdownBigOverlay.id = 'countdownBigOverlay';
            countdownBigOverlay.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 9999;
                background: rgba(0, 0, 0, 0.95);
                color: #28a745;
                font-size: 180px;
                font-weight: 700;
                width: 400px;
                height: 400px;
                border-radius: 50%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: 'Figtree', Arial, sans-serif;
                border: 8px solid #28a745;
                box-shadow: 0 0 60px rgba(40, 167, 69, 0.6);
            `;
            document.body.appendChild(countdownBigOverlay);
        }

        // Mostrar contador
        countdownBigOverlay.style.display = 'flex';

        for (let i = Math.floor(seconds); i > 0; i--) {
            countdownBigOverlay.innerHTML = `
                <div style="font-size: 180px; line-height: 1;">${i}</div>
                <div style="font-size: 24px; margin-top: 10px; color: #5ebd6d;">Prepárese y quédese quieto</div>
            `;

            // Efecto de pulso
            countdownBigOverlay.style.transform = 'translate(-50%, -50%) scale(1.1)';
            setTimeout(() => {
                countdownBigOverlay.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 100);

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Mostrar "¡Listo!"
        countdownBigOverlay.innerHTML = `
            <div style="font-size: 80px; color: #5ebd6d;">✓</div>
            <div style="font-size: 36px; margin-top: 20px; color: #5ebd6d;">¡Listo!</div>
        `;

        await new Promise(resolve => setTimeout(resolve, 1000));

        countdownBigOverlay.style.display = 'none';
    }

    testCamera() {
        if (!this.video.srcObject) {
            this.startCamera();
        } else {
            console.log('📹 Cámara ya activa');
        }
    }

    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        this.toggleAudioBtn.textContent = this.audioEnabled ? '🔊 Audio' : '🔇 Audio';
        console.log(`🔊 Audio ${this.audioEnabled ? 'habilitado' : 'deshabilitado'}`);
    }

    emergencyStop() {
        console.log('🚨 Parada de emergencia activada');

        this.stopTransmission();

        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }

        this.socket.disconnect();

        this.updateConnectionStatus('🚨 Parada de emergencia - Desconectado', 'error');

        alert('🚨 Parada de emergencia activada. La sesión se ha desconectado.');
    }

    speak(text) {
        if (!this.audioEnabled || !window.speechSynthesis) return;

        this.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;

        const voices = this.speechSynthesis.getVoices();
        const spanishVoice = voices.find(voice => voice.lang.includes('es'));
        if (spanishVoice) {
            utterance.voice = spanishVoice;
        }

        this.speechSynthesis.speak(utterance);
    }

    showMessage(message, duration = 3000) {
        // Crear un toast message
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration);
    }

    showInstructionsPanel() {
        this.instructionsPanel.classList.remove('hidden');
    }

    showDoctorCommands() {
        this.doctorCommands.classList.remove('hidden');
    }

    updateConnectionStatus(message, type) {
        this.connectionStatus.textContent = message;
        this.connectionStatus.className = `connection-status status-${type}`;
    }

    updateTransmissionStatus(message, type) {
        this.transmissionStatus.textContent = message;
        this.transmissionStatus.className = `transmission-${type}`;
    }

    updateDataStats(fps) {
        const now = Date.now();
        if (now - this.transmissionStats.lastUpdate > 1000) {
            this.dataStats.textContent = `📊 Transmisión: ${fps} fps | Frames: ${this.transmissionStats.frameCount}`;
            this.transmissionStats.lastUpdate = now;
        }
    }

    // ==========================================
    // SISTEMA DE SECUENCIAS GUIADAS
    // ==========================================

    startGuidedSequence(data) {
        // console.log('🎯 Iniciando secuencia guiada:', data.examType);

        this.currentGuidedSequence = {
            examType: data.examType,
            totalSteps: data.totalSteps,
            currentStep: data.currentStep,
            isActive: true
        };

        // Mostrar overlay de instrucciones guiadas
        this.showGuidedInstructions();

        // Mostrar primera instrucción
        this.displayGuidedInstruction(data.instruction, data.currentStep + 1, data.totalSteps);

        // Reproducir audio si está habilitado
        if (this.audioEnabled && data.instruction.audio) {
            this.speak(data.instruction.audio);
        }

        // Animar barra de progreso
        this.animateGuidedProgress(data.instruction.duration);
    }

    nextGuidedStep(data) {
        if (!this.currentGuidedSequence || !this.currentGuidedSequence.isActive) return;

        // console.log('➡️ Siguiente paso de secuencia guiada:', data.currentStep + 1, 'de', data.totalSteps);

        this.currentGuidedSequence.currentStep = data.currentStep;

        // Actualizar instrucción
        this.displayGuidedInstruction(data.instruction, data.currentStep + 1, data.totalSteps);

        // Reproducir audio
        if (this.audioEnabled && data.instruction.audio) {
            this.speak(data.instruction.audio);
        }

        // Animar barra de progreso
        this.animateGuidedProgress(data.instruction.duration);
    }

    completeGuidedSequence(data) {
        // console.log('✅ Secuencia guiada completada');

        if (this.currentGuidedSequence) {
            this.currentGuidedSequence.isActive = false;
        }

        // Mostrar mensaje de completado
        this.guidedInstructionIcon.textContent = '🎉';
        this.guidedInstructionTitle.textContent = 'Secuencia Completada';
        this.guidedInstructionText.textContent = data.message || 'Excelente trabajo, secuencia finalizada';
        this.stepCounter.textContent = 'Finalizado';

        // Completar barra de progreso
        this.guidedProgressBar.style.width = '100%';

        // Reproducir audio de finalización
        if (this.audioEnabled) {
            this.speak(data.message || 'Secuencia completada. Excelente trabajo.');
        }

        // Ocultar overlay después de unos segundos
        setTimeout(() => {
            this.hideGuidedInstructions();
        }, 3000);

        this.showMessage('🎉 Secuencia de examen completada exitosamente');
    }

    displayGuidedInstruction(instruction, stepNumber, totalSteps) {
        // console.log('📋 Mostrando instrucción:', {
        //     step: stepNumber,
        //     total: totalSteps,
        //     hasCountdown: instruction.showCountdown,
        //     duration: instruction.duration
        // });

        this.guidedInstructionIcon.textContent = instruction.icon;
        this.guidedInstructionTitle.textContent = instruction.title;
        this.guidedInstructionText.textContent = instruction.text;
        this.stepCounter.textContent = `Paso ${stepNumber} de ${totalSteps}`;

        // Si es el primer paso con countdown, mostrar contador grande
        if (instruction.showCountdown && stepNumber === 1) {
            this.showLargeCountdown(instruction.duration / 1000);
        }
    }

    animateGuidedProgress(duration) {
        this.guidedProgressBar.style.width = '0%';

        let progress = 0;
        const interval = 100; // ms
        const increment = (interval / duration) * 100;

        const progressAnimation = setInterval(() => {
            progress += increment;

            if (progress >= 100) {
                progress = 100;
                clearInterval(progressAnimation);
            }

            this.guidedProgressBar.style.width = `${progress}%`;
        }, interval);
    }

    showGuidedInstructions() {
        this.guidedInstructionsOverlay.classList.remove('hidden');
    }

    hideGuidedInstructions() {
        this.guidedInstructionsOverlay.classList.add('hidden');
    }

    skipCurrentStep() {
        console.log('⏭️ Saltando paso actual de secuencia guiada');

        // Notificar al médico que se saltó el paso
        this.socket.emit('patient_skip_step', {
            sessionCode: this.sessionCode,
            currentStep: this.currentGuidedSequence?.currentStep || 0
        });

        this.showMessage('⏭️ Paso saltado - Continuando con siguiente instrucción');
    }

    toggleGuidedAudio() {
        this.audioEnabled = !this.audioEnabled;
        this.guidedAudioToggle.textContent = this.audioEnabled ? '🔊 Audio' : '🔇 Audio';
        this.guidedAudioToggle.classList.toggle('active', this.audioEnabled);

        console.log(`🔊 Audio de instrucciones ${this.audioEnabled ? 'habilitado' : 'deshabilitado'}`);
    }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    console.log('👤 Iniciando interfaz del paciente...');
    window.telemedicinePatient = new TelemedicinePatient();
});