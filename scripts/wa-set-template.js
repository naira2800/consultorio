'use strict';

/**
 * Configura automaticamente el template en el .env, tomando el NOMBRE y el
 * IDIOMA EXACTOS desde Meta (via API). Asi se elimina cualquier error de tipeo
 * (guiones bajos, idioma, etc.).
 *
 *   node scripts/wa-set-template.js <WABA_ID>
 *
 * Elige el primer template APPROVED que no sea "hello_world" y escribe en .env:
 *   WHATSAPP_PROVIDER=cloud
 *   WHATSAPP_TEMPLATE_NAME=<nombre exacto>
 *   WHATSAPP_TEMPLATE_LANG=<idioma exacto>
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const env = require('../src/config/env');

const wabaId = process.argv[2] || process.env.WHATSAPP_WABA_ID || '';
const token = env.whatsapp.cloud.token;
const ENV_PATH = path.join(__dirname, '..', '.env');

if (!token) {
  console.log('⚠  Falta WHATSAPP_CLOUD_TOKEN en el .env.');
  process.exit(1);
}
if (!wabaId) {
  console.log('⚠  Uso: node scripts/wa-set-template.js <WABA_ID>');
  console.log('   El WABA_ID esta en WhatsApp > Paso 1 (numero largo).');
  process.exit(1);
}

/**
 * Inserta o reemplaza una variable en el contenido de un .env.
 */
function upsertEnv(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, line);
  return content.replace(/\n?$/, `\n${line}\n`);
}

async function main() {
  const url =
    `https://graph.facebook.com/v20.0/${wabaId}/message_templates` +
    `?fields=name,language,status&limit=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.log('❌ Error al consultar Meta. HTTP', res.status);
    console.log(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  const all = json.data || [];
  const approved = all.filter((t) => t.status === 'APPROVED' && t.name !== 'hello_world');

  if (approved.length === 0) {
    console.log('❌ No hay templates APPROVED (aparte de hello_world) en esta cuenta.');
    console.log('   Templates encontrados:');
    all.forEach((t) => console.log(`   - ${t.name} (${t.language}) ${t.status}`));
    process.exit(1);
  }

  // Si hay mas de uno, usamos el primero pero avisamos.
  const chosen = approved[0];
  if (approved.length > 1) {
    console.log('ℹ  Hay varios templates aprobados; se usa el primero:');
    approved.forEach((t, i) => console.log(`   ${i === 0 ? '->' : '  '} ${t.name} (${t.language})`));
  }

  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  content = upsertEnv(content, 'WHATSAPP_PROVIDER', 'cloud');
  content = upsertEnv(content, 'WHATSAPP_TEMPLATE_NAME', chosen.name);
  content = upsertEnv(content, 'WHATSAPP_TEMPLATE_LANG', chosen.language);
  fs.writeFileSync(ENV_PATH, content);

  console.log('\n✅ .env actualizado con los valores EXACTOS de Meta:');
  console.log('   WHATSAPP_PROVIDER=cloud');
  console.log(`   WHATSAPP_TEMPLATE_NAME=${chosen.name}`);
  console.log(`   WHATSAPP_TEMPLATE_LANG=${chosen.language}`);
  console.log('\nAhora proba:  node scripts/wa-test.js +543487645439');
}

main().catch((e) => {
  console.error('Error de red al llamar a Meta:', e.message);
  process.exit(1);
});
