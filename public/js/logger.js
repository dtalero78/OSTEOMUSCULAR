/**
 * Centralized Logging System for Twilio Video Telemedicine
 * Captures all events and sends them to server for monitoring
 */

class Logger {
    constructor(userType, sessionCode = null) {
        this.userType = userType; // 'doctor' or 'patient'
        this.sessionCode = sessionCode;
        this.socket = null;
        this.browserInfo = this.getBrowserInfo();
        this.logBuffer = [];
        this.maxBufferSize = 100;
        this.flushInterval = null;
        this.isDebugMode = window.location.search.includes('debug');

        // Initialize immediately if socket.io is available
        if (typeof io !== 'undefined') {
            this.socket = io();
            this.startFlushInterval();
        } else {
            console.error('❌ Logger: Socket.io not available');
        }
    }

    getBrowserInfo() {
        const ua = navigator.userAgent;
        return {
            userAgent: ua,
            platform: navigator.platform,
            vendor: navigator.vendor,
            language: navigator.language,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            isMobile: /Mobile|Android|iPhone|iPad|iPod/i.test(ua),
            isIOS: /iPhone|iPad|iPod/i.test(ua),
            browserName: this.getBrowserName(ua),
            browserVersion: this.getBrowserVersion(ua)
        };
    }

    getBrowserName(ua) {
        if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Edg')) return 'Edge';
        if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
        return 'Unknown';
    }

    getBrowserVersion(ua) {
        const match = ua.match(/(Chrome|Safari|Firefox|Edg|Opera|OPR)\/(\d+)/);
        return match ? match[2] : 'Unknown';
    }

    setSessionCode(sessionCode) {
        this.sessionCode = sessionCode;
        this.info('Session code set', { sessionCode });
    }

    /**
     * Core logging method - all logs go through here
     */
    log(level, message, data = {}, category = 'general') {
        // 🔍 CRÍTICO: Siempre intentar obtener sessionCode actualizado
        const currentSessionCode = this.sessionCode ||
                                   this.tryGetSessionCodeFromDOM() ||
                                   this.tryGetSessionCodeFromURL() ||
                                   'UNKNOWN';

        const logEntry = {
            timestamp: new Date().toISOString(),
            level, // 'info', 'warning', 'error', 'debug'
            category, // 'twilio', 'webrtc', 'socket', 'mediapipe', 'general'
            message,
            userType: this.userType,
            sessionCode: currentSessionCode,
            data: this.sanitizeData(data),
            browserInfo: this.browserInfo
        };

        // Add to buffer
        this.logBuffer.push(logEntry);

        // If buffer is full, flush immediately
        if (this.logBuffer.length >= this.maxBufferSize) {
            this.flush();
        }

        // Also log to console in debug mode
        if (this.isDebugMode) {
            const emoji = this.getLevelEmoji(level);
            console.log(`${emoji} [${category.toUpperCase()}] ${message}`, data);
        }

        // Always show errors
        if (level === 'error') {
            console.error(`❌ [${category.toUpperCase()}] ${message}`, data);
        }
    }

    getLevelEmoji(level) {
        const emojis = {
            info: '📘',
            warning: '⚠️',
            error: '❌',
            debug: '🔍',
            success: '✅'
        };
        return emojis[level] || '📝';
    }

    /**
     * Sanitize data to prevent circular references and large objects
     */
    sanitizeData(data) {
        try {
            // Create a clean copy
            const cleaned = {};

            for (const key in data) {
                const value = data[key];

                // Skip functions
                if (typeof value === 'function') continue;

                // Handle objects
                if (value && typeof value === 'object') {
                    // Skip DOM elements
                    if (value instanceof HTMLElement) {
                        cleaned[key] = `[HTMLElement: ${value.tagName}]`;
                        continue;
                    }

                    // Handle arrays
                    if (Array.isArray(value)) {
                        cleaned[key] = value.length > 10
                            ? `[Array: ${value.length} items]`
                            : value;
                        continue;
                    }

                    // Handle Error objects
                    if (value instanceof Error) {
                        cleaned[key] = {
                            name: value.name,
                            message: value.message,
                            stack: value.stack
                        };
                        continue;
                    }

                    // Limit object depth
                    try {
                        const json = JSON.stringify(value);
                        if (json.length > 500) {
                            cleaned[key] = json.substring(0, 500) + '... [truncated]';
                        } else {
                            cleaned[key] = value;
                        }
                    } catch (e) {
                        cleaned[key] = '[Circular or complex object]';
                    }
                } else {
                    cleaned[key] = value;
                }
            }

            return cleaned;
        } catch (error) {
            return { error: 'Failed to sanitize data' };
        }
    }

    /**
     * Flush log buffer to server
     */
    flush() {
        if (this.logBuffer.length === 0 || !this.socket) return;

        const logsToSend = [...this.logBuffer];
        const batchTimestamp = new Date().toISOString();
        this.logBuffer = [];

        // 🔍 CRÍTICO: Detectar logs zombie (enviados mucho después del evento)
        logsToSend.forEach(log => {
            log.sentAt = batchTimestamp;
            const eventTime = new Date(log.timestamp).getTime();
            const sendTime = new Date(batchTimestamp).getTime();
            log.delayMs = sendTime - eventTime;

            // Mark as zombie if sent > 60 seconds after event
            if (log.delayMs > 60000) {
                log.isZombie = true;
                log.zombieDelayMinutes = Math.floor(log.delayMs / 60000);
            } else if (log.delayMs > 5000) {
                log.isDelayed = true;
            }
        });

        this.socket.emit('client-log', {
            logs: logsToSend,
            batchTimestamp: batchTimestamp
        });
    }

