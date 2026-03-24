/**
 * gitpal.js
 * Core logic for the Gitpal 🥁 floating orb AI assistant.
 * Handles: orb toggle, chat messages, pin suggestions, pro moves.
 */

(function () {
  'use strict';

  /* ──────────────────────────────────────────
     Data: AI responses, pins, moves
  ────────────────────────────────────────── */

  const AI_RESPONSES = {
    default: [
      "Great question! Let me pull that up for you 🥁",
      "I spotted something interesting in your repos — want me to surface it?",
      "Based on your GitHub activity, here's what I'd recommend next…",
      "You're making solid moves! Want me to suggest what to pin for visibility?",
      "I've analyzed your recent commits. Your most active repo is gaining traction 🚀",
      "Pro tip: pinning your top 3 projects dramatically boosts profile visits.",
      "I see you've been working on a lot of interesting stuff lately. Want a summary?",
      "Your README could use a polish — want Gitpro to help refine it?",
    ],

    pin: [
      "I'd recommend pinning your most-starred repo first — it signals credibility to visitors.",
      "Want me to generate a pin order that tells a story about your skills?",
      "Pinning repos by language diversity shows versatility. Shall I arrange that?",
    ],

    move: [
      "Your next professional move: add a detailed README to your top project. It converts visitors to followers.",
      "Have you considered contributing to an open-source project in your stack? It signals community engagement.",
      "Deploying a live demo for your portfolio project could double your profile impact.",
      "Filling in your GitHub bio with keywords your target employers search for is a power move.",
    ],

    repos: [
      "You have activity across multiple repos. Want me to highlight the most impactful ones?",
      "Looks like you push code frequently — consistent contributors stand out to hiring managers.",
      "Your repos show great language diversity. Let me surface the best ones to pin.",
    ],

    help: [
      "I can help you: ① suggest what to pin, ② coach pro moves, ③ review your repo descriptions, or ④ track your GitHub growth.",
      "Ask me about your repos, pinning strategy, or what your next career move should be!",
    ],

    hello: [
      "Hey there! 🥁 I'm Gitpal — Ace the palace AI. I'm here to help you make the most of your GitHub profile!",
      "Hello! Ready to help you level up your GitHub game. What shall we tackle first?",
    ],
  };

  const PINNED_SUGGESTIONS = [
    { icon: "📦", title: "gitpal-core",       sub: "TypeScript · ⭐ 142",   type: "repo"    },
    { icon: "🌐", title: "personal-site",     sub: "HTML/CSS · Deployed",    type: "site"    },
    { icon: "🤖", title: "ml-experiments",    sub: "Python · ⭐ 87",         type: "repo"    },
    { icon: "🔧", title: "devtools-config",   sub: "Shell · Utility",        type: "config"  },
    { icon: "📝", title: "notes-app",         sub: "React · Live demo",      type: "project" },
    { icon: "🛸", title: "quantum-ui",        sub: "Vue · ⭐ 34",            type: "lib"     },
  ];

  const PRO_MOVES = [
    {
      title:  "Pin your best 6 repos",
      desc:   "Visitors spend an average of 8 seconds on a profile. Pinned repos are the first thing they see — make them count.",
      tag:    "Visibility",
    },
    {
      title:  "Add a profile README",
      desc:   "A profile README can include stats, current projects, and a personal message. It dramatically increases engagement.",
      tag:    "Branding",
    },
    {
      title:  "Enable GitHub Pages on portfolio repo",
      desc:   "A live site linked from your profile is far more compelling than a static code repo. Gitpub can help deploy it.",
      tag:    "Deployment",
    },
    {
      title:  "Contribute to a trending open-source repo",
      desc:   "Even a small, quality PR to a popular project puts your profile in front of thousands of developers.",
      tag:    "Community",
    },
    {
      title:  "Keep your commit streak alive",
      desc:   "Consistency is visible. A steady green contribution graph builds trust with recruiters and collaborators.",
      tag:    "Consistency",
    },
    {
      title:  "Write descriptive repo descriptions",
      desc:   "Short, keyword-rich descriptions help your repos appear in GitHub search results and surface via Gitpin.",
      tag:    "Discoverability",
    },
  ];

  const QUICK_CHIPS = [
    "What should I pin?",
    "Give me a pro move",
    "Review my repos",
    "Help me get noticed",
  ];

  /* ──────────────────────────────────────────
     State
  ────────────────────────────────────────── */
  let panelOpen     = false;
  let panelMinimized = false;
  let activeTab     = 'chat';
  let msgCount      = 0;
  let unreadCount   = 1;

  /* ──────────────────────────────────────────
     DOM refs
  ────────────────────────────────────────── */
  const orb       = document.getElementById('gitpalOrb');
  const panel     = document.getElementById('gitpalPanel');
  const closeBtn  = document.getElementById('closePanel');
  const minBtn    = document.getElementById('minimizePanel');
  const badge     = document.getElementById('orbBadge');
  const msgArea   = document.getElementById('gpMessages');
  const sugArea   = document.getElementById('gpSuggestions');
  const input     = document.getElementById('gpInput');
  const sendBtn   = document.getElementById('gpSendBtn');
  const pinsList  = document.getElementById('gpPinsList');
  const movesList = document.getElementById('gpMovesList');
  const tabs      = document.querySelectorAll('.gp-tab');
  const suggestPinBtn = document.getElementById('suggestPinBtn');

  /* ──────────────────────────────────────────
     Helpers
  ────────────────────────────────────────── */

  function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
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

  function showToast(msg, duration = 2800) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('toast-show');
    setTimeout(() => toast.classList.remove('toast-show'), duration);
  }

  /* ──────────────────────────────────────────
     Panel open / close / minimise
  ────────────────────────────────────────── */

  function openPanel() {
    panelOpen = true;
    panelMinimized = false;
    panel.classList.add('panel-open');
    panel.classList.remove('panel-minimized');
    panel.setAttribute('aria-hidden', 'false');
    updateBadge();
    scrollToBottom();
    // Set focus on input for accessibility
    setTimeout(() => input && input.focus(), 250);
  }

  function closePanel() {
    panelOpen = false;
    panel.classList.remove('panel-open');
    panel.setAttribute('aria-hidden', 'true');
  }

  function minimizePanel() {
    if (panelMinimized) {
      panelMinimized = false;
      panel.classList.remove('panel-minimized');
    } else {
      panelMinimized = true;
      panel.classList.add('panel-minimized');
    }
  }

  function togglePanel() {
    if (panelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  /* ──────────────────────────────────────────
     Chat messages
  ────────────────────────────────────────── */

  function scrollToBottom() {
    if (msgArea) {
      requestAnimationFrame(() => { msgArea.scrollTop = msgArea.scrollHeight; });
    }
  }

  function addMessage(text, role) {
    if (!msgArea) return;
    msgCount++;
    const wrap = document.createElement('div');
    wrap.className = 'gp-msg gp-msg--' + role;

    const avatar = document.createElement('div');
    avatar.className = 'gp-msg-avatar';
    avatar.textContent = role === 'ai' ? '🥁' : '👤';

    const right = document.createElement('div');

    const bubble = document.createElement('div');
    bubble.className = 'gp-msg-bubble';
    bubble.textContent = text;

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
    const wrap = document.createElement('div');
    wrap.className = 'gp-msg gp-msg--ai gp-msg--typing';
    const avatar = document.createElement('div');
    avatar.className = 'gp-msg-avatar';
    avatar.textContent = '🥁';
    const bubble = document.createElement('div');
    bubble.className = 'gp-msg-bubble';
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('span');
      d.className = 'typing-dot';
      bubble.appendChild(d);
    }
    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    msgArea.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function getAIResponse(userText) {
    const t = userText.toLowerCase();
    if (t.includes('hello') || t.includes('hi') || t.includes('hey'))      return pick(AI_RESPONSES.hello);
    if (t.includes('pin'))                                                  return pick(AI_RESPONSES.pin);
    if (t.includes('move') || t.includes('career') || t.includes('next'))  return pick(AI_RESPONSES.move);
    if (t.includes('repo') || t.includes('project'))                       return pick(AI_RESPONSES.repos);
    if (t.includes('help') || t.includes('what can'))                      return pick(AI_RESPONSES.help);
    return pick(AI_RESPONSES.default);
  }

  function sendMessage(text) {
    if (!text || !text.trim()) return;
    const trimmed = text.trim();

    // Hide suggestion chips after first user message
    if (sugArea) sugArea.style.display = 'none';

    addMessage(trimmed, 'user');

    const typingEl = showTyping();
    const delay = 900 + Math.random() * 600;

    setTimeout(() => {
      if (typingEl) typingEl.remove();
      addMessage(getAIResponse(trimmed), 'ai');
      if (!panelOpen) {
        unreadCount++;
        updateBadge();
      }
    }, delay);
  }

  /* ──────────────────────────────────────────
     Quick suggestion chips
  ────────────────────────────────────────── */

  function renderChips() {
    if (!sugArea) return;
    sugArea.innerHTML = '';
    QUICK_CHIPS.forEach(chip => {
      const btn = document.createElement('button');
      btn.className = 'gp-chip';
      btn.textContent = chip;
      btn.addEventListener('click', () => {
        if (input) input.value = chip;
        sendMessage(chip);
        if (input) input.value = '';
      });
      sugArea.appendChild(btn);
    });
  }

  /* ──────────────────────────────────────────
     Welcome message
  ────────────────────────────────────────── */

  function showWelcome() {
    addMessage(
      "Hey! I'm Gitpal 🥁 — your AI companion for GitHub. I can suggest what to pin, coach your next professional move, and keep you in flow. What's on your mind?",
      'ai'
    );
    renderChips();
  }

  /* ──────────────────────────────────────────
     Pins tab
  ────────────────────────────────────────── */

  function renderPins() {
    if (!pinsList) return;
    pinsList.innerHTML = '';
    PINNED_SUGGESTIONS.forEach(pin => {
      const item = document.createElement('div');
      item.className = 'gp-pin-item';
      item.innerHTML = `
        <span class="gp-pin-item-icon">${pin.icon}</span>
        <div class="gp-pin-item-body">
          <div class="gp-pin-item-title">${pin.title}</div>
          <div class="gp-pin-item-sub">${pin.sub}</div>
        </div>
      `;
      item.addEventListener('click', () => showToast(`📌 "${pin.title}" added to pins`));
      pinsList.appendChild(item);
    });
  }

  /* ──────────────────────────────────────────
     Pro Moves tab
  ────────────────────────────────────────── */

  function renderMoves() {
    if (!movesList) return;
    movesList.innerHTML = '';
    PRO_MOVES.forEach(move => {
      const el = document.createElement('div');
      el.className = 'gp-move';
      el.innerHTML = `
        <div class="gp-move-title">${move.title}</div>
        <div class="gp-move-desc">${move.desc}</div>
        <span class="gp-move-tag">${move.tag}</span>
      `;
      el.addEventListener('click', () => {
        // Carry the move into the chat as a user message
        switchTab('chat');
        if (!panelOpen) openPanel();
        sendMessage(move.title);
      });
      movesList.appendChild(el);
    });
  }

  /* ──────────────────────────────────────────
     Tab switching
  ────────────────────────────────────────── */

  function switchTab(name) {
    activeTab = name;
    tabs.forEach(t => {
      t.classList.toggle('gp-tab--active', t.dataset.tab === name);
    });
    document.querySelectorAll('.gp-tab-content').forEach(c => {
      c.classList.toggle('gp-tab-content--active', c.id === 'tab-' + name);
    });
    if (name === 'chat') scrollToBottom();
  }

  /* ──────────────────────────────────────────
     Event listeners
  ────────────────────────────────────────── */

  if (orb) {
    orb.addEventListener('click', togglePanel);
    // Keyboard support
    orb.setAttribute('tabindex', '0');
    orb.setAttribute('role', 'button');
    orb.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanel(); }
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closePanel);
  if (minBtn)   minBtn.addEventListener('click', minimizePanel);

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (!input) return;
      sendMessage(input.value);
      input.value = '';
    });
  }

  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input.value);
        input.value = '';
      }
    });
  }

  if (tabs) {
    tabs.forEach(t => {
      t.addEventListener('click', () => switchTab(t.dataset.tab));
    });
  }

  if (suggestPinBtn) {
    suggestPinBtn.addEventListener('click', () => {
      switchTab('chat');
      sendMessage("What should I pin?");
    });
  }

  /* Hero orb click → open panel */
  const heroOrbCore = document.getElementById('orbCore');
  const heroOrbShowcase = document.getElementById('orbShowcase');
  [heroOrbCore, heroOrbShowcase].forEach(el => {
    if (el) el.addEventListener('click', () => { openPanel(); });
  });

  /* ──────────────────────────────────────────
     Initialise
  ────────────────────────────────────────── */

  function init() {
    showWelcome();
    renderPins();
    renderMoves();
    updateBadge();
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Expose a minimal public API for app.js to use */
  window.GitpalOrb = { open: openPanel, close: closePanel, toast: showToast, sendMessage };

})();
