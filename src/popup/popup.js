// ==========================================
// 1. CONSTANTS & DEFAULTS
// ==========================================
const DEFAULTS = {
    fullPrompt: "You are a competitive programming expert. Analyze the following solution for the given problem. Explain the detailed approach, logic, time complexity, and space complexity of the friend's code exhaustively.",
    snippetPrompt: "Explain the logic and syntax of this specific code segment in the context of the problem. Keep the explanation short, specific, and concise for a fast reply.",
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
    chrome.tabs.create({ url: 'https://github.com/sayanpaulcse' });
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

    const pageDarkToggle = document.getElementById('pageDarkToggle');
    const codeDarkToggle = document.getElementById('codeDarkToggle');
    const codeThemeSelect = document.getElementById('codeThemeSelect');
    const themeSelectGroup = document.getElementById('themeSelectGroup');

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

    // Load Dark Mode Settings
    chrome.storage.local.get(['cfPageDarkMode', 'cfCodeDarkMode', 'cfCodeTheme'], (res) => {
        pageDarkToggle.checked = !!res.cfPageDarkMode;
        codeDarkToggle.checked = !!res.cfCodeDarkMode;
        codeThemeSelect.value = res.cfCodeTheme || 'monokai';
        themeSelectGroup.style.display = codeDarkToggle.checked ? 'block' : 'none';
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

    // --- Part C: Dark Mode Toggle Handlers ---
    if (pageDarkToggle) {
        pageDarkToggle.addEventListener('change', () => {
            chrome.storage.local.set({ cfPageDarkMode: pageDarkToggle.checked });
            // When page dark mode is ON, also enable code dark mode
            if (pageDarkToggle.checked) {
                codeDarkToggle.checked = true;
                chrome.storage.local.set({ cfCodeDarkMode: true });
                themeSelectGroup.style.display = 'block';
            }
        });
    }

    if (codeDarkToggle) {
        codeDarkToggle.addEventListener('change', () => {
            chrome.storage.local.set({ cfCodeDarkMode: codeDarkToggle.checked });
            themeSelectGroup.style.display = codeDarkToggle.checked ? 'block' : 'none';
        });
    }

    if (codeThemeSelect) {
        codeThemeSelect.addEventListener('change', () => {
            chrome.storage.local.set({ cfCodeTheme: codeThemeSelect.value });
        });
    }
});