const STORAGE_KEY = "cutmind-story-lab-v1";

const DEFAULT_STATE = {
  profile: { ...INITIAL_PROFILE },
  insights: [],
  discussions: [],
  works: {
    mine: null,
    reference: null,
  },
  completedDays: {},
  viewingNotes: [],
  customNodes: [],
  nodeActivity: {},
  sprintStartDate: null,
  atlasLayer: null,
  atlasBranch: null,
  atlasSearch: "",
  activeNodeId: null,
  scanThreshold: 25,
  libraryDomain: "all",
  chatMessages: [],
  ai: {
    endpoint: "",
    model: "",
    key: "",
  },
};

let state = loadState();
let route = "home";
let toastTimer = null;
let deferredInstallPrompt = null;
const runtimeMedia = {
  mine: { file: null, url: "" },
  reference: { file: null, url: "" },
};
let scanJob = null;
let chatBusy = false;

if (!state.sprintStartDate) {
  state.sprintStartDate = localDateKey();
  saveState();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return clone(DEFAULT_STATE);
    return {
      ...clone(DEFAULT_STATE),
      ...saved,
      profile: { ...INITIAL_PROFILE, ...(saved.profile || {}) },
      works: { ...DEFAULT_STATE.works, ...(saved.works || {}) },
      ai: { ...DEFAULT_STATE.ai, ...(saved.ai || {}) },
      insights: Array.isArray(saved.insights) ? saved.insights : [],
      discussions: Array.isArray(saved.discussions) ? saved.discussions : [],
      chatMessages: Array.isArray(saved.chatMessages) ? saved.chatMessages : [],
      completedDays: saved.completedDays || {},
      viewingNotes: Array.isArray(saved.viewingNotes) ? saved.viewingNotes : [],
      customNodes: Array.isArray(saved.customNodes) ? saved.customNodes : [],
      nodeActivity: saved.nodeActivity || {},
    };
  } catch {
    return clone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name) {
  const paths = {
    arrow: '<path d="m9 18 6-6-6-6"/>',
    spark: '<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 5v14m8-14v14"/>',
    upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14"/>',
    scan: '<path d="M4 8V4h4m8 0h4v4m0 8v4h-4M8 20H4v-4M7 12h10"/>',
    note: '<path d="M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5"/>',
    arrowUp: '<path d="m6 11 6-6 6 6M12 5v14"/>',
    send: '<path d="m4 4 16 8-16 8 4-8zM8 12h12"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5zm16 0A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5H5v11h3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    brain: '<path d="M9 4a3 3 0 0 0-5 2.2A3 3 0 0 0 5 12a3 3 0 0 0 4 3.5V4Zm6 0a3 3 0 0 1 5 2.2A3 3 0 0 1 19 12a3 3 0 0 1-4 3.5V4Z"/><path d="M9 8H7m8 2h2m-8 5H7"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateLabel() {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function epochDay() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
}

function techniquesForDay() {
  const day = epochDay();
  return Object.keys(DOMAINS).map((domain, domainIndex) => {
    const list = TECHNIQUES.filter((item) => item.domain === domain);
    return list[(day + domainIndex * 3 + state.insights.length) % list.length];
  });
}

function rareCaseForDay() {
  return RARE_CASES[(epochDay() * 3 + state.insights.length) % RARE_CASES.length];
}

function currentSprintDay() {
  if (!state.sprintStartDate) return 1;
  const start = new Date(`${state.sprintStartDate}T00:00:00`);
  const now = new Date();
  const diff = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - start) / 86400000);
  return Math.min(28, Math.max(1, diff + 1));
}

function todayAtlasNodes() {
  const sprint = currentSprintDay();
  const selected = [];
  const groups = [...ATLAS_GROUPS];
  for (let index = 0; index < 10; index += 1) {
    const group = groups[(sprint * 3 + index * 4) % groups.length];
    const candidates = allAtlasNodes().filter((node) => node.group === group.id);
    const node = candidates[(sprint + index * 2) % Math.max(1, candidates.length)];
    if (node && !selected.some((item) => item.id === node.id)) selected.push(node);
  }
  let cursor = 0;
  while (selected.length < 10 && cursor < allAtlasNodes().length) {
    const node = allAtlasNodes()[(sprint * 7 + cursor) % allAtlasNodes().length];
    if (!selected.some((item) => item.id === node.id)) selected.push(node);
    cursor += 1;
  }
  return selected;
}

function allAtlasNodes() {
  return [...ATLAS_NODES, ...(state.customNodes || [])];
}

function nodeById(id) {
  return allAtlasNodes().find((node) => node.id === id);
}

function DOMAIN_NAME(branchId) {
  return ATLAS_BRANCHES.find((branch) => branch.id === branchId)?.label || "个人节点";
}

function todayMaster() {
  return MASTER_ATLAS[(currentSprintDay() - 1) % MASTER_ATLAS.length];
}

function profileEntries() {
  return PROFILE_TRAITS.map((trait) => ({ ...trait, score: state.profile[trait.id] ?? 45 })).sort((a, b) => a.score - b.score);
}

function futureSelfLine() {
  const sorted = profileEntries();
  const frontier = sorted[0];
  const strength = sorted[sorted.length - 1];
  return `你已有的「${strength.label}」可以成为杠杆，但未来的你会在做决定前先看见「${frontier.label}」；今天先做一个只改变这一变量的实验。`;
}

function renderHome() {
  const techniques = techniquesForDay();
  const rare = rareCaseForDay();
  const sprint = SPRINT_28[currentSprintDay() - 1];
  const master = todayMaster();
  const dailyNodes = todayAtlasNodes();
  const completed = Boolean(state.completedDays[localDateKey()]);
  return `<div class="page">
    <p class="eyebrow">DAILY CUT LAB · ${escapeHtml(dateLabel())}</p>
    <h1 class="page-title">让一条规则<br />短暂失效。</h1>
    <p class="page-lead">今天不是学更多技巧，而是找到一种能改变信息、关系或时间的操作。五张牌，一个异闻，一个可以今天就剪的缝。</p>

    <section class="day-hero">
      <div class="hero-top"><code>SPRINT ${String(currentSprintDay()).padStart(2, "0")} / 28</code><span>${completed ? "今日已沉淀" : `${ATLAS_NODES.length} 术语节点 · ${MASTER_ATLAS.length} 位大师`}</span></div>
      <h1>${escapeHtml(sprint.title)}</h1>
      <p>${escapeHtml(sprint.goal)}</p>
      <div class="hero-actions">
        <button class="button" type="button" data-action="complete-day">${completed ? "今天再想一次" : "沉淀今日练习"} ${icon(completed ? "arrow" : "check")}</button>
        <button class="button ghost small" type="button" data-route="atlas">打开图谱</button>
      </div>
    </section>

    <div class="protocol-strip">
      <span><b>10</b>术语</span><span><b>5</b>深技巧</span><span><b>1</b>大师</span><span><b>1</b>异闻</span><span><b>1</b>实验</span>
    </div>

    <div class="section-head"><h2>今日十词</h2><button type="button" data-route="atlas">进入全图谱 ${icon("arrow")}</button></div>
    <div class="dense-term-grid">
      ${dailyNodes.map((node) => `<button class="dense-term" type="button" data-action="open-node" data-node="${node.id}">
        <span>${escapeHtml(DOMAIN_NAME(node.branch))}</span>
        <b>${escapeHtml(node.zh)}</b>
        <small>${escapeHtml(node.en)}</small>
        <p>${escapeHtml(node.def)}</p>
      </button>`).join("")}
    </div>

    <div class="section-head"><h2>大师决策</h2><p>${escapeHtml(master.region)} · ${escapeHtml(master.role)}</p></div>
    <article class="master-card">
      <span class="rare-type">MASTER / ${escapeHtml(master.region)}</span>
      <h3>${escapeHtml(master.name)}</h3>
      <p class="master-signature">${escapeHtml(master.signature)}</p>
      <p>${escapeHtml(master.case)}</p>
      <div class="master-methods">${master.methods.map((id) => `<span>${escapeHtml(nodeById(id)?.zh || id)}</span>`).join("")}</div>
    </article>

    <div class="section-head"><h2>今日五张牌</h2><p>结构 / 信息 / 剪辑 / 画面 / 声音</p></div>
    <div class="technique-list">
      ${techniques.map((tech, index) => techniqueCard(tech, index)).join("")}
    </div>

    <div class="section-head"><h2>今日异闻</h2><p>提取形式，不背故事</p></div>
    <article class="rare-card">
      <span class="rare-type">${escapeHtml(rare.type)}</span>
      <h2>${escapeHtml(rare.title)}</h2>
      <p class="rare-story">${escapeHtml(rare.story)}</p>
      <div class="rare-operation"><small>形式操作</small><p>${escapeHtml(rare.operation)}</p></div>
      <div class="rare-operation"><small>迁移到剪辑</small><p>${escapeHtml(rare.transfer)}</p></div>
      <div class="rare-operation misuse"><small>误用信号</small><p>${escapeHtml(rare.misuse)}</p></div>
      <p class="provenance">来源状态：${escapeHtml(rare.provenance)}</p>
    </article>

    <div class="seam-card">
      <h3>今天最小的那道缝</h3>
      <p>${escapeHtml(sprint.lab)} 不要做完整作品，只验证“观众是否因为我改变的那一刀，重新理解此前画面”。</p>
    </div>

    <div class="section-head"><h2>今日策略</h2><p>由当前画像给出</p></div>
    ${profileStrategyCard()}
  </div>`;
}

