/**
 * background.js
 * Gitpal extension service worker.
 * Handles install events and relays messages between popup and content scripts.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Gitpal] Installed — your AI companion is active everywhere!');
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'ping') {
    sendResponse({ status: 'alive' });
  }
});
