/**
 * Script de Diagnóstico de Credenciales de Twilio
 * Verifica que las credenciales estén correctamente configuradas
 */

require('dotenv').config();
const twilio = require('twilio');

console.log('🔍 DIAGNÓSTICO DE CREDENCIALES DE TWILIO\n');
console.log('═══════════════════════════════════════════\n');

// 1. Verificar que las variables existan
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

console.log('📋 Variables de Entorno:\n');
console.log(`TWILIO_ACCOUNT_SID: ${accountSid ? '✅ Definido (' + accountSid.substring(0, 10) + '...)' : '❌ NO DEFINIDO'}`);
console.log(`TWILIO_AUTH_TOKEN: ${authToken ? '✅ Definido (' + authToken.substring(0, 10) + '...)' : '❌ NO DEFINIDO'}`);
console.log(`TWILIO_API_KEY_SID: ${apiKeySid ? '✅ Definido (' + apiKeySid.substring(0, 10) + '...)' : '❌ NO DEFINIDO'}`);
console.log(`TWILIO_API_KEY_SECRET: ${apiKeySecret ? '✅ Definido (' + apiKeySecret.substring(0, 10) + '...)' : '❌ NO DEFINIDO'}`);
console.log('');

// 2. Validar formato de credenciales
console.log('🔍 Validación de Formato:\n');

if (accountSid && accountSid.startsWith('AC')) {
    console.log('✅ TWILIO_ACCOUNT_SID tiene formato correcto (AC...)');
} else {
    console.log('❌ TWILIO_ACCOUNT_SID tiene formato INCORRECTO (debe empezar con AC)');
}

if (apiKeySid && apiKeySid.startsWith('SK')) {
    console.log('✅ TWILIO_API_KEY_SID tiene formato correcto (SK...)');
} else if (apiKeySid) {
    console.log('❌ TWILIO_API_KEY_SID tiene formato INCORRECTO (debe empezar con SK)');
} else {
    console.log('⚠️ TWILIO_API_KEY_SID no definido (se usará Auth Token como fallback)');
}

console.log('');

// 3. Intentar generar un token de prueba
console.log('🧪 Prueba de Generación de Token:\n');

try {
    const AccessToken = twilio.jwt.AccessToken;
    const VideoGrant = AccessToken.VideoGrant;

    // Usar API Key si está disponible, sino usar Auth Token
    const useApiKey = apiKeySid && apiKeySecret;
    const signingKeySid = useApiKey ? apiKeySid : accountSid;
    const signingKeySecret = useApiKey ? apiKeySecret : authToken;

    console.log(`🔑 Método de firma: ${useApiKey ? 'API Key (RECOMENDADO)' : 'Auth Token (FALLBACK)'}`);
    console.log('');

    // Crear token de prueba
    const token = new AccessToken(accountSid, signingKeySid, signingKeySecret, {
        identity: 'test-user',
        ttl: 14400
    });

    const videoGrant = new VideoGrant({
        room: 'test-room'
    });

    token.addGrant(videoGrant);

    const jwt = token.toJwt();
    console.log('✅ Token generado exitosamente!');
    console.log('');
    console.log('📝 Token JWT (primeros 50 caracteres):');
    console.log(jwt.substring(0, 50) + '...');
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('✅ TODAS LAS CREDENCIALES SON VÁLIDAS');
    console.log('═══════════════════════════════════════════');

} catch (error) {
    console.error('❌ ERROR AL GENERAR TOKEN:');
    console.error('');
    console.error(`Nombre del error: ${error.name}`);
    console.error(`Mensaje: ${error.message}`);
    console.error('');
    console.error('═══════════════════════════════════════════');
    console.error('❌ CREDENCIALES INVÁLIDAS O MAL CONFIGURADAS');
    console.error('═══════════════════════════════════════════');
    console.error('');
    console.error('🔧 SOLUCIONES:');
    console.error('');
    console.error('1. Verificar que TWILIO_ACCOUNT_SID empiece con "AC"');
    console.error('2. Verificar que TWILIO_API_KEY_SID empiece con "SK"');
    console.error('3. Asegurarse de que API Key y Secret pertenezcan a la misma cuenta');
    console.error('4. Revisar que no haya espacios en blanco al inicio/final de las credenciales');
    console.error('5. Verificar en Twilio Console que las credenciales sean correctas:');
    console.error('   https://console.twilio.com/');
    console.error('');
    console.error('📚 Documentación:');
    console.error('   https://www.twilio.com/docs/iam/access-tokens');
    console.error('');
}

// 4. Intentar validar credenciales con API de Twilio
console.log('');
console.log('🌐 Validación con API de Twilio:\n');

if (accountSid && authToken) {
    try {
        const client = twilio(accountSid, authToken);

        // Intentar obtener información de la cuenta
        client.api.accounts(accountSid).fetch()
            .then(account => {
                console.log('✅ Conexión exitosa con Twilio API');
                console.log('');
                console.log(`📋 Información de la Cuenta:`);
                console.log(`   Nombre: ${account.friendlyName}`);
                console.log(`   SID: ${account.sid}`);
                console.log(`   Estado: ${account.status}`);
                console.log('');
                console.log('═══════════════════════════════════════════');
                console.log('✅ CREDENCIALES AUTH TOKEN VÁLIDAS');
                console.log('═══════════════════════════════════════════');
            })
            .catch(apiError => {
                console.error('❌ Error conectando a Twilio API:');
                console.error(`   ${apiError.message}`);
                console.error('');
                console.error('⚠️ TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN son incorrectos');
                console.error('');
                console.error('🔧 Solución:');
                console.error('   1. Ve a https://console.twilio.com/');
                console.error('   2. Copia Account SID y Auth Token correctos');
                console.error('   3. Actualiza el archivo .env');
            });
    } catch (error) {
        console.error('❌ Error creando cliente de Twilio:');
        console.error(`   ${error.message}`);
    }
} else {
    console.log('⚠️ No se puede validar: TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN faltantes');
}
