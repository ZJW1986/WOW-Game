# AI 游戏开发自动化平台方案

## Summary
目标是先做一个“Web 轻量概念游戏生成平台”：用户输入一句想法，系统自动完成玩法拆解、策划文档、代码生成、素材生成、构建、自动测试、试玩报告，并在人工审核后发布给玩家。

第一阶段不追求生成大型商业游戏，而是把“可玩概念验证”做到稳定、低成本、可迭代。核心判断：AI 负责 80% 以上生产流程，人类只保留创意确认、质量审核、合规发布三个关键节点。

参考市场能力：OpenAI Codex 已定位为多 Agent 工程工作流工具，Unity AI 提供游戏开发内置 Agent、AI Gateway 和 MCP Server，Cursor 是成熟 AI coding agent，Roblox 也提供创作助手能力。平台应做“编排层”，不要绑定单一工具供应商。参考：[OpenAI Codex](https://openai.com/codex/)、[Unity AI](https://unity.com/products/muse)、[Roblox Assistant](https://create.roblox.com/docs/assistant)、[Cursor](https://www.cursor.com/)。

## Key Changes
- MVP 技术栈固定为 `TypeScript + Vite + Phaser`，优先生成 2D Web 游戏；3D、Unity、Roblox 作为后续适配器。
- 平台核心由五层组成：创意输入层、Agent 编排层、游戏生成层、自动验收层、人工审核与发布层。
- 每个游戏使用独立项目沙盒和 Git 仓库，AI Agent 只能在限定模板、资产目录、测试命令、发布命令内工作。
- 所有游戏都生成统一的 `GameManifest`：标题、玩法类型、操作方式、胜负条件、关卡配置、素材清单、测试标准、发布状态。
- 发布策略采用“AI 生成 + 自动测试 + 人审后发布”，避免第一版直接公网全自动上线带来的质量、版权和合规风险。

## Implementation Changes
- 建立 Agent 流水线：
  1. `Idea Agent`：把用户输入扩展成游戏定位、目标玩家、核心循环。
  2. `GDD Agent`：生成轻量 Game Design Document。
  3. `System Designer Agent`：选择模板、引擎、玩法模块和数据结构。
  4. `Code Agent`：基于 Phaser 模板生成可运行代码。
  5. `Asset Agent`：生成或检索图片、音效、UI 素材，并记录来源和授权。
  6. `QA Agent`：运行构建、Playwright 自动试玩、截图检查、控制台错误检查。
  7. `Review Agent`：输出问题清单、可玩性评分、发布建议。
  8. `Publish Agent`：在人审通过后部署到 Cloudflare Pages、Vercel 或自建静态托管。

- 建立模板系统：
  - 第一批只做 5 类高成功率模板：躲避、射击、平台跳跃、解谜、合成/放置。
  - 每个模板提供固定接口：`initGame(config)`、`updateGameState()`、`handleInput()`、`checkWinLose()`、`emitTelemetry()`。
  - AI 只能组合和参数化模板，避免完全自由生成导致不可控。

- 建立自动验收标准：
  - `npm install/build/test` 必须通过。
  - 页面无白屏、无控制台错误、首屏 3 秒内可交互。
  - Playwright 模拟键盘/鼠标操作至少 60 秒。
  - 自动截图检查主要画布非空、UI 不重叠、按钮可点击。
  - 游戏必须具备开始、游玩、失败/胜利、重新开始流程。

- 建立迭代闭环：
  - 玩家行为数据采集：启动率、游玩时长、失败点、重开率、完成率。
  - AI 根据数据生成改版建议。
  - 人类选择“加强趣味”“降低难度”“换美术风格”“增加关卡”等方向后再次进入流水线。

## Test Plan
- 单元测试：模板玩法逻辑、胜负条件、配置解析、计分系统。
- 集成测试：从一句创意到完整项目生成，验证产物目录、manifest、构建命令、发布包。
- 端到端测试：浏览器打开游戏，自动操作 60 秒，检查截图、错误日志和基础可玩流程。
- 回归测试：每次模板或 Agent prompt 改动后，批量生成 10 个样例游戏并比较成功率。
- 人审验收：可玩性、内容安全、版权风险、视觉完整度、移动端适配。

## Assumptions
- 第一版目标用户是非技术创作者、小团队、教育/活动场景，而不是 AAA 或重度商业手游团队。
- 第一版只承诺生成“概念游戏 / playable prototype”，不承诺完整商业化游戏。
- 默认发布前需要人工审核；公网全自动发布放到第二阶段。
- AI 工具采用可替换供应商架构：Codex、Cursor、Claude Code、Unity AI、图像/音频生成工具都作为适配器接入。
- 平台长期壁垒不是单次生成代码，而是模板资产库、自动验收体系、玩家反馈数据、迭代优化流水线。
