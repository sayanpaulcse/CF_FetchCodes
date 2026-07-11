// ==========================================
// 1. CONSTANTS & DEFAULTS
// ==========================================
const DEFAULTS = {
    fullPrompt: "You are a competitive programming expert. Analyze the following solution for the given problem. Explain the approach, time complexity, and logic.",
    snippetPrompt: "Explain the logic and syntax of this specific code segment in the context of competitive programming.",
    // NEW: Default Model
    defaultModel: "gemini-2.5-flash" 
};

// ==========================================
// 2. NAVIGATION FUNCTIONS
// ==========================================
function goDeveloperProfile() {
    chrome.tabs.create({ url: 'https://codeforces.com/profile/sapaul' });
}

function goGithubProfile() {
    chrome.tabs.create({ url: 'https://github.com/sa-paul' });
}

// ==========================================
// 3. MAIN LOGIC (DOM LOADED)
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    
    // --- Part A: Developer Links ---
    const developerHandleID = document.getElementById('developerHandle');
    const developerContactID = document.getElementById('developerContact');

    if (developerHandleID) {
        developerHandleID.addEventListener('click', goDeveloperProfile);
    }
    if (developerContactID) {
        developerContactID.addEventListener('click', goGithubProfile);
    }

    // --- Part B: AI Settings (Load & Save) ---
    const apiKeyInput = document.getElementById('apiKeyInput');
    const modelInput = document.getElementById('modelInput'); // NEW
    const fullPromptInput = document.getElementById('fullPromptInput');
    const snippetPromptInput = document.getElementById('snippetPromptInput');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    // 1. Load Saved Settings (or Defaults)
    chrome.storage.local.get(['geminiApiKey', 'geminiModel', 'cfFullPrompt', 'cfSnippetPrompt'], (res) => {
        if (res.geminiApiKey) {
            apiKeyInput.value = res.geminiApiKey;
        }
        
        // NEW: Load Model
        modelInput.value = res.geminiModel || DEFAULTS.defaultModel;

        fullPromptInput.value = res.cfFullPrompt || DEFAULTS.fullPrompt;
        snippetPromptInput.value = res.cfSnippetPrompt || DEFAULTS.snippetPrompt;
    });

    // 2. Save Settings on Click
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const key = apiKeyInput.value.trim();
            const model = modelInput.value.trim() || DEFAULTS.defaultModel; // NEW
            const fullPrompt = fullPromptInput.value.trim();
            const snippetPrompt = snippetPromptInput.value.trim();

            chrome.storage.local.set({
                geminiApiKey: key,
                geminiModel: model, // NEW
                cfFullPrompt: fullPrompt,
                cfSnippetPrompt: snippetPrompt
            }, () => {
                status.innerText = "✅ Saved!";
                setTimeout(() => {
                    status.innerText = "";
                }, 2000);
            });
        });
    }
});