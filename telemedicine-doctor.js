/**
 * Cliente del Médico - Telemedicina
 * Recibe y visualiza datos de pose del paciente en tiempo real
 */

class TelemedicineDoctor {
    constructor() {
        // ✅ LOGGING SYSTEM: Initialize logger
        this.logger = new Logger('doctor');
        this.logger.initializeTracking();
        this.logger.info('TelemedicineDoctor initializing', {}, 'general');

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
            sessionId: null
        };

        // Tipo de examen médico (fijo: completo)
        this.currentExamType = 'completo';

        // Sistema de instrucciones guiadas médicas
        this.instructionSystem = {
            currentStep: 0,
            isActive: false,
            audioEnabled: true,
            speechSynthesis: window.speechSynthesis
        };

        // Secuencia de examen completo con múltiples pasos
        this.examSequence = [
            {
                icon: '🏥',
                title: 'Preparación',
                text: 'Prepárese para el examen. Colóquese de pie frente a la cámara y quédese completamente quieto.',
                duration: 20000,
                audio: 'Prepárese para el examen. Colóquese de pie frente a la cámara y quédese completamente quieto. Tiene 20 segundos.',
                validation: 'checkReadiness',
                showCountdown: true
            },
            {
                icon: '🧍',
                title: 'Posición Inicial',
                text: 'Colóquese de pie, relajado, con los brazos a los costados. Mire hacia la cámara.',
                duration: 8000,
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
                icon: '🙋‍♀️',
                title: 'Elevar Brazos',
                text: 'Levante lentamente ambos brazos hacia los lados hasta la altura de los hombros.',
                duration: 10000,
                audio: 'Levante lentamente ambos brazos hacia los lados hasta la altura de los hombros.',
                validation: 'checkArmRaise'
            },
            {
                icon: '🙌',
                title: 'Brazos Arriba',
                text: 'Ahora levante los brazos completamente por encima de la cabeza.',
                duration: 10000,
                audio: 'Ahora levante los brazos completamente por encima de la cabeza.',
                validation: 'checkArmsUp'
            },
            {
                icon: '💪',
                title: 'Brazos Naturales',
                text: 'Baje los brazos y déjelos caer naturalmente a los costados. No fuerce la posición.',
                duration: 8000,
                audio: 'Baje los brazos y déjelos caer naturalmente a los costados. No fuerce la posición.',
                validation: 'checkArmPosition'
            },
            {
                icon: '⚖️',
                title: 'Verificación de Simetría',
                text: 'Mantenga esta posición. Analizaremos la simetría de sus hombros y caderas.',
                duration: 10000,
                audio: 'Mantenga esta posición. Analizaremos la simetría de sus hombros y caderas.',
                validation: 'checkSymmetry'
            },
            {
                icon: '📸',
                title: 'Captura Final',
                text: 'Perfecto. Mantenga esta posición mientras capturamos los datos finales.',
                duration: 8000,
                audio: 'Perfecto. Mantenga esta posición mientras capturamos los datos finales.',
                validation: 'checkFinalCapture'
            }
        ];

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

        // Sistema de captura estabilizada de métricas
        this.metricsBuffer = []; // Buffer circular para promediar métricas
        this.bufferSize = 30; // 30 frames (~1 segundo a 30 FPS)
        this.capturedMetrics = null; // Métricas capturadas y estabilizadas para el reporte
        this.isStabilizing = false; // Flag para indicar que estamos estabilizando

        // WebRTC configuration
        this.peerConnection = null;
        this.remoteVideo = null;
        this.localStream = null; // Stream del médico (cámara + audio)
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
        this.createSessionBtn = document.getElementById('createSessionBtn');

        // Elementos de sesión
        this.sessionCodeContainer = document.getElementById('sessionCodeContainer');
        this.sessionCodeDisplay = document.getElementById('sessionCodeDisplay');
        this.connectionStatus = document.getElementById('connectionStatus');

        // Elementos de información del paciente
        this.patientInfo = document.getElementById('patientInfo');
        this.patientName = document.getElementById('patientName');
        this.connectionTime = document.getElementById('connectionTime');

