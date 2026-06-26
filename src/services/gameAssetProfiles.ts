import type { TemplateFamily, ThreeGameGenre, UserMaterialSlot } from "../core/types";

export type RuntimeImageSlot = Extract<UserMaterialSlot, "background" | "player" | "hazard" | "collectible">;

export interface GameAssetSlotProfile {
  slot: RuntimeImageSlot;
  assetKey: string;
  label: string;
  purpose: string;
  subject: string;
  composition: string;
  negativePrompt: string;
  format: "png" | "webp";
  promptType: "background" | "sprite";
}

export interface GameAssetProfile {
  id: TemplateFamily | ThreeGameGenre;
  engineType: "phaser2d" | "threejs3d";
  slots: Record<RuntimeImageSlot, GameAssetSlotProfile>;
  generationOrder: RuntimeImageSlot[][];
}

const commonBackgroundNegative =
  "no player, no hero, no enemy, no collectible, no UI, no text, no logo, no control icons, no game rules, no code";
const commonSpriteNegative =
  "no environment background, no UI, no text, no logo, no game rules, no code, no multiple unrelated subjects";

export const PHASER_ASSET_PROFILES: Record<TemplateFamily, GameAssetProfile> = {
  top_down: profile("top_down", "phaser2d", [
    slot("background", "world.background", "Top-down map background", "俯视地图背景", "top-down playable arena map with clear traversal space", "orthographic top-down environment plate, readable roads or open lanes, 16:9 WebP", `${commonBackgroundNegative}, no spaceship foreground, no asteroid foreground`, "webp", "background"),
    slot("player", "player.ship", "Top-down player sprite", "俯视可控主角或载具", "single controllable top-down hero, vehicle, ship, or avatar", "isolated centered transparent PNG sprite, readable from above", `${commonSpriteNegative}, no enemy, no pickup`, "png", "sprite"),
    slot("hazard", "hazard.enemy", "Top-down enemy sprite", "巡逻敌人或危险物", "single top-down enemy, patrol unit, meteor, mine, or monster", "isolated centered transparent PNG sprite, threatening silhouette", `${commonSpriteNegative}, no player, no reward`, "png", "sprite"),
    slot("collectible", "item.collectible", "Top-down reward item", "钥匙、金币或任务物", "single reward pickup such as key, coin, energy cell, gem, or quest item", "isolated centered transparent PNG sprite, high contrast at small size", `${commonSpriteNegative}, no enemy, no player`, "png", "sprite")
  ], [["background"], ["player"], ["hazard"], ["collectible"]]),
  platformer: profile("platformer", "phaser2d", [
    slot("background", "world.background", "Side-scrolling layered background", "横版分层背景", "side-scrolling parallax environment with platform-readable empty play bands", "wide 16:9 layered environment plate, horizon and depth, no actors", `${commonBackgroundNegative}, no coins, no spikes, no character`, "webp", "background"),
    slot("player", "player.hero", "Platformer hero sprite", "横版角色精灵", "single side-view playable hero, runner, ninja, robot, or mascot", "isolated centered transparent PNG sprite, side-view silhouette", `${commonSpriteNegative}, no platform, no enemy, no reward`, "png", "sprite"),
    slot("hazard", "hazard.spike", "Platformer hazard sprite", "尖刺、机关或巡逻敌人", "single side-view spike trap, patrol enemy, saw, or obstacle", "isolated centered transparent PNG sprite, readable danger shape", `${commonSpriteNegative}, no player, no coin`, "png", "sprite"),
    slot("collectible", "item.collectible", "Platformer reward sprite", "金币、宝石或能力道具", "single coin, gem, scroll, dash refill, or ability pickup", "isolated centered transparent PNG sprite, bright reward silhouette", `${commonSpriteNegative}, no spike, no enemy, no player`, "png", "sprite")
  ], [["background"], ["player"], ["hazard"], ["collectible"]]),
  grid_logic: profile("grid_logic", "phaser2d", [
    slot("background", "world.tiles", "Grid board background", "格子棋盘地图", "top-down puzzle board, tile grid, sockets, walls, and target cells", "orthographic tileable board plate, clear grid cells, 16:9 WebP", `${commonBackgroundNegative}, no spaceship, no character scene`, "webp", "background"),
    slot("player", "player.cursor", "Puzzle control piece", "光标或可控棋子", "single cursor, push block controller, or movable puzzle piece", "isolated centered transparent PNG sprite, simple geometric readable shape", `${commonSpriteNegative}, no full board`, "png", "sprite"),
    slot("hazard", "hazard.block", "Puzzle blocker", "阻挡方块或障碍块", "single blocker block, locked tile, trap tile, or wall piece", "isolated centered transparent PNG sprite, square tile object", `${commonSpriteNegative}, no character, no coin`, "png", "sprite"),
    slot("collectible", "item.collectible", "Puzzle target item", "目标块、钥匙或能量块", "single target block, key, energy node, or goal token", "isolated centered transparent PNG sprite, readable puzzle objective", `${commonSpriteNegative}, no enemy, no player`, "png", "sprite")
  ], [["background"], ["player"], ["hazard"], ["collectible"]]),
  tower_defense: profile("tower_defense", "phaser2d", [
    slot("background", "world.path", "Tower defense path map", "塔防路径地图", "top-down tileable defense map with enemy path lanes and buildable zones", "orthographic top-down tileable WebP map, clear route, base area, tower build pads", `${commonBackgroundNegative}, no tower sprite, no enemy units, no coins, no cinematic horizon`, "webp", "background"),
    slot("player", "player.tower", "Defense tower or base", "防御主体、炮塔或基地", "single defensive turret, fortress core, base tower, or cannon building", "isolated centered transparent PNG sprite, top-down or three-quarter readable building", `${commonSpriteNegative}, no humanoid, no spaceship, no enemy wave`, "png", "sprite"),
    slot("hazard", "hazard.enemy", "Enemy wave unit", "成群移动敌人单位", "compact group enemy wave unit, drone squad, monster squad, or marching vehicle group", "isolated centered transparent PNG sprite, readable as wave enemy at small size", `${commonSpriteNegative}, no tower, no reward ring`, "png", "sprite"),
    slot("collectible", "item.collectible", "Tower defense resource", "金币、能源或资源箱", "single economy reward item such as gold coin stack, energy battery, crystal crate, or resource box", "isolated centered transparent PNG sprite, clear economy value", `${commonSpriteNegative}, no yellow virtual ring, no enemy, no tower`, "png", "sprite")
  ], [["background"], ["player"], ["hazard"], ["collectible"]]),
  ui_heavy: profile("ui_heavy", "phaser2d", [
    slot("background", "world.background", "Management scene background", "经营/卡牌菜单场景", "menu-friendly management room, shop counter, card table, or decision hub", "16:9 WebP scene plate with clean panel-safe space", `${commonBackgroundNegative}, no action combat foreground`, "webp", "background"),
    slot("player", "player.panel", "Main panel or avatar", "主面板、头像或经营主体", "single avatar portrait, shop mascot, card hero, or management panel emblem", "isolated centered transparent PNG UI-friendly sprite", `${commonSpriteNegative}, no full background`, "png", "sprite"),
    slot("hazard", "hazard.timer", "Risk or timer icon", "倒计时、风险或压力提示", "single warning timer, angry customer icon, danger card, or risk marker", "isolated centered transparent PNG sprite/icon", `${commonSpriteNegative}, no reward, no player`, "png", "sprite"),
    slot("collectible", "item.collectible", "Order or currency reward", "订单、卡牌或货币奖励", "single order ticket, coin, card reward, receipt, or upgrade token", "isolated centered transparent PNG sprite/icon", `${commonSpriteNegative}, no hazard, no player`, "png", "sprite")
  ], [["background"], ["player"], ["hazard"], ["collectible"]])
};

