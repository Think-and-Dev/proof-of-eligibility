import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración vacía de Turbopack para silenciar el warning
  // pero mantener webpack como bundler
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Excluir @web5/dids y sus dependencias nativas del SSR
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@web5/dids': 'commonjs @web5/dids',
        '@web5/common': 'commonjs @web5/common',
        '@web5/crypto': 'commonjs @web5/crypto',
        'classic-level': 'commonjs classic-level',
        'level': 'commonjs level',
        'abstract-level': 'commonjs abstract-level',
      });
    } else {
      // Usar el build ESM del navegador (browser.mjs) que es compatible con ES modules
      const path = require('path');
      const browserMjsPath = path.resolve(process.cwd(), 'node_modules/@web5/dids/dist/browser.mjs');

      config.resolve.alias = {
        ...config.resolve.alias,
        '@web5/dids': browserMjsPath,
      };

      // Excluir módulos nativos del bundling del cliente
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'classic-level': false,
        'level': false,
        'abstract-level': false,
        'fs': false,
        'path': false,
        'crypto': false,
      };
    }

    return config;
  },
};

export default nextConfig;
