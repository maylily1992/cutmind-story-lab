import { useEffect, useMemo, useState } from "react";
import { AtlasGalaxy } from "./components/AtlasGalaxy";
import { NodeDetailSheet } from "./components/NodeDetailSheet";
import { QuickCapture } from "./components/QuickCapture";
import {
  creativePrinciples,
  deepTechniques,
  masters,
  profileTraits,
  rareCases,
  sources,
  sprintPlan,
} from "./data/catalog";
import type {
  CaptureDraft,
  CutMindStore,
  Dimension,
  TechniqueNode,
} from "./domain/types";
import {
  appendCapture,
  loadStore,
  saveStore,
  upsertNode,
} from "./lib/storage";

type Route = "home" | "atlas" | "capture" | "works" | "profile";

const DIMENSION_TO_PROFILE: Record<Dimension, string> = {
  结构: "rhyme",
  信息: "information",
  视角: "pov",
  时间: "time",
  空间: "spatial",
  声音: "sound",
  剪辑: "ellipsis",
  表演: "performance",
  元叙事: "reflexivity",
  方法: "invention",
};

function dayIndex(): number {
  const start = new Date(2026, 9, 25);
  const now = new Date();
  const days = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      start.getTime()) /
      86400000,
  );
  return Math.min(28, Math.max(1, days + 1));
}

function byDay<T>(items: T[], count: number, offset = 0): T[] {
  if (!items.length) return [];
  const day = dayIndex();
  return Array.from(
    { length: Math.min(count, items.length) },
    (_, index) => items[(day * 3 + offset + index * 7) % items.length],
  );
}

