import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://dispatra.xyz',
  output: 'static',
  server: { port: 4321 },
  integrations: [react()],
});