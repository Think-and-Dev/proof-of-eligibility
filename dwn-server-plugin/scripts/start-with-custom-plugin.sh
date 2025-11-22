#!/bin/bash

# Obtener el directorio del script actual
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Calcular el path absoluto del plugin
DATA_PLUGIN_PATH="${SCRIPT_DIR}/../plugins/plugin-dummy.js"
MESSAGE_PLUGIN_PATH="${SCRIPT_DIR}/../plugins/plugin-message-store-dummy.js"

# Convertir a path absoluto (por si acaso)
DATA_PLUGIN_ABSOLUTE_PATH="$(cd "$(dirname "$DATA_PLUGIN_PATH")" && pwd)/$(basename "$DATA_PLUGIN_PATH")"
MESSAGE_PLUGIN_ABSOLUTE_PATH="$(cd "$(dirname "$MESSAGE_PLUGIN_PATH")" && pwd)/$(basename "$MESSAGE_PLUGIN_PATH")"

# Setear la variable de entorno
export DWN_STORAGE_DATA="$DATA_PLUGIN_ABSOLUTE_PATH"
export DWN_STORAGE_MESSAGES="$MESSAGE_PLUGIN_ABSOLUTE_PATH"

# Ejecutar run-dwn.js
node "${SCRIPT_DIR}/run-dwn.js"

