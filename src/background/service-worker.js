// background.js

// 1. Create the Context Menu on Install
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "cf-explain-snippet",
        title: "Explain code with AI",
        contexts: ["selection"]
    });
});

// 2. Handle Click Event
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "cf-explain-snippet" && tab.id) {
        // Send message to the Content Script in the active tab
        chrome.tabs.sendMessage(tab.id, {
            action: "trigger_snippet_explain",
            selection: info.selectionText
        });
    }
});