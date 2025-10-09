/**
 * AudioManager - Sistema de pre-carga y reproducción de audios
 * Pre-carga todos los MP3 al conectarse para uso offline
 */

class AudioManager {
    constructor() {
        this.audioCache = new Map();
        this.audioMap = null;
        this.isLoaded = false;
        this.isLoading = false;
        this.usePreloaded = true; // true = MP3, false = fallback speechSynthesis
        this.onLoadComplete = null;
        this.onLoadProgress = null;

        // Debug mode (activar con ?debug en URL)
        this.debugMode = new URLSearchParams(window.location.search).has('debug');
    }

    /**
     * Inicializar y pre-cargar todos los audios
     */
    async initialize() {
        if (this.isLoaded || this.isLoading) return;
        this.isLoading = true;

        if (this.debugMode) console.log('🔊 AudioManager: Iniciando pre-carga de audios...');

        try {
            // Cargar mapa de audios
            const response = await fetch('/audio/audio-map.json');
            this.audioMap = await response.json();

            // Extraer todas las URLs
            const audioUrls = this.extractAllUrls(this.audioMap);
            if (this.debugMode) console.log(`📥 Encontrados ${audioUrls.length} archivos de audio`);

            // Pre-cargar todos
            await this.preloadAll(audioUrls);

            this.isLoaded = true;
            this.isLoading = false;

            if (this.debugMode) console.log('✅ AudioManager: Todos los audios pre-cargados');
            if (this.onLoadComplete) this.onLoadComplete();

        } catch (error) {
            console.warn('⚠️ AudioManager: Error cargando audios, usando fallback:', error);
            this.usePreloaded = false;
            this.isLoading = false;
        }
    }

    /**
     * Extraer todas las URLs del mapa
     */
    extractAllUrls(obj) {
        const urls = [];
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                urls.push(obj[key]);
            } else if (typeof obj[key] === 'object') {
                urls.push(...this.extractAllUrls(obj[key]));
            }
        }
        return [...new Set(urls)]; // Eliminar duplicados
    }

    /**
     * Pre-cargar todos los archivos de audio
     */
    async preloadAll(urls) {
        const promises = urls.map((url, index) =>
            this.preloadAudio(url)
                .then(() => {
                    const progress = ((index + 1) / urls.length) * 100;
                    if (this.onLoadProgress) {
                        this.onLoadProgress(progress, index + 1, urls.length);
                    }
                })
                .catch(() => {
                    // NO detener carga completa si un audio falla
                    if (this.debugMode) console.warn(`  ⚠️ Omitido: ${url}`);
                    const progress = ((index + 1) / urls.length) * 100;
                    if (this.onLoadProgress) {
                        this.onLoadProgress(progress, index + 1, urls.length);
                    }
                })
        );

        await Promise.all(promises);
    }

    /**
     * Pre-cargar un archivo de audio individual
     */
    preloadAudio(url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();

            audio.addEventListener('canplaythrough', () => {
                this.audioCache.set(url, audio);
                if (this.debugMode) console.log(`  ✓ Cargado: ${url}`);
                resolve();
            }, { once: true });

            audio.addEventListener('error', (e) => {
                if (this.debugMode) console.warn(`  ✗ Error: ${url}`, e);
                reject(e);
            }, { once: true });

            audio.preload = 'auto';
            audio.src = url;
            audio.load();
        });
    }

    /**
     * Desbloquear todos los audios en iOS (debe llamarse en interacción de usuario)
     * Pausar síncronamente ANTES de que empiece a reproducirse
     */
    unlockAll() {
        if (!this.isLoaded) {
            if (this.debugMode) console.log('⏳ AudioManager: Esperando pre-carga para desbloquear');
            return Promise.resolve(false);
        }

        if (this.debugMode) console.log('🔓 Desbloqueando todos los audios para iOS...');
        let unlockedCount = 0;

        // Iterar y pausar INMEDIATAMENTE después de play()
        for (const [, audio] of this.audioCache.entries()) {
            try {
                audio.volume = 0; // Silenciar por si acaso
                audio.currentTime = 0;

                // Invocar play() y pausar EN LA MISMA LÍNEA (síncrono)
                audio.play().catch(() => {}); // Ignorar errores
                audio.pause(); // Pausar inmediatamente (síncrono)
                audio.currentTime = 0; // Reset
                audio.volume = 1.0; // Restaurar volumen

                unlockedCount++;
            } catch (err) {
                // Ignorar errores individuales
            }
        }

        if (this.debugMode) console.log(`✅ ${unlockedCount}/${this.audioCache.size} audios desbloqueados (silenciosamente)`);
        return Promise.resolve(unlockedCount > 0);
    }

    /**
     * Reproducir audio por categoría y clave
     * @param {string} category - 'system', 'exam', 'guided', 'instructions'
     * @param {string} key - clave del audio en el mapa
     */
    async play(category, key) {
        if (!this.usePreloaded || !this.isLoaded) {
            if (this.debugMode) console.log(`🔊 AudioManager: Pre-carga no lista, usando fallback`);
            return false;
        }

        const url = this.audioMap?.[category]?.[key];
        if (!url) {
            if (this.debugMode) console.warn(`⚠️ AudioManager: No encontrado ${category}.${key}`);
            return false;
        }

        const audio = this.audioCache.get(url);
        if (!audio) {
            if (this.debugMode) console.warn(`⚠️ AudioManager: Audio no en cache ${url}`);
            return false;
        }

        // En iOS, no podemos clonar. Reiniciamos y reproducimos el mismo elemento
        audio.currentTime = 0; // Reiniciar al inicio
        audio.volume = 1.0; // Asegurar volumen completo

        try {
            await audio.play();
            if (this.debugMode) console.log(`✅ MP3 reproducido: ${category}.${key}`);
            return true; // Éxito
        } catch (err) {
            // iOS Safari bloquea autoplay - retornar false para fallback
            if (this.debugMode) console.warn(`⚠️ MP3 bloqueado (${err.name}), usando fallback`);
            return false;
        }
    }

    /**
     * Reproducir audio por URL directa
     */
    playUrl(url) {
        if (!this.usePreloaded || !this.isLoaded) {
            return null;
        }

        const audio = this.audioCache.get(url);
        if (!audio) {
            if (this.debugMode) console.warn(`⚠️ AudioManager: Audio no en cache ${url}`);
            return null;
        }

        // En iOS, no podemos clonar. Reiniciamos y reproducimos el mismo elemento
        audio.currentTime = 0;
        audio.play().catch(err => {
            console.error('Error reproduciendo audio:', err);
        });

        return audio;
    }

    /**
     * Detener todos los audios en reproducción
     */
    stopAll() {
        // Los clones se detienen automáticamente al terminar
        // Este método está para compatibilidad futura
    }

    /**
     * Verificar si está listo para usar
     */
    isReady() {
        return this.isLoaded && this.usePreloaded;
    }

    /**
     * Obtener estadísticas de carga
     */
    getStats() {
        return {
            loaded: this.isLoaded,
            usePreloaded: this.usePreloaded,
            cachedCount: this.audioCache.size,
            totalUrls: this.audioMap ? this.extractAllUrls(this.audioMap).length : 0
        };
    }
}

// Exportar como singleton
const audioManager = new AudioManager();

// Para uso en módulos ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = audioManager;
}
