/**
 * Cliente del Paciente - Telemedicina
 * Envía datos de pose y video al médico en tiempo real
 */

class TelemedicinePatient {
    constructor() {
        // ✅ LOGGING SYSTEM: Initialize logger
        this.logger = new Logger('patient');
        this.logger.initializeTracking();
        this.logger.info('TelemedicinePatient initializing', {}, 'general');

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
        this.audioActivated = false;
        this.speechSynthesis = window.speechSynthesis;
        this.audioManager = null; // Se inicializa en showExamScreen()

        // Twilio Video configuration
        this.twilioRoom = null;
        this.twilioToken = null;
        this.localStream = null;

        this.initializeInterface();
    }

    async initializeInterface() {
        console.log('👤 Inicializando interfaz del paciente...');

        try {
            // Inicializar elementos DOM
            this.initializeDOMElements();

            // Auto-completar nombre desde URL
            this.loadPatientDataFromURL();

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

    loadPatientDataFromURL() {
        // Leer parámetros de URL
        const urlParams = new URLSearchParams(window.location.search);

        // Opción 1: ?nombre=Juan&apellido=Pérez
        const nombre = urlParams.get('nombre');
        const apellido = urlParams.get('apellido');

        // Opción 2: ?fullname=Juan Pérez (alternativa)
        const fullname = urlParams.get('fullname');

        if (fullname) {
            // Si viene fullname completo
            this.patientNameInput.value = fullname;
        } else if (nombre && apellido) {
            // Si vienen nombre y apellido separados
            this.patientNameInput.value = `${nombre} ${apellido}`;
        } else if (nombre) {
            // Si solo viene nombre
            this.patientNameInput.value = nombre;
        }

        // Auto-completar código de sesión si viene en URL
        const sessionCode = urlParams.get('session') || urlParams.get('codigo');
        if (sessionCode) {
            this.sessionCodeInput.value = sessionCode.toUpperCase();
        }
    }

    initializeDOMElements() {
        // Pantallas
        this.loginScreen = document.getElementById('loginScreen');
        this.examScreen = document.getElementById('examScreen');

        // Elementos de conexión (login screen)
        this.loginForm = document.getElementById('loginForm');
        this.sessionCodeInput = document.getElementById('sessionCode');
        this.patientNameInput = document.getElementById('patientName');
        this.connectBtn = document.getElementById('connectBtn');
        this.connectionStatus = document.getElementById('connectionStatus');

        // Elementos del exam screen
        this.patientInfo = document.getElementById('patientInfo');
        this.connectionBadge = document.getElementById('connectionBadge');
        this.disconnectBtn = document.getElementById('disconnectBtn');

        // Elementos de video
        this.video = document.getElementById('patientVideo');
        this.canvas = document.getElementById('poseCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.videoPlaceholder = document.getElementById('videoPlaceholder');
        this.countdownOverlay = document.getElementById('countdownOverlay');

        // Canvas de análisis separado
        this.analysisCanvas = document.getElementById('analysisCanvas');
        this.analysisCtx = this.analysisCanvas ? this.analysisCanvas.getContext('2d') : null;
        this.analysisPlaceholder = document.getElementById('analysisPlaceholder');

        // Video del médico
        this.doctorVideo = document.getElementById('doctorVideo');
        this.doctorVideoPlaceholder = document.getElementById('doctorVideoPlaceholder');

        // Elementos de interfaz
        this.doctorInstructions = document.getElementById('doctorInstructions');
        this.currentInstructionBanner = document.getElementById('currentInstructionBanner');

        // Elementos de instrucciones guiadas
        this.guidedInstructionsOverlay = document.getElementById('guidedInstructionsOverlay');
        this.guidedInstructionIcon = document.getElementById('guidedInstructionIcon');
        this.guidedInstructionTitle = document.getElementById('guidedInstructionTitle');
        this.guidedInstructionText = document.getElementById('guidedInstructionText');
        this.stepCounter = document.getElementById('stepCounter');
        this.guidedProgressBar = document.getElementById('guidedProgressBar');
        this.skipStepBtn = document.getElementById('skipStepBtn');
        this.guidedAudioToggle = document.getElementById('guidedAudioToggle');

        // Estado
        this.transmissionStatus = document.getElementById('transmissionStatus');
        this.dataStats = document.getElementById('dataStats');

        // Audio activation (para móviles)
        this.audioActivationPanel = document.getElementById('audioActivationPanel');
        this.activateAudioBtn = document.getElementById('activateAudioBtn');
        this.audioActivated = false;
    }

    setupEventListeners() {
        // Form submit para login
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.connectToDoctor();
        });

        // Botón disconnect
        if (this.disconnectBtn) {
            this.disconnectBtn.addEventListener('click', () => this.disconnect());
        }

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

        // Botón de activación de audio para móvil
        if (this.activateAudioBtn) {
            this.activateAudioBtn.addEventListener('click', () => this.activateAudio());
        }
    }

    setupSocketEvents() {
        // Conexión establecida
        this.socket.on('connect', () => {
            console.log('🔌 Conectado al servidor');
        });

        // Sesión unida exitosamente
        this.socket.on('session-joined', ({ sessionCode, doctorData, message }) => {
            this.logger.success('Conectado con médico', {
                sessionCode: sessionCode,
                doctorName: doctorData.name,
                message: message
            }, 'socket');
            console.log('✅ Conectado con médico:', message);

            this.sessionCode = sessionCode;
            this.logger.setSessionCode(sessionCode);
            this.doctorData = doctorData;
            this.isConnected = true;

            // Cambiar a pantalla de examen
            this.showExamScreen();

            // Actualizar info del paciente en header
            this.patientInfo.textContent = `${this.patientData.name} - Conectado con Dr. ${doctorData.name || 'Médico'}`;

            // Iniciar cámara
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
                this.joinTwilioRoom();
            } else {
                // Reintentar después de 1 segundo si el stream no está listo
                setTimeout(() => {
                    if (this.localStream) {
                        this.joinTwilioRoom();
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

        if (!sessionCode || sessionCode.length !== 6) {
            this.logger.warning('Código de sesión inválido', { sessionCode }, 'general');
            alert('Por favor ingrese un código de sesión válido de 6 caracteres');
            return;
        }

        if (!patientName) {
            this.logger.warning('Intento de conectar sin nombre', {}, 'general');
            alert('Por favor ingrese su nombre');
            return;
        }

        this.patientData = {
            name: patientName,
            sessionId: Date.now()
        };

        this.logger.info('Intentando conectar con médico', {
            sessionCode: sessionCode,
            patientName: patientName,
            patientSessionId: this.patientData.sessionId
        }, 'socket');

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

            this.video.srcObject = stream;

            // Configurar handler ANTES de play()
            this.video.onloadedmetadata = async () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;

                // También configurar canvas de análisis
                if (this.analysisCanvas) {
                    this.analysisCanvas.width = this.video.videoWidth;
                    this.analysisCanvas.height = this.video.videoHeight;
                }

                // WebRTC se iniciará cuando el servidor envíe 'doctor-ready-for-webrtc'
                this.startTransmission();
            };

            await this.video.play();
            console.log('✅ Cámara y canvas iniciados correctamente');

        } catch (error) {
            const errorMessage = error.message || String(error);
            const errorName = error.name || 'UnknownError';

            this.logger.error('❌ Error accediendo a la cámara (getUserMedia)', {
                error: errorMessage,
                errorName: errorName,
                errorCode: error.code,
                constraint: error.constraint,
                sessionCode: this.sessionCode
            }, 'camera');
            console.error('❌ Error accediendo a la cámara:', error);

            // Mensajes específicos
            if (errorName === 'NotAllowedError') {
                this.updateConnectionStatus('❌ Permisos de cámara denegados', 'error');
                alert('⚠️ ACCESO DENEGADO\n\nDebe permitir acceso a la cámara para continuar.\n\n' +
                      'En su navegador:\n' +
                      '1. Busque el ícono 🔒 o ⓘ en la barra de direcciones\n' +
                      '2. Permita acceso a cámara y micrófono\n' +
                      '3. Recargue esta página');
            } else if (errorName === 'NotFoundError') {
                this.updateConnectionStatus('❌ Cámara no encontrada', 'error');
                alert('⚠️ CÁMARA NO ENCONTRADA\n\nNo se detectó ninguna cámara.\n\n' +
                      'Verifique que:\n' +
                      '• La cámara esté conectada\n' +
                      '• Los drivers estén instalados\n' +
                      '• La cámara funcione en otras aplicaciones');
            } else if (errorName === 'NotReadableError') {
                this.updateConnectionStatus('❌ Cámara en uso', 'error');
                alert('⚠️ CÁMARA EN USO\n\nLa cámara está siendo usada por otra aplicación.\n\n' +
                      'Soluciones:\n' +
                      '• Cierre Zoom, Teams, Skype u otras apps de video\n' +
                      '• Cierre otras pestañas que usen la cámara\n' +
                      '• Recargue esta página');
            } else {
                this.updateConnectionStatus('❌ Error: No se puede acceder a la cámara', 'error');
                alert(`⚠️ ERROR DE CÁMARA\n\n${errorMessage}\n\nPor favor recargue la página e intente nuevamente.`);
            }
        }
    }

    async joinTwilioRoom() {
        try {
            // ✅ CRÍTICO: Prevenir reconexiones duplicadas
            if (this.twilioRoom) {
                this.logger.warning('⚠️ Ya conectado a sala Twilio - Ignorando reconexión', {
                    roomName: this.twilioRoom.name,
                    roomSid: this.twilioRoom.sid,
                    state: this.twilioRoom.state
                }, 'twilio');
                console.warn('⚠️ Ya conectado a sala Twilio - Ignorando reconexión');
                return;
            }

            if (!this.sessionCode) {
                const errorMsg = 'No hay sessionCode disponible para Twilio';
                this.logger.error(errorMsg, { sessionCode: this.sessionCode }, 'twilio');
                console.error('❌', errorMsg);
                return;
            }

            // 🔍 LOG: Capturar datos completos de URL y conexión
            this.logger.info('🔍 DIAGNÓSTICO: Datos de conexión del paciente', {
                url: window.location.href,
                urlParams: window.location.search,
                sessionCode: this.sessionCode,
                patientName: this.patientData.name,
                patientAge: this.patientData.age,
                userAgent: navigator.userAgent,
                browser: navigator.userAgentData?.brands || 'unknown',
                platform: navigator.platform,
                screenSize: `${window.screen.width}x${window.screen.height}`,
                viewport: `${window.innerWidth}x${window.innerHeight}`
            }, 'diagnostic');

            // ✅ VALIDACIÓN PREVIA: Verificar permisos de cámara/micrófono
            this.logger.info('🔍 Validando permisos de media antes de conectar a Twilio', {
                hasLocalStream: !!this.localStream,
                videoTracks: this.localStream?.getVideoTracks()?.length || 0,
                audioTracks: this.localStream?.getAudioTracks()?.length || 0
            }, 'diagnostic');

            if (!this.localStream) {
                const errorMsg = '❌ No hay stream de cámara disponible. Debe permitir acceso a cámara/micrófono.';
                this.logger.error(errorMsg, {
                    sessionCode: this.sessionCode,
                    suggestion: 'Verificar permisos del navegador para cámara y micrófono'
                }, 'camera');
                console.error(errorMsg);

                this.updateConnectionStatus('❌ Error: Permita acceso a cámara y micrófono', 'error');
                alert('⚠️ Debe permitir acceso a la cámara y micrófono para continuar.\n\nPor favor:\n1. Verifique los permisos del navegador\n2. Recargue la página\n3. Permita acceso cuando se le solicite');
                return;
            }

            // Verificar que el stream tenga tracks activos
            const videoTracks = this.localStream.getVideoTracks();
            const audioTracks = this.localStream.getAudioTracks();

            if (videoTracks.length === 0) {
                const errorMsg = '❌ No se encontraron pistas de video en el stream';
                this.logger.error(errorMsg, {
                    sessionCode: this.sessionCode,
                    audioTracks: audioTracks.length,
                    streamActive: this.localStream.active
                }, 'camera');
                console.error(errorMsg);

                this.updateConnectionStatus('❌ Error: No se detectó video de la cámara', 'error');
                alert('⚠️ No se pudo acceder a la cámara.\n\nPosibles causas:\n• Otra aplicación está usando la cámara\n• Los permisos fueron denegados\n• La cámara está desconectada\n\nPor favor cierre otras aplicaciones y recargue la página.');
                return;
            }

            // Verificar que los tracks estén en estado ready
            const videoTrack = videoTracks[0];
            if (videoTrack.readyState !== 'live') {
                this.logger.warning('⚠️ Track de video no está en estado "live"', {
                    readyState: videoTrack.readyState,
                    enabled: videoTrack.enabled,
                    muted: videoTrack.muted
                }, 'camera');
            }

            this.logger.success('✅ Validación de media completada', {
                videoTracks: videoTracks.length,
                audioTracks: audioTracks.length,
                videoState: videoTrack.readyState,
                audioState: audioTracks[0]?.readyState || 'none'
            }, 'camera');

            this.logger.info('Conectando a Twilio Video', {
                sessionCode: this.sessionCode,
                identity: `patient-${this.patientData.name}`
            }, 'twilio');
            console.log('📺 Conectando a Twilio Video...');

            // Obtener token de Twilio
            this.logger.debug('Solicitando token de Twilio', {
                endpoint: '/twilio-token',
                identity: `patient-${this.patientData.name}`,
                room: this.sessionCode
            }, 'twilio');

            const response = await fetch('/twilio-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identity: `patient-${this.patientData.name}`,
                    room: this.sessionCode
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.twilioToken = data.token;

            this.logger.success('Token de Twilio obtenido', {
                tokenLength: this.twilioToken?.length,
                room: data.room,
                identity: data.identity
            }, 'twilio');

            // Conectar a sala de Twilio con video/audio local
            this.logger.info('Iniciando conexión a sala Twilio', {
                room: this.sessionCode,
                config: {
                    audio: true,
                    video: { width: 640, height: 480 },
                    networkQuality: { local: 1, remote: 1 }
                }
            }, 'twilio');

            this.twilioRoom = await Twilio.Video.connect(this.twilioToken, {
                name: this.sessionCode,
                audio: true,
                video: { width: 640, height: 480 },
                networkQuality: { local: 1, remote: 1 }
            });

            this.logger.success('Conectado a sala Twilio', {
                roomName: this.twilioRoom.name,
                roomSid: this.twilioRoom.sid,
                localParticipantSid: this.twilioRoom.localParticipant.sid,
                localParticipantIdentity: this.twilioRoom.localParticipant.identity,
                state: this.twilioRoom.state
            }, 'twilio');
            console.log('✅ Conectado a sala Twilio:', this.twilioRoom.name);

            // Manejar participantes remotos (médico)
            this.twilioRoom.on('participantConnected', participant => {
                this.logger.success('Médico conectado a sala', {
                    identity: participant.identity,
                    sid: participant.sid,
                    state: participant.state
                }, 'twilio');
                console.log('👨‍⚕️ Médico conectado:', participant.identity);
                this.handleRemoteParticipant(participant);
            });

            this.twilioRoom.on('participantDisconnected', participant => {
                this.logger.warning('Médico desconectado de sala', {
                    identity: participant.identity,
                    sid: participant.sid
                }, 'twilio');
                console.log('👨‍⚕️ Médico desconectado:', participant.identity);
                if (this.doctorVideo) {
                    this.doctorVideo.srcObject = null;
                }
                if (this.doctorVideoPlaceholder) {
                    this.doctorVideoPlaceholder.style.display = 'flex';
                }
            });

            // Network quality monitoring
            this.twilioRoom.on('reconnecting', error => {
                this.logger.warning('Sala Twilio reconectando', {
                    error: error?.message
                }, 'network');
            });

            this.twilioRoom.on('reconnected', () => {
                this.logger.success('Sala Twilio reconectada', {}, 'network');
            });

            this.twilioRoom.on('disconnected', (room, error) => {
                this.logger.warning('Desconectado de sala Twilio', {
                    roomName: room.name,
                    error: error?.message
                }, 'twilio');
            });

            // Si ya hay participantes
            this.twilioRoom.participants.forEach(participant => {
                this.logger.info('Médico ya presente en sala', {
                    identity: participant.identity,
                    sid: participant.sid
                }, 'twilio');
                this.handleRemoteParticipant(participant);
            });

        } catch (error) {
            // 🔍 DIAGNÓSTICO: Detectar errores específicos de Twilio
            const errorMessage = error.message || String(error);
            const errorName = error.name || 'UnknownError';

            this.logger.error('Error conectando a Twilio', {
                error: errorMessage,
                errorName: errorName,
                errorCode: error.code,
                stack: error.stack,
                sessionCode: this.sessionCode
            }, 'twilio');
            console.error('❌ Error conectando a Twilio:', error);

            // Mensajes específicos según el error
            if (errorMessage.includes('Could not start video source')) {
                this.logger.error('🎥 ERROR ESPECÍFICO: Could not start video source', {
                    posiblesCausas: [
                        'Cámara en uso por otra aplicación',
                        'Permisos denegados o revocados',
                        'Cámara desconectada físicamente',
                        'Driver de cámara con problemas'
                    ],
                    diagnostico: {
                        localStreamExists: !!this.localStream,
                        videoTracks: this.localStream?.getVideoTracks()?.length || 0,
                        videoTrackState: this.localStream?.getVideoTracks()[0]?.readyState || 'none'
                    }
                }, 'camera');

                this.updateConnectionStatus('❌ Error: No se pudo iniciar la cámara', 'error');
                alert('⚠️ NO SE PUDO INICIAR LA CÁMARA\n\n' +
                      'Posibles causas:\n' +
                      '• Otra aplicación (Zoom, Teams, etc.) está usando la cámara\n' +
                      '• Los permisos fueron denegados\n' +
                      '• La cámara está desconectada\n\n' +
                      'Soluciones:\n' +
                      '1. Cierre otras aplicaciones que usen la cámara\n' +
                      '2. Verifique que la cámara esté conectada\n' +
                      '3. Recargue la página y permita el acceso\n' +
                      '4. Reinicie el navegador si el problema persiste');

            } else if (errorMessage.includes('NotAllowedError') || errorName === 'NotAllowedError') {
                const browser = this.detectBrowser();
                const platform = navigator.platform;

                this.logger.error('🔒 ERROR ESPECÍFICO: Permisos denegados', {
                    errorName: errorName,
                    userAgent: navigator.userAgent,
                    platform: platform,
                    browser: browser
                }, 'camera');

                this.updateConnectionStatus('❌ Error: Permisos de cámara denegados', 'error');

                // Mensajes específicos según navegador/plataforma
                let instrucciones = '';

                if (browser === 'Chrome' && platform.includes('Win')) {
                    instrucciones = '🖥️ CHROME EN WINDOWS:\n\n' +
                                  '1. Busque el ícono 🔒 o 🎥 a la IZQUIERDA de la barra de direcciones\n' +
                                  '2. Haga clic en él\n' +
                                  '3. Cambie "Cámara" y "Micrófono" a "Permitir"\n' +
                                  '4. Haga clic en "Recargar" o presione F5\n\n' +
                                  'Si no aparece el ícono:\n' +
                                  '• Copie y pegue en la barra: chrome://settings/content/camera\n' +
                                  '• Asegúrese de que esta página esté en "Permitidos"';
                } else if (browser === 'Chrome') {
                    instrucciones = '🌐 GOOGLE CHROME:\n\n' +
                                  '1. Haga clic en el ícono 🔒 a la izquierda de la URL\n' +
                                  '2. Seleccione "Permisos para este sitio"\n' +
                                  '3. Cambie Cámara y Micrófono a "Permitir"\n' +
                                  '4. Recargue la página (F5)';
                } else if (browser === 'Safari') {
                    instrucciones = '🍎 SAFARI (Mac/iPhone):\n\n' +
                                  'En Mac:\n' +
                                  '1. Safari → Configuración para [este sitio web]\n' +
                                  '2. Cambie Cámara y Micrófono a "Permitir"\n' +
                                  '3. Recargue la página\n\n' +
                                  'En iPhone/iPad:\n' +
                                  '1. Ajustes del dispositivo → Safari\n' +
                                  '2. Busque "Cámara" → Permitir';
                } else if (browser === 'Firefox') {
                    instrucciones = '🦊 MOZILLA FIREFOX:\n\n' +
                                  '1. Haga clic en el ícono 🔒 a la izquierda de la URL\n' +
                                  '2. Haga clic en "Más información"\n' +
                                  '3. Vaya a la pestaña "Permisos"\n' +
                                  '4. Desmarque "Usar configuración predeterminada" en Cámara y Micrófono\n' +
                                  '5. Seleccione "Permitir"\n' +
                                  '6. Recargue la página';
                } else if (browser === 'Edge') {
                    instrucciones = '🌊 MICROSOFT EDGE:\n\n' +
                                  '1. Haga clic en el ícono 🔒 en la barra de direcciones\n' +
                                  '2. Haga clic en "Permisos para este sitio"\n' +
                                  '3. Cambie Cámara y Micrófono a "Permitir"\n' +
                                  '4. Recargue la página (F5)';
                } else {
                    instrucciones = 'PASOS GENERALES:\n\n' +
                                  '1. Busque el ícono 🔒 o ⓘ en la barra de direcciones\n' +
                                  '2. Busque la opción de permisos o configuración del sitio\n' +
                                  '3. Cambie Cámara y Micrófono a "Permitir"\n' +
                                  '4. Recargue la página';
                }

                alert('⚠️ PERMISOS DENEGADOS\n\n' +
                      'Debe permitir acceso a la cámara y micrófono para continuar.\n\n' +
                      instrucciones);

            } else if (errorMessage.includes('NotFoundError') || errorName === 'NotFoundError') {
                this.logger.error('📷 ERROR ESPECÍFICO: Cámara no encontrada', {
                    errorName: errorName
                }, 'camera');

                this.updateConnectionStatus('❌ Error: Cámara no detectada', 'error');
                alert('⚠️ CÁMARA NO DETECTADA\n\n' +
                      'No se encontró ninguna cámara conectada.\n\n' +
                      'Soluciones:\n' +
                      '1. Conecte una cámara al dispositivo\n' +
                      '2. Verifique que esté correctamente conectada\n' +
                      '3. Reinicie el dispositivo si es necesario');

            } else if (errorMessage.includes('SignalingConnectionDisconnectedError')) {
                this.logger.error('🌐 ERROR ESPECÍFICO: Conexión de señalización perdida', {
                    errorMessage: errorMessage
                }, 'network');

                this.updateConnectionStatus('❌ Error: Conexión de red perdida', 'error');
                alert('⚠️ CONEXIÓN DE RED PERDIDA\n\n' +
                      'No se pudo mantener la conexión con el servidor.\n\n' +
                      'Soluciones:\n' +
                      '1. Verifique su conexión a internet\n' +
                      '2. Recargue la página\n' +
                      '3. Intente desde otra red WiFi');

            } else {
                // Error genérico
                this.updateConnectionStatus('❌ Error de conexión', 'error');
                alert(`⚠️ ERROR DE CONEXIÓN\n\n${errorMessage}\n\nPor favor recargue la página e intente nuevamente.`);
            }
        }
    }

    handleRemoteParticipant(participant) {
        this.logger.info('Manejando participante remoto (médico)', {
            identity: participant.identity,
            sid: participant.sid,
            tracksCount: participant.tracks.size
        }, 'twilio');

        // Manejar tracks existentes
        participant.tracks.forEach(publication => {
            this.logger.debug('Track publication encontrado', {
                trackSid: publication.trackSid,
                trackName: publication.trackName,
                kind: publication.kind,
                isSubscribed: publication.isSubscribed,
                isEnabled: publication.isEnabled
            }, 'twilio');

            if (publication.track) {
                this.attachTrack(publication.track);
            }
        });

        // Manejar nuevos tracks
        participant.on('trackSubscribed', track => {
            this.logger.success('Track subscrito (médico)', {
                trackSid: track.sid,
                trackName: track.name,
                kind: track.kind,
                isEnabled: track.isEnabled,
                isStarted: track.isStarted
            }, 'twilio');
            this.attachTrack(track);
        });

        participant.on('trackUnsubscribed', track => {
            this.logger.warning('Track no subscrito (médico)', {
                trackSid: track.sid,
                trackName: track.name,
                kind: track.kind
            }, 'twilio');
            track.detach().forEach(element => element.remove());
        });
    }

    attachTrack(track) {
        this.logger.info('Adjuntando track (médico)', {
            trackSid: track.sid,
            trackName: track.name,
            kind: track.kind,
            isEnabled: track.isEnabled,
            isStarted: track.isStarted,
            mediaStreamTrack: track.mediaStreamTrack?.readyState
        }, 'twilio');

        if (track.kind === 'video' && this.doctorVideo) {
            try {
                track.attach(this.doctorVideo);

                // Ocultar placeholder
                if (this.doctorVideoPlaceholder) {
                    this.doctorVideoPlaceholder.style.display = 'none';
                }

                // Mostrar video
                this.doctorVideo.style.display = 'block';

                this.logger.success('Video del médico conectado', {
                    videoWidth: this.doctorVideo.videoWidth,
                    videoHeight: this.doctorVideo.videoHeight,
                    readyState: this.doctorVideo.readyState
                }, 'twilio');
                console.log('✅ Video del médico conectado (Twilio)');

                // Monitor video element state
                this.doctorVideo.addEventListener('loadedmetadata', () => {
                    this.logger.info('Video metadata cargada (médico)', {
                        videoWidth: this.doctorVideo.videoWidth,
                        videoHeight: this.doctorVideo.videoHeight
                    }, 'twilio');
                });

                this.doctorVideo.addEventListener('error', (e) => {
                    this.logger.error('Error en elemento de video (médico)', {
                        error: e.message || 'Unknown error',
                        code: this.doctorVideo.error?.code,
                        message: this.doctorVideo.error?.message
                    }, 'twilio');
                });

            } catch (error) {
                this.logger.error('Error adjuntando track de video (médico)', {
                    error: error.message,
                    stack: error.stack
                }, 'twilio');
            }
        }

        if (track.kind === 'audio') {
            try {
                const audioElement = track.attach();
                audioElement.style.display = 'none';
                document.body.appendChild(audioElement);

                this.logger.success('Audio del médico conectado', {
                    audioVolume: audioElement.volume,
                    muted: audioElement.muted,
                    readyState: audioElement.readyState
                }, 'twilio');
                console.log('✅ Audio del médico conectado (Twilio)');

                // Monitor audio element state
                audioElement.addEventListener('error', (e) => {
                    this.logger.error('Error en elemento de audio (médico)', {
                        error: e.message || 'Unknown error',
                        code: audioElement.error?.code,
                        message: audioElement.error?.message
                    }, 'twilio');
                });

            } catch (error) {
                this.logger.error('Error adjuntando track de audio (médico)', {
                    error: error.message,
                    stack: error.stack
                }, 'twilio');
            }
        }
    }

    // DEPRECATED: Ya no se usa WebRTC manual
    async setupWebRTC(stream) {
        console.warn('⚠️ setupWebRTC deprecated - usando Twilio');
        return;
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

                // SOLUCIÓN HÍBRIDA: WebRTC para métricas, Socket.io para landmarks
                // Esto evita problemas de truncamiento en Data Channel (límite 16KB)

                // Validar que métricas estén completas (sin valores undefined)
                const metricsValid = this.currentMetrics &&
                                    this.currentMetrics.posture &&
                                    this.currentMetrics.joints &&
                                    this.currentMetrics.symmetry;

                if (this.dataChannelReady && this.dataChannel.readyState === 'open' && metricsValid) {
                    // WebRTC: Solo métricas (pequeñas, ~1KB)
                    const metricsOnly = {
                        sessionCode: this.sessionCode,
                        metrics: this.currentMetrics,
                        timestamp: Date.now()
                    };

                    try {
                        this.dataChannel.send(JSON.stringify(metricsOnly));
                    } catch (err) {
                        console.warn('⚠️ WebRTC error:', err.message);
                    }
                }

                // Socket.io: Landmarks para skeleton (sin límite de tamaño)
                // Enviar cada 2 frames para reducir carga (15 FPS skeleton)
                if (this.transmissionStats.frameCount % 2 === 0) {
                    this.socket.emit('pose-landmarks', {
                        sessionCode: this.sessionCode,
                        landmarks: landmarks,
                        timestamp: Date.now()
                    });
                }

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
        // Ocultar placeholder de análisis y mostrar canvas
        if (this.analysisPlaceholder && this.analysisPlaceholder.style.display !== 'none') {
            this.analysisPlaceholder.style.display = 'none';
        }
        if (this.analysisCanvas && this.analysisCanvas.style.display !== 'block') {
            this.analysisCanvas.style.display = 'block';
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

        // Dibujar en AMBOS canvas: overlay transparente Y canvas de análisis
        const canvasList = [
            { canvas: this.canvas, ctx: this.ctx, color: '#00ff00', pointColor: '#ff0000', bgClear: true },
            { canvas: this.analysisCanvas, ctx: this.analysisCtx, color: '#00ff00', pointColor: '#ff0000', bgClear: false }
        ];

        canvasList.forEach(({ canvas, ctx, color, pointColor, bgClear }) => {
            if (!canvas || !ctx) return;

            // Limpiar o dejar fondo negro
            if (bgClear) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Dibujar conexiones
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();

            connections.forEach(([start, end]) => {
                const startPoint = landmarks[start];
                const endPoint = landmarks[end];

                if (startPoint && endPoint) {
                    ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
                    ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
                }
            });

            ctx.stroke();

            // Dibujar puntos
            landmarks.forEach((landmark, index) => {
                const x = landmark.x * canvas.width;
                const y = landmark.y * canvas.height;

                let currentColor = color;
                if (Object.values(this.landmarkIndices).includes(index)) {
                    currentColor = pointColor;
                }

                ctx.fillStyle = currentColor;
                ctx.beginPath();
                ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
                ctx.fill();

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
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

        // DEBUG: Actualizar panel visual solo si existe (modo ?debug)
        const debugPanel = document.getElementById('cervicalDebugData');
        if (debugPanel) {
            if (!this._cervicalDebugCounter) this._cervicalDebugCounter = 0;
            this._cervicalDebugCounter++;

            if (this._cervicalDebugCounter % 15 === 0) {
                const verticalStatus = deltaY < 0 ? '✅ CABEZA ARRIBA' :
                                      deltaY > 0 ? '⚠️ CABEZA ABAJO' :
                                      '⚠️ NIVEL CON HOMBROS';

                debugPanel.innerHTML = `
                    Nariz Y: ${nose.y.toFixed(3)} | Hombros Y: ${shoulderMidpoint.y.toFixed(3)}<br>
                    Desviación Vertical: ${(deltaY * 100).toFixed(1)}% (${verticalStatus})<br>
                    Desviación Lateral: ${(Math.abs(deltaX) * 100).toFixed(1)}%<br>
                    Ángulo Cervical: <span style="color: ${lateralAngle > 15 ? '#e85d55' : lateralAngle > 10 ? '#f7b928' : '#5ebd6d'}; font-weight: 700;">${lateralAngle.toFixed(1)}°</span>
                `;
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
                this.doctorInstructions.innerHTML = `
                    <div class="instruction-item">
                        <strong>${data.title || 'Instrucción del Médico'}:</strong> ${data.text}
                    </div>
                `;
                // Actualizar banner móvil
                this.updateInstructionBanner(data.text);
                if (this.audioEnabled && data.text) {
                    this.speak(data.text);
                }
                break;

            case 'countdown':
                this.showCountdown(data.seconds || 5);
                break;

            case 'position_feedback':
                this.doctorInstructions.innerHTML = `<p><strong>Posicionamiento:</strong> ${data.message}</p>`;
                // Actualizar banner móvil
                this.updateInstructionBanner(data.message);
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
        this.countdownOverlay.style.display = 'block';

        for (let i = seconds; i > 0; i--) {
            this.countdownOverlay.textContent = i.toString();
            // También actualizar banner móvil
            this.updateInstructionBanner(`Comenzando en ${i}...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.countdownOverlay.style.display = 'none';
        this.updateInstructionBanner('Manténgase en posición');
    }

    async showLargeCountdown(seconds) {

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

            // Actualizar banner móvil también
            this.updateInstructionBanner(`Prepárese - Comenzando en ${i}`);

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
        this.updateInstructionBanner('¡Listo! - Manténgase quieto');

        await new Promise(resolve => setTimeout(resolve, 1000));

        countdownBigOverlay.style.display = 'none';
    }


    isDebugMode() {
        return new URLSearchParams(window.location.search).has('debug');
    }

    speak(text) {
        if (!this.audioEnabled) return;

        // Detectar si es móvil y audio no ha sido activado
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile && !this.audioActivated) {
            // NO mostrar panel aquí - se muestra desde onLoadComplete
            return;
        }

        // PRIORIDAD 1: Intentar usar AudioManager (audios pre-cargados)
        if (this.audioManager && this.audioManager.isReady() && typeof findAudioForText === 'function') {
            const audioData = findAudioForText(text);
            if (audioData) {
                // Intentar reproducir MP3, con fallback automático
                this.audioManager.play(audioData.category, audioData.key).then(success => {
                    if (!success) {
                        // MP3 falló (bloqueado por navegador), usar fallback
                        if (this.isDebugMode()) {
                            console.log(`🔊 MP3 bloqueado, usando fallback speechSynthesis`);
                        }
                        this.useSpeechSynthesis(text);
                    }
                });
                return; // Evitar ejecutar fallback inmediato
            }
        }

        // FALLBACK: AudioManager no listo o audio no encontrado
        this.useSpeechSynthesis(text);
    }

    useSpeechSynthesis(text) {
        if (!window.speechSynthesis) {
            console.warn('⚠️ speechSynthesis no disponible');
            return;
        }

        const playWithVoices = () => {
            this.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 0.85; // Más lento para mayor claridad
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            const voices = this.speechSynthesis.getVoices();

            // Priorizar voces nativas en español
            const spanishVoice =
                voices.find(v => v.lang === 'es-MX' && v.localService) ||
                voices.find(v => v.lang === 'es-ES' && v.localService) ||
                voices.find(v => v.lang === 'es-US' && v.localService) ||
                voices.find(v => v.lang.startsWith('es-') && v.localService) ||
                voices.find(v => v.lang === 'es-MX') ||
                voices.find(v => v.lang === 'es-ES') ||
                voices.find(v => v.lang.startsWith('es-')) ||
                voices[0];

            if (spanishVoice) {
                utterance.voice = spanishVoice;
            }

            // Solo log en modo debug
            if (window.location.search.includes('debug')) {
                console.log(`🔊 Fallback speechSynthesis: "${text.substring(0, 30)}..." (${spanishVoice?.lang || 'default'})`);
            }
            this.speechSynthesis.speak(utterance);
        };

        const voices = this.speechSynthesis.getVoices();
        if (voices.length === 0) {
            this.speechSynthesis.addEventListener('voiceschanged', playWithVoices, { once: true });
        } else {
            playWithVoices();
        }
    }

    activateAudio() {
        if (this.isDebugMode()) console.log('🔊 Activando audio por interacción del usuario (iOS compatible)...');

        // Función para reproducir con voces cargadas (iOS requiere esto)
        const activateWithVoices = () => {
            // Cancelar cualquier utterance anterior
            this.speechSynthesis.cancel();

            // Test de speech synthesis para "desbloquear" en iOS
            const testUtterance = new SpeechSynthesisUtterance('Audio activado');
            testUtterance.lang = 'es-ES';
            testUtterance.volume = 1.0; // Volumen máximo
            testUtterance.rate = 1.0;

            const voices = this.speechSynthesis.getVoices();

            // Priorizar voces nativas en español (mejor para iOS)
            const spanishVoice =
                voices.find(v => v.lang === 'es-MX' && v.localService) ||
                voices.find(v => v.lang === 'es-ES' && v.localService) ||
                voices.find(v => v.lang === 'es-US' && v.localService) ||
                voices.find(v => v.lang.startsWith('es-') && v.localService) ||
                voices.find(v => v.lang === 'es-MX') ||
                voices.find(v => v.lang === 'es-ES') ||
                voices.find(v => v.lang.startsWith('es-')) ||
                voices[0];

            if (spanishVoice) {
                testUtterance.voice = spanishVoice;
            }

            // Reproducir el test utterance
            this.speechSynthesis.speak(testUtterance);

            // NO intentar desbloquear todos los MP3s aquí - causa reproducción simultánea
            // Los MP3s se desbloquearán naturalmente cuando se reproduzca el primero
            // iOS permite audio después de interacción de usuario, simplemente marcar como activado

            // Marcar como activado
            this.audioActivated = true;

            // Actualizar UI del botón
            if (this.activateAudioBtn) {
                this.activateAudioBtn.textContent = '✅ Audio Activado';
                this.activateAudioBtn.classList.add('activated');
                this.activateAudioBtn.disabled = true;
            }

            // Ocultar panel después de 2 segundos
            setTimeout(() => {
                if (this.audioActivationPanel) {
                    this.audioActivationPanel.style.display = 'none';
                }
            }, 2000);
            this.showMessage('🔊 Audio de instrucciones activado');
        };

        // Cargar voces si no están listas (iOS Safari)
        const voices = this.speechSynthesis.getVoices();
        if (voices.length === 0) {
            this.speechSynthesis.addEventListener('voiceschanged', activateWithVoices, { once: true });

            // Forzar carga de voces en iOS (workaround)
            const dummyUtterance = new SpeechSynthesisUtterance('');
            this.speechSynthesis.speak(dummyUtterance);
        } else {
            activateWithVoices();
        }
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


    showExamScreen() {
        this.loginScreen.style.display = 'none';
        this.examScreen.style.display = 'block';

        // Inicializar AudioManager para pre-carga
        if (typeof audioManager !== 'undefined') {
            this.audioManager = audioManager;

            // Configurar callbacks de progreso
            this.audioManager.onLoadProgress = (progress, current, total) => {
                // Silencioso - no loggear progreso
            };

            this.audioManager.onLoadComplete = () => {
                this.showMessage('🔊 Audios cargados correctamente');

                // IMPORTANTE: Mostrar botón de activación solo cuando los MP3s estén listos
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (isMobile && !this.audioActivated && this.audioActivationPanel) {
                    this.audioActivationPanel.style.display = 'block';
                    if (this.activateAudioBtn) {
                        this.activateAudioBtn.textContent = '🔊 Activar Audio de Instrucciones';
                    }
                }
            };

            // Iniciar pre-carga
            this.audioManager.initialize().catch(err => {
                if (this.isDebugMode()) console.warn('⚠️ Error pre-cargando audios, usando fallback:', err);

                // Si falla la carga, mostrar panel igualmente (usará fallback)
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (isMobile && !this.audioActivated && this.audioActivationPanel) {
                    this.audioActivationPanel.style.display = 'block';
                }
            });
        }
    }

    showLoginScreen() {
        this.examScreen.style.display = 'none';
        this.loginScreen.style.display = 'flex';
    }

    disconnect() {
        if (confirm('¿Está seguro que desea desconectar la sesión?')) {
            this.stopTransmission();

            if (this.video && this.video.srcObject) {
                this.video.srcObject.getTracks().forEach(track => track.stop());
            }

            if (this.peerConnection) {
                this.peerConnection.close();
            }

            this.socket.disconnect();
            this.isConnected = false;

            // Volver a login screen
            this.showLoginScreen();

            // Resetear form
            this.loginForm.reset();
            this.connectionStatus.classList.add('hidden');
        }
    }

    updateConnectionStatus(message, type) {
        this.connectionStatus.textContent = message;
        this.connectionStatus.className = `connection-status status-${type}`;
        this.connectionStatus.classList.remove('hidden');
    }

    updateTransmissionStatus(message, type) {
        if (this.transmissionStatus) {
            this.transmissionStatus.textContent = message;
        }
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

        // Actualizar banner móvil
        this.updateInstructionBanner('Secuencia completada - Excelente trabajo');

        // Completar barra de progreso
        this.guidedProgressBar.style.width = '100%';

        // Reproducir audio de finalización
        if (this.audioEnabled) {
            this.speak(data.message || 'Secuencia completada. Excelente trabajo.');
        }

        // Ocultar overlay después de unos segundos
        setTimeout(() => {
            this.hideGuidedInstructions();
            // Resetear banner después de completar
            this.updateInstructionBanner('Esperando instrucciones del médico');
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

        // Actualizar banner móvil con instrucción simple (sin emojis)
        this.updateInstructionBanner(instruction.text);

        // Si es el primer paso con countdown, mostrar contador grande
        if (instruction.showCountdown && stepNumber === 1) {
            this.showLargeCountdown(instruction.duration / 1000);
        }
    }

    updateInstructionBanner(text) {
        if (this.currentInstructionBanner) {
            // Remover emojis y simplificar el texto
            const cleanText = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
            this.currentInstructionBanner.textContent = cleanText;
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

        if (this.isDebugMode()) console.log(`🔊 Audio de instrucciones ${this.audioEnabled ? 'habilitado' : 'deshabilitado'}`);
    }

    // 🔍 DIAGNÓSTICO: Detectar navegador para mensajes específicos
    detectBrowser() {
        const userAgent = navigator.userAgent;

        if (userAgent.includes('Edg/') || userAgent.includes('Edge/')) {
            return 'Edge';
        } else if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) {
            return 'Chrome';
        } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
            return 'Safari';
        } else if (userAgent.includes('Firefox/')) {
            return 'Firefox';
        } else if (userAgent.includes('Opera/') || userAgent.includes('OPR/')) {
            return 'Opera';
        } else {
            return 'Unknown';
        }
    }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(window.location.search).has('debug')) {
        console.log('👤 Iniciando interfaz del paciente...');
    }
    window.telemedicinePatient = new TelemedicinePatient();
});