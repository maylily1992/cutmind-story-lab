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
  const completed = Boolean(state.completedDays[localDateKey()]);
  return `<div class="page">
    <p class="eyebrow">DAILY CUT LAB · ${escapeHtml(dateLabel())}</p>
    <h1 class="page-title">让一条规则<br />短暂失效。</h1>
    <p class="page-lead">今天不是学更多技巧，而是找到一种能改变信息、关系或时间的操作。五张牌，一个异闻，一个可以今天就剪的缝。</p>

    <section class="day-hero">
      <div class="hero-top"><code>FRAME ${String(epochDay()).slice(-4)}</code><span>${completed ? "今日已沉淀" : "第 " + Object.keys(state.completedDays).length + " 次训练"}</span></div>
      <h1>${escapeHtml(futureSelfLine().split("；")[0])}</h1>
      <p>${escapeHtml(techniques.map((item) => item.title).join(" × "))}</p>
      <div class="hero-actions">
        <button class="button" type="button" data-action="complete-day">${completed ? "今天再想一次" : "沉淀今日练习"} ${icon(completed ? "arrow" : "check")}</button>
        <button class="button ghost small" type="button" data-action="open-library">技巧库</button>
      </div>
    </section>

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
      <p>选今天任意一张牌，在现有素材中只改变一个变量，剪出 15–30 秒。不要做完整作品，只验证“观众是否因为我改变的那一刀，重新理解此前画面”。</p>
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
    <div class="section-head"><h2>能力信号</h2><button type="button" data-action="open-library">技巧档案 ${icon("arrow")}</button></div>
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
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.route === route));
  if (route === "lab") main.innerHTML = renderLab();
  else if (route === "dialogue") main.innerHTML = renderDialogue();
  else if (route === "profile") main.innerHTML = renderProfile();
  else if (route === "library") main.innerHTML = renderLibrary();
  else main.innerHTML = renderHome();
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
  if (action === "open-library") setRoute("library");
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
