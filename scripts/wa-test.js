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
console.log('WHATSAPP_TEMPLATE_NAME :', env.whatsapp.cloud.templateName || '(vacio -> se prueba hello_world)');
console.log('WHATSAPP_TEMPLATE_LANG :', env.whatsapp.cloud.templateLang);
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

  // Si hay un template configurado, probamos ESE (con sus 3 variables), que es
  // el que usa la app de verdad. Si no, probamos el hello_world de ejemplo.
  const tplName = env.whatsapp.cloud.templateName;
  let payload;
  if (tplName) {
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: tplName,
        language: { code: env.whatsapp.cloud.templateLang },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Dra. Ana' },
              { type: 'text', text: 'Prueba de notificacion del consultorio.' },
              { type: 'text', text: 'https://ejemplo.com/link' },
            ],
          },
        ],
      },
    };
    console.log(`Enviando TU template "${tplName}" (${env.whatsapp.cloud.templateLang}) a`, to, '...\n');
  } else {
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: 'hello_world', language: { code: 'en_US' } },
    };
    console.log('Enviando TEMPLATE hello_world a', to, '...\n');
  }
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
    console.log('   Como es un template aprobado, DEBERIA llegar al telefono aunque no');
    console.log('   haya conversacion previa. Revisa el WhatsApp del numero destino.');
    console.log('   Si NO llega: fijate el estado del mensaje (a veces Meta lo marca como');
    console.log('   "failed" despues) o que el numero destino sea un WhatsApp real y verificado.');
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
    } else if (err.code === 132001) {
      console.log('   -> El template NO existe con ese NOMBRE o IDIOMA. Revisa que');
      console.log('      WHATSAPP_TEMPLATE_NAME y WHATSAPP_TEMPLATE_LANG coincidan EXACTO con');
      console.log('      lo aprobado en Meta (ojo: "es" vs "es_AR" son distintos).');
    } else if (err.code === 132000) {
      console.log('   -> La cantidad de variables NO coincide. El template debe tener 3');
      console.log('      variables {{1}} {{2}} {{3}} en el cuerpo. Si creaste otra cantidad,');
      console.log('      hay que ajustar el template o el codigo.');
    } else if (err.code === 132005 || err.code === 132007 || err.code === 132012) {
      console.log('   -> El contenido/formato de las variables no cumple la politica del');
      console.log('      template (ej. saltos de linea o formato invalido en una variable).');
    } else if (err.code === 131047 || err.code === 131051 || err.code === 131026) {
      console.log('   -> Mensaje no entregable / hay que reabrir conversacion con template.');
    } else if (err.code === 100) {
      console.log('   -> Parametro invalido (revisa el phone number ID o el formato del numero).');
    }
  }
}

main().catch((e) => {
  console.error('Error de red al llamar a Meta:', e.message);
  process.exit(1);
});
