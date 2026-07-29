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
  // Nombre exacto opcional como 3er argumento: node wa-set-template.js <WABA> <nombre>
  const wantedName = process.argv[3];

  const approved = all.filter((t) => t.status === 'APPROVED' && t.name !== 'hello_world');

  if (approved.length === 0) {
    console.log('❌ No hay templates APPROVED (aparte de hello_world) en esta cuenta.');
    console.log('   Templates encontrados (con su estado):');
    all.forEach((t) => console.log(`   - ${t.name} (${t.language}) ${t.status}`));
    console.log('\n   Si el tuyo figura como PENDING, espera a que Meta lo apruebe.');
    process.exit(1);
  }

  // Eleccion del template:
  //  1) el nombre exacto pasado por argumento, si se indico;
  //  2) el que contenga "consultorio" (el de esta app), ignorando los de ejemplo;
  //  3) como ultimo recurso, el primero aprobado.
  let chosen;
  if (wantedName) {
    chosen = approved.find((t) => t.name === wantedName);
    if (!chosen) {
      console.log(`❌ No se encontro un template APPROVED llamado "${wantedName}".`);
      console.log('   Aprobados disponibles:');
      approved.forEach((t) => console.log(`   - ${t.name} (${t.language})`));
      process.exit(1);
    }
  } else {
    chosen =
      approved.find((t) => /consultorio/i.test(t.name)) ||
      approved.find((t) => !/^jaspers_market/i.test(t.name)) ||
      approved[0];
  }

  if (approved.length > 1) {
    console.log('ℹ  Templates aprobados en la cuenta (se eligio el marcado con ->):');
    approved.forEach((t) => console.log(`   ${t.name === chosen.name ? '->' : '  '} ${t.name} (${t.language})`));
    console.log('');
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
