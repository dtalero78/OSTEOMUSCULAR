/**
 * Script para generar archivos de audio con Google Cloud Text-to-Speech
 *
 * Uso:
 * 1. Instalar: npm install @google-cloud/text-to-speech
 * 2. Configurar GOOGLE_APPLICATION_CREDENTIALS con tu service account key
 * 3. Ejecutar: node generate-audio.js
 */

const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const path = require('path');

// Lee las frases desde el JSON
const phrases = require('./audio-phrases.json');

// Cliente de Google Cloud TTS
const client = new textToSpeech.TextToSpeechClient();

// Configuración de voz
const voiceConfig = {
    languageCode: 'es-US',
    name: 'es-US-Neural2-A', // Voz femenina neuronal (muy natural)
    ssmlGender: 'FEMALE'
};

// Configuración de audio
const audioConfig = {
    audioEncoding: 'MP3',
    speakingRate: 0.85, // 15% más lento para mayor claridad
    pitch: 0.0,
    volumeGainDb: 0.0
};

// Crear directorio de salida
const outputDir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function generateAudio(text, filename) {
    const request = {
        input: { text },
        voice: voiceConfig,
        audioConfig: audioConfig
    };

    try {
        const [response] = await client.synthesizeSpeech(request);
        const outputPath = path.join(outputDir, filename);
        await util.promisify(fs.writeFile)(outputPath, response.audioContent, 'binary');
        console.log(`✅ Generado: ${filename} - "${text.substring(0, 50)}..."`);
        return true;
    } catch (error) {
        console.error(`❌ Error generando ${filename}:`, error.message);
        return false;
    }
}

async function generateAllAudios() {
    console.log('🎙️ Generando audios con Google Cloud TTS...\n');
    console.log(`Voz: ${voiceConfig.name} (femenina, español US)`);
    console.log(`Velocidad: ${audioConfig.speakingRate}x\n`);

    let total = 0;
    let success = 0;

    // System audios
    console.log('📢 System audios:');
    for (const [key, text] of Object.entries(phrases.system)) {
        total++;
        if (await generateAudio(text, `system_${key}.mp3`)) success++;
    }

    // Exam control audios
    console.log('\n📢 Exam control audios:');
    for (const [key, text] of Object.entries(phrases.exam_control)) {
        total++;
        if (await generateAudio(text, `exam_${key}.mp3`)) success++;
    }

    // Guided sequence audios
    console.log('\n📢 Guided sequence audios:');
    for (const [key, text] of Object.entries(phrases.guided_sequence)) {
        total++;
        if (await generateAudio(text, `guided_${key}.mp3`)) success++;
    }

    // Dynamic instructions
    console.log('\n📢 Dynamic instructions:');
    for (let i = 0; i < phrases.dynamic_instructions.length; i++) {
        const text = phrases.dynamic_instructions[i];
        total++;
        if (await generateAudio(text, `instruction_${i + 1}.mp3`)) success++;
    }

    console.log(`\n✅ Completado: ${success}/${total} archivos generados`);
    console.log(`📁 Ubicación: ${outputDir}`);

    // Mostrar tamaño total
    const files = fs.readdirSync(outputDir);
    let totalSize = 0;
    files.forEach(file => {
        const stats = fs.statSync(path.join(outputDir, file));
        totalSize += stats.size;
    });
    console.log(`📊 Tamaño total: ${(totalSize / 1024).toFixed(2)} KB`);
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
    generateAllAudios().catch(console.error);
}

module.exports = { generateAllAudios };
