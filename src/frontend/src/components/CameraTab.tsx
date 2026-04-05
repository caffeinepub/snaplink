import {
  ChevronDown,
  Clock,
  Pen,
  RotateCcw,
  Send,
  Sparkles,
  StickerIcon,
  SwitchCamera,
  Type,
  Upload,
  Video,
  X,
  Zap,
  ZapOff,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  backendGetFriends,
  backendSendSnap,
  backendUploadSnapMedia,
} from "../backendStore";
import { useCamera } from "../camera/useCamera";
import { useApp } from "../context/AppContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import type { User } from "../types";
import { AiSnapAssistant } from "./AiSnapAssistant";
import { PressableButton, UserAvatar } from "./Shared";

type CameraState = "viewfinder" | "preview";
type PreviewTab = "filters" | "draw" | "stickers" | "text";

// ─── Snap Filter definitions ──────────────────────────────────────────────────────────────────

interface SnapFilter {
  id: string;
  label: string;
  css: string;
  canvas: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

const SNAP_FILTERS: SnapFilter[] = [
  { id: "normal", label: "Normal", css: "none", canvas: () => {} },
  {
    id: "warm",
    label: "Warm",
    css: "sepia(0.4) saturate(1.3) brightness(1.05)",
    canvas: (ctx, w, h) => {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(255,160,80,0.18)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
    },
  },
  {
    id: "cool",
    label: "Cool",
    css: "hue-rotate(190deg) saturate(1.1) brightness(1.05)",
    canvas: (ctx, w, h) => {
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "rgba(60,120,255,0.12)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
    },
  },
  { id: "bw", label: "B&W", css: "grayscale(1)", canvas: () => {} },
  {
    id: "vivid",
    label: "Vivid",
    css: "saturate(1.8) contrast(1.1)",
    canvas: () => {},
  },
];

// ─── Drawing tool constants ─────────────────────────────────────────────────────────────────

const DRAW_COLORS = [
  { hex: "#FF4444", label: "Red" },
  { hex: "#FF8800", label: "Orange" },
  { hex: "#FFE600", label: "Yellow" },
  { hex: "#44FF44", label: "Green" },
  { hex: "#00CFFF", label: "Blue" },
  { hex: "#FFFFFF", label: "White" },
];

// ─── Sticker packs ──────────────────────────────────────────────────────────────────────

const STICKER_PACKS: Record<string, string[]> = {
  Expressions: [
    "😂",
    "😍",
    "😭",
    "😎",
    "🤩",
    "🥰",
    "😏",
    "🤔",
    "😴",
    "🤯",
    "🥳",
    "😤",
  ],
  Animals: [
    "🐶",
    "🐱",
    "🐼",
    "🦊",
    "🐨",
    "🦁",
    "🐯",
    "🐸",
    "🦄",
    "🦋",
    "🐙",
    "🦈",
  ],
  Symbols: [
    "❤️",
    "🔥",
    "⭐",
    "💯",
    "✨",
    "💫",
    "🎉",
    "🎊",
    "💥",
    "🌈",
    "💎",
    "👑",
  ],
  Food: [
    "🍕",
    "🍔",
    "🍟",
    "🌮",
    "🍜",
    "🍣",
    "🍰",
    "🍩",
    "🎂",
    "🍦",
    "🥑",
    "🍓",
  ],
};

// ─── Text style definitions ─────────────────────────────────────────────────────────────────

type TextStyle = "bold" | "neon" | "typewriter" | "bubble" | "shadow";

interface PlacedItem {
  id: string;
  type: "sticker" | "text";
  content: string; // emoji or text
  x: number;
  y: number;
  style?: TextStyle;
  color?: string;
}

interface DrawStroke {
  points: { x: number; y: number }[];
  color: string;
  size: number;
}

// ─── Filter thumbnail strip ────────────────────────────────────────────────────────────────

function FilterStrip({
  imageDataUrl,
  selectedFilter,
  onSelect,
}: {
  imageDataUrl: string;
  selectedFilter: string;
  onSelect: (filterId: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide px-1 py-2">
      {SNAP_FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onSelect(f.id)}
          className="flex flex-col items-center gap-1 flex-shrink-0"
        >
          <div
            className="relative w-14 h-14 rounded-xl overflow-hidden"
            style={{
              border:
                selectedFilter === f.id
                  ? "2px solid #00CFFF"
                  : "2px solid transparent",
              boxShadow:
                selectedFilter === f.id
                  ? "0 0 8px rgba(0,207,255,0.5)"
                  : "none",
            }}
          >
            <img
              src={imageDataUrl}
              alt={f.label}
              className="w-full h-full object-cover"
              style={{ filter: f.css }}
            />
          </div>
          <span
            className="text-[10px] font-medium"
            style={{ color: selectedFilter === f.id ? "#00CFFF" : "#B0B0CC" }}
          >
            {f.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Drawing overlay canvas ───────────────────────────────────────────────────────────────

function DrawingCanvas({
  containerRef,
  strokes,
  onStrokeAdd,
  currentColor,
  brushSize,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  strokes: DrawStroke[];
  onStrokeAdd: (stroke: DrawStroke) => void;
  currentColor: string;
  brushSize: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);

  // Redraw all strokes whenever strokes array changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(
        stroke.points[0].x * canvas.width,
        stroke.points[0].y * canvas.height,
      );
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(
          stroke.points[i].x * canvas.width,
          stroke.points[i].y * canvas.height,
        );
      }
      ctx.stroke();
    }
  }, [strokes]);

  const getPos = (
    e: React.TouchEvent | React.MouseEvent,
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    isDrawingRef.current = true;
    currentStrokeRef.current = [pos];
    // Draw a single dot for immediate feedback
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.arc(
          pos.x * canvas.width,
          pos.y * canvas.height,
          brushSize / 2,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = currentColor;
        ctx.fill();
      }
    }
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const pos = getPos(e);
    if (!pos) return;
    currentStrokeRef.current.push(pos);
    // Live draw on canvas
    const canvas = canvasRef.current;
    if (canvas && currentStrokeRef.current.length >= 2) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const pts = currentStrokeRef.current;
        const prev = pts[pts.length - 2];
        const curr = pts[pts.length - 1];
        ctx.beginPath();
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(prev.x * canvas.width, prev.y * canvas.height);
        ctx.lineTo(curr.x * canvas.width, curr.y * canvas.height);
        ctx.stroke();
      }
    }
  };

  const endDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const points = [...currentStrokeRef.current];
    currentStrokeRef.current = [];
    if (points.length > 0) {
      onStrokeAdd({ points, color: currentColor, size: brushSize });
    }
  };

  // Sync canvas size with container
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, [containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 10, touchAction: "none", cursor: "crosshair" }}
      onMouseDown={startDraw}
      onMouseMove={draw}
      onMouseUp={endDraw}
      onMouseLeave={endDraw}
      onTouchStart={startDraw}
      onTouchMove={draw}
      onTouchEnd={endDraw}
    />
  );
}

// ─── Drawing toolbar ──────────────────────────────────────────────────────────────────

function DrawingToolbar({
  selectedColor,
  onColorChange,
  brushSize,
  onBrushChange,
  onUndo,
  onClear,
}: {
  selectedColor: string;
  onColorChange: (c: string) => void;
  brushSize: number;
  onBrushChange: (s: number) => void;
  onUndo: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-2 px-4 py-3"
      style={{ background: "rgba(10,10,20,0.9)" }}
    >
      {/* Color row */}
      <div className="flex items-center gap-2">
        {DRAW_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => onColorChange(c.hex)}
            className="w-7 h-7 rounded-full flex-shrink-0 transition-transform"
            style={{
              background: c.hex,
              border:
                selectedColor === c.hex
                  ? "2.5px solid white"
                  : "2px solid rgba(255,255,255,0.2)",
              transform: selectedColor === c.hex ? "scale(1.2)" : "scale(1)",
            }}
            aria-label={c.label}
          />
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onUndo}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.1)" }}
          aria-label="Undo stroke"
        >
          <RotateCcw size={14} color="#B0B0CC" />
        </button>
        <button
          type="button"
          onClick={onClear}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,80,80,0.15)" }}
          aria-label="Clear drawing"
        >
          <X size={14} color="#FF6B6B" />
        </button>
      </div>
      {/* Brush size */}
      <div className="flex items-center gap-3">
        <div
          className="rounded-full flex-shrink-0"
          style={{ width: 6, height: 6, background: "#B0B0CC" }}
        />
        <input
          type="range"
          min={2}
          max={20}
          value={brushSize}
          onChange={(e) => onBrushChange(Number(e.target.value))}
          className="flex-1 h-1 appearance-none rounded-full"
          style={{ accentColor: "#00CFFF" }}
        />
        <div
          className="rounded-full flex-shrink-0"
          style={{ width: 18, height: 18, background: "#B0B0CC" }}
        />
        <span className="text-[#B0B0CC] text-xs w-6 text-right">
          {brushSize}px
        </span>
      </div>
    </div>
  );
}

// ─── Sticker panel ────────────────────────────────────────────────────────────────────

