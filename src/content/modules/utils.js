/**
 * =============================================================================
 * CF FetchCodes — Utilities
 * =============================================================================
 * Logger, pure utility functions, and Toast notification system.
 * Depends on: constants.js (CONFIG)
 * =============================================================================
 */

// =============================================================================
// LOGGER — Prefixed console output for consistent, filterable debugging
// =============================================================================

/** Prefixed console logger for consistent, filterable output. */
const Logger = {
    _prefix: "[CF FetchCodes]",

    /** @param {...*} args */
    info: (...args) => console.log(Logger._prefix, ...args),

    /** @param {...*} args */
    warn: (...args) => console.warn(Logger._prefix, ...args),

    /** @param {...*} args */
    error: (...args) => console.error(Logger._prefix, ...args)
};


// =============================================================================
// UTILS — Pure helper functions
// =============================================================================

const Utils = {
    /**
     * Generate a random integer in [min, max] inclusive.
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    getRandomInt: (min, max) => Math.floor(Math.random() * (max - min + 1) + min),

    /**
     * Promise-based delay.
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    /**
     * Human-like delay with random jitter to avoid rate-limiting.
     * @returns {Promise<void>}
     */
    humanSleep: async () => {
        const jitter = Utils.getRandomInt(0, CONFIG.randomJitter);
        await Utils.sleep(CONFIG.baseDelay + jitter);
    },

    /**
     * Extract the problem index (e.g., "A", "B1") from the current page URL.
     * @returns {string}
     */
    getProblemIdFromUrl: () => {
        const path = new URL(window.location.href).pathname.split('/');
        return path[path.length - 1];
    },

    /**
     * Extract the contest ID from the current page URL.
     * Supports both /contest/{id}/problem/... and /problemset/problem/{id}/...
     * @returns {string|null}
     */
    getContestIdFromUrl: () => {
        const path = new URL(window.location.href).pathname.split('/');
        if (path.includes('contest')) return path[path.indexOf('contest') + 1];
        if (path.includes('problemset')) return path[path.indexOf('problemset') + 2];
        return null;
    },

    /**
     * Scrape the problem statement text from the page DOM.
     * Truncated to 6000 chars to fit within LLM context limits.
     * @returns {string}
     */
    getProblemStatement: () => {
        const el = document.querySelector('.problem-statement');
        return el ? el.innerText.substring(0, 6000) : "Problem statement not found.";
    },

    /**
     * Generate a unique ID for chat instances.
     * @returns {string}
     */
    generateId: () => 'chat-' + Math.random().toString(36).slice(2, 11),

    /**
     * Unescape JSON string escape sequences for streaming parser output.
     * @param {string} str - Raw escaped string from JSON
     * @returns {string} Unescaped string
     */
    unescapeJson: (str) => {
        return str
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '')
            .replace(/\\u([\dA-Fa-f]{4})/g, (_, grp) => String.fromCharCode(parseInt(grp, 16)));
    },

    /**
     * Escape HTML special characters to prevent XSS when inserting user content.
     * @param {string} str - Untrusted string
     * @returns {string} Escaped string safe for innerHTML
     */
    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Fisher-Yates (Knuth) shuffle — unbiased in-place array shuffle.
     * @param {Array} arr - Array to shuffle (mutated in place)
     * @returns {Array} The same array, shuffled
     */
    shuffleArray: (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
};


// =============================================================================
// TOAST — Non-intrusive notification system (replaces alert())
// =============================================================================

const Toast = {
    /** @type {HTMLElement|null} Container element, lazily created */
    _container: null,

    /**
     * Ensure the toast container exists in the DOM.
     * @returns {HTMLElement}
     */
    _getContainer: () => {
        if (!Toast._container) {
            Toast._container = document.createElement('div');
            Toast._container.className = 'cf-toast-container';
            document.body.appendChild(Toast._container);
        }
        return Toast._container;
    },

    /**
     * Show a toast notification.
     * @param {string} message - Text to display
     * @param {'info'|'warn'|'error'} type - Severity level
     * @param {number} [duration] - Auto-dismiss time in ms
     */
    show: (message, type = 'info', duration = CONFIG.toastDuration) => {
        const container = Toast._getContainer();
        const toast = document.createElement('div');
        toast.className = `cf-toast cf-toast--${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('cf-toast--out');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
    },

    /** @param {string} msg */
    info: (msg) => Toast.show(msg, 'info'),

    /** @param {string} msg */
    warn: (msg) => Toast.show(msg, 'warn'),

    /** @param {string} msg */
    error: (msg) => Toast.show(msg, 'error')
};
