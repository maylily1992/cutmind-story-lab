import type {
  AIProxyResponse,
  Dimension,
  PayoffType,
  TechniqueNode,
  TechniqueParseResult,
} from "../domain/types";

const DIMENSIONS: Dimension[] = [
  "结构",
  "信息",
  "视角",
  "时间",
  "空间",
  "声音",
  "剪辑",
  "表演",
  "元叙事",
  "方法",
];

const PAYOFFS: PayoffType[] = [
  "重读前文",
  "重置前提",
  "情绪反转",
  "身份重认",
  "关系重估",
  "体验强化",
  "方法生成",
];

const DIMENSION_HINTS: Array<[Dimension, string[]]> = [
  ["信息", ["信息", "误导", "真相", "诡计", "揭示", "悬念", "反讽"]],
  ["视角", ["视角", "叙述者", "人物", "凝视", "不可靠"]],
  ["时间", ["时间", "闪回", "闪前", "倒叙", "循环", "时序"]],
  ["空间", ["空间", "构图", "画框", "门窗", "地图", "建筑"]],
  ["声音", ["声音", "声画", "静音", "对白", "拟音", "音乐"]],
  ["剪辑", ["剪辑", "切", "蒙太奇", "转场", "节奏", "跳切"]],
  ["表演", ["表演", "身体", "姿态", "表情", "动作"]],
  ["元叙事", ["元叙事", "第四堵墙", "自反", "跨层", "媒介"]],
  ["方法", ["方法", "规则", "约束", "工作流", "实验"]],
  ["结构", ["结构", "嵌套", "回环", "线", "章节", "同构"]],
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[「」『』"'“”‘’（）()《》<>·,，。.!！?？:：;；\s_-]/g, "");
}

function similarity(a: string, b: string): number {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }
  const grams = (value: string): Set<string> => {
    if (value.length < 3) return new Set([value]);
    return new Set(
      Array.from({ length: value.length - 2 }, (_, index) =>
        value.slice(index, index + 3),
      ),
    );
  };
  const aGrams = grams(left);
  const bGrams = grams(right);
  const shared = [...aGrams].filter((gram) => bGrams.has(gram)).length;
  return shared / Math.max(1, new Set([...aGrams, ...bGrams]).size);
}

export function findLikelyDuplicate(
  candidateName: string,
  nodes: TechniqueNode[],
): { node: TechniqueNode; score: number } | null {
  let best: { node: TechniqueNode; score: number } | null = null;
  for (const node of nodes) {
    const score = Math.max(
      similarity(candidateName, node.name),
      ...node.aliases.map((alias) => similarity(candidateName, alias)),
    );
    if (!best || score > best.score) best = { node, score };
  }
  return best && best.score >= 0.68 ? best : null;
}

function inferDimension(input: string): Dimension {
  for (const [dimension, words] of DIMENSION_HINTS) {
    if (words.some((word) => input.includes(word))) return dimension;
  }
  return "方法";
}

function inferPayoff(input: string, dimension: Dimension): PayoffType {
  if (/反转|情绪|共情|不适/.test(input)) return "情绪反转";
  if (/身份|谁|替身|名字/.test(input)) return "身份重认";
  if (/重读|回看|前文|伏笔/.test(input)) return "重读前文";
  if (/前提|世界|虚构|规则/.test(input)) return "重置前提";
  if (dimension === "方法") return "方法生成";
  if (dimension === "空间" || dimension === "视角") return "关系重估";
  return "体验强化";
}

