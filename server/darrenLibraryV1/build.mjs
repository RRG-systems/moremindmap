import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('./client/', import.meta.url));
await build({
  configFile: false,
  envFile: false,
  root,
  base: '/darren-library/',
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: path.resolve(root, '../dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.join(root, 'index.html'),
        bos: path.join(root, 'bos.html'),
        apa: path.join(root, 'apa.html'),
      },
    },
  },
});