function StickerPanel({ onPlace }: { onPlace: (emoji: string) => void }) {
  const [activeCategory, setActiveCategory] = useState("Expressions");
  return (
    <div style={{ background: "rgba(10,10,20,0.9)" }}>
      {/* Category tabs */}
      <div className="flex gap-1 px-4 pt-2 pb-1 overflow-x-auto scrollbar-hide">
        {Object.keys(STICKER_PACKS).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all"
            style={{
              background:
                activeCategory === cat
                  ? "rgba(0,207,255,0.2)"
                  : "rgba(255,255,255,0.06)",
              color: activeCategory === cat ? "#00CFFF" : "#B0B0CC",
              border:
                activeCategory === cat
                  ? "1px solid rgba(0,207,255,0.4)"
                  : "1px solid transparent",
            }}
          >
            {cat}
          </button>
        ))}
      </div>
      {/* Stickers grid */}
      <div className="grid grid-cols-6 gap-1 px-4 py-2">
        {(STICKER_PACKS[activeCategory] ?? []).map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPlace(emoji)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl active:scale-90 transition-transform"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Text style panel ────────────────────────────────────────────────────────────────────

const TEXT_STYLES: { id: TextStyle; label: string; preview: string }[] = [
  { id: "bold", label: "Bold", preview: "B" },
  { id: "neon", label: "Neon", preview: "N" },
  { id: "typewriter", label: "Typo", preview: "T" },
  { id: "bubble", label: "Bubble", preview: "O" },
  { id: "shadow", label: "Shadow", preview: "S" },
];

function TextPanel({
  onAddText,
}: {
  onAddText: (text: string, style: TextStyle, color: string) => void;
}) {
  const [text, setText] = useState("");
  const [style, setStyle] = useState<TextStyle>("bold");
  const [color, setColor] = useState("#FFFFFF");

  const handleAdd = () => {
    if (!text.trim()) return;
    onAddText(text.trim(), style, color);
    setText("");
  };

  return (
    <div
      className="flex flex-col gap-2 px-4 py-3"
      style={{ background: "rgba(10,10,20,0.9)" }}
    >
      {/* Text input */}
      <input
        type="text"
        placeholder="Type your text..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
        }}
        className="w-full bg-transparent text-white text-sm outline-none px-3 py-2 rounded-xl"
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
        maxLength={60}
      />
      {/* Style row */}
      <div className="flex items-center gap-2">
        {TEXT_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyle(s.id)}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background:
                style === s.id
                  ? "rgba(0,207,255,0.18)"
                  : "rgba(255,255,255,0.06)",
              color: style === s.id ? "#00CFFF" : "#B0B0CC",
              border:
                style === s.id
                  ? "1px solid rgba(0,207,255,0.4)"
                  : "1px solid transparent",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {/* Color + Add button row */}
      <div className="flex items-center gap-2">
        {DRAW_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => setColor(c.hex)}
            className="w-6 h-6 rounded-full flex-shrink-0 transition-transform"
            style={{
              background: c.hex,
              border:
                color === c.hex
                  ? "2.5px solid white"
                  : "2px solid rgba(255,255,255,0.2)",
              transform: color === c.hex ? "scale(1.25)" : "scale(1)",
            }}
            aria-label={c.label}
          />
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!text.trim()}
          className="px-4 py-1.5 rounded-xl text-xs font-bold text-white"
          style={{
            background: text.trim()
              ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
              : "#2A3048",
            opacity: text.trim() ? 1 : 0.5,
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Placed items overlay (stickers + text draggable) ─────────────────────────────────

function PlacedItemsOverlay({
  items,
  onMove,
}: {
  items: PlacedItem[];
  onMove: (id: string, x: number, y: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = (
    e: React.TouchEvent | React.MouseEvent,
    itemId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    const move = (ev: TouchEvent | MouseEvent) => {
      const rect = container.getBoundingClientRect();
      let clientX: number;
      let clientY: number;
      if ("touches" in ev) {
        clientX = ev.touches[0].clientX;
        clientY = ev.touches[0].clientY;
      } else {
        clientX = (ev as MouseEvent).clientX;
        clientY = (ev as MouseEvent).clientY;
      }
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      onMove(itemId, x, y);
    };

    const end = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 11 }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="absolute pointer-events-auto select-none"
          style={{
            left: `${item.x * 100}%`,
            top: `${item.y * 100}%`,
            transform: "translate(-50%, -50%)",
            cursor: "grab",
            touchAction: "none",
          }}
          onMouseDown={(e) => startDrag(e, item.id)}
          onTouchStart={(e) => startDrag(e, item.id)}
        >
          {item.type === "sticker" ? (
            <span style={{ fontSize: 40, lineHeight: 1, userSelect: "none" }}>
              {item.content}
            </span>
          ) : (
            <span
              style={{
                fontSize: 28,
                fontWeight:
                  item.style === "bold" || item.style === "bubble"
                    ? "bold"
                    : item.style === "neon"
                      ? "bold"
                      : "normal",
                fontFamily:
                  item.style === "typewriter"
                    ? "'Courier New', monospace"
                    : "system-ui, sans-serif",
                color: item.color ?? "#FFFFFF",
                textShadow:
                  item.style === "neon"
                    ? "0 0 8px #00CFFF, 0 0 16px #00CFFF"
                    : item.style === "shadow"
                      ? "2px 2px 4px rgba(0,0,0,0.9), 3px 3px 6px rgba(0,0,0,0.7)"
                      : item.style === "bubble"
                        ? "-1px -1px 0 rgba(0,0,0,0.8), 1px -1px 0 rgba(0,0,0,0.8), -1px 1px 0 rgba(0,0,0,0.8), 1px 1px 0 rgba(0,0,0,0.8)"
                        : "1px 1px 2px rgba(0,0,0,0.8)",
                WebkitTextStroke:
                  item.style === "bubble" ? "2px rgba(0,0,0,0.6)" : "none",
                userSelect: "none",
                whiteSpace: "nowrap",
              }}
            >
              {item.content}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Canvas baking helper (includes drawing, stickers, text) ────────────────────────────

async function bakeImageFull(opts: {
  dataUrl: string;
  filter: SnapFilter;
  showTimestamp: boolean;
  strokes: DrawStroke[];
  placedItems: PlacedItem[];
  containerWidth: number;
  containerHeight: number;
}): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.75);
        return;
      }

      // 1. Draw base image with filter
      ctx.filter = opts.filter.css === "none" ? "none" : opts.filter.css;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";
      opts.filter.canvas(ctx, canvas.width, canvas.height);

      // 2. Timestamp overlay
      if (opts.showTimestamp) {
        const now = new Date();
        const label = `${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
        const pad = 12;
        const fontSize = Math.max(14, Math.round(canvas.width * 0.035));
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
        const textW = ctx.measureText(label).width;
        const boxX = canvas.width - textW - pad * 2 - 16;
        const boxY = canvas.height - fontSize - pad * 2 - 20;
        const boxW = textW + pad * 2;
        const boxH = fontSize + pad;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath();
        const r = boxH / 2;
        ctx.moveTo(boxX + r, boxY);
        ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, r);
        ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, r);
        ctx.arcTo(boxX, boxY + boxH, boxX, boxY, r);
        ctx.arcTo(boxX, boxY, boxX + boxW, boxY, r);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(label, boxX + pad, boxY + boxH - pad * 0.45);
      }

      // 3. Draw strokes (normalized coordinates -> canvas coordinates)
      const scaleX = canvas.width / (opts.containerWidth || 1);
      const scaleY = canvas.height / (opts.containerHeight || 1);
      for (const stroke of opts.strokes) {
        if (stroke.points.length < 2) continue;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size * Math.min(scaleX, scaleY);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(
          stroke.points[0].x * canvas.width,
          stroke.points[0].y * canvas.height,
        );
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(
            stroke.points[i].x * canvas.width,
            stroke.points[i].y * canvas.height,
          );
        }
        ctx.stroke();
      }

      // 4. Render placed items (stickers + text)
      for (const item of opts.placedItems) {
        const cx = item.x * canvas.width;
        const cy = item.y * canvas.height;
        if (item.type === "sticker") {
          const fontSize = Math.round(canvas.width * 0.1);
          ctx.font = `${fontSize}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(item.content, cx, cy);
        } else {
          // text
          const fontSize = Math.round(canvas.width * 0.065);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          switch (item.style) {
            case "bold":
              ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
              ctx.fillStyle = item.color ?? "#FFFFFF";
              ctx.shadowColor = "rgba(0,0,0,0.5)";
              ctx.shadowBlur = 4;
              ctx.fillText(item.content, cx, cy);
              break;
            case "neon":
              ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
              ctx.fillStyle = "#FFFFFF";
              ctx.shadowColor = "#00CFFF";
              ctx.shadowBlur = 20;
              ctx.fillText(item.content, cx, cy);
              ctx.shadowBlur = 40;
              ctx.fillText(item.content, cx, cy);
              break;
            case "typewriter":
              ctx.font = `${fontSize}px 'Courier New', monospace`;
              ctx.fillStyle = item.color ?? "#FFFFFF";
              ctx.shadowColor = "rgba(0,0,0,0.6)";
              ctx.shadowBlur = 3;
              ctx.fillText(item.content, cx, cy);
              break;
            case "bubble":
              ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
              ctx.lineWidth = 6;
              ctx.strokeStyle = "rgba(0,0,0,0.8)";
              ctx.strokeText(item.content, cx, cy);
              ctx.fillStyle = item.color ?? "#FFFFFF";
              ctx.fillText(item.content, cx, cy);
              break;
            case "shadow":
              ctx.font = `${fontSize}px system-ui, sans-serif`;
              ctx.fillStyle = item.color ?? "#FFFFFF";
              ctx.shadowColor = "rgba(0,0,0,0.9)";
              ctx.shadowBlur = 8;
              ctx.shadowOffsetX = 3;
              ctx.shadowOffsetY = 3;
              ctx.fillText(item.content, cx, cy);
              break;
          }
          // Reset shadow
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.75);
    };
    img.src = opts.dataUrl;
  });
}

function SnapTimer({
  duration,
  onExpire,
}: { duration: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, duration - elapsed);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [duration, onExpire]);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / duration;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 48, height: 48 }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        aria-label={`${Math.ceil(remaining)} seconds remaining`}
      >
        <title>{Math.ceil(remaining)} seconds remaining</title>
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="rgba(0,0,0,0.5)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="2"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={
            progress > 0.5 ? "#00CFFF" : progress > 0.25 ? "#FFAA00" : "#FF4444"
          }
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 24 24)"
          style={{
            transition: "stroke-dashoffset 0.1s linear, stroke 0.3s ease",
          }}
        />
      </svg>
      <span
        className="absolute text-sm font-bold"
        style={{
          color:
            progress > 0.5
              ? "#00CFFF"
              : progress > 0.25
                ? "#FFAA00"
                : "#FF4444",
        }}
      >
        {Math.ceil(remaining)}
      </span>
    </div>
  );
}

function RecordingTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [startTime]);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const label = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{
          background: "#FF3B3B",
          animation: "pulse-rec 1s ease-in-out infinite",
        }}
      />
      <span className="text-white text-sm font-bold tabular-nums">{label}</span>
    </div>
  );
}

async function compressImage(
  dataUrl: string,
  maxWidth = 900,
  quality = 0.7,
): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", quality);
    };
    img.src = dataUrl;
  });
}

// Rendered via portal so it always appears above everything
function SendToSheet({
  friends,
  selectedFriends,
  onToggle,
  onSend,
  onClose,
  sending,
  sent,
  sendError,
  uploadProgress,
}: {
  friends: User[];
  selectedFriends: string[];
  onToggle: (username: string) => void;
  onSend: () => void;
  onClose: () => void;
  sending: boolean;
  sent: boolean;
  sendError?: string | null;
  uploadProgress?: number;
}) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-end",
        background: "rgba(0,0,0,0.65)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.38 }}
        style={{
          width: "100%",
          background: "#1A1F33",
          borderRadius: "24px 24px 0 0",
          border: "1px solid #2A3048",
          borderBottom: "none",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.2)" }}
          />
        </div>
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-white font-bold text-lg">Send To</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <X size={18} color="#B0B0CC" />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto px-4 pb-2"
          style={{ minHeight: 0 }}
        >
          {friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <p className="text-[#B0B0CC] text-sm text-center">
                No friends yet. Add friends first to send snaps!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {friends.map((friend) => {
                const selected = selectedFriends.includes(friend.username);
                return (
                  <motion.button
                    type="button"
                    key={friend.username}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onToggle(friend.username)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left"
                    style={{
                      background: selected
                        ? "rgba(0,207,255,0.08)"
                        : "transparent",
                      border: selected
                        ? "1px solid rgba(0,207,255,0.25)"
                        : "1px solid transparent",
                    }}
                  >
                    <UserAvatar
                      name={friend.displayName}
                      size={48}
                      avatarUrl={friend.avatarUrl}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">
                        {friend.displayName}
                      </p>
                      <p className="text-[#B0B0CC] text-xs">
                        @{friend.username}
                      </p>
                    </div>
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{
                        background: selected
                          ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
                          : "rgba(255,255,255,0.08)",
                        border: selected
                          ? "none"
                          : "1.5px solid rgba(255,255,255,0.2)",
                      }}
                    >
                      {selected && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M2.5 6l2.5 2.5L9.5 3"
                            stroke="white"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {sendError && (
          <div className="px-4 pb-2">
            <p className="text-xs text-center" style={{ color: "#FF4444" }}>
              {sendError}
            </p>
          </div>
        )}

        <div className="px-4 py-4" style={{ borderTop: "1px solid #2A3048" }}>
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="sent"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #00CFFF, #00AA88)",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <motion.path
                    d="M4 10l4.5 4.5L16 6"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </svg>
                <motion.span
                  className="text-white font-bold"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  Sent!
                </motion.span>
              </motion.div>
            ) : (
              <PressableButton
                key="send"
                onClick={onSend}
                disabled={selectedFriends.length === 0 || sending}
                className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2"
                style={{
                  background:
                    selectedFriends.length > 0
                      ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
                      : "#2A3048",
                  boxShadow:
                    selectedFriends.length > 0
                      ? "0 0 25px rgba(0,207,255,0.3)"
                      : "none",
                  opacity: selectedFriends.length === 0 ? 0.5 : 1,
                }}
              >
                <Send size={18} />
                {sending
                  ? uploadProgress != null &&
                    uploadProgress > 0 &&
                    uploadProgress < 100
                    ? `Uploading... ${uploadProgress}%`
                    : uploadProgress === 100
                      ? "Sending..."
                      : "Preparing snap..."
                  : selectedFriends.length === 0
                    ? "Select friends to send"
                    : `Send to ${selectedFriends.length} friend${selectedFriends.length > 1 ? "s" : ""}`}
              </PressableButton>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

// ─── Daily Snap Challenge ───────────────────────────────────────────────────────────────────

const SNAP_PROMPTS = [
  "\uD83D\uDCF8 Snap something that made you smile today",
  "\uD83C\uDF05 Catch the morning light",
  "\uD83C\uDFA8 Find something colorful",
  "\uD83E\uDD1D Snap a moment with a friend",
  "\uD83C\uDF55 Your current meal or snack",
  "\uD83C\uDF3F A plant or nature nearby",
  "\uD83D\uDCAA Your workout or movement today",
  "\uD83C\uDFB5 What are you listening to?",
  "\uD83D\uDC3E An animal you spotted",
  "\u2728 Something that inspired you",
  "\uD83C\uDF19 The night sky or evening view",
  "\uD83D\uDCDA What you're reading or learning",
  "\u2615 Your morning drink",
  "\uD83C\uDFD9\uFE0F Your city or neighborhood",
  "\uD83C\uDFAD Strike a pose!",
  "\uD83C\uDF0A Water anywhere \u2014 puddle, river, sea",
  "\uD83D\uDD0D A tiny detail most people miss",
  "\uD83C\uDF08 Something with a rainbow of colors",
  "\uD83C\uDF89 Celebrate something small today",
  "\uD83C\uDF38 A flower or bloom",
  "\uD83C\uDFE0 Your favorite spot at home",
  "\uD83D\uDE97 Your commute or journey",
  "\uD83D\uDC9F Your shoes today",
  "\uD83C\uDF24\uFE0F The sky right now",
  "\uD83C\uDFAE What you're playing",
  "\uD83D\uDED2 Something new you bought",
  "\uD83C\uDF0D Something that reminds you of travel",
  "\uD83D\uDCA1 A creative idea in action",
  "\uD83C\uDF42 A seasonal moment",
  "\uD83C\uDF81 Something that surprised you",
  "\uD83D\uDC40 Your current view",
  "\uD83D\uDD25 Something you're passionate about",
];

function getDailyPrompt(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86_400_000);
  return SNAP_PROMPTS[dayOfYear % SNAP_PROMPTS.length];
}

function getDailyDismissKey(): string {
  const d = new Date();
  return `snapChallengeDismissed_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CameraTab() {
  const { currentUser, setActiveTab, setSelectedConversation } = useApp();
  const { identity } = useInternetIdentity();
  const [cameraState, setCameraState] = useState<CameraState>("viewfinder");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [isEphemeral, setIsEphemeral] = useState(true);
  const [timerDuration, setTimerDuration] = useState(5);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSendSheet, setShowSendSheet] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [snapCaption, setSnapCaption] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(
    null,
  );

  // Filter state
  const [selectedFilterId, setSelectedFilterId] = useState("normal");
  const [showTimestampOverlay, setShowTimestampOverlay] = useState(false);

  // Preview tab state
  const [previewTab, setPreviewTab] = useState<PreviewTab>("filters");

  // Drawing state
  const [drawStrokes, setDrawStrokes] = useState<DrawStroke[]>([]);
  const [drawColor, setDrawColor] = useState("#00CFFF");
  const [brushSize, setBrushSize] = useState(6);

  // Placed items (stickers + text)
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);

  // Daily Snap Challenge
  const [challengeDismissed, setChallengeDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(getDailyDismissKey()) === "1";
    } catch {
      return false;
    }
  });
  const dailyPrompt = getDailyPrompt();

  const handleDismissChallenge = () => {
    setChallengeDismissed(true);
    try {
      sessionStorage.setItem(getDailyDismissKey(), "1");
    } catch {
      // ignore
    }
  };

  // Preview container ref for canvas sizing
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const pressStartTimeRef = useRef<number>(0);

  const {
    isActive,
    isLoading,
    error,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    isSupported,
  } = useCamera({ facingMode: "environment", quality: 0.85 });

  useEffect(() => {
    if (currentUser) {
      backendGetFriends(currentUser.username, identity ?? undefined)
        .then(setFriends)
        .catch(() => setFriends([]));
    }
  }, [currentUser, identity]);

  useEffect(() => {
    if (showSendSheet && currentUser) {
      backendGetFriends(currentUser.username, identity ?? undefined)
        .then(setFriends)
        .catch(() => setFriends([]));
    }
  }, [showSendSheet, currentUser, identity]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (capturedVideo) URL.revokeObjectURL(capturedVideo);
    };
  }, []);

  const selectedFilter =
    SNAP_FILTERS.find((f) => f.id === selectedFilterId) ?? SNAP_FILTERS[0];

  const handleCapture = useCallback(async () => {
    const file = await capturePhoto();
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCapturedImage(reader.result as string);
      setCapturedVideo(null);
      setCameraState("preview");
      stopCamera();
    };
    reader.readAsDataURL(file);
  }, [capturePhoto, stopCamera]);

  const startRecording = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (!stream || !isActive) return;
    recordedChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";
    try {
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 1_500_000,
        audioBitsPerSecond: 64_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setCapturedVideo(url);
        setCapturedImage(null);
        setCameraState("preview");
        stopCamera();
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingStartTime(Date.now());
    } catch (e) {
      console.warn("MediaRecorder failed:", e);
    }
  }, [isActive, videoRef, stopCamera]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingStartTime(null);
  }, []);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleButtonPointerDown = useCallback(() => {
    pressStartTimeRef.current = Date.now();
    holdTimerRef.current = setTimeout(() => {
      startRecording();
    }, 200);
  }, [startRecording]);

  const handleButtonPointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const pressDuration = Date.now() - pressStartTimeRef.current;
    if (isRecording) {
      stopRecording();
    } else if (pressDuration < 200) {
      handleCapture();
    } else {
      handleCapture();
    }
  }, [isRecording, stopRecording, handleCapture]);

  const handleButtonPointerLeave = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isRecording) stopRecording();
  }, [isRecording, stopRecording]);

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      setCapturedVideo(url);
      setCapturedImage(null);
      setCameraState("preview");
      stopCamera();
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        setCapturedVideo(null);
        setCameraState("preview");
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleFriend = (username: string) => {
    setSelectedFriends((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username],
    );
  };

  const handleAddSticker = (emoji: string) => {
    const id = `sticker-${Date.now()}-${Math.random()}`;
    setPlacedItems((prev) => [
      ...prev,
      { id, type: "sticker", content: emoji, x: 0.5, y: 0.4 },
    ]);
  };

  const handleAddText = (text: string, style: TextStyle, color: string) => {
    const id = `text-${Date.now()}-${Math.random()}`;
    setPlacedItems((prev) => [
      ...prev,
      { id, type: "text", content: text, x: 0.5, y: 0.35, style, color },
    ]);
  };

  const handleMoveItem = (id: string, x: number, y: number) => {
    setPlacedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, x, y } : item)),
    );
  };

  const handleSendSnap = async () => {
    if (!currentUser || selectedFriends.length === 0) return;
    setSendError(null);
    setSending(true);
    const isVideo = !!capturedVideo;
    const recipientFriends = [...selectedFriends];

    try {
      let mediaBlob: Blob;
      if (capturedVideo) {
        const resp = await fetch(capturedVideo);
        mediaBlob = await resp.blob();
      } else if (capturedImage) {
        const hasDrawings = drawStrokes.length > 0;
        const hasItems = placedItems.length > 0;
        const container = previewContainerRef.current;
        const cw = container?.offsetWidth ?? 400;
        const ch = container?.offsetHeight ?? 600;

        if (
          selectedFilter.id !== "normal" ||
          showTimestampOverlay ||
          hasDrawings ||
          hasItems
        ) {
          mediaBlob = await bakeImageFull({
            dataUrl: capturedImage,
            filter: selectedFilter,
            showTimestamp: showTimestampOverlay,
            strokes: drawStrokes,
            placedItems,
            containerWidth: cw,
            containerHeight: ch,
          });
        } else {
          mediaBlob = await compressImage(capturedImage);
        }
      } else {
        setSending(false);
        return;
      }

      setUploadProgress(0);
      const uploadResult = await backendUploadSnapMedia(mediaBlob, (pct) => {
        setUploadProgress(pct);
      });
      if ("err" in uploadResult) {
        setSendError(`Upload failed: ${uploadResult.err}`);
        setSending(false);
        return;
      }

      const blobId = uploadResult.hash;
      const snapContent = isVideo
        ? snapCaption?.trim() || "📹 Sent a video snap"
        : snapCaption?.trim() || "📸 Sent a snap";
      void snapContent;

      const encodedBlobId = isVideo ? `v:${blobId}` : `p:${blobId}`;
      const sendResults = await Promise.all(
        recipientFriends.map((friend) =>
          backendSendSnap(
            currentUser.username,
            friend,
            encodedBlobId,
            isEphemeral,
            !isEphemeral,
            identity ?? undefined,
          ),
        ),
      );
      const anyError = sendResults.find((r) => "err" in r) as
        | { err: string }
        | undefined;

      if (anyError) {
        setSendError(`Some snaps failed to send: ${anyError.err}`);
        setSending(false);
        return;
      }

      setSent(true);
      setSending(false);
      setUploadProgress(0);
      setTimeout(() => {
        setSent(false);
        setSendError(null);
        setShowSendSheet(false);
        if (capturedVideo) URL.revokeObjectURL(capturedVideo);
        setCapturedImage(null);
        setCapturedVideo(null);
        setCameraState("viewfinder");
        setSelectedFriends([]);
        setSnapCaption("");
        setSelectedFilterId("normal");
        setShowTimestampOverlay(false);
        setDrawStrokes([]);
        setPlacedItems([]);
        setPreviewTab("filters");
        startCamera();
        if (recipientFriends.length === 1) {
          setSelectedConversation(recipientFriends[0]);
          setActiveTab("chats");
        } else {
          setActiveTab("chats");
        }
      }, 1500);
    } catch (e) {
      setSendError(`Failed to send: ${String(e)}`);
      setSending(false);
    }
  };

  const handleDiscard = () => {
    if (capturedVideo) URL.revokeObjectURL(capturedVideo);
    setCapturedImage(null);
    setCapturedVideo(null);
    setCameraState("viewfinder");
    setSelectedFriends([]);
    setShowSendSheet(false);
    setSendError(null);
    setSnapCaption("");
    setSelectedFilterId("normal");
    setShowTimestampOverlay(false);
    setDrawStrokes([]);
    setPlacedItems([]);
    setPreviewTab("filters");
    startCamera();
  };

  const isVideoSnap = !!capturedVideo;

  // Preview tab icons
  const previewTabs: {
    id: PreviewTab;
    icon: React.ReactNode;
    label: string;
  }[] = [
    {
      id: "filters",
      icon: <span className="text-xs">🎨</span>,
      label: "Filter",
    },
    { id: "draw", icon: <Pen size={13} />, label: "Draw" },
    { id: "stickers", icon: <StickerIcon size={13} />, label: "Stickers" },
    { id: "text", icon: <Type size={13} />, label: "Text" },
  ];

  return (
    <div
      className="relative flex flex-col h-full"
      style={{ background: "#000000" }}
    >
      <style>{`
        @keyframes pulse-rec {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes recording-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,59,59,0.7), 0 0 0 6px rgba(255,59,59,0.2); }
          50% { box-shadow: 0 0 0 8px rgba(255,59,59,0.0), 0 0 0 14px rgba(255,59,59,0.1); }
        }
      `}</style>

      <AnimatePresence mode="wait">
        {cameraState === "viewfinder" ? (
          <motion.div
            key="viewfinder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col"
          >
            <div className="relative flex-1 overflow-hidden">
              {isSupported === false ? (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "#1A1A2E" }}
                >
                  <p className="text-[#B0B0CC] text-center px-8">
                    Camera not supported on this device
                  </p>
                </div>
              ) : error ? (
                <div
                  className="w-full h-full flex flex-col items-center justify-center gap-4"
                  style={{ background: "#1A1A2E" }}
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: "#1A1F33" }}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-label="Camera error"
                    >
                      <title>Camera error</title>
                      <path
                        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                        stroke="#B0B0CC"
                        strokeWidth="2"
                        fill="none"
                      />
                      <circle
                        cx="12"
                        cy="13"
                        r="4"
                        stroke="#B0B0CC"
                        strokeWidth="2"
                        fill="none"
                      />
                      <line
                        x1="1"
                        y1="1"
                        x2="23"
                        y2="23"
                        stroke="#FF4444"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <div className="text-center px-6">
                    <p className="text-white font-semibold mb-1">
                      Camera unavailable
                    </p>
                    <p className="text-[#B0B0CC] text-sm">{error?.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="px-6 py-3 rounded-2xl font-semibold text-sm text-white"
                    style={{
                      background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
                    }}
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ display: isActive ? "block" : "none" }}
                  />
                  {!isActive && !isLoading && (
                    <div
                      className="w-full h-full"
                      style={{ background: "#0A0A1A" }}
                    />
                  )}
                  {isLoading && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.5)" }}
                    >
                      <div
                        className="w-10 h-10 rounded-full border-2 animate-spin"
                        style={{
                          borderColor: "rgba(255,255,255,0.2)",
                          borderTopColor: "#00CFFF",
                        }}
                      />
                    </div>
                  )}
                </>
              )}

              <AnimatePresence>
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 pointer-events-none"
                    style={{ border: "3px solid #FF3B3B" }}
                  />
                )}
              </AnimatePresence>

              {/* Daily Snap Challenge Banner */}
              {!challengeDismissed && (
                <div
                  className="absolute top-14 left-3 right-3 z-10 flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{
                    background: "rgba(10,14,30,0.88)",
                    backdropFilter: "blur(8px)",
                    borderLeft: "3px solid #00CFFF",
                    border: "1px solid rgba(0,207,255,0.3)",
                    borderLeftWidth: 3,
                  }}
                >
                  <p className="flex-1 text-white text-xs font-medium leading-snug">
                    {dailyPrompt}
                  </p>
                  <button
                    type="button"
                    onClick={handleDismissChallenge}
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.12)" }}
                    aria-label="Dismiss challenge"
                  >
                    <X size={11} color="#B0B0CC" />
                  </button>
                </div>
              )}

              <div
                className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-14 pb-4"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)",
                }}
              >
                <PressableButton
                  onClick={() => setFlashOn((f) => !f)}
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {flashOn ? (
                    <Zap size={20} color="#FFDD00" />
                  ) : (
                    <ZapOff size={20} color="white" />
                  )}
                </PressableButton>

                {isRecording && recordingStartTime ? (
                  <RecordingTimer startTime={recordingStartTime} />
                ) : (
                  <div className="relative">
                    <PressableButton
                      onClick={() => setShowTimerPicker((s) => !s)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <Clock size={16} color="white" />
                      <span className="text-white text-sm font-semibold">
                        {timerDuration}s
                      </span>
                      <ChevronDown size={14} color="white" />
                    </PressableButton>
                    <AnimatePresence>
                      {showTimerPicker && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="absolute top-full mt-2 right-0 rounded-2xl overflow-hidden z-10"
                          style={{
                            background: "rgba(26,31,51,0.95)",
                            border: "1px solid #2A3048",
                            backdropFilter: "blur(12px)",
                          }}
                        >
                          {[3, 5, 10, 30].map((t) => (
                            <button
                              type="button"
                              key={t}
                              onClick={() => {
                                setTimerDuration(t);
                                setShowTimerPicker(false);
                              }}
                              className="block w-full px-6 py-3 text-sm font-medium text-left transition-colors hover:bg-[#2A3048]"
                              style={{
                                color:
                                  timerDuration === t ? "#00CFFF" : "#FFFFFF",
                              }}
                            >
                              {t}s
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <AnimatePresence>
                {!isRecording && isActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 1 }}
                    className="absolute bottom-36 left-0 right-0 flex justify-center pointer-events-none"
                  >
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                      style={{ background: "rgba(0,0,0,0.5)" }}
                    >
                      <Video size={13} color="#B0B0CC" />
                      <span className="text-[#B0B0CC] text-xs">
                        Hold for video · Tap for photo
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div
                className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 pb-8 pt-4"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
                }}
              >
                <PressableButton
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Upload size={20} color="white" />
                </PressableButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleGalleryUpload}
                />

                <button
                  type="button"
                  onPointerDown={handleButtonPointerDown}
                  onPointerUp={handleButtonPointerUp}
                  onPointerLeave={handleButtonPointerLeave}
                  disabled={!isActive}
                  className="w-20 h-20 rounded-full flex items-center justify-center select-none"
                  style={{
                    background: "transparent",
                    border: `3px solid ${isRecording ? "rgba(255,59,59,0.9)" : "rgba(255,255,255,0.9)"}`,
                    boxShadow: isRecording
                      ? "0 0 25px rgba(255,59,59,0.5), 0 0 60px rgba(255,59,59,0.2)"
                      : "0 0 25px rgba(0, 207, 255, 0.4), 0 0 60px rgba(0, 207, 255, 0.15)",
                    animation: isRecording
                      ? "recording-ring 1s ease-in-out infinite"
                      : "none",
                    cursor: isActive ? "pointer" : "default",
                    touchAction: "none",
                    userSelect: "none",
                  }}
                >
                  <motion.div
                    animate={{
                      borderRadius: isRecording ? "8px" : "50%",
                      scale: isRecording ? 0.55 : 0.82,
                    }}
                    transition={{ duration: 0.2 }}
                    className="w-14 h-14"
                    style={{
                      background: isRecording
                        ? "#FF3B3B"
                        : "linear-gradient(135deg, #00CFFF, #BD00FF)",
                    }}
                  />
                </button>

                <PressableButton
                  onClick={() => switchCamera()}
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <SwitchCamera size={20} color="white" />
                </PressableButton>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ─── PREVIEW ─── */
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex flex-col"
            style={{ background: "#000" }}
          >
            {/* Media preview */}
            <div
              ref={previewContainerRef}
              className="relative flex-1 overflow-hidden"
              style={{ minHeight: 0 }}
            >
              {isVideoSnap && capturedVideo ? (
                <video
                  src={capturedVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Snap preview"
                  className="w-full h-full object-cover"
                  style={{ filter: selectedFilter.css }}
                />
              ) : null}

              {/* Drawing canvas overlay (only for photos in draw mode) */}
              {!isVideoSnap && capturedImage && previewTab === "draw" && (
                <DrawingCanvas
                  containerRef={previewContainerRef}
                  strokes={drawStrokes}
                  onStrokeAdd={(stroke) =>
                    setDrawStrokes((prev) => [...prev, stroke])
                  }
                  currentColor={drawColor}
                  brushSize={brushSize}
                />
              )}

              {/* Placed items overlay (always visible in preview) */}
              {!isVideoSnap && placedItems.length > 0 && (
                <PlacedItemsOverlay
                  items={placedItems}
                  onMove={handleMoveItem}
                />
              )}

              {/* Timestamp overlay preview */}
              {!isVideoSnap && showTimestampOverlay && (
                <div
                  className="absolute bottom-16 right-3 px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(0,0,0,0.55)", zIndex: 5 }}
                >
                  <span className="text-white text-xs font-bold">
                    {new Date().toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {" • "}
                    {new Date().toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}

              {/* Top bar */}
              <div
                className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-14 pb-4"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)",
                  zIndex: 20,
                }}
              >
                <PressableButton
                  onClick={handleDiscard}
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <X size={20} color="white" />
                </PressableButton>

                {isVideoSnap ? (
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{
                      background: "rgba(0,0,0,0.5)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <Video size={14} color="#FF3B3B" />
                    <span className="text-white text-xs font-semibold">
                      Video
                    </span>
                  </div>
                ) : isEphemeral ? (
                  <SnapTimer duration={timerDuration} onExpire={() => {}} />
                ) : null}
              </div>

              {/* Caption overlay */}
              <AnimatePresence>
                {snapCaption && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-4 left-4 right-4"
                    style={{ zIndex: 15 }}
                  >
                    <div
                      className="text-center px-4 py-2 rounded-xl"
                      style={{ background: "rgba(0,0,0,0.7)" }}
                    >
                      <p className="text-white font-semibold text-sm">
                        {snapCaption}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom action panel */}
            <div
              className="flex-shrink-0 flex flex-col gap-2 px-5 pt-3 pb-5"
              style={{ background: "#1A1A2E", borderTop: "1px solid #2A3048" }}
            >
              {/* Preview tab switcher (photos only) */}
              {!isVideoSnap && capturedImage && (
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                  {previewTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPreviewTab(tab.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold flex-shrink-0 transition-all"
                      style={{
                        background:
                          previewTab === tab.id
                            ? "rgba(0,207,255,0.15)"
                            : "rgba(255,255,255,0.06)",
                        color: previewTab === tab.id ? "#00CFFF" : "#B0B0CC",
                        border:
                          previewTab === tab.id
                            ? "1px solid rgba(0,207,255,0.4)"
                            : "1px solid transparent",
                      }}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Tab panels */}
              {!isVideoSnap && capturedImage && (
                <>
                  {previewTab === "filters" && (
                    <div>
                      <FilterStrip
                        imageDataUrl={capturedImage}
                        selectedFilter={selectedFilterId}
                        onSelect={setSelectedFilterId}
                      />
                      {/* Timestamp toggle */}
                      <div className="flex items-center gap-2 mt-1 mb-1">
                        <button
                          type="button"
                          onClick={() => setShowTimestampOverlay((s) => !s)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                          style={{
                            background: showTimestampOverlay
                              ? "rgba(0,207,255,0.15)"
                              : "rgba(255,255,255,0.06)",
                            border: showTimestampOverlay
                              ? "1px solid rgba(0,207,255,0.4)"
                              : "1px solid rgba(255,255,255,0.1)",
                            color: showTimestampOverlay ? "#00CFFF" : "#B0B0CC",
                          }}
                        >
                          <Clock size={12} />
                          Time
                        </button>
                      </div>
                    </div>
                  )}

                  {previewTab === "draw" && (
                    <DrawingToolbar
                      selectedColor={drawColor}
                      onColorChange={setDrawColor}
                      brushSize={brushSize}
                      onBrushChange={setBrushSize}
                      onUndo={() => setDrawStrokes((prev) => prev.slice(0, -1))}
                      onClear={() => setDrawStrokes([])}
                    />
                  )}

                  {previewTab === "stickers" && (
                    <StickerPanel onPlace={handleAddSticker} />
                  )}

                  {previewTab === "text" && (
                    <TextPanel onAddText={handleAddText} />
                  )}
                </>
              )}

              {/* Caption input */}
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <input
                  type="text"
                  placeholder="Add a caption..."
                  value={snapCaption}
                  onChange={(e) => setSnapCaption(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-[#B0B0CC]"
                  maxLength={150}
                />
                {snapCaption && (
                  <button
                    type="button"
                    onClick={() => setSnapCaption("")}
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.15)" }}
                    aria-label="Clear caption"
                  >
                    <X size={11} color="white" />
                  </button>
                )}
              </div>

              {/* Row: AI Assistant + Ephemeral toggle */}
              <div className="flex items-center gap-3">
                <PressableButton
                  onClick={() => setShowAiAssistant(true)}
                  className="flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2"
                  style={{
                    border: "1px solid rgba(0,207,255,0.4)",
                    background: "rgba(0,207,255,0.08)",
                    color: "#00CFFF",
                  }}
                >
                  <Sparkles size={16} />
                  AI Assistant
                </PressableButton>

                {!isVideoSnap && (
                  <button
                    type="button"
                    onClick={() => setIsEphemeral((e) => !e)}
                    className="w-12 h-6 rounded-full transition-all duration-300 relative flex-shrink-0"
                    style={{
                      background: isEphemeral
                        ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
                        : "#2A3048",
                    }}
                    aria-label={`Ephemeral ${isEphemeral ? "on" : "off"}`}
                  >
                    <div
                      className="absolute w-5 h-5 rounded-full top-0.5 transition-all duration-300"
                      style={{
                        left: isEphemeral ? "calc(100% - 22px)" : "2px",
                        background: "white",
                      }}
                    />
                  </button>
                )}
              </div>

              {/* Send To button */}
              <button
                type="button"
                onClick={() => {
                  setSendError(null);
                  setShowSendSheet(true);
                }}
                className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{
                  background: "linear-gradient(135deg, #00CFFF, #BD00FF)",
                  boxShadow: "0 0 30px rgba(0,207,255,0.35)",
                }}
              >
                <Send size={20} />
                {selectedFriends.length > 0
                  ? `Send To... (${selectedFriends.length} selected)`
                  : "Send To..."}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSendSheet && (
          <SendToSheet
            friends={friends}
            selectedFriends={selectedFriends}
            onToggle={handleToggleFriend}
            onSend={handleSendSnap}
            onClose={() => setShowSendSheet(false)}
            sending={sending}
            sent={sent}
            sendError={sendError}
            uploadProgress={uploadProgress}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAiAssistant && (
          <AiSnapAssistant
            friends={friends}
            onSelectCaption={(caption) => {
              setSnapCaption(caption);
              setShowAiAssistant(false);
            }}
            onClose={() => setShowAiAssistant(false)}
          />
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
