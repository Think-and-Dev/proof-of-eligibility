// plugins/custom-data-store.js
import { MessageStoreLevel } from "@tbd54566975/dwn-sdk-js";

/**
 * POC DataStore:
 * - Extiende el LevelDB store existente
 * - Loguea cada vez que DWN intenta guardar/leer data
 *
 * Requisitos de dwn-server:
 *  - default export
 *  - constructor sin argumentos
 */
export default class CustomMessageStore extends MessageStoreLevel {
  constructor() {
    // DataStoreLevel usa una carpeta local tipo LevelDB.
    // Podés poner cualquier path.
    super({ location: "data-custom" });

    console.log("[FilecoinMessageStore] ✅ plugin cargado e instanciado");
  }

  async put(...args) {
    console.log("[FilecoinMessageStore.put] 🚀 llamado", {
      argsCount: args.length,
      types: args.map(a => typeof a)
    });

    return super.put(...args);
  }

  async get(...args) {
    console.log("[FilecoinMessageStore.get] 👀 llamado");
    return super.get(...args);
  }

  async delete(...args) {
    console.log("[FilecoinMessageStore.delete] 🗑️ llamado");
    return super.delete(...args);
  }
}

