import { Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "../types";
import { UserAvatar } from "./Shared";

interface AiSnapAssistantProps {
  friends: User[];
  onSelectCaption: (caption: string) => void;
  onClose: () => void;
}

function seedIndex(str: string, offset: number, max: number): number {
  let hash = offset;
  for (const ch of str) hash = (hash * 31 + ch.charCodeAt(0)) & 0xfffffff;
  return Math.abs(hash) % max;
}

const CAPTIONS = [
  "Living for this ✨",
  "No filter needed 🔥",
  "Main character energy 💫",
  "This is everything rn 😍",
  "Honestly? Obsessed 🙌",
  "We out here 🌟",
  "Catch me vibing 🎶",
  "Soft life loading... ✨",
  "This hit different 🥺",
  "Understood the assignment 🫡",
  "Eyes on the prize 👀",
  "Just being iconic tbh 💅",
  "Peak moment unlocked 🔓",
  "Absolutely no notes 🤌",
  "Real ones know 🫀",
  "Too good to be filtered 📸",
  "Era unlocked 🗝️",
  "Breathe it in 🌬️",
  "Healing arc loading 💖",
  "Nothing but vibes ☁️",
];

const EMOJI_SETS = [
  "🌅✨🔥",
  "💫🌊😎",
  "🎉🥳🌟",
  "🌸🤍🌿",
  "🔥💜⚡",
  "🎶🎤🌈",
  "🌙⭐🌌",
  "🏖️🌺💛",
  "🎯💥🚀",
  "🦋🌼🌸",
  "🍃🌊🌤️",
  "🎨✏️💡",
  "🤍🖤💫",
  "🌮🍜🎊",
  "🐚🌊🏝️",
  "🫧🌸💗",
  "🎠🌙✨",
  "🍋🌻🟡",
  "🌃🌆🏙️",
  "🥂🎊🍾",
];

const FRIEND_REASONS = [
  "They'd vibe with this! 🎶",
  "Your go-to for moments like these 🌟",
  "They always react the best 😄",
  "This is totally their aesthetic 🎨",
  "They've been waiting for this content 📱",
  "Would go crazy for this 🔥",
  "100% sending this their way 💌",
  "They'll screenshot this immediately 📸",
  "Built for each other's feeds 🤝",
  "Their whole personality is this 😂",
  "Would literally cry over this 🥺",
  "Their reaction would be priceless 😂",
  "Same energy, different person ✨",
  "This hits their main character era 💫",
  "They need to see this ASAP 🚨",
];

const CHAT_REPLIES = [
  "This is everything rn 😭",
  "We need to go here!",
  "You're glowing bestie ✨",
  "OK I'm obsessed with this 🥺",
  "Not me screaming 😩",
  "Send location immediately 📍",
  "This is so you 💖",
  "I need the full story",
  "Living vicariously through you 🌟",
  "This is too good for my eyes 👀",
  "Absolutely iconic behavior 👑",
  "Okay so when are we doing this?",
  "Please bring me next time 🙏",
  "Not me adding this to my vision board 🎯",
  "The vibe is immaculate ✨",
];

const POLLS = [
  {
    question: "Rate this vibe:",
    options: ["🔥 Fire", "😎 Cool", "💤 Meh", "🌟 Iconic"],
  },
  {
    question: "This snap is giving...",
    options: ["🌅 Golden hour", "🌙 Night owl", "☁️ Dreamy", "⚡ Electric"],
  },
  {
    question: "What should I do next?",
    options: ["📸 More snaps", "🎥 Go live", "✍️ Story time", "😴 Rest"],
  },
  {
    question: "How hard did this hit?",
    options: ["😐 Solid", "😲 Whoa", "🤯 Mind blown", "💀 Dead"],
  },
  {
    question: "Catch the mood:",
    options: ["✨ Ethereal", "🔥 Hype", "🌊 Chill", "🎉 Party"],
  },
  {
    question: "What's the energy?",
    options: ["💅 Slay", "🫠 Melting", "🚀 Out of this world", "🫶 Wholesome"],
  },
  {
    question: "Deserves a:",
    options: ["👏 Standing ovation", "💖 Heart", "🔁 Reshare", "🥇 Award"],
  },
  {
    question: "Story time rating:",
    options: ["📖 10/10", "🌟 Legendary", "😂 Chaotic", "🎭 Dramatic"],
  },
];

const STORY_HIGHLIGHTS = [
  "A {duration}-second glimpse into pure gold — perfect for your highlights reel 📸",
  "A {duration}-second slice of real life — raw, unfiltered, iconic ✨",
  "This {duration}-second moment captures the mood perfectly 🌟",
  "Drop it in your highlights — {duration} seconds of absolute cinema 🎬",
  "A {duration}-second highlight that says it all — no caption needed 🌊",
  "Your highlights are about to thank you for this {duration}-second gem 💫",
  "Main character moment: {duration} seconds of story-worthy content 💅",
  "Archive this! A {duration}-second highlight your future self will treasure 🗓️",
  "This {duration}-second snippet belongs on your best-of reel — no debate 🏆",
  "Highlight reel incoming: {duration} seconds of unmatched vibes 🎶",
];

const TRENDING_CAPTIONS = [
  "It's giving main character energy fr fr 💅",
  "Understood the assignment 🫡",
  "POV: you're eating life up rn 🍽️",
  "NPC could never 💫",
  "Core memory unlocked 🔑",
  "Slay? Slay. 👑",
  "Not me being that girl ✨",
  "The lore is building 📚",
  "That girl era loading... 🌸",
  "Understood the vibe assignment 🎯",
  "Real and true behavior only 🫶",
  "Ate and left zero crumbs 🍽️",
  "Delulu is the solulu fr 🌈",
  "The audacity? Iconic 💅",
  "This slaps, no notes 🔥",
  "Serve? Served. 🤌",
  "The glowup is real 🌟",
  "Hot girl walk energy ☀️",
];

interface AssistantResult {
  captions: string[];
  emojis: string[];
  friendSuggestions: { user: User; reason: string }[];
  replies: string[];
  poll: { question: string; options: string[] };
  storyHighlight: string;
  trendingCaption: string;
}

function generateResults(
  description: string,
  friends: User[],
): AssistantResult {
  const desc = description.trim().toLowerCase() || "snap";

  const pick = (arr: string[], offset: number, count: number): string[] => {
    const result: string[] = [];
    const used = new Set<number>();
    for (let i = 0; i < count; i++) {
      let idx = seedIndex(desc, offset + i * 7, arr.length);
      let attempts = 0;
      while (used.has(idx) && attempts < arr.length) {
        idx = (idx + 1) % arr.length;
        attempts++;
      }
      used.add(idx);
      result.push(arr[idx]);
    }
    return result;
  };

  const captions = pick(CAPTIONS, 1, 5).map((c) => {
    const words = desc.split(" ");
    const keyword = words[seedIndex(desc, 99, words.length)];
    return c.replace("[description keyword]", keyword);
  });

  const emojis = pick(EMOJI_SETS, 2, 5);

  const shuffledFriends = [...friends].sort(() => {
    const h = seedIndex(desc, 3, 1000);
    return (h % 3) - 1;
  });
  const friendSuggestions = shuffledFriends.slice(0, 5).map((user, i) => ({
    user,
    reason: FRIEND_REASONS[seedIndex(desc, 4 + i * 3, FRIEND_REASONS.length)],
  }));

  const replies = pick(CHAT_REPLIES, 5, 3);

  const pollIdx = seedIndex(desc, 6, POLLS.length);
  const poll = POLLS[pollIdx];

  const storyTemplate =
    STORY_HIGHLIGHTS[seedIndex(desc, 7, STORY_HIGHLIGHTS.length)];
  const durations = ["10", "12", "15"];
  const storyHighlight = storyTemplate.replace(
    "{duration}",
    durations[seedIndex(desc, 8, durations.length)],
  );

  const trendingCaption =
    TRENDING_CAPTIONS[seedIndex(desc, 9, TRENDING_CAPTIONS.length)];

  return {
    captions,
    emojis,
    friendSuggestions,
    replies,
    poll,
    storyHighlight,
    trendingCaption,
  };
}

const SECTION_DELAY = 0.07;

function SectionHeader({ label }: { label: string }) {
  return (
    <p
      className="text-xs font-bold tracking-widest uppercase mb-2"
      style={{ color: "#00CFFF" }}
    >
      {label}
    </p>
  );
}

function TappableCard({ text, onTap }: { text: string; onTap: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onTap}
      className="w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-colors"
      style={{
        background: "rgba(0,207,255,0.07)",
        border: "1px solid rgba(0,207,255,0.2)",
        color: "#FFFFFF",
      }}
    >
      {text}
    </motion.button>
  );
}

