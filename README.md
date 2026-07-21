# Consultorio Médico — Gestión de turnos con WhatsApp

Aplicación en **Node.js + Express + MySQL** para gestionar los turnos de un
consultorio médico. La particularidad es que **el paciente realiza todas las
acciones a través de WhatsApp**: se comunica por WhatsApp, completa un
formulario web, y luego elige su horario desde un enlace que también recibe por
WhatsApp.

---

## Requisitos cubiertos

1. **Registro de usuarios (pacientes)** — al enviar el formulario se crea o
   actualiza el paciente (identificado por su número de WhatsApp).
2. **Registro de turnos** — el paciente elige un horario disponible del
   profesional y el turno queda confirmado.
3. **Cambiar / anular turno con 24 hs de anticipación** — regla de negocio
   validada tanto al reprogramar como al anular.
4. **Reporte diario de turnos del día siguiente** — un job programado arma la
   lista por profesional y la envía por **email y/o WhatsApp**.

### Flujo del paciente (por WhatsApp)

1. El paciente escribe por WhatsApp → un mensaje automático responde:
   > *"Complete los datos en el formulario y el profesional seleccionado lo
   > contactará dentro de las 48 hs. Muchas gracias!"* + link al formulario.
2. El formulario pregunta primero si es **paciente nuevo o existente**, toma sus
   datos y permite **adjuntar la orden médica**; al enviar (submit) se crea la
   solicitud.
3. Se **notifica al profesional por WhatsApp** con un link para revisar los datos
   y la orden médica.
4. El profesional habilita horarios y se le envía al paciente **un link con la
   grilla de horarios disponibles** para que elija el deseado. Al elegir, el
   turno queda registrado.

---

## Arquitectura

```
src/
├── server.js            # Arranque: valida DB, programa el job, levanta Express
├── app.js               # Configuración de Express, vistas y middlewares
├── config/              # Variables de entorno y pool de MySQL
├── models/              # Acceso a datos (patients, professionals, requests, slots, appointments)
├── controllers/         # Lógica de cada endpoint
├── routes/              # Definición de rutas
├── services/            # WhatsApp, email, notificaciones y reportes
├── jobs/                # Job cron del reporte diario
├── middleware/          # Subida de archivos (multer)
└── utils/               # Formato de fechas y armado de links
views/                   # Plantillas EJS (formulario, revisión, grilla, gestión)
public/css/              # Estilos
db/                      # schema.sql y seed.sql
scripts/                 # init-db y ejecución manual del reporte
uploads/                 # Órdenes médicas subidas (no versionado)
```

### Proveedores de WhatsApp soportados

La capa de WhatsApp está desacoplada (`src/services/whatsappService.js`) y admite:

- `twilio` — API de WhatsApp de Twilio.
- `cloud` — WhatsApp Cloud API de Meta.
- `log` — **modo por defecto**: no envía nada, imprime el mensaje en consola.
  Ideal para desarrollar y probar el flujo completo sin credenciales.

De igual forma, si no se configura SMTP los emails se imprimen en consola.

---

## Puesta en marcha

### 1. Requisitos

- Node.js 18+ (usa `fetch` nativo)
- MySQL 8+

### 2. Instalación

```bash
npm install
cp .env.example .env       # y complete los valores
```

### 3. Base de datos

```bash
npm run db:init -- --seed  # crea la BD, las tablas y datos de ejemplo
```

> El flag `--seed` carga 3 profesionales y horarios disponibles para probar.

### 4. Ejecutar

```bash
npm start          # o: npm run dev  (recarga automática)
```

La app queda disponible en `http://localhost:3000`.

---

## Configuración del webhook de WhatsApp

Apunte el webhook de su proveedor a:

```
POST  {APP_BASE_URL}/webhook/whatsapp
GET   {APP_BASE_URL}/webhook/whatsapp   (verificación de Meta Cloud API)
```

Cualquier mensaje entrante dispara la respuesta automática con el link al
formulario. En **desarrollo** puede simular un mensaje entrante:

```bash
# Simula un mensaje entrante estilo Twilio
curl -X POST http://localhost:3000/webhook/whatsapp \
  -d "From=whatsapp:+5491122334455" -d "Body=Hola"
```

En modo `log` verá en consola el mensaje de bienvenida que se le enviaría al
paciente, incluyendo el link al formulario.

---

## Reporte diario de turnos (requisito 4)

Se ejecuta automáticamente según `DAILY_REPORT_CRON` (por defecto **20:00**) y
envía a cada profesional la lista de sus turnos del **día siguiente** por los
canales de `DAILY_REPORT_CHANNELS` (`email`, `whatsapp` o ambos).

Para ejecutarlo manualmente:

```bash
npm run report:daily
# o vía HTTP:
curl -X POST http://localhost:3000/admin/reporte-diario
```

---

## Rutas principales

| Método | Ruta                                         | Descripción                                  |
|--------|----------------------------------------------|----------------------------------------------|
| GET    | `/`                                          | Inicio                                        |
| GET/POST | `/webhook/whatsapp`                        | Webhook de WhatsApp (verificación / entrada)  |
| GET/POST | `/formulario`                             | Formulario del paciente                       |
| GET    | `/profesional/solicitud/:token`              | Revisión de la solicitud por el profesional   |
| POST   | `/profesional/solicitud/:token/habilitar`    | Habilita horarios y avisa al paciente         |
| GET/POST | `/turnos/elegir/:token`                   | Grilla de horarios y confirmación             |
| GET    | `/turnos/gestionar/:token`                   | Gestión del turno (cambiar/anular)            |
| POST   | `/turnos/gestionar/:token/anular`            | Anula el turno (>= 24 hs)                      |
| POST   | `/turnos/gestionar/:token/reprogramar`       | Reprograma el turno (>= 24 hs)                |
| POST   | `/admin/reporte-diario`                      | Dispara el reporte manualmente                |

---

## Notas de diseño

- **Reservas atómicas**: la creación y reprogramación de turnos usa
  transacciones con `SELECT ... FOR UPDATE` para evitar doble reserva de un mismo
  horario.
- **Regla de 24 hs**: centralizada en `appointmentModel.js`, se valida antes de
  anular o reprogramar.
- **Tokens**: cada solicitud y cada turno tienen un token (UUID) que se usa en
  los links enviados por WhatsApp, evitando exponer IDs secuenciales.
- **Tolerancia a fallos de notificación**: un error al enviar WhatsApp/email se
  registra pero no interrumpe el flujo principal del turno.
