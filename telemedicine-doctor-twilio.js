/**
 * Cliente del Médico con Twilio Video
 * Versión simplificada y estable
 */

class TelemedicineDoctorTwilio {
    constructor() {
        this.socket = io();
        this.canvas = null;
        this.ctx = null;

        this.sessionCode = null;
        this.isSessionActive = false;
        this.patientConnected = false;
        this.isExamRunning = false;

        // Twilio Video
        this.twilioRoom = null;
        this.twilioToken = null;
        this.remoteParticipant = null;

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

        // Secuencia de examen completo (igual que antes)
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

        // Métricas y buffer (igual que antes)
        this.lastLandmarks = [];
        this.dataChannelReady = false;
        this.metricsBuffer = [];
        this.bufferSize = 30;
        this.capturedMetrics = null;
        this.isStabilizing = false;

        this.initializeInterface();
    }

    async initializeInterface() {
        console.log('👨‍⚕️ Iniciando interfaz del médico con Twilio...');

        try {
            this.initializeDOMElements();
            this.setupEventListeners();
            this.setupSocketEvents();

            console.log('✅ Interfaz del médico lista (Twilio)');
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

        // Métricas (iguales que antes)
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

        // Botones de informe
        this.generateReportBtn = document.getElementById('generateReportBtn');
        this.generatePDFBtn = document.getElementById('generatePDFBtn');

        // Configurar canvas dimensions
        if (this.canvas) {
            this.canvas.width = 600;
            this.canvas.height = 400;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    setupEventListeners() {
        // Crear sesión
        this.createSessionBtn.addEventListener('click', () => this.createSession());

        // Enter en el nombre del médico
        this.doctorNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createSession();
        });

        // Controles de examen
        this.startExamBtn.addEventListener('click', () => this.startExam());
        this.startGuidedBtn.addEventListener('click', () => this.startGuidedSequence());
        this.stopExamBtn.addEventListener('click', () => this.stopExam());
        this.countdownBtn.addEventListener('click', () => this.startCountdown());

        // Enviar instrucción personalizada
        this.sendInstructionBtn.addEventListener('click', () => this.sendCustomInstruction());

        // Enter en instrucciones
        this.customInstructionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendCustomInstruction();
        });

