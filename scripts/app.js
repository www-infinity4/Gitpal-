/**
 * app.js
 * Main Gitpal application logic.
 * Handles: navigation CTA buttons, AI suite card actions,
 * pins grid, and misc UI interactions.
 */

(function () {
  'use strict';

  /* ──────────────────────────────────────────
     Pinned repos data (demo set)
  ────────────────────────────────────────── */

  const DEMO_PINS = [
    {
      icon: "📦",
      type: "Repository",
      title: "gitpal-core",
      desc: "Core AI orchestration engine for the Gitpal assistant suite.",
      lang: "TypeScript",
      langColor: "#3178c6",
      stars: "142",
    },
    {
      icon: "🌐",
      type: "Site",
      title: "personal-portfolio",
      desc: "Deployed portfolio with live project demos and case studies.",
      lang: "HTML/CSS",
      langColor: "#e34c26",
      stars: "28",
    },
    {
      icon: "🤖",
      type: "Repository",
      title: "ml-experiments",
      desc: "Machine learning research repo — NLP, embeddings, and fine-tuning.",
      lang: "Python",
      langColor: "#3572A5",
      stars: "87",
    },
    {
      icon: "🔧",
      type: "Config",
      title: "devtools-config",
      desc: "Shareable ESLint, Prettier, and tsconfig presets.",
      lang: "Shell",
      langColor: "#89e051",
      stars: "19",
    },
    {
      icon: "🛸",
      type: "Library",
      title: "quantum-ui",
      desc: "Component library with dark-mode-first design tokens.",
      lang: "Vue",
      langColor: "#41b883",
      stars: "34",
    },
    {
      icon: "📝",
      type: "Project",
      title: "notes-app",
      desc: "Minimal note-taking app with real-time sync and markdown support.",
      lang: "React",
      langColor: "#61dafb",
      stars: "56",
    },
  ];

  /* ──────────────────────────────────────────
     Render pins grid
  ────────────────────────────────────────── */

  function renderPinsGrid() {
    const grid = document.getElementById('pinsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    DEMO_PINS.forEach(pin => {
      const card = document.createElement('div');
      card.className = 'pin-card';
      card.setAttribute('role', 'article');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', pin.title);

      card.innerHTML = `
        <div class="pin-card-header">
          <span class="pin-icon">${pin.icon}</span>
          <span class="pin-type">${pin.type}</span>
        </div>
        <div class="pin-title">${pin.title}</div>
        <div class="pin-desc">${pin.desc}</div>
        <div class="pin-meta">
          <span class="pin-lang">
            <span class="pin-lang-dot" style="background:${pin.langColor}"></span>
            ${pin.lang}
          </span>
          <span class="pin-stars">⭐ ${pin.stars}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        if (window.GitpalOrb) {
          window.GitpalOrb.open();
          window.GitpalOrb.sendMessage('Tell me more about ' + pin.title);
        }
      });

      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });

      grid.appendChild(card);
    });
  }

  /* ──────────────────────────────────────────
     Button wire-ups
  ────────────────────────────────────────── */

  function wireButtons() {
    // Nav "Open Gitpal" button
    const openGitpalBtn = document.getElementById('openGitpalBtn');
    if (openGitpalBtn) {
      openGitpalBtn.addEventListener('click', () => {
        if (window.GitpalOrb) window.GitpalOrb.open();
      });
    }

    // Nav "Connect GitHub" button
    const connectGithubBtn = document.getElementById('connectGithubBtn');
    if (connectGithubBtn) {
      connectGithubBtn.addEventListener('click', () => {
        if (window.GitpalOrb) {
          window.GitpalOrb.open();
          window.GitpalOrb.sendMessage('Connect my GitHub account');
        }
      });
    }

    // Hero CTA "Start a conversation"
    const heroChatBtn = document.getElementById('heroChatBtn');
    if (heroChatBtn) {
      heroChatBtn.addEventListener('click', () => {
        if (window.GitpalOrb) window.GitpalOrb.open();
      });
    }

    // Hero "Explore the suite →"
    const heroLearnBtn = document.getElementById('heroLearnBtn');
    if (heroLearnBtn) {
      heroLearnBtn.addEventListener('click', () => {
        const aisSection = document.getElementById('ais');
        if (aisSection) aisSection.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // AI card buttons
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'launch-gitpal') {
          if (window.GitpalOrb) window.GitpalOrb.open();
        } else if (action === 'coming-soon') {
          const aiName = btn.closest('[data-ai]')?.dataset.ai;
          const names  = { gitpub: 'Gitpub 📡', gitpro: 'Gitpro 🛸', gitpin: 'Gitpin △' };
          const label  = names[aiName] || 'This AI';
          if (window.GitpalOrb) window.GitpalOrb.toast(`${label} is coming soon — stay tuned!`);
        }
      });
    });

    // "Add pin via Gitpal" button
    const addPinBtn = document.getElementById('addPinBtn');
    if (addPinBtn) {
      addPinBtn.addEventListener('click', () => {
        if (window.GitpalOrb) {
          window.GitpalOrb.open();
          window.GitpalOrb.sendMessage('What should I pin next?');
        }
      });
    }
  }

  /* ──────────────────────────────────────────
     Ecosystem node hover
  ────────────────────────────────────────── */

  function wireEcoNodes() {
    document.querySelectorAll('.eco-node').forEach(node => {
      node.addEventListener('mouseenter', () => {
        const name = node.getAttribute('title') || 'Node';
        node.setAttribute('title', name);
      });
    });
  }

  /* ──────────────────────────────────────────
     Active nav highlight on scroll
  ────────────────────────────────────────── */

  function wireScrollSpy() {
    const sections = ['dashboard', 'ais', 'pins', 'about'];
    const navLinks  = document.querySelectorAll('.nav-links a');

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach(link => {
              link.style.color = link.getAttribute('href') === '#' + id
                ? 'var(--text)'
                : '';
            });
          }
        });
      },
      { rootMargin: '-40% 0px -50% 0px' }
    );

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  /* ──────────────────────────────────────────
     Ecosystem pill click → scroll to AI section
  ────────────────────────────────────────── */

  function wireEcoPills() {
    document.querySelectorAll('.ecosystem-pills .pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const aisSection = document.getElementById('ais');
        if (aisSection) aisSection.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  /* ──────────────────────────────────────────
     Init
  ────────────────────────────────────────── */

  function init() {
    renderPinsGrid();
    wireButtons();
    wireEcoNodes();
    wireScrollSpy();
    wireEcoPills();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
