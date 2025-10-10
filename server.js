/**
 * Servidor de Telemedicina - Examen Osteomuscular Virtual
 * Gestiona conexiones WebSocket entre pacientes y médicos
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const twilio = require('twilio');
const whatsappNotifier = require('./whatsapp-notifier');

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

// ✅ LOGGING SYSTEM: Almacenar logs de clientes
const clientLogs = [];
const MAX_LOGS_IN_MEMORY = 5000; // Mantener últimos 5000 logs

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

// ✅ LOGGING SYSTEM: Dashboard de logs
app.get('/logs', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema de Logs - Telemedicina</title>
    <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Figtree', sans-serif;
            background: #1c1e21;
            color: #e4e6eb;
            padding: 20px;
        }

        .header {
            background: #242527;
            border: 1px solid #3a3b3c;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
        }

        h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            color: #5b8def;
        }

        .stats {
            display: flex;
            gap: 24px;
            margin-top: 16px;
            flex-wrap: wrap;
        }

        .stat-card {
            background: #1c1e21;
            border: 1px solid #3a3b3c;
            border-radius: 8px;
            padding: 12px 16px;
        }

        .stat-label {
            font-size: 12px;
            color: #b0b3b8;
            margin-bottom: 4px;
        }

        .stat-value {
            font-size: 20px;
            font-weight: 600;
            color: #5b8def;
        }

        .filters {
            background: #242527;
            border: 1px solid #3a3b3c;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 20px;
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;
        }

        .filter-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .filter-group label {
            font-size: 12px;
            color: #b0b3b8;
            font-weight: 500;
        }

        input, select, button {
            background: #1c1e21;
            color: #e4e6eb;
            border: 1px solid #3a3b3c;
            border-radius: 8px;
            padding: 8px 12px;
            font-family: 'Figtree', sans-serif;
            font-size: 14px;
        }

        button {
            background: #5b8def;
            color: white;
            border: none;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.2s;
        }

        button:hover {
            background: #4a7ad6;
        }

        button.danger {
            background: #e85d55;
        }

        button.danger:hover {
            background: #d64a42;
        }

        .logs-container {
            background: #242527;
            border: 1px solid #3a3b3c;
            border-radius: 12px;
            padding: 16px;
            max-height: calc(100vh - 400px);
            overflow-y: auto;
        }

        .log-entry {
            background: #1c1e21;
            border: 1px solid #3a3b3c;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 8px;
            font-size: 13px;
            line-height: 1.5;
        }

        .log-entry.info {
            border-left: 4px solid #5b8def;
        }

        .log-entry.success {
            border-left: 4px solid #5ebd6d;
        }

        .log-entry.warning {
            border-left: 4px solid #f7b928;
        }

        .log-entry.error {
            border-left: 4px solid #e85d55;
        }

        .log-entry.debug {
            border-left: 4px solid #b0b3b8;
            opacity: 0.8;
        }

        .log-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .log-meta {
            display: flex;
            gap: 12px;
            font-size: 11px;
            color: #b0b3b8;
        }

        .log-message {
            color: #e4e6eb;
            margin-bottom: 8px;
            font-weight: 500;
        }

        .log-data {
            background: rgba(91, 141, 239, 0.05);
            border-radius: 4px;
            padding: 8px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #b0b3b8;
            white-space: pre-wrap;
            word-break: break-all;
        }

        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .badge.doctor {
            background: #5b8def;
            color: white;
        }

        .badge.patient {
            background: #5ebd6d;
            color: white;
        }

        .badge.twilio {
            background: #e85d55;
            color: white;
        }

        .badge.socket {
            background: #f7b928;
            color: white;
        }

        .badge.mediapipe {
            background: #9b59b6;
            color: white;
        }

        .badge.network {
            background: #3498db;
            color: white;
        }

        .badge.general {
            background: #b0b3b8;
            color: white;
        }

        .no-logs {
            text-align: center;
            padding: 40px;
            color: #b0b3b8;
        }

        .auto-refresh {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .auto-refresh input[type="checkbox"] {
            width: 16px;
            height: 16px;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .refreshing {
            animation: pulse 1s infinite;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Sistema de Logs - Telemedicina</h1>
        <p style="color: #b0b3b8; margin-top: 8px;">Monitoreo en tiempo real de conexiones Twilio Video</p>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-label">Total de Logs</div>
                <div class="stat-value" id="totalLogs">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Errores</div>
                <div class="stat-value" style="color: #e85d55;" id="errorCount">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Advertencias</div>
                <div class="stat-value" style="color: #f7b928;" id="warningCount">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Sesiones Activas</div>
                <div class="stat-value" style="color: #5ebd6d;" id="activeSessions">0</div>
            </div>
        </div>
    </div>

    <div class="filters">
        <div class="filter-group">
            <label>Código de Sesión</label>
            <input type="text" id="filterSession" placeholder="Ej: ABC123" maxlength="6">
        </div>

        <div class="filter-group">
            <label>Usuario</label>
            <select id="filterUser">
                <option value="">Todos</option>
                <option value="doctor">Médico</option>
                <option value="patient">Paciente</option>
            </select>
        </div>

        <div class="filter-group">
            <label>Categoría</label>
            <select id="filterCategory">
                <option value="">Todas</option>
                <option value="twilio">Twilio</option>
                <option value="socket">Socket.io</option>
                <option value="mediapipe">MediaPipe</option>
                <option value="network">Network</option>
                <option value="general">General</option>
            </select>
        </div>

        <div class="filter-group">
            <label>Nivel</label>
            <select id="filterLevel">
                <option value="">Todos</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="debug">Debug</option>
            </select>
        </div>

        <div class="filter-group" style="margin-left: auto;">
            <label>Acciones</label>
            <div style="display: flex; gap: 8px;">
                <button onclick="applyFilters()">🔍 Filtrar</button>
                <button onclick="clearFilters()">🔄 Limpiar</button>
                <button class="danger" onclick="clearLogs()">🗑️ Borrar Todo</button>
            </div>
        </div>

        <div class="filter-group">
            <label>Auto-actualizar</label>
            <div class="auto-refresh">
                <input type="checkbox" id="autoRefresh" checked>
                <span id="refreshStatus">⚪</span>
            </div>
        </div>
    </div>

    <div class="logs-container" id="logsContainer">
        <div class="no-logs">Cargando logs...</div>
    </div>

    <script>
        let allLogs = [];
        let autoRefreshInterval = null;

        async function fetchLogs() {
            try {
                const response = await fetch('/api/logs');
                const data = await response.json();
                allLogs = data.logs || [];

                // Update stats
                document.getElementById('totalLogs').textContent = data.totalLogs;
                document.getElementById('errorCount').textContent = data.errorCount;
                document.getElementById('warningCount').textContent = data.warningCount;
                document.getElementById('activeSessions').textContent = data.activeSessions;

                renderLogs(allLogs);

                // Update refresh status
                const status = document.getElementById('refreshStatus');
                status.textContent = '🟢';
                setTimeout(() => {
                    status.textContent = '⚪';
                }, 500);
            } catch (error) {
                console.error('Error fetching logs:', error);
                document.getElementById('refreshStatus').textContent = '🔴';
            }
        }

        function renderLogs(logs) {
            const container = document.getElementById('logsContainer');

            if (logs.length === 0) {
                container.innerHTML = '<div class="no-logs">No hay logs para mostrar</div>';
                return;
            }

            // Sort by timestamp (newest first)
            logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            container.innerHTML = logs.map(log => {
                const time = new Date(log.timestamp).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    fractionalSecondDigits: 3
                });

                const dataStr = log.data && Object.keys(log.data).length > 0
                    ? JSON.stringify(log.data, null, 2)
                    : null;

                return \`
                    <div class="log-entry \${log.level}">
                        <div class="log-header">
                            <div class="log-meta">
                                <span>\${time}</span>
                                <span class="badge \${log.userType}">\${log.userType}</span>
                                <span class="badge \${log.category}">\${log.category}</span>
                                \${log.sessionCode ? \`<span>📋 \${log.sessionCode}</span>\` : ''}
                                \${log.browserInfo ? \`<span>🌐 \${log.browserInfo.browserName}</span>\` : ''}
                            </div>
                        </div>
                        <div class="log-message">\${log.message}</div>
                        \${dataStr ? \`<div class="log-data">\${dataStr}</div>\` : ''}
                    </div>
                \`;
            }).join('');
        }

        function applyFilters() {
            const sessionFilter = document.getElementById('filterSession').value.trim().toUpperCase();
            const userFilter = document.getElementById('filterUser').value;
            const categoryFilter = document.getElementById('filterCategory').value;
            const levelFilter = document.getElementById('filterLevel').value;

            const filtered = allLogs.filter(log => {
                if (sessionFilter && log.sessionCode !== sessionFilter) return false;
                if (userFilter && log.userType !== userFilter) return false;
                if (categoryFilter && log.category !== categoryFilter) return false;
                if (levelFilter && log.level !== levelFilter) return false;
                return true;
            });

            renderLogs(filtered);
        }

        function clearFilters() {
            document.getElementById('filterSession').value = '';
            document.getElementById('filterUser').value = '';
            document.getElementById('filterCategory').value = '';
            document.getElementById('filterLevel').value = '';
            renderLogs(allLogs);
        }

        async function clearLogs() {
            if (!confirm('¿Estás seguro de que deseas borrar todos los logs?')) return;

            try {
                await fetch('/api/logs', { method: 'DELETE' });
                allLogs = [];
                renderLogs([]);
            } catch (error) {
                console.error('Error clearing logs:', error);
                alert('Error al borrar logs');
            }
        }

        // Auto-refresh
        document.getElementById('autoRefresh').addEventListener('change', (e) => {
            if (e.target.checked) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        });

        function startAutoRefresh() {
            stopAutoRefresh();
            autoRefreshInterval = setInterval(fetchLogs, 3000); // Every 3 seconds
        }

        function stopAutoRefresh() {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }
        }

        // Initial load
        fetchLogs();
        startAutoRefresh();
    </script>
</body>
</html>
    `);
});

// ✅ LOGGING SYSTEM: API endpoint para obtener logs
app.get('/api/logs', (req, res) => {
    const errorCount = clientLogs.filter(log => log.level === 'error').length;
    const warningCount = clientLogs.filter(log => log.level === 'warning').length;

    res.json({
        logs: clientLogs,
        totalLogs: clientLogs.length,
        errorCount,
        warningCount,
        activeSessions: activeSessions.size,
        timestamp: new Date().toISOString()
    });
});

// ✅ LOGGING SYSTEM: API endpoint para borrar logs
app.delete('/api/logs', (req, res) => {
    const previousCount = clientLogs.length;
    clientLogs.length = 0;

    res.json({
        success: true,
        message: `Eliminados ${previousCount} logs`,
        timestamp: new Date().toISOString()
    });
});

// ✅ Endpoint /twilio-token - Generar Access Token para Twilio Video
app.post('/twilio-token', (req, res) => {
    const { identity, room } = req.body;

    if (!identity || !room) {
        return res.status(400).json({ error: 'Se requiere identity y room' });
    }

    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const apiKeySid = process.env.TWILIO_API_KEY_SID;
        const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        // Decidir qué credenciales usar (API Key preferido, Auth Token fallback)
        const useApiKey = apiKeySid && apiKeySecret;
        const signingKeySid = useApiKey ? apiKeySid : accountSid;
        const signingKeySecret = useApiKey ? apiKeySecret : authToken;

        if (!accountSid || !signingKeySecret) {
            console.error('❌ Faltan credenciales de Twilio');
            return res.status(500).json({
                error: 'Configuración de Twilio incompleta'
            });
        }

        console.log(`🔑 Generando token con: ${useApiKey ? 'API Key (' + apiKeySid.substring(0, 10) + '...)' : 'Auth Token'}`);

        // Crear Access Token
        const AccessToken = twilio.jwt.AccessToken;
        const VideoGrant = AccessToken.VideoGrant;

        const token = new AccessToken(accountSid, signingKeySid, signingKeySecret, {
            identity: identity,
            ttl: 14400 // 4 horas
        });

        // Crear Video Grant para la sala específica
        const videoGrant = new VideoGrant({
            room: room
        });

        token.addGrant(videoGrant);

        res.json({
            token: token.toJwt(),
            identity: identity,
            room: room
        });

        console.log(`🎫 Token generado para ${identity} en sala ${room}`);
    } catch (error) {
        console.error('❌ Error generando token:', error);
        res.status(500).json({ error: 'Error generando token de Twilio' });
    }
});

// ✅ Endpoint /health - Monitoreo de recursos del servidor
app.get('/health', (req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    const activeSessionsCount = activeSessions.size;
    const connectedClients = io.engine.clientsCount;

    // Calcular MB de memoria
    const memoryMB = {
        rss: (memoryUsage.rss / 1024 / 1024).toFixed(2),           // Resident Set Size
        heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
        heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
        external: (memoryUsage.external / 1024 / 1024).toFixed(2)
    };

    // Calcular % de uso de heap
    const heapUsagePercent = ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(1);

    // Formato de uptime
    const uptimeFormatted = {
        days: Math.floor(uptime / 86400),
        hours: Math.floor((uptime % 86400) / 3600),
        minutes: Math.floor((uptime % 3600) / 60),
        seconds: Math.floor(uptime % 60)
    };

    // Estado del servidor
    const status = {
        healthy: activeSessionsCount < 60 && parseFloat(memoryMB.heapUsed) < 400,
        serverTime: new Date().toISOString(),
        uptime: uptimeFormatted,
        uptimeSeconds: Math.floor(uptime)
    };

    // Capacidad estimada
    const estimatedCapacity = {
        currentSessions: activeSessionsCount,
        maxRecommended: 60,
        availableSlots: Math.max(0, 60 - activeSessionsCount),
        utilizationPercent: ((activeSessionsCount / 60) * 100).toFixed(1)
    };

    res.json({
        status: status.healthy ? 'healthy' : 'warning',
        timestamp: status.serverTime,
        uptime: status.uptime,
        resources: {
            memory: {
                used: `${memoryMB.heapUsed} MB`,
                total: `${memoryMB.heapTotal} MB`,
                rss: `${memoryMB.rss} MB`,
                usagePercent: `${heapUsagePercent}%`
            },
            sessions: estimatedCapacity,
            clients: {
                connected: connectedClients,
                activeSessions: activeSessionsCount,
                waitingDoctors: waitingDoctors.size,
                waitingPatients: waitingPatients.size
            }
        },
        details: {
            nodeVersion: process.version,
            platform: process.platform,
            pid: process.pid
        }
    });
});

// ✅ Endpoint /metrics - Métricas de conexión WebRTC vs Socket.io
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

    // ✅ NUEVO: Transmitir landmarks por Socket.io (separado de métricas)
    socket.on('pose-landmarks', ({ sessionCode, landmarks, timestamp }) => {
        const session = activeSessions.get(sessionCode);

        if (session && session.patientId === socket.id && session.isActive) {
            // Enviar landmarks al médico
            io.to(session.doctorId).emit('pose-landmarks', {
                sessionCode,
                landmarks,
                timestamp: timestamp || Date.now()
            });
        }
    });

    // Transmitir datos de pose del paciente al médico (LEGACY - mantener para fallback)
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

    // ✅ LOGGING SYSTEM: Recibir logs de clientes
    socket.on('client-log', ({ logs, batchTimestamp }) => {
        if (!logs || !Array.isArray(logs)) return;

        logs.forEach(log => {
            // Add server timestamp
            log.serverReceivedAt = new Date().toISOString();
            log.socketId = socket.id;

            clientLogs.push(log);

            // 🔔 WhatsApp: Send critical events
            if (log.level === 'error' || log.level === 'critical') {
                whatsappNotifier.queueNotification({
                    level: log.level,
                    userType: log.userType,
                    sessionCode: log.sessionCode || 'UNKNOWN',
                    message: log.message,
                    details: log.data ? JSON.stringify(log.data).substring(0, 200) : null
                });
            }

            // 🔔 WhatsApp: Alert on Twilio connection failures
            if (log.category === 'twilio' && log.level === 'error') {
                const errorMsg = log.data?.error?.message || log.message;
                whatsappNotifier.sendCriticalAlert(
                    log.sessionCode || 'UNKNOWN',
                    log.userType,
                    `Fallo Twilio: ${log.message}`,
                    errorMsg
                );
            }
        });

        // Maintain max logs limit (FIFO)
        while (clientLogs.length > MAX_LOGS_IN_MEMORY) {
            clientLogs.shift();
        }

        // Log error count on server side for monitoring
        const errorCount = logs.filter(log => log.level === 'error').length;
        if (errorCount > 0) {
            console.log(`⚠️ Recibidos ${errorCount} errores en batch de ${logs.length} logs`);
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