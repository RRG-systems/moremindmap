// Full current application build; no environment files or development API plugins.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
await build({ root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false, envFile: false, plugins: [react()], define: {
  'import.meta.env.VITE_RECRUITING_V1_ENABLED': '"true"',
  'import.meta.env.VITE_RECRUITING_GU_V1_ENABLED': '"true"',
  'import.meta.env.VITE_RECRUITING_V1_SYNTHETIC_REVIEW': '"false"',
} });