function techniqueCard(tech, index) {
  return `<article class="technique-card">
    <div class="tech-top">
      <span class="domain-tag domain-${tech.domain}">${escapeHtml(DOMAINS[tech.domain].name)}</span>
      <span class="tech-no">CARD ${String(index + 1).padStart(2, "0")}</span>
    </div>
    <h3>${escapeHtml(tech.title)}</h3>
    <p class="lineage">${escapeHtml(tech.lineage)}</p>
    <p class="mechanism">${escapeHtml(tech.mechanism)}</p>
    <details class="tech-details">
      <summary>展开：少见之处 / 微案例 / 今天就试</summary>
      <div class="tech-detail-block"><small>少见之处</small><p>${escapeHtml(tech.edge)}</p></div>
      <div class="tech-detail-block"><small>微案例</small><p>${escapeHtml(tech.case)}</p></div>
      <div class="tech-detail-block"><small>练习</small><p>${escapeHtml(tech.exercise)}</p></div>
      <div class="tech-detail-block"><small>诊断问题</small><p>${escapeHtml(tech.question)}</p></div>
      <div class="tech-detail-block misuse"><small>误用信号</small><p>${escapeHtml(tech.misuse)}</p></div>
    </details>
  </article>`;
}

function profileStrategyCard() {
  const sorted = profileEntries();
  const weak = sorted.slice(0, 2);
  const strong = sorted.slice(-1)[0];
  return `<section class="seam-card">
    <h3>${escapeHtml(weak[0].label)} × ${escapeHtml(weak[1].label)}</h3>
    <p>当前最值得实验的缺口是「${escapeHtml(weak[0].label)}」与「${escapeHtml(weak[1].label)}」。不要同时修两个问题：先选一个场景，让一个信息差产生结构性的回声。你最稳定的杠杆暂时是「${escapeHtml(strong.label)}」。</p>
  </section>`;
}

function renderLab() {
  const mine = state.works.mine;
  const reference = state.works.reference;
  return `<div class="page">
    <p class="eyebrow">PORTFOLIO LAB · LOCAL FIRST</p>
    <h1 class="page-title">同一场戏，<br />两个世界的剪法。</h1>
    <p class="page-lead">导入你的版本与导演版、客户版或参考版本。视频在本机读取，应用不把原片上传到服务器。</p>

    <div class="lab-note">${icon("film")}<p><b>关于“不限大小”：</b>文件选择器没有应用层大小上限，也不复制完整视频到云盘；但手机解码速度、浏览器内存和视频长度仍会影响分析时间。保存的是镜头数据和笔记，换设备需重新导入原片。</p></div>

    <div class="workspace">
      ${workPanel("mine", "我的版本", "我的剪辑", mine)}
      ${workPanel("reference", "参考版本", "导演版 / 参考版", reference)}
    </div>

    ${comparisonCard()}

    <div class="section-head"><h2>时间线笔记</h2><p>记录决策，不只记录“好/不好”</p></div>
    <div class="workspace">
      ${noteEditor("mine", "我的版本")}
      ${noteEditor("reference", "参考版本")}
    </div>

    <button class="button secondary" type="button" data-action="copy-brief">${icon("copy")} 复制版本对比给 AI / Codex</button>
    <p class="page-lead">诊断包会包含镜头数据、时间线笔记和你的画像问题，不包含视频本身。可粘贴到 Codex 并调用 $story-cutting-mentor 继续深聊。</p>
  </div>`;
}

function workPanel(role, label, sublabel, work) {
  const media = runtimeMedia[role];
  const hasVideo = media.url && work;
  return `<section class="work-panel ${role}">
    <div class="work-head"><div><b>${escapeHtml(label)}</b><small>${escapeHtml(sublabel)}</small></div><span class="work-badge">${role === "mine" ? "A" : "B"}</span></div>
    <div class="video-box">
      ${
        hasVideo
          ? `<video id="video-${role}" src="${escapeHtml(media.url)}" controls playsinline preload="metadata"></video>`
          : `<div class="video-placeholder">${icon("upload")}<span>尚未导入视频</span></div>`
      }
    </div>
    <div class="work-body">
      <div class="work-actions">
        <button class="button small secondary" type="button" data-action="pick-video" data-role="${role}">${hasVideo ? "更换视频" : "选择本地视频"}</button>
        <button class="button small ghost" type="button" data-action="scan-video" data-role="${role}" ${hasVideo ? "" : "disabled"}>${icon("scan")} 扫描节奏</button>
        ${scanJob?.role === role ? `<button class="button small danger" type="button" data-action="cancel-scan">停止</button>` : ""}
      </div>
      <input type="file" accept="video/*" data-video-input="${role}" hidden />
      ${work ? fileMeta(work) : `<div class="file-meta">支持浏览器能播放的常见视频格式；原片只保留在当前页面。</div>`}
      ${scanJob?.role === role ? `<div class="scan-progress"><i id="scan-bar" style="width:${Math.round(scanJob.progress * 100)}%"></i></div><div class="scan-copy" id="scan-copy">正在本地扫描镜头变化…</div>` : ""}
      ${work?.metrics ? metricsGrid(work.metrics) : ""}
    </div>
  </section>`;
}

function fileMeta(work) {
  return `<div class="file-meta">${escapeHtml(work.fileName)} · ${formatBytes(work.size)} · ${formatDuration(work.duration)} · ${work.width}×${work.height}</div>`;
}

function metricsGrid(metrics) {
  return `<div class="metrics-grid">
    <div class="metric"><b>${metrics.cuts}</b><span>检测切点</span></div>
    <div class="metric"><b>${metrics.avgShot}s</b><span>平均镜头</span></div>
    <div class="metric"><b>${metrics.cutRate}</b><span>每分钟切点</span></div>
    <div class="metric"><b>${metrics.longest}s</b><span>最长镜头</span></div>
  </div>`;
}

function noteEditor(role, label) {
  const work = state.works[role];
  return `<section class="work-panel">
    <div class="work-head"><div><b>${escapeHtml(label)} · 时间线</b><small>先点视频暂停在关键位置，再添加笔记</small></div></div>
    <div class="work-body">
      <textarea class="field" id="shot-note-${role}" placeholder="这一刀改变了什么信息、关系或时间？"></textarea>
      <div class="work-actions" style="margin-top:8px">
        <button class="button small secondary" type="button" data-action="add-note" data-role="${role}" ${work ? "" : "disabled"}>${icon("note")} 记录当前时间</button>
      </div>
      <div class="insight-list" style="margin-top:12px">
        ${
          work?.notes?.length
            ? work.notes
                .slice()
                .reverse()
                .slice(0, 8)
                .map((note) => `<div class="insight-item"><b>${formatTimecode(note.time)}</b><p>${escapeHtml(note.text)}</p></div>`)
                .join("")
            : `<div class="empty-state">还没有时间线笔记。最值得记录的是：你为何在这里切，而不是“这里节奏不错”。</div>`
        }
      </div>
    </div>
  </section>`;
}

function comparisonCard() {
  const mine = state.works.mine?.metrics;
  const reference = state.works.reference?.metrics;
  if (!mine || !reference) {
    return `<section class="comparison-card"><h3>版本差异</h3><p class="page-lead" style="margin:0">两个版本都扫描镜头节奏后，这里会比较平均镜头长度、变化幅度和切点密度。它不是“谁更高级”的评分，而是两种观看契约的差异。</p></section>`;
  }
  return `<section class="comparison-card">
    <h3>你的版本 × 参考版本</h3>
    <div class="timeline-compare">${mine.cutTimes.slice(0, 250).map((time) => `<i style="left:${(time / mine.duration) * 100}%"></i>`).join("")}</div>
    <div class="timeline-compare reference">${reference.cutTimes.slice(0, 250).map((time) => `<i style="left:${(time / reference.duration) * 100}%"></i>`).join("")}</div>
    ${deltaRow("平均镜头", mine.avgShot, reference.avgShot, "s")}
    ${deltaRow("切点密度", mine.cutRate, reference.cutRate, "/min")}
    ${deltaRow("节奏波动", mine.variance, reference.variance, "s")}
    ${deltaRow("最长镜头", mine.longest, reference.longest, "s")}
    <p class="page-lead" style="margin:12px 0 0">${comparisonInsight(mine, reference)}</p>
  </section>`;
}

function deltaRow(label, mine, reference, unit) {
  const diff = Number((mine - reference).toFixed(2));
  return `<div class="delta-row"><span>${label}</span><b>${diff > 0 ? "+" : ""}${diff}${unit}</b></div>`;
}

