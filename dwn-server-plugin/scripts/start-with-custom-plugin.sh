#!/bin/bash

# Get the current script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Calculate the absolute path of the plugin
DATA_PLUGIN_PATH="${SCRIPT_DIR}/../plugins/plugin-data-store-filecoin.js"
MESSAGE_PLUGIN_PATH="${SCRIPT_DIR}/../plugins/plugin-message-store-filecoin.js"

# Convert to absolute path (just in case)
DATA_PLUGIN_ABSOLUTE_PATH="$(cd "$(dirname "$DATA_PLUGIN_PATH")" && pwd)/$(basename "$DATA_PLUGIN_PATH")"
MESSAGE_PLUGIN_ABSOLUTE_PATH="$(cd "$(dirname "$MESSAGE_PLUGIN_PATH")" && pwd)/$(basename "$MESSAGE_PLUGIN_PATH")"

# Set the environment variable
export DWN_STORAGE_DATA="$DATA_PLUGIN_ABSOLUTE_PATH"
export DWN_STORAGE_MESSAGES="$MESSAGE_PLUGIN_ABSOLUTE_PATH"

# Execute run-dwn.js
node "${SCRIPT_DIR}/run-dwn.js"

