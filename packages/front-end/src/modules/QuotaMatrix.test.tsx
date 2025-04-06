import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { JSDOM } from 'jsdom';
import QuotaMatrix from './QuotaMatrix';

// Create a fake DOM environment for tests
beforeAll(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    // @ts-ignore
    global.window = dom.window;
});

// Mock axios
vi.mock('axios', () => ({
    default: {
        get: vi.fn().mockResolvedValue({
            data: {
                'eastus': {
                    'Standard_D2s_v3': {
                        total: 10,
                        used: 5,
                        available: 5,
                        assigned_to: ['validator']
                    }
                },
                'westus': {
                    'Standard_D8s_v3': {
                        total: 15,
                        used: 12,
                        available: 3,
                        assigned_to: ['validator', 'network']
                    }
                }
            }
        })
    }
}));

describe('QuotaMatrix', () => {
    it('renders without crashing', () => {
        // Just test that rendering doesn't throw an error
        expect(() => render(<QuotaMatrix />)).not.toThrow();
    });
});