function comparisonInsight(mine, reference) {
  if (mine.avgShot < reference.avgShot * 0.72) return "你的版本更依赖高频切点。先判断：这种速度是在组织信息，还是在掩盖某些镜头无法独立承担情绪？";
  if (mine.avgShot > reference.avgShot * 1.35) return "你的版本愿意停留更久。关键不是长短，而是停留期间有没有产生新的关系、压力或事实。";
  if (mine.variance > reference.variance * 1.8) return "你的节奏波动明显更大。检查这种突变是否跟随信息反转，还是只是情绪上的用力。";
  return "两版整体节奏接近，真正的差异可能不在切点数量，而在切点前后观众被允许知道什么。请用时间线笔记锁定三个决定场景含义的瞬间。";
}

function renderDialogue() {
  const connected = Boolean(state.ai.endpoint && state.ai.model);
  return `<div class="page">
    <p class="eyebrow">LIVE MENTOR · EVIDENCE FIRST</p>
    <h1 class="page-title">和一个会<br />反驳你的导师谈。</h1>
    <p class="page-lead">它可以调用你的画像、今日技巧、作品节奏与时间线笔记。没有模型 API 时，仍会给出结构化的离线追问，但不会假装完成深度分析。</p>
    <div class="ai-status ${connected ? "connected" : ""}"><i></i><span>${connected ? "已配置模型接口" : "离线模式：本地追问与沉淀"}</span></div>

    <div class="chat-shell" id="chat-shell">
      ${
        state.chatMessages.length
          ? state.chatMessages.map(chatMessage).join("")
          : `<div class="chat-message"><small>切面 / 导师</small><p>先别问“怎么剪得更好”。告诉我一个你正在做的选择：你在哪一刀之前，让观众误以为了什么？他们后来怎样发现自己错了？</p></div>`
      }
      ${chatBusy ? `<div class="thinking">导师正在找矛盾点…</div>` : ""}
    </div>

    <div class="chat-input-row">
      <textarea class="field" id="chat-input" placeholder="带一个具体选择、时间点或两个版本的差异来谈…"></textarea>
      <button class="send-button" type="button" data-action="send-chat" ${chatBusy ? "disabled" : ""}>${icon("send")}</button>
    </div>
    <div class="work-actions" style="margin-top:8px">
      <button class="button small ghost" type="button" data-action="save-discussion">${icon("note")} 保存本轮讨论</button>
      <button class="button small ghost" type="button" data-action="clear-chat">清空本轮</button>
    </div>

    <details class="settings-box">
      <summary>${connected ? "模型接口设置" : "接入 OpenAI-compatible 模型接口"}</summary>
      <div class="settings-body">
        <label class="field-label">完整 Chat Completions 接口地址</label>
        <input class="field" id="ai-endpoint" value="${escapeHtml(state.ai.endpoint)}" placeholder="https://…/v1/chat/completions" />
        <div class="form-grid" style="margin-top:8px">
          <input class="field" id="ai-model" value="${escapeHtml(state.ai.model)}" placeholder="模型名称" />
          <input class="field" id="ai-key" type="password" value="${escapeHtml(state.ai.key)}" placeholder="API Key（可留空）" />
        </div>
        <button class="button small secondary" type="button" data-action="save-ai" style="margin-top:8px">保存接口设置</button>
        <p class="api-warning">接口配置保存在本机浏览器。若使用第三方代理，请自行确认其隐私与数据政策。不要在这里填写不希望本机保存的长期密钥。</p>
      </div>
    </details>

    <div class="section-head"><h2>沉淀一条新规则</h2><p>讨论只有变成可执行句才算留下</p></div>
    <div class="seam-card">
      <label class="field-label">规则名称</label>
      <input class="field" id="insight-title" placeholder="例如：先让空位承担角色，再揭示缺席者" />
      <label class="field-label">可执行原则</label>
      <textarea class="field" id="insight-body" placeholder="用一句话写清：在什么条件下，改变什么变量，会让观众怎样重新理解？"></textarea>
      <div class="form-grid" style="margin-top:8px">
        <select class="field" id="insight-category">
          ${PROFILE_TRAITS.map((trait) => `<option value="${trait.id}">${escapeHtml(trait.label)}</option>`).join("")}
        </select>
        <input class="field" id="insight-evidence" placeholder="证据：时间点 / 作品 / 讨论" />
      </div>
      <button class="button" type="button" data-action="save-insight" style="margin-top:9px">${icon("arrowUp")} 更新我的画像</button>
    </div>
    <p class="page-lead">每次保存会把对应维度的证据与掌握度稍微上调，并把规则放进长期档案。这个分数是练习信号，不是对你艺术能力的裁决。</p>
  </div>`;
}

function chatMessage(message) {
  return `<div class="chat-message ${message.role === "user" ? "user" : ""}">
    <small>${message.role === "user" ? "你" : "切面 / 导师"}</small>
    <p>${escapeHtml(message.content)}</p>
  </div>`;
}

function renderAtlas() {
  const selectedBranch = state.atlasBranch;
  const selectedLayer = state.atlasLayer;
  const countNotes = state.viewingNotes.length;
  return `<div class="page">
    <p class="eyebrow">STORY & CUT ATLAS · ${ATLAS_NODES.length + state.customNodes.length} NODES</p>
    <h1 class="page-title">一张会生长的<br />故事操作地图。</h1>
    <p class="page-lead">从叙事本体到声音与元系统，按根类、分支、簇、操作节点组织。点选星群进入分支，也可以把每次观影观察直接接入某个节点，或让它长成你的新术语。</p>

    <section class="five-layer-key">
      <div class="five-layer-title"><b>五层故事操作系统</b><span>不是术语目录，而是五类可操作的问题</span></div>
      ${ATLAS_LAYERS.map((layer) => `<button class="${selectedLayer === layer.id ? "is-selected" : ""}" type="button" data-action="filter-atlas-layer" data-layer="${layer.id}">
        <b>${escapeHtml(layer.label)}</b>
        <span>${escapeHtml(layer.longLabel)}</span>
        <small>${escapeHtml(layer.question)}</small>
      </button>`).join("")}
    </section>

    <section class="atlas-overview">
      <div class="atlas-canvas-wrap">
        <canvas id="atlas-canvas" aria-label="故事与剪辑术语图谱"></canvas>
        <div class="atlas-center-mark">ATLAS</div>
      </div>
      <div class="atlas-caption"><span>${ATLAS_LAYERS.length} 个总层</span><span>${ATLAS_BRANCHES.length} 个分支 · ${ATLAS_GROUPS.length} 簇</span><span>${ATLAS_NODES.length + state.customNodes.length} 节点</span></div>
    </section>

    <div class="atlas-outline">
      ${ATLAS_LAYERS.map((layer) => `<article>
        <span style="color:${layer.color}">${escapeHtml(layer.label)}</span>
        <div><b>${escapeHtml(layer.longLabel)}</b><p>${layer.branches.map((id) => escapeHtml(ATLAS_BRANCHES.find((branch) => branch.id === id)?.label || id)).join(" · ")}</p></div>
        <small>${ATLAS_NODES.filter((node) => layer.branches.includes(node.branch)).length}</small>
      </article>`).join("")}
    </div>

    <div class="atlas-controls">
      <input class="field" id="atlas-search" value="${escapeHtml(state.atlasSearch)}" placeholder="搜索：叙述性诡计、缝合、声画对位…" />
      <div class="library-filters">
        <button class="${!selectedBranch ? "is-selected" : ""}" type="button" data-action="filter-atlas" data-branch="">全部</button>
        ${ATLAS_BRANCHES
          .filter((branch) => !selectedLayer || ATLAS_LAYERS.find((layer) => layer.id === selectedLayer)?.branches.includes(branch.id))
          .map((branch) => `<button class="${selectedBranch === branch.id ? "is-selected" : ""}" type="button" data-action="filter-atlas" data-branch="${branch.id}">${escapeHtml(branch.label)}</button>`)
          .join("")}
      </div>
    </div>
    <div id="atlas-results">${renderAtlasResults()}</div>

    <div class="section-head"><h2>观影入库</h2><p>让每次观看都成为树上的证据</p></div>
    <section class="watch-entry">
      <div class="form-grid">
        <input class="field" id="watch-film" placeholder="片名 / 作品名" />
        <input class="field" id="watch-time" placeholder="时间点，如 00:18:42" />
      </div>
      <label class="field-label">你观察到的具体做法</label>
      <textarea class="field" id="watch-observation" placeholder="不要只写“节奏很好”。写下画面、声音或剪点怎样改变了信息、关系或时间。"></textarea>
      <label class="field-label">如果你发明了一个新术语，可写在这里</label>
      <input class="field" id="watch-new-term" placeholder="可选，例如：延迟反应的空位回声" />
      <button class="button" type="button" data-action="save-watch-note">${icon("brain")} 智能归类并放入技能树</button>
      <p class="api-warning">有模型接口时使用 AI 归类；离线时使用术语关键词、定义与分支权重进行本地匹配。原始视频不会上传。</p>
    </section>

    <div class="section-head"><h2>最近入库</h2><p>${countNotes} 条</p></div>
    <div class="insight-list">
      ${
        countNotes
          ? state.viewingNotes
              .slice()
              .reverse()
              .slice(0, 12)
              .map((note) => `<article class="watch-note">
                <div class="watch-note-top"><b>${escapeHtml(note.film || "未命名观看")}</b><span>${escapeHtml(note.timecode || "无时间点")}</span></div>
                <p>${escapeHtml(note.observation)}</p>
                <div class="watch-note-link">→ ${escapeHtml(nodeById(note.nodeId)?.zh || note.newTerm || "待归类节点")}</div>
              </article>`)
              .join("")
          : `<div class="empty-state">还没有观影证据。下一次看到一个“拍案叫绝”的剪点，就把那 3 秒变成树上的一片叶子。</div>`
      }
    </div>

    <div class="section-head"><h2>大师方法索引</h2><p>${MASTER_ATLAS.length} 位创作者 / 剪辑师 / 理论家</p></div>
    <div class="master-archive">
      ${MASTER_ATLAS.map((master, index) => `<details class="master-entry">
        <summary><span>${String(index + 1).padStart(2, "0")}</span><b>${escapeHtml(master.name)}</b><small>${escapeHtml(master.region)} · ${escapeHtml(master.role)}</small></summary>
        <p>${escapeHtml(master.signature)}</p>
        <div class="master-methods">${master.methods.map((id) => `<button type="button" data-action="jump-node" data-node="${id}">${escapeHtml(nodeById(id)?.zh || id)}</button>`).join("")}</div>
        <small class="master-caution">${escapeHtml(master.case)}</small>
      </details>`).join("")}
    </div>
    <div class="section-head"><h2>理论底图</h2><p>术语与方法的来源索引</p></div>
    <div class="source-list">
      ${SOURCE_REGISTRY.map((source) => `<article>
        <b>${escapeHtml(source.title)}</b>
        <span>${escapeHtml(source.author)} · ${escapeHtml(source.area)}</span>
        <small>${escapeHtml(source.status)}</small>
      </article>`).join("")}
    </div>
    <p class="page-lead">本版知识树先由叙事学、电影理论、剪辑师方法与新媒体理论交叉整理。当前运行环境无法访问外网，因此所有需要版本、页码、访谈原文或网络链接的条目均标为“待核验”，不以虚构引用补齐。</p>
  </div>`;
}

