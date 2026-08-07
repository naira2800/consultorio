# Despliegue automático (CI/CD): GitHub Actions + Doppler + Railway

Este documento explica cómo terminar de conectar el pipeline definido en
`.github/workflows/ci.yml`. El código y el workflow ya están listos; lo que
falta es **configuración manual, fuera del repositorio** (crear cuentas y
conectar servicios). Nada de esto son pasos que se puedan automatizar desde
acá — hay que hacerlos una vez, a mano, en los paneles de cada servicio.

## El flujo, de punta a punta

```
git push a main
      │
      ▼
GitHub Actions se dispara solo
      │
      ▼
Job "verificar": instala dependencias, valida sintaxis, valida que la app cargue
      │  (si falla, el pipeline se detiene aca; production nunca se toca)
      ▼
Job "desplegar" (solo si "verificar" paso Y fue push a main):
      │
      ├─ Le pide a Doppler el DOPPLER_TOKEN (unico secreto en GitHub)
      ├─ Doppler entrega el resto de los secretos (incluido RAILWAY_TOKEN)
      └─ Se ejecuta "railway up": sube el codigo nuevo a Railway
      ▼
Railway reconstruye y reinicia el servicio
      │
      ▼
La app en producción corre con las variables de entorno que Doppler
sincroniza permanentemente hacia Railway (independiente de cada deploy).
```

## 1. Doppler — crear la cuenta y cargar los secretos

1. Registrate gratis en **https://www.doppler.com/**.
2. Creá un proyecto, por ejemplo **`tu-bienestar`**.
3. Doppler crea 3 configs por defecto (`dev`, `stg`, `prd`). Para este flujo
   usamos **`prd`** (producción).
4. En la config `prd`, cargá **todas** las variables de `docs/secretos-referencia.md`
   (DB_HOST, DB_PASSWORD, WHATSAPP_CLOUD_TOKEN, APP_SECRET, etc.) más estas dos
   nuevas, específicas de este pipeline:
   - `RAILWAY_TOKEN` → se genera en el paso 2.
   - `RAILWAY_SERVICE` → el nombre del servicio en Railway (paso 2).

## 2. Railway — crear el proyecto y el token

1. Registrate gratis en **https://railway.app/**.
2. Creá un **proyecto nuevo** (ej. `tu-bienestar`) con un **servicio** dentro
   (puede arrancar vacío; el primer `railway up` del pipeline lo va a desplegar).
3. **Importante:** si Railway te ofrece conectar el repo de GitHub para
   "auto-deploy", **no lo actives** — vamos a manejar el deploy nosotros desde
   Actions (así solo se despliega si el CI pasó, no en cada push crudo).
4. En el servicio, cargá las variables de entorno que la APP necesita en
   tiempo de ejecución (DB_HOST, DB_PASSWORD, etc.) — o mejor, seguí el paso 3
   para que Doppler las sincronice solo.
5. Generá un **token del proyecto**: Project Settings → Tokens → "Create Token".
   Copialo y pegalo en Doppler como `RAILWAY_TOKEN` (paso 1.4).
6. Anotá el **nombre del servicio** (tal cual aparece en Railway) y cargalo en
   Doppler como `RAILWAY_SERVICE`.

## 3. Doppler → Railway — sincronizar las variables de entorno

Esto es lo que hace que la app en producción SIEMPRE tenga los secretos
correctos, sin depender de cada deploy:

1. En Doppler, dentro del proyecto `tu-bienestar` → **Integrations** →
   buscá **Railway** → conectalo con tu cuenta de Railway.
2. Elegí sincronizar la config `prd` hacia el servicio de Railway del paso 2.
3. A partir de acá, cualquier cambio de un secreto en Doppler se refleja solo
   en Railway (sin volver a tocar nada del código ni del pipeline).

## 4. GitHub — el único secreto que va acá

1. En tu repo: **Settings → Secrets and variables → Actions → New repository
   secret**.
2. Nombre: **`DOPPLER_TOKEN`**.
3. Valor: un **Service Token** de Doppler, generado en el proyecto
   `tu-bienestar` → config `prd` → **Access → Service Tokens → Generate**.
   (Este token solo puede LEER esa config específica; es la "llave" que usa
   GitHub Actions para pedirle el resto de los secretos a Doppler.)

## 5. Probar el pipeline

Con los 4 pasos anteriores hechos, cualquier `push` a `main` dispara el
deploy automático. Para verlo:

```bash
git push origin main
```

Y mirá la pestaña **Actions** del repo en GitHub: vas a ver primero el job
`verificar` y, si pasa, el job `desplegar` corriendo.

## Notas

- Si `verificar` falla (por ejemplo, un error de sintaxis), `desplegar` **no
  se ejecuta** — production queda protegida.
- El job `desplegar` solo corre en `push` directo a `main`, nunca en Pull
  Requests ni en otras ramas.
- Si en el futuro rotás un secreto (ej. el token de WhatsApp), se actualiza
  **una sola vez en Doppler** y se propaga solo a Railway. GitHub Actions ni
  se entera del cambio (solo usa su `DOPPLER_TOKEN`, que no cambia).
- El proyecto de Railway (`gallant-analysis`) y el servicio (`tu-bienestar-app`,
  ID `5ad386ff-d61b-4c2f-a962-af9106a980ff`) quedan **hardcodeados** como
  `--project`/`--service` en el comando de deploy dentro de `ci.yml`. Si algún
  día recreás el servicio o el proyecto en Railway, hay que actualizar esos
  dos IDs ahí (se consiguen con `railway status` desde un paso de diagnóstico,
  o de la URL del servicio en el panel de Railway:
  `.../project/<PROJECT_ID>/service/<SERVICE_ID>`).

## Bug resuelto: "Service not found" pese a tener todo bien configurado

Durante la puesta a punto, el deploy fallaba siempre con `Service not found`
(o `Multiple services found` si se omitía `--service`), **sin importar** si
`--service` recibía el nombre correcto del servicio, su ID, o si además se
agregaban `--project`/`--environment`. La causa no era de configuración sino
de **cómo Bash expande variables**:

```bash
# MAL — esto SIEMPRE mandaba --service "" (vacio) a Railway:
doppler run -- railway up --service "$RAILWAY_SERVICE" --detach
```

`"$RAILWAY_SERVICE"` se expande en el **shell exterior** que ejecuta la línea
completa (el del runner de GitHub Actions), **antes** de que `doppler run`
llegue siquiera a arrancar. Ese shell exterior nunca tuvo `RAILWAY_SERVICE`
seteada — solo la tiene el **proceso hijo** que `doppler run` lanza. Resultado:
el valor real cargado en Doppler nunca llegaba a usarse; Railway siempre
recibía un string vacío y por eso "no encontraba" nada, sin importar qué se
hubiera cargado.

**La solución** es envolver el comando real dentro de `bash -c '...'` (con
comillas **simples**), para que la expansión de `$RAILWAY_SERVICE` ocurra
recién **dentro** del proceso hijo que sí tiene la variable inyectada:

```bash
# BIEN — la variable se expande DENTRO del proceso que doppler run inyecta:
doppler run -- bash -c '
  railway up --service "$RAILWAY_SERVICE" --detach
'
```

Si en el futuro se agrega alguna otra variable de Doppler a un comando dentro
de este workflow, hay que aplicar el mismo patrón (`bash -c` con comillas
simples) para evitar repetir este mismo problema.
