/// <reference types="vitest/globals" />

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        environmentOptions: {
            jsdom: {
                resources: 'usable',
            },
        },
        deps: {
            inline: ['@testing-library/react'],
        },
    },
});