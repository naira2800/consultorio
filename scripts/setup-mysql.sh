#!/usr/bin/env bash
# ==========================================================================
# Instala y configura MySQL en un Codespace / contenedor Ubuntu (Debian).
# Deja la base "consultorio" creada y con datos de ejemplo, lista para usar
# con la configuracion por defecto de la app (root, sin contrasena).
#
#   bash scripts/setup-mysql.sh
#
# Nota: en Codespaces no hay systemd, por lo que MySQL NO arranca solo al
# reiniciar el contenedor. Para volver a levantarlo mas tarde ejecute:
#   sudo service mysql start
# ==========================================================================
set -euo pipefail

# Ubicarse en la raiz del repositorio (este script vive en scripts/).
cd "$(dirname "$0")/.."

echo "==> Instalando MySQL Server (puede pedir su contrasena de sudo)..."
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server

echo "==> Iniciando el servicio MySQL..."
sudo service mysql start

echo "==> Configurando root (autenticacion nativa, sin contrasena)..."
sudo mysql <<'SQL'
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';
CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY '';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;
FLUSH PRIVILEGES;
SQL

echo "==> Creando el esquema y cargando datos de ejemplo..."
sudo mysql < db/schema.sql
sudo mysql < db/seed.sql

echo ""
echo "==> Listo. MySQL esta corriendo y la base 'consultorio' quedo cargada."
echo "    Inicie la aplicacion con: npm start"