function renderAtlasResults() {
  const query = state.atlasSearch.trim().toLowerCase();
  const branch = state.atlasBranch;
  const layer = ATLAS_LAYERS.find((item) => item.id === state.atlasLayer);
  let nodes = allAtlasNodes();
  if (layer) nodes = nodes.filter((node) => layer.branches.includes(node.branch));
  if (branch) nodes = nodes.filter((node) => node.branch === branch);
  if (query) {
    nodes = nodes.filter((node) =>
      `${node.zh} ${node.en} ${node.def}`.toLowerCase().includes(query),
    );
  }
  const grouped = new Map();
  nodes.forEach((node) => {
    if (!grouped.has(node.group)) grouped.set(node.group, []);
    grouped.get(node.group).push(node);
  });
  return `<div class="atlas-node-groups">
    ${
      grouped.size
        ? [...grouped.entries()]
            .map(([groupId, list]) => {
              const group = ATLAS_GROUPS.find((item) => item.id === groupId);
              return `<section class="atlas-group">
                <div class="atlas-group-head"><span>${escapeHtml(DOMAIN_NAME(list[0].branch))}</span><b>${escapeHtml(group?.label || "个人集群")}</b><small>${list.length} 节点</small></div>
                <div class="atlas-node-list">${list.map(atlasNodeCard).join("")}</div>
              </section>`;
            })
            .join("")
        : `<div class="empty-state">没有匹配术语。你可以直接在下方写下一个新词，让它成为个人节点。</div>`
    }
  </div>`;
}

function atlasNodeCard(node) {
  const notes = state.viewingNotes.filter((note) => note.nodeId === node.id);
  return `<button class="atlas-node-card ${node.status === "personal" ? "personal" : ""}" type="button" data-action="open-node" data-node="${node.id}">
    <div class="atlas-node-top"><span>${escapeHtml(node.en)}</span><i>${"●".repeat(Math.max(1, Math.min(5, node.rarity || 3)))}</i></div>
    <b>${escapeHtml(node.zh)}</b>
    <p>${escapeHtml(node.def)}</p>
    <div class="atlas-node-foot">
      <span>${node.links?.length || 0} 条关系</span>
      <span>${notes.length} 条我的证据</span>
    </div>
  </button>`;
}

function drawAtlasMap() {
  const canvas = document.getElementById("atlas-canvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const height = 420;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  const center = { x: width / 2, y: height / 2 };
  const orderedBranches = ATLAS_LAYERS.flatMap((layer) =>
    layer.branches.map((id) => ATLAS_BRANCHES.find((branch) => branch.id === id)).filter(Boolean),
  );
  const branchRadius = Math.min(width * 0.25, 104);
  const positions = orderedBranches.map((branch, index) => {
    const angle = -Math.PI / 2 + (index / orderedBranches.length) * Math.PI * 2;
    return {
      branch,
      angle,
      x: center.x + Math.cos(angle) * branchRadius,
      y: center.y + Math.sin(angle) * branchRadius,
      r: 11 + Math.min(4, Math.round(ATLAS_NODES.filter((node) => node.branch === branch.id).length / 7)),
    };
  });

  ctx.strokeStyle = "rgba(216,162,74,.14)";
  ctx.lineWidth = 0.8;
  positions.forEach((item) => {
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(item.x, item.y);
    ctx.stroke();
  });

  const groupPositions = [];
  positions.forEach((item) => {
    const groups = ATLAS_GROUPS.filter((group) => group.branch === item.branch.id);
    groups.forEach((group, index) => {
      const offset = (index - (groups.length - 1) / 2) * 0.075;
      const angle = item.angle + offset;
      const outerRadius = Math.min(width * 0.405, 165);
      const x = center.x + Math.cos(angle) * outerRadius;
      const y = center.y + Math.sin(angle) * outerRadius;
      const selected = state.atlasBranch === item.branch.id;
      ctx.strokeStyle = selected ? `${item.branch.color}88` : "rgba(180,190,185,.11)";
      ctx.lineWidth = selected ? 1.1 : 0.6;
      ctx.beginPath();
      ctx.moveTo(item.x, item.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = selected ? item.branch.color : "rgba(150,160,155,.42)";
      ctx.beginPath();
      ctx.arc(x, y, selected ? 3.4 : 2.4, 0, Math.PI * 2);
      ctx.fill();
      groupPositions.push({ branch: item.branch.id, x, y, group });
    });
  });

  ctx.fillStyle = "#171a1c";
  ctx.strokeStyle = "#d8a24a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(center.x, center.y, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  positions.forEach((item) => {
    const selected = state.atlasBranch === item.branch.id;
    const layerSelected = !state.atlasLayer || ATLAS_LAYERS.find((layer) => layer.id === state.atlasLayer)?.branches.includes(item.branch.id);
    ctx.fillStyle = selected ? item.branch.color : "rgba(20,23,25,.94)";
    ctx.strokeStyle = layerSelected ? item.branch.color : "rgba(100,105,102,.32)";
    ctx.lineWidth = selected ? 3 : 1;
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = selected ? "#111315" : "#c7c9c3";
    ctx.font = "7.5px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.branch.label, item.x, item.y);
  });
  ctx.fillStyle = "#d8a24a";
  ctx.font = "7px SFMono-Regular, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("STORY", center.x, center.y - 4);
  ctx.fillText("OS", center.x, center.y + 5);

  canvas.onclick = (event) => {
    const box = canvas.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    let picked = null;
    let distance = Infinity;
    for (const item of [...positions, ...groupPositions]) {
      const d = Math.hypot(x - item.x, y - item.y);
      const hitRadius = item.r ? item.r + 14 : 12;
      if (d < hitRadius && d < distance) {
        picked = item.branch;
        distance = d;
      }
    }
    if (picked) {
      state.atlasBranch = state.atlasBranch === picked ? null : picked;
      state.atlasLayer = ATLAS_LAYERS.find((layer) => layer.branches.includes(picked))?.id || null;
      render();
    }
  };
}

function classifyObservation(observation, title = "") {
  const text = `${title} ${observation}`.toLowerCase();
  const hints = [
    { words: ["叙述性诡计", "不可靠", "骗子", "误导", "真相"], ids: ["i10", "n12", "i12"] },
    { words: ["元叙事", "第四堵墙", "自反", "虚构", "越界"], ids: ["m01", "m05", "m03", "m17"] },
    { words: ["同构", "套层", "内外层", "对称"], ids: ["a11", "m02", "a15"] },
    { words: ["声音", "声画", "静音", "对位", "底噪"], ids: ["s06", "s09", "s12"] },
    { words: ["剪辑", "切点", "跳切", "蒙太奇", "转场"], ids: ["e09", "e12", "e03"] },
    { words: ["构图", "画框", "边缘", "景深", "焦点"], ids: ["im02", "im04", "im08"] },
    { words: ["时间", "闪回", "闪前", "循环", "倒叙"], ids: ["t06", "t07", "t04"] },
    { words: ["空间", "建筑", "门", "走廊", "地图"], ids: ["sp03", "sp08", "sp12"] },
    { words: ["欲望", "人物", "角色", "反派"], ids: ["c01", "c10", "c06"] },
    { words: ["观众", "共情", "悬念", "惊奇", "不适"], ids: ["af01", "af04", "af09"] },
  ];
  for (const hint of hints) {
    if (hint.words.some((word) => text.includes(word))) {
      const node = nodeById(hint.ids[0]);
      if (node) return { node, branch: node.branch, reason: `命中关键词：${hint.words.find((word) => text.includes(word))}` };
    }
  }
  let best = null;
  let bestScore = 0;
  allAtlasNodes().forEach((node) => {
    let score = 0;
    if (text.includes(node.zh.toLowerCase())) score += 12;
    if (node.en && text.includes(node.en.toLowerCase())) score += 10;
    for (const word of node.zh.split(/[\s/、·]+/)) {
      if (word.length >= 2 && text.includes(word.toLowerCase())) score += 2;
    }
    if (score > bestScore) {
      best = node;
      bestScore = score;
    }
  });
  if (best) return { node: best, branch: best.branch, reason: `术语匹配度 ${bestScore}` };
  const fallback = nodeById("m01");
  return { node: fallback, branch: "meta", reason: "未找到精确节点，默认归入元叙事与媒介以待确认" };
}

