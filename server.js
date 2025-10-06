/**
 * Servidor de Telemedicina - Examen Osteomuscular Virtual
 * Gestiona conexiones WebSocket entre pacientes y médicos
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/audio', express.static(path.join(__dirname, 'public', 'audio')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// Almacenar sessiones activas
const activeSessions = new Map();
const waitingDoctors = new Map();
const waitingPatients = new Map();

// ✅ NUEVO: Métricas de uso de WebRTC
const connectionMetrics = {
    webrtcSessions: 0,
    socketioFallbacks: 0,
    totalPoseDataMessages: 0
};

// Rutas principales
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/paciente', (req, res) => {
    res.sendFile(path.join(__dirname, 'paciente.html'));
});

app.get('/medico', (req, res) => {
    res.sendFile(path.join(__dirname, 'medico.html'));
});

// ✅ NUEVO: Endpoint para ver métricas de conexión
app.get('/metrics', (req, res) => {
    const activeSessionsCount = activeSessions.size;
    const webrtcPercentage = connectionMetrics.totalPoseDataMessages > 0
        ? ((1 - connectionMetrics.socketioFallbacks / connectionMetrics.totalPoseDataMessages) * 100).toFixed(1)
        : 0;

    res.json({
        activeSessions: activeSessionsCount,
        connectionMetrics: {
            ...connectionMetrics,
            webrtcPercentage: `${webrtcPercentage}%`,
            socketioPercentage: `${(100 - webrtcPercentage).toFixed(1)}%`
        },
        sessionsList: Array.from(activeSessions.entries()).map(([code, session]) => ({
            code,
            isActive: session.isActive,
            hasDoctor: !!session.doctorId,
            hasPatient: !!session.patientId
        }))
    });
});

// Generar código de sesión único
function generateSessionCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Gestión de conexiones WebSocket
io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    // Médico se registra y genera código de sesión
    socket.on('doctor-register', (doctorData) => {
        const sessionCode = generateSessionCode();

        const session = {
            id: socket.id,
            sessionCode,
            doctorId: socket.id,
            doctorData: doctorData,
            patientId: null,
            patientData: null,
            isActive: false,
            createdAt: new Date()
        };

        activeSessions.set(sessionCode, session);
        waitingDoctors.set(socket.id, sessionCode);

        socket.join(`session-${sessionCode}`);
        socket.emit('session-created', {
            sessionCode,
            message: 'Sesión creada. Comparta el código con el paciente.'
        });

        console.log(`👨‍⚕️ Médico registrado - Sesión: ${sessionCode}`);
    });

    // Paciente se conecta con código de sesión
    socket.on('patient-join', ({ sessionCode, patientData }) => {
        const session = activeSessions.get(sessionCode);

        if (!session) {
            socket.emit('session-error', {
                message: 'Código de sesión inválido'
            });
            return;
        }

        if (session.patientId) {
            socket.emit('session-error', {
                message: 'Ya hay un paciente en esta sesión'
            });
            return;
        }

        // Conectar paciente a la sesión
        session.patientId = socket.id;
        session.patientData = patientData;
        session.isActive = true;

        socket.join(`session-${sessionCode}`);

        // Notificar al médico
        io.to(session.doctorId).emit('patient-connected', {
            sessionCode,
            patientData,
            message: 'Paciente conectado'
        });

        // Confirmar al paciente
        socket.emit('session-joined', {
            sessionCode,
            doctorData: session.doctorData,
            message: 'Conectado con el médico'
        });

        // Dar tiempo al médico para configurarse y luego notificar al paciente para iniciar WebRTC
        setTimeout(() => {
            socket.emit('doctor-ready-for-webrtc', {
                sessionCode,
                message: 'Médico listo para recibir video'
            });
            console.log(`📹 Notificando al paciente que médico está listo para WebRTC: ${sessionCode}`);
        }, 500);

        console.log(`👤 Paciente conectado a sesión: ${sessionCode}`);
    });

    // Transmitir datos de pose del paciente al médico
    socket.on('pose-data', ({ sessionCode, landmarks, metrics, timestamp }) => {
        const session = activeSessions.get(sessionCode);

        if (session && session.patientId === socket.id && session.isActive) {
            // Enviar datos al médico
            io.to(session.doctorId).emit('receive-pose-data', {
                landmarks,
                metrics,
                timestamp: timestamp || Date.now()
            });

            // ✅ NUEVO: Contar mensajes de fallback (Socket.io)
            connectionMetrics.totalPoseDataMessages++;
            connectionMetrics.socketioFallbacks++;

            // Log reducido (solo cada 100 mensajes para no saturar)
            if (connectionMetrics.totalPoseDataMessages % 100 === 0) {
                console.log(`📊 Socket.io fallback: ${connectionMetrics.socketioFallbacks} msgs | Total: ${connectionMetrics.totalPoseDataMessages}`);
            }
        } else {
            console.log(`⚠️ Datos rechazados - Sesión inválida o inactiva: ${sessionCode}`);
        }
    });

    // Médico envía comandos de control al paciente
    socket.on('doctor-command', ({ sessionCode, command, data }) => {
        const session = activeSessions.get(sessionCode);

        if (session && session.doctorId === socket.id && session.patientId) {
            io.to(session.patientId).emit('receive-command', {
                command,
                data,
                timestamp: Date.now()
            });

            console.log(`📋 Comando enviado: ${command}`);
        }
    });

    // Transmitir video streaming (WebRTC signaling)
    socket.on('webrtc-offer', ({ sessionCode, offer }) => {
        console.log(`📹 WebRTC Offer recibido - Sesión: ${sessionCode}, Socket: ${socket.id}`);
        const session = activeSessions.get(sessionCode);

        if (session && session.patientId === socket.id) {
            console.log(`✅ Reenviando offer al médico: ${session.doctorId}`);
            io.to(session.doctorId).emit('webrtc-offer', { offer });
        } else {
            console.log(`❌ Offer rechazado - Sesión válida: ${!!session}, Socket correcto: ${session?.patientId === socket.id}`);
        }
    });

    socket.on('webrtc-answer', ({ sessionCode, answer }) => {
        console.log(`📹 WebRTC Answer recibido - Sesión: ${sessionCode}, Socket: ${socket.id}`);
        const session = activeSessions.get(sessionCode);

        if (session && session.doctorId === socket.id) {
            console.log(`✅ Reenviando answer al paciente: ${session.patientId}`);
            io.to(session.patientId).emit('webrtc-answer', { answer });
        } else {
            console.log(`❌ Answer rechazado - Sesión válida: ${!!session}, Socket correcto: ${session?.doctorId === socket.id}`);
        }
    });

    socket.on('webrtc-ice-candidate', ({ sessionCode, candidate }) => {
        console.log(`🧊 ICE Candidate recibido - Sesión: ${sessionCode}`);
        const session = activeSessions.get(sessionCode);

        if (session) {
            // Reenviar al otro peer
            const targetId = session.patientId === socket.id ?
                           session.doctorId : session.patientId;

            if (targetId) {
                console.log(`✅ Reenviando ICE candidate a: ${targetId}`);
                io.to(targetId).emit('webrtc-ice-candidate', { candidate });
            }
        } else {
            console.log(`❌ ICE Candidate rechazado - Sesión no encontrada`);
        }
    });

    // Capturar snapshot médico
    socket.on('capture-snapshot', ({ sessionCode, snapshotData }) => {
        const session = activeSessions.get(sessionCode);

        if (session && session.doctorId === socket.id) {
            io.to(`session-${sessionCode}`).emit('snapshot-captured', {
                snapshotData,
                timestamp: Date.now()
            });

            console.log(`📸 Snapshot capturado en sesión: ${sessionCode}`);
        }
    });

    // Manejo de desconexiones
    socket.on('disconnect', () => {
        console.log(`🔌 Cliente desconectado: ${socket.id}`);

        // Limpiar sesiones
        let sessionToRemove = null;

        for (let [code, session] of activeSessions) {
            if (session.doctorId === socket.id) {
                // Médico se desconectó
                if (session.patientId) {
                    io.to(session.patientId).emit('doctor-disconnected', {
                        message: 'El médico se ha desconectado'
                    });
                }
                sessionToRemove = code;
                waitingDoctors.delete(socket.id);
                break;
            } else if (session.patientId === socket.id) {
                // Paciente se desconectó
                io.to(session.doctorId).emit('patient-disconnected', {
                    message: 'El paciente se ha desconectado'
                });
                session.patientId = null;
                session.patientData = null;
                session.isActive = false;
                waitingPatients.delete(socket.id);
                break;
            }
        }

        if (sessionToRemove) {
            activeSessions.delete(sessionToRemove);
            console.log(`🗑️ Sesión eliminada: ${sessionToRemove}`);
        }
    });

    // Heartbeat para mantener conexión activa
    socket.on('heartbeat', ({ sessionCode }) => {
        const session = activeSessions.get(sessionCode);
        if (session) {
            socket.emit('heartbeat-response', {
                timestamp: Date.now(),
                sessionActive: session.isActive
            });
        }
    });

    // Obtener estadísticas del servidor
    socket.on('get-server-stats', () => {
        if (socket.id in waitingDoctors ||
            Array.from(activeSessions.values()).some(s => s.doctorId === socket.id)) {

            socket.emit('server-stats', {
                activeSessions: activeSessions.size,
                waitingDoctors: waitingDoctors.size,
                waitingPatients: waitingPatients.size,
                timestamp: Date.now()
            });
        }
    });
});

// Limpiar sesiones inactivas cada 30 minutos
setInterval(() => {
    const now = Date.now();
    const THIRTY_MINUTES = 30 * 60 * 1000;

    for (let [code, session] of activeSessions) {
        if (now - session.createdAt.getTime() > THIRTY_MINUTES && !session.isActive) {
            activeSessions.delete(code);
            console.log(`🧹 Sesión inactiva eliminada: ${code}`);
        }
    }
}, 30 * 60 * 1000);

// Iniciar servidor
server.listen(PORT, () => {
    console.log(`🏥 Servidor de Telemedicina ejecutándose en puerto ${PORT}`);
    console.log(`🌐 Acceder a:`);
    console.log(`   - Página principal: http://localhost:${PORT}`);
    console.log(`   - Interfaz Paciente: http://localhost:${PORT}/paciente`);
    console.log(`   - Interfaz Médico: http://localhost:${PORT}/medico`);
});

module.exports = { app, server, io };