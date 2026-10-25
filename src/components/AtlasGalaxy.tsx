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
}

const ROOT_ID = "root";

function branchForNode(
  node: TechniqueNode,
  nodesById: Map<string, TechniqueNode>,
): string {
  const sourceBranch = node.sourceLabel?.split("/")[0];
  if (sourceBranch && atlasBranches.some((branch) => branch.id === sourceBranch)) {
    return sourceBranch;
  }
  for (const relatedId of node.related) {
    const related = nodesById.get(relatedId);
    const relatedBranch = related?.sourceLabel?.split("/")[0];
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
    const sourceGroup = node.sourceLabel?.split("/")[1];
    const validGroup = sourceGroup && branchByGroup.get(sourceGroup) === branchId;
    const groupId = validGroup ? sourceGroup : `${branchId}-personal`;
    const branch = atlasBranches.find((item) => item.id === branchId);
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
    label: "叙事",
    subtitle: "OS",
    kind: "root",
    color: "#d8a24a",
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

function pruneGraph(
  node: GraphDatum,
  expanded: Set<string>,
): GraphDatum {
  return {
    ...node,
    children:
      expanded.has(node.id) && node.children
        ? node.children.map((child) => pruneGraph(child, expanded))
        : undefined,
  };
}

export function AtlasGalaxy({ nodes, onOpenNode }: AtlasGalaxyProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([ROOT_ID, ...atlasLayers.map((layer) => `layer:${layer.id}`)]),
  );
  const [focus, setFocus] = useState<GraphDatum>({
    id: ROOT_ID,
    label: "叙事操作系统",
    subtitle: "五层 · 十三支点",
    kind: "root",
    color: "#d8a24a",
  });
  const [size, setSize] = useState({ width: 360, height: 440 });
  const fullGraph = useMemo(() => buildGraph(nodes), [nodes]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(320, entry.contentRect.width);
      setSize({ width, height: width > 460 ? 500 : 440 });
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

    const root = d3.hierarchy<GraphDatum>(pruneGraph(fullGraph, expanded));
    const radial = d3
      .tree<GraphDatum>()
      .size([Math.PI * 2, Math.min(width * 0.38, 182)])
      .separation((a, b) => {
        const spread = a.parent === b.parent ? 1 : 1.35;
        return spread / Math.max(1, a.depth);
      })(root);

    const center = { x: width / 2, y: height / 2 };
    const viewport = svg.append("g").attr("class", "galaxy-viewport");
    const linksLayer = viewport.append("g").attr("class", "galaxy-links");
    const nodesLayer = viewport.append("g").attr("class", "galaxy-nodes");

    const link = d3
      .linkRadial<d3.HierarchyPointLink<GraphDatum>, d3.HierarchyPointNode<GraphDatum>>()
      .angle((datum) => datum.x)
      .radius((datum) => datum.y);

    linksLayer
      .selectAll("path")
      .data(radial.links())
      .join("path")
      .attr("d", link as never)
      .attr("fill", "none")
      .attr("stroke", (datum) =>
        datum.target.data.kind === "node"
          ? `${datum.target.data.color}38`
          : `${datum.target.data.color}6d`,
      )
      .attr("stroke-width", (datum) =>
        datum.target.data.kind === "node" ? 0.65 : datum.target.data.kind === "group" ? 1 : 1.35,
      )
      .attr("opacity", 0)
      .transition()
      .duration(280)
      .attr("opacity", 1);

    const groups = nodesLayer
      .selectAll<SVGGElement, d3.HierarchyPointNode<GraphDatum>>("g")
      .data(radial.descendants(), (datum) => datum.data.id)
      .join("g")
      .attr("class", (datum) => `galaxy-node galaxy-node-${datum.data.kind}`)
      .attr("transform", (datum) =>
        `translate(${center.x},${center.y}) rotate(${(datum.x * 180) / Math.PI - 90}) translate(${datum.y},0)`,
      )
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
        setExpanded((current) => {
          const next = new Set(current);
          next.add(item.id);
          return next;
        });
      });

    groups
      .append("circle")
      .attr("r", (datum) => {
        if (datum.data.kind === "root") return 23;
        if (datum.data.kind === "layer") return 16;
        if (datum.data.kind === "branch") return 10.5;
        if (datum.data.kind === "group") return 6.2;
        return 3.8;
      })
      .attr("fill", (datum) =>
        datum.data.kind === "node" ? datum.data.color : "#111315",
      )
      .attr("stroke", (datum) => datum.data.color)
      .attr("stroke-width", (datum) =>
        datum.data.kind === "node" ? 1.2 : datum.data.kind === "layer" ? 2.4 : 1.6,
      )
      .attr("filter", (datum) =>
        datum.data.kind === "root" || datum.data.kind === "layer"
          ? `drop-shadow(0 0 8px ${datum.data.color}66)`
          : null,
      );

    groups
      .filter((datum) => datum.data.kind !== "node")
      .append("circle")
      .attr("r", (datum) =>
        datum.data.kind === "root" ? 30 : datum.data.kind === "layer" ? 21 : 14,
      )
      .attr("fill", "transparent")
      .attr("stroke", (datum) => `${datum.data.color}28`)
      .attr("stroke-width", 1);

    groups
      .append("text")
      .attr("dy", "0.32em")
      .attr("x", (datum) => nodeLabelOffset(datum))
      .attr("text-anchor", (datum) => nodeLabelAnchor(datum))
      .attr("transform", (datum) => nodeLabelRotation(datum))
      .attr("fill", (datum) =>
        datum.data.kind === "node" ? "#c0c4be" : "#f4efe4",
      )
      .attr("font-family", (datum) =>
        datum.data.kind === "node"
          ? "-apple-system, BlinkMacSystemFont, sans-serif"
          : "'Songti SC', 'STSong', serif",
      )
      .attr("font-size", (datum) =>
        datum.data.kind === "root"
          ? 11
          : datum.data.kind === "layer"
            ? 13
            : datum.data.kind === "branch"
              ? 9
              : datum.data.kind === "group"
                ? 7.5
                : 6.4,
      )
      .attr("font-weight", (datum) =>
        datum.data.kind === "root" || datum.data.kind === "layer" ? 700 : 500,
      )
      .text((datum) => datum.data.label);

    groups
      .transition()
      .duration(320)
      .attr("opacity", 1);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.55, 5])
      .on("zoom", (event) => viewport.attr("transform", event.transform.toString()));
    zoomRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);
    svg.call(zoom.transform, d3.zoomIdentity);

    const focusDatum = radial.descendants().find((datum) => datum.data.id === focus.id);
    if (focusDatum && focus.id !== ROOT_ID) {
      const angle = focusDatum.x - Math.PI / 2;
      const pointX = Math.cos(angle) * focusDatum.y;
      const pointY = Math.sin(angle) * focusDatum.y;
      const scale = focusDatum.data.kind === "layer" ? 1.18 : 1.7;
      const transform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(scale)
        .translate(-pointX, -pointY);
      svg.transition().duration(520).call(zoom.transform, transform);
    }
  }, [expanded, focus.id, fullGraph, onOpenNode, size]);

  function zoomBy(factor: number) {
    const svgElement = svgRef.current;
    const zoom = zoomRef.current;
    if (!svgElement || !zoom) return;
    d3.select(svgElement).transition().duration(250).call(zoom.scaleBy, factor);
  }

  function reset() {
    setExpanded(new Set([ROOT_ID, ...atlasLayers.map((layer) => `layer:${layer.id}`)]));
    setFocus({
      id: ROOT_ID,
      label: "叙事操作系统",
      subtitle: "五层 · 十三支点",
      kind: "root",
      color: "#d8a24a",
    });
  }

  return (
    <section className="galaxy-shell">
      <div className="galaxy-toolbar">
        <div className="galaxy-breadcrumb">
          <span>叙事 OS</span>
          {focus.id !== ROOT_ID ? <b>/ {focus.label}</b> : null}
        </div>
        <div className="galaxy-zoom">
          <button onClick={() => zoomBy(1.25)} type="button" aria-label="放大">＋</button>
          <button onClick={() => zoomBy(0.8)} type="button" aria-label="缩小">−</button>
          <button onClick={reset} type="button" aria-label="重置图谱">◎</button>
        </div>
      </div>
      <div className="galaxy-viewport" ref={wrapRef}>
        <svg ref={svgRef} aria-label="可缩放的故事技法知识星图" />
        <div className="galaxy-hint">
          <span>拖拽移动</span>
          <span>双指缩放</span>
          <span>点支点展开</span>
        </div>
      </div>
      <div className="galaxy-focus-card">
        <div>
          <small>{focus.kind === "root" ? "WHOLE SYSTEM" : focus.kind.toUpperCase()}</small>
          <b>{focus.label}</b>
          <p>{focus.description ?? "点击圆点逐层展开，叶子节点会打开完整技法档案。"}</p>
        </div>
        <span>{focus.subtitle}</span>
      </div>
    </section>
  );
}

function nodeLabelOffset(node: d3.HierarchyPointNode<GraphDatum>): number {
  if (node.data.kind === "root") return 0;
  if (node.data.kind === "layer") return 25;
  if (node.data.kind === "branch") return 18;
  if (node.data.kind === "group") return 11;
  return 9;
}

function nodeLabelAnchor(node: d3.HierarchyPointNode<GraphDatum>): string {
  if (node.data.kind === "root") return "middle";
  return node.x < Math.PI ? "start" : "end";
}

function nodeLabelRotation(node: d3.HierarchyPointNode<GraphDatum>): string | null {
  if (node.data.kind === "root") return null;
  const angle = (node.x * 180) / Math.PI;
  return angle >= 180 ? `rotate(180)` : null;
}
