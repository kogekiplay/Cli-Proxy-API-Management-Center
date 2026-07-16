import { defineConfig, mergeConfig, type UserConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import baseConfig from './vite.config';

export default mergeConfig(
  baseConfig as UserConfig,
  defineConfig({
    base: './',
    plugins: [
      viteSingleFile({
        removeViteModuleLoader: true,
      }),
    ],
    build: {
      outDir: 'dist-standalone',
      assetsInlineLimit: 100_000_000,
      chunkSizeWarningLimit: 100_000_000,
      cssCodeSplit: false,
      rolldownOptions: {
        output: {
          codeSplitting: false,
        },
      },
    },
  })
);
