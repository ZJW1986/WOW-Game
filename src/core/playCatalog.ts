export type PlayCategory =
  | "All"
  | "Casual"
  | "Advanced"
  | "Action"
  | "Multiplayer"
  | "Puzzle"
  | "Education"
  | "Adventure"
  | "Sports"
  | "Racing"
  | "Platformer"
  | "RPG"
  | "Simulation"
  | "Strategy"
  | "Sandbox"
  | "Survivor"
  | "Horror"
  | "Cozy"
  | "Clicker"
  | "Mini Games"
  | "3D"
  | "Anime";

export interface PlayGame {
  id: string;
  title: string;
  categories: PlayCategory[];
  plays: number;
  likes: number;
  featured?: boolean;
  popular?: boolean;
  size?: "wide" | "large" | "normal";
  palette: string;
}

export const playCategories: PlayCategory[] = [
  "All",
  "Casual",
  "Advanced",
  "Action",
  "Multiplayer",
  "Puzzle",
  "Education",
  "Adventure",
  "Sports",
  "Racing",
  "Platformer",
  "RPG",
  "Simulation",
  "Strategy",
  "Sandbox",
  "Survivor",
  "Horror",
  "Cozy",
  "Clicker",
  "Mini Games",
  "3D",
  "Anime"
];

export const playGames: PlayGame[] = [
  game("neon-velocity", "Mini Max Velvet Velocity", ["Racing", "Action"], 8000, 23, "#2b6bff,#ff42d0", true),
  game("totoy-bato", "Totoy Bato", ["Casual", "Adventure"], 2700, 5, "#f59e0b,#111827", true),
  game("neo-max", "Mini Max NEO MAX", ["Action", "Anime"], 1600, 21, "#0ea5e9,#a855f7", true),
  game("chibi-friends", "Chibi Animal Friends Coloring", ["Cozy", "Education"], 1100, 7, "#99f6e4,#f9a8d4", true),
  game("midnight-rider", "Midnight Rider", ["Racing", "Action"], 1100, 5, "#111827,#ec4899", true),
  game("parrot-racing", "Not A Parrot Racing Game", ["Racing", "Casual"], 311, 4, "#84cc16,#38bdf8", true),
  game("velo-ag", "VELO AG", ["Racing", "3D"], 284, 3, "#0f172a,#22d3ee", true),
  game("all-4-sides", "All 4 Sides", ["Puzzle", "Mini Games"], 220, 1, "#7c3aed,#f97316", true),
  game("pocket-pong", "Pocket Pong", ["Sports", "Casual"], 75200, 5, "#2563eb,#22c55e", false, true, "large"),
  game("forest-template", "3D Multiplayer Template v1", ["Multiplayer", "3D"], 42600, 8, "#14532d,#94a3b8", false, true),
  game("last-free-man", "The Last Free Man", ["Survivor", "Action"], 30800, 9, "#111827,#16a34a", false, true),
  game("cavernous-caution", "Cavernous Caution", ["Adventure", "Horror"], 23700, 3, "#450a0a,#334155", false, true, "wide"),
  game("skysurfer", "the SkySurfer", ["Racing", "Casual"], 18500, 1, "#fde68a,#67e8f9", false, true),
  game("nami", "Nami [V0.1]", ["Anime", "Cozy"], 18200, 2, "#fef3c7,#fb7185", false, true),
  game("highway", "Endless Highway Racing", ["Racing"], 16800, 10, "#0f172a,#38bdf8", false, true),
  game("manga-matrix", "Manga Matrix", ["Anime", "RPG"], 15800, 2, "#f472b6,#ef4444", false, true),
  game("zig-drift", "Zig Drift", ["Casual", "Racing"], 13400, 1, "#06b6d4,#8b5cf6"),
  game("bouncy-ninja", "Bouncy Ninja Star", ["Platformer", "Mini Games"], 8100, 2, "#020617,#60a5fa"),
  game("neonwave", "Neonwave Sunrise Striker", ["Action", "Casual"], 5000, 1, "#581c87,#f472b6"),
  game("happy-racer", "Happy Racer", ["Racing", "Casual"], 3700, 4, "#7dd3fc,#65a30d"),
  game("astro-jetpack", "Astro Jetpack", ["Platformer", "Adventure"], 2800, 1, "#020617,#facc15"),
  game("drawtopia", "Drawtopia", ["Puzzle", "Education"], 484, 7, "#fef3c7,#a855f7"),
  game("poke-guessr", "PokeGuessr", ["Mini Games", "Anime"], 364, 0, "#111827,#f9a8d4"),
  game("antkiller", "ANTkiller", ["Action", "Survivor"], 356, 6, "#84cc16,#991b1b"),
  game("openrct", "OpenRCT2 Park Builder", ["Advanced", "Simulation"], 22100, 11, "#16a34a,#f59e0b"),
  game("mindustry", "Mindustry Defense", ["Advanced", "Strategy"], 19800, 14, "#334155,#facc15"),
  game("microcity", "MicroCity", ["Advanced", "Simulation"], 14400, 8, "#22c55e,#38bdf8")
];

export function getFeaturedGames(): PlayGame[] {
  return playGames.filter((game) => game.featured).slice(0, 8);
}

export function getPopularGames(): PlayGame[] {
  return playGames.filter((game) => game.popular).slice(0, 8);
}

export function getGamesByCategory(category: PlayCategory): PlayGame[] {
  if (category === "All") return playGames;
  return playGames.filter((game) => game.categories.includes(category));
}

function game(
  id: string,
  title: string,
  categories: PlayCategory[],
  plays: number,
  likes: number,
  palette: string,
  featured = false,
  popular = false,
  size: PlayGame["size"] = "normal"
): PlayGame {
  return { id, title, categories, plays, likes, palette, featured, popular, size };
}
