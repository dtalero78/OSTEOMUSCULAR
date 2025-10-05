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
    }

    /**
     * Inicializar y pre-cargar todos los audios
     */
    async initialize() {
        if (this.isLoaded || this.isLoading) return;
        this.isLoading = true;

        console.log('🔊 AudioManager: Iniciando pre-carga de audios...');

        try {
            // Cargar mapa de audios
            const response = await fetch('/audio/audio-map.json');
            this.audioMap = await response.json();

            // Extraer todas las URLs
            const audioUrls = this.extractAllUrls(this.audioMap);
            console.log(`📥 Encontrados ${audioUrls.length} archivos de audio`);

            // Pre-cargar todos
            await this.preloadAll(audioUrls);

            this.isLoaded = true;
            this.isLoading = false;

            console.log('✅ AudioManager: Todos los audios pre-cargados');
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
            this.preloadAudio(url).then(() => {
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
                console.log(`  ✓ Cargado: ${url}`);
                resolve();
            }, { once: true });

            audio.addEventListener('error', (e) => {
                console.warn(`  ✗ Error: ${url}`, e);
                reject(e);
            }, { once: true });

            audio.preload = 'auto';
            audio.src = url;
            audio.load();
        });
    }

    /**
     * Reproducir audio por categoría y clave
     * @param {string} category - 'system', 'exam', 'guided', 'instructions'
     * @param {string} key - clave del audio en el mapa
     */
    play(category, key) {
        if (!this.usePreloaded || !this.isLoaded) {
            console.log(`🔊 AudioManager: Pre-carga no lista, usando fallback`);
            return null;
        }

        const url = this.audioMap?.[category]?.[key];
        if (!url) {
            console.warn(`⚠️ AudioManager: No encontrado ${category}.${key}`);
            return null;
        }

        const audio = this.audioCache.get(url);
        if (!audio) {
            console.warn(`⚠️ AudioManager: Audio no en cache ${url}`);
            return null;
        }

        // Clonar audio para permitir reproducción simultánea
        const audioClone = audio.cloneNode();
        audioClone.play().catch(err => {
            console.error('Error reproduciendo audio:', err);
        });

        console.log(`🔊 Reproduciendo: ${category}.${key}`);
        return audioClone;
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
            console.warn(`⚠️ AudioManager: Audio no en cache ${url}`);
            return null;
        }

        const audioClone = audio.cloneNode();
        audioClone.play().catch(err => {
            console.error('Error reproduciendo audio:', err);
        });

        return audioClone;
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
