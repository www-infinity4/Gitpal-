/**
 * popup.js
 * Gitpal extension popup logic.
 * Sends action messages to the active tab's content script.
 */

async function sendToTab(action, payload) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    // chrome:// and edge:// pages don't support content scripts
    if (!tab.url || /^(chrome|edge|about|chrome-extension):/.test(tab.url)) {
      showError('Gitpal cannot run on browser internal pages.');
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action, ...payload }, function() {
      if (chrome.runtime.lastError) {
        // Content script not yet loaded — common on first install or if page
        // was already open before the extension was installed.
        showError('Reload the page and try again (Ctrl+R / Cmd+R).');
      }
    });
  } catch (err) {
    showError('Could not connect to this page.');
    console.warn('[Gitpal popup]', err);
  }
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

document.getElementById('openChatBtn').addEventListener('click', async () => {
  await sendToTab('openPanel');
  window.close();
});

document.getElementById('buildCardBtn').addEventListener('click', async () => {
  await sendToTab('buildCard');
  window.close();
});

document.getElementById('observeBtn').addEventListener('click', async () => {
  await sendToTab('observe');
  window.close();
});
