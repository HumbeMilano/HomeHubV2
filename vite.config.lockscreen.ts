import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Build configuration for the standalone Lockscreen bundle.
// Produces output at dist-lockscreen/ with all assets relative to its install path,
// so it can be dropped into Home Assistant's /config/www/homehub-lockscreen/.
export default defineConfig({
  plugins: [react()],
  // base must match where it'll be served from in HA: /local/homehub-lockscreen/
  base: '/local/homehub-lockscreen/',
  build: {
    outDir: 'dist-lockscreen',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.lockscreen.html'),
      },
    },
  },
});
