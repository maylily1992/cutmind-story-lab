# 切面 CUT / STORY

在线地址：<https://maylily1992.github.io/cutmind-story-lab/>

`切面`正在从叙事术语展示 App 演进为私人叙事操作系统。当前版本完成 **P0：可生长的技法节点与低摩擦快捕链**。

## 已实现

- React + TypeScript strict + Vite，纯前端构建。
- 215 个种子技法节点，按 `物 → 知 → 动 → 感 → 元` 五层、13 分支、39 知识簇组织。
- 可缩放、可拖拽、可逐层展开的径向知识星图；层、分支、知识簇和叶片均可点击。
- 技法详情使用移动端底部抽屉，支持相邻节点跳转，不离开图谱。
- 双向关系、父子关系和用户自定义节点。
- 三种快捕：一句话、只存感觉、长文本榨取。
- AI 代理解析与无 AI 时的本地解析回退。
- 名称/别名相似度判重，不自动把同义说法建成重复节点。
- 草稿可编辑名称、别名、机制、维度、收益类型和关联节点。
- 版本化 `localStorage`；P1 将把作品文件、切片和决策日志迁移到 IndexedDB。
- 作品档案与剪辑决策的数据结构已建立，自动视频指纹分析留在 P1。

## 数据模型

`src/domain/types.ts` 包含：

- `TechniqueNode`
- `FilmCut`
- `MyWork`
- `DecisionLog`
- `StyleFingerprint`
- `TrainingPlan`
- `TechniqueParseResult`
- `CaptureDraft`
- `CutMindStore`

## 文件结构

```text
src/
  domain/types.ts          # 严格领域模型
  data/catalog.ts          # 旧知识库到 TechniqueNode 的适配层
  lib/storage.ts           # schema v2 本地存储、迁移与双向关系写入
  lib/techniqueParser.ts   # 本地判重、解析和 AI 代理提示词
  components/QuickCapture.tsx
  styles/p0.css
  App.tsx
  main.tsx
data.js                    # 每日技巧与异闻种子
atlas-data.js              # 图谱、大师、训练计划与来源
public/                    # manifest、图标、service worker
docs/                      # Vite 构建产物，GitHub Pages 发布目录
```

## AI 代理契约

浏览器不保存模型密钥。构建时通过 `VITE_AI_PROXY_URL` 指定代理接口。代理接收：

```json
{
  "kind": "technique.parse",
  "mode": "quick",
  "system": "服务器端提示词",
  "user": "候选节点与用户输入",
  "responseFormat": "json"
}
```

代理可以返回 `{ "content": "<JSON 字符串>" }`、`{ "text": "<JSON 字符串>" }` 或 `{ "result": { ... } }`。完整 AI 分类提示词位于 `src/lib/techniqueParser.ts`。

未配置代理时使用本地关键词、别名和机制文本匹配，仍是完整可用流程；它不等于大模型语义判断。

## 路线

- **P0 · 当前**：TechniqueNode、三入口快捕、判重、双向关系、AI 解析契约、localStorage。
- **P1 · 下一步**：IndexedDB、作品本地文件、镜头切点、决策日志、StyleFingerprint、与上一作品比较。
- **P2 · 后续**：TrainingPlan、误用回炉、每日一刃、剪辑沙盒与反向命题。

## 开发

```bash
npm install
npm run dev
npm run build
```

构建产物位于 `docs/`，GitHub Pages 从该目录发布。

## 边界

“无上传大小限制”只适用于浏览器本地读取原片；设备解码、内存、文件格式和播放器能力仍构成实际限制。当前 P0 不上传原片，也不声称已经具备视频语义分析。
