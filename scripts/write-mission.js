#!/usr/bin/env node
/**
 * SGSS Daily Mission Writer — runs in GitHub Actions for Minecraft Overtaken.
 *
 * Every day this script:
 *   1. Reads book/part1.md (the mission log / game)
 *   2. Finds the highest mission number and computes the next one
 *   3. Calls opencode.ai (big-pickle) and asks for the NEXT mission
 *      (~2,000 words), written to be HARDER than every mission before it
 *   4. Appends the mission after the epilogue, before Appendix A
 *   5. Regenerates the site (python3 build_site.py -> index.html)
 *   6. Commits + pushes -> GitHub Pages auto-rebuilds -> game grows daily
 *
 * Running from GitHub runners keeps opencode.ai from flagging any IP.
 *
 * Exit codes: 0 = ok (mission written or nothing to do), 1 = failure.
 */

const fs = require("fs");
const { execSync } = require("child_process");

// ── Config ─────────────────────────────────────────────────────────────────
const CONFIG_PATH = "book.config.json";
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

const TITLE = cfg.title || "Minecraft Overtaken";
const MISSION_FILE = cfg.missionFile || "book/part1.md";
const BUILD_SITE = cfg.buildSite || "python3 build_site.py";
const TARGET_WORDS = cfg.targetWords || 2000;
const MIN_WORDS = cfg.minWords || 1500;
const MAX_WORDS = cfg.maxWords || 3200;
const API_TIMEOUT_MS = cfg.apiTimeoutMs || 600000;
const MAX_TOKENS = cfg.maxTokens || 16384;
const MAX_TRIES = 6;

const BASE_URL = process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/v1";
const MODEL = process.env.MODEL || "big-pickle";

const KEYS = [process.env.OPENCODE_API_KEY, process.env.OPENCODE_API_KEY_2, process.env.OPENCODE_API_KEY_3, process.env.OPENCODE_API_KEY_4, process.env.OPENCODE_API_KEY_5]
  .filter(Boolean);
if (!KEYS.length) {
  console.error("❌ OPENCODE_API_KEY not set");
  process.exit(1);
}

// ── Tier ladder — the campaign escalates forever ───────────────────────────
const TIER_NAMES = [
  "", "TIER I — EASY", "TIER II — NORMAL", "TIER III — HARD",
  "TIER IV — EXPERT", "TIER V — NIGHTMARE", "TIER VI — LEGENDARY",
  "TIER VII — MYTHIC", "TIER VIII — APOCALYPTIC", "TIER IX — GODLIKE",
  "TIER X — IMPOSSIBLE",
];
const DIFFICULTY = [
  "", "Easy", "Normal", "Hard", "Expert", "Nightmare",
  "Legendary", "Mythic", "Apocalyptic", "Godlike", "Impossible",
];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

function tierFor(missionN) {
  return Math.ceil(missionN / 5);
}
function tierName(t) {
  return TIER_NAMES[t] || `TIER ${ROMAN[t] || t} — MYTHIC+`;
}
function difficultyLabel(t) {
  return DIFFICULTY[t] || "Mythic+";
}

// ── Helpers ────────────────────────────────────────────────────────────────
function log(...a) { console.log("[writer]", ...a); }

