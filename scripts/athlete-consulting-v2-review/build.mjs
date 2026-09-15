import {build} from 'vite';
import react from '@vitejs/plugin-react';
import config from '../../vite.config.js';
await build({configFile:false,envFile:false,plugins:[react()],build:config.build});
