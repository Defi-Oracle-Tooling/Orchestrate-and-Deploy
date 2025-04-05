import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import QuotaMatrix from './QuotaMatrix';

// Mock axios with a simpler approach
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
                    },
                    'Standard_D4s_v3': {
                        total: 20,
                        used: 3,
                        available: 17,
                        assigned_to: ['storage']
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
    },
    get: vi.fn().mockResolvedValue({
        data: {
            'eastus': {
                'Standard_D2s_v3': {
                    total: 10,
                    used: 5,
                    available: 5,
                    assigned_to: ['validator']
                },
                'Standard_D4s_v3': {
                    total: 20,
                    used: 3,
                    available: 17,
                    assigned_to: ['storage']
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
}));

describe('QuotaMatrix', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the component with title', async () => {
        render(<QuotaMatrix />);
        expect(screen.getByText('Available Quota Matrix')).toBeInTheDocument();
    });

    it('renders filter inputs', () => {
        render(<QuotaMatrix />);
        expect(screen.getByPlaceholderText('e.g., eastus')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g., validator')).toBeInTheDocument();
    });

    it('renders region headers in the table', async () => {
        render(<QuotaMatrix />);
        // Wait for the component to render regions after data fetch
        expect(await screen.findByText('eastus')).toBeInTheDocument();
        expect(await screen.findByText('westus')).toBeInTheDocument();
    });

    it('renders role rows in the table', async () => {
        render(<QuotaMatrix />);
        // Wait for the component to render roles after data fetch
        expect(await screen.findByText('validator')).toBeInTheDocument();
        expect(await screen.findByText('storage')).toBeInTheDocument();
        expect(await screen.findByText('network')).toBeInTheDocument();
    });

    it('allows filtering by region', async () => {
        render(<QuotaMatrix />);
        const filterInput = screen.getByPlaceholderText('e.g., eastus');
        fireEvent.change(filterInput, { target: { value: 'east' } });

        // The axios mock should be called with the updated filter
        expect(await screen.findByText('eastus')).toBeInTheDocument();
    });

    it('allows filtering by role', async () => {
        render(<QuotaMatrix />);
        const filterInput = screen.getByPlaceholderText('e.g., validator');
        fireEvent.change(filterInput, { target: { value: 'validator' } });

        // The axios mock should be called with the updated filter
        expect(await screen.findByText('validator')).toBeInTheDocument();
    });
});