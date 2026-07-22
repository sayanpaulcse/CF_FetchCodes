/**
 * =============================================================================
 * CF FetchCodes — Chat Manager
 * =============================================================================
 * AI chat UI creation, Gemini API streaming, and markdown parsing.
 * Depends on: constants.js (CHAT_HISTORY, CONFIG), utils.js (Utils, Logger, Toast)
 * =============================================================================
 */

const ChatManager = {
    /**
     * Open or restore a chat window. Creates UI if the window doesn't exist,
     * restores previous messages if history exists, or sends initial prompt.
     * @param {string} chatId - Unique chat identifier
     * @param {Object} contextData - Initial chat context
     * @param {string} contextData.initialPrompt - First user message
     * @param {string} contextData.systemContext - System context (code, problem)
     */
    openChat: (chatId, contextData) => {
        let chatWindow = document.getElementById(chatId);
        if (!chatWindow) {
            ChatManager.createChatUI(chatId);
            if (!CHAT_HISTORY.has(chatId)) {
                CHAT_HISTORY.set(chatId, []);
                ChatManager.sendUserMessage(chatId, contextData.initialPrompt, true, contextData.systemContext);
            } else {
                ChatManager.restoreChat(chatId);
            }
        } else {
            chatWindow.style.display = 'flex';
        }
    },

    /**
     * Build and inject the chat window DOM. Sets up drag, minimize, close,
     * send, and copy-to-clipboard handlers.
     * @param {string} chatId - Unique chat identifier
     */
    createChatUI: (chatId) => {
        const html = `
            <div id="${chatId}" class="cf-ai-chat-window">
                <div class="cf-ai-header">
                    <span>🤖 AI Explainer</span>
                    <div class="cf-win-controls">
                        <span class="cf-ai-min" id="${chatId}-min-btn">_</span>
                        <span class="cf-ai-close" id="${chatId}-close-btn">&times;</span>
                    </div>
                </div>
                <div id="${chatId}-body" class="cf-ai-body">
                    <div class="cf-ai-messages" id="${chatId}-msgs"></div>
                    <div class="cf-ai-input-area">
                        <textarea id="${chatId}-input" placeholder="Ask a follow-up..." rows="1"></textarea>
                        <button id="${chatId}-send">➤</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);

        const chatWindow = document.getElementById(chatId);
        const bodyPart = document.getElementById(`${chatId}-body`);
        const minBtn = document.getElementById(`${chatId}-min-btn`);
        const closeBtn = document.getElementById(`${chatId}-close-btn`);
        const input = document.getElementById(`${chatId}-input`);
        const sendBtn = document.getElementById(`${chatId}-send`);
        const msgContainer = document.getElementById(`${chatId}-msgs`);

        // Minimize toggle
        minBtn.onclick = () => {
            bodyPart.classList.toggle('minimized');
            chatWindow.classList.toggle('window-minimized');
        };

        // Close (remove from DOM)
        closeBtn.onclick = () => chatWindow.remove();

        // Auto-resize textarea as user types
        const autoResize = () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        };
        input.addEventListener('input', autoResize);

        // Send message handler
        const handleSend = () => {
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            input.style.height = 'auto'; // Reset height after sending
            ChatManager.sendUserMessage(chatId, text);
        };

        sendBtn.onclick = handleSend;
        // Enter sends, Shift+Enter inserts newline
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Copy button delegation
        msgContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-btn')) {
                const wrapper = e.target.closest('.md-code-wrapper');
                const pre = wrapper.querySelector('pre');
                const text = pre.innerText || pre.textContent;

                navigator.clipboard.writeText(text).then(() => {
                    const originalText = e.target.innerText;
                    e.target.innerText = "Copied!";
                    e.target.style.background = "#4caf50";
                    e.target.style.color = "#fff";
                    setTimeout(() => {
                        e.target.innerText = originalText;
                        e.target.style.background = "";
                        e.target.style.color = "";
                    }, 2000);
                });
            }
        });

        // Draggable logic — uses addEventListener to avoid hijacking global handlers
        const header = chatWindow.querySelector('.cf-ai-header');
        let isDragging = false, startX, startY, initLeft, initTop;

        const onMouseMove = (e) => {
            if (!isDragging) return;
            chatWindow.style.left = (initLeft + e.clientX - startX) + 'px';
            chatWindow.style.top = (initTop + e.clientY - startY) + 'px';
            chatWindow.style.bottom = 'auto';
            chatWindow.style.right = 'auto';
        };

        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        header.addEventListener('mousedown', (e) => {
            if (e.target === minBtn || e.target === closeBtn) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initLeft = chatWindow.offsetLeft;
            initTop = chatWindow.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    },

    /**
     * Rebuild chat messages from history when a window is re-opened.
     * @param {string} chatId
     */
    restoreChat: (chatId) => {
        const history = CHAT_HISTORY.get(chatId);
        const container = document.getElementById(`${chatId}-msgs`);
        container.innerHTML = '';
        history.forEach(msg => {
            if (!msg.isSystem) {
                ChatManager.appendMessageUI(container, msg.parts[0].text, msg.role);
            }
        });
        container.scrollTop = container.scrollHeight;
    },

    /**
     * Append a message bubble to the chat UI.
     * @param {HTMLElement} container - The messages container
     * @param {string} text - Message content (markdown for model, plain for user)
     * @param {string} role - 'user', 'model', or 'loading-placeholder'
     * @returns {HTMLElement} The created message div
     */
    appendMessageUI: (container, text, role) => {
        // Remove loading placeholder when model responds
        if (role === 'model') {
            const lastMsg = container.lastElementChild;
            if (lastMsg && lastMsg.classList.contains('loading-placeholder')) {
                lastMsg.remove();
            }
        }
        const div = document.createElement('div');
        div.className = `cf-msg ${role}`;

        if (role === 'loading-placeholder') {
            div.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
        } else {
            div.innerHTML = ChatManager.parseMarkdown(text);
        }
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return div;
    },

    /**
     * Update an existing message div with new content (used during streaming).
     * @param {HTMLElement} div - The message element to update
     * @param {string} text - Updated full text
     */
    updateMessageUI: (div, text) => {
        div.innerHTML = ChatManager.parseMarkdown(text);
    },

    // =========================================================================
    // MARKDOWN PARSER WITH PRETTYPRINT SUPPORT
    // =========================================================================

    /**
     * Parse a markdown-like string into HTML for chat display.
     * Supports: code blocks with syntax highlighting, inline code, bold, italic,
     * headers (h1-h3), and unordered lists. Code blocks use Codeforces' built-in
     * Prettify library when available.
     *
     * @param {string} text - Markdown source
     * @returns {string} HTML string
     */
    parseMarkdown: (text) => {
        if (!text) return "";

        // 1. Extract fenced code blocks before HTML-escaping
        const codeBlocks = [];
        text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
            codeBlocks.push({ lang: lang || 'cpp', code: code });
            return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
        });

        // 2. HTML-escape remaining text to prevent injection
        text = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Strip LaTeX math delimiters ($ and $$) often used by models
        text = text.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
        text = text.replace(/\$([^$\n]+?)\$/g, '$1');

        // 3. Markdown → HTML transformations
        text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        text = text.replace(/^\s*[-*]\s+(.*)$/gm, '<li class="md-list-item">$1</li>');
        text = text.replace(/\n/g, '<br>');

        // 4. Restore code blocks with syntax highlighting
        text = text.replace(/__CODE_BLOCK_(\d+)__/g, (_match, index) => {
            const block = codeBlocks[index];
            let highlightedCode = "";

            if (window.PR && window.PR.prettyPrintOne) {
                try {
                    const langClass = block.lang || 'cpp';
                    highlightedCode = window.PR.prettyPrintOne(block.code, langClass, false);
                } catch (_e) {
                    highlightedCode = block.code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                }
            } else {
                highlightedCode = block.code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            }

            return `
                <div class="md-code-wrapper">
                    <div class="md-code-header">
                        <span class="md-lang">${block.lang || 'code'}</span>
                        <button class="copy-btn">Copy</button>
                    </div>
                    <pre class="prettyprint">${highlightedCode}</pre>
                </div>`;
        });

        return text;
    },

    /**
     * Send a user message and stream the AI response from Gemini API.
     *
     * Error messages use markdown syntax (e.g. `**⚠ Error:** ...`) so they
     * render correctly through parseMarkdown() instead of showing raw HTML tags.
     *
     * @param {string} chatId - Chat instance identifier
     * @param {string} text - User's message text
     * @param {boolean} [isInitial=false] - Whether this is the first (hidden) message
     * @param {string} [systemContext=""] - Problem/code context for the initial message
     */
    sendUserMessage: async (chatId, text, isInitial = false, systemContext = "") => {
        const container = document.getElementById(`${chatId}-msgs`);
        const history = CHAT_HISTORY.get(chatId);

        if (!isInitial) {
            ChatManager.appendMessageUI(container, text, 'user');
            history.push({ role: "user", parts: [{ text: text }] });
        } else {
            const combinedText = systemContext + "\n\n" + text;
            history.push({ role: "user", parts: [{ text: combinedText }], isSystem: true });
        }

        const loadingDiv = ChatManager.appendMessageUI(container, "", 'loading-placeholder');

        /** Safely remove the loading indicator if it's still in the DOM. */
        const removeLoading = () => {
            if (loadingDiv && loadingDiv.parentNode) {
                loadingDiv.remove();
            }
        };

        try {
            const storage = await chrome.storage.local.get(['geminiApiKey', 'geminiModel']);
            if (!storage.geminiApiKey) {
                removeLoading();
                ChatManager.appendMessageUI(
                    container,
                    "**⚠ Error:** API Key is missing. Please set your Gemini API key in the extension settings.",
                    'model'
                );
                return;
            }

            const modelName = storage.geminiModel || "gemini-2.5-flash";
            const apiContents = history.map(h => ({ role: h.role, parts: h.parts }));

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${storage.geminiApiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: apiContents })
                }
            );

            if (!response.ok) {
                removeLoading();
                const errText = await response.text();
                let userMsg = `API Error (${response.status})`;
                if (response.status === 400) userMsg = "Bad request. The API key or request format may be invalid.";
                if (response.status === 403) userMsg = "API key is invalid or does not have permission.";
                if (response.status === 404) userMsg = `Model '${modelName}' not found. Please check your model name in settings.`;
                if (response.status === 429) userMsg = "Rate limit exceeded. Please wait a moment and try again.";

                Logger.info("API response error:", response.status, errText);
                ChatManager.appendMessageUI(container, `**⚠ Error:** ${userMsg}`, 'model');
                return;
            }

            removeLoading();
            const aiMsgDiv = ChatManager.appendMessageUI(container, "", 'model');

            // Stream response chunks and parse incrementally
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const regex = /"text":\s*"(.*?)(?<!\\)"/g;
                let match;
                let lastIndex = 0;

                while ((match = regex.exec(buffer)) !== null) {
                    const content = Utils.unescapeJson(match[1]);
                    fullText += content;
                    ChatManager.updateMessageUI(aiMsgDiv, fullText);
                    container.scrollTop = container.scrollHeight;
                    lastIndex = regex.lastIndex;
                }

                // Keep unmatched tail in buffer for next chunk
                if (lastIndex > 0) {
                    buffer = buffer.slice(lastIndex);
                }
            }
            history.push({ role: "model", parts: [{ text: fullText }] });

        } catch (e) {
            removeLoading();
            Logger.info("Chat network error:", e);
            ChatManager.appendMessageUI(
                container,
                `**⚠ Network Error:** ${e.message || "Could not connect to the AI service."}`,
                'model'
            );
        }
    }
};