function App() {
  const [store, setStore] = useState<CutMindStore>(() => loadStore());
  const [route, setRoute] = useState<Route>("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [workTitle, setWorkTitle] = useState("");
  const [workDuration, setWorkDuration] = useState("");
  const [workTags, setWorkTags] = useState("");

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const currentSprint = sprintPlan[dayIndex() - 1];
  const selectedNode = selectedId
    ? store.techniques.find((node) => node.id === selectedId) ?? null
    : null;

  function commitTechnique(node: TechniqueNode, capture: CaptureDraft) {
    setStore((current) => {
      const withNode = upsertNode(current, node);
      const profileKey = DIMENSION_TO_PROFILE[node.dimension];
      return appendCapture(
        {
          ...withNode,
          profile: {
            ...withNode.profile,
            [profileKey]: Math.min(100, (withNode.profile[profileKey] ?? 0) + 1),
          },
        },
        capture,
      );
    });
    setSelectedId(node.id);
    setRoute("atlas");
  }

  function saveFeeling(capture: CaptureDraft) {
    setStore((current) => appendCapture(current, capture));
  }

  function createWork() {
    if (!workTitle.trim()) return;
    setStore((current) => ({
      ...current,
      works: [
        {
          id: `work-${crypto.randomUUID()}`,
          title: workTitle.trim(),
          duration: Number(workDuration) || 0,
          createdAt: new Date().toISOString(),
          rawFootageTags: workTags.split(/[、,，\s]+/).filter(Boolean),
          techniqueUsed: [],
          pacingCurve: [],
          soundDesign: [],
          decisions: [],
        },
        ...current.works,
      ],
    }));
    setWorkTitle("");
    setWorkDuration("");
    setWorkTags("");
  }

  const navItems: Array<{ id: Route; label: string; icon: string }> = [
    { id: "home", label: "今日", icon: "◈" },
    { id: "atlas", label: "图谱", icon: "⌘" },
    { id: "capture", label: "快捕", icon: "＋" },
    { id: "works", label: "作品", icon: "▣" },
    { id: "profile", label: "我", icon: "◉" },
  ];

  return (
    <div className="app-shell">
      <div className="film-grain" aria-hidden="true" />
      <header className="topbar">
        <button className="brand" onClick={() => setRoute("home")} type="button">
          <span className="brand-frame"><i /></span>
          <span className="brand-word"><b>切面</b><small>CUT / STORY OS</small></span>
        </button>
        <button
          className="top-capture"
          onClick={() => setRoute("capture")}
          type="button"
        >
          <span>＋</span>
          收一刀
        </button>
      </header>
      <main className="main">
        {route === "home" ? (
          <HomePage
            currentSprint={currentSprint}
            onCapture={() => setRoute("capture")}
            onOpenNode={(id) => {
              setSelectedId(id);
              setRoute("atlas");
            }}
            store={store}
          />
        ) : null}
        {route === "atlas" ? (
          <AtlasPage
            nodes={store.techniques}
            onClear={() => setSelectedId(null)}
            onSelect={setSelectedId}
            query={query}
            selectedNode={selectedNode}
            setQuery={setQuery}
          />
        ) : null}
        {route === "capture" ? (
          <CapturePage
            nodes={store.techniques}
            onFeeling={saveFeeling}
            onSave={commitTechnique}
          />
        ) : null}
        {route === "works" ? (
          <WorksPage
            onCreate={createWork}
            onDuration={setWorkDuration}
            onTags={setWorkTags}
            onTitle={setWorkTitle}
            store={store}
            title={workTitle}
            duration={workDuration}
            tags={workTags}
          />
        ) : null}
        {route === "profile" ? <ProfilePage store={store} /> : null}
      </main>
      <nav className="bottom-nav" aria-label="主导航">
        {navItems.map((item) => (
          <button
            className={`nav-item ${route === item.id ? "is-active" : ""}`}
            key={item.id}
            onClick={() => setRoute(item.id)}
            type="button"
          >
            <span className="nav-glyph">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function HomePage({
  currentSprint,
  store,
  onCapture,
  onOpenNode,
}: {
  currentSprint: (typeof sprintPlan)[number];
  store: CutMindStore;
  onCapture: () => void;
  onOpenNode: (id: string) => void;
}) {
  const techniques = useMemo(() => byDay(deepTechniques, 5, 2), []);
  const dailyNodes = useMemo(() => byDay(store.techniques, 10, 4), [store.techniques]);
  const rare = rareCases[(dayIndex() * 3) % rareCases.length];
  const master = masters[(dayIndex() - 1) % masters.length];
  return (
    <>
      <p className="eyebrow">PRIVATE NARRATIVE OS · SPRINT {dayIndex()} / 28</p>
      <h1 className="page-title">不是学名词，<br />是养成本能。</h1>
      <p className="page-lead">
        {currentSprint.goal}
      </p>
      <section className="day-hero">
        <div className="hero-top">
          <code>DAY {String(dayIndex()).padStart(2, "0")}</code>
          <span>{store.techniques.length} 个技法节点 · {store.captures.length} 次捕捉</span>
        </div>
        <h1>{currentSprint.title}</h1>
        <p>{currentSprint.lab}</p>
        <div className="hero-actions">
          <button className="button" onClick={onCapture} type="button">
            收下今天的一刀
          </button>
          <span className="hero-caption">先输入一句话，AI 再帮你判重、归类和挂关系</span>
        </div>
      </section>
      <div className="protocol-strip">
        <span><b>10</b>术语</span>
        <span><b>5</b>深技巧</span>
        <span><b>1</b>大师</span>
        <span><b>1</b>异闻</span>
        <span><b>1</b>实验</span>
      </div>
      <SectionHead title="今日十词" note="点开进入叙事肌理网" />
      <div className="dense-term-grid">
        {dailyNodes.map((node) => (
          <button
            className="dense-term"
            key={node.id}
            onClick={() => onOpenNode(node.id)}
            type="button"
          >
            <span>{node.dimension}</span>
            <b>{node.name}</b>
            <small>{node.aliases[0] ?? "personal concept"}</small>
            <p>{node.mechanism}</p>
          </button>
        ))}
      </div>
      <SectionHead title="大师决策" note={`${master.region} · ${master.role}`} />
      <article className="master-card">
        <span className="rare-type">MASTER / {master.region}</span>
        <h3>{master.name}</h3>
        <p className="master-signature">{master.signature}</p>
        <p>{master.case}</p>
      </article>
      <SectionHead title="今日五张牌" note="结构 · 信息 · 剪辑 · 画面 · 声音" />
      <div className="technique-list">
        {techniques.map((tech) => (
          <article className="technique-card" key={tech.id}>
            <div className="tech-top">
              <span className="domain-tag domain-story">{tech.domain}</span>
              <span className="tech-no">{tech.id.toUpperCase()}</span>
            </div>
            <h3>{tech.title}</h3>
            <p className="lineage">{tech.lineage}</p>
            <p className="mechanism">{tech.mechanism}</p>
            <details className="tech-details">
              <summary>机制 / 案例 / 今日实验</summary>
              <div className="tech-detail-block"><small>少见之处</small><p>{tech.edge}</p></div>
              <div className="tech-detail-block"><small>微案例</small><p>{tech.case}</p></div>
              <div className="tech-detail-block"><small>练习</small><p>{tech.exercise}</p></div>
              <div className="tech-detail-block misuse"><small>误用</small><p>{tech.misuse}</p></div>
            </details>
          </article>
        ))}
      </div>
      <SectionHead title="今日异闻" note="提取形式，不背故事" />
      <article className="rare-card">
        <span className="rare-type">{rare.type}</span>
        <h2>{rare.title}</h2>
        <p className="rare-story">{rare.story}</p>
        <div className="rare-operation"><small>形式操作</small><p>{rare.operation}</p></div>
        <div className="rare-operation"><small>迁移到剪辑</small><p>{rare.transfer}</p></div>
        <p className="provenance">来源状态：{rare.provenance}</p>
      </article>
    </>
  );
}

function AtlasPage({
  nodes,
  query,
  setQuery,
  onSelect,
  onClear,
  selectedNode,
}: {
  nodes: TechniqueNode[];
  query: string;
  setQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onClear: () => void;
  selectedNode: TechniqueNode | null;
}) {
  return (
    <>
      <p className="eyebrow">STORY TECHNIQUE ATLAS · {nodes.length} NODES</p>
      <h1 className="page-title">一张会生长的<br />叙事肌理网。</h1>
      <p className="page-lead">物 → 知 → 动 → 感 → 元。双指缩放、拖拽移动；从五层主环进入分支，再展开知识簇和具体技法。</p>
      <AtlasGalaxy
        nodes={nodes}
        onOpenNode={onSelect}
        query={query}
        setQuery={setQuery}
      />
      <SectionHead title="理论底图" note={`${sources.length} 个来源`} />
      <div className="source-list">
        {sources.slice(0, 12).map((source) => (
          <article key={source.title}>
            <b>{source.title}</b>
            <span>{source.author} · {source.area}</span>
            <small>{source.status}</small>
            {source.url ? <a href={source.url} rel="noopener" target="_blank">打开来源 ↗</a> : null}
          </article>
        ))}
      </div>
      {selectedNode ? (
        <NodeDetailSheet
          node={selectedNode}
          nodes={nodes}
          onClose={onClear}
          onNavigate={onSelect}
        />
      ) : null}
    </>
  );
}

function CapturePage({
  nodes,
  onSave,
  onFeeling,
}: {
  nodes: TechniqueNode[];
  onSave: (node: TechniqueNode, capture: CaptureDraft) => void;
  onFeeling: (capture: CaptureDraft) => void;
}) {
  return (
    <>
      <p className="eyebrow">ZERO-FRICTION CAPTURE</p>
      <h1 className="page-title">先收下，<br />再慢慢说清。</h1>
      <p className="page-lead">系统负责判重、抽别名、归维度、挂关系；你只负责判断这个判断像不像你。</p>
      <QuickCapture nodes={nodes} onFeeling={onFeeling} onSave={onSave} />
    </>
  );
}

function WorksPage({
  store,
  title,
  duration,
  tags,
  onTitle,
  onDuration,
  onTags,
  onCreate,
}: {
  store: CutMindStore;
  title: string;
  duration: string;
  tags: string;
  onTitle: (value: string) => void;
  onDuration: (value: string) => void;
  onTags: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <p className="eyebrow">MY WORK · P1 SEED</p>
      <h1 className="page-title">让作品反过来<br />读取你。</h1>
      <p className="page-lead">P0 先建立作品档案和决策数据。自动风格指纹、双版本分析和 AI 训练计划会在 P1 接入。</p>
      <div className="watch-entry">
        <div className="form-grid">
          <input className="field" onChange={(event) => onTitle(event.target.value)} placeholder="作品名" value={title} />
          <input className="field" onChange={(event) => onDuration(event.target.value)} placeholder="时长（秒）" value={duration} />
        </div>
        <input className="field" onChange={(event) => onTags(event.target.value)} placeholder="素材标签：访谈、夜景、手持…" value={tags} />
        <button className="button" onClick={onCreate} type="button">建立作品档案</button>
      </div>
      <SectionHead title="作品档案" note={`${store.works.length} 部`} />
      <div className="insight-list">
        {store.works.length ? store.works.map((work) => (
          <article className="watch-note" key={work.id}>
            <div className="watch-note-top"><b>{work.title}</b><span>{work.duration}s</span></div>
            <p>{work.rawFootageTags.join(" · ") || "尚无素材标签"}</p>
            <div className="watch-note-link">{work.decisions.length} 条剪辑决策 · 等待 P1 指纹分析</div>
          </article>
        )) : <div className="empty-state">还没有作品档案。先建立第一部，之后每次导出都回来记录决策。</div>}
      </div>
      <div className="seam-card">
        <h3>P1 · 风格指纹</h3>
        <p>下一步会把作品本地文件、镜头切点、决策日志合并为 StyleFingerprint，并生成“高频语法 / 盲区 / 作者签名 / 7 天训练”。</p>
      </div>
    </>
  );
}

function ProfilePage({ store }: { store: CutMindStore }) {
  const personalNodes = store.techniques.filter((node) => node.provenance === "user");
  const feelings = store.captures.filter((capture) => capture.status === "feeling");
  const weak = profileTraits
    .map((trait) => ({ ...trait, score: store.profile[trait.id] ?? 0 }))
    .sort((a, b) => a.score - b.score)[0];
  return (
    <>
      <p className="eyebrow">MY NARRATIVE GENOME</p>
      <h1 className="page-title">记录不是档案，<br />是下一次判断。</h1>
      <p className="page-lead">现在能记录你知道什么、你怎么命名、哪些感受暂时无法归类。很快会进一步记录你实际怎么剪。</p>
      <section className="profile-hero">
        <small>NEXT-SELF HYPOTHESIS</small>
        <h2>下一阶段先抢「{weak.label}」。</h2>
        <p>{weak.hint}。这不是评分，而是你当前最缺少证据的能力方向。</p>
      </section>
      <div className="stat-strip">
        <div><strong>{personalNodes.length}</strong><span>个人技法</span></div>
        <div><strong>{store.captures.length}</strong><span>快捕记录</span></div>
        <div><strong>{feelings.length}</strong><span>待命名感觉</span></div>
      </div>
      <SectionHead title="个人节点" note={`${personalNodes.length} 个`} />
      <div className="insight-list">
        {personalNodes.slice(0, 12).map((node) => (
          <article className="insight-item" key={node.id}>
            <b>{node.name}</b>
            <p>{node.mechanism}</p>
            <div className="insight-meta"><span>{node.dimension}</span><span>{node.status}</span></div>
          </article>
        ))}
        {!personalNodes.length ? <div className="empty-state">还没有个人技法。去快捕一个“说不太清但很牛”的瞬间。</div> : null}
      </div>
      <SectionHead title="原则底片" note="可以持续改写" />
      <div className="insight-list">
        {creativePrinciples.map((principle, index) => (
          <article className="insight-item" key={principle}>
            <b>{String(index + 1).padStart(2, "0")}</b><p>{principle}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      <p>{note}</p>
    </div>
  );
}

export default App;
