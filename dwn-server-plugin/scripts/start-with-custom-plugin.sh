#!/bin/bash

# Obtener el directorio del script actual
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Calcular el path absoluto del plugin
PLUGIN_PATH="${SCRIPT_DIR}/../plugins/plugin-dummy.js"

# Convertir a path absoluto (por si acaso)
PLUGIN_ABSOLUTE_PATH="$(cd "$(dirname "$PLUGIN_PATH")" && pwd)/$(basename "$PLUGIN_PATH")"

# Setear la variable de entorno
export DWN_STORAGE_DATA="$PLUGIN_ABSOLUTE_PATH"

# Ejecutar run-dwn.js
node "${SCRIPT_DIR}/run-dwn.js"

