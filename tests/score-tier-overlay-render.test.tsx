// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ScoreTierOverlay, type ScoreTierRunResult } from "../src/ui/ScoreTierOverlay";
import type { GameHooks } from "../src/core/types";

// React 19 requires this flag for act() to register as a test environment.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tiers: NonNullable<GameHooks["scoreTiers"]> = {
  targetDurationMs: 75000,
  gold: { minScore: 6, maxDeathCount: 0, maxDurationMs: 56000 },
  silver: { minScore: 4, maxDeathCount: 1 },
  bronze: { minScore: 2 },
  rationale: "金=无失误且 ≤56 秒；银=熟练玩家；铜=完成本局"
};

function mount(ui: React.ReactElement): { container: HTMLElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function unmount(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe("ScoreTierOverlay rendering", () => {
  it("renders 3 stars + gold label when run meets gold tier", () => {
    const result: ScoreTierRunResult = { outcome: "won", score: 8, deaths: 0, durationMs: 50_000 };
    const { container, root } = mount(
      <ScoreTierOverlay result={result} tiers={tiers} onRestart={() => {}} />
    );

    const overlay = container.querySelector(".score-tier-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute("data-award")).toBe("gold");
    expect(overlay?.getAttribute("data-result")).toBe("won");
    expect(container.querySelectorAll(".score-tier-star.is-filled").length).toBe(3);
    expect(container.querySelector(".score-tier-label")?.textContent).toMatch(/完美通关/);
    const stats = Array.from(container.querySelectorAll(".score-tier-stats dd")).map((dd) => dd.textContent);
    expect(stats).toEqual(["8", "50s", "0"]);
    expect(container.querySelector(".score-tier-rationale")?.textContent).toContain("金=无失误");
    unmount(root, container);
  });

  it("renders 2 stars + silver label when run meets only silver", () => {
    const result: ScoreTierRunResult = { outcome: "won", score: 6, deaths: 1, durationMs: 70_000 };
    const { container, root } = mount(
      <ScoreTierOverlay result={result} tiers={tiers} onRestart={() => {}} />
    );

    expect(container.querySelector(".score-tier-overlay")?.getAttribute("data-award")).toBe("silver");
    expect(container.querySelectorAll(".score-tier-star.is-filled").length).toBe(2);
    unmount(root, container);
  });

  it("renders 0 stars and 本局失败 when player lost", () => {
    const result: ScoreTierRunResult = { outcome: "lost", score: 3, deaths: 1, durationMs: 30_000 };
    const { container, root } = mount(
      <ScoreTierOverlay result={result} tiers={tiers} onRestart={() => {}} />
    );

    expect(container.querySelector(".score-tier-overlay")?.getAttribute("data-award")).toBe("none");
    expect(container.querySelectorAll(".score-tier-star.is-filled").length).toBe(0);
    expect(container.querySelector(".score-tier-label")?.textContent).toMatch(/本局失败/);
    unmount(root, container);
  });

  it("invokes onRestart when the primary button is clicked", () => {
    const onRestart = vi.fn();
    const result: ScoreTierRunResult = { outcome: "won", score: 6, deaths: 0, durationMs: 50_000 };
    const { container, root } = mount(
      <ScoreTierOverlay result={result} tiers={tiers} onRestart={onRestart} />
    );

    const primary = container.querySelector<HTMLButtonElement>("button.score-tier-button.is-primary");
    expect(primary).not.toBeNull();
    act(() => primary!.click());
    expect(onRestart).toHaveBeenCalledTimes(1);
    unmount(root, container);
  });

  it("submits feedback with default rating equal to award stars", async () => {
    const result: ScoreTierRunResult = { outcome: "won", score: 8, deaths: 0, durationMs: 50_000 };
    const submitted: Array<{ rating: number; comment: string }> = [];
    const onSubmitFeedback = vi.fn(async (input: { rating: number; comment: string }) => {
      submitted.push(input);
    });
    const { container, root } = mount(
      <ScoreTierOverlay result={result} tiers={tiers} onRestart={() => {}} onSubmitFeedback={onSubmitFeedback} />
    );

    const form = container.querySelector<HTMLFormElement>("form.score-tier-feedback");
    expect(form).not.toBeNull();

    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSubmitFeedback).toHaveBeenCalledTimes(1);
    expect(submitted[0].rating).toBe(3);
    expect(submitted[0].comment).toBe("");
    unmount(root, container);
  });

  it("changes rating when a different rating pip is clicked", () => {
    const result: ScoreTierRunResult = { outcome: "won", score: 8, deaths: 0, durationMs: 50_000 };
    const { container, root } = mount(
      <ScoreTierOverlay result={result} tiers={tiers} onRestart={() => {}} onSubmitFeedback={async () => {}} />
    );

    const pips = container.querySelectorAll<HTMLButtonElement>(".score-tier-rating-pip");
    expect(pips.length).toBe(5);
    act(() => pips[4].click());
    expect(pips[4].getAttribute("aria-checked")).toBe("true");
    expect(container.querySelectorAll(".score-tier-rating-pip.is-on").length).toBe(5);
    unmount(root, container);
  });
});