export const THREE_ASSET_PROFILES: Record<ThreeGameGenre, GameAssetProfile> = {
  flight_shooter: threeProfile("flight_shooter", "flight corridor skybox", "spaceship or fighter craft", "asteroid or enemy ship", "energy core"),
  runner: threeProfile("runner", "lane track or race course", "runner character or vehicle", "gate, barrier, or roadblock", "coin or badge"),
  third_person_collect: threeProfile("third_person_collect", "small open 3D scene", "third-person character", "patrol guard or chaser", "treasure or quest item"),
  exploration: threeProfile("exploration", "gallery, ruin, or landmark scene", "explorer or probe", "light environmental obstacle", "discovery crystal or landmark sample"),
  dodge_collect: threeProfile("dodge_collect", "arena playfield", "arena avatar or controllable ball", "tracking orb or orbiting hazard", "bonus reward ball"),
  futuristic_tower_defense: threeProfile("futuristic_tower_defense", "futuristic defense path map", "base core or turret", "drone or robot wave enemy", "energy resource")
};

export function getPhaserAssetProfile(templateFamily: TemplateFamily): GameAssetProfile {
  return PHASER_ASSET_PROFILES[templateFamily];
}

export function getThreeAssetProfile(genre: ThreeGameGenre): GameAssetProfile {
  return THREE_ASSET_PROFILES[genre];
}

