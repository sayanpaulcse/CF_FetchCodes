/**
 * =============================================================================
 * CF FetchCodes — UI Layer
 * =============================================================================
 * Modal, sidebar injection, accordion, and code rendering.
 * Depends on: constants.js (CONFIG, STATUS, CODE_CACHE),
 *             utils.js (Utils, Logger, Toast),
 *             chat-manager.js (ChatManager),
 *             api.js (API)
 * =============================================================================
 */

const UI = {
    /** @type {string} DOM element IDs used throughout the UI */
    sidebarId: 'sidebar',
    pageContentId: 'pageContent',
    modalId: 'cf_friends_modal',
    listContainerId: 'cf_friends_list_container',
    progressFillId: 'cf_progress_fill',
    progressTextId: 'cf_progress_text',

    /**
     * Initialize all UI components: sidebar box, modal, event listeners,
     * and dark mode settings.
     */
    init: () => {
        UI.injectSidebarBox();
        UI.injectModal();
        UI.setupEventListeners();
        UI.setupContextListeners();
        UI.initDarkMode();
    },

    /**
     * Load dark mode preferences from storage and apply them.
     * Also sets up a listener for live changes from the popup.
     */
    initDarkMode: () => {
        chrome.storage.local.get(['cfPageDarkMode', 'cfCodeDarkMode', 'cfCodeTheme'], (res) => {
            UI.applyDarkMode(res);
        });
        UI.setupDarkModeListener();
    },

    /**
     * Apply dark mode settings by setting data attributes on the <html> element.
     * CSS rules in content.css and code-themes.css are scoped to these attributes.
     * @param {Object} settings
     * @param {boolean} [settings.cfPageDarkMode]
     * @param {boolean} [settings.cfCodeDarkMode]
     * @param {string} [settings.cfCodeTheme]
     */
    applyDarkMode: (settings) => {
        const root = document.documentElement;

        // Page dark mode
        if (settings.cfPageDarkMode) {
            root.setAttribute('data-cf-dark', 'true');
            UI.initTestCaseHover();
        } else {
            root.removeAttribute('data-cf-dark');
            UI.teardownTestCaseHover();
        }

        // Code-only dark mode
        if (settings.cfCodeDarkMode) {
            root.setAttribute('data-cf-code-dark', 'true');
        } else {
            root.removeAttribute('data-cf-code-dark');
        }

        // Code theme (always set so theme CSS activates when code dark mode is on)
        const theme = settings.cfCodeTheme || 'monokai';
        if (settings.cfCodeDarkMode) {
            root.setAttribute('data-cf-code-theme', theme);
        } else {
            root.removeAttribute('data-cf-code-theme');
        }
    },

    /**
     * In dark mode, CF's built-in test case hover (yellow cross-highlighting
     * between input/output lines) is blocked by our !important CSS.
     *
     * Instead of reimplementing CF's complex logic (which knows test case
     * boundaries), we use a MutationObserver to detect when CF's JS sets
     * inline backgroundColor and mirror that via our .cf-dark-highlight class.
     * This preserves CF's smart test-case-aware highlighting logic.
     */
    _testCaseHoverObserver: null,
    initTestCaseHover: () => {
        if (UI._testCaseHoverObserver) return;

        const lines = document.querySelectorAll(
            '.test-example-line-even, .test-example-line-odd'
        );
        if (lines.length === 0) return;

        UI._testCaseHoverObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.attributeName !== 'style') continue;
                const el = mutation.target;
                // CF's JS sets backgroundColor inline when hovering test cases
                if (el.style.backgroundColor) {
                    el.classList.add('cf-dark-highlight');
                } else {
                    el.classList.remove('cf-dark-highlight');
                }
            }
        });

        lines.forEach(line => {
            UI._testCaseHoverObserver.observe(line, {
                attributes: true,
                attributeFilter: ['style']
            });
        });
    },

    teardownTestCaseHover: () => {
        if (UI._testCaseHoverObserver) {
            UI._testCaseHoverObserver.disconnect();
            UI._testCaseHoverObserver = null;
        }
        document.querySelectorAll('.cf-dark-highlight').forEach(el => {
            el.classList.remove('cf-dark-highlight');
        });
    },

    /**
     * Listen for chrome.storage changes so dark mode toggles in the popup
     * take effect immediately without requiring a page reload.
     */
    setupDarkModeListener: () => {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            const darkKeys = ['cfPageDarkMode', 'cfCodeDarkMode', 'cfCodeTheme'];
            const hasRelevantChange = darkKeys.some(key => key in changes);
            if (!hasRelevantChange) return;

            // Re-read all settings to ensure consistency
            chrome.storage.local.get(darkKeys, (res) => {
                UI.applyDarkMode(res);
            });
        });
    },

    /**
     * Listen for context menu messages from the background script
     * to trigger snippet explanation in a new chat window.
     */
    setupContextListeners: () => {
        chrome.runtime.onMessage.addListener((req) => {
            if (req.action === "trigger_snippet_explain") {
                if (!req.selection || req.selection.trim().length === 0) {
                    Toast.warn("No text selected! Please select some code first.");
                    return;
                }
                const chatId = Utils.generateId();
                chrome.storage.local.get(['cfSnippetPrompt'], (res) => {
                    const prompt = res.cfSnippetPrompt || "Explain this code snippet.";
                    const context = `Context: Codeforces Snippet.\nCode:\n${req.selection}`;
                    ChatManager.openChat(chatId, { initialPrompt: prompt, systemContext: context });
                });
            }
        });
    },

    /**
     * Inject the "Accepted Codes of Friends" sidebar box into the Codeforces sidebar.
     */
    injectSidebarBox: () => {
        const sidebar = document.getElementById(UI.sidebarId);
        if (!sidebar) {
            Logger.warn("Sidebar element (#sidebar) not found — skipping sidebar injection.");
            return;
        }
        const boxHtml = `
            <div class="roundbox sidebox sidebar-menu borderTopRound">
                <div class="caption titled">→ Accepted Codes of Friends</div>
                <div><ul><li><span>
                    <span id="showCodeButton" class="sidebar-link">Show Codes</span>
                </span></li></ul></div>
            </div>`;
        sidebar.insertAdjacentHTML('beforeend', boxHtml);
    },

    /**
     * Inject the full-screen modal for displaying friends' solutions.
     */
    injectModal: () => {
        const pageContent = document.getElementById(UI.pageContentId);
        if (!pageContent) {
            Logger.warn("Page content element (#pageContent) not found — skipping modal injection.");
            return;
        }
        const modalHtml = `
            <div id="${UI.modalId}" class="modal">
                <div class="modalContent">
                    <span class="modalClose">&times;</span>
                    <div class="modalHeaderContainer">
                        <div class="modalCodeHeader">→ Accepted Codes of Friends</div>
                        <div class="progress-info" id="${UI.progressTextId}">Initializing...</div>
                        <div class="progress-track">
                            <div class="progress-fill" id="${UI.progressFillId}"></div>
                        </div>
                    </div>
                    <div id="${UI.listContainerId}"></div>
                </div>
            </div>`;
        pageContent.insertAdjacentHTML('beforeend', modalHtml);
    },

    /**
     * Wire up all event listeners: modal open/close, accordion clicks,
     * AI explain buttons, and friend profile link passthrough.
     */
    setupEventListeners: () => {
        const modal = document.getElementById(UI.modalId);
        const btn = document.getElementById("showCodeButton");
        const span = document.getElementsByClassName("modalClose")[0];
        const listContainer = document.getElementById(UI.listContainerId);

        if (btn) btn.onclick = () => {
            modal.classList.add('show');
            // Trigger fetching on first click (startFetching is defined in main.js)
            if (typeof startFetching === 'function') startFetching();
        };
        if (span) span.onclick = () => modal.classList.remove('show');

        // Close modal on backdrop click
        window.addEventListener('click', (event) => {
            if (event.target === modal) modal.classList.remove('show');
        });

        if (listContainer) {
            listContainer.addEventListener('click', (e) => {

                // AI Explain button
                if (e.target.classList.contains('cf-ai-explain-btn')) {
                    const subId = e.target.dataset.subId;
                    const codeBlock = document.getElementById(`code-raw-${subId}`);

                    if (!codeBlock) {
                        Toast.info("Code not loaded yet. Please wait for it to appear.");
                        return;
                    }

                    const codeText = codeBlock.dataset.originalCode || codeBlock.innerText;
                    chrome.storage.local.get(['cfFullPrompt'], (res) => {
                        const prompt = res.cfFullPrompt || "Analyze this solution.";
                        const problem = Utils.getProblemStatement();
                        const systemContext = `Problem: ${problem}\n\nSolution Code:\n${codeText}`;
                        ChatManager.openChat(`chat-sub-${subId}`, { initialPrompt: prompt, systemContext: systemContext });
                    });
                    return;
                }

                // Allow friend profile links to work without toggling accordion
                if (e.target.closest('.friend-profile-link')) {
                    e.stopPropagation();
                    return;
                }

                // Accordion header toggle
                const header = e.target.closest('.accordion-header');
                if (header) {
                    const { submissionId, contestId, language } = header.dataset;
                    UI.toggleCode(submissionId, contestId, language, header);
                }
            });
        }
    },

    /**
     * Update the progress bar and text in the modal header.
     * @param {number} current - Number of friends checked so far
     * @param {number} total - Total number of friends
     * @param {string} [label] - Optional phase label (e.g., "Analyzing standings...")
     */
    updateProgress: (current, total, label) => {
        const textEl = document.getElementById(UI.progressTextId);
        const fillEl = document.getElementById(UI.progressFillId);
        if (textEl && fillEl) {
            const percentage = total > 0 ? Math.floor((current / total) * 100) : 0;
            textEl.innerText = label || `Checking friends: ${current} / ${total}`;
            fillEl.style.width = `${percentage}%`;
            if (current === total && !label) {
                textEl.innerText = `Done! Checked ${total} friends.`;
                fillEl.style.backgroundColor = "#00a65a";
            }
        }
    },

    /**
     * Add a friend's accepted submission to the accordion list.
     * @param {Object} friendObj - Friend data
     * @param {string} friendObj.handle - Codeforces handle
     * @param {string} friendObj.cssClass - CF rating color CSS classes
     * @param {string} contestId
     * @param {string} submissionId
     * @param {string} language - Programming language used
     */
    addFriendToList: (friendObj, contestId, submissionId, language) => {
        const listContainer = document.getElementById(UI.listContainerId);
        const uniqueId = `sub-${submissionId}`;
        const safeHandle = Utils.escapeHtml(friendObj.handle);
        const safeLang = Utils.escapeHtml(language);

        const html = `
            <div class="accordion-item">
                <div class="accordion-header"
                     data-submission-id="${submissionId}"
                     data-contest-id="${contestId}"
                     data-language="${safeLang}">

                    <a href="${CONFIG.cfBaseUrl}/profile/${encodeURIComponent(friendObj.handle)}"
                       class="friend-name friend-profile-link ${friendObj.cssClass}"
                       target="_blank">
                       ${safeHandle}
                    </a>

                    <span class="friend-status-info">
                        ${safeLang}
                        <span style="font-size: 0.8rem; opacity: 0.6;">▼</span>
                    </span>
                </div>
                <div id="${uniqueId}" class="accordion-content"></div>
            </div>`;
        listContainer.insertAdjacentHTML('beforeend', html);
    },

    /**
     * Toggle the visibility of a code accordion section.
     * Lazy-loads the code on first expansion.
     * @param {string} submissionId
     * @param {string} contestId
     * @param {string} language
     * @param {HTMLElement} headerElement - The clicked accordion header
     */
    toggleCode: async (submissionId, contestId, language, headerElement) => {
        const contentDiv = document.getElementById(`sub-${submissionId}`);
        const isClosed = contentDiv.style.display === '' || contentDiv.style.display === 'none';

        if (isClosed) {
            contentDiv.style.display = 'block';
            headerElement.classList.add('active');
            if (contentDiv.innerHTML.trim() === "") {
                await UI.loadCodeIntoDiv(contentDiv, submissionId, contestId, language);
            }
        } else {
            contentDiv.style.display = 'none';
            headerElement.classList.remove('active');
        }
    },

    /**
     * Fetch and render source code into an accordion content div.
     * Handles cache hits, auth errors, locked submissions, and generic failures.
     * @param {HTMLElement} containerDiv - The accordion content container
     * @param {string} submissionId
     * @param {string} contestId
     * @param {string} language
     */
    loadCodeIntoDiv: async (containerDiv, submissionId, contestId, language) => {
        containerDiv.innerHTML = `<div class="loading-spinner">Fetching Code...</div>`;

        let cached = CODE_CACHE.get(submissionId);
        let result;

        if (cached) {
            result = { status: STATUS.OK, content: cached };
        } else {
            result = await API.fetchCode(contestId, submissionId);
            if (result.status === STATUS.OK) {
                CODE_CACHE.set(submissionId, result.content);
            }
        }

        if (result.status === STATUS.OK) {
            UI.renderCode(containerDiv, result.content, language, submissionId, contestId);
            return;
        }

        if (result.status === STATUS.AUTH_ERROR) {
            const uniqueBtnId = `retry-btn-${submissionId}`;
            containerDiv.innerHTML = `
                <div class="cf-status-banner cf-status-banner--error">
                    <div class="cf-status-banner__title">Session Expired</div>
                    <span class="cf-status-banner__subtitle">
                        Please login to view solutions, then click Retry.
                    </span>
                    <div class="cf-status-banner__actions">
                        <a href="https://codeforces.com/enter" target="_blank" class="cf-btn-login">
                            Login ↗
                        </a>
                        <button id="${uniqueBtnId}" class="cf-btn-retry">
                            ↻ Retry
                        </button>
                    </div>
                </div>`;
            const retryBtn = document.getElementById(uniqueBtnId);
            if (retryBtn) {
                retryBtn.onclick = (e) => {
                    e.stopPropagation();
                    UI.loadCodeIntoDiv(containerDiv, submissionId, contestId, language);
                };
            }
            return;
        }

        if (result.status === STATUS.LOCKED_ERROR) {
            const uniqueBtnId = `retry-locked-${submissionId}`;
            containerDiv.innerHTML = `
                <div class="cf-status-banner cf-status-banner--locked">
                    <div class="cf-status-banner__title">Could Not Load Code</div>
                    <span class="cf-status-banner__subtitle">
                        This is likely caused by Codeforces' security check or a rate limit.
                        Close all Codeforces tabs, reopen this page, and click Retry.
                        If the problem persists, the user may have hidden their submissions.
                    </span>
                    <div class="cf-status-banner__actions">
                        <a href="https://codeforces.com/enter" target="_blank" class="cf-btn-login">
                            Re-login ↗
                        </a>
                        <button id="${uniqueBtnId}" class="cf-btn-retry">
                            ↻ Retry
                        </button>
                    </div>
                </div>`;
            const retryBtn = document.getElementById(uniqueBtnId);
            if (retryBtn) {
                retryBtn.onclick = (e) => {
                    e.stopPropagation();
                    UI.loadCodeIntoDiv(containerDiv, submissionId, contestId, language);
                };
            }
            return;
        }

        // Generic fallback with link to original submission
        const originalLink = `${CONFIG.cfBaseUrl}/contest/${contestId}/submission/${submissionId}`;
        containerDiv.innerHTML = `
            <div class="cf-status-banner cf-status-banner--fallback">
                Unable to fetch automatically.<br>
                <a href="${originalLink}" target="_blank" class="cf-btn-view-original">
                    View original submission ↗
                </a>
            </div>`;
    },

    /**
     * Render fetched source code with syntax highlighting and toolbar.
     * @param {HTMLElement} containerDiv
     * @param {string} code - Raw source code HTML
     * @param {string} langClass - Language identifier for Prettify
     * @param {string} submissionId
     * @param {string} contestId
     */
    renderCode: (containerDiv, code, langClass, submissionId, contestId) => {
        const submissionUrl = `${CONFIG.cfBaseUrl}/contest/${contestId}/submission/${submissionId}`;

        // Fix C++ digit separators (e.g. 1'000'000) that confuse Prettify's
        // string-literal detection. Replace the apostrophe between digits with
        // Unicode modifier letter apostrophe (ʼ U+02BC), which looks identical
        // but isn't treated as a string delimiter by the syntax highlighter.
        // The original code is preserved in a data attribute for the AI explainer.
        const displayCode = code
            .replace(/(\d)&#0?39;(\d)/g, '$1\u02BC$2')   // HTML entity form
            .replace(/(\d)&#x0?27;(\d)/gi, '$1\u02BC$2')  // hex entity form
            .replace(/(\d)'(\d)/g, '$1\u02BC$2');          // literal form

        containerDiv.innerHTML = `
            <div class="cf-code-toolbar">
                <button class="cf-ai-explain-btn cf-btn-explain" data-sub-id="${submissionId}">
                    🤖 Explain
                </button>
                <a href="${submissionUrl}" target="_blank" class="cf-btn-view-original">
                    View Original ↗
                </a>
            </div>
            <pre id="code-raw-${submissionId}" class="prettyprint ${langClass}">${displayCode}</pre>`;

        // Store original unmodified code for AI explainer (with real apostrophes)
        const preEl = document.getElementById(`code-raw-${submissionId}`);
        if (preEl) {
            const temp = document.createElement('pre');
            temp.innerHTML = code;
            preEl.dataset.originalCode = temp.textContent;
        }

        // Trigger Codeforces' built-in syntax highlighter
        if (typeof PR !== 'undefined' && PR.prettyPrint) {
            PR.prettyPrint();
        } else if (window.PR && window.PR.prettyPrint) {
            window.PR.prettyPrint();
        }
    }
};
