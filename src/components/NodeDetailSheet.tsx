import { createPortal } from "react-dom";
import { nodeDetails } from "../data/catalog";
import type { TechniqueNode } from "../domain/types";

interface NodeDetailSheetProps {
  node: TechniqueNode;
  nodes: TechniqueNode[];
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export function NodeDetailSheet({
  node,
  nodes,
  onClose,
  onNavigate,
}: NodeDetailSheetProps) {
  const detail = nodeDetails[node.id];
  const related = node.related
    .map((id) => nodes.find((item) => item.id === id))
    .filter((item): item is TechniqueNode => Boolean(item));

  return createPortal(
    <div className="node-sheet-backdrop" onClick={onClose} role="presentation">
      <article
        aria-label={`${node.name}详情`}
        className="node-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="sheet-grabber" />
        <header className="node-sheet-head">
          <div>
            <small>{node.dimension} · {node.status.toUpperCase()}</small>
            <h2>{node.name}</h2>
            <p>{node.aliases.join(" / ")}</p>
          </div>
          <button onClick={onClose} type="button">关闭</button>
        </header>
        <div className="node-sheet-scroll">
          <div className="node-principle">
            <small>底层机制</small>
            <p>{node.mechanism}</p>
          </div>
          <div className="node-sheet-grid">
            <article><small>专业分析</small><p>{detail?.analysis ?? "把它放回观众模型：建立了什么预期，又改写了哪个变量？"}</p></article>
            <article><small>具体案例</small><p>{detail?.example ?? "用一场 15 秒的戏，只改变一个信息变量，让旧镜头重新排序。"}</p></article>
            <article><small>迁移到剪辑</small><p>{detail?.transfer ?? "从现有素材中选一个可逆动作，让第二次出现承担不同证据。"}</p></article>
            <article className="misuse"><small>失效条件</small><p>{detail?.misuse ?? "没有证据链、无法重读前文时，形式只剩装饰。"}</p></article>
          </div>
          <div className="sheet-section-head"><b>关系生长</b><span>{related.length} 个相邻节点</span></div>
          <div className="node-links">
            {related.map((item) => (
              <button key={item.id} onClick={() => onNavigate(item.id)} type="button">
                <span>{item.dimension}</span>
                <b>{item.name}</b>
                <small>{item.aliases[0]}</small>
              </button>
            ))}
          </div>
          <div className="sheet-signals">
            <span><b>{node.myUsageCount}</b>使用次数</span>
            <span><b>{node.masterLevel}</b>掌握等级</span>
            <span><b>{node.related.length}</b>连接关系</span>
          </div>
        </div>
      </article>
    </div>,
    document.body,
  );
}
