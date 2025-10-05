/**
 * Mapea textos dinámicos a archivos de audio pre-grabados
 */

const textToAudioMap = {
    // System
    'Audio activado': { category: 'system', key: 'audio_activado' },
    'Audio de instrucciones activado': { category: 'system', key: 'audio_instrucciones_activado' },

    // Exam control
    'El médico ha iniciado el examen. Manténgase en posición.': { category: 'exam', key: 'examen_iniciado' },
    'El examen ha finalizado. Puede relajarse.': { category: 'exam', key: 'examen_finalizado' },
    'Secuencia completada. Excelente trabajo.': { category: 'exam', key: 'secuencia_completada' },

    // Guided sequence
    'Prepárese para el examen. Colóquese de pie frente a la cámara y quédese completamente quieto. Tiene 20 segundos.': { category: 'guided', key: 'preparacion' },
    'Colóquese de pie, relajado, con los brazos a los costados. Mire hacia la cámara.': { category: 'guided', key: 'posicion_inicial' },
    'Mantenga la cabeza erguida y mire directamente a la cámara. Respiración normal.': { category: 'guided', key: 'cabeza_erguida' },
    'Levante lentamente ambos brazos hacia los lados hasta la altura de los hombros.': { category: 'guided', key: 'brazos_horizontal' },
    'Ahora levante los brazos completamente por encima de la cabeza.': { category: 'guided', key: 'brazos_arriba' },
    'Baje los brazos y déjelos caer naturalmente a los costados. No fuerce la posición.': { category: 'guided', key: 'brazos_bajar' },
    'Mantenga esta posición. Analizaremos la simetría de sus hombros y caderas.': { category: 'guided', key: 'analisis_simetria' },
    'Perfecto. Mantenga esta posición mientras capturamos los datos finales.': { category: 'guided', key: 'captura_final' },

    // Dynamic instructions (búsqueda fuzzy)
    'más cerca': { category: 'instructions', key: 'mas_cerca' },
    'retroceda': { category: 'instructions', key: 'retroceda' },
    'derecha': { category: 'instructions', key: 'derecha' },
    'izquierda': { category: 'instructions', key: 'izquierda' },
    'perfecto': { category: 'instructions', key: 'perfecto_posicion' },
    'relaje': { category: 'instructions', key: 'relaje_hombros' },
    'enderece': { category: 'instructions', key: 'enderece_espalda' },
    'mire': { category: 'instructions', key: 'mire_frente' }
};

/**
 * Buscar audio correspondiente a un texto
 * @param {string} text - Texto a reproducir
 * @returns {object|null} - { category, key } o null si no hay match
 */
function findAudioForText(text) {
    if (!text) return null;

    const normalizedText = text.trim();

    // Búsqueda exacta
    if (textToAudioMap[normalizedText]) {
        return textToAudioMap[normalizedText];
    }

    // Búsqueda fuzzy (para instrucciones dinámicas)
    const lowerText = normalizedText.toLowerCase();
    for (const [key, value] of Object.entries(textToAudioMap)) {
        if (key.length < 20 && lowerText.includes(key.toLowerCase())) {
            return value;
        }
    }

    return null;
}

// Para uso en módulos ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { textToAudioMap, findAudioForText };
}
