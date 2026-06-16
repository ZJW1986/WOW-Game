import { describe, expect, it } from "vitest";
import { getFeaturedGames, getGamesByCategory, playCategories, playGames } from "../src/core/playCatalog";

describe("play catalog", () => {
  it("keeps category menu compatible with the play page", () => {
    expect(playCategories[0]).toBe("All");
    expect(playCategories).toContain("Action");
    expect(playCategories).toContain("Platformer");
    expect(playCategories).toContain("Puzzle");
  });

  it("shows game title, play count and like count on every card", () => {
    expect(playGames.length).toBeGreaterThanOrEqual(16);
    for (const game of playGames) {
      expect(game.title.length).toBeGreaterThan(0);
      expect(game.plays).toBeGreaterThanOrEqual(0);
      expect(game.likes).toBeGreaterThanOrEqual(0);
    }
  });

  it("filters games by category and highlights featured games", () => {
    expect(getFeaturedGames()).toHaveLength(8);
    expect(getGamesByCategory("Platformer").every((game) => game.categories.includes("Platformer"))).toBe(
      true
    );
    expect(getGamesByCategory("All")).toEqual(playGames);
  });
});
