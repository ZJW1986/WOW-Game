import type { ModelTaskRequest } from "./backend";

type PromptTaskType = ModelTaskRequest["taskType"];

export function createPromptForTask(
  taskType: PromptTaskType,
  input: Record<string, unknown>
): string {
  const sharedGuardrail =
    "你是 WOW Game 的游戏生产智能体。只输出标准 JSON artifact，不要生成 Phaser 生命周期代码，不要绕过模板与资源协议。";
  const payload = JSON.stringify(input, null, 2);

  const taskInstruction: Record<PromptTaskType, string> = {
    "llm.classification":
      '任务类型 llm.classification。按 Physics-First 规则选择 templateFamily。只返回 {"templateFamily","reasons","risks","unsupportedRequests"}。',
    "llm.guided_questions":
      '任务类型 llm.guided_questions。生成 3-5 个设计追问。只返回 {"questions":[{"id","label","prompt","inputType","options","defaultAnswer","required"}]}。',
    "llm.gdd":
      '任务类型 llm.gdd。生成 6 段式技术 GDD。只返回 {"concept","loop","entities","level","numbers","implementationRoute"}。',
    "llm.game_config":
      '任务类型 llm.game_config。生成模板可读取的配置。只返回 {"templateFamily","title","pitch","playerGoal","controls","difficulty","referencedAssetKeys","level"}。',
    "image.asset":
      "根据 asset-requirements 生成图片资源任务说明，返回 assetKey、style、spec 和版权状态。",
    "audio.sfx":
      "根据 asset-requirements 生成短音效任务说明，返回用途、时长、风格和循环要求。",
    "audio.bgm":
      "根据 asset-requirements 生成 BGM 任务说明，返回用途、时长、风格和循环点。",
    "effect.preset":
      "根据玩法事件选择预设特效，返回触发条件、assetKey 和参数。"
  };

  return `${sharedGuardrail}\n\n任务：${taskInstruction[taskType]}\n\n输入：\n${payload}`;
}
