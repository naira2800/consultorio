'use strict';

/**
 * Diagnostico de envio por WhatsApp.
 *
 *   node scripts/wa-test.js +54911XXXXXXXX
 *
 * Muestra la configuracion detectada y, si el proveedor es "cloud", hace una
 * llamada directa a la Graph API imprimiendo la respuesta COMPLETA de Meta
 * (incluido el codigo de error si lo hubiera), que es justo lo que el servicio
 * normal no deja ver.
 */

require('dotenv').config();
const env = require('../src/config/env');

const to = (process.argv[2] || '').replace(/^whatsapp:/i, '').trim();

function mask(v) {
  if (!v) return '(vacio)';
  return `${v.slice(0, 6)}...${v.slice(-4)} (largo ${v.length})`;
}

console.log('================ Configuracion detectada ================');
console.log('WHATSAPP_PROVIDER      :', env.whatsapp.provider);
console.log('WHATSAPP_CLOUD_TOKEN   :', mask(env.whatsapp.cloud.token));
console.log('WHATSAPP_CLOUD_PHONE_ID:', env.whatsapp.cloud.phoneId || '(vacio)');
console.log('Destino (arg)          :', to || '(no pasaste numero)');
console.log('=========================================================\n');

if (env.whatsapp.provider !== 'cloud') {
  console.log('⚠  El proveedor NO es "cloud", es "' + env.whatsapp.provider + '".');
  console.log('   Por eso no llega nada real. En tu archivo .env pone:');
  console.log('     WHATSAPP_PROVIDER=cloud');
  console.log('   y volve a correr este script.\n');
  process.exit(0);
}

if (!env.whatsapp.cloud.token || !env.whatsapp.cloud.phoneId) {
  console.log('⚠  Falta el token y/o el phone number ID en el .env.');
  console.log('   Completa WHATSAPP_CLOUD_TOKEN y WHATSAPP_CLOUD_PHONE_ID.\n');
  process.exit(0);
}

if (!to) {
  console.log('⚠  Pasa el numero destino, por ejemplo:');
  console.log('     node scripts/wa-test.js +5491122334455\n');
  process.exit(0);
}

async function main() {
  const url = `https://graph.facebook.com/v20.0/${env.whatsapp.cloud.phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: 'hello_world', language: { code: 'en_US' } },
  };

  console.log('Enviando TEMPLATE hello_world a', to, '...\n');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.whatsapp.cloud.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  console.log('HTTP status:', res.status);
  console.log('Respuesta de Meta:\n', JSON.stringify(json, null, 2), '\n');

  if (res.ok && json.messages) {
    console.log('✅ Meta ACEPTO el TEMPLATE (id:', json.messages[0].id + ').');
    console.log('   Como es un template pre-aprobado, DEBERIA llegar al telefono aunque');
    console.log('   no haya conversacion previa. Revisa el WhatsApp del numero destino:');
    console.log('   te tiene que llegar un mensaje en ingles "Hello World".');
  } else {
    const err = json.error || {};
    console.log('❌ Meta RECHAZO el mensaje.');
    console.log('   code:', err.code, '| subcode:', err.error_subcode);
    console.log('   message:', err.message);
    console.log('\n   Interpretacion rapida:');
    if (err.code === 190) {
      console.log('   -> Token vencido/invalido. El token temporal dura 24 hs; genera uno nuevo.');
    } else if (err.code === 131030) {
      console.log('   -> El numero destino NO esta en la lista de destinatarios verificados.');
      console.log('      Agregalo en WhatsApp > API Setup > "To".');
    } else if (err.code === 131047 || err.code === 131051 || err.code === 131026) {
      console.log('   -> Necesitas iniciar la conversacion con un TEMPLATE (texto libre no');
      console.log('      permitido fuera de la ventana de 24 hs).');
    } else if (err.code === 100) {
      console.log('   -> Parametro invalido (revisa el phone number ID o el formato del numero).');
    }
  }
}

main().catch((e) => {
  console.error('Error de red al llamar a Meta:', e.message);
  process.exit(1);
});
