import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./bridge", () => ({ bridge: { status: vi.fn(), initialize: vi.fn(), unlock: vi.fn(), recover: vi.fn(), lock: vi.fn(), createBackup: vi.fn(), completeOnboarding: vi.fn(), settings: vi.fn(), updateSettings: vi.fn() } }));
import { bridge } from "./bridge";
import { App } from "./App";

describe("application gate", () => {
  beforeEach(() => { vi.mocked(bridge.status).mockResolvedValue({ initialized: false, unlocked: false, onboardingCompleted: false }); });
  it("starts with the Arabic secure onboarding form", async () => { render(<App />); expect(await screen.findByRole("heading", { name: "أنشئ خزنتك" })).toBeInTheDocument(); expect(screen.getByLabelText("اسم المحامي")).toBeRequired(); });
  it("shows the lock form for an initialized vault", async () => { vi.mocked(bridge.status).mockResolvedValue({ initialized: true, unlocked: false, onboardingCompleted: false }); render(<App />); expect(await screen.findByRole("heading", { name: "افتح خزنتك" })).toBeInTheDocument(); });
});
