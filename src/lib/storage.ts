import { createSeedTechniques } from "../data/catalog";
import type {
  CaptureDraft,
  CutMindStore,
  TechniqueNode,
} from "../domain/types";

const STORAGE_KEY = "cutmind-story-os-v2";
const LEGACY_KEY = "cutmind-story-lab-v1";

function emptyStore(): CutMindStore {
  return {
    schemaVersion: 2,
    techniques: createSeedTechniques(),
    filmCuts: [],
    works: [],
    fingerprints: [],
    trainingPlans: [],
    captures: [],
    profile: {},
    lastUpdatedAt: new Date().toISOString(),
  };
}

function mergeTechniques(
  seeds: TechniqueNode[],
  saved: TechniqueNode[],
): TechniqueNode[] {
  const merged = new Map(seeds.map((node) => [node.id, node]));
  for (const node of saved) {
    if (!node?.id || !node?.name) continue;
    const existing = merged.get(node.id);
    merged.set(node.id, existing ? { ...existing, ...node } : node);
  }
  return [...merged.values()];
}

export function loadStore(): CutMindStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CutMindStore>;
      const seeds = createSeedTechniques();
      return {
        ...emptyStore(),
        ...parsed,
        schemaVersion: 2,
        techniques: mergeTechniques(
          seeds,
          Array.isArray(parsed.techniques) ? parsed.techniques : [],
        ),
        filmCuts: Array.isArray(parsed.filmCuts) ? parsed.filmCuts : [],
        works: Array.isArray(parsed.works) ? parsed.works : [],
        fingerprints: Array.isArray(parsed.fingerprints)
          ? parsed.fingerprints
          : [],
        trainingPlans: Array.isArray(parsed.trainingPlans)
          ? parsed.trainingPlans
          : [],
        captures: Array.isArray(parsed.captures) ? parsed.captures : [],
        profile: parsed.profile ?? {},
        lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
      };
    }

    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Record<string, unknown>;
      return {
        ...emptyStore(),
        profile:
          legacy.profile && typeof legacy.profile === "object"
            ? (legacy.profile as Record<string, number>)
            : {},
        lastUpdatedAt: new Date().toISOString(),
      };
    }
  } catch {
    // A malformed local store must not prevent the P0 workspace from opening.
  }
  return emptyStore();
}

export function saveStore(store: CutMindStore): void {
  const next = { ...store, lastUpdatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearStore(): CutMindStore {
  localStorage.removeItem(STORAGE_KEY);
  const store = emptyStore();
  saveStore(store);
  return store;
}

export function upsertNode(
  store: CutMindStore,
  node: TechniqueNode,
): CutMindStore {
  const existingIndex = store.techniques.findIndex((item) => item.id === node.id);
  const techniques =
    existingIndex >= 0
      ? store.techniques.map((item, index) =>
          index === existingIndex ? node : item,
        )
      : [...store.techniques, node];

  const relatedTargets = new Set(node.related);
  const linked = techniques.map((item) => {
    if (item.id === node.id) return node;
    if (relatedTargets.has(item.id)) {
      return {
        ...item,
        related: [...new Set([...item.related, node.id])],
      };
    }
    return item;
  });
  return { ...store, techniques: linked };
}

export function removeRelatedReference(
  store: CutMindStore,
  fromId: string,
  toId: string,
): CutMindStore {
  return {
    ...store,
    techniques: store.techniques.map((node) =>
      node.id === fromId
        ? { ...node, related: node.related.filter((id) => id !== toId) }
        : node,
    ),
  };
}

export function appendCapture(
  store: CutMindStore,
  draft: CaptureDraft,
): CutMindStore {
  return {
    ...store,
    captures: [draft, ...store.captures].slice(0, 200),
  };
}

export function updateCapture(
  store: CutMindStore,
  draft: CaptureDraft,
): CutMindStore {
  return {
    ...store,
    captures: store.captures.map((item) =>
      item.id === draft.id ? draft : item,
    ),
  };
}