        // Elementos de panel de participantes Twilio
        this.twilioParticipantsPanel = document.getElementById('twilioParticipantsPanel');
        this.twilioRoomName = document.getElementById('twilioRoomName');
        this.twilioParticipantsCount = document.getElementById('twilioParticipantsCount');
        this.twilioParticipantsList = document.getElementById('twilioParticipantsList');

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
        this.generatePDFBtn = document.getElementById('generatePDFBtn');
        this.endSessionBtn = document.getElementById('endSessionBtn');
    }

    setupEventListeners() {
        // Crear sesión
        this.createSessionBtn.addEventListener('click', () => this.createSession());

        // Controles de examen
        this.startExamBtn.addEventListener('click', () => this.startExam());

        if (this.startGuidedBtn) {
            this.startGuidedBtn.addEventListener('click', () => {
                this.startGuidedSequence();
            });
        } else {
            console.error('❌ startGuidedBtn no encontrado en el DOM');
        }

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
        this.generatePDFBtn.addEventListener('click', () => this.generatePDFReport());
        this.endSessionBtn.addEventListener('click', () => this.endSession());
    }

    setupSocketEvents() {
        // Conexión establecida
        this.socket.on('connect', () => {
            console.log('🔌 Médico conectado al servidor');
        });

        // Sesión creada
        this.socket.on('session-created', ({ sessionCode, message }) => {
            this.logger.success('Sesión creada', {
                sessionCode: sessionCode,
                message: message
            }, 'socket');
            console.log('✅ Sesión creada:', sessionCode);

            this.sessionCode = sessionCode;
            this.logger.setSessionCode(sessionCode);
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
            this.logger.success('Paciente conectado', {
                sessionCode: sessionCode,
                patientName: patientData.name,
                patientSessionId: patientData.sessionId,
                message: message
            }, 'socket');
            console.log('👤 Paciente conectado:', patientData);

            this.patientData = patientData;
            this.patientConnected = true;

            // Actualizar interfaz
            this.updateConnectionStatus('🟢 Paciente conectado', 'connected');
            this.showPatientInfo();
            this.enableExamControls();

            // Configurar canvas para video
            this.setupCanvas();

            // ✅ TWILIO: Unirse a sala de video
            this.joinTwilioRoom();
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

        // ✅ NUEVO: Recibir landmarks por Socket.io (separado de métricas)
        this.socket.on('pose-landmarks', ({ sessionCode, landmarks, timestamp }) => {
            if (sessionCode === this.sessionCode && landmarks) {
                this.lastLandmarks = landmarks;
                this.drawPoseOnCanvas(landmarks);
            }
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
                const errorMsg = 'Médico no tiene sessionCode activo';
                this.logger.error(errorMsg, { sessionCode: this.sessionCode }, 'twilio');
                console.error('❌', errorMsg);
                return;
            }

            if (!this.patientConnected) {
                const errorMsg = 'No hay paciente conectado';
                this.logger.error(errorMsg, {}, 'twilio');
                console.error('❌', errorMsg);
                return;
            }

            this.logger.info('Conectando a Twilio Video', {
                sessionCode: this.sessionCode,
                identity: `doctor-${this.doctorData.name}`
            }, 'twilio');
            console.log('📺 Conectando a Twilio Video...');

            // Obtener token de Twilio
            this.logger.debug('Solicitando token de Twilio', {
                endpoint: '/twilio-token',
                identity: `doctor-${this.doctorData.name}`,
                room: this.sessionCode
            }, 'twilio');

            const response = await fetch('/twilio-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identity: `doctor-${this.doctorData.name}`,
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

            // Conectar a sala de Twilio
            this.logger.info('Iniciando conexión a sala Twilio', {
                room: this.sessionCode,
                config: {
                    audio: true,
                    video: true,
                    networkQuality: { local: 1, remote: 1 }
                }
            }, 'twilio');

            this.twilioRoom = await Twilio.Video.connect(this.twilioToken, {
                name: this.sessionCode,
                audio: true,
                video: true,
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

            // 🔍 Actualizar panel de participantes al conectar
            this.updateTwilioParticipantsPanel();

            // Manejar participantes remotos
            this.twilioRoom.on('participantConnected', participant => {
                this.logger.success('Participante conectado a sala', {
                    identity: participant.identity,
                    sid: participant.sid,
                    state: participant.state
                }, 'twilio');
                console.log('👤 Participante conectado:', participant.identity);
                this.handleRemoteParticipant(participant);

                // 🔍 Actualizar panel de participantes
                this.updateTwilioParticipantsPanel();
            });

            this.twilioRoom.on('participantDisconnected', participant => {
                this.logger.warning('Participante desconectado de sala', {
                    identity: participant.identity,
                    sid: participant.sid
                }, 'twilio');
                console.log('👤 Participante desconectado:', participant.identity);
                if (this.remoteVideo) {
                    this.remoteVideo.srcObject = null;
                }
                if (this.videoPlaceholder) {
                    this.videoPlaceholder.style.display = 'flex';
                    this.videoPlaceholder.textContent = 'Esperando paciente...';
                }

                // 🔍 Actualizar panel de participantes
                this.updateTwilioParticipantsPanel();
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
                this.logger.info('Participante ya presente en sala', {
                    identity: participant.identity,
                    sid: participant.sid
                }, 'twilio');
                this.handleRemoteParticipant(participant);
            });

        } catch (error) {
            // 🔍 DIAGNÓSTICO: Detectar errores específicos de Twilio (Médico)
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
            if (errorMessage.includes('Device in use') || errorMessage.includes('device in use')) {
                this.logger.error('🎥 ERROR ESPECÍFICO: Device in use (Médico)', {
                    posiblesCausas: [
                        'Otra pestaña del navegador usando cámara',
                        'Otra aplicación (Zoom, Teams, Meet) usando cámara',
                        'Múltiples sesiones abiertas simultáneamente'
                    ],
                    sessionCode: this.sessionCode
                }, 'camera');

                this.updateConnectionStatus('❌ Cámara en uso por otra app', 'error');
                alert('⚠️ CÁMARA EN USO\n\n' +
                      'Su cámara está siendo usada por otra aplicación.\n\n' +
                      'Posibles causas:\n' +
                      '• Otra pestaña de este navegador usando la cámara\n' +
                      '• Zoom, Teams, Meet u otra app de videollamada abierta\n' +
                      '• Múltiples sesiones de telemedicina abiertas\n\n' +
                      'Soluciones:\n' +
                      '1. Cierre otras pestañas con videollamadas\n' +
                      '2. Cierre aplicaciones de videollamada (Zoom, Teams, etc.)\n' +
                      '3. Recargue esta página\n' +
                      '4. Si el problema persiste, reinicie el navegador');

            } else if (errorMessage.includes('Could not start video source')) {
                this.logger.error('🎥 ERROR ESPECÍFICO: Could not start video source (Médico)', {
                    sessionCode: this.sessionCode
                }, 'camera');

                this.updateConnectionStatus('❌ No se pudo iniciar la cámara', 'error');
                alert('⚠️ NO SE PUDO INICIAR LA CÁMARA\n\n' +
                      'No se pudo acceder a su cámara.\n\n' +
                      'Soluciones:\n' +
                      '1. Verifique que la cámara esté conectada\n' +
                      '2. Cierre otras aplicaciones que usen la cámara\n' +
                      '3. Permita el acceso cuando el navegador lo solicite\n' +
                      '4. Recargue la página');

            } else if (errorMessage.includes('NotAllowedError') || errorName === 'NotAllowedError') {
                this.logger.error('🔒 ERROR ESPECÍFICO: Permisos denegados (Médico)', {
                    errorName: errorName,
                    userAgent: navigator.userAgent
                }, 'camera');

                this.updateConnectionStatus('❌ Permisos de cámara denegados', 'error');
                alert('⚠️ PERMISOS DENEGADOS\n\n' +
                      'Debe permitir acceso a la cámara y micrófono.\n\n' +
                      'Pasos:\n' +
                      '1. Haga clic en el ícono 🔒 o ⓘ en la barra de direcciones\n' +
                      '2. Cambie cámara y micrófono a "Permitir"\n' +
                      '3. Recargue la página');

            } else if (errorMessage.includes('SignalingConnectionDisconnectedError')) {
                this.logger.error('🌐 ERROR ESPECÍFICO: Conexión de señalización perdida (Médico)', {
                    errorMessage: errorMessage
                }, 'network');

                this.updateConnectionStatus('❌ Conexión de red perdida', 'error');
                alert('⚠️ CONEXIÓN DE RED PERDIDA\n\n' +
                      'No se pudo mantener la conexión con el servidor.\n\n' +
                      'Soluciones:\n' +
                      '1. Verifique su conexión a internet\n' +
                      '2. Recargue la página\n' +
                      '3. Intente desde otra red si el problema persiste');

            } else {
                // Error genérico
                this.updateConnectionStatus('❌ Error de video', 'error');
                alert(`⚠️ ERROR DE CONEXIÓN\n\n${errorMessage}\n\nPor favor recargue la página e intente nuevamente.`);
            }
        }
    }

    handleRemoteParticipant(participant) {
        this.logger.info('Manejando participante remoto', {
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
            this.logger.success('Track subscrito', {
                trackSid: track.sid,
                trackName: track.name,
                kind: track.kind,
                isEnabled: track.isEnabled,
                isStarted: track.isStarted
            }, 'twilio');
            this.attachTrack(track);
        });

        participant.on('trackUnsubscribed', track => {
            this.logger.warning('Track no subscrito', {
                trackSid: track.sid,
                trackName: track.name,
                kind: track.kind
            }, 'twilio');
            track.detach().forEach(element => element.remove());
        });

        // Track publication events
        participant.on('trackPublished', publication => {
            this.logger.info('Track publicado por participante', {
                trackSid: publication.trackSid,
                kind: publication.kind
            }, 'twilio');
        });

        participant.on('trackUnpublished', publication => {
            this.logger.warning('Track no publicado por participante', {
                trackSid: publication.trackSid,
                kind: publication.kind
            }, 'twilio');
        });
    }

    attachTrack(track) {
        this.logger.info('Adjuntando track', {
            trackSid: track.sid,
            trackName: track.name,
            kind: track.kind,
            isEnabled: track.isEnabled,
            isStarted: track.isStarted,
            mediaStreamTrack: track.mediaStreamTrack?.readyState
        }, 'twilio');

        if (track.kind === 'video') {
            try {
                track.attach(this.remoteVideo);

                // Ocultar placeholder
                if (this.videoPlaceholder) {
                    this.videoPlaceholder.style.display = 'none';
                }

                // Mostrar video
                this.remoteVideo.style.display = 'block';
                this.remoteVideo.style.visibility = 'visible';

                this.logger.success('Video del paciente conectado', {
                    videoWidth: this.remoteVideo.videoWidth,
                    videoHeight: this.remoteVideo.videoHeight,
                    readyState: this.remoteVideo.readyState
                }, 'twilio');
                console.log('✅ Video del paciente conectado (Twilio)');

                // Info del video
                if (this.videoInfo) {
                    this.videoInfo.textContent = 'Video en vivo (Twilio)';
                }

                // Monitor video element state
                this.remoteVideo.addEventListener('loadedmetadata', () => {
                    this.logger.info('Video metadata cargada', {
                        videoWidth: this.remoteVideo.videoWidth,
                        videoHeight: this.remoteVideo.videoHeight
                    }, 'twilio');
                });

                this.remoteVideo.addEventListener('error', (e) => {
                    this.logger.error('Error en elemento de video', {
                        error: e.message || 'Unknown error',
                        code: this.remoteVideo.error?.code,
                        message: this.remoteVideo.error?.message
                    }, 'twilio');
                });

            } catch (error) {
                this.logger.error('Error adjuntando track de video', {
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

                this.logger.success('Audio del paciente conectado', {
                    audioVolume: audioElement.volume,
                    muted: audioElement.muted,
                    readyState: audioElement.readyState
                }, 'twilio');
                console.log('✅ Audio del paciente conectado (Twilio)');

                // Monitor audio element state
                audioElement.addEventListener('error', (e) => {
                    this.logger.error('Error en elemento de audio', {
                        error: e.message || 'Unknown error',
                        code: audioElement.error?.code,
                        message: audioElement.error?.message
                    }, 'twilio');
                });

            } catch (error) {
                this.logger.error('Error adjuntando track de audio', {
                    error: error.message,
                    stack: error.stack
                }, 'twilio');
            }
        }
    }

    // DEPRECATED: Ya no se usa WebRTC manual
    async handleWebRTCOffer(offer) {
        console.warn('⚠️ handleWebRTCOffer deprecated - usando Twilio');
        return;
    }

    // Método deprecado - código WebRTC eliminado
    playRemoteVideo() {
        console.warn('⚠️ playRemoteVideo deprecated');
    }

    showPlayButton() {
        console.warn('⚠️ showPlayButton deprecated');
    }


    createSession() {
        const doctorName = this.doctorNameInput.value.trim();

        if (!doctorName) {
            this.logger.warning('Intento de crear sesión sin nombre', {}, 'general');
            alert('Por favor ingrese su nombre');
            return;
        }

        this.doctorData = {
            name: doctorName,
            sessionId: Date.now()
        };

        this.logger.info('Creando sesión de médico', {
            doctorName: doctorName,
            sessionId: this.doctorData.sessionId
        }, 'socket');

        this.socket.emit('doctor-register', this.doctorData);
    }

    startExam() {
        if (!this.patientConnected) return;

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

        this.sendCommand('countdown', {
            seconds: seconds,
            message: `Iniciando en ${seconds} segundos`
        });
    }

    startGuidedSequence() {
        if (!this.patientConnected) {
            return;
        }

        // Resetear sistema de instrucciones
        this.instructionSystem.currentStep = 0;
        this.instructionSystem.isActive = true;

        // Enviar primera instrucción al paciente
        this.sendCommand('start_guided_sequence', {
            examType: 'completo',
            totalSteps: this.examSequence.length,
            currentStep: 0,
            instruction: this.examSequence[0]
        });

        // Actualizar estado
        this.isExamRunning = true;
        this.startExamBtn.disabled = true;
        this.startGuidedBtn.disabled = true;
        this.stopExamBtn.disabled = false;
        this.captureBtn.disabled = false;

        this.updateConnectionStatus(`🎯 Examen guiado en progreso`, 'examining');

        // Programar siguiente paso
        this.scheduleNextInstruction(this.examSequence[0].duration);
    }

    scheduleNextInstruction(duration) {
        if (!this.instructionSystem.isActive) return;

        this.instructionTimeout = setTimeout(() => {
            this.nextGuidedStep();
        }, duration);
    }

    nextGuidedStep() {
        if (!this.instructionSystem.isActive) return;

        this.instructionSystem.currentStep++;

        if (this.instructionSystem.currentStep >= this.examSequence.length) {
            this.completeGuidedSequence();
        } else {
            const currentInstruction = this.examSequence[this.instructionSystem.currentStep];

            // Enviar siguiente instrucción
            this.sendCommand('next_guided_step', {
                examType: 'completo',
                totalSteps: this.examSequence.length,
                currentStep: this.instructionSystem.currentStep,
                instruction: currentInstruction
            });

            // Programar siguiente paso
            this.scheduleNextInstruction(currentInstruction.duration);
        }
    }

    completeGuidedSequence() {
        console.log('✅ Examen guiado completado');

        this.instructionSystem.isActive = false;

        if (this.instructionTimeout) {
            clearTimeout(this.instructionTimeout);
        }

        // Notificar al paciente
        this.sendCommand('complete_guided_sequence', {
            examType: 'completo',
            message: 'Examen completado - Excelente trabajo'
        });

        this.updateConnectionStatus('✅ Examen completado - Estabilizando métricas...', 'connected');

        // Estabilizar métricas antes de capturar
        this.isStabilizing = true;

        // Esperar 1 segundo para acumular frames estables, luego capturar
        setTimeout(() => {
            this.stabilizeAndCaptureMetrics();
        }, 1000);
    }

    stabilizeAndCaptureMetrics() {
        // Validar que hay métricas disponibles
        if (!this.currentMetrics && this.metricsBuffer.length === 0) {
            console.error('❌ No hay métricas disponibles para capturar');
            return;
        }

        if (this.metricsBuffer.length < 10) {
            // Validar que currentMetrics existe antes de clonar
            if (this.currentMetrics) {
                this.capturedMetrics = JSON.parse(JSON.stringify(this.currentMetrics));
            } else {
                console.error('❌ currentMetrics es undefined, no se puede capturar');
                return;
            }
        } else {
            this.capturedMetrics = this.calculateStabilizedMetrics();
        }

        this.isStabilizing = false;
        this.updateConnectionStatus('✅ Métricas estabilizadas - Datos listos', 'connected');

        // Capturar snapshot con métricas estabilizadas
        setTimeout(() => {
            this.captureSnapshot();
        }, 500);
    }

    calculateStabilizedMetrics() {
        const bufferLength = this.metricsBuffer.length;

        // Inicializar acumuladores
        const stabilized = {
            posture: {
                cervicalAlignment: 0,
                pelvicTilt: 0,
                lateralDeviation: 0
            },
            joints: {
                rightShoulderAngle: 0,
                leftShoulderAngle: 0,
                rightHipAngle: 0,
                leftHipAngle: 0
            },
            symmetry: {
                shoulderSymmetry: 0,
                hipSymmetry: 0,
                overallBalance: 0
            }
        };

        // Sumar todos los valores
        this.metricsBuffer.forEach(item => {
            const m = item.metrics;
            stabilized.posture.cervicalAlignment += m.posture.cervicalAlignment || 0;
            stabilized.posture.pelvicTilt += m.posture.pelvicTilt || 0;
            stabilized.posture.lateralDeviation += m.posture.lateralDeviation || 0;

            stabilized.joints.rightShoulderAngle += m.joints.rightShoulderAngle || 0;
            stabilized.joints.leftShoulderAngle += m.joints.leftShoulderAngle || 0;
            stabilized.joints.rightHipAngle += m.joints.rightHipAngle || 0;
            stabilized.joints.leftHipAngle += m.joints.leftHipAngle || 0;

            stabilized.symmetry.shoulderSymmetry += m.symmetry.shoulderSymmetry || 0;
            stabilized.symmetry.hipSymmetry += m.symmetry.hipSymmetry || 0;
            stabilized.symmetry.overallBalance += m.symmetry.overallBalance || 0;
        });

        // Calcular promedios
        Object.keys(stabilized).forEach(category => {
            Object.keys(stabilized[category]).forEach(metric => {
                stabilized[category][metric] /= bufferLength;
            });
        });

        return stabilized;
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

        // Usar métricas estabilizadas si están disponibles, sino usar actuales
        const metricsToUse = this.capturedMetrics || this.currentMetrics;
        const metricsSource = this.capturedMetrics ? 'estabilizadas' : 'instantáneas';

        const snapshot = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            patientData: this.patientData,
            landmarks: this.receivedLandmarks,
            metrics: JSON.parse(JSON.stringify(metricsToUse)),
            metricsSource: metricsSource, // Indicar el origen de las métricas
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

        // DEBUG: Verificar que métricas lleguen correctamente
        if (!metrics || !metrics.posture) {
            console.warn('⚠️ Métricas inválidas recibidas:', metrics);
            return;
        }

        // Guardar datos recibidos
        this.receivedLandmarks = landmarks;
        this.currentMetrics = metrics;

        // Agregar métricas al buffer para estabilización
        this.metricsBuffer.push({
            timestamp: timestamp,
            metrics: JSON.parse(JSON.stringify(metrics)) // Deep copy
        });

        // Mantener buffer en tamaño máximo (buffer circular)
        if (this.metricsBuffer.length > this.bufferSize) {
            this.metricsBuffer.shift(); // Remover el más antiguo
        }

        // Actualizar estadísticas de transmisión
        this.updateTransmissionStats(timestamp);

        // Dibujar pose en canvas (solo si landmarks están presentes)
        if (landmarks && landmarks.length > 0) {
            this.drawPoseOnCanvas(landmarks);
        }

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
        // Usar métricas estabilizadas si están disponibles
        const metricsToUse = this.capturedMetrics || this.currentMetrics;
        const metricsSource = this.capturedMetrics ? 'estabilizadas (promediadas)' : 'instantáneas';

        const report = {
            sessionInfo: {
                sessionCode: this.sessionCode,
                date: new Date().toLocaleDateString('es-ES'),
                time: new Date().toLocaleTimeString('es-ES'),
                duration: 'Calculando...',
                metricsSource: metricsSource // Indicar origen de métricas en reporte
            },
            doctorInfo: this.doctorData,
            patientInfo: this.patientData,
            currentMetrics: metricsToUse,
            snapshots: this.snapshots,
            doctorNotes: this.doctorNotes.value || '',
            recommendations: this.generateRecommendations(metricsToUse)
        };

        // Crear y descargar archivo JSON
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `informe_telemedicina_${this.patientData.name}_${Date.now()}.json`;
        a.click();
    }

    generatePDFReport() {
        // Usar métricas estabilizadas si están disponibles
        const metricsToUse = this.capturedMetrics || this.currentMetrics;
        const metricsSource = this.capturedMetrics ? 'estabilizadas (promediadas)' : 'instantáneas';

        if (!metricsToUse) {
            alert('No hay métricas disponibles para generar el informe');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Configuración de colores
        const primaryColor = [91, 141, 239]; // #5b8def
        const textColor = [50, 50, 50];
        const lightGray = [176, 179, 184];

        let y = 20;

        // ========== ENCABEZADO ==========
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 35, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORME MÉDICO', 105, 15, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Examen Osteomuscular Virtual - Telemedicina', 105, 25, { align: 'center' });

        y = 45;
        doc.setTextColor(...textColor);

        // ========== INFORMACIÓN DE SESIÓN ==========
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Información de Sesión', 15, y);
        y += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Código de Sesión: ${this.sessionCode}`, 15, y);
        y += 6;
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 15, y);
        y += 6;
        doc.text(`Hora: ${new Date().toLocaleTimeString('es-ES')}`, 15, y);
        y += 6;
        doc.text(`Origen de Métricas: ${metricsSource}`, 15, y);
        y += 10;

        // ========== INFORMACIÓN DEL PACIENTE ==========
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Datos del Paciente', 15, y);
        y += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Nombre: ${this.patientData.name}`, 15, y);
        y += 6;
        if (this.patientData.age) {
            doc.text(`Edad: ${this.patientData.age} años`, 15, y);
            y += 6;
        }
        y += 5;

        // ========== INFORMACIÓN DEL MÉDICO ==========
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Médico Evaluador', 15, y);
        y += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Dr./Dra. ${this.doctorData.name}`, 15, y);
        y += 10;

        // ========== MÉTRICAS POSTURALES ==========
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Análisis Postural', 15, y);
        y += 8;

        // Tabla de postura
        const posture = metricsToUse.posture;
        this.addMetricRow(doc, y, 'Alineación Cervical', posture.cervicalAlignment.toFixed(2), '°',
            posture.cervicalAlignment <= 10 ? '✓ Normal' : posture.cervicalAlignment <= 15 ? '⚠ Atención' : '✗ Alterado');
        y += 8;
        this.addMetricRow(doc, y, 'Inclinación Pélvica', posture.pelvicTilt.toFixed(2), '°',
            posture.pelvicTilt <= 5 ? '✓ Normal' : '⚠ Alterado');
        y += 8;
        this.addMetricRow(doc, y, 'Desviación Lateral', posture.lateralDeviation.toFixed(2), 'mm',
            posture.lateralDeviation <= 20 ? '✓ Normal' : posture.lateralDeviation <= 30 ? '⚠ Atención' : '✗ Alterado');
        y += 12;

        // ========== ÁNGULOS ARTICULARES ==========
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Ángulos Articulares', 15, y);
        y += 8;

        const joints = metricsToUse.joints;
        this.addMetricRow(doc, y, 'Hombro Derecho', joints.rightShoulderAngle.toFixed(1), '°', '-');
        y += 8;
        this.addMetricRow(doc, y, 'Hombro Izquierdo', joints.leftShoulderAngle.toFixed(1), '°', '-');
        y += 8;
        this.addMetricRow(doc, y, 'Cadera Derecha', joints.rightHipAngle.toFixed(1), '°', '-');
        y += 8;
        this.addMetricRow(doc, y, 'Cadera Izquierda', joints.leftHipAngle.toFixed(1), '°', '-');
        y += 12;

        // ========== SIMETRÍA CORPORAL ==========
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Simetría Corporal', 15, y);
        y += 8;

        const symmetry = metricsToUse.symmetry;
        this.addMetricRow(doc, y, 'Simetría de Hombros', symmetry.shoulderSymmetry.toFixed(1), '%',
            symmetry.shoulderSymmetry >= 90 ? '✓ Normal' : symmetry.shoulderSymmetry >= 85 ? '⚠ Atención' : '✗ Alterado');
        y += 8;
        this.addMetricRow(doc, y, 'Simetría de Caderas', symmetry.hipSymmetry.toFixed(1), '%',
            symmetry.hipSymmetry >= 90 ? '✓ Normal' : symmetry.hipSymmetry >= 85 ? '⚠ Atención' : '✗ Alterado');
        y += 8;
        this.addMetricRow(doc, y, 'Balance General', symmetry.overallBalance.toFixed(1), '%',
            symmetry.overallBalance >= 80 ? '✓ Normal' : '⚠ Alterado');
        y += 12;

        // Nueva página si es necesario
        if (y > 250) {
            doc.addPage();
            y = 20;
        }

        // ========== RECOMENDACIONES ==========
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Recomendaciones Clínicas', 15, y);
        y += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const recommendations = this.generateRecommendations(metricsToUse);

        recommendations.forEach((rec, index) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            const lines = doc.splitTextToSize(`${index + 1}. ${rec}`, 180);
            doc.text(lines, 15, y);
            y += lines.length * 5 + 3;
        });

        y += 5;

        // ========== SNAPSHOTS CAPTURADOS ==========
        if (this.snapshots.length > 0) {
            if (y > 250) {
                doc.addPage();
                y = 20;
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Capturas Realizadas', 15, y);
            y += 8;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Total de capturas: ${this.snapshots.length}`, 15, y);
            y += 6;

            this.snapshots.forEach((snapshot, index) => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                const time = new Date(snapshot.timestamp).toLocaleTimeString('es-ES');
                doc.text(`  • Captura ${index + 1}: ${time} (Métricas: ${snapshot.metricsSource})`, 15, y);
                y += 6;
            });
            y += 5;
        }

        // ========== NOTAS DEL MÉDICO ==========
        if (this.doctorNotes.value.trim()) {
            if (y > 240) {
                doc.addPage();
                y = 20;
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Observaciones del Médico', 15, y);
            y += 8;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const notesLines = doc.splitTextToSize(this.doctorNotes.value.trim(), 180);
            notesLines.forEach(line => {
                if (y > 280) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, 15, y);
                y += 5;
            });
        }

        // ========== PIE DE PÁGINA ==========
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(...lightGray);
            doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
            doc.text('Informe generado por Examen Osteomuscular Virtual', 105, 285, { align: 'center' });
        }

        // Guardar PDF
        const fileName = `Informe_${this.patientData.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        doc.save(fileName);
    }

    addMetricRow(doc, y, label, value, unit, status) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`${label}:`, 20, y);
        doc.setFont('helvetica', 'bold');
        doc.text(`${value}${unit}`, 100, y);
        doc.setFont('helvetica', 'italic');
        doc.text(status, 140, y);
    }

    generateRecommendations(metrics = null) {
        const recommendations = [];
        const metricsToUse = metrics || this.capturedMetrics || this.currentMetrics;

        // Validar que hay métricas disponibles
        if (!metricsToUse || !metricsToUse.posture || !metricsToUse.symmetry) {
            console.warn('⚠️ No hay métricas disponibles para generar recomendaciones');
            recommendations.push('ℹ️ No se pudieron generar recomendaciones - datos insuficientes');
            return recommendations;
        }

        // Recomendaciones basadas en alineación cervical
        if (metricsToUse.posture.cervicalAlignment > 15) {
            recommendations.push('🔸 Considerar evaluación de postura cervical - desviación significativa detectada');
            recommendations.push('📋 Recomendaciones: Ejercicios de fortalecimiento cervical y corrección postural');
        } else if (metricsToUse.posture.cervicalAlignment > 10) {
            recommendations.push('⚠️ Alineación cervical en límite superior - monitorear evolución');
        }

        // Recomendaciones basadas en inclinación pélvica
        if (metricsToUse.posture.pelvicTilt > 5) {
            recommendations.push('🔸 Revisar alineación pélvica - inclinación fuera del rango normal');
            recommendations.push('📋 Recomendaciones: Ejercicios de estabilización pélvica y fortalecimiento del core');
        }

        // Recomendaciones basadas en desviación lateral
        if (metricsToUse.posture.lateralDeviation > 30) {
            recommendations.push('🔸 Desviación lateral significativa - requiere atención médica');
            recommendations.push('📋 Recomendaciones: Evaluación ortopédica para descartar escoliosis o desequilibrios musculares');
        } else if (metricsToUse.posture.lateralDeviation > 20) {
            recommendations.push('⚠️ Desviación lateral moderada - ejercicios de corrección recomendados');
        }

        // Recomendaciones basadas en simetría
        if (metricsToUse.symmetry.shoulderSymmetry < 85) {
            recommendations.push('🔸 Asimetría en hombros detectada - considerar evaluación ortopédica');
            recommendations.push('📋 Recomendaciones: Ejercicios de equilibrio muscular y estiramiento específico');
        }

        if (metricsToUse.symmetry.hipSymmetry < 85) {
            recommendations.push('🔸 Asimetría en caderas detectada - evaluación de longitud de miembros');
            recommendations.push('📋 Recomendaciones: Análisis biomecánico y corrección de desequilibrios');
        }

        if (metricsToUse.symmetry.overallBalance < 80) {
            recommendations.push('🔸 Desequilibrio postural general - recomendable fisioterapia postural');
            recommendations.push('📋 Recomendaciones: Programa integral de reeducación postural');
        } else if (metricsToUse.symmetry.overallBalance < 90) {
            recommendations.push('⚠️ Balance postural mejorable - ejercicios de propriocepción recomendados');
        }

        // Recomendaciones basadas en ángulos articulares
        if (metricsToUse.joints.rightShoulderAngle < 160 || metricsToUse.joints.leftShoulderAngle < 160) {
            recommendations.push('🔸 Limitación en rango articular de hombros - evaluación de movilidad');
            recommendations.push('📋 Recomendaciones: Ejercicios de movilización y estiramiento específico');
        }

        if (metricsToUse.joints.rightHipAngle < 170 || metricsToUse.joints.leftHipAngle < 170) {
            recommendations.push('🔸 Posible limitación en extensión de cadera - evaluación funcional');
            recommendations.push('📋 Recomendaciones: Ejercicios de flexibilidad y fortalecimiento de caderas');
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
        this.generatePDFBtn.disabled = false;
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

        // Mostrar solo cuando hay mensaje relevante
        if (message && message.trim() !== '') {
            this.connectionStatus.classList.remove('hidden');
        } else {
            this.connectionStatus.classList.add('hidden');
        }
    }

    // 🔍 DIAGNÓSTICO: Actualizar panel de participantes Twilio
    updateTwilioParticipantsPanel() {
        if (!this.twilioRoom) {
            this.twilioParticipantsPanel.classList.add('hidden');
            return;
        }

        // Mostrar panel
        this.twilioParticipantsPanel.classList.remove('hidden');

        // Actualizar nombre de sala
        this.twilioRoomName.textContent = this.twilioRoom.name;

        // Contar participantes (incluyendo local)
        const totalParticipants = this.twilioRoom.participants.size + 1; // +1 por el médico local
        this.twilioParticipantsCount.textContent = totalParticipants;

        // Generar lista de participantes
        const participantsList = [];

        // Médico local (yo)
        participantsList.push(`
            <div style="margin-bottom: 6px; padding: 6px; background: #2a5cd6; border-radius: 4px;">
                <div style="font-weight: 600; color: #fff;">👨‍⚕️ ${this.twilioRoom.localParticipant.identity}</div>
                <div style="font-size: 10px; color: #ccc;">SID: ${this.twilioRoom.localParticipant.sid}</div>
                <div style="font-size: 10px; color: #90EE90;">Estado: ${this.twilioRoom.localParticipant.state} (local)</div>
            </div>
        `);

        // Participantes remotos (pacientes)
        this.twilioRoom.participants.forEach(participant => {
            participantsList.push(`
                <div style="margin-bottom: 6px; padding: 6px; background: #3a3b3c; border-radius: 4px;">
                    <div style="font-weight: 600; color: #fff;">👤 ${participant.identity}</div>
                    <div style="font-size: 10px; color: #ccc;">SID: ${participant.sid}</div>
                    <div style="font-size: 10px; color: ${participant.state === 'connected' ? '#90EE90' : '#FFA500'};">
                        Estado: ${participant.state}
                    </div>
                    <div style="font-size: 10px; color: #b0b3b8;">
                        Tracks: ${participant.tracks.size} | Audio: ${participant.audioTracks.size} | Video: ${participant.videoTracks.size}
                    </div>
                </div>
            `);
        });

        this.twilioParticipantsList.innerHTML = participantsList.length > 0
            ? participantsList.join('')
            : '<div style="color: #666;">No hay participantes</div>';

        // 🔍 LOG CRÍTICO: Detectar reconexiones del médico
        if (totalParticipants === 1) {
            this.logger.warning('⚠️ DIAGNÓSTICO: Solo el médico en la sala (paciente no conectado)', {
                roomName: this.twilioRoom.name,
                roomSid: this.twilioRoom.sid,
                totalParticipants: totalParticipants,
                localIdentity: this.twilioRoom.localParticipant.identity
            }, 'diagnostic');
        } else if (totalParticipants > 2) {
            this.logger.error('⚠️ DIAGNÓSTICO: MÁS DE 2 PARTICIPANTES EN LA SALA (posible reconexión duplicada)', {
                roomName: this.twilioRoom.name,
                totalParticipants: totalParticipants,
                participants: Array.from(this.twilioRoom.participants.values()).map(p => ({
                    identity: p.identity,
                    sid: p.sid,
                    state: p.state
                }))
            }, 'diagnostic');
        }
    }

    showPlayButton() {
        // Crear botón de play si no existe
        if (document.getElementById('videoPlayButton')) return;

        const playButton = document.createElement('button');
        playButton.id = 'videoPlayButton';
        playButton.innerHTML = '▶️ Reproducir Video del Paciente';
        playButton.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 100;
            background: linear-gradient(135deg, #5b8def 0%, #4a7de8 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 14px 24px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            font-family: 'Figtree', sans-serif;
            box-shadow: 0 4px 12px rgba(91, 141, 239, 0.4);
        `;

        playButton.addEventListener('click', () => {
            this.remoteVideo.play()
                .then(() => {
                    playButton.remove();
                })
                .catch(err => {
                    console.error('❌ Error al reproducir video:', err);
                });
        });

        // Agregar al contenedor del video del paciente
        const videoContainer = this.remoteVideo.parentElement;
        videoContainer.style.position = 'relative';
        videoContainer.appendChild(playButton);
    }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    window.telemedicineDoctor = new TelemedicineDoctor();
});