# AI 自动化游戏开发平台第一阶段闭环方案

## Summary

第一阶段建设一个 Web 端 AI 游戏生成 MVP。用户从一句自然语言创意开始，经过引导问答、GDD、资源协议、配置生成、试玩版本、Play 发布和反馈迭代，完成第一个可体验小游戏。

第一阶段优先验证平台流程，不追求真实全模型生产。默认使用 DeepSeek 文本模型和 Mock/预设资源跑通闭环，并预留生图、音效、BGM、特效模型适配器。

## Architecture

- Frontend：React + TypeScript + Vite。
- Runtime：Phaser 2D Web game runtime。
- Backend：Vite middleware + Node API boundary。
- Data：本地 JSON store，路径为 `data/projects/{projectId}/versions/{versionId}/project.json`。
- Model：Model Gateway 统一封装 DeepSeek 和 Mock Provider。
- Pipeline：每个阶段输出标准 JSON/Markdown 产物，下一阶段只消费标准输出。

## Standard Pipeline

1. Idea Intake：输入一句游戏想法。
2. Guided Design：追问 3-5 个关键问题。
3. Technical GDD：生成玩法循环、实体、关卡、数值、实现路线。
4. Asset Requirement：生成资源需求与稳定 asset key。
5. Asset Production：使用占位/预设资源或未来生成模型。
6. Game Config：生成 Phaser 模板读取的配置。
7. Playable Build：生成可操作试玩版本。
8. Play & Iterate：发布、试玩、反馈和迭代建议。

## MVP Acceptance Criteria

- 用户输入一句创意后，可以完成追问并生成可试玩游戏。
- 至少支持 `top_down` 与 `platformer` 两个可运行方向。
- 资源引用必须来自 `asset-pack.json`。
- 试玩游戏必须支持开始、操作、胜利、失败、重新开始。
- Play 页面可展示游戏并收集反馈。
- 验证报告包含构建、视觉、意图对齐和 Debug Protocol 信息。

## Test Plan

- Pipeline test：从创意到 Play 发布完整跑通。
- Artifact test：所有标准产物存在且 schema 合法。
- Asset test：资源 key 不缺失、不重复。
- Playable test：可移动、可收集、可胜负、可重开。
- Publish test：Play 链接可打开，反馈可写入。
- Regression test：中文文案无乱码，构建和测试持续通过。
