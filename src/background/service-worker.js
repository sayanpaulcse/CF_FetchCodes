// background.js — Service Worker for CF FetchCodes

/**
 * Helper: Create the context menu item if it doesn't already exist.
 * Wrapped in try-catch because calling create() when it already exists throws.
 */
function ensureContextMenu() {
    chrome.contextMenus.create({
        id: "cf-explain-snippet",
        title: "Explain code with AI",
        contexts: ["selection"]
    }, () => {
        // Suppress "duplicate id" error — it's harmless
        if (chrome.runtime.lastError) { /* already exists, ignore */ }
    });
}

// 1. On startup, check if we already have the permission and create the menu
chrome.runtime.onStartup.addListener(() => {
    chrome.permissions.contains({ permissions: ['contextMenus'] }, (granted) => {
        if (granted) ensureContextMenu();
    });
});

// Also run on install/update for users who already granted the permission
chrome.runtime.onInstalled.addListener(() => {
    chrome.permissions.contains({ permissions: ['contextMenus'] }, (granted) => {
        if (granted) ensureContextMenu();
    });
});

// 2. Listen for message from popup to create the context menu after permission grant
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "enable_context_menu") {
        ensureContextMenu();
    }
});

// 3. Handle Click Event
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "cf-explain-snippet" && tab.id) {
        // Send message to the Content Script in the active tab
        chrome.tabs.sendMessage(tab.id, {
            action: "trigger_snippet_explain",
            selection: info.selectionText
        });
    }
});