# 🥁 Gitpal — Ace the palace AI

> The ambient AI companion that follows you across the **entire internet** — reads any page, builds your knowledge library, and guides your next professional move.

Gitpal is the first module of the **Git AI Suite** — four specialized AI agents engineered to master every dimension of your GitHub workflow. Now available as a **browser extension** that works on every website.

---

## ✨ Features

- **🥁 Draggable floating orb** — always visible, moveable anywhere on screen, position saved across every page you visit
- **👁 Full page reader** — reads all visible text from any site (like OCR using the live DOM) — works on Twitter/X, GitHub, Reddit, YouTube, LinkedIn, and more
- **📚 Content card builder** — as you read and discuss topics, Gitpal extracts topics, summarizes key insights, and saves research cards to a persistent **Library**
- **🔬 Topic extractor** — keyword-frequency analysis that surfaces what any page is really about
- **🧵 Ambient summarization** — have a conversation about hydrogen theory on Twitter? Gitpal reads the tweets, summarizes the discussion, and logs it
- **📌 Pin suggestions** — AI-curated list of repos and projects worth pinning to your profile
- **🚀 Pro Moves coaching** — actionable career-level advice surfaced in real time
- **🌐 Dashboard** — overview of all four AI agents and their status

---

## 🤖 The Git AI Suite

| Agent | Symbol | Role | Status |
|-------|--------|------|--------|
| **Gitpal** | 🥁 | Ace the palace — ambient AI companion, pinned content, pro moves | ✅ Active |
| **Gitpub** | 📡 | Publisher AI — repo signals, publish/deploy checks, build tools | 🔜 Soon |
| **Gitpro** | 🛸 | Quantum mechanic — page content edits, styling, design assimilation | 🔜 Soon |
| **Gitpin** | △  | Vector triangulator — smart pinning, cross-repo ranking | 🔜 Soon |

---

## 🌍 Browser Extension (Follow Me Everywhere)

The orb can follow you across the **entire internet** — not just GitHub. Install it as a Chrome/Edge/Brave extension and it appears on every website you visit.

### Install (Chrome / Edge / Brave)

1. **Download or clone** this repository
2. Open your browser and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **"Load unpacked"**
5. Select the **`extension/`** folder inside this repo
6. The 🥁 Gitpal icon will appear in your browser toolbar

The orb will now appear on **every website** you visit — GitHub, Twitter/X, Reddit, YouTube, LinkedIn, Stack Overflow, and anywhere else.

### What you can say to the orb

| Command | What it does |
|---------|-------------|
| `👁 Look at this page` | Reads every visible word on the current page |
| `📚 Build a content card` | Extracts topics + key insights and saves to your Library |
| `🔬 What topics are here?` | Keyword analysis of the current page |
| `Where am I?` / `What do you see?` | Full page observation summary |
| `What should I pin?` | GitHub pin suggestions |
| `Give me a pro move` | Career coaching advice |

### How the page reader works

Gitpal walks the entire live DOM tree of any page to extract all visible text — similar to how OCR software reads a screenshot, but using the page's actual content. It then:
- Filters stop words and extracts the most meaningful **topics**
- Scores sentences by **topic density** to find key insights
- On structured sites (Twitter, GitHub, etc.) it also reads **specific elements** like tweet text, repo names, video titles, and issue descriptions

No external API is used. Everything runs **locally in your browser**.

---

## 🚀 Getting Started (Static Site Demo)

No build step required — it's a static web app.

```bash
# Clone the repo
git clone https://github.com/www-infinity4/Gitpal-.git
cd Gitpal-

# Open in your browser
open index.html
# or serve locally:
npx serve .
```

---

## 📁 Project Structure

```
Gitpal-/
├── index.html              # Main demo page
├── styles/
│   └── main.css            # Dark GitHub-inspired stylesheet
├── scripts/
│   ├── gitpal.js           # 🥁 Floating orb AI core (chat, pins, moves)
│   └── app.js              # Main app logic (dashboard, cards, nav)
├── extension/              # 🌍 Browser extension (works on every site)
│   ├── manifest.json       # Chrome MV3 manifest
│   ├── content.js          # Content script — orb + page reader + library
│   ├── background.js       # Service worker
│   ├── popup.html          # Toolbar popup UI
│   └── popup.js            # Popup logic
└── README.md
```

---

## 🛠 Tech

- Vanilla HTML5, CSS3, JavaScript (ES2017+, IIFE modules)
- No build tools or dependencies required
- Responsive — works on desktop and mobile

---

*Part of the Gitpal AI suite · Built for GitHub communities*