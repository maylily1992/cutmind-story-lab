import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  atlasBranches,
  atlasGroups,
  atlasLayers,
} from "../data/catalog";
import type { TechniqueNode } from "../domain/types";

type GraphKind = "root" | "layer" | "branch" | "group" | "node";

interface GraphDatum {
  id: string;
  label: string;
  subtitle?: string;
  kind: GraphKind;
  color: string;
  nodeId?: string;
  description?: string;
  children?: GraphDatum[];
}

interface AtlasGalaxyProps {
  nodes: TechniqueNode[];
  onOpenNode: (id: string) => void;
  query: string;
  setQuery: (value: string) => void;
}

const ROOT_ID = "root";

const NODE_WIDTHS: Record<GraphKind, number> = {
  root: 128,
  layer: 112,
  branch: 158,
  group: 142,
  node: 166,
};

const NODE_HEIGHTS: Record<GraphKind, number> = {
  root: 54,
  layer: 48,
  branch: 42,
  group: 34,
  node: 30,
};

function branchForNode(
  node: TechniqueNode,
  nodesById: Map<string, TechniqueNode>,
): string {
  const sourceBranch = node.sourceLabel?.split("/")[0];
  if (sourceBranch && atlasBranches.some((branch) => branch.id === sourceBranch)) {
    return sourceBranch;
  }
  for (const relatedId of node.related) {
    const relatedBranch = nodesById.get(relatedId)?.sourceLabel?.split("/")[0];
    if (relatedBranch && atlasBranches.some((branch) => branch.id === relatedBranch)) {
      return relatedBranch;
    }
  }
  return "craft";
}

function buildGraph(nodes: TechniqueNode[]): GraphDatum {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const groupsByBranch = new Map<string, GraphDatum[]>();
  const branchByGroup = new Map<string, string>();

  for (const group of atlasGroups) {
    const branch = atlasBranches.find((item) => item.id === group.branch);
    if (!branch) continue;
    const groups = groupsByBranch.get(group.branch) ?? [];
    groups.push({
      id: `group:${group.id}`,
      label: group.label,
      subtitle: "知识簇",
      kind: "group",
      color: branch.color,
      children: [],
    });
    groupsByBranch.set(group.branch, groups);
    branchByGroup.set(group.id, group.branch);
  }

  for (const node of nodes) {
    const branchId = branchForNode(node, nodesById);
    const branch = atlasBranches.find((item) => item.id === branchId);
    const sourceGroup = node.sourceLabel?.split("/")[1];
    const validGroup = sourceGroup && branchByGroup.get(sourceGroup) === branchId;
    const groupId = validGroup ? sourceGroup : `${branchId}-personal`;
    const groups = groupsByBranch.get(branchId) ?? [];
    let group = groups.find((item) => item.id === `group:${groupId}`);
    if (!group) {
      group = {
        id: `group:${groupId}`,
        label: validGroup ? "知识簇" : "个人生长",
        subtitle: "知识簇",
        kind: "group",
        color: branch?.color ?? "#9ea6a5",
        children: [],
      };
      groups.push(group);
      groupsByBranch.set(branchId, groups);
    }
    group.children?.push({
      id: `node:${node.id}`,
      nodeId: node.id,
      label: node.name,
      subtitle: node.aliases[0],
      kind: "node",
      color: branch?.color ?? "#9ea6a5",
      description: node.mechanism,
    });
  }

  return {
    id: ROOT_ID,
    label: "叙事 OS",
    subtitle: "五层故事系统",
    kind: "root",
    color: "#d8a24a",
    description: "点击任何层、分支或簇，继续向更深层展开。",
    children: atlasLayers.map((layer) => ({
      id: `layer:${layer.id}`,
      label: layer.label,
      subtitle: layer.longLabel,
      kind: "layer",
      color: layer.color,
      description: layer.question,
      children: layer.branches
        .map((branchId) => atlasBranches.find((item) => item.id === branchId))
        .filter((branch): branch is NonNullable<typeof branch> => Boolean(branch))
        .map((branch) => ({
          id: `branch:${branch.id}`,
          label: branch.label,
          subtitle: branch.en,
          kind: "branch",
          color: branch.color,
          description: branch.essence,
          children: groupsByBranch.get(branch.id) ?? [],
        })),
    })),
  };
}

function pruneGraph(node: GraphDatum, expanded: Set<string>): GraphDatum {
  return {
    ...node,
    children:
      expanded.has(node.id) && node.children
        ? node.children.map((child) => pruneGraph(child, expanded))
        : undefined,
  };
}