function extractCandidateName(input: string): string {
  const quoted = input.match(/[「『“"]([^」』”"]{2,24})[」』”"]/);
  if (quoted?.[1]) return quoted[1].trim();
  const beforeIs = input.split(/(?:是|就是|叫做|可以称为|相当于)/)[0]?.trim();
  if (beforeIs && beforeIs.length >= 2 && beforeIs.length <= 24) return beforeIs;
  return input.trim().slice(0, 18) || "未命名技法";
}

function candidateAliases(input: string): string[] {
  const latin = input.match(/[A-Za-z][A-Za-z /-]{2,40}/g) ?? [];
  return [...new Set(latin.map((value) => value.trim()))].slice(0, 3);
}

export function parseTechniqueLocally(
  rawInput: string,
  nodes: TechniqueNode[],
): TechniqueParseResult {
  const candidateName = extractCandidateName(rawInput);
  const duplicate = findLikelyDuplicate(candidateName, nodes);
  const dimension = inferDimension(rawInput);
  const debtHints = nodes.filter((node) => {
    const normalized = normalize(rawInput);
    return (
      normalized.includes(normalize(node.name)) ||
      node.aliases.some((alias) => normalized.includes(normalize(alias)))
    );
  });
  const related = [...new Set(debtHints.map((node) => node.id))].slice(0, 8);
  return {
    isExisting: Boolean(duplicate),
    matchedNodeId: duplicate?.node.id ?? null,
    confidence: duplicate?.score ?? 0.52,
    name: duplicate?.node.name ?? candidateName,
    aliases: duplicate?.node.aliases ?? candidateAliases(rawInput),
    dimension: duplicate?.node.dimension ?? dimension,
    mechanism:
      duplicate?.node.mechanism ??
      rawInput.replace(candidateName, "").trim().slice(0, 180),
    payoffType: duplicate?.node.payoffType ?? inferPayoff(rawInput, dimension),
    relatedNodeIds: related.filter((id) => id !== duplicate?.node.id),
    parentId: duplicate?.node.parentId ?? null,
    reason: duplicate
      ? `本地判重：与「${duplicate.node.name}」相似度 ${(duplicate.score * 100).toFixed(0)}%`
      : "本地解析：未找到高相似节点，建议生成草稿卡。",
    suggestedStatus: duplicate ? "confirmed" : "draft",
  };
}

export const TECHNIQUE_PARSE_SYSTEM_PROMPT = `你是“切面”的叙事技法分类器。你的任务不是写影评，而是把用户的原始捕捉转换成可挂入知识网的技法草稿。

规则：
1. 先判重。将候选名称和别名与给定节点比较；同一机制只换说法时应匹配已有节点。
2. 区分观察、机制、命名。用户只描述效果时，不要伪造既成术语。
3. dimension 只能是：结构、信息、视角、时间、空间、声音、剪辑、表演、元叙事、方法。
4. payoffType 只能是：重读前文、重置前提、情绪反转、身份重认、关系重估、体验强化、方法生成。
5. relatedNodeIds 只使用候选列表中存在的 id，最多 6 个。
6. 若已有节点匹配，name 使用节点正式名，isExisting=true；否则 status=draft。
7. confidence 为 0–1。证据不足时低于 0.65，不得假装确定。

只输出 JSON，不要 Markdown：
{
  "isExisting": boolean,
  "matchedNodeId": string|null,
  "confidence": number,
  "name": string,
  "aliases": string[],
  "dimension": string,
  "mechanism": string,
  "payoffType": string,
  "relatedNodeIds": string[],
  "parentId": string|null,
  "reason": string,
  "suggestedStatus": "draft"|"confirmed"
}`;

function parseAIResult(value: unknown): TechniqueParseResult | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const mechanism =
    typeof record.mechanism === "string" ? record.mechanism.trim() : "";
  if (!name || !mechanism) return null;
  const dimension = DIMENSIONS.includes(record.dimension as Dimension)
    ? (record.dimension as Dimension)
    : "方法";
  const payoffType = PAYOFFS.includes(record.payoffType as PayoffType)
    ? (record.payoffType as PayoffType)
    : "方法生成";
  const confidence =
    typeof record.confidence === "number"
      ? Math.max(0, Math.min(1, record.confidence))
      : 0.5;
  return {
    isExisting: Boolean(record.isExisting),
    matchedNodeId:
      typeof record.matchedNodeId === "string" ? record.matchedNodeId : null,
    confidence,
    name,
    aliases: Array.isArray(record.aliases)
      ? record.aliases.filter((item): item is string => typeof item === "string")
      : [],
    dimension,
    mechanism,
    payoffType,
    relatedNodeIds: Array.isArray(record.relatedNodeIds)
      ? record.relatedNodeIds.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    parentId: typeof record.parentId === "string" ? record.parentId : null,
    reason: typeof record.reason === "string" ? record.reason : "AI 解析",
    suggestedStatus:
      record.suggestedStatus === "confirmed" ? "confirmed" : "draft",
  };
}

export async function parseTechniqueWithProxy(
  rawInput: string,
  mode: "quick" | "paste" | "feeling",
  nodes: TechniqueNode[],
  signal?: AbortSignal,
): Promise<TechniqueParseResult> {
  const endpoint = import.meta.env.VITE_AI_PROXY_URL?.trim();
  if (!endpoint) return parseTechniqueLocally(rawInput, nodes);

  const compactCatalog = nodes
    .map(
      (node) =>
        `${node.id}|${node.name}|${node.aliases.join("/")}|${node.dimension}|${node.parentId ?? ""}`,
    )
    .join("\n");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "technique.parse",
      mode,
      system: TECHNIQUE_PARSE_SYSTEM_PROMPT,
      user: `候选节点：\n${compactCatalog}\n\n用户输入：\n${rawInput}`,
      responseFormat: "json",
    }),
    signal,
  });
  if (!response.ok) throw new Error(`AI 代理返回 ${response.status}`);
  const payload = (await response.json()) as AIProxyResponse;
  const content = payload.content ?? payload.text;
  const value =
    payload.result ??
    (typeof content === "string"
      ? JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? content)
      : null);
  const parsed = parseAIResult(value);
  if (!parsed) throw new Error("AI 返回的技法 JSON 无法校验");
  if (parsed.matchedNodeId) {
    const node = nodes.find((item) => item.id === parsed.matchedNodeId);
    if (node) {
      parsed.name = node.name;
      parsed.parentId = node.parentId;
    }
  }
  parsed.relatedNodeIds = parsed.relatedNodeIds.filter((id) =>
    nodes.some((node) => node.id === id),
  );
  return parsed;
}