        // Generar informes
        this.generateReportBtn.addEventListener('click', () => this.generateReport());
        this.generatePDFBtn.addEventListener('click', () => this.generatePDFReport());
    }

    setupSocketEvents() {
        // Sesión creada
        this.socket.on('session-created', ({ sessionCode }) => {
            console.log('✅ Sesión creada:', sessionCode);
            this.sessionCode = sessionCode;
            this.isSessionActive = true;

            this.sessionCodeDisplay.textContent = sessionCode;
            this.sessionCodeContainer.style.display = 'block';
            this.updateConnectionStatus('🟢 Sesión activa - Esperando paciente', 'success');

            this.doctorNameInput.disabled = true;
            this.createSessionBtn.disabled = true;
        });

        // Paciente conectado
        this.socket.on('patient-joined', ({ patientData }) => {
            console.log('👤 Paciente conectado:', patientData);
            this.patientConnected = true;

            this.patientName.textContent = patientData.name;
            this.patientInfo.style.display = 'block';
            this.updateConnectionStatus('🟢 Paciente conectado', 'success');

            this.startExamBtn.disabled = false;
            this.startGuidedBtn.disabled = false;

            // ✅ TWILIO: Unirse a la sala de video
            this.joinTwilioRoom();
        });

        // Pose landmarks (Socket.io - igual que antes)
        this.socket.on('pose-landmarks', ({ landmarks, timestamp }) => {
            if (landmarks && landmarks.length > 0) {
                this.lastLandmarks = landmarks;
                this.drawPoseOnCanvas(landmarks);
            }
        });

        // Paciente desconectado
        this.socket.on('patient-disconnected', () => {
            console.log('❌ Paciente desconectado');
            this.patientConnected = false;
            this.updateConnectionStatus('⚠️ Paciente desconectado', 'warning');

            // Desconectar de Twilio
            if (this.twilioRoom) {
                this.twilioRoom.disconnect();
                this.twilioRoom = null;
            }
        });

        // Socket desconectado
        this.socket.on('disconnect', () => {
            console.log('🔌 Desconectado del servidor');
            this.updateConnectionStatus('🔴 Desconectado del servidor', 'error');
            this.resetSession();
        });
    }

    async joinTwilioRoom() {
        try {
            console.log('📺 Uniéndose a sala de Twilio...');

            // Obtener token del servidor
            const response = await fetch('/twilio-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identity: `doctor-${this.doctorData.name}`,
                    room: this.sessionCode
                })
            });

            const data = await response.json();
            this.twilioToken = data.token;

            // Conectar a Twilio Video
            this.twilioRoom = await Twilio.Video.connect(this.twilioToken, {
                name: this.sessionCode,
                audio: true,
                video: true
            });

            console.log('✅ Conectado a sala Twilio:', this.twilioRoom.name);

            // Manejar participantes remotos (paciente)
            this.twilioRoom.on('participantConnected', participant => {
                console.log('👤 Participante conectado:', participant.identity);
                this.handleRemoteParticipant(participant);
            });

            this.twilioRoom.on('participantDisconnected', participant => {
                console.log('👤 Participante desconectado:', participant.identity);
                this.remoteVideo.srcObject = null;
            });

            // Si ya hay participantes conectados
            this.twilioRoom.participants.forEach(participant => {
                this.handleRemoteParticipant(participant);
            });

        } catch (error) {
            console.error('❌ Error conectando a Twilio:', error);
            this.updateConnectionStatus('❌ Error de video', 'error');
        }
    }

    handleRemoteParticipant(participant) {
        this.remoteParticipant = participant;

        // Manejar tracks existentes
        participant.tracks.forEach(publication => {
            if (publication.track) {
                this.attachTrack(publication.track);
            }
        });

        // Manejar nuevos tracks
        participant.on('trackSubscribed', track => {
            this.attachTrack(track);
        });
    }

    attachTrack(track) {
        if (track.kind === 'video') {
            track.attach(this.remoteVideo);

            // Ocultar placeholder
            if (this.videoPlaceholder) {
                this.videoPlaceholder.style.display = 'none';
            }

            // Mostrar video
            this.remoteVideo.style.display = 'block';
            this.remoteVideo.style.visibility = 'visible';

            console.log('✅ Video del paciente conectado (Twilio)');
        }

        if (track.kind === 'audio') {
            track.attach(); // Audio se reproduce automáticamente
            console.log('✅ Audio del paciente conectado (Twilio)');
        }
    }

    createSession() {
        const doctorName = this.doctorNameInput.value.trim();

        if (!doctorName) {
            alert('Por favor ingrese su nombre');
            return;
        }

        this.doctorData.name = doctorName;

        this.socket.emit('create-session', {
            doctorData: this.doctorData
        });
    }

    // TODO: Resto de métodos igual que telemedicine-doctor.js original
    // (startExam, stopExam, sendCustomInstruction, drawPoseOnCanvas, etc.)
    // Por ahora copio los métodos esenciales...

    updateConnectionStatus(message, type = 'info') {
        this.connectionStatus.textContent = message;
        this.connectionStatus.className = `connection-status ${type}`;
    }

    resetSession() {
        this.isSessionActive = false;
        this.patientConnected = false;
        this.sessionCode = null;

        if (this.twilioRoom) {
            this.twilioRoom.disconnect();
            this.twilioRoom = null;
        }

        this.doctorNameInput.disabled = false;
        this.createSessionBtn.disabled = false;
        this.sessionCodeContainer.style.display = 'none';
        this.patientInfo.style.display = 'none';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.doctorApp = new TelemedicineDoctorTwilio();
});