async function aiClassifyObservation(film, observation) {
  if (!state.ai.endpoint || !state.ai.model) return null;
  const candidates = allAtlasNodes().map((node) => `${node.id}|${node.zh}|${node.en}`).join("\n");
  try {
    const response = await fetch(state.ai.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(state.ai.key ? { Authorization: `Bearer ${state.ai.key}` } : {}),
      },
      body: JSON.stringify({
        model: state.ai.model,
        messages: [
          {
            role: "system",
            content: "你是故事与剪辑术语分类器。只能选择一个给定节点 id，或返回 nodeId:null。只输出 JSON：{\"nodeId\":\"...\"|\"null\",\"branch\":\"...\",\"reason\":\"...\"}。不要发明已有节点 id。",
          },
          { role: "user", content: `作品：${film}\n观察：${observation}\n候选：\n${candidates}` },
        ],
        temperature: 0.1,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || data?.output_text || "";
    const json = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || content);
    const node = json.nodeId && json.nodeId !== "null" ? nodeById(json.nodeId) : null;
    return node ? { node, branch: node.branch, reason: json.reason || "AI 归类" } : null;
  } catch {
    return null;
  }
}

async function saveWatchNote() {
  const film = document.getElementById("watch-film")?.value.trim();
  const timecode = document.getElementById("watch-time")?.value.trim();
  const observation = document.getElementById("watch-observation")?.value.trim();
  const newTerm = document.getElementById("watch-new-term")?.value.trim();
  if (!film || !observation) {
    showToast("至少写片名和具体观察。");
    return;
  }
  showToast("正在归类到技能树…");
  const local = classifyObservation(observation);
  const classified = (await aiClassifyObservation(film, observation)) || local;
  let node = classified.node;
  if (newTerm) {
    node = {
      id: `custom-${Date.now()}`,
      branch: classified.branch,
      group: node?.group || ATLAS_GROUPS.find((group) => group.branch === classified.branch)?.id,
      zh: newTerm,
      en: "personal term",
      def: observation.slice(0, 120),
      rarity: 5,
      links: classified.node ? [classified.node.id] : [],
      status: "personal",
    };
    state.customNodes.push(node);
  }
  state.viewingNotes.push({
    id: newId(),
    film,
    timecode,
    observation,
    nodeId: node.id,
    newTerm: newTerm || "",
    reason: classified.reason,
    date: localDateKey(),
  });
  state.nodeActivity[node.id] = (state.nodeActivity[node.id] || 0) + 1;
  const category = branchToProfile(node.branch);
  state.insights.push({
    id: newId(),
    title: `观影证据 · ${film}`,
    body: observation.slice(0, 220),
    category,
    evidence: `${film} ${timecode}`,
    date: localDateKey(),
    source: "viewing",
  });
  updateTrait(category);
  state.atlasBranch = node.branch;
  state.atlasSearch = "";
  saveState();
  render();
  showToast(`已归入「${node.zh}」，并写进个人画像。`);
}

function branchToProfile(branch) {
  return {
    narr: "rhyme",
    arch: "rhyme",
    info: "information",
    char: "performance",
    time: "time",
    space: "spatial",
    edit: "ellipsis",
    image: "pov",
    sound: "sound",
    perf: "performance",
    meta: "reflexivity",
    affect: "audience",
    craft: "invention",
  }[branch] || "invention";
}

const BRANCH_DETAIL_SCENES = {
  narr: { scene: "一场看似普通的家庭晚餐", transfer: "把同一事件分别写成事实清单、人物经历和最终叙述，比较三者漏掉了什么。", misuse: "把所有形式变化都解释成“叙事复杂”。" },
  arch: { scene: "三个发生在同一栋楼里的事件", transfer: "先排出一个可理解的整体，再替换一个结构位置，观察观众对因果和责任的判断如何变化。", misuse: "只把结构当模板套用，不回答结构为何而存在。" },
  info: { scene: "一封在三个角色手里传递的信", transfer: "只改变观众知道这封信内容的时间，不改变事件本身。", misuse: "隐瞒作者没有能力公平提供的信息。" },
  char: { scene: "一个人在门口等待另一个人出现", transfer: "把人物的欲望写成一个动作，把阻力写进同一个空间，不靠旁白解释。", misuse: "把人物写成主题的代言人。" },
  time: { scene: "同一条街上相隔十年的两次相遇", transfer: "固定事件事实，只改变顺序、时长或重复频率，记录观众对责任归属的变化。", misuse: "把时间花招当因果解释。" },
  space: { scene: "只能从内部打开的玻璃门", transfer: "让空间的门槛、中心和边缘承担一场权力变化，删除解释性对白。", misuse: "空间只当漂亮背景，不参与行动。" },
  edit: { scene: "一个人关上门后，房间里的声音仍然继续", transfer: "重剪同一素材十次，每次只移动一个切点，记录观众信息模型在哪一次变化。", misuse: "用一个炫技转场替代镜头之间的关系论证。" },
  image: { scene: "前景说话的人始终清晰，背景的关键动作始终模糊", transfer: "用焦点、边缘或画中画让观众先看错对象，再让新信息重写画面。", misuse: "画面漂亮但没有任何角色需要为看到或没看到承担后果。" },
  sound: { scene: "画面在白天，环境声却来自夜晚的海边", transfer: "先只用声音建立世界，再用画面修正它；至少要有一个角色听见同一差异。", misuse: "声音只负责制造气氛，不参与事实和关系。" },
  perf: { scene: "角色说“没事”时，手一直擦一只已经干净的杯子", transfer: "删掉最明显的情绪反应，只保留身体动作和它与空间的关系。", misuse: "把去表演化误当作无信息的面无表情。" },
  meta: { scene: "角色发现自己正在被记录，但生活必须继续", transfer: "让自反暴露后的世界留下一个永久变化，并让之后的沉浸付出代价。", misuse: "打破虚构后取消所有后果。" },
  affect: { scene: "观众知道餐桌上的汤有毒，角色们却仍在客气地让菜", transfer: "只改变观众知道什么，不改变角色行为，测量礼貌如何变成共谋。", misuse: "把情绪强度误当作叙事意义。" },
  craft: { scene: "同一条三分钟素材，用两条互相冲突的规则剪成两版", transfer: "设定一条约束，再故意违反一次，记录违反是否产生了可解释的新意义。", misuse: "用理论名称替代实际选择。" },
};

function nodeLesson(node) {
  const override = NODE_DETAILS[node.id] || {};
  const related = (node.links || []).map(nodeById).filter(Boolean);
  const relatedNames = related.map((item) => item.zh).join("、") || "相邻操作";
  const fallback = BRANCH_DETAIL_SCENES[node.branch] || BRANCH_DETAIL_SCENES.craft;
  return {
    analysis: override.analysis || `${node.def} 它的专业价值不在名称，而在它改变了观众如何组织信息。把「${node.zh}」和「${relatedNames}」并置时，要追问：哪一项预期被建立，哪一个变量被改变，观众又在何时意识到旧解释不再成立。`,
    example: override.example || `在${fallback.scene}里，先建立「${relatedNames}」的常规关系，再让「${node.zh}」只改变其中一个参数。不要立刻解释，让观众先根据旧模型行动，下一次事件再迫使他们修正。`,
    transfer: override.transfer || fallback.transfer,
    misuse: override.misuse || fallback.misuse,
  };
}

function renderNodeDetail() {
  const node = nodeById(state.activeNodeId);
  if (!node) return renderAtlas();
  const branch = ATLAS_BRANCHES.find((item) => item.id === node.branch);
  const group = ATLAS_GROUPS.find((item) => item.id === node.group);
  const lesson = nodeLesson(node);
  const related = (node.links || []).map(nodeById).filter(Boolean);
  const masters = MASTER_ATLAS.filter((master) => master.methods.includes(node.id));
  const notes = state.viewingNotes.filter((note) => note.nodeId === node.id);
  return `<div class="page node-detail-page">
    <button class="node-back" type="button" data-action="back-atlas">${icon("arrow")} 返回故事技术图谱</button>
    <p class="eyebrow">${escapeHtml(branch?.label || "个人节点")} / ${escapeHtml(group?.label || "自定义簇")}</p>
    <h1 class="page-title">${escapeHtml(node.zh)}</h1>
    <p class="node-en">${escapeHtml(node.en)} · 稀有度 ${"●".repeat(Math.max(1, Math.min(5, node.rarity || 3)))}</p>
    <p class="page-lead">${escapeHtml(node.def)}</p>

    <div class="node-principle">
      <small>一句话心法</small>
      <p>${escapeHtml(lesson.analysis)}</p>
    </div>

    <div class="section-head"><h2>拆开看</h2><p>机制 → 案例 → 迁移</p></div>
    <article class="node-lesson-card"><small>底层机制</small><p>${escapeHtml(lesson.analysis)}</p></article>
    <article class="node-lesson-card"><small>具体案例</small><p>${escapeHtml(lesson.example)}</p></article>
    <article class="node-lesson-card"><small>迁移到剪辑</small><p>${escapeHtml(lesson.transfer)}</p></article>
    <article class="node-lesson-card misuse"><small>失效条件</small><p>${escapeHtml(lesson.misuse)}</p></article>

    <div class="section-head"><h2>关系生长</h2><p>${related.length} 条相邻操作</p></div>
    <div class="node-links">
      ${related.length ? related.map((item) => `<button type="button" data-action="open-node" data-node="${item.id}"><span>${escapeHtml(DOMAINS[item.branch]?.name || DOMAIN_NAME(item.branch))}</span><b>${escapeHtml(item.zh)}</b><small>${escapeHtml(item.en)}</small></button>`).join("") : `<div class="empty-state">这个节点还没有显式连接，适合用来发明新的关系。</div>`}
    </div>

    <div class="section-head"><h2>大师方法</h2><p>${masters.length} 位相关创作者</p></div>
    <div class="master-archive">
      ${masters.length ? masters.map((master) => `<details class="master-entry"><summary><span>${escapeHtml(master.region.slice(0, 1))}</span><b>${escapeHtml(master.name)}</b><small>${escapeHtml(master.role)}</small></summary><p>${escapeHtml(master.signature)}</p><small class="master-caution">${escapeHtml(master.case)}</small></details>`).join("") : `<div class="empty-state">没有大师被固定绑定到这里。把术语放回你的观看经验，比依赖名人背书更重要。</div>`}
    </div>

    <div class="section-head"><h2>我的观影证据</h2><p>${notes.length} 条</p></div>
    <div class="insight-list">
      ${notes.length ? notes.map((note) => `<article class="watch-note"><div class="watch-note-top"><b>${escapeHtml(note.film)}</b><span>${escapeHtml(note.timecode || "无时间点")}</span></div><p>${escapeHtml(note.observation)}</p></article>`).join("") : `<div class="empty-state">还没有把观影观察挂到这个节点。下一次看到它真正生效的瞬间，再回来留下证据。</div>`}
    </div>

    <button class="button" type="button" data-action="add-node-experiment" data-node="${node.id}" style="margin-top:18px">${icon("check")} 将它设为我今天的实验</button>
  </div>`;
}

function renderProfile() {
  const entries = profileEntries();
  const sortedDesc = entries.slice().reverse();
  const completed = Object.keys(state.completedDays).length;
  return `<div class="page">
    <p class="eyebrow">LIVING CREATIVE PROFILE</p>
    <h1 class="page-title">不是评分，<br />是你的创作条件。</h1>
    <p class="page-lead">画像只记录有证据的倾向，并同时保留“下一层能力”。完成 ${completed} 次训练，沉淀 ${state.insights.length} 条规则。</p>
    <section class="profile-hero">
      <small>NEXT-SELF HYPOTHESIS</small>
      <h2>${escapeHtml(futureSelfLine())}</h2>
      <p>这不是预测，而是最近发展区。未来自我必须能被一次具体剪辑实验验证，不能只是“变得更厉害”。</p>
    </section>
    <div class="section-head"><h2>能力信号</h2><button type="button" data-action="open-library">故事技术图谱 ${icon("arrow")}</button></div>
    <section class="trait-list">
      ${entries.map((trait) => `<div class="trait-row">
        <div class="trait-label"><b>${escapeHtml(trait.label)}</b><small>${escapeHtml(trait.hint)}</small></div>
        <div class="trait-track"><i style="width:${Math.max(4, Math.min(100, trait.score))}%"></i></div>
        <span>${trait.score}</span>
      </div>`).join("")}
    </section>
    <div class="future-card">
      <small>YOUR CURRENT LEVERAGE</small>
      <h3>${escapeHtml(sortedDesc[0].label)} 是当前支点</h3>
      <p>把强项变成方法，而不是重复它。让它去补一个弱项：${escapeHtml(sortedDesc[0].label)} × ${escapeHtml(entries[0].label)}，很可能就是下一阶段最独特的风格入口。</p>
    </div>
    <div class="section-head"><h2>已沉淀规则</h2><p>${state.insights.length} 条</p></div>
    <div class="insight-list">
      ${
        state.insights.length
          ? state.insights
              .slice()
              .reverse()
              .slice(0, 20)
              .map(
                (item) => `<article class="insight-item"><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.body)}</p><div class="insight-meta"><span>${escapeHtml(PROFILE_TRAITS.find((trait) => trait.id === item.category)?.label || "未分类")}</span><span>${escapeHtml(item.date)}</span></div></article>`,
              )
              .join("")
          : `<div class="empty-state">还没有沉淀规则。去今日页完成一道“缝”，或在对谈里保存一条真正可执行的判断。</div>`
      }
    </div>
    <div class="section-head"><h2>原则底片</h2><p>可随讨论继续改写</p></div>
    <div class="insight-list">
      ${CREATIVE_PRINCIPLES.map((item, index) => `<div class="insight-item"><b>${String(index + 1).padStart(2, "0")}</b><p>${escapeHtml(item)}</p></div>`).join("")}
    </div>
    <div class="settings-zone" style="margin-top:28px;padding-top:16px;border-top:1px solid var(--line)">
      <button class="button danger" type="button" data-action="reset-all">清除本机画像与记录</button>
    </div>
  </div>`;
}

