# AI 自动化游戏开发平台第一阶段闭环优化方案

## Summary

参考 OpenGame 的方法，第一阶段从“自由生成游戏代码”调整为“模板驱动 + 标准产物 + 动态验证 + 可进化 Skill”的游戏生产闭环。

核心原则：不要让大模型从零重写 Phaser 生命周期。模型只生成分类、追问、GDD、资源清单、游戏配置和迭代建议；运行时代码由稳定模板负责。

## Key Changes

- Physics-First 分类：先判断物理/空间机制，再选择模板。
- 模板方法模式：第一阶段固定模板能力边界，模型只生成配置和有限参数。
- 标准产物链：`idea-intake`、`classification`、`gdd`、`asset-requirements`、`asset-pack`、`game-config`、`qa-report`、`publish-record`、`iteration-report`。
- 资源协议：所有运行时引用必须来自 `asset-pack.json`。
- 自动验证：检查构建、画面、交互、胜负流程、资源引用和意图对齐。
- Debug Protocol：记录常见错误签名和已验证修复方案。

## Implementation Architecture

- Frontend：Studio、Pipeline Console、Asset Hub、Preview、Play、Iteration Center。
- Backend：Project Service、Pipeline Orchestrator、Model Gateway、Asset Service、Template Service、Verification Service。
- Runtime：Phaser + TypeScript，锁定启动、场景、资源加载、输入、胜负和遥测主流程。
- Data：第一阶段使用本地 JSON，后续可迁移 SQLite 或云数据库。

## Required Skills

- `game-physics-classifier`
- `game-gdd-generator`
- `game-asset-protocol`
- `phaser-template-builder`
- `game-debug-protocol`
- `game-verification-bench`
- `game-iteration-advisor`

## MVP Acceptance Criteria

- 用户输入一句话后，系统能完成追问、分类、GDD、资源需求、配置、试玩、发布、反馈和迭代建议。
- 至少支持 `top_down` 与 `platformer` 两个可运行模板。
- 每个阶段都有标准 JSON/Markdown 产物。
- 试玩游戏支持开始、操作、失败、胜利和重新开始。
- Play 页面支持公开试玩、反馈和分享链接。
- 验证报告包含构建状态、运行状态、截图状态、交互状态和意图对齐。

## Current Next Step

当前 MVP 已能生成并试玩。下一阶段优先稳定对外展示：清理乱码、固定本地 Demo 启动方式、允许 tunnel host、强化 Play 回放和反馈持久化、补齐端到端回归测试。
