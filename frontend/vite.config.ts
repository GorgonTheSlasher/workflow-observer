/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Recharts and its dependencies, split into one chunk that only the dashboard tabs load
const CHART_LIBS = /[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|@reduxjs|react-redux|reselect|immer|es-toolkit|decimal\.js-light|eventemitter3)[\\/]/

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            // React is needed at startup; claim it first so the charts group doesn't pull it in
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 2 },
            { name: 'charts', test: CHART_LIBS, priority: 1 },
          ],
        },
      },
    },
  },
})
