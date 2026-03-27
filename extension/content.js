/**
 * content.js
 * Gitpal browser extension — ambient AI companion.
 *
 * Injects a draggable, always-visible floating orb into every webpage.
 *
 * Features:
 *  • Draggable orb — move anywhere on screen, position saved across pages
 *  • Full page reader — walks the entire DOM to extract visible text (like OCR
 *    but using the live DOM, so it works on Twitter, GitHub, Reddit, YouTube, etc.)
 *  • Site-specific structured readers — reads tweet text, repo info, video titles, etc.
 *  • Topic extractor — keyword frequency analysis with stop-word filtering
 *  • Key sentence extractor — scores sentences by topic density for summaries
 *  • Content card builder — saves topic+summary research cards to a Library
 *  • Library tab — persistent localStorage knowledge base that grows as you browse
 *  • Context-aware AI — adapts responses to the site you're on
 *  • observe / build / topics AI commands
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────
     GUARD — prevent double-injection on dynamic page loads
  ───────────────────────────────────────────────────────── */
  if (document.getElementById('gitpal-ext-host')) return;

  /* ─────────────────────────────────────────────────────────
     CONSTANTS
  ───────────────────────────────────────────────────────── */
  const ORB_SIZE = 60;
  const PANEL_W  = 360;
  const PANEL_H  = 520;
  const MARGIN   = 16;
  const LS_X                = 'gitpal-orb-x';
  const LS_Y                = 'gitpal-orb-y';
  const LS_LIB              = 'gitpal-library';
  const MAX_PAGE_TEXT       = 12000; // characters cap for readFullPage()
  const MAX_LIBRARY_CARDS   = 60;    // max cards stored in localStorage
  const DUPLICATE_WINDOW_MS = 3600000; // 1 hour — prevent saving the same URL twice

  const SITE_ICONS = {
    twitter: '🐦', github: '🐙', reddit: '🟠', youtube: '▶️',
    linkedin: '💼', stackoverflow: '📚', blog: '✍️', web: '🌐',
  };
  const SITE_NAMES = {
    twitter: 'Twitter / X', github: 'GitHub', reddit: 'Reddit',
    youtube: 'YouTube', linkedin: 'LinkedIn', stackoverflow: 'Stack Overflow',
    blog: 'Blog', web: 'Web',
  };

  /* ─────────────────────────────────────────────────────────
     STOP WORDS (for topic extraction)
  ───────────────────────────────────────────────────────── */
  const STOP = new Set((
    'a an the and or but in on at to for of with by from is are was were be been ' +
    'have has had do does did will would could should may might must this that these ' +
    'those it its i you he she we they my your his her our their not no so as if ' +
    'then than when what which who how all each more also just like about can up out ' +
    'other into after before over through under while very much many some any same ' +
    'such now than too very into get got go going going been being here there when ' +
    'where why how again further then once only own same few both off against during ' +
    'because while although however therefore thus hence moreover furthermore'
  ).split(' '));

  /* ─────────────────────────────────────────────────────────
     AI RESPONSE DATA
  ───────────────────────────────────────────────────────── */
  const AI_RESPONSES = {
    default: [
      "I'm watching along with you! Ask me to 'look at this page' and I'll read everything here 👁",
      "I follow you everywhere on the internet. What's on your mind? 🥁",
      "I can read this page, extract topics, and build content cards for you 📚",
      "Try: '👁 Look at this page', '📚 Build a content card', or '🔬 What topics are here?'",
      "I'm your ambient AI — tell me to look, summarize, or build and I'll do it.",
    ],
    pin: [
      "I'd recommend pinning your most-starred repo first — it signals credibility to visitors.",
      "Want me to generate a pin order that tells a story about your skills?",
      "Pinning repos by language diversity shows versatility. Shall I arrange that?",
    ],
    move: [
      "Your next professional move: add a detailed README to your top project. It converts visitors to followers.",
      "Consider contributing to an open-source project in your stack — it signals community engagement.",
      "Deploying a live demo for your portfolio project could double your profile impact.",
    ],
    repos: [
      "You have activity across multiple repos. Want me to highlight the most impactful ones?",
      "Consistent contributors stand out to hiring managers.",
      "Your repos show great language diversity. Let me surface the best ones to pin.",
    ],
    help: [
      "I can: 👁 read any page · 📚 build content cards · 🔬 extract topics · 🧵 summarize discussions · 📌 suggest GitHub pins · 🚀 coach pro moves. Just ask!",
      "Ask me to 'look at this page' — I'll read every word visible right now. Or say 'build a card' to save this to your Library!",
    ],
    hello: [
      "Hey! 🥁 I'm Gitpal — your AI companion for the whole internet, not just GitHub. I read pages, build knowledge cards, and follow you everywhere. What shall we explore?",
      "Hello! I'm watching this page with you right now. Ask me to read it, extract topics, or build a content card for your Library!",
    ],
    twitter: [
      "I can see tweets on screen! Ask me to 'look at this page' for a full read of the conversation.",
      "Twitter activity spotted. Ask me to 'build a card' to save this discussion to your Library 📚",
      "Interesting discussions here — ask me to 'look at this page' and I'll summarize what I see!",
    ],
    github: [
      "Back on GitHub — I'm in my element! Ask me to 'observe this page' and I'll analyze what you're looking at.",
      "I see a GitHub page. Say 'build a card' to save this repo or issue to your Library.",
    ],
    reddit: [
      "Reddit posts detected! Ask me to 'look at this page' for a summary of what's here.",
      "Browsing Reddit? I can read the posts on screen — just ask me to observe!",
    ],
    youtube: [
      "Watching something? Ask me to 'look at this page' and I'll tell you what's playing!",
      "I can see you're on YouTube. Ask me to observe and I'll read the video and channel info.",
    ],
    linkedin: [
      "I see you're on LinkedIn. Ask me to 'read this page' and I'll tell you what I see.",
    ],
    stackoverflow: [
      "Stack Overflow — I can read the question and tags! Ask me to observe for the full picture.",
    ],
    web: [
      "I see you're browsing. Ask me to 'look at this page' and I'll read everything on it!",
      "New page detected. I'm watching along — just ask me to look or build a card 🥁",
    ],
  };

  const PINNED_SUGGESTIONS = [
    { icon: '📦', title: 'gitpal-core',     sub: 'TypeScript · ⭐ 142' },
    { icon: '🌐', title: 'personal-site',   sub: 'HTML/CSS · Deployed'  },
    { icon: '🤖', title: 'ml-experiments',  sub: 'Python · ⭐ 87'       },
    { icon: '🔧', title: 'devtools-config', sub: 'Shell · Utility'       },
    { icon: '📝', title: 'notes-app',       sub: 'React · Live demo'     },
    { icon: '🛸', title: 'quantum-ui',      sub: 'Vue · ⭐ 34'           },
  ];

  const PRO_MOVES = [
    { title: 'Pin your best 6 repos',       desc: 'Pinned repos are the first thing visitors see — make them count.',               tag: 'Visibility'      },
    { title: 'Add a profile README',         desc: 'A profile README dramatically increases engagement and sets you apart.',         tag: 'Branding'        },
    { title: 'Enable GitHub Pages',          desc: 'A live site linked from your profile is far more compelling than static code.',  tag: 'Deployment'      },
    { title: 'Contribute to open source',    desc: 'Even a small quality PR to a popular project puts you in front of thousands.',   tag: 'Community'       },
    { title: 'Keep your commit streak',      desc: 'A steady green contribution graph builds trust with recruiters.',                tag: 'Consistency'     },
    { title: 'Write descriptive READMEs',    desc: 'Keyword-rich descriptions help your repos surface in GitHub search.',            tag: 'Discoverability' },
  ];

  const QUICK_CHIPS = [
    '👁 Look at this page',
    '📚 Build a content card',
    '🔬 What topics are here?',
    '🚀 Give me a pro move',
  ];

  /* ─────────────────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────────────────── */
  let panelOpen      = false;
  let panelMinimized = false;
  let activeTab      = 'chat';
  let unreadCount    = 1;
  let orbX           = 0;
  let orbY           = 0;

  // drag state
  let isDragging    = false;
  let dragStartX    = 0;
  let dragStartY    = 0;
  let dragOrbStartX = 0;
  let dragOrbStartY = 0;
  let didDrag       = false;

  /* ─────────────────────────────────────────────────────────
     SHADOW DOM HOST
     Zero-size anchor at (0,0) so it never blocks page content.
     The orb + panel use position:fixed inside the shadow root
     and are positioned by JS.
  ───────────────────────────────────────────────────────── */
  const host = document.createElement('div');
  host.id = 'gitpal-ext-host';
  host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;';
  (document.documentElement || document.body).appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  /* ─────────────────────────────────────────────────────────
     STYLES
  ───────────────────────────────────────────────────────── */
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* Reset inside shadow */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Orb ────────────────────────────────────────────── */
    #gpOrb {
      position: fixed;
      z-index: 2;
      width: ${ORB_SIZE}px;
      height: ${ORB_SIZE}px;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      pointer-events: auto;
      transition: transform .15s ease;
    }
    #gpOrb:hover:not(.gp-dragging) { transform: scale(1.08); }
    #gpOrb.gp-dragging { cursor: grabbing; transform: scale(1.04); transition: none; }

    .gp-orb-inner {
      width: ${ORB_SIZE}px;
      height: ${ORB_SIZE}px;
      background: #161b22;
      border: 2px solid #f97316;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 24px rgba(249,115,22,.38), 0 4px 24px rgba(0,0,0,.6);
      font-size: 1.6rem;
      position: relative;
      pointer-events: none;
    }
    .gp-orb-pulse {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 2px solid #f97316;
      opacity: 0;
      pointer-events: none;
      animation: gpPulse 2.5s ease-out infinite;
    }
    @keyframes gpPulse {
      0%   { transform: scale(1);   opacity: .6; }
      100% { transform: scale(1.6); opacity: 0;  }
    }
    .gp-badge {
      position: absolute;
      top: -4px; right: -4px;
      width: 20px; height: 20px;
      background: #f97316;
      color: #fff;
      border-radius: 50%;
      font-size: .7rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 8px rgba(249,115,22,.45);
      pointer-events: none;
      font-family: system-ui, sans-serif;
    }
    .gp-badge.hidden { display: none; }

    /* ── Panel ──────────────────────────────────────────── */
    #gpPanel {
      position: fixed;
      z-index: 1;
      width: ${PANEL_W}px;
      height: ${PANEL_H}px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.72);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: scale(.92) translateY(10px);
      opacity: 0;
      pointer-events: none;
      transition: transform .2s cubic-bezier(.34,1.4,.64,1), opacity .18s;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      color: #e6edf3;
      line-height: 1.5;
    }
    #gpPanel.gp-open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }
    #gpPanel.gp-minimized { height: 52px; overflow: hidden; }

    /* Panel header */
    .gp-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: #21262d;
      border-bottom: 1px solid #30363d;
      flex-shrink: 0;
    }
    .gp-header-left { display: flex; align-items: center; gap: 10px; }
    .gp-header-icon { font-size: 1.3rem; }
    .gp-header-name { font-size: .88rem; font-weight: 700; color: #e6edf3; }
    .gp-header-status {
      font-size: .68rem;
      color: #8b949e;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 1px;
    }
    .gp-status-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 5px #34d399;
      animation: gpBlink 2s ease-in-out infinite;
      flex-shrink: 0;
    }
    @keyframes gpBlink { 0%,100%{opacity:1} 50%{opacity:.4} }
    .gp-header-actions { display: flex; gap: 4px; }
    .gp-icon-btn {
      background: transparent;
      color: #8b949e;
      border: none;
      width: 28px; height: 28px;
      border-radius: 6px;
      font-size: .82rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background .15s, color .15s;
      font-family: system-ui, sans-serif;
    }
    .gp-icon-btn:hover { background: #30363d; color: #e6edf3; }

    /* Tabs */
    .gp-tabs {
      display: flex;
      flex-shrink: 0;
      background: #21262d;
      border-bottom: 1px solid #30363d;
    }
    .gp-tab {
      flex: 1;
      padding: 8px 2px;
      font-size: .72rem;
      font-weight: 500;
      color: #8b949e;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: color .15s, border-color .15s;
      font-family: system-ui, sans-serif;
      white-space: nowrap;
    }
    .gp-tab:hover { color: #e6edf3; }
    .gp-tab--active { color: #f97316; border-bottom-color: #f97316; }

    /* Tab content */
    .gp-tab-content {
      display: none;
      flex-direction: column;
      flex: 1 1 auto;
      overflow: hidden;
      min-height: 0;
    }
    .gp-tab-content--active { display: flex; }

    /* Messages */
    .gp-messages {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scrollbar-width: thin;
      scrollbar-color: #30363d transparent;
      min-height: 0;
    }
    .gp-messages::-webkit-scrollbar { width: 4px; }
    .gp-messages::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }

    .gp-msg { display: flex; gap: 8px; align-items: flex-start; animation: gpMsgIn .18s ease; }
    @keyframes gpMsgIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .gp-msg-avatar {
      width: 26px; height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: .8rem;
      flex-shrink: 0;
    }
    .gp-msg--ai   .gp-msg-avatar { background: rgba(249,115,22,.15); border: 1px solid #f97316; }
    .gp-msg--user                 { flex-direction: row-reverse; }
    .gp-msg--user .gp-msg-avatar  { background: #21262d; border: 1px solid #484f58; color: #8b949e; }
    .gp-msg-bubble {
      max-width: 258px;
      padding: 9px 12px;
      border-radius: 12px;
      font-size: .8rem;
      line-height: 1.55;
    }
    .gp-msg--ai   .gp-msg-bubble {
      background: #21262d;
      border: 1px solid #30363d;
      color: #e6edf3;
      border-top-left-radius: 3px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .gp-msg--user .gp-msg-bubble {
      background: #f97316;
      color: #fff;
      border-top-right-radius: 3px;
    }
    .gp-msg-time { font-size: .64rem; color: #6e7681; margin-top: 3px; }

    /* Typing indicator */
    .gp-msg--typing .gp-msg-bubble {
      display: flex; gap: 4px; align-items: center; padding: 11px 13px;
    }
    .gp-typing-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #8b949e;
      animation: gpBounce 1.2s ease-in-out infinite;
    }
    .gp-typing-dot:nth-child(2) { animation-delay: .2s; }
    .gp-typing-dot:nth-child(3) { animation-delay: .4s; }
    @keyframes gpBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }

    /* Suggestion chips */
    .gp-suggestions {
      padding: 6px 14px 0;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      flex-shrink: 0;
    }
    .gp-chip {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: .72rem;
      background: #21262d;
      border: 1px solid #30363d;
      color: #8b949e;
      cursor: pointer;
      transition: background .15s, border-color .15s, color .15s;
      font-family: system-ui, sans-serif;
      white-space: nowrap;
    }
    .gp-chip:hover { background: rgba(249,115,22,.1); border-color: #f97316; color: #f97316; }

    /* Input row */
    .gp-input-row {
      display: flex;
      gap: 8px;
      padding: 10px 14px;
      border-top: 1px solid #30363d;
      flex-shrink: 0;
    }
    .gp-input {
      flex: 1;
      background: #21262d;
      border: 1px solid #30363d;
      border-radius: 8px;
      color: #e6edf3;
      font-size: .82rem;
      padding: 7px 11px;
      font-family: system-ui, sans-serif;
      transition: border-color .15s;
    }
    .gp-input:focus { border-color: #f97316; outline: none; }
    .gp-input::placeholder { color: #6e7681; }
    .gp-send-btn {
      width: 34px; height: 34px;
      background: #f97316;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background .15s;
    }
    .gp-send-btn:hover { background: #fb923c; }

    /* Pins tab */
    .gp-pins-list {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 7px;
      scrollbar-width: thin;
      scrollbar-color: #30363d transparent;
      min-height: 0;
    }
    .gp-pin-item {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 9px 11px;
      background: #21262d;
      border: 1px solid #30363d;
      border-radius: 8px;
      font-size: .8rem;
      cursor: pointer;
      transition: border-color .15s;
    }
    .gp-pin-item:hover { border-color: #f97316; }
    .gp-pin-item-icon { font-size: .95rem; flex-shrink: 0; }
    .gp-pin-item-title { font-weight: 600; font-size: .82rem; color: #e6edf3; }
    .gp-pin-item-sub { font-size: .7rem; color: #8b949e; }

    /* Shared full-width button used across tabs */
    .gp-full-btn {
      width: calc(100% - 28px);
      margin: 0 14px 12px;
      padding: 9px 0;
      background: #f97316;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: .83rem;
      font-weight: 600;
      font-family: system-ui, sans-serif;
      transition: background .15s;
      flex-shrink: 0;
    }
    .gp-full-btn:hover { background: #fb923c; }

    /* Moves tab */
    .gp-moves-list {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 9px;
      scrollbar-width: thin;
      scrollbar-color: #30363d transparent;
      min-height: 0;
    }
    .gp-move {
      padding: 11px 13px;
      background: #21262d;
      border: 1px solid #30363d;
      border-left: 3px solid #f97316;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      cursor: pointer;
      transition: background .15s;
    }
    .gp-move:hover { background: #30363d; }
    .gp-move-title { font-size: .82rem; font-weight: 700; color: #e6edf3; }
    .gp-move-desc  { font-size: .76rem; color: #8b949e; line-height: 1.5; }
    .gp-move-tag {
      align-self: flex-start;
      font-size: .65rem; font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(249,115,22,.12);
      color: #f97316;
      text-transform: uppercase;
      letter-spacing: .06em;
    }

    /* Library tab */
    .gp-lib-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      border-bottom: 1px solid #30363d;
      flex-shrink: 0;
    }
    .gp-lib-count { font-size: .72rem; color: #8b949e; }
    .gp-lib-clear {
      font-size: .7rem;
      color: #f87171;
      background: transparent;
      border: none;
      cursor: pointer;
      font-family: system-ui, sans-serif;
      padding: 2px 6px;
      border-radius: 4px;
      transition: background .15s;
    }
    .gp-lib-clear:hover { background: rgba(248,113,113,.1); }

    .gp-library-list {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scrollbar-width: thin;
      scrollbar-color: #30363d transparent;
      min-height: 0;
    }
    .gp-library-list::-webkit-scrollbar { width: 4px; }
    .gp-library-list::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }

    .gp-lib-empty {
      text-align: center;
      padding: 30px 16px;
      color: #6e7681;
      font-size: .79rem;
      line-height: 1.75;
    }
    .gp-lib-empty-icon { font-size: 2rem; display: block; margin-bottom: 8px; }

    .gp-card {
      background: #21262d;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 12px;
      animation: gpMsgIn .2s ease;
    }
    .gp-card:hover { border-color: #484f58; }
    .gp-card-header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 7px;
    }
    .gp-card-site-icon { font-size: .95rem; flex-shrink: 0; padding-top: 1px; }
    .gp-card-title {
      font-size: .78rem;
      font-weight: 700;
      color: #e6edf3;
      line-height: 1.4;
      flex: 1;
    }
    .gp-card-del {
      background: transparent;
      border: none;
      color: #6e7681;
      cursor: pointer;
      font-size: .75rem;
      padding: 0 2px;
      line-height: 1;
      transition: color .15s;
      font-family: system-ui, sans-serif;
      flex-shrink: 0;
    }
    .gp-card-del:hover { color: #f87171; }

    .gp-card-topics { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 7px; }
    .gp-topic-chip {
      font-size: .64rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(249,115,22,.12);
      color: #f97316;
      border: 1px solid rgba(249,115,22,.22);
      text-transform: capitalize;
    }
    .gp-card-summary {
      font-size: .75rem;
      color: #8b949e;
      line-height: 1.6;
    }
    .gp-card-meta {
      font-size: .64rem;
      color: #6e7681;
      margin-top: 7px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .gp-card-link {
      color: #f97316;
      text-decoration: none;
      font-size: .64rem;
    }
    .gp-card-link:hover { text-decoration: underline; }

    /* Toast */
    #gpToast {
      position: fixed;
      z-index: 3;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(16px);
      background: #21262d;
      border: 1px solid #484f58;
      border-radius: 8px;
      padding: 9px 18px;
      font-size: .79rem;
      color: #e6edf3;
      font-family: system-ui, sans-serif;
      box-shadow: 0 4px 24px rgba(0,0,0,.55);
      opacity: 0;
      pointer-events: none;
      transition: opacity .22s, transform .22s;
      white-space: nowrap;
    }
    #gpToast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  `;
  shadow.appendChild(styleEl);

  /* ─────────────────────────────────────────────────────────
     HTML TEMPLATE
  ───────────────────────────────────────────────────────── */
  const root = document.createElement('div');
  root.innerHTML = `
    <!-- Orb -->
    <div id="gpOrb" tabindex="0" role="button" aria-label="Open Gitpal AI">
      <div class="gp-orb-inner">
        <span>🥁</span>
        <span class="gp-orb-pulse"></span>
      </div>
      <div id="gpBadge" class="gp-badge">1</div>
    </div>

    <!-- Chat panel -->
    <div id="gpPanel" role="dialog" aria-label="Gitpal AI assistant" aria-hidden="true">

      <!-- Header -->
      <div class="gp-panel-header">
        <div class="gp-header-left">
          <span class="gp-header-icon">🥁</span>
          <div>
            <div class="gp-header-name">Gitpal</div>
            <div class="gp-header-status">
              <span class="gp-status-dot"></span> Ace the palace AI · active
            </div>
          </div>
        </div>
        <div class="gp-header-actions">
          <button id="gpMin"   class="gp-icon-btn" title="Minimize">─</button>
          <button id="gpClose" class="gp-icon-btn" title="Close">✕</button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="gp-tabs">
        <button class="gp-tab gp-tab--active" data-tab="chat">Chat</button>
        <button class="gp-tab" data-tab="pins">Pins</button>
        <button class="gp-tab" data-tab="moves">Moves</button>
        <button class="gp-tab" data-tab="library">📚 Library</button>
      </div>

      <!-- Chat tab -->
      <div class="gp-tab-content gp-tab-content--active" id="tab-chat">
        <div class="gp-messages"    id="gpMessages"></div>
        <div class="gp-suggestions" id="gpSuggestions"></div>
        <div class="gp-input-row">
          <input class="gp-input" id="gpInput" type="text"
                 placeholder="Ask Gitpal anything…" autocomplete="off" />
          <button class="gp-send-btn" id="gpSend" aria-label="Send">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Pins tab -->
      <div class="gp-tab-content" id="tab-pins">
        <div class="gp-pins-list" id="gpPinsList"></div>
        <button class="gp-full-btn" id="gpSuggestPin">Suggest a pin 🥁</button>
      </div>

      <!-- Moves tab -->
      <div class="gp-tab-content" id="tab-moves">
        <div class="gp-moves-list" id="gpMovesList"></div>
      </div>

      <!-- Library tab -->
      <div class="gp-tab-content" id="tab-library">
        <div class="gp-lib-toolbar">
          <span class="gp-lib-count" id="gpLibCount">0 cards</span>
          <button class="gp-lib-clear" id="gpLibClear">Clear all</button>
        </div>
        <div class="gp-library-list" id="gpLibraryList"></div>
        <button class="gp-full-btn" id="gpBuildCard">📚 Build Card for This Page</button>
      </div>

    </div>

    <!-- Toast -->
    <div id="gpToast" aria-live="polite"></div>
  `;
  shadow.appendChild(root);

  /* ─────────────────────────────────────────────────────────
     DOM REFS (inside shadow)
  ───────────────────────────────────────────────────────── */
  const orbEl      = shadow.getElementById('gpOrb');
  const panel      = shadow.getElementById('gpPanel');
  const closeBtn   = shadow.getElementById('gpClose');
  const minBtn     = shadow.getElementById('gpMin');
  const badge      = shadow.getElementById('gpBadge');
  const msgArea    = shadow.getElementById('gpMessages');
  const sugArea    = shadow.getElementById('gpSuggestions');
  const inputEl    = shadow.getElementById('gpInput');
  const sendBtn    = shadow.getElementById('gpSend');
  const pinsList   = shadow.getElementById('gpPinsList');
  const movesList  = shadow.getElementById('gpMovesList');
  const libList    = shadow.getElementById('gpLibraryList');
  const libCount   = shadow.getElementById('gpLibCount');
  const libClear   = shadow.getElementById('gpLibClear');
  const buildCard  = shadow.getElementById('gpBuildCard');
  const suggestPin = shadow.getElementById('gpSuggestPin');
  const toastEl    = shadow.getElementById('gpToast');
  const tabs       = shadow.querySelectorAll('.gp-tab');

  /* ─────────────────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────────────────── */
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  let toastTimer;
  function showToast(msg, duration) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration || 2800);
  }

  /* ─────────────────────────────────────────────────────────
     ORB POSITIONING
  ───────────────────────────────────────────────────────── */
  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function setOrbPosition(x, y) {
    orbX = clamp(x, MARGIN, window.innerWidth  - ORB_SIZE - MARGIN);
    orbY = clamp(y, MARGIN, window.innerHeight - ORB_SIZE - MARGIN);
    orbEl.style.left = orbX + 'px';
    orbEl.style.top  = orbY + 'px';
    try {
      localStorage.setItem(LS_X, orbX);
      localStorage.setItem(LS_Y, orbY);
    } catch (_) { /* storage may be blocked on some pages */ }
    if (panelOpen) positionPanel();
  }

  function positionPanel() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ph = Math.min(PANEL_H, vh - 2 * MARGIN);

    // Horizontal: try to align right edge with orb right edge; clamp to viewport
    let px = orbX + ORB_SIZE - PANEL_W;
    px = clamp(px, MARGIN, vw - PANEL_W - MARGIN);

    // Vertical: open above orb if there's more space above, else below
    const spaceAbove = orbY - MARGIN;
    const spaceBelow = vh - (orbY + ORB_SIZE) - MARGIN;
    let py;
    if (spaceAbove >= ph || spaceAbove >= spaceBelow) {
      py = orbY - ph - 10;
      py = Math.max(MARGIN, py);
    } else {
      py = orbY + ORB_SIZE + 10;
      py = Math.min(vh - ph - MARGIN, py);
    }

    panel.style.left   = px + 'px';
    panel.style.top    = py + 'px';
    panel.style.height = ph + 'px';
  }

  /* ─────────────────────────────────────────────────────────
     DRAG-TO-MOVE
     mousedown on orb → track movement on document → mouseup
  ───────────────────────────────────────────────────────── */
  function onOrbMouseDown(e) {
    if (e.button !== 0) return;
    isDragging = true;
    didDrag    = false;
    dragStartX    = e.clientX;
    dragStartY    = e.clientY;
    dragOrbStartX = orbX;
    dragOrbStartY = orbY;
    orbEl.classList.add('gp-dragging');
    e.preventDefault();
  }

  function onDocMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag = true;
    if (didDrag) setOrbPosition(dragOrbStartX + dx, dragOrbStartY + dy);
  }

  function onDocMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    orbEl.classList.remove('gp-dragging');
    if (!didDrag) togglePanel(); // click without drag → open/close
    didDrag = false;
  }

  // Touch equivalents for mobile
  function onOrbTouchStart(e) {
    const t = e.touches[0];
    isDragging    = true;
    didDrag       = false;
    dragStartX    = t.clientX;
    dragStartY    = t.clientY;
    dragOrbStartX = orbX;
    dragOrbStartY = orbY;
    orbEl.classList.add('gp-dragging');
  }

  function onDocTouchMove(e) {
    if (!isDragging) return;
    const t  = e.touches[0];
    const dx = t.clientX - dragStartX;
    const dy = t.clientY - dragStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag = true;
    if (didDrag) {
      setOrbPosition(dragOrbStartX + dx, dragOrbStartY + dy);
      e.preventDefault(); // prevent page scroll while dragging
    }
  }

  function onDocTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    orbEl.classList.remove('gp-dragging');
    if (!didDrag) togglePanel();
    didDrag = false;
  }

  /* ─────────────────────────────────────────────────────────
     PANEL OPEN / CLOSE / MINIMIZE
  ───────────────────────────────────────────────────────── */
  function openPanel() {
    panelOpen      = true;
    panelMinimized = false;
    positionPanel();
    panel.classList.add('gp-open');
    panel.classList.remove('gp-minimized');
    panel.setAttribute('aria-hidden', 'false');
    updateBadge();
    scrollToBottom();
    setTimeout(() => inputEl && inputEl.focus(), 220);
  }

  function closePanel() {
    panelOpen = false;
    panel.classList.remove('gp-open');
    panel.setAttribute('aria-hidden', 'true');
  }

  function minimizePanel() {
    panelMinimized = !panelMinimized;
    panel.classList.toggle('gp-minimized', panelMinimized);
  }

  function togglePanel() {
    if (panelOpen) closePanel(); else openPanel();
  }

  function updateBadge() {
    if (unreadCount > 0 && !panelOpen) {
      badge.textContent = unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
      unreadCount = 0;
    }
  }

  /* ─────────────────────────────────────────────────────────
     SITE DETECTION
  ───────────────────────────────────────────────────────── */
  function detectSite() {
    try {
      const h = location.hostname.replace(/^www\./, '');
      if (h === 'twitter.com' || h === 'x.com')            return 'twitter';
      if (h === 'github.com')                               return 'github';
      if (h === 'reddit.com'        || h.endsWith('.reddit.com'))        return 'reddit';
      if (h === 'youtube.com'       || h.endsWith('.youtube.com'))       return 'youtube';
      if (h === 'linkedin.com'      || h.endsWith('.linkedin.com'))      return 'linkedin';
      if (h === 'stackoverflow.com' || h.endsWith('.stackoverflow.com')) return 'stackoverflow';
      if (h === 'medium.com'        || h.endsWith('.medium.com') ||
          h === 'dev.to'            || h === 'hashnode.dev' ||
          h.endsWith('.hashnode.dev'))                       return 'blog';
    } catch (_) { /* */ }
    return 'web';
  }

  /* ─────────────────────────────────────────────────────────
     FULL PAGE READER
     Walks every text node in the visible DOM — like OCR but using
     the live DOM tree.  Capped at 12 000 characters.
  ───────────────────────────────────────────────────────── */
  const IGNORED_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK',
    'HEAD', 'TITLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED',
  ]);

  function readFullPage() {
    const fragments = [];
    let totalLength = 0;

    function walk(node) {
      if (totalLength >= MAX_PAGE_TEXT) return;

      if (node.nodeType === 3) { // text node
        const t = node.textContent.trim();
        if (t.length > 2) {
          fragments.push(t);
          totalLength += t.length + 1; // +1 for the space separator
        }
        return;
      }
      if (node.nodeType !== 1) return;
      if (IGNORED_TAGS.has(node.tagName)) return;

      // Skip elements hidden via inline style
      const s = node.style;
      if (s && (s.display === 'none' || s.visibility === 'hidden')) return;

      for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
    }

    try { walk(document.body || document.documentElement); } catch (_) { /* */ }
    return fragments.join(' ').replace(/\s+/g, ' ').trim().slice(0, MAX_PAGE_TEXT);
  }

  /* ─────────────────────────────────────────────────────────
     SITE-SPECIFIC STRUCTURED READERS
     Returns an array of human-readable observation strings.
  ───────────────────────────────────────────────────────── */
  function readStructuredContext(site) {
    const obs = [];
    try {
      switch (site) {
        case 'twitter': {
          const tweets = Array.from(document.querySelectorAll('[data-testid="tweetText"]'))
            .slice(0, 4).map(el => el.innerText.trim()).filter(Boolean);
          if (tweets.length)
            obs.push('Tweets on screen:\n' + tweets.map((t, i) =>
              `  ${i + 1}. "${t.slice(0, 130)}${t.length > 130 ? '…' : ''}"`).join('\n'));
          const profileName = document.querySelector('[data-testid="UserName"]')?.innerText?.trim();
          if (profileName) obs.push(`Profile in view: ${profileName}`);
          break;
        }
        case 'github': {
          const repoLink = document.querySelector('[itemprop="name"] a, strong[itemprop="name"] a');
          const repoName = repoLink?.innerText?.trim();
          if (repoName) {
            const owner = document.querySelector('[itemprop="author"] a')?.innerText?.trim() || '';
            obs.push(`Repository: ${owner ? owner + '/' : ''}${repoName}`);
          }
          const issueTitle = document.querySelector('.js-issue-title, .gh-header-title .f1-light')?.innerText?.trim();
          if (issueTitle) obs.push(`Issue / PR: "${issueTitle}"`);
          const filePath = document.querySelector('.final-path, .breadcrumb .final-path')?.innerText?.trim();
          if (filePath) obs.push(`Viewing file: ${filePath}`);
          break;
        }
        case 'youtube': {
          const videoTitle = document.querySelector(
            'h1.ytd-video-primary-info-renderer yt-formatted-string, ytd-watch-metadata h1'
          )?.innerText?.trim();
          if (videoTitle) obs.push(`Video: "${videoTitle.slice(0, 100)}"`);
          const channel = document.querySelector('#channel-name a, ytd-channel-name a')?.innerText?.trim();
          if (channel) obs.push(`Channel: ${channel}`);
          const current  = document.querySelector('.ytp-time-current')?.innerText;
          const duration = document.querySelector('.ytp-time-duration')?.innerText;
          if (current && duration) obs.push(`Progress: ${current} / ${duration}`);
          break;
        }
        case 'reddit': {
          const postTitle = document.querySelector(
            'h1[id^="post-title"], [data-adclicklocation="title"] h1, .Post h3'
          )?.innerText?.trim() || document.querySelector('h1')?.innerText?.trim();
          if (postTitle) obs.push(`Post: "${postTitle.slice(0, 100)}"`);
          const subreddit = document.querySelector('a[href^="/r/"]')?.innerText?.trim();
          if (subreddit) obs.push(`Subreddit: ${subreddit}`);
          break;
        }
        case 'linkedin': {
          const profileName = document.querySelector('.text-heading-xlarge, h1')?.innerText?.trim();
          if (profileName) obs.push(`LinkedIn profile: ${profileName}`);
          const headline = document.querySelector('.text-body-medium.break-words')?.innerText?.trim();
          if (headline) obs.push(`Headline: "${headline.slice(0, 100)}"`);
          break;
        }
        case 'stackoverflow': {
          const qTitle = document.querySelector('#question-header h1 a, .question-hyperlink')?.innerText?.trim();
          if (qTitle) obs.push(`Question: "${qTitle.slice(0, 100)}"`);
          const tags = Array.from(document.querySelectorAll('.post-tag'))
            .slice(0, 6).map(t => t.innerText?.trim()).filter(Boolean);
          if (tags.length) obs.push(`Tags: ${tags.join(', ')}`);
          break;
        }
        default: {
          const h1 = document.querySelector('h1')?.innerText?.trim();
          if (h1) obs.push(`Page heading: "${h1.slice(0, 100)}"`);
          const metaDesc = document.querySelector('meta[name="description"]')?.content?.trim();
          if (metaDesc) obs.push(`Page description: "${metaDesc.slice(0, 150)}"`);
        }
      }
    } catch (_) { /* */ }

    // Always append any user-selected text
    try {
      const sel = window.getSelection().toString().trim();
      if (sel.length > 3)
        obs.push(`You have selected: "${sel.slice(0, 200)}${sel.length > 200 ? '…' : ''}"`);
    } catch (_) { /* */ }

    return obs;
  }

  /* ─────────────────────────────────────────────────────────
     TOPIC EXTRACTOR
     Keyword frequency over the full-page text, stop-word filtered.
  ───────────────────────────────────────────────────────── */
  function extractTopics(text, topN) {
    topN = topN || 8;
    const words = text.toLowerCase().match(/\b[a-z][a-z-]{3,}\b/g) || [];
    const freq  = {};
    words.forEach(function(w) { if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1; });
    return Object.entries(freq)
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, topN)
      .map(function(pair) { return pair[0]; });
  }

  /* ─────────────────────────────────────────────────────────
     KEY SENTENCE EXTRACTOR
     Scores sentences by how many detected topics they contain.
  ───────────────────────────────────────────────────────── */
  function extractKeySentences(text, topics, n) {
    n = n || 4;
    const sentences = text.match(/[A-Z][^.!?]{10,200}[.!?]/g) || [];
    return sentences
      .map(function(s) {
        const lower = s.toLowerCase();
        return { s: s.trim(), score: topics.filter(function(t) { return lower.includes(t); }).length };
      })
      .filter(function(x) { return x.score > 0; })
      .sort(function(a, b) { return b.score - a.score; })
      .slice(0, n)
      .map(function(x) { return x.s; });
  }

  /* ─────────────────────────────────────────────────────────
     LIBRARY (localStorage)
  ───────────────────────────────────────────────────────── */
  function getLibrary() {
    try { return JSON.parse(localStorage.getItem(LS_LIB) || '[]'); }
    catch (_) { return []; }
  }

  function saveCardToLibrary(card) {
    const lib = getLibrary();
    // Skip if same URL was saved within the last hour
    const dupe = lib.find(function(c) {
      return c.url === card.url && (Date.now() - c.timestamp) < DUPLICATE_WINDOW_MS;
    });
    if (dupe) return false;
    lib.unshift(card);
    if (lib.length > MAX_LIBRARY_CARDS) lib.length = MAX_LIBRARY_CARDS;
    try { localStorage.setItem(LS_LIB, JSON.stringify(lib)); } catch (_) { /* */ }
    return true;
  }

  function deleteCardFromLibrary(id) {
    const lib = getLibrary().filter(function(c) { return c.id !== id; });
    try { localStorage.setItem(LS_LIB, JSON.stringify(lib)); } catch (_) { /* */ }
  }

  function clearAllLibrary() {
    try { localStorage.removeItem(LS_LIB); } catch (_) { /* */ }
  }

  /* ─────────────────────────────────────────────────────────
     CONTENT CARD BUILDER
     Reads the current page, extracts topics + key sentences,
     and returns a structured card object.
  ───────────────────────────────────────────────────────── */
  function buildContentCardObject() {
    const site         = detectSite();
    const title        = document.title || location.hostname;
    const url          = location.href;
    const fullText     = readFullPage();
    const topics       = extractTopics(fullText, 10);
    const keySentences = extractKeySentences(fullText, topics, 4);
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch (_) { /* */ }

    return {
      id:            Date.now(),
      site:          site,
      siteIcon:      SITE_ICONS[site]  || '🌐',
      siteName:      SITE_NAMES[site]  || 'Web',
      title:         title.slice(0, 80),
      url:           url,
      domain:        domain,
      topics:        topics,
      keySentences:  keySentences,
      timestamp:     Date.now(),
    };
  }

  /* ─────────────────────────────────────────────────────────
     AI FEATURE: HANDLE BUILD CARD
  ───────────────────────────────────────────────────────── */
  function handleBuildCard() {
    const card  = buildContentCardObject();
    const saved = saveCardToLibrary(card);

    const lines = [];
    lines.push(saved
      ? '📚 Content card built and saved to your Library!'
      : '📚 Card updated — already saved a card for this page recently.');
    lines.push('');
    lines.push(card.siteIcon + ' ' + card.siteName + ' — "' +
      card.title.slice(0, 55) + (card.title.length > 55 ? '…' : '') + '"');

    if (card.topics.length)
      lines.push('🔬 Topics: ' + card.topics.slice(0, 7).join(' · '));

    if (card.keySentences.length) {
      lines.push('');
      lines.push('Key insights I found:');
      card.keySentences.slice(0, 3).forEach(function(s) {
        lines.push('• ' + s.slice(0, 130) + (s.length > 130 ? '…' : ''));
      });
    } else {
      lines.push('');
      lines.push('I saved the page title, URL, and topics. Select some text and ask me to build another card for richer insights!');
    }

    lines.push('');
    lines.push('Open the 📚 Library tab to see all your saved research →');

    if (activeTab === 'library') renderLibrary();
    return lines.join('\n');
  }

  /* ─────────────────────────────────────────────────────────
     AI FEATURE: OBSERVE PAGE
  ───────────────────────────────────────────────────────── */
  function handleObservePage() {
    const site     = detectSite();
    const title    = document.title || '';
    const fullText = readFullPage();
    const topics   = extractTopics(fullText, 8);
    const obs      = readStructuredContext(site);
    const siteName = SITE_NAMES[site] || 'Web';

    const lines = [];
    lines.push('👁 I can see you\'re on ' + siteName + '.');
    lines.push('📄 "' + title.slice(0, 65) + (title.length > 65 ? '…' : '') + '"');

    if (topics.length)
      lines.push('🔬 Topics I detect: ' + topics.slice(0, 6).join(', '));

    if (obs.length) {
      lines.push('');
      obs.forEach(function(o) { lines.push(o); });
    } else if (fullText.length > 60) {
      const firstSentence = fullText.match(/[^.!?]{20,}[.!?]/)?.[0]?.trim();
      if (firstSentence)
        lines.push('First content I read: "' + firstSentence.slice(0, 160) + '"');
    } else {
      lines.push('');
      lines.push('Page content is minimal or dynamically loaded. Try scrolling down or selecting text!');
    }

    lines.push('');
    lines.push('Ask me to "build a card" to save this to your Library 📚');
    return lines.join('\n');
  }

  /* ─────────────────────────────────────────────────────────
     AI FEATURE: TOPICS QUERY
  ───────────────────────────────────────────────────────── */
  function handleTopicsQuery() {
    const fullText     = readFullPage();
    const topics       = extractTopics(fullText, 12);
    const keySentences = extractKeySentences(fullText, topics, 2);

    if (!topics.length)
      return '🔬 I couldn\'t find clear topics on this page. Try selecting some text and asking me!';

    const lines = ['🔬 Topics I found on this page:', ''];
    topics.forEach(function(t) { lines.push('  • ' + t); });

    if (keySentences.length) {
      lines.push('');
      lines.push('Most topic-dense sentence:');
      lines.push('"' + keySentences[0].slice(0, 200) + (keySentences[0].length > 200 ? '…' : '') + '"');
    }

    lines.push('');
    lines.push('Ask me to "build a card" to save this research to your Library 📚');
    return lines.join('\n');
  }

  /* ─────────────────────────────────────────────────────────
     AI RESPONSE ROUTING
  ───────────────────────────────────────────────────────── */
  function isIntent(text, patterns) {
    return patterns.some(function(p) { return text.includes(p); });
  }

  function getAIResponse(userText) {
    const t = userText.toLowerCase();

    // Feature intents — check these first
    if (isIntent(t, ['build', 'save', 'card', 'library', 'store', 'keep', 'remember', 'capture', 'record']))
      return handleBuildCard();

    if (isIntent(t, ['look', 'observe', 'read this', 'see this', 'what am i', 'what are you', "what's on",
                     'this page', 'current page', 'where am i', 'what site', 'what page', 'analyze',
                     'scan', 'watch me', 'follow me', 'what do you see']))
      return handleObservePage();

    if (isIntent(t, ['topic', 'keyword', 'subject', 'theme', 'what is this about', 'what about']))
      return handleTopicsQuery();

    // General intents
    if (isIntent(t, ['hello', 'hi ', 'hey']))    return pick(AI_RESPONSES.hello);
    if (t.includes('pin'))                        return pick(AI_RESPONSES.pin);
    if (isIntent(t, ['move', 'career', 'next']))  return pick(AI_RESPONSES.move);
    if (isIntent(t, ['repo', 'project']))         return pick(AI_RESPONSES.repos);
    if (isIntent(t, ['help', 'what can']))        return pick(AI_RESPONSES.help);

    // Site-contextual default
    const site = detectSite();
    if (AI_RESPONSES[site]) return pick(AI_RESPONSES[site]);

    return pick(AI_RESPONSES.default);
  }

  /* ─────────────────────────────────────────────────────────
     CHAT MESSAGES
  ───────────────────────────────────────────────────────── */
  function scrollToBottom() {
    if (msgArea) requestAnimationFrame(function() { msgArea.scrollTop = msgArea.scrollHeight; });
  }

  function addMessage(text, role) {
    if (!msgArea) return;
    const wrap = document.createElement('div');
    wrap.className = 'gp-msg gp-msg--' + role;

    const avatar = document.createElement('div');
    avatar.className = 'gp-msg-avatar';
    avatar.textContent = role === 'ai' ? '🥁' : '👤';

    const right = document.createElement('div');

    const bubble = document.createElement('div');
    bubble.className = 'gp-msg-bubble';
    // Use innerHTML with escaped content so \n renders as line-breaks
    bubble.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');

    const time = document.createElement('div');
    time.className = 'gp-msg-time';
    time.textContent = now();

    right.appendChild(bubble);
    right.appendChild(time);
    wrap.appendChild(avatar);
    wrap.appendChild(right);
    msgArea.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function showTyping() {
    if (!msgArea) return null;
    const wrap   = document.createElement('div');
    wrap.className = 'gp-msg gp-msg--ai gp-msg--typing';
    const avatar = document.createElement('div');
    avatar.className = 'gp-msg-avatar';
    avatar.textContent = '🥁';
    const bubble = document.createElement('div');
    bubble.className = 'gp-msg-bubble';
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('span');
      d.className = 'gp-typing-dot';
      bubble.appendChild(d);
    }
    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    msgArea.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function sendMessage(text) {
    if (!text || !text.trim()) return;
    const trimmed = text.trim();
    if (sugArea) sugArea.style.display = 'none';
    addMessage(trimmed, 'user');

    const typingEl = showTyping();
    // Slightly longer delay for page-reading responses so it feels like it's working
    const isHeavy = isIntent(trimmed.toLowerCase(), ['look', 'observe', 'build', 'topic', 'read']);
    const delay   = isHeavy ? 1200 + Math.random() * 500 : 800 + Math.random() * 500;

    setTimeout(function() {
      if (typingEl) typingEl.remove();
      addMessage(getAIResponse(trimmed), 'ai');
      if (!panelOpen) { unreadCount++; updateBadge(); }
    }, delay);
  }

  /* ─────────────────────────────────────────────────────────
     QUICK CHIPS
  ───────────────────────────────────────────────────────── */
  function renderChips() {
    if (!sugArea) return;
    sugArea.innerHTML = '';
    QUICK_CHIPS.forEach(function(chip) {
      const btn = document.createElement('button');
      btn.className = 'gp-chip';
      btn.textContent = chip;
      btn.addEventListener('click', function() {
        sendMessage(chip);
        if (inputEl) inputEl.value = '';
      });
      sugArea.appendChild(btn);
    });
  }

  /* ─────────────────────────────────────────────────────────
     WELCOME MESSAGE
  ───────────────────────────────────────────────────────── */
  function showWelcome() {
    const site     = detectSite();
    const siteName = SITE_NAMES[site] || 'the web';
    addMessage(
      'Hey! I\'m Gitpal 🥁 — your AI companion, now following you across the whole internet.\n\n' +
      'I can see you\'re on ' + siteName + '. I can:\n' +
      '👁 Read any page (like OCR — I see what you see)\n' +
      '📚 Build content cards and save them to your Library\n' +
      '🔬 Extract topics from anything you\'re reading\n' +
      '🧵 Summarize discussions as you browse\n\n' +
      'What shall we explore?',
      'ai'
    );
    renderChips();
  }

  /* ─────────────────────────────────────────────────────────
     PINS TAB
  ───────────────────────────────────────────────────────── */
  function renderPins() {
    if (!pinsList) return;
    pinsList.innerHTML = '';
    PINNED_SUGGESTIONS.forEach(function(pin) {
      const item = document.createElement('div');
      item.className = 'gp-pin-item';
      const icon  = document.createElement('span');
      icon.className = 'gp-pin-item-icon';
      icon.textContent = pin.icon;
      const body  = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'gp-pin-item-title';
      title.textContent = pin.title;
      const sub   = document.createElement('div');
      sub.className = 'gp-pin-item-sub';
      sub.textContent = pin.sub;
      body.appendChild(title);
      body.appendChild(sub);
      item.appendChild(icon);
      item.appendChild(body);
      item.addEventListener('click', function() { showToast('📌 "' + pin.title + '" added to pins'); });
      pinsList.appendChild(item);
    });
  }

  /* ─────────────────────────────────────────────────────────
     MOVES TAB
  ───────────────────────────────────────────────────────── */
  function renderMoves() {
    if (!movesList) return;
    movesList.innerHTML = '';
    PRO_MOVES.forEach(function(move) {
      const el = document.createElement('div');
      el.className = 'gp-move';
      const titleEl = document.createElement('div');
      titleEl.className = 'gp-move-title';
      titleEl.textContent = move.title;
      const descEl = document.createElement('div');
      descEl.className = 'gp-move-desc';
      descEl.textContent = move.desc;
      const tagEl = document.createElement('span');
      tagEl.className = 'gp-move-tag';
      tagEl.textContent = move.tag;
      el.appendChild(titleEl);
      el.appendChild(descEl);
      el.appendChild(tagEl);
      el.addEventListener('click', function() {
        switchTab('chat');
        if (!panelOpen) openPanel();
        sendMessage(move.title);
      });
      movesList.appendChild(el);
    });
  }

  /* ─────────────────────────────────────────────────────────
     LIBRARY TAB
  ───────────────────────────────────────────────────────── */
  function renderLibrary() {
    if (!libList) return;
    const lib = getLibrary();

    if (libCount) libCount.textContent = lib.length + ' card' + (lib.length !== 1 ? 's' : '');
    libList.innerHTML = '';

    if (!lib.length) {
      const empty = document.createElement('div');
      empty.className = 'gp-lib-empty';
      empty.innerHTML =
        '<span class="gp-lib-empty-icon">📚</span>' +
        'Your Library is empty.<br>' +
        'Browse any site and say<br>' +
        '<strong>"📚 Build a content card"</strong><br>' +
        'to start saving your research.';
      libList.appendChild(empty);
      return;
    }

    lib.forEach(function(card) {
      const el = document.createElement('div');
      el.className = 'gp-card';

      // Header row: icon + title + delete button
      const header = document.createElement('div');
      header.className = 'gp-card-header';

      const icon = document.createElement('span');
      icon.className = 'gp-card-site-icon';
      icon.textContent = card.siteIcon || '🌐';

      const titleEl = document.createElement('div');
      titleEl.className = 'gp-card-title';
      titleEl.textContent = card.title;

      const delBtn = document.createElement('button');
      delBtn.className = 'gp-card-del';
      delBtn.textContent = '✕';
      delBtn.title = 'Remove card';
      delBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteCardFromLibrary(card.id);
        renderLibrary();
      });

      header.appendChild(icon);
      header.appendChild(titleEl);
      header.appendChild(delBtn);
      el.appendChild(header);

      // Topic chips
      if (card.topics && card.topics.length) {
        const topicsRow = document.createElement('div');
        topicsRow.className = 'gp-card-topics';
        card.topics.slice(0, 6).forEach(function(t) {
          const chip = document.createElement('span');
          chip.className = 'gp-topic-chip';
          chip.textContent = t;
          topicsRow.appendChild(chip);
        });
        el.appendChild(topicsRow);
      }

      // Summary (key sentences joined)
      if (card.keySentences && card.keySentences.length) {
        const summary = document.createElement('div');
        summary.className = 'gp-card-summary';
        summary.textContent = card.keySentences[0].slice(0, 160) +
          (card.keySentences[0].length > 160 ? '…' : '');
        el.appendChild(summary);
      }

      // Meta row: domain, date, link
      const meta = document.createElement('div');
      meta.className = 'gp-card-meta';
      const domain = document.createElement('span');
      domain.textContent = card.domain || card.siteName || '';
      const date = document.createElement('span');
      date.textContent = card.timestamp
        ? new Date(card.timestamp).toLocaleDateString()
        : '';
      const link = document.createElement('a');
      link.className  = 'gp-card-link';
      link.textContent = 'Open ↗';
      link.href       = card.url;
      link.target     = '_blank';
      link.rel        = 'noopener noreferrer';
      meta.appendChild(domain);
      meta.appendChild(date);
      meta.appendChild(link);
      el.appendChild(meta);

      libList.appendChild(el);
    });
  }

  /* ─────────────────────────────────────────────────────────
     TAB SWITCHING
  ───────────────────────────────────────────────────────── */
  function switchTab(name) {
    activeTab = name;
    tabs.forEach(function(t) {
      t.classList.toggle('gp-tab--active', t.dataset.tab === name);
    });
    shadow.querySelectorAll('.gp-tab-content').forEach(function(c) {
      c.classList.toggle('gp-tab-content--active', c.id === 'tab-' + name);
    });
    if (name === 'chat')    scrollToBottom();
    if (name === 'library') renderLibrary();
  }

  /* ─────────────────────────────────────────────────────────
     EVENT LISTENERS
  ───────────────────────────────────────────────────────── */
  orbEl.addEventListener('mousedown', onOrbMouseDown);
  orbEl.addEventListener('touchstart', onOrbTouchStart, { passive: true });
  orbEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanel(); }
  });

  // Drag tracking on host document (handles fast mouse movement outside the orb)
  document.addEventListener('mousemove', onDocMouseMove);
  document.addEventListener('mouseup',   onDocMouseUp);
  document.addEventListener('touchmove', onDocTouchMove, { passive: false });
  document.addEventListener('touchend',  onDocTouchEnd);

  if (closeBtn)   closeBtn.addEventListener('click',   closePanel);
  if (minBtn)     minBtn.addEventListener('click',     minimizePanel);

  if (sendBtn) {
    sendBtn.addEventListener('click', function() {
      if (!inputEl) return;
      sendMessage(inputEl.value);
      inputEl.value = '';
    });
  }

  if (inputEl) {
    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(inputEl.value);
        inputEl.value = '';
      }
    });
  }

  tabs.forEach(function(t) {
    t.addEventListener('click', function() { switchTab(t.dataset.tab); });
  });

  if (suggestPin) {
    suggestPin.addEventListener('click', function() {
      switchTab('chat');
      sendMessage('What should I pin?');
    });
  }

  if (buildCard) {
    buildCard.addEventListener('click', function() {
      switchTab('chat');
      sendMessage('📚 Build a content card');
    });
  }

  if (libClear) {
    libClear.addEventListener('click', function() {
      clearAllLibrary();
      renderLibrary();
      showToast('Library cleared');
    });
  }

  // Window resize: re-clamp orb + re-position panel
  window.addEventListener('resize', function() {
    setOrbPosition(orbX, orbY);
  });

  /* ─────────────────────────────────────────────────────────
     EXTENSION MESSAGE LISTENER (from popup.js)
  ───────────────────────────────────────────────────────── */
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function(msg) {
      if (!msg || !msg.action) return;
      switch (msg.action) {
        case 'openPanel':
          openPanel();
          break;
        case 'buildCard':
          openPanel();
          switchTab('chat');
          sendMessage('📚 Build a content card');
          break;
        case 'observe':
          openPanel();
          switchTab('chat');
          sendMessage('👁 Look at this page');
          break;
      }
    });
  }

  /* ─────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────── */
  function init() {
    // Restore saved orb position or default to bottom-right corner
    let savedX = null, savedY = null;
    try {
      savedX = parseInt(localStorage.getItem(LS_X), 10);
      savedY = parseInt(localStorage.getItem(LS_Y), 10);
    } catch (_) { /* */ }

    if (savedX && savedY && !isNaN(savedX) && !isNaN(savedY)) {
      setOrbPosition(savedX, savedY);
    } else {
      setOrbPosition(
        window.innerWidth  - ORB_SIZE - MARGIN,
        window.innerHeight - ORB_SIZE - MARGIN
      );
    }

    showWelcome();
    renderPins();
    renderMoves();
    renderLibrary();
    updateBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
