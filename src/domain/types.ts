export type Dimension =
  | "结构"
  | "信息"
  | "视角"
  | "时间"
  | "空间"
  | "声音"
  | "剪辑"
  | "表演"
  | "元叙事"
  | "方法";

export type PayoffType =
  | "重读前文"
  | "重置前提"
  | "情绪反转"
  | "身份重认"
  | "关系重估"
  | "体验强化"
  | "方法生成";

export type MasterLevel = 0 | 1 | 2 | 3;
export type CaptureMode = "quick" | "feeling" | "paste";
export type CaptureStatus = "feeling" | "parsed" | "confirmed" | "rejected";
export type NodeStatus = "seed" | "draft" | "confirmed" | "merged";

export interface FilmRef {
  id: string;
  title: string;
  year?: number;
  timestamp?: string;
  scene?: string;
  note?: string;
}

export interface TechniqueNode {
  id: string;
  name: string;
  aliases: string[];
  dimension: Dimension;
  mechanism: string;
  payoffType: PayoffType;
  examples: FilmRef[];
  related: string[];
  parentId: string | null;
  myUsageCount: number;
  masterLevel: MasterLevel;
  status: NodeStatus;
  provenance: "canonical" | "practitioner" | "working" | "user" | "imported";
  sourceLabel?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilmCut {
  id: string;
  film: string;
  year?: number;
  timestamp: string;
  techniqueIds: string[];
  whatHappened: string;
  whyWorks: string;
  cutIdea: string;
  mood: string[];
  createdAt: string;
  confidence: "confirmed" | "supported" | "speculative";
}

export interface DecisionLog {
  id: string;
  at: string;
  action: "cut" | "hold" | "overlap" | "mute" | "reverse";
  reason: string;
  techniqueId?: string;
}

export interface MyWork {
  id: string;
  title: string;
  duration: number;
  createdAt: string;
  rawFootageTags: string[];
  techniqueUsed: Array<{ id: string; moment: string; strength: 1 | 2 | 3 | 4 | 5 }>;
  pacingCurve: number[];
  soundDesign: string[];
  decisions: DecisionLog[];
  localFile?: {
    name: string;
    size: number;
    type: string;
  };
}

export interface StyleFingerprint {
  id: string;
  workIds: string[];
  createdAt: string;
  frequentGrammar: string[];
  narrativePreference: string;
  emotionalCurve: string;
  repeatedMoves: string[];
  blindSpots: string[];
  signature: string;
  evidence: string[];
}

export interface TrainingPlan {
  id: string;
  createdAt: string;
  sourceFingerprintId: string;
  acquireTechniqueIds: string[];
  misuseWarnings: string[];
  days: Array<{ day: number; task: string; techniqueId?: string }>;
}

export interface TechniqueParseResult {
  isExisting: boolean;
  matchedNodeId: string | null;
  confidence: number;
  name: string;
  aliases: string[];
  dimension: Dimension;
  mechanism: string;
  payoffType: PayoffType;
  relatedNodeIds: string[];
  parentId: string | null;
  reason: string;
  suggestedStatus: "draft" | "confirmed";
}

export interface CaptureDraft {
  id: string;
  mode: CaptureMode;
  rawInput: string;
  feelingWords: string[];
  parsed: TechniqueParseResult | null;
  status: CaptureStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CutMindStore {
  schemaVersion: 2;
  techniques: TechniqueNode[];
  filmCuts: FilmCut[];
  works: MyWork[];
  fingerprints: StyleFingerprint[];
  trainingPlans: TrainingPlan[];
  captures: CaptureDraft[];
  profile: Record<string, number>;
  lastUpdatedAt: string;
}

export interface AIProxyResponse {
  content?: string;
  text?: string;
  result?: unknown;
}
