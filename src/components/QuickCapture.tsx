import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CaptureDraft,
  CaptureMode,
  Dimension,
  PayoffType,
  TechniqueNode,
  TechniqueParseResult,
} from "../domain/types";
import { parseTechniqueWithProxy } from "../lib/techniqueParser";

const DIMENSIONS: Dimension[] = [
  "结构",
  "信息",
  "视角",
  "时间",
  "空间",
  "声音",
  "剪辑",
  "表演",
  "元叙事",
  "方法",
];

const PAYOFFS: PayoffType[] = [
  "重读前文",
  "重置前提",
  "情绪反转",
  "身份重认",
  "关系重估",
  "体验强化",
  "方法生成",
];

interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    0: { transcript: string };
  }>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

interface QuickCaptureProps {
  nodes: TechniqueNode[];
  onSave: (node: TechniqueNode, capture: CaptureDraft) => void;
  onFeeling: (capture: CaptureDraft) => void;
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function now(): string {
  return new Date().toISOString();
}

function modeLabel(mode: CaptureMode): string {
  if (mode === "quick") return "一句话快捕";
  if (mode === "feeling") return "先存感觉";
  return "文本榨取";
}

export function QuickCapture({
  nodes,
  onSave,
  onFeeling,
}: QuickCaptureProps) {
  const [mode, setMode] = useState<CaptureMode>("quick");
  const [input, setInput] = useState("");
  const [feelingWords, setFeelingWords] = useState("");
  const [result, setResult] = useState<TechniqueParseResult | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftMechanism, setDraftMechanism] = useState("");
  const [draftAliases, setDraftAliases] = useState("");
  const [dimension, setDimension] = useState<Dimension>("方法");
  const [payoff, setPayoff] = useState<PayoffType>("方法生成");
  const [related, setRelated] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const suggestions = useMemo(() => {
    const query = `${draftName} ${draftMechanism}`.trim().toLowerCase();
    if (!query) return nodes.slice(0, 8);
    return nodes
      .filter((node) =>
        `${node.name} ${node.aliases.join(" ")} ${node.mechanism}`
          .toLowerCase()
          .includes(query.slice(0, 16).toLowerCase()),
      )
      .slice(0, 8);
  }, [draftMechanism, draftName, nodes]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function resetResult() {
    setResult(null);
    setDraftName("");
    setDraftMechanism("");
    setDraftAliases("");
    setRelated([]);
    setError("");
    setSavedMessage("");
  }

  async function parse() {
    if (!input.trim()) {
      setError("先留下一个句子，不需要写得专业。");
      return;
    }
    setBusy(true);
    setError("");
    setSavedMessage("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const parsed = await parseTechniqueWithProxy(
        input,
        mode,
        nodes,
        controller.signal,
      );
      setResult(parsed);
      setDraftName(parsed.name);
      setDraftMechanism(parsed.mechanism);
      setDraftAliases(parsed.aliases.join(" / "));
      setDimension(parsed.dimension);
      setPayoff(parsed.payoffType);
      setRelated(parsed.relatedNodeIds);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "解析失败");
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!result || !draftName.trim() || !draftMechanism.trim()) return;
    const timestamp = now();
    const matched = result.matchedNodeId
      ? nodes.find((node) => node.id === result.matchedNodeId)
      : null;
    const node: TechniqueNode = matched
      ? {
          ...matched,
          aliases: [
            ...new Set([
              ...matched.aliases,
              ...draftAliases
                .split("/")
                .map((item) => item.trim())
                .filter(Boolean),
            ]),
          ],
          dimension,
          mechanism: draftMechanism.trim(),
          payoffType: payoff,
          related: [...new Set([...matched.related, ...related])],
          updatedAt: timestamp,
        }
      : {
          id: createId("user"),
          name: draftName.trim(),
          aliases: draftAliases
            .split("/")
            .map((item) => item.trim())
            .filter(Boolean),
          dimension,
          mechanism: draftMechanism.trim(),
          payoffType: payoff,
          examples: [],
          related: [
            ...new Set([
              ...related,
              ...(result.parentId ? [result.parentId] : []),
            ]),
          ],
          parentId: result.parentId,
          myUsageCount: 0,
          masterLevel: 0,
          status: "confirmed",
          provenance: "user",
          sourceLabel: `快捕/${modeLabel(mode)}`,
          notes: `原始捕捉：${input.trim()}`,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
    onSave(node, {
      id: createId("capture"),
      mode,
      rawInput: input.trim(),
      feelingWords: feelingWords
        .split(/[、,，\s]+/)
        .filter(Boolean),
      parsed: {
        ...result,
        name: node.name,
        mechanism: node.mechanism,
        aliases: node.aliases,
        dimension,
        payoffType: payoff,
        relatedNodeIds: related,
      },
      status: "confirmed",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    setSavedMessage(
      matched ? `已把新证据并入「${node.name}」` : `「${node.name}」已长入叙事肌理网`,
    );
    setInput("");
    setFeelingWords("");
    setResult(null);
  }

  function storeFeeling() {
    if (!input.trim() && !feelingWords.trim()) {
      setError("只存感觉也可以，但至少留一个词。");
      return;
    }
    const timestamp = now();
    onFeeling({
      id: createId("capture"),
      mode: "feeling",
      rawInput: input.trim(),
      feelingWords: feelingWords
        .split(/[、,，\s]+/)
        .filter(Boolean),
      parsed: null,
      status: "feeling",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    setSavedMessage("感觉已暂存。它会在未来同类影片和技法中等待归位。");
    setInput("");
    setFeelingWords("");
    setError("");
  }

  function startVoice() {
    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("当前浏览器不支持语音识别，请直接输入。");
      return;
    }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setInput((value) => `${value}${value ? " " : ""}${transcript}`);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.start();
    setListening(true);
  }

  function toggleRelated(id: string) {
    setRelated((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  return (
    <div className="capture-stack">
      <div className="capture-mode-grid">
        {(
          [
            ["quick", "一句话", "看到什么就说什么"],
            ["feeling", "只存感觉", "说不清也先留下"],
            ["paste", "文本榨取", "文章、播客、台词"],
          ] as const
        ).map(([value, title, hint]) => (
          <button
            className={mode === value ? "is-selected" : ""}
            key={value}
            onClick={() => {
              setMode(value);
              resetResult();
            }}
            type="button"
          >
            <b>{title}</b>
            <small>{hint}</small>
          </button>
        ))}
      </div>

      <div className="capture-input-card">
        <div className="capture-input-head">
          <div>
            <small>CAPTURE / {modeLabel(mode)}</small>
            <h2>
              {mode === "feeling"
                ? "先不命名，只保存身体反应。"
                : "把一个瞬间丢进来。"}
            </h2>
          </div>
          <button
            className={`voice-button ${listening ? "is-listening" : ""}`}
            onClick={startVoice}
            type="button"
          >
            <span />
            {listening ? "听着" : "说"}
          </button>
        </div>
        <textarea
          className="field capture-textarea"
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            mode === "paste"
              ? "粘贴文章、播客转写或读书摘录，系统会提取可迁移操作。"
              : "例：两个故事层共用一个门，最后门从里面打开，像元叙事呼吸口。"
          }
          value={input}
        />
        <input
          className="field"
          onChange={(event) => setFeelingWords(event.target.value)}
          placeholder="情绪词：窒息、错位、余震、被戏弄感…"
          value={feelingWords}
        />
        <div className="capture-actions">
          {mode === "feeling" ? (
            <button className="button" onClick={storeFeeling} type="button">
              只存感觉
            </button>
          ) : (
            <button
              className="button"
              disabled={busy}
              onClick={parse}
              type="button"
            >
              {busy ? "正在判重和找关系…" : "解析成技法草稿"}
            </button>
          )}
          {result ? (
            <button
              className="button ghost"
              onClick={resetResult}
              type="button"
            >
              放弃草稿
            </button>
          ) : null}
        </div>
        {error ? <p className="capture-error">{error}</p> : null}
        {savedMessage ? (
          <p className="capture-success">{savedMessage}</p>
        ) : null}
      </div>

      {result ? (
        <div className="draft-card">
          <div className="draft-banner">
            <span>
              {result.isExisting ? "可能已有" : "新技法草稿"}
            </span>
            <b>{Math.round(result.confidence * 100)}% confidence</b>
          </div>
          <p className="draft-reason">{result.reason}</p>
          {result.isExisting && result.matchedNodeId ? (
            <div className="duplicate-notice">
              图谱中已有「
              {nodes.find((node) => node.id === result.matchedNodeId)?.name}
              」。确认后会合并别名、关系和证据，不新建重复节点。
            </div>
          ) : null}
          <label className="field-label">名称</label>
          <input
            className="field"
            onChange={(event) => setDraftName(event.target.value)}
            value={draftName}
          />
          <label className="field-label">别名 / 英文名</label>
          <input
            className="field"
            onChange={(event) => setDraftAliases(event.target.value)}
            value={draftAliases}
          />
          <label className="field-label">机制：它改变了观众的什么模型？</label>
          <textarea
            className="field"
            onChange={(event) => setDraftMechanism(event.target.value)}
            value={draftMechanism}
          />
          <div className="form-grid">
            <label>
              <span className="field-label">维度</span>
              <select
                className="field"
                onChange={(event) =>
                  setDimension(event.target.value as Dimension)
                }
                value={dimension}
              >
                {DIMENSIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">收益类型</span>
              <select
                className="field"
                onChange={(event) =>
                  setPayoff(event.target.value as PayoffType)
                }
                value={payoff}
              >
                {PAYOFFS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field-label">挂接关系</label>
          <div className="relation-picker">
            {suggestions.map((node) => (
              <button
                className={related.includes(node.id) ? "is-selected" : ""}
                key={node.id}
                onClick={() => toggleRelated(node.id)}
                type="button"
              >
                {node.name}
              </button>
            ))}
          </div>
          <button className="button confirm-capture" onClick={confirm} type="button">
            确认并长入图谱
          </button>
        </div>
      ) : null}
    </div>
  );
}
