# CF FetchCodes — Architecture & Code Flow Documentation

> Internal technical documentation for contributors and maintainers.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Module Dependency Graph](#module-dependency-graph)
3. [Core Data Flow](#core-data-flow)
4. [Two-Phase Discovery Algorithm](#two-phase-discovery-algorithm)
5. [AI Chat System](#ai-chat-system)
6. [API Layer Reference](#api-layer-reference)
7. [UI Component Hierarchy](#ui-component-hierarchy)
8. [CSS Architecture](#css-architecture)
9. [Chrome Extension Integration](#chrome-extension-integration)
10. [Security Considerations](#security-considerations)
11. [Rate Limiting Strategy](#rate-limiting-strategy)

---

## Project Structure

```
CF_FetchCodes/
├── manifest.json                        # Chrome MV3 manifest
├── README.md                            # User-facing documentation
│
├── assets/                              # Extension icons (16–128px)
│   ├── icon16.png
│   ├── icon20.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon64.png
│   ├── icon_96_96.png
│   └── icon_128_128.png
│
├── src/
│   ├── background/
│   │   └── service-worker.js            # Context menu registration & messaging
│   │
│   ├── content/
│   │   ├── modules/
│   │   │   ├── constants.js             # CONFIG, STATUS enum, caches
│   │   │   ├── utils.js                 # Logger, Utils, Toast
│   │   │   ├── chat-manager.js          # AI chat UI + Gemini streaming
│   │   │   ├── api.js                   # CF data fetching layer
│   │   │   └── ui.js                    # Modal, accordion, code rendering
│   │   └── main.js                      # Entry point + orchestration
│   │
│   ├── popup/
│   │   ├── popup.html                   # Extension popup page
│   │   ├── popup.js                     # Settings load/save logic
│   │   └── popup.css                    # Popup styles
│   │
│   ├── lib/
│   │   ├── prettify.js                  # Google Code Prettify (syntax highlighting)
│   │   └── prettify.css                 # Prettify theme
│   │
│   └── styles/
│       ├── content.css                  # All content script styles
│       └── code-themes.css              # Dark mode syntax themes (Monokai, Dracula, etc.)
│
└── docs/
    ├── ARCHITECTURE.md                  # This file
    └── Images/                          # Screenshots for docs
```

### Why No Bundler?

Chrome MV3 content scripts listed in `manifest.json` are loaded **in array order** and
share the same execution scope. This gives us module-like separation without requiring
Webpack, Rollup, or any build step. The load order is:

```
constants.js → utils.js → chat-manager.js → api.js → ui.js → main.js → prettify.js
```

Each file only references globals declared in files loaded before it.

---

## Module Dependency Graph

```
┌──────────────┐
│  constants   │  CONFIG, STATUS, CODE_CACHE, CHAT_HISTORY
└──────┬───────┘
       │
┌──────▼───────┐
│    utils     │  Logger, Utils, Toast
└──┬───┬───┬───┘
   │   │   │
   │   │   └──────────────────────────────┐
   │   │                                  │
┌──▼───▼───────┐  ┌───────────┐   ┌──────▼───────┐
│ chat-manager │  │    api    │   │      ui      │
│              │  │           │   │              │
│ ChatManager  │  │ API       │   │ UI           │
│ - openChat   │  │ - friends │   │ - modal      │
│ - streaming  │  │ - status  │   │ - accordion  │
│ - markdown   │  │ - standings│  │ - progress   │
│ - drag/min   │  │ - code    │   │ - code render│
└──────────────┘  └─────┬─────┘   └──────┬───────┘
                        │                │
                  ┌─────▼────────────────▼──┐
                  │         main.js         │
                  │                         │
                  │ initExtension()         │
                  │ - two-phase discovery   │
                  │ - sequential fallback   │
                  └─────────────────────────┘
```

---

## Core Data Flow

### End-to-End Flow (User visits a problem page)

```
User visits codeforces.com/contest/1234/problem/A
        │
        ▼
┌─ Content Scripts Injected ──────────────────────────────────────────┐
│                                                                     │
│  1. main.js → initExtension()                                       │
│     ├── Extract contestId=1234, problemId=A from URL                │
│     ├── UI.init() → inject sidebar box + modal                      │
│     └── API.getFriendsList() → scrape /friends page                 │
│                                                                     │
│  2. Phase 1: API.getContestStandings(1234, "A", handles[])          │
│     └── GET contest.standings?contestId=1234&handles=...            │
│         ├── solvers: Set{"tourist", "jiangly"}                      │
│         ├── participants: Set{"tourist", "jiangly", "um_nik", ...}  │
│         └── non-participants: friends NOT in standings               │
│                                                                     │
│  3. Phase 2a: For each solver → API.getSubmissionData()             │
│     └── GET contest.status?contestId=1234&handle=tourist            │
│         └── {id: 28374651, language: "GNU C++20"}                   │
│         └── UI.addFriendToList(friend, 1234, 28374651, "GNU C++20") │
│                                                                     │
│  4. Phase 2b: For each non-participant → API.getSubmissionData()    │
│     └── Same as 2a, checking for practice solutions                 │
│                                                                     │
│  5. User clicks friend name → UI.toggleCode()                       │
│     └── API.fetchCode(1234, 28374651)                               │
│         └── Scrape HTML → extract #program-source-text              │
│         └── UI.renderCode() + PR.prettyPrint()                      │
│                                                                     │
│  6. User clicks "🤖 Explain" → ChatManager.openChat()               │
│     └── Gemini API streaming → parseMarkdown() → UI                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Two-Phase Discovery Algorithm

The core optimization that makes the extension fast.

### Problem with Naive Approach

```
80 friends × 1 API call each × ~1.7s delay = ~136 seconds
```

Most friends haven't solved the problem, so most calls return nothing.

### Two-Phase Solution

```
Phase 1: contest.standings (1 API call, ~200ms)
│
├── INPUT:  80 friend handles
├── OUTPUT: { solvers: 5, participants: 60, non-participants: 20 }
│
├── 55 friends confirmed as non-solvers → SKIPPED (zero API calls)
│
Phase 2a: Fetch solver details (5 API calls, ~400ms each = ~2s)
│
├── INPUT:  5 confirmed solvers
├── OUTPUT: submissionId + language for each
│
Phase 2b: Check non-participants (20 API calls, ~1.7s each = ~34s)
│
├── INPUT:  20 friends not in standings (possible practice solvers)
├── OUTPUT: any additional solutions found
│
TOTAL: 1 + 5 + 20 = 26 API calls (~36s vs ~136s)
```

### Zero-Miss Guarantee

| Friend Category        | How Detected                          | Miss Possible? |
|------------------------|---------------------------------------|----------------|
| Solved during contest  | Phase 1 standings                     | No             |
| Virtual participation  | Phase 1 (`showUnofficial=true`)       | No             |
| Practice solver        | Phase 2b individual check             | No             |
| Standings API fails    | Full fallback to sequential           | No             |
| Non-solver participant | Skipped (confirmed by standings)      | N/A            |

### Handle Batching

The `handles` parameter in `contest.standings` is URL-encoded, so large friend lists
could exceed URL length limits. Handles are batched in groups of **100** with a 300ms
delay between batches.

### Fallback Path

If `contest.standings` returns an error (gym contests, private contests, CF API outage),
the extension silently falls back to the original sequential per-friend approach. The
user sees the same progress bar — they never know the optimization failed.

---

## AI Chat System

### Architecture

```
ChatManager
├── openChat(chatId, contextData)        # Create or restore chat window
├── createChatUI(chatId)                 # DOM injection + event wiring
│   ├── Draggable (mousedown/move/up via addEventListener)
│   ├── Minimizable (toggle CSS classes)
│   ├── Resizable (CSS resize: both)
│   ├── Auto-growing textarea (input event → height recalc)
│   └── Copy-to-clipboard delegation
├── sendUserMessage(chatId, text)        # API call + streaming
│   ├── chrome.storage.local.get(['geminiApiKey', 'geminiModel'])
│   ├── POST /v1beta/models/{model}:streamGenerateContent
│   ├── ReadableStream reader loop
│   ├── Regex parser: /"text":\s*"(.*?)(?<!\\)"/g
│   └── Incremental UI updates via updateMessageUI()
├── parseMarkdown(text)                  # Custom markdown → HTML
│   ├── Fenced code blocks → PR.prettyPrintOne()
│   ├── **bold**, *italic*, `inline code`
│   ├── Headers (# ## ###)
│   ├── Unordered lists (- or *)
│   └── HTML escaping (security)
└── CHAT_HISTORY (Map)                   # Per-chat conversation state
```

### Streaming Flow

```
Gemini API Response (chunked JSON array)
        │
        ▼
  ReadableStream.read()
        │
        ▼
  Append to buffer string
        │
        ▼
  Regex: /"text":\s*"(.*?)(?<!\\)"/g
        │
        ▼
  Utils.unescapeJson(match) → plaintext
        │
        ▼
  Accumulate into fullText
        │
        ▼
  ChatManager.parseMarkdown(fullText) → HTML
        │
        ▼
  aiMsgDiv.innerHTML = html  (live update)
```

### Error Handling

All error messages use markdown syntax (`**⚠ Error:** message`) instead of raw HTML.
This is because `parseMarkdown()` HTML-escapes all `<` and `>` before processing
markdown. Using markdown bold ensures errors render as styled text, not raw tags.

---

## API Layer Reference

### `API.getFriendsList()`

| Property | Value |
|----------|-------|
| Method | HTML scraping |
| URL | `codeforces.com/friends` |
| Selector | `.datatable .rated-user` |
| Returns | `[{ handle, cssClass }]` |
| Failure | Returns `[]` |

### `API.getContestStandings(contestId, problemId, handles[])`

| Property | Value |
|----------|-------|
| Method | REST API |
| URL | `codeforces.com/api/contest.standings` |
| Params | `contestId`, `handles` (semicolon-sep), `showUnofficial=true` |
| Returns | `{ solvers: Set, participants: Set }` or `null` |
| Batching | 100 handles per request, 300ms between |
| Failure | Returns `null` → triggers sequential fallback |

### `API.getSubmissionData(contestId, problemId, handle)`

| Property | Value |
|----------|-------|
| Method | REST API |
| URL | `codeforces.com/api/contest.status` |
| Params | `contestId`, `handle` |
| Filter | `verdict === "OK"` && matching `problemId` |
| Returns | `{ id, language }` or `null` |

### `API.fetchCode(contestId, submissionId)`

| Property | Value |
|----------|-------|
| Method | HTML scraping |
| URL | `codeforces.com/contest/{id}/submission/{id}` |
| Selector | `#program-source-text` |
| Returns | `{ status, content? }` |
| Statuses | `OK`, `AUTH_ERROR`, `LOCKED_ERROR`, `GENERIC_ERROR` |
| Cache | Results cached in `CODE_CACHE` Map |

---

## UI Component Hierarchy

```
Codeforces Problem Page
│
├── #sidebar
│   └── "→ Accepted Codes of Friends" box
│       └── "Show Codes" link → opens modal
│
├── #cf_friends_modal (overlay)
│   └── .modalContent
│       ├── .modalHeaderContainer
│       │   ├── .modalCodeHeader (title)
│       │   ├── .progress-info (text: "Checking friends: 5/80")
│       │   └── .progress-track → .progress-fill (animated bar)
│       │
│       └── #cf_friends_list_container (scrollable)
│           └── .accordion-item (one per solver)
│               ├── .accordion-header (click to toggle)
│               │   ├── .friend-name.friend-profile-link (colored by rating)
│               │   └── .friend-status-info (language + ▼)
│               └── .accordion-content (lazy-loaded)
│                   ├── .cf-code-toolbar
│                   │   ├── .cf-btn-explain (🤖 Explain)
│                   │   └── .cf-btn-view-original (View Original ↗)
│                   └── pre.prettyprint (syntax-highlighted code)
│
└── .cf-ai-chat-window (fixed, draggable, resizable)
    ├── .cf-ai-header (drag handle + window controls)
    ├── .cf-ai-body
    │   ├── .cf-ai-messages (scrollable)
    │   │   ├── .cf-msg.user (right-aligned blue bubble)
    │   │   ├── .cf-msg.model (left-aligned white bubble)
    │   │   └── .cf-msg.loading-placeholder (bouncing dots)
    │   └── .cf-ai-input-area
    │       ├── textarea (auto-growing, Enter=send, Shift+Enter=newline)
    │       └── button ➤ (send)
    └── .cf-toast-container (top-right notification stack)
```

---

## CSS Architecture

The stylesheet (`src/styles/content.css`) is organized into numbered sections:

| # | Section | Purpose |
|---|---------|--------|
| 1 | Modal Overlay & Container | Full-screen backdrop, modal box |
| 2 | Modal Header & Progress Bar | Title, progress text, animated fill bar |
| 3 | Accordion List | Friend cards, expand/collapse, hover states |
| 4 | Code Display & Prettyprint | Source code blocks, loading spinner |
| 5 | Status Banners | Auth error, locked, fallback (BEM naming) |
| 6 | Code Toolbar | Explain/View Original buttons |
| 7 | Sidebar Injection | "Show Codes" link styling |
| 8 | AI Chat Window | Fixed position, resizable, minimize states |
| 9 | Chat Messages | User/model/system bubble styles |
| 10 | Chat Input Area | Auto-growing textarea, send button |
| 11 | Markdown Rendering | Code blocks, inline code, headers, lists |
| 12 | Prettyprint Overrides | High-contrast syntax colors for chat |
| 13 | Typing Indicator | Bouncing dots animation |
| 14 | Window Controls | Minimize/close button styles |
| 15 | Toast Notifications | Slide-in/out notification stack |
| 16 | Page Dark Mode | Comprehensive dark mode via `[data-cf-dark]` attribute selector |
| 17–19 | Extension UI Dark Mode | Modal, chat window, toast dark mode |
| 20 | Dark Mode Refinements | Nav bar, sidebar, test cases, submit page fixes |

A separate file `src/styles/code-themes.css` provides 6 syntax themes (Monokai, Dracula, Solarized Dark, Nord, GitHub Dark, One Dark) activated via `[data-cf-code-theme]`.

### Dark Mode Strategy

- Page dark mode sets `data-cf-dark="true"` on `<html>`, scoping all CSS via `[data-cf-dark="true"]`.
- A `MutationObserver` in `ui.js` mirrors CF's test-case hover highlighting to work with `!important` overrides.
- Code-only dark mode uses `data-cf-code-dark` + `data-cf-code-theme` attributes.
- Popup toggles save to `chrome.storage.local`; `ui.js` listens via `chrome.storage.onChanged` for instant updates.

### Naming Conventions

- **`cf-`** prefix for all custom classes (avoids conflicts with Codeforces CSS)
- **BEM** for component variants: `.cf-status-banner--error`, `.cf-status-banner__title`
- **CSS-only states**: `.window-minimized`, `.minimized`, `.active`

---

## Chrome Extension Integration

### Manifest V3 Architecture

```
┌─────────────────────────────────┐
│       Background (Service Worker)│
│  src/background/service-worker.js│
│                                  │
│  • Registers context menu        │
│  • Sends messages to content     │
│    scripts on menu click         │
└──────────┬──────────────────────┘
           │ chrome.tabs.sendMessage()
           ▼
┌──────────────────────────────────┐
│       Content Scripts            │
│  (injected into CF pages)        │
│                                  │
│  constants → utils → chat →      │
│  api → ui → main                 │
│                                  │
│  • Full DOM access               │
│  • chrome.storage.local          │
│  • chrome.runtime.onMessage      │
└──────────────────────────────────┘
           ▲
           │ User clicks extension icon
           │
┌──────────┴──────────────────────┐
│       Popup                      │
│  src/popup/popup.html            │
│                                  │
│  • API key input                 │
│  • Model selection               │
│  • Custom prompt editing         │
│  • Dark mode toggles             │
│  • Settings saved to             │
│    chrome.storage.local          │
└──────────────────────────────────┘
```

### Permissions

| Permission | Why |
|-----------|-----|
| `storage` | Save API key, model name, custom prompts |
| `contextMenus` | "Explain code with AI" right-click menu |
| `host: codeforces.com/*` | Scrape friends page, submission pages |
| `host: generativelanguage.googleapis.com/*` | Gemini API calls |

### Content Script ↔ Background Communication

```
User right-clicks selected text on Codeforces
        │
        ▼
Background: chrome.contextMenus.onClicked
        │ chrome.tabs.sendMessage({
        │   action: "trigger_snippet_explain",
        │   selection: "selected text..."
        │ })
        ▼
Content Script: chrome.runtime.onMessage
        │
        ▼
ChatManager.openChat(newId, { prompt, context })
```

---

## Security Considerations

| Threat | Mitigation |
|--------|-----------|
| XSS via friend handles | `Utils.escapeHtml()` before `innerHTML` injection |
| XSS via AI responses | `parseMarkdown()` escapes all `<`, `>`, `&` before processing |
| API key exposure | Stored in `chrome.storage.local` (encrypted at rest by Chrome), only sent to `generativelanguage.googleapis.com` |
| CSRF on CF pages | Extension runs as content script with same-origin cookies — same risk as normal browsing |
| Rate-limit bans | Human-like delays (1.5s ± 500ms jitter), batch pauses every 10 requests |

---

## Rate Limiting Strategy

Codeforces enforces rate limits on their API. The extension uses a multi-layer strategy:

### Delay Tiers

| Context | Delay | Rationale |
|---------|-------|-----------|
| Phase 2a (confirmed solvers) | 400ms fixed | Minimal set, low risk |
| Phase 2b / fallback (per friend) | 1500ms + 0–500ms jitter | Mimics human browsing |
| Between batches (every 10 requests) | 4000ms pause | Longer cooldown |
| Between standings batches | 300ms | Single lightweight call |
| Before code page scrape | 200ms | One-off fetch, low frequency |

### CONFIG Constants

```javascript
CONFIG = {
    baseDelay: 1500,       // Base delay between per-friend checks (ms)
    randomJitter: 500,     // Random 0–500ms added to baseDelay
    batchSize: 10,         // Pause after this many consecutive checks
    batchRestTime: 4000    // Longer pause between batches (ms)
}
```

---

*Last updated: July 2026 — v26.7.9*