export function getPhaserSlotProfile(templateFamily: TemplateFamily, slotName: RuntimeImageSlot): GameAssetSlotProfile {
  return getPhaserAssetProfile(templateFamily).slots[slotName];
}

export function getAssetKeyForTemplateSlot(templateFamily: TemplateFamily, slotName: RuntimeImageSlot): string {
  return getPhaserSlotProfile(templateFamily, slotName).assetKey;
}

export function getCompatibleAssetKeysForSlot(slotName: RuntimeImageSlot): string[] {
  return Array.from(new Set(Object.values(PHASER_ASSET_PROFILES).map((profile) => profile.slots[slotName].assetKey)));
}

export function refineAssetSubjectForIdea(idea: string, slotName: RuntimeImageSlot, fallback: string): string {
  const text = idea.toLowerCase();
  const hasSpaceCat = /太空猫|space cat|猫/.test(idea) || /cat/.test(text);
  const hasShip = /飞船|飞机|战机|ship|spaceship|fighter|jet/.test(idea) || /ship|spaceship|fighter|jet/.test(text);
  const hasMeteor = /陨石|流星|小行星|meteor|asteroid/.test(idea) || /meteor|asteroid/.test(text);
  const hasFish = /鱼干|fish/.test(idea) || /fish/.test(text);
  const hasCoin = /金币|coin|gold/.test(idea) || /coin|gold/.test(text);
  const hasEnergy = /能量|能源|energy|battery|core/.test(idea) || /energy|battery|core/.test(text);
  if (slotName === "player" && hasSpaceCat && hasShip) return "太空猫飞船 player ship, single readable controllable subject";
  if (slotName === "player" && hasShip) return "玩家飞船 player ship, single readable controllable subject";
  if (slotName === "hazard" && hasMeteor) return "陨石危险物 meteor asteroid hazard, single threatening obstacle";
  if (slotName === "collectible" && hasFish) return "鱼干收集物 dried fish reward collectible, single pickup item";
  if (slotName === "collectible" && hasCoin) return "金币收益物 coin gold reward collectible, single pickup item";
  if (slotName === "collectible" && hasEnergy) return "能量收益物 energy battery reward collectible, single pickup item";
  return fallback;
}

function profile(
  id: TemplateFamily,
  engineType: "phaser2d",
  slots: GameAssetSlotProfile[],
  generationOrder: RuntimeImageSlot[][]
): GameAssetProfile {
  return {
    id,
    engineType,
    slots: slots.reduce((map, item) => ({ ...map, [item.slot]: item }), {} as Record<RuntimeImageSlot, GameAssetSlotProfile>),
    generationOrder
  };
}

function threeProfile(
  id: ThreeGameGenre,
  background: string,
  player: string,
  hazard: string,
  collectible: string
): GameAssetProfile {
  return {
    id,
    engineType: "threejs3d",
    slots: {
      background: slot("background", "three.scene.environment", "3D scene environment", "3D场景", background, "low-poly 3D scene blockout, readable gameplay space", commonBackgroundNegative, "webp", "background"),
      player: slot("player", "three.model.player", "3D player model", "3D玩家模型", player, "single low-poly GLB model, centered origin, clean silhouette", `${commonSpriteNegative}, no full scene`, "png", "sprite"),
      hazard: slot("hazard", "three.model.hazard", "3D hazard model", "3D危险物模型", hazard, "single low-poly GLB model, centered origin, readable threat", `${commonSpriteNegative}, no reward`, "png", "sprite"),
      collectible: slot("collectible", "three.model.collectible", "3D reward model", "3D奖励模型", collectible, "single low-poly GLB model, centered origin, readable pickup", `${commonSpriteNegative}, no hazard`, "png", "sprite")
    },
    generationOrder: [["background", "player", "hazard", "collectible"]]
  };
}

function slot(
  slotName: RuntimeImageSlot,
  assetKey: string,
  label: string,
  purpose: string,
  subject: string,
  composition: string,
  negativePrompt: string,
  format: "png" | "webp",
  promptType: "background" | "sprite"
): GameAssetSlotProfile {
  return { slot: slotName, assetKey, label, purpose, subject, composition, negativePrompt, format, promptType };
}