function renderLibrary() {
  const domain = state.libraryDomain;
  const techniques = domain === "all" ? TECHNIQUES : TECHNIQUES.filter((item) => item.domain === domain);
  return `<div class="page">
    <p class="eyebrow">TOOL ARCHIVE · ${TECHNIQUES.length} OPERATIONS</p>
    <h1 class="page-title">不是技巧清单，<br />是操作组合器。</h1>
    <p class="page-lead">按信息、时间、声音和画面寻找可迁移的形式操作。真正的新技巧来自组合、反转和限制，而不是再加一个转场。</p>
    <div class="library-filters">
      <button class="${domain === "all" ? "is-selected" : ""}" type="button" data-action="filter-library" data-domain="all">全部</button>
      ${Object.entries(DOMAINS).map(([key, item]) => `<button class="${domain === key ? "is-selected" : ""}" type="button" data-action="filter-library" data-domain="${key}">${escapeHtml(item.short)}</button>`).join("")}
    </div>
    <div class="technique-list" style="margin-top:13px">
      ${techniques.map((tech, index) => techniqueCard(tech, index)).join("")}
    </div>
  </div>`;
}

function render() {
  const header = document.getElementById("app-header");
  const nav = document.getElementById("bottom-nav");
  const main = document.getElementById("main-content");
  header.hidden = false;
  nav.hidden = false;
  document.querySelectorAll(".nav-item").forEach((item) =>
    item.classList.toggle("is-active", item.dataset.route === route || (route === "node" && item.dataset.route === "atlas")),
  );
  if (route === "node") main.innerHTML = renderNodeDetail();
  else if (route === "atlas") main.innerHTML = renderAtlas();
  else if (route === "lab") main.innerHTML = renderLab();
  else if (route === "dialogue") main.innerHTML = renderDialogue();
  else if (route === "profile") main.innerHTML = renderProfile();
  else if (route === "library") main.innerHTML = renderLibrary();
  else main.innerHTML = renderHome();
  if (route === "atlas") window.requestAnimationFrame(drawAtlasMap);
}

function setRoute(nextRoute) {
  route = nextRoute;
  render();
  document.getElementById("main-content").scrollTop = 0;
}

