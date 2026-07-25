'use strict';

/**
 * Lista los templates de WhatsApp tal como estan guardados en Meta, con su
 * NOMBRE, IDIOMA y ESTADO exactos. Sirve para copiar los valores sin typos a
 * WHATSAPP_TEMPLATE_NAME y WHATSAPP_TEMPLATE_LANG.
 *
 *   node scripts/wa-templates.js <WABA_ID>
 *
 * El WABA_ID (WhatsApp Business Account ID) figura en la pantalla
 * "WhatsApp > API Setup" de tu app en Meta (un numero largo, distinto del
 * Phone number ID). Tambien podes ponerlo en el .env como WHATSAPP_WABA_ID.
 */

require('dotenv').config();
const env = require('../src/config/env');

const wabaId = process.argv[2] || process.env.WHATSAPP_WABA_ID || '';
const token = env.whatsapp.cloud.token;

if (!token) {
  console.log('⚠  Falta WHATSAPP_CLOUD_TOKEN en el .env.');
  process.exit(0);
}
if (!wabaId) {
  console.log('⚠  Falta el WABA_ID (WhatsApp Business Account ID).');
  console.log('   Uso: node scripts/wa-templates.js <WABA_ID>');
  console.log('   Lo encontras en WhatsApp > API Setup (numero largo, NO el Phone number ID).');
  process.exit(0);
}

async function main() {
  const url =
    `https://graph.facebook.com/v20.0/${wabaId}/message_templates` +
    `?fields=name,language,status,category&limit=200`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.log('❌ Error al listar templates. HTTP', res.status);
    console.log(JSON.stringify(json, null, 2));
    if (json.error && json.error.code === 190) {
      console.log('\n-> Token vencido/invalido. Genera uno nuevo en API Setup.');
    }
    if (json.error && json.error.code === 100) {
      console.log('\n-> Revisa el WABA_ID (debe ser el WhatsApp Business Account ID).');
    }
    process.exit(1);
  }

  const list = json.data || [];
  if (list.length === 0) {
    console.log('No hay templates en esta cuenta.');
    return;
  }

  console.log('\n============== Templates en tu cuenta de Meta ==============');
  list.forEach((t) => {
    console.log('-----------------------------------------------------------');
    console.log('  NOMBRE (WHATSAPP_TEMPLATE_NAME):', t.name);
    console.log('  IDIOMA (WHATSAPP_TEMPLATE_LANG):', t.language);
    console.log('  Estado                         :', t.status);
    console.log('  Categoria                      :', t.category);
  });
  console.log('===========================================================\n');
  console.log('Copia EXACTAMENTE el NOMBRE y el IDIOMA de un template APPROVED');
  console.log('a tu .env (WHATSAPP_TEMPLATE_NAME y WHATSAPP_TEMPLATE_LANG).');
}

main().catch((e) => {
  console.error('Error de red al llamar a Meta:', e.message);
  process.exit(1);
});
