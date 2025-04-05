/* @vitest-environment jsdom */
import "../../vitest.setup";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import QuotaMatrix from "./QuotaMatrix";

// Mock axios
vi.mock("axios", () => ({
    get: vi.fn().mockResolvedValue({ data: {} })
}));

describe("QuotaMatrix", () => {
    it("renders QuotaMatrix without crashing", () => {
        render(<QuotaMatrix />);
        const element = screen.getByText(/Available Quota Matrix/i);
        expect(element).toBeTruthy();
    });
});