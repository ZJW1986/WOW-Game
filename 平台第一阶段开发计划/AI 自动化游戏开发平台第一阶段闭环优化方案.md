# AI 自动化游戏开发平台第一阶段闭环优化方案

## Summary

参考本地文件 `open game 2604.18394v1.pdf` 对应的论文 [OpenGame: Open Agentic Coding for Games](https://arxiv.org/abs/2604.18394)，第一阶段方案从“普通 AI 生成平台”升级为“模板驱动 + 标准产物 + 动态验证 + 可进化 Skill”的游戏生产闭环。

核心调整：不要让大模型从零自由写游戏，而是先做 **Physics-First 分类、模板骨架、配置驱动、Hook 扩展、资源协议、自动验证、Debug 协议沉淀**。论文指出，端到端游戏生成常见失败是逻辑不一致、引擎知识不足、跨文件引用错误；OpenGame 的有效做法是 Template Skill + Debug Skill + 动态浏览器评测。

## Key Changes

- **游戏分类从“题材分类”改为 Physics-First 分类**
  - 用户输入后先判断物理/空间机制，而不是只判断“射击、解谜、RPG”。
  - 第一阶段固定 5 类模板：`platformer`、`top_down`、`grid_logic`、`tower_defense`、`ui_heavy`。
  - 每类模板都有固定能力边界、资源规范、配置 schema 和可扩展 hook。

- **生成方式从“自由代码生成”改为“模板方法模式”**
  - 每个游戏先复制稳定 Phaser 项目骨架。
  - 大模型只生成标准配置、资源清单、关卡数据和少量 hook 逻辑。
  - 禁止第一阶段让模型重写引擎生命周期、场景注册、资源加载主流程。

- **每个阶段保留标准产物**
  - `idea-intake.json/md`
  - `classification.json`
  - `gdd.json/md`
  - `asset-requirements.json/md`
  - `asset-pack.json`
  - `game-config.json`
  - `qa-report.json/md`
  - `publish-record.json`
  - `iteration-report.json/md`

- **模型接入变成任务路由**
  - LLM：分类、追问、GDD、配置、迭代建议。
  - 生图：背景、角色、道具、UI、封面。
  - 音频：BGM、SFX、UI 声。
  - 特效：第一阶段用预设粒子/序列帧库，后续接生成模型。
  - 第一阶段默认 Mock Provider，真实 Provider 只做可配置适配器。

## Implementation Architecture

- **Frontend**
  - `Studio`：自然语言输入、引导问题、阶段进度。
  - `Pipeline Console`：查看每阶段标准输入/输出。
  - `Asset Hub`：图片、声音、BGM、特效、构建产物管理。
  - `Preview`：内嵌 Phaser 试玩。
  - `Play`：公开试玩页、玩家反馈、版本入口。
  - `Iteration Center`：根据反馈生成下一版修改建议。

- **Backend**
  - `Project Service`：项目、版本、发布状态。
  - `Pipeline Orchestrator`：阶段编排与状态机。
  - `Model Gateway`：统一封装 LLM/图像/音频/特效模型。
  - `Asset Service`：资源入库、metadata、引用关系。
  - `Template Service`：按分类选择 Phaser 模板。
  - `Verification Service`：构建、运行、截图、控制台错误、可玩性检查。
  - `Debug Protocol Service`：记录错误签名、根因、已验证修复方案。

- **Game Runtime**
  - 使用 `Phaser + TypeScript`。
  - 每个模板包含共享核心：启动、场景、资源加载、输入、状态、胜负、遥测。
  - 每个模板暴露有限 hook，例如 `setupEntities`、`setupCollisions`、`handleCustomRules`、`onWin`、`onLose`。

- **Data**
  - 第一阶段可用 SQLite 或本地 JSON。
  - 关键实体：`Project`、`GameVersion`、`PipelineArtifact`、`Asset`、`ModelTask`、`PlayableBuild`、`PlayFeedback`、`DebugProtocolEntry`、`TemplateFamily`。

## Standard Pipeline

1. **Idea Intake**
   - 输入一句话游戏想法。
   - 输出创意摘要、目标玩家、核心体验、待追问字段。

2. **Guided Questions**
   - 系统追问 3-5 个问题，补齐操作方式、失败条件、视觉风格、难度、目标时长。

3. **Physics-First Classification**
   - 输出模板类型：`platformer/top_down/grid_logic/tower_defense/ui_heavy`。
   - 同时输出选择理由、风险、不可支持需求。

4. **Technical GDD**
   - 输出 6 段式 GDD：概念、玩法循环、角色/实体、关卡/地图、数值、实现路线。
   - 必须符合所选模板能力，不能写第一阶段不支持的机制。

5. **Asset Protocol**
   - 从 GDD 生成资源清单。
   - 每个资源必须有 `assetKey`、类型、用途、尺寸/时长、风格、生成方式、版权状态。

6. **Asset Production**
   - 第一阶段用内置占位资源或 Mock 生成。
   - 生成 `asset-pack.json`，后续代码只能引用这里登记过的资源 key。

7. **Config & Game Build**
   - 将 GDD 参数合并为 `game-config.json`。
   - Phaser 模板读取配置生成可试玩 Demo。

8. **Verification & Self-Correction**
   - 执行构建检查、浏览器运行、截图非空、控制台错误检查、基础交互检查。
   - 输出 Build Health、Visual Usability、Intent Alignment 三类评分。
   - 失败时进入最多 3 轮修复，并把新错误写入 Debug Protocol。

9. **Play Publish**
   - 发布到站内 Play 页面。
   - 玩家可试玩、评分、反馈。

10. **Iteration**
   - 根据反馈和游玩数据生成改版建议。
   - 新版本沿用同一套标准产物链路。

## Required Skills

第一阶段应优先创建这些可执行 Skill，作为后续 Agent 工作护栏：

- `game-physics-classifier`
  - 按 Physics-First 规则选择模板，避免按模糊题材误分流。

- `game-gdd-generator`
  - 生成符合模板能力边界的技术 GDD。

- `game-asset-protocol`
  - 生成和校验 `asset-requirements.json` 与 `asset-pack.json`。

- `phaser-template-builder`
  - 从模板、配置、资源包生成 Phaser 可试玩项目。

- `game-debug-protocol`
  - 记录构建、运行、资源 key、场景注册、配置字段等常见错误和修复。

- `game-verification-bench`
  - 用 Build Health、Visual Usability、Intent Alignment 检查生成结果。

- `game-iteration-advisor`
  - 根据 Play 反馈和指标生成下一版迭代方案。

## MVP Acceptance Criteria

- 用户输入一句话后，系统能完成追问、分类、GDD、资源需求、配置、试玩、发布、反馈、迭代建议。
- 至少支持 2 个可运行模板，推荐先做 `top_down` 和 `platformer`。
- 每个阶段都有 JSON 和 Markdown 产物，且下一阶段只能消费上一阶段标准输出。
- 资源引用必须通过 `asset-pack.json`，避免模型幻觉资源 key。
- 试玩游戏必须能开始、操作、失败/胜利、重新开始。
- Play 页面能展示发布游戏并收集反馈。
- 验证报告必须包含构建状态、运行状态、截图状态、交互状态、意图对齐检查。
- Debug Protocol 能记录至少一类已验证问题，例如资源 key 不匹配或场景注册缺失。

## Test Plan

- **Pipeline Test**：从一句话输入完整跑到 Play 发布。
- **Classification Test**：验证 5 类模板的分流规则，尤其区分 `platformer`、`top_down`、`grid_logic`。
- **Artifact Test**：检查所有阶段产物存在、schema 合法、可被下一阶段读取。
- **Asset Test**：检查资源 key 不重复、不缺失，游戏代码只能引用 `asset-pack.json` 中存在的 key。
- **Build Health Test**：构建成功、页面无白屏、无致命控制台错误。
- **Visual Usability Test**：截图非空，画面有可见角色/场景/UI，基础动画或移动可见。
- **Intent Alignment Test**：根据 GDD 核心需求检查玩法是否满足。
- **Iteration Test**：提交玩家反馈后能生成新版本建议，并保留旧版本记录。

## Assumptions

- 第一阶段目标是“基础闭环稳定跑通”，不是完整自动商业化游戏生产。
- 第一阶段使用 Web 2D + Phaser，不做 Unity/Godot/Roblox 导出。
- 第一阶段真实模型可配置但不作为闭环成功的必要条件。
- 第一阶段不训练自有 GameCoder 模型，只借鉴 OpenGame 的框架方法。
- 第一阶段最多允许 3 轮自动修复，避免无限消耗 token 和时间。
- 参考来源：本地 PDF `open game 2604.18394v1.pdf`，对应 arXiv 页面 [OpenGame: Open Agentic Coding for Games](https://arxiv.org/abs/2604.18394) 和 HTML 版 [ar5iv](https://ar5iv.labs.arxiv.org/html/2604.18394v1)。
