/**
 * WhatsApp Notifier Service
 * Sends critical logs to administrator via WhatsApp API
 */

const fetch = require('node-fetch');

const ADMIN_PHONE = '573008021701';
const WHAPI_URL = 'https://gate.whapi.cloud/messages/text';
const WHAPI_TOKEN = 'due3eWCwuBM2Xqd6cPujuTRqSbMb68lt';

class WhatsAppNotifier {
    constructor() {
        this.messageQueue = [];
        this.isSending = false;
        this.lastSentTime = 0;
        this.minInterval = 10000; // Minimum 10 seconds between messages
    }

    /**
     * Send text message via WhatsApp API
     */
    async sendTextMessage(toNumber, messageBody) {
        const headers = {
            'accept': 'application/json',
            'authorization': `Bearer ${WHAPI_TOKEN}`,
            'content-type': 'application/json'
        };

        const postData = {
            'typing_time': 0,
            'to': toNumber,
            'body': messageBody
        };

        try {
            const response = await fetch(WHAPI_URL, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(postData)
            });

            const json = await response.json();
            console.log('✅ WhatsApp message sent:', json);
            return json;
        } catch (err) {
            console.error('❌ WhatsApp send error:', err);
            throw err;
        }
    }

    /**
     * Queue critical event for WhatsApp notification
     */
    queueNotification(event) {
        // Only send critical events
        if (event.level === 'error' || event.level === 'critical') {
            this.messageQueue.push(event);
            this.processQueue();
        }
    }

    /**
     * Process message queue with rate limiting
     */
    async processQueue() {
        if (this.isSending || this.messageQueue.length === 0) {
            return;
        }

        const now = Date.now();
        if (now - this.lastSentTime < this.minInterval) {
            // Wait before sending next message
            setTimeout(() => this.processQueue(), this.minInterval);
            return;
        }

        this.isSending = true;

        try {
            // Get up to 5 messages to batch
            const batch = this.messageQueue.splice(0, 5);
            const message = this.formatBatchMessage(batch);

            await this.sendTextMessage(ADMIN_PHONE, message);
            this.lastSentTime = Date.now();
        } catch (error) {
            console.error('Failed to send WhatsApp batch:', error);
        } finally {
            this.isSending = false;

            // Process remaining messages
            if (this.messageQueue.length > 0) {
                setTimeout(() => this.processQueue(), this.minInterval);
            }
        }
    }

    /**
     * Format multiple events into single message
     */
    formatBatchMessage(events) {
        const timestamp = new Date().toLocaleString('es-CO', {
            timeZone: 'America/Bogota',
            hour12: false
        });

        let message = `🚨 *LOGS TELEMEDICINA*\n`;
        message += `📅 ${timestamp}\n\n`;

        events.forEach((event, index) => {
            const icon = event.level === 'error' ? '❌' : '⚠️';
            message += `${icon} *${event.userType}* (${event.sessionCode})\n`;
            message += `   ${event.message}\n`;
            if (event.details) {
                message += `   Detalles: ${event.details}\n`;
            }
            if (index < events.length - 1) {
                message += `\n`;
            }
        });

        return message;
    }

    /**
     * Send immediate critical alert (bypasses queue)
     */
    async sendCriticalAlert(sessionCode, userType, message, details = null) {
        const timestamp = new Date().toLocaleString('es-CO', {
            timeZone: 'America/Bogota',
            hour12: false
        });

        let alert = `🔴 *ALERTA CRÍTICA*\n`;
        alert += `📅 ${timestamp}\n`;
        alert += `👤 ${userType}: ${sessionCode}\n\n`;
        alert += `${message}`;

        if (details) {
            alert += `\n\n📋 Detalles:\n${details}`;
        }

        try {
            await this.sendTextMessage(ADMIN_PHONE, alert);
        } catch (error) {
            console.error('Failed to send critical alert:', error);
        }
    }

    /**
     * Send session summary
     */
    async sendSessionSummary(sessionCode, logs) {
        const timestamp = new Date().toLocaleString('es-CO', {
            timeZone: 'America/Bogota',
            hour12: false
        });

        const errors = logs.filter(l => l.level === 'error');
        const warnings = logs.filter(l => l.level === 'warning');

        if (errors.length === 0 && warnings.length === 0) {
            return; // Don't send if session was successful
        }

        let message = `📊 *RESUMEN SESIÓN*\n`;
        message += `📅 ${timestamp}\n`;
        message += `🔑 Código: ${sessionCode}\n\n`;
        message += `❌ Errores: ${errors.length}\n`;
        message += `⚠️ Advertencias: ${warnings.length}\n\n`;

        if (errors.length > 0) {
            message += `*Errores principales:*\n`;
            errors.slice(0, 3).forEach(err => {
                message += `• ${err.message}\n`;
            });
        }

        try {
            await this.sendTextMessage(ADMIN_PHONE, message);
        } catch (error) {
            console.error('Failed to send session summary:', error);
        }
    }
}

// Export singleton instance
const notifier = new WhatsAppNotifier();
module.exports = notifier;