function readFile(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function wordCount(text) {
  return (text.trim().match(/\S+/g) || []).length;
}

function maxMissionNumber(md) {
  let maxN = 0;
  const re = /^##\s+MISSION\s+(\d+)\s*[—\-–]/gm;
  let m;
  while ((m = re.exec(md)) !== null) maxN = Math.max(maxN, parseInt(m[1], 10));
  return maxN;
}

// ── API call ───────────────────────────────────────────────────────────────
async function generateMission(prompt, keyIndex) {
  const API_KEY = KEYS[keyIndex % KEYS.length];
  const sys =
    `You are the mission writer for "${TITLE}" by ${cfg.author || "Walusimbi Leon (SGSS)"}.\n` +
    `You write playable Minecraft survival missions in the book's exact house style: ` +
    `the voice of a missionary briefing handed down from the field. Every mission must be ` +
    `concrete, mechanically accurate, and brutally harder than the one before it.\n` +
    `Write ONLY the mission content described in the user prompt — no commentary, no ` +
    `recaps, no meta-notes, no code fences, no "here is" introductions.`;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: MAX_TOKENS,
    }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (res.status === 429) throw new Error("rate limited");
  if (!res.ok) throw new Error(`opencode.ai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  let content = data?.choices?.[0]?.message?.content || "";
  if (!content.trim()) throw new Error("empty content from model");
  content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
  return content;
}

// ── Normalization ──────────────────────────────────────────────────────────
function normalizeMission(raw, missionN, diffLabel, tierLabel, newTier) {
  let c = raw.replace(/```/g, "").trim();

  // Cut anything before the first real heading (model chatter)
  const firstHeading = c.search(/^#{1,2}\s/m);
  if (firstHeading > 0) c = c.slice(firstHeading).trim();

  // Force the tier heading when a new tier begins
  if (newTier) {
    const tierRe = /^#\s+TIER\s+[IVX]+[—\-–]?.+$/m;
    if (!tierRe.test(c)) {
      c = `# ${tierLabel}\n\n*Introductory tier paragraph — see prompt rules.*\n\n---\n\n${c}`;
    } else {
      c = c.replace(tierRe, (h) => `# ${tierLabel}`);
    }
  } else {
    // Remove a stray tier heading if the model added one
    c = c.replace(/^#\s+TIER\s+[IVX]+[—\-–]?.+$/m, "").replace(/^\s*---\s*$/, "").trim();
  }

  // Normalize the mission heading to the exact number + em dash
  const headingRe = /^##\s+MISSION\s+(\d+)\s*[—\-–]?\s*(.*)$/m;
  const hm = c.match(headingRe);
  if (!hm) throw new Error("generated content has no '## MISSION N — TITLE' heading");
  const title = hm[2].trim() || "UNNAMED MISSION";
  c = c.replace(headingRe, `## MISSION ${missionN} — ${title}`);

  // Force the difficulty line to the correct escalating label
  c = c.replace(/^\*\*Difficulty:[^*]*\*\*$/m, `**Difficulty: ${diffLabel}**`);
  if (!new RegExp(`^\\*\\*Difficulty: ${diffLabel}\\*\\*$`, "m").test(c)) {
    c = c.replace(/^(## MISSION \d+ — .+)$/m, `$1\n\n**Difficulty: ${diffLabel}**`);
  }

  return { content: c, title };
}

// ── Insertion — after the epilogue, before Appendix A ──────────────────────
function insertMission(md, newContent) {
  const idx = md.search(/^##\s+APPENDIX\s+A\b/m);
  if (idx < 0) throw new Error("could not find '## APPENDIX A' insert point in book");
  const head = md.slice(0, idx).replace(/[\s]*$/, "\n\n");
  const tail = md.slice(idx);
  return head + newContent.trim() + "\n\n---\n\n" + tail;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const md = readFile(MISSION_FILE);
  if (!md) throw new Error(`cannot read ${MISSION_FILE}`);

  const missionN = maxMissionNumber(md) + 1;
  const tier = tierFor(missionN);
  const newTier = (missionN - 1) % 5 === 0;
  const tierLabel = tierName(tier);
  const diffLabel = difficultyLabel(tier);

  log(`current missions: ${missionN - 1} → writing MISSION ${missionN}`);
  log(`tier ${tier}: ${tierLabel} (difficulty: ${diffLabel})${newTier ? " — NEW TIER" : ""}`);

  // Continuity: epilogue + everything after it up to the appendices
  const epiIdx = md.search(/^##\s+EPILOGUE\b/m);
  const appIdx = md.search(/^##\s+APPENDIX\s+A\b/m);
  const continuity = (epiIdx >= 0 && appIdx > epiIdx)
    ? md.slice(epiIdx, appIdx).trim()
    : md.split(/\s+/).slice(-1500).join(" ");

  // The master coordinate table so the writer never reuses old sites
  const coordTable = md.match(/^## APPENDIX B[\s\S]*?^## APPENDIX C/m);
  const priorSites = coordTable ? coordTable[0] : "(see the book's Appendix B)";

  const prompt =
    `BOOK: ${cfg.description || ""}\n\n` +
    (cfg.genre ? `GENRE: ${cfg.genre}\n\n` : "") +
    (cfg.style ? `STYLE: ${cfg.style}\n\n` : "") +
    (cfg.characters ? `CHARACTERS: ${cfg.characters}\n\n` : "") +
    (cfg.setting ? `SETTING: ${cfg.setting}\n\n` : "") +
    `YOUR MISSION TODAY: write **MISSION ${missionN}** — the next mission of the campaign.\n` +
    `It belongs to **${tierLabel}** and carries the difficulty **${diffLabel}**.\n\n` +
    (newTier
      ? `A NEW TIER BEGINS HERE. Your output must open with the tier heading line "# ${tierLabel}", ` +
        `followed by ONE italic tier-intro paragraph (2-4 sentences) in the style of the existing tier intros — ` +
        `set the stakes for this new tier, name the new threat that has risen now that the world was overtaken by light, ` +
        `and warn that the easy days are finished. Then a "---" separator, then the mission itself.\n\n`
      : `No new tier heading — output the mission directly (## MISSION ${missionN} — ...).\n\n`) +
    `HARDER, ALWAYS HARDER: this mission must be meaningfully harder than MISSION ${missionN - 1} ` +
    `(the last one written) and every mission before it. Escalate relentlessly — tougher enemies, stricter ` +
    `supply budgets, tighter time pressure, more dangerous terrain, higher-stakes objectives, heavier consequences ` +
    `for failure. As tiers climb, pull in deeper Minecraft content: Deep Dark and the Warden, ancient cities, ` +
    `trial chambers and the breeze, raids, the Wither, netherite, End cities, shulkers and elytra, allays, ` +
    `moss and archaeology, coral and conduits. Never repeat the objective of any earlier mission.\n\n` +
    `FORMAT RULES — follow the book's exact mission template, in this order:\n` +
    `1. Heading: "## MISSION ${missionN} — <TITLE>" (title in the book's voice, e.g. "THE DEEPER DARK").\n` +
    `2. A line exactly: "**Difficulty: ${diffLabel}**".\n` +
    `3. "### Mission Briefing" — 3-6 meaty paragraphs of world-state: what is happening, why it matters, ` +
    `what the shadow is doing now. Make it feel like a field report.\n` +
    `4. "### Objective" — a single bold-keyword sentence stating exactly what must be accomplished, ` +
    `with block counts and locations.\n` +
    `5. "### Supplies" — a markdown table with columns "Item | Quantity" listing every block and item ` +
    `needed, with concrete numbers that actually add up.\n` +
    `6. "### Coordinates" — a markdown table with columns "Landmark | X | Y | Z" giving exact positions ` +
    `for every stage of the mission, followed by a short layout-note paragraph like the existing missions have.\n` +
    `7. "### The Plan" — 8-12 numbered steps. Each step starts with a bold lead-in phrase ` +
    `("1. **Name the step.** ...") and gives exact block placements, quantities, and order. ` +
    `This is the playable core — make it precise enough to follow without guessing.\n` +
    `8. "### Success Checklist" — "- [ ]" checkbox lines, 5-8 of them, each verifying a concrete ` +
    `outcome (including one final "view from" or "survive" check).\n` +
    `9. "### Missionary Note" — 2-4 italic paragraphs of reflection in the book's devotional-missionary ` +
    `voice, ending with a short italic signature line.\n\n` +
    `COORDINATES: sea level is Y = 63, spawn is (0, 63, 0). X = east/west, Z = south/north, Y = up/down. ` +
    `Place this mission's sites FARTHER from spawn than previous missions and never reuse a landmark ` +
    `already claimed. Sites already used (do not re-claim):\n${priorSites}\n\n` +
    `LENGTH: about ${TARGET_WORDS} words total (roughly ${Math.round(TARGET_WORDS / 8)} words per section). ` +
    `Develop every section richly — this is a full mission, not a sketch.\n\n` +
    `CONTINUITY — here is the end of the book as it stands now. Your mission follows immediately ` +
    `after it (do not repeat or contradict it):\n---\n${continuity}\n---\n` +
    `\nOutput ONLY the mission (plus the tier heading + intro if a new tier begins).`;

  // Generate — rotate through fallback keys, back off harder each try
  let content = null, title = null;
  for (let i = 1; i <= MAX_TRIES; i++) {
    const keyIdx = i - 1;
    try {
      const raw = await generateMission(prompt, keyIdx);
      const wc = wordCount(raw.replace(/^#{1,6}\s.*$/gm, ""));
      log(`attempt ${i} (key ${keyIdx + 1}/${KEYS.length}): generated ${wc} words`);
      if (wc < MIN_WORDS) throw new Error(`too short (${wc} words)`);
      if (wc > MAX_WORDS) throw new Error(`too long (${wc} words)`);
      const required = ["### Mission Briefing", "### Objective", "### Supplies",
        "### Coordinates", "### The Plan", "### Success Checklist", "### Missionary Note"];
      for (const s of required) {
        if (!raw.includes(s)) throw new Error(`missing section: ${s}`);
      }
      const norm = normalizeMission(raw, missionN, diffLabel, tierLabel, newTier);
      content = norm.content;
      title = norm.title;
      log(`✅ mission parsed: "${title}"`);
      break;
    } catch (err) {
      log(`attempt ${i} (key ${keyIdx + 1}/${KEYS.length}) failed: ${err.message}`);
      if (i === MAX_TRIES) throw err;
      await new Promise((r) => setTimeout(r, 15000 * i * i)); // 15s, 60s, 135s, 240s…
    }
  }

  // Guard against double-writing the same mission (e.g. manual re-run)
  if (new RegExp(`^##\\s+MISSION\\s+${missionN}\\s+[—\\-–]`, "m").test(md)) {
    log(`MISSION ${missionN} already exists — nothing to do`);
    return;
  }

  // Apply to the book
  const updated = insertMission(md, content);
  fs.writeFileSync(MISSION_FILE, updated);
  log(`✍️  mission written: ${MISSION_FILE} (+${wordCount(content)} words)`);

  // Regenerate the site
  try {
    execSync(BUILD_SITE, { stdio: "inherit" });
    log("🌐 site regenerated");
  } catch (err) {
    console.error("⚠️  build_site.py failed:", err.message);
    process.exit(1);
  }

  // Commit & push
  execSync("git add -A", { stdio: "inherit" });
  const diff = execSync("git diff --cached --stat", { encoding: "utf8" });
  log(diff);
  const wcNew = wordCount(content.replace(/^#{1,6}\s.*$/gm, ""));
  execSync(
    `git -c user.name="SGSS Books Bot" -c user.email="walusimbileon3@gmail.com" commit -m "📜 Mission ${missionN} — ${title} added (+~${wcNew} words, ${tierLabel})"`,
    { stdio: "inherit" }
  );
  try {
    const pushToken = process.env.GH_PUSH_TOKEN;
    if (pushToken) {
      const origin = execSync("git remote get-url origin", { encoding: "utf8" }).trim();
      const authed = origin.replace(/^https:\/\//, `https://x-access-token:${pushToken}@`);
      // actions/checkout sets an Authorization extraheader (GITHUB_TOKEN) that
      // would override the PAT — clear it so the PAT authenticates the push.
      execSync(`git -c "http.https://github.com/.extraheader=" push "${authed}" HEAD:main`, { stdio: "inherit" });
    } else {
      execSync("git push", { stdio: "inherit" });
    }
    log("✅ pushed — GitHub Pages will rebuild");
  } catch (err) {
    if (process.env.ALLOW_NO_PUSH !== "1") throw err;
    log("⚠️  no remote — skipped push (local test mode)");
  }
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
