import {
  ATLAS_BRANCHES,
  ATLAS_GROUPS,
  ATLAS_LAYERS,
  ATLAS_NODES,
  MASTER_ATLAS,
  NODE_DETAILS,
  SOURCE_REGISTRY,
  SPRINT_28,
} from "../../atlas-data.js";
import {
  CREATIVE_PRINCIPLES,
  DOMAINS,
  PROFILE_TRAITS,
  RARE_CASES,
  TECHNIQUES,
} from "../../data.js";
import type {
  Dimension,
  PayoffType,
  TechniqueNode,
} from "../domain/types";

interface LegacyAtlasNode {
  id: string;
  branch: string;
  group: string;
  zh: string;
  en: string;
  def: string;
  rarity: number;
  links: string[];
  status?: string;
}

interface BranchInfo {
  id: string;
  label: string;
  en: string;
  color: string;
  essence: string;
}

interface LayerInfo {
  id: string;
  label: string;
  longLabel: string;
  question: string;
  branches: string[];
  color: string;
}

const DIMENSION_BY_BRANCH: Record<string, Dimension> = {
  narr: "结构",
  arch: "结构",
  info: "信息",
  char: "视角",
  time: "时间",
  space: "空间",
  edit: "剪辑",
  image: "空间",
  sound: "声音",
  perf: "表演",
  meta: "元叙事",
  affect: "信息",
  craft: "方法",
};

const PAYOFF_BY_BRANCH: Record<string, PayoffType> = {
  narr: "重读前文",
  arch: "重置前提",
  info: "重置前提",
  char: "身份重认",
  time: "重读前文",
  space: "关系重估",
  edit: "情绪反转",
  image: "体验强化",
  sound: "体验强化",
  perf: "情绪反转",
  meta: "重置前提",
  affect: "情绪反转",
  craft: "方法生成",
};

const PARENT_OVERRIDES: Record<string, string> = {
  n12: "i10",
  i13: "i10",
  i06: "i10",
  i11: "i10",
  m03: "m01",
  m17: "m01",
  m18: "m01",
  a11: "a10",
  m02: "a10",
  e03: "e01",
  e04: "e01",
  e05: "e01",
  e06: "e01",
  e07: "e01",
  s07: "s06",
  s08: "s06",
  s09: "s06",
  im08: "im07",
  im09: "im07",
};

export const atlasBranches = ATLAS_BRANCHES as BranchInfo[];
export const atlasLayers = ATLAS_LAYERS as LayerInfo[];
export const atlasGroups = ATLAS_GROUPS as Array<{
  id: string;
  branch: string;
  label: string;
}>;
export const masters = MASTER_ATLAS as Array<{
  id: string;
  name: string;
  region: string;
  role: string;
  signature: string;
  methods: string[];
  case: string;
}>;
export const sprintPlan = SPRINT_28 as Array<{
  day: number;
  title: string;
  focus: string;
  goal: string;
  lab: string;
}>;
export const rareCases = RARE_CASES as Array<{
  id: string;
  type: string;
  title: string;
  story: string;
  operation: string;
  transfer: string;
  misuse: string;
  provenance: string;
}>;
export const deepTechniques = TECHNIQUES as Array<{
  id: string;
  domain: string;
  title: string;
  lineage: string;
  mechanism: string;
  edge: string;
  case: string;
  exercise: string;
  question: string;
  misuse: string;
}>;
export const profileTraits = PROFILE_TRAITS as Array<{
  id: string;
  label: string;
  hint: string;
}>;
export const creativePrinciples = CREATIVE_PRINCIPLES as string[];
export const sources = SOURCE_REGISTRY as Array<{
  title: string;
  author: string;
  area: string;
  status: string;
  url?: string;
}>;
export const nodeDetails = NODE_DETAILS as Record<
  string,
  {
    analysis: string;
    example: string;
    transfer: string;
    misuse: string;
  }
>;
export const legacyDomains = DOMAINS as Record<
  string,
  { name: string; short: string; color: string }
>;

function ensureBidirectional(
  nodes: TechniqueNode[],
  sourceId: string,
  targetIds: string[],
): void {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const source = byId.get(sourceId);
  if (!source) return;
  source.related = [...new Set([...source.related, ...targetIds])].filter(
    (id) => id !== sourceId && byId.has(id),
  );
  for (const targetId of targetIds) {
    const target = byId.get(targetId);
    if (target) target.related = [...new Set([...target.related, sourceId])];
  }
}

export function createSeedTechniques(): TechniqueNode[] {
  const timestamp = "2026-10-25T00:00:00.000Z";
  const nodes: TechniqueNode[] = (ATLAS_NODES as LegacyAtlasNode[]).map(
    (node) => ({
      id: node.id,
      name: node.zh,
      aliases: [node.en].filter(Boolean),
      dimension: DIMENSION_BY_BRANCH[node.branch] ?? "方法",
      mechanism: node.def,
      payoffType: PAYOFF_BY_BRANCH[node.branch] ?? "方法生成",
      examples: [],
      related: node.links ?? [],
      parentId: PARENT_OVERRIDES[node.id] ?? null,
      myUsageCount: 0,
      masterLevel: 0,
      status: "seed",
      provenance:
        node.status === "working"
          ? "working"
          : node.status === "practitioner"
            ? "practitioner"
            : "canonical",
      sourceLabel: `${node.branch}/${node.group}`,
      notes: `legacy-rarity:${node.rarity}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  );

  for (const [childId, parentId] of Object.entries(PARENT_OVERRIDES)) {
    ensureBidirectional(nodes, parentId, [childId]);
  }
  for (const node of nodes) {
    ensureBidirectional(nodes, node.id, node.related);
  }
  return nodes;
}

export function branchLabel(branchId: string): string {
  return atlasBranches.find((branch) => branch.id === branchId)?.label ?? "个人节点";
}

export function layerForBranch(branchId: string): LayerInfo | undefined {
  return atlasLayers.find((layer) => layer.branches.includes(branchId));
}
