import { describe, it, beforeEach, expect, vi } from "vitest";
import { BesuConfigurator } from "./BesuConfigurator";
import * as fs from "fs";

vi.mock("fs");

describe("BesuConfigurator", () => {
    beforeEach(() => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.mkdirSync).mockImplementation(() => { });
        vi.mocked(fs.readFileSync).mockImplementation(() => "{}");
        vi.mocked(fs.writeFileSync).mockImplementation(() => { });
    });

    it("deploy writes versioned config", async () => {
        const configurator = new BesuConfigurator();
        await configurator.deploy("test/besu-config.json");
        expect(fs.writeFileSync).toHaveBeenCalled();
    });
});