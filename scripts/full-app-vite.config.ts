import { mergeConfig } from 'vite';
import base from '../vite.config';

export default mergeConfig(base, {
  cacheDir: 'node_modules/.vite-full-app-qa',
  server: { hmr: false, watch: null },
});
