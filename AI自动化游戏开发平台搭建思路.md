# AI 自动化游戏开发平台搭建思路

## Summary

目标是先建设一个 Web 端轻量 AI 游戏生成平台：用户输入一句创意，系统通过对话追问补齐玩法信息，生成标准 GDD、资源需求、游戏配置、可试玩 Phaser Demo，并发布到站内 Play 页面。

第一阶段不追求完整商业游戏生产，重点验证“可玩概念生成”的稳定闭环。AI 负责创意拆解、标准产物生成、配置生成和迭代建议；人类保留创意确认、质量审核和最终发布判断。

## Key Architecture

- 前端：React + TypeScript + Vite，包含创建页、Studio、资源库、预览、Play、项目列表。
- 游戏运行时：Phaser，第一阶段只生成 2D Web 小游戏。
- 后端边界：Node/Vite API，中间件读取服务端环境变量并调用模型与存储服务。
- 数据层：第一阶段使用本地 JSON，后续可迁移 SQLite 或云数据库。
- 模型层：通过 Model Gateway 统一接入 DeepSeek、Mock Provider 和未来多媒体生成模型。
- 编排层：Pipeline Orchestrator 将每个阶段的标准输出传给下一阶段。

## Standard Pipeline

1. Idea Intake：收集一句话创意、目标风格、游戏类型偏好。
2. Guided Questions：追问 3-5 个关键问题，补齐目标、失败条件、操作方式、视觉风格和时长。
3. Technical GDD：生成游戏说明、角色/实体、核心循环、数值、关卡、胜负条件。
4. Asset Protocol：生成图片、音效、BGM、特效、UI 的资源需求与 asset key。
5. Asset Production：第一阶段用占位/预设资源，后续接入真实生成模型。
6. Game Config：生成模板可读取的 `game-config.json`。
7. Playable Build：Phaser 模板读取配置与资源包，生成可试玩 Demo。
8. Play & Iterate：发布到 Play 页面，收集评分与反馈，生成下一版迭代建议。

## MVP Acceptance Criteria

- 用户可以输入创意并完成对话追问。
- 系统可以生成标准产物、资源包、游戏配置和可试玩版本。
- 游戏具备开始、操作、胜利、失败、重新开始流程。
- Play 页面可打开发布版本，支持反馈提交。
- 分享链接可复制，并能在刷新后重新读取同一版本。
- DeepSeek 不可用时，Mock fallback 仍能保证 Demo 可运行。

## Current Priority

下一阶段优先稳定对外 Demo：清理乱码、稳定本地启动与 tunnel 访问、强化持久化回放、补齐端到端回归测试。
