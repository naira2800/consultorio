'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// --- Politicas de tamano (configurables por variables de entorno) ---
// Limite duro de subida: si el archivo supera esto, se rechaza.
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '10', 10);
// Para imagenes: se redimensionan a este ancho maximo y se recomprimen.
const IMAGE_MAX_WIDTH = parseInt(process.env.IMAGE_MAX_WIDTH || '2000', 10);
const IMAGE_QUALITY = parseInt(process.env.IMAGE_QUALITY || '75', 10);

const ALLOWED = ['.pdf', '.jpg', '.jpeg', '.png'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png'];

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED.includes(ext)) return cb(null, true);
  cb(new Error('Formato de archivo no permitido. Use PDF, JPG o PNG.'));
}

// Guardamos en memoria para poder comprimir antes de escribir a disco.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

function randomName(ext) {
  return `orden-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
}

/**
 * Procesa la orden medica recien subida (req.file en memoria):
 *  - Imagenes (JPG/PNG): las reorienta, redimensiona a IMAGE_MAX_WIDTH y
 *    recomprime a JPEG (achica mucho una foto de celular sin perder legibilidad).
 *  - PDF: se guarda tal cual (no se recomprime).
 * Deja el archivo en disco y setea req.file.filename para el resto del flujo.
 */
async function processMedicalOrder(req, res, next) {
  if (!req.file) return next();
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let outName;
    let outBuffer;

    if (IMAGE_EXTS.includes(ext)) {
      outName = randomName('.jpg');
      outBuffer = await sharp(req.file.buffer)
        .rotate() // respeta la orientacion de la foto (EXIF)
        .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: IMAGE_QUALITY })
        .toBuffer();
    } else {
      // PDF u otros permitidos: se guardan sin modificar.
      outName = randomName(ext);
      outBuffer = req.file.buffer;
    }

    await fs.promises.writeFile(path.join(UPLOAD_DIR, outName), outBuffer);
    req.file.filename = outName;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware completo para el formulario: recibe el archivo, valida tamano y
 * formato, y lo procesa (comprime imagenes). Traduce el error de "archivo muy
 * grande" a un mensaje claro para el paciente.
 */
function uploadMedicalOrder(req, res, next) {
  upload.single('medical_order')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        err.status = 400;
        err.message =
          `El archivo supera el limite de ${MAX_UPLOAD_MB} MB. ` +
          'Suba uno mas liviano (puede sacar la foto con menor calidad).';
      } else if (err.status === undefined) {
        err.status = 400;
      }
      return next(err);
    }
    processMedicalOrder(req, res, next);
  });
}

module.exports = { upload, uploadMedicalOrder, processMedicalOrder, UPLOAD_DIR, MAX_UPLOAD_MB };