function formatBytes(bytes) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDuration(seconds) {
  const value = Math.round(seconds || 0);
  const minutes = Math.floor(value / 60);
  return `${String(minutes).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function formatTimecode(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(value / 60);
  const rest = (value % 60).toFixed(1).padStart(4, "0");
  return `${String(minutes).padStart(2, "0")}:${rest}`;
}

async function importVideo(role, file) {
  if (!file || !file.type.startsWith("video/")) {
    showToast("请选择一个视频文件。");
    return;
  }
  if (runtimeMedia[role].url) URL.revokeObjectURL(runtimeMedia[role].url);
  try {
    runtimeMedia[role] = { file, url: URL.createObjectURL(file) };
    const metadata = await readVideoMetadata(runtimeMedia[role].url);
    state.works[role] = {
      role,
      fileName: file.name,
      size: file.size,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      metrics: null,
      notes: state.works[role]?.notes || [],
      importedAt: new Date().toISOString(),
    };
    saveState();
    render();
    showToast(`${file.name} 已在本地载入。不会上传原片。`);
  } catch (error) {
    showToast(error.message || "这个视频格式无法在当前浏览器读取。");
  }
}

function readVideoMetadata(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve({
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      width: video.videoWidth,
      height: video.videoHeight,
    });
    video.onerror = () => reject(new Error("无法读取视频元数据"));
    video.src = url;
  });
}

async function scanVideo(role) {
  const media = runtimeMedia[role];
  if (!media.file) {
    showToast("请先重新导入原片；页面刷新后浏览器不会保留视频文件。");
    return;
  }
  if (scanJob) {
    showToast("已有一个扫描正在进行。");
    return;
  }
  scanJob = { role, progress: 0, cancelled: false };
  render();
  try {
    const metrics = await analyzeVideoFile(media.url, async (progress) => {
      scanJob.progress = progress;
      const bar = document.getElementById("scan-bar");
      const copy = document.getElementById("scan-copy");
      if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
      if (copy) copy.textContent = `正在本地扫描镜头变化… ${Math.round(progress * 100)}%`;
    });
    state.works[role].metrics = metrics;
    saveState();
    showToast(`扫描完成：检测到 ${metrics.cuts} 个镜头切点。`);
  } catch (error) {
    showToast(error.message || "视频扫描失败。");
  } finally {
    scanJob = null;
    render();
  }
}

async function analyzeVideoFile(url, onProgress) {
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new Error("浏览器无法解码这个视频。"));
  });
  if (scanJob) scanJob.video = video;
  const duration = video.duration;
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 27;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const cuts = [];
  let previous = null;
  let lastSample = -1;
  let lastCut = -1;
  const threshold = Number(state.scanThreshold || 25);

  video.playbackRate = 16;
  video.currentTime = 0;

  const sample = () => {
    if (scanJob?.cancelled) return;
    if (video.currentTime - lastSample < 0.12) return;
    lastSample = video.currentTime;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    if (previous) {
      let diff = 0;
      for (let index = 0; index < data.length; index += 4) {
        const luminance = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
        const prevLuminance = previous[index] * 0.299 + previous[index + 1] * 0.587 + previous[index + 2] * 0.114;
        diff += Math.abs(luminance - prevLuminance);
      }
      const score = diff / (canvas.width * canvas.height);
      if (score > threshold && video.currentTime - lastCut > 0.18) {
        cuts.push(video.currentTime);
        lastCut = video.currentTime;
      }
    }
    previous = new Uint8ClampedArray(data);
    onProgress?.(Math.min(1, video.currentTime / duration));
  };

  if ("requestVideoFrameCallback" in video) {
    const tick = () => {
      if (scanJob?.cancelled) return;
      sample();
      if (!video.ended) video.requestVideoFrameCallback(tick);
    };
    video.requestVideoFrameCallback(tick);
  } else {
    const timer = window.setInterval(() => {
      sample();
      if (video.ended || scanJob?.cancelled) window.clearInterval(timer);
    }, 120);
  }

  await new Promise((resolve, reject) => {
    if (scanJob) scanJob.cancelResolve = resolve;
    video.onended = resolve;
    video.onerror = () => reject(new Error("扫描时视频解码中断。"));
    video.play().catch(() => reject(new Error("浏览器阻止了视频扫描。请重新选择视频后再试。")));
  });
  if (scanJob?.cancelled) {
    video.pause();
    throw new Error("扫描已停止。");
  }
  onProgress?.(1);
  const boundaries = [0, ...cuts.filter((time) => time > 0 && time < duration), duration];
  const shots = [];
  for (let index = 1; index < boundaries.length; index += 1) {
    shots.push(boundaries[index] - boundaries[index - 1]);
  }
  const avg = shots.reduce((sum, value) => sum + value, 0) / Math.max(1, shots.length);
  const variance = Math.sqrt(shots.reduce((sum, value) => sum + (value - avg) ** 2, 0) / Math.max(1, shots.length));
  return {
    duration,
    cuts: cuts.length,
    cutTimes: cuts.slice(0, 2500).map((value) => Number(value.toFixed(2))),
    avgShot: Number(avg.toFixed(2)),
    variance: Number(variance.toFixed(2)),
    longest: Number(Math.max(0, ...shots).toFixed(2)),
    cutRate: Number(((cuts.length / duration) * 60).toFixed(2)),
    detectedAt: new Date().toISOString(),
  };
}

function addVideoNote(role) {
  const work = state.works[role];
  const video = document.getElementById(`video-${role}`);
  const input = document.getElementById(`shot-note-${role}`);
  const text = input?.value.trim();
  if (!work || !video || !text) {
    showToast("请先暂停视频并写下一个具体的剪辑判断。");
    return;
  }
  work.notes.push({ time: Number(video.currentTime.toFixed(2)), text, createdAt: new Date().toISOString() });
  saveState();
  render();
  showToast("时间线笔记已保存。");
}

async function copyBrief() {
  const brief = buildAnalysisBrief();
  try {
    await navigator.clipboard.writeText(brief);
    showToast("对比诊断包已复制，可粘贴给 Codex 或模型。");
  } catch {
    showToast("复制失败。请确认浏览器允许剪贴板权限。");
  }
}

function buildAnalysisBrief() {
  const mine = state.works.mine;
  const reference = state.works.reference;
  const lines = [
    "使用 $story-cutting-mentor 帮我分析以下两个剪辑版本。不要把差异等同于优劣，要区分观看契约、制作限制和可测试的剪辑选择。",
    "",
    `我的版本：${mine?.fileName || "未导入"}`,
    mine?.metrics ? `指标：${JSON.stringify(mine.metrics)}` : "指标：未扫描",
    mine?.notes?.length ? `时间线笔记：\n${mine.notes.map((note) => `- ${formatTimecode(note.time)} ${note.text}`).join("\n")}` : "时间线笔记：无",
    "",
    `参考版本：${reference?.fileName || "未导入"}`,
    reference?.metrics ? `指标：${JSON.stringify(reference.metrics)}` : "指标：未扫描",
    reference?.notes?.length ? `时间线笔记：\n${reference.notes.map((note) => `- ${formatTimecode(note.time)} ${note.text}`).join("\n")}` : "时间线笔记：无",
    "",
    `当前画像：${PROFILE_TRAITS.map((trait) => `${trait.label}${state.profile[trait.id] || 45}`).join("，")}`,
    `我最想要提升的方向：${profileEntries()[0].label} / ${profileEntries()[1].label}`,
    "",
    "请输出：一句话诊断、最多三处高价值差异、两种版本各自的观看契约、三个未来自我假设、一个今天就能完成的 15–30 秒实验。",
  ];
  return lines.join("\n");
}

function buildSystemPrompt() {
  const sorted = profileEntries();
  const today = techniquesForDay();
  return `你是“切面”，一个高级故事与剪辑导师。你不教基础转场，不用“节奏更好”“更有情绪”等空话。坚持证据优先，区分观察、解释和实验。不要编造名人轶事或影片事实。

用户当前画像（数值是练习信号，不是能力评分）：
${PROFILE_TRAITS.map((trait) => `- ${trait.label}: ${state.profile[trait.id] || 45}/100；${trait.hint}`).join("\n")}

当前弱项：${sorted.slice(0, 2).map((item) => item.label).join("、")}
当前强项：${sorted.slice(-1)[0].label}
今日五个技巧：${today.map((item) => `${item.title}（${item.mechanism}）`).join("；")}
今日图谱术语：${todayAtlasNodes().map((node) => `${node.zh}/${node.en}`).join("；")}
最近观影证据：${state.viewingNotes.slice(-6).map((note) => `${note.film} ${note.timecode || ""}: ${note.observation}`).join("；") || "暂无"}
作品指标：${JSON.stringify({ mine: state.works.mine?.metrics || null, reference: state.works.reference?.metrics || null })}
最近规则：${state.insights.slice(-8).map((item) => item.title).join("；") || "暂无"}

回答时：先用一句尖锐假设回应；随后指出机制和风险；只问一个真正会改变诊断的问题；最后给一个可观察实验。若用户的想法只是形式装饰，要直接但具体地反驳。`;
}

async function sendChat() {
  if (chatBusy) return;
  const input = document.getElementById("chat-input");
  const text = input?.value.trim();
  if (!text) return;
  state.chatMessages.push({ role: "user", content: text, time: new Date().toISOString() });
  chatBusy = true;
  saveState();
  render();

  let answer = "";
  if (state.ai.endpoint && state.ai.model) {
    try {
      const contextMessages = state.chatMessages.slice(-14).map((message) => ({ role: message.role, content: message.content }));
      const response = await fetch(state.ai.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(state.ai.key ? { Authorization: `Bearer ${state.ai.key}` } : {}),
        },
        body: JSON.stringify({
          model: state.ai.model,
          messages: [{ role: "system", content: buildSystemPrompt() }, ...contextMessages],
          temperature: 0.82,
        }),
      });
      if (!response.ok) throw new Error(`接口返回 ${response.status}`);
      const data = await response.json();
      answer =
        data?.choices?.[0]?.message?.content ||
        data?.output_text ||
        data?.message?.content ||
        "";
      if (!answer) throw new Error("模型返回为空");
    } catch (error) {
      answer = `接口没有完成回答：${error.message}。\n\n先用离线版给你一个更尖锐的问题：你说想出“内外层同构”，现在请指出内外层到底同构的是哪三层关系——权力、时间还是信息？如果只能保留一层严格同构，哪一层被删掉会让作品反而更清楚？`;
    }
  } else {
    answer = offlineMentor(text);
  }

  state.chatMessages.push({ role: "assistant", content: answer, time: new Date().toISOString() });
  chatBusy = false;
  saveState();
  render();
  document.getElementById("main-content").scrollTop = document.getElementById("main-content").scrollHeight;
}

function offlineMentor(text) {
  const sorted = profileEntries();
  if (/元叙事|第四堵墙|打破/.test(text)) {
    return "先给一个判断：你现在关注的不是“打破第四堵墙”，而是观众与故事的契约何时可以短暂失效又必须返回。\n\n机制上，元叙事呼吸口至少要完成两件事：释放此前积压的压力，并让返回后的世界留下不可撤回的变化。如果角色看向镜头后一切照常，那不是呼吸口，只是眨眼。\n\n一个追问：你的“呼吸口”打开了哪一条信息通道——角色知道自己在被拍、作者介入、还是观众发现自己一直在误认媒介？实验：只保留 6 秒暴露，让下一场的一个道具位置发生永久改变。";
  }
  if (/同构|套层|内外/.test(text)) {
    return "先别让内外层“主题相似”。同构必须有可计数、可拍摄的关系：谁等谁、谁控制门、谁知道真相、什么声音能穿透层与层。\n\n一个危险是：外层解释内层，内层又解释外层，最后只剩重复。真正有效的同构应该在中间发生一次错位，让观众发现规则不是完全相同，而是差了一个代价。\n\n追问：如果内外层必须有一处不同，哪一处差异最能解释你为什么需要两层？实验：写下五组对应关系，只保留三组，故意让第四组失败。";
  }
  return `先给你一个可被反驳的假设：你现在想找的可能不是“更特别的技巧”，而是一种能让观众在事后重新组织旧画面的规则。\n\n你当前最值得补的不是堆叠形式，而是「${sorted[0].label}」。如果这个判断成立，下一刀不应增加信息，而应改变观众对已发生信息的归属、时序或责任。\n\n只问一个问题：观众现在明确知道什么，又在什么时候意识到自己理解错了？实验：用现有素材剪出 15 秒，让同一物件在前后拥有两种证据身份；不要加旁白解释。`;
}

function saveAiSettings() {
  state.ai.endpoint = document.getElementById("ai-endpoint")?.value.trim() || "";
  state.ai.model = document.getElementById("ai-model")?.value.trim() || "";
  state.ai.key = document.getElementById("ai-key")?.value.trim() || "";
  saveState();
  render();
  showToast(state.ai.endpoint && state.ai.model ? "模型接口已保存。" : "已切换为离线模式。");
}

function saveDiscussion() {
  if (!state.chatMessages.length) {
    showToast("本轮还没有对话。");
    return;
  }
  const lastAssistant = state.chatMessages.slice().reverse().find((message) => message.role === "assistant");
  const lastUser = state.chatMessages.slice().reverse().find((message) => message.role === "user");
  const category = profileEntries()[0].id;
  const entry = {
    id: newId(),
    title: `讨论沉淀 · ${lastUser?.content.slice(0, 16) || "本轮对话"}`,
    body: (lastAssistant?.content || "尚未形成导师回答。").slice(0, 220),
    category,
    evidence: "实时对谈",
    date: localDateKey(),
    source: "discussion",
  };
  state.discussions.push({ id: entry.id, date: entry.date, messages: state.chatMessages.slice(-20) });
  state.insights.push(entry);
  updateTrait(category);
  saveState();
  render();
  showToast("讨论已归类并写入画像。");
}

function saveInsight() {
  const title = document.getElementById("insight-title")?.value.trim();
  const body = document.getElementById("insight-body")?.value.trim();
  const category = document.getElementById("insight-category")?.value;
  const evidence = document.getElementById("insight-evidence")?.value.trim();
  if (!title || !body) {
    showToast("至少写下规则名称和可执行原则。");
    return;
  }
  state.insights.push({
    id: newId(),
    title,
    body,
    category,
    evidence,
    date: localDateKey(),
    source: "user",
  });
  updateTrait(category);
  saveState();
  render();
  showToast("新规则已进入长期画像。");
}

function updateTrait(category) {
  state.profile[category] = Math.min(100, (state.profile[category] || 45) + 2);
}

function completeDay() {
  const key = localDateKey();
  const already = Boolean(state.completedDays[key]);
  if (!already) {
    state.completedDays[key] = { completedAt: new Date().toISOString(), techniques: techniquesForDay().map((item) => item.id) };
    const category = profileEntries()[0].id;
    state.insights.push({
      id: newId(),
      title: `今日实验 · ${techniquesForDay()[0].title}`,
      body: `把一个改变信息、关系或时间的操作剪成 15–30 秒，并记录观众对旧画面的理解是否改变。`,
      category,
      evidence: "每日训练",
      date: key,
      source: "daily",
    });
    updateTrait(category);
  }
  saveState();
  render();
  showToast(already ? "今天可以再做一次更小、更狠的实验。" : "今日训练已沉淀，画像获得一条新证据。");
}

function resetAll() {
  if (!window.confirm("确定清除作品指标、画像、规则和对话吗？原始视频不会受影响。")) return;
  state = clone(DEFAULT_STATE);
  saveState();
  render();
  showToast("本机记录已清除。");
}

function showToast(message, duration = 2800) {
  const toast = document.getElementById("toast");
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), duration);
}

document.addEventListener("click", (event) => {
  const routeTarget = event.target.closest("[data-route]");
  if (routeTarget) {
    setRoute(routeTarget.dataset.route);
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "complete-day") completeDay();
  if (action === "open-library") setRoute("atlas");
  if (action === "filter-atlas-layer") {
    state.atlasLayer = state.atlasLayer === target.dataset.layer ? null : target.dataset.layer;
    state.atlasBranch = null;
    saveState();
    render();
  }
  if (action === "filter-atlas") {
    state.atlasBranch = target.dataset.branch || null;
    if (state.atlasBranch) {
      state.atlasLayer = ATLAS_LAYERS.find((layer) => layer.branches.includes(state.atlasBranch))?.id || null;
    }
    saveState();
    render();
  }
  if (action === "save-watch-note") saveWatchNote();
  if (action === "open-node") {
    state.activeNodeId = target.dataset.node;
    setRoute("node");
  }
  if (action === "back-atlas") setRoute("atlas");
  if (action === "add-node-experiment") {
    const node = nodeById(target.dataset.node);
    if (node) {
      const category = branchToProfile(node.branch);
      state.insights.push({
        id: newId(),
        title: `今日实验 · ${node.zh}`,
        body: nodeLesson(node).transfer,
        category,
        evidence: "故事技术图谱",
        date: localDateKey(),
        source: "atlas",
      });
      updateTrait(category);
      saveState();
      showToast(`「${node.zh}」已设为你今天的实验。`);
    }
  }
  if (action === "jump-node") {
    const node = nodeById(target.dataset.node);
    if (node) {
      state.atlasBranch = node.branch;
      state.atlasSearch = node.zh;
      state.activeNodeId = node.id;
      saveState();
      setRoute("node");
    }
  }
  if (action === "filter-library") {
    state.libraryDomain = target.dataset.domain;
    saveState();
    render();
  }
  if (action === "pick-video") document.querySelector(`[data-video-input="${target.dataset.role}"]`)?.click();
  if (action === "scan-video") scanVideo(target.dataset.role);
  if (action === "cancel-scan" && scanJob) {
    scanJob.cancelled = true;
    scanJob.video?.pause();
    scanJob.cancelResolve?.();
    showToast("正在停止扫描…");
  }
  if (action === "add-note") addVideoNote(target.dataset.role);
  if (action === "copy-brief") copyBrief();
  if (action === "send-chat") sendChat();
  if (action === "save-ai") saveAiSettings();
  if (action === "save-discussion") saveDiscussion();
  if (action === "save-insight") saveInsight();
  if (action === "clear-chat") {
    state.chatMessages = [];
    saveState();
    render();
  }
  if (action === "reset-all") resetAll();
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-video-input]")) {
    importVideo(event.target.dataset.videoInput, event.target.files?.[0]);
  }
});

let atlasSearchTimer = null;
document.addEventListener("input", (event) => {
  if (event.target.id === "atlas-search") {
    state.atlasSearch = event.target.value;
    window.clearTimeout(atlasSearchTimer);
    atlasSearchTimer = window.setTimeout(() => {
      const results = document.getElementById("atlas-results");
      if (results) results.innerHTML = renderAtlasResults();
    }, 180);
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.getElementById("install-button").hidden = false;
});

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
if (isIOS && !standalone) document.getElementById("install-button").hidden = false;
document.getElementById("install-button").addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    showToast("iPhone：在 Safari 点“分享”，再选“添加到主屏幕”。");
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById("install-button").hidden = true;
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

render();
