/**
 * =============================================================================
 * CF FetchCodes — Constants & Enums
 * =============================================================================
 * Shared configuration, status codes, and runtime caches.
 * Loaded first — all other modules depend on these globals.
 * =============================================================================
 */

"use strict";

/** @type {Readonly<Object>} Extension configuration */
const CONFIG = Object.freeze({
    cfBaseUrl: "https://codeforces.com",
    apiBaseUrl: "https://codeforces.com/api",
    baseDelay: 1500,
    randomJitter: 500,
    batchSize: 10,
    batchRestTime: 4000,
    toastDuration: 3500
});

/**
 * Status codes returned by API.fetchCode().
 * Using an enum-like frozen object prevents typos and enables IDE autocomplete.
 * @enum {string}
 */
const STATUS = Object.freeze({
    OK: "OK",
    AUTH_ERROR: "AUTH_ERROR",
    LOCKED_ERROR: "LOCKED_ERROR",
    GENERIC_ERROR: "GENERIC_ERROR"
});

/** @type {Map<string, string>} Cache of fetched source code, keyed by submissionId */
const CODE_CACHE = new Map();

/** @type {Map<string, Array<Object>>} Chat history per chat instance, keyed by chatId */
const CHAT_HISTORY = new Map();
