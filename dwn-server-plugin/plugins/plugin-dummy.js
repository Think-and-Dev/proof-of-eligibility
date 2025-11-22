// plugins/custom-data-store.js
import { DataStoreLevel } from "@tbd54566975/dwn-sdk-js";

/**
 * POC DataStore:
 * - Extiende el LevelDB store existente
 * - Loguea cada vez que DWN intenta guardar/leer data
 *
 * Requisitos de dwn-server:
 *  - default export
 *  - constructor sin argumentos
 */
export default class CustomDataStore extends DataStoreLevel {
  constructor() {
    // DataStoreLevel usa una carpeta local tipo LevelDB.
    // Podés poner cualquier path.
    super({ location: "data-custom" });

    console.log("[FilecoinDataStore] ✅ plugin cargado e instanciado");
  }

  async put(...args) {
    console.log("[FilecoinDataStore.put] 🚀 llamado", {
      argsCount: args.length,
      types: args.map(a => typeof a)
    });

    return super.put(...args);
  }

  async get(...args) {
    console.log("[FilecoinDataStore.get] 👀 llamado");
    return super.get(...args);
  }

  async delete(...args) {
    console.log("[FilecoinDataStore.delete] 🗑️ llamado");
    return super.delete(...args);
  }
}