export function AiSnapAssistant({
  friends,
  onSelectCaption,
  onClose,
}: AiSnapAssistantProps) {
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AssistantResult | null>(null);

  const handleGenerate = () => {
    if (!description.trim()) return;
    setIsLoading(true);
    setResult(null);
    setTimeout(() => {
      setResult(generateResults(description, friends));
      setIsLoading(false);
    }, 1000);
  };

  const handleSelectCaption = (caption: string) => {
    onSelectCaption(caption);
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.38 }}
        className="w-full flex flex-col"
        style={{
          background: "#1A1F33",
          borderRadius: "24px 24px 0 0",
          border: "1px solid #2A3048",
          borderBottom: "none",
          maxHeight: "85vh",
        }}
        onClick={(e) => e.stopPropagation()}
        data-ocid="ai_assistant.sheet"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.2)" }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #00CFFF22, #BD00FF22)",
                border: "1px solid rgba(0,207,255,0.3)",
              }}
            >
              <Sparkles size={16} style={{ color: "#00CFFF" }} />
            </div>
            <h2 className="text-white font-bold text-lg">AI Snap Assistant</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.08)" }}
            data-ocid="ai_assistant.close_button"
          >
            <X size={18} color="#B0B0CC" />
          </button>
        </div>

        {/* Input + Generate */}
        <div className="px-5 pb-4 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 input-field"
              placeholder="Describe your snap..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleGenerate();
              }}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid #2A3048",
                borderRadius: 14,
                padding: "10px 14px",
                color: "#FFFFFF",
                fontSize: 14,
                outline: "none",
              }}
              data-ocid="ai_assistant.input"
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleGenerate}
              disabled={!description.trim() || isLoading}
              className="px-5 py-2.5 rounded-2xl font-bold text-sm text-white flex-shrink-0"
              style={{
                background:
                  description.trim() && !isLoading
                    ? "linear-gradient(135deg, #00CFFF, #BD00FF)"
                    : "#2A3048",
                opacity: !description.trim() || isLoading ? 0.6 : 1,
                boxShadow:
                  description.trim() && !isLoading
                    ? "0 0 18px rgba(0,207,255,0.3)"
                    : "none",
              }}
              data-ocid="ai_assistant.primary_button"
            >
              Generate
            </motion.button>
          </div>
        </div>

        {/* Scrollable results */}
        <div
          className="flex-1 overflow-y-auto px-5 pb-8"
          style={{ minHeight: 0 }}
        >
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 gap-3"
                data-ocid="ai_assistant.loading_state"
              >
                <div className="relative w-12 h-12">
                  <div
                    className="w-12 h-12 rounded-full border-2 animate-spin"
                    style={{
                      borderColor: "rgba(0,207,255,0.15)",
                      borderTopColor: "#00CFFF",
                    }}
                  />
                  <Sparkles
                    size={18}
                    className="absolute inset-0 m-auto"
                    style={{ color: "#BD00FF" }}
                  />
                </div>
                <p className="text-sm font-medium" style={{ color: "#B0B0CC" }}>
                  Generating magic...
                </p>
              </motion.div>
            )}

            {result && !isLoading && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col gap-5"
                data-ocid="ai_assistant.success_state"
              >
                {/* 1. Catchy Captions */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: SECTION_DELAY * 1 }}
                >
                  <SectionHeader label="✍️ Catchy Captions" />
                  <div className="flex flex-col gap-2">
                    {result.captions.map((caption) => (
                      <TappableCard
                        key={caption}
                        text={caption}
                        onTap={() => handleSelectCaption(caption)}
                      />
                    ))}
                  </div>
                </motion.div>

                {/* 2. Emoji Suggestions */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: SECTION_DELAY * 2 }}
                >
                  <SectionHeader label="😎 Emoji / Sticker Suggestions" />
                  <div className="flex flex-wrap gap-2">
                    {result.emojis.map((emoji) => (
                      <motion.button
                        type="button"
                        key={emoji}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => handleSelectCaption(emoji)}
                        className="px-4 py-2.5 rounded-2xl text-lg font-medium"
                        style={{
                          background: "rgba(189,0,255,0.1)",
                          border: "1px solid rgba(189,0,255,0.25)",
                        }}
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>

                {/* 3. Friend Suggestions */}
                {result.friendSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: SECTION_DELAY * 3 }}
                  >
                    <SectionHeader label="👥 Friend Suggestions" />
                    <div className="flex flex-col gap-2">
                      {result.friendSuggestions.map(({ user, reason }, i) => (
                        <div
                          key={user.username}
                          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid #2A3048",
                          }}
                          data-ocid={`ai_assistant.item.${i + 1}`}
                        >
                          <UserAvatar
                            name={user.displayName}
                            size={40}
                            avatarUrl={user.avatarUrl}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm">
                              {user.displayName}
                            </p>
                            <p className="text-xs" style={{ color: "#B0B0CC" }}>
                              {reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* 4. Chat Reply Suggestions */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: SECTION_DELAY * 4 }}
                >
                  <SectionHeader label="💬 Chat Reply Suggestions" />
                  <div className="flex flex-col gap-2">
                    {result.replies.map((reply) => (
                      <TappableCard
                        key={reply}
                        text={reply}
                        onTap={() => handleSelectCaption(reply)}
                      />
                    ))}
                  </div>
                </motion.div>

                {/* 5. Poll / Quiz */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: SECTION_DELAY * 5 }}
                >
                  <SectionHeader label="📊 Snap Poll / Quiz" />
                  <div
                    className="px-4 py-3 rounded-2xl"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid #2A3048",
                    }}
                    data-ocid="ai_assistant.panel"
                  >
                    <p className="text-white font-semibold text-sm mb-3">
                      {result.poll.question}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.poll.options.map((option) => (
                        <span
                          key={option}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{
                            background: "rgba(0,207,255,0.1)",
                            border: "1px solid rgba(0,207,255,0.25)",
                            color: "#00CFFF",
                          }}
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* 6. Story Highlight */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: SECTION_DELAY * 6 }}
                >
                  <SectionHeader label="📖 Story Highlight Description" />
                  <div
                    className="px-4 py-3 rounded-2xl"
                    style={{
                      background: "rgba(189,0,255,0.07)",
                      border: "1px solid rgba(189,0,255,0.2)",
                    }}
                  >
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "#FFFFFF" }}
                    >
                      {result.storyHighlight}
                    </p>
                  </div>
                </motion.div>

                {/* 7. Trending Caption */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: SECTION_DELAY * 7 }}
                >
                  <SectionHeader label="🔥 Trending Caption" />
                  <TappableCard
                    text={result.trendingCaption}
                    onTap={() => handleSelectCaption(result.trendingCaption)}
                  />
                </motion.div>
              </motion.div>
            )}

            {!isLoading && !result && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-10 gap-3"
                data-ocid="ai_assistant.empty_state"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(0,207,255,0.15), rgba(189,0,255,0.15))",
                  }}
                >
                  <Sparkles size={28} style={{ color: "#00CFFF" }} />
                </div>
                <p className="text-sm text-center" style={{ color: "#B0B0CC" }}>
                  Type a description of your snap above, then hit{" "}
                  <span style={{ color: "#00CFFF" }}>Generate</span> to unlock
                  AI-powered suggestions.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