    /**
     * Start periodic flush (every 5 seconds)
     */
    startFlushInterval() {
        this.flushInterval = setInterval(() => {
            this.flush();
        }, 5000);
    }

    /**
     * Stop periodic flush
     */
    stopFlushInterval() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
    }

    // Convenience methods for different log levels

    info(message, data = {}, category = 'general') {
        this.log('info', message, data, category);
    }

    success(message, data = {}, category = 'general') {
        this.log('success', message, data, category);
    }

    warning(message, data = {}, category = 'general') {
        this.log('warning', message, data, category);
    }

    error(message, data = {}, category = 'general') {
        this.log('error', message, data, category);
    }

    debug(message, data = {}, category = 'general') {
        if (this.isDebugMode) {
            this.log('debug', message, data, category);
        }
    }

    // Category-specific logging methods

    twilioLog(level, message, data = {}) {
        this.log(level, message, data, 'twilio');
    }

    socketLog(level, message, data = {}) {
        this.log(level, message, data, 'socket');
    }

    mediapipeLog(level, message, data = {}) {
        this.log(level, message, data, 'mediapipe');
    }

    networkLog(level, message, data = {}) {
        this.log(level, message, data, 'network');
    }

    /**
     * Wrap async functions with automatic error logging
     */
    async wrapAsync(fn, context = 'Unknown operation', category = 'general') {
        try {
            this.debug(`Starting: ${context}`, {}, category);
            const result = await fn();
            this.success(`Completed: ${context}`, {}, category);
            return result;
        } catch (error) {
            this.error(`Failed: ${context}`, { error }, category);
            throw error;
        }
    }

    /**
     * Log page load event
     */
    logPageLoad() {
        this.info('Page loaded', {
            url: window.location.href,
            referrer: document.referrer,
            timestamp: Date.now()
        }, 'general');
    }

    /**
     * Log page visibility changes
     */
    setupVisibilityTracking() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.warning('Page hidden', {}, 'general');
            } else {
                this.info('Page visible', {}, 'general');
            }
        });
    }

    /**
     * Log network status changes
     */
    setupNetworkTracking() {
        window.addEventListener('online', () => {
            this.success('Network connection restored', {
                connectionType: navigator.connection?.effectiveType || 'unknown',
                downlink: navigator.connection?.downlink || 'unknown',
                rtt: navigator.connection?.rtt || 'unknown'
            }, 'network');
        });

        window.addEventListener('offline', () => {
            // 🔍 CRÍTICO: Capturar máximo contexto cuando se pierde la red
            this.error('Network connection lost', {
                lastOnlineTime: new Date().toISOString(),
                connectionType: navigator.connection?.effectiveType || 'unknown',
                downlink: navigator.connection?.downlink || 'unknown',
                rtt: navigator.connection?.rtt || 'unknown',
                pageVisible: document.visibilityState === 'visible',
                batteryLevel: navigator.getBattery ? 'checking...' : 'unavailable'
            }, 'network');

            // Try to get battery info if available
            if (navigator.getBattery) {
                navigator.getBattery().then(battery => {
                    this.warning('Battery info at disconnect', {
                        level: Math.round(battery.level * 100) + '%',
                        charging: battery.charging
                    }, 'network');
                }).catch(() => {
                    // Silent fail
                });
            }
        });
    }

    /**
     * Cleanup before page unload
     */
    setupUnloadTracking() {
        window.addEventListener('beforeunload', () => {
            this.info('Page unloading', {}, 'general');
            this.flush(); // Final flush
            this.stopFlushInterval();
        });
    }

    /**
     * 🔍 Try to get sessionCode from DOM elements
     */
    tryGetSessionCodeFromDOM() {
        try {
            // Médico (hidden field): Máxima prioridad para persistencia
            const currentDoctorSessionCode = document.getElementById('currentDoctorSessionCode');
            if (currentDoctorSessionCode && currentDoctorSessionCode.value) {
                return currentDoctorSessionCode.value.trim().toUpperCase();
            }

            // Médico (visible display): Fallback si no hay hidden field
            const doctorCodeDisplay = document.getElementById('sessionCodeDisplay');
            if (doctorCodeDisplay && doctorCodeDisplay.textContent !== '------') {
                return doctorCodeDisplay.textContent.trim();
            }

            // Paciente (exam screen): buscar en currentSessionCode (hidden field)
            const currentSessionCode = document.getElementById('currentSessionCode');
            if (currentSessionCode && currentSessionCode.value) {
                return currentSessionCode.value.trim().toUpperCase();
            }

            // Paciente (login screen): buscar en sessionCode
            const patientCodeInput = document.getElementById('sessionCode');
            if (patientCodeInput && patientCodeInput.value) {
                return patientCodeInput.value.trim().toUpperCase();
            }

            // Buscar en cualquier elemento con data-session-code
            const sessionElement = document.querySelector('[data-session-code]');
            if (sessionElement) {
                return sessionElement.dataset.sessionCode;
            }
        } catch (error) {
            // Silent fail
        }
        return null;
    }

    /**
     * 🔍 Try to get sessionCode from URL parameters
     */
    tryGetSessionCodeFromURL() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const sessionCode = urlParams.get('session') ||
                              urlParams.get('codigo') ||
                              urlParams.get('code');
            if (sessionCode) {
                return sessionCode.toUpperCase();
            }
        } catch (error) {
            // Silent fail
        }
        return null;
    }

    /**
     * Initialize all automatic tracking
     */
    initializeTracking() {
        this.logPageLoad();
        this.setupVisibilityTracking();
        this.setupNetworkTracking();
        this.setupUnloadTracking();
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
}
