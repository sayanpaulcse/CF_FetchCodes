# CF FetchCodes

> View your Codeforces friends' accepted solutions + AI-powered code explanations — right on the problem page.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-blue?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/cf-fetchcodes/ombmefkchmjbodcoboeagbpaejfojnga)
[![YouTube](https://img.shields.io/badge/YouTube-Watch%20Demo-red?logo=youtube)](https://www.youtube.com/watch?v=gcQwU1W23x8)

---

## What It Does

Stuck on a Codeforces problem? Wondering how your friends solved it?

**CF FetchCodes** adds a sidebar widget on every problem page that lets you:

- 📋 **See which friends solved the problem** — auto-detected from your CF friends list
- 💻 **Read their code** with syntax highlighting — right on the page, no navigation needed
- 🤖 **Ask AI to explain any solution** — built-in Gemini-powered chat explainer
- ✂️ **Explain selected code snippets** — right-click any selected text on Codeforces

---

## Installation

### From Chrome Web Store (Recommended)

1. Visit the [Chrome Web Store listing](https://chromewebstore.google.com/detail/cf-fetchcodes/ombmefkchmjbodcoboeagbpaejfojnga)
2. Click **"Add to Chrome"** → **"Add extension"**
3. Done! The extension icon appears in your toolbar

### From Source (Developer)

1. Clone this repository
2. Open `chrome://extensions` → enable **Developer mode**
3. Click **Load unpacked** → select this project folder
4. Navigate to any Codeforces problem page

---

## How to Use

### 1. Add Friends on Codeforces

The extension uses your Codeforces friends list. If you haven't added friends yet:

1. Go to any user's profile on Codeforces
2. Click the **⭐ Star** button next to their handle

<img src="docs/Images/friendButton.png" alt="Add Friend" width="320"/>

### 2. View Friends' Solutions

1. Open any problem page (e.g., `codeforces.com/contest/1234/problem/A`)
2. Find **"→ Accepted Codes of Friends"** in the right sidebar
3. Click **"Show Codes"**

<img src="docs/Images/newTheme.png" alt="Friends modal with progress bar" width="600"/>

4. The extension checks your friends and shows who solved it
5. Click any friend's name to expand and view their code

<img src="docs/Images/changeLog2.png" alt="Expanded code view" width="600"/>

### 3. AI Code Explainer

Click the **🤖 Explain** button above any friend's code to open an AI chat that:
- Analyzes the solution approach
- Explains the time/space complexity
- Answers follow-up questions

**Setup required:** Click the extension icon in the toolbar and paste your [Gemini API key](https://aistudio.google.com/app/apikey).

### 4. Right-Click Snippet Explain

Select any text on a Codeforces page → right-click → **"Explain code with AI"** to get an instant explanation.

---

## AI Settings

Click the extension icon in the toolbar to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| 🔑 **Gemini API Key** | Your Google AI Studio API key | *(required)* |
| 🤖 **AI Model** | Gemini model name | `gemini-2.5-flash` |
| 📝 **Full Code Prompt** | System prompt for full code explanations | Analyze approach + complexity |
| ✂️ **Snippet Prompt** | System prompt for right-click snippet explanations | Explain logic + syntax |

---

## Privacy & Safety

- **No external servers** — all processing happens locally in your browser
- **Anti-ban architecture** — human-like delays and smart batching prevent rate-limiting
- **Two-phase discovery** — uses `contest.standings` API for bulk checking, minimizing API calls
- **API key stored locally** — your Gemini key is saved in `chrome.storage.local`, never transmitted anywhere except Google's Gemini API

---

## Prerequisites

- Google Chrome (or any Chromium-based browser)
- A Codeforces account with friends added
- *(Optional)* A [Gemini API key](https://aistudio.google.com/app/apikey) for AI features

---

## Release Notes

### v26.7.9 (Latest)
- **Two-Phase Discovery** — uses `contest.standings` for instant friend checking (10x faster)
- **AI Code Explainer** — built-in Gemini chat for understanding solutions
- **Right-Click Explain** — select code → right-click → explain with AI
- **Modular Architecture** — codebase split into focused modules under `src/`
- **Toast Notifications** — non-intrusive feedback replaces browser alerts
- **Auto-Growing Chat Input** — textarea that expands as you type, Shift+Enter for newlines

### v25.11.21
- New accordion UI with scrollable list
- Smart caching — re-opening code is instant
- Progress bar for friend checking status
- Safety-first batching system

### v0.1.0
- Syntax highlighting for friend solutions
- Navigation links to profiles and submissions

---

## Contributing

Issues, feature requests, and pull requests are welcome at the [GitHub repository](https://github.com/sa-paul/CF_FetchCodes).

## Contact

📧 [sayanpauldeveloper@gmail.com](mailto:sayanpauldeveloper@gmail.com)

---

**Happy upsolving!** 🚀