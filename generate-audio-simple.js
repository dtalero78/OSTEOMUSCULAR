/**
 * Script simplificado para generar audios usando servicio gratuito
 * Usa ResponsiveVoice API o similar
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const phrases = require('./audio-phrases.json');

// Crear directorio
const outputDir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log('📝 Instrucciones para generar audios:\n');
console.log('Como no tenemos acceso directo a Google Cloud TTS, usa una de estas opciones:\n');

console.log('OPCIÓN 1 - Google Cloud TTS (Recomendada):');
console.log('1. Ve a: https://cloud.google.com/text-to-speech');
console.log('2. Usa la herramienta de prueba');
console.log('3. Configuración:');
console.log('   - Idioma: Spanish (US)');
console.log('   - Voz: es-US-Neural2-A (femenina)');
console.log('   - Velocidad: 0.85');
console.log('4. Para cada frase:');

let counter = 1;

console.log('\n--- SYSTEM AUDIOS ---');
for (const [key, text] of Object.entries(phrases.system)) {
    console.log(`${counter++}. "${text}"`);
    console.log(`   → Guardar como: system_${key}.mp3\n`);
}

console.log('--- EXAM CONTROL ---');
for (const [key, text] of Object.entries(phrases.exam_control)) {
    console.log(`${counter++}. "${text}"`);
    console.log(`   → Guardar como: exam_${key}.mp3\n`);
}

console.log('--- GUIDED SEQUENCE ---');
for (const [key, text] of Object.entries(phrases.guided_sequence)) {
    console.log(`${counter++}. "${text}"`);
    console.log(`   → Guardar como: guided_${key}.mp3\n`);
}

console.log('--- DYNAMIC INSTRUCTIONS ---');
phrases.dynamic_instructions.forEach((text, i) => {
    console.log(`${counter++}. "${text}"`);
    console.log(`   → Guardar como: instruction_${i + 1}.mp3\n`);
});

console.log('\nOPCIÓN 2 - TTSMaker (Gratis):');
console.log('1. Ve a: https://ttsmaker.com');
console.log('2. Selecciona: Spanish (Latin America) - Female');
console.log('3. Velocidad: Slow');
console.log('4. Copia cada texto y descarga el MP3');

console.log('\nOPCIÓN 3 - Usar script automatizado (si tienes API key):');
console.log('1. Obtén API key de: https://cloud.google.com/text-to-speech');
console.log('2. export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"');
console.log('3. npm install @google-cloud/text-to-speech');
console.log('4. node generate-audio.js');

console.log(`\n📁 Guardar todos los archivos en: ${outputDir}`);
console.log(`📊 Total de archivos: ${counter - 1}`);