export function AtlasGalaxy({
  nodes,
  onOpenNode,
  query,
  setQuery,
}: AtlasGalaxyProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const viewportTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const [size, setSize] = useState({ width: 390, height: 620 });
  const [zoomLabel, setZoomLabel] = useState("100%");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([ROOT_ID]),
  );
  const [focus, setFocus] = useState<GraphDatum>({
    id: ROOT_ID,
    label: "故事技术图谱",
    subtitle: "五层故事系统",
    kind: "root",
    color: "#d8a24a",
    description: "拖动画布浏览全图，滚动或双指缩放。点击支点逐级展开。",
  });
  const fullGraph = useMemo(() => buildGraph(nodes), [nodes]);

  const searchResults = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return [];
    return nodes
      .filter((node) =>
        `${node.name} ${node.aliases.join(" ")} ${node.mechanism}`
          .toLowerCase()
          .includes(text),
      )
      .slice(0, 8);
  }, [nodes, query]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(520, entry.contentRect.height),
      });
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;
    const { width, height } = size;
    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const hierarchyData = d3.hierarchy<GraphDatum>(
      pruneGraph(fullGraph, expanded),
    );
    const layout = d3
      .tree<GraphDatum>()
      .nodeSize([72, 238])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.12))(hierarchyData);

    const visible = layout.descendants();
    const minY = d3.min(visible, (node) => node.x) ?? 0;
    const maxY = d3.max(visible, (node) => node.x) ?? 0;
    const minX = d3.min(visible, (node) => node.y) ?? 0;
    const maxX =
      (d3.max(visible, (node) => node.y) ?? 0) +
      Math.max(...visible.map((node) => NODE_WIDTHS[node.data.kind]));

    const viewport = svg.append("g").attr("class", "canvas-viewport");
    const linksLayer = viewport.append("g").attr("class", "canvas-links");
    const nodesLayer = viewport.append("g").attr("class", "canvas-nodes");

    linksLayer
      .selectAll("path")
      .data(layout.links())
      .join("path")
      .attr("d", (datum) => {
        const sourceX =
          datum.source.y + NODE_WIDTHS[datum.source.data.kind];
        const targetX = datum.target.y;
        const middle = (sourceX + targetX) / 2;
        return `M${sourceX},${datum.source.x} C${middle},${datum.source.x} ${middle},${datum.target.x} ${targetX},${datum.target.x}`;
      })
      .attr("fill", "none")
      .attr("stroke", (datum) => `${datum.target.data.color}58`)
      .attr("stroke-width", (datum) =>
        datum.target.data.kind === "node"
          ? 0.8
          : datum.target.data.kind === "group"
            ? 1.1
            : 1.45,
      )
      .attr("opacity", 0)
      .transition()
      .duration(260)
      .attr("opacity", 1);

    const nodeGroups = nodesLayer
      .selectAll<SVGGElement, d3.HierarchyPointNode<GraphDatum>>("g")
      .data(visible, (datum) => datum.data.id)
      .join("g")
      .attr("class", (datum) => `canvas-node canvas-node-${datum.data.kind}`)
      .attr("transform", (datum) => `translate(${datum.y},${datum.x})`)
      .attr("opacity", 0)
      .style("cursor", "pointer")
      .on("click", (event, datum) => {
        event.stopPropagation();
        const item = datum.data;
        if (item.kind === "node" && item.nodeId) {
          onOpenNode(item.nodeId);
          return;
        }
        setFocus(item);
        setExpanded((current) => new Set([...current, item.id]));
      });

    nodeGroups
      .append("rect")
      .attr("width", (datum) => NODE_WIDTHS[datum.data.kind])
      .attr("height", (datum) => NODE_HEIGHTS[datum.data.kind])
      .attr("x", 0)
      .attr("y", (datum) => -NODE_HEIGHTS[datum.data.kind] / 2)
      .attr("rx", (datum) =>
        datum.data.kind === "node" ? 8 : datum.data.kind === "root" ? 16 : 12,
      )
      .attr("fill", (datum) =>
        datum.data.kind === "root"
          ? "rgba(216,162,74,.12)"
          : datum.data.kind === "layer"
            ? "rgba(19,23,25,.98)"
            : datum.data.kind === "node"
              ? "rgba(17,20,22,.82)"
              : "rgba(20,24,26,.96)",
      )
      .attr("stroke", (datum) => `${datum.data.color}${datum.data.kind === "node" ? "46" : "99"}`)
      .attr("stroke-width", (datum) =>
        datum.data.kind === "root" || datum.data.kind === "layer" ? 1.5 : 1,
      )
      .attr("filter", (datum) =>
        datum.data.kind === "root" || datum.data.kind === "layer"
          ? `drop-shadow(0 4px 15px ${datum.data.color}22)`
          : null,
      );

    nodeGroups
      .filter((datum) => datum.data.kind !== "node")
      .append("circle")
      .attr("r", (datum) =>
        datum.data.kind === "root" ? 4.5 : datum.data.kind === "layer" ? 3.5 : 2.6,
      )
      .attr("cx", 12)
      .attr("fill", (datum) => datum.data.color);

    nodeGroups
      .append("text")
      .attr("x", (datum) => (datum.data.kind === "root" ? 24 : 22))
      .attr("y", (datum) =>
        datum.data.kind === "group" || datum.data.kind === "node" ? -2 : -3,
      )
      .attr("fill", "#f4efe4")
      .attr("font-family", (datum) =>
        datum.data.kind === "node"
          ? "-apple-system, BlinkMacSystemFont, sans-serif"
          : "'Songti SC', 'STSong', serif",
      )
      .attr("font-size", (datum) =>
        datum.data.kind === "root"
          ? 17
          : datum.data.kind === "layer"
            ? 14
            : datum.data.kind === "branch"
              ? 12
              : datum.data.kind === "group"
                ? 10
                : 9.5,
      )
      .attr("font-weight", (datum) =>
        datum.data.kind === "node" ? 500 : 650,
      )
      .text((datum) => truncate(datum.data.label, datum.data.kind));

    nodeGroups
      .filter((datum) => Boolean(datum.data.subtitle))
      .append("text")
      .attr("x", (datum) => (datum.data.kind === "root" ? 24 : 22))
      .attr("y", (datum) =>
        datum.data.kind === "group" || datum.data.kind === "node" ? 10 : 12,
      )
      .attr("fill", (datum) => `${datum.data.color}c4`)
      .attr("font-family", "-apple-system, BlinkMacSystemFont, sans-serif")
      .attr("font-size", (datum) =>
        datum.data.kind === "node" ? 6.5 : datum.data.kind === "root" ? 8 : 7,
      )
      .text((datum) => truncate(datum.data.subtitle ?? "", datum.data.kind));

    nodeGroups
      .transition()
      .duration(300)
      .attr("opacity", 1);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.24, 3.2])
      .on("zoom", (event) => {
        viewportTransformRef.current = event.transform;
        viewport.attr("transform", event.transform.toString());
        setZoomLabel(`${Math.round(event.transform.k * 100)}%`);
      });
    zoomRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);

    const padding = 54;
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const scale = Math.min(
      1.15,
      (width - padding * 2) / (contentWidth + padding),
      (height - padding * 2) / (contentHeight + padding),
    );
    const transform = d3.zoomIdentity
      .translate(
        width / 2 - scale * (minX + contentWidth / 2),
        height / 2 - scale * (minY + contentHeight / 2),
      )
      .scale(scale);
    svg.transition().duration(420).call(zoom.transform, transform);
  }, [expanded, fullGraph, onOpenNode, size]);

  function zoomBy(factor: number) {
    const svgElement = svgRef.current;
    const zoom = zoomRef.current;
    if (!svgElement || !zoom) return;
    d3.select(svgElement).transition().duration(220).call(zoom.scaleBy, factor);
  }

  function fitAll() {
    const svgElement = svgRef.current;
    const zoom = zoomRef.current;
    if (!svgElement || !zoom) return;
    setExpanded(new Set([ROOT_ID]));
    setFocus({
      id: ROOT_ID,
      label: "故事技术图谱",
      subtitle: "五层故事系统",
      kind: "root",
      color: "#d8a24a",
      description: "已恢复到五层与十三支点的总览。",
    });
    viewportTransformRef.current = d3.zoomIdentity;
  }

  return (
    <section className="canvas-shell">
      <div className="canvas-toolbar">
        <div className="canvas-breadcrumb">
          <b>{focus.label}</b>
          <span>{focus.subtitle ?? "五层故事系统"}</span>
        </div>
        <div className="canvas-controls">
          <button onClick={() => zoomBy(0.82)} type="button" aria-label="缩小">−</button>
          <span>{zoomLabel}</span>
          <button onClick={() => zoomBy(1.22)} type="button" aria-label="放大">＋</button>
          <button className="fit-button" onClick={fitAll} type="button">归位</button>
        </div>
      </div>
      <div className="canvas-search-wrap">
        <input
          className="canvas-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索 215 个技法节点…"
          value={query}
        />
        {query ? (
          <div className="canvas-search-popover">
            <div className="canvas-search-head">
              <b>搜索结果</b>
              <span>{searchResults.length}</span>
            </div>
            {searchResults.map((node) => (
              <button
                key={node.id}
                onClick={() => {
                  onOpenNode(node.id);
                  setQuery("");
                }}
                type="button"
              >
                <span>{node.dimension}</span>
                <b>{node.name}</b>
                <small>{node.aliases[0]}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="canvas-viewport-wrap" ref={wrapRef}>
        <svg ref={svgRef} aria-label="可缩放的故事技法无限画布" />
        <div className="canvas-help">
          <span>单指拖动</span>
          <span>双指缩放</span>
          <span>点击逐层展开</span>
        </div>
      </div>
      <div className="canvas-focus-strip">
        <span>{focus.kind.toUpperCase()}</span>
        <p>{focus.description ?? "继续点击节点向下展开。"}</p>
      </div>
    </section>
  );
}

function truncate(value: string, kind: GraphKind): string {
  const limit =
    kind === "root" ? 14 : kind === "layer" ? 8 : kind === "branch" ? 11 : kind === "group" ? 10 : 13;
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}
