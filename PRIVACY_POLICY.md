# Privacy Policy for CF FetchCodes

**Effective Date:** July 23, 2026  
**Last Updated:** July 23, 2026

CF FetchCodes ("we", "our", or "the extension") is a Google Chrome browser extension designed to enhance the Codeforces platform by allowing users to view their friends' accepted solutions and interact with an AI code explainer.

We are deeply committed to protecting your privacy and ensuring transparency about how data is handled. This Privacy Policy is robust, exhaustive, and complies with the Google Chrome Web Store Developer Program Policies. By installing and using CF FetchCodes, you agree to the practices described in this policy.

---

## 1. Information We Do NOT Collect

We believe in maximum privacy. To that end, CF FetchCodes is designed as a **local-first extension**:
*   **No Personal Data Collection:** We do not collect, harvest, log, or transmit any personally identifiable information (PII) such as your name, email address, passwords, or browsing history.
*   **No Telemetry or Analytics:** We do not embed any third-party analytics trackers, crash reporting tools (e.g., Google Analytics, Sentry), or usage monitoring scripts. We do not track how often you use the extension or what buttons you click.
*   **No External Servers:** We do not own, operate, or route your data through any proprietary backend servers. All data processing occurs locally within your browser or is sent directly to the official third-party APIs required for functionality.

## 2. Information Stored Locally on Your Device

To function correctly and save your preferences, the extension stores certain data locally on your device using Chrome's built-in `chrome.storage.local` API. This data never leaves your computer unless explicitly transmitted to a necessary third-party service (see Section 3).

Locally stored data includes:
*   **Gemini API Key:** If you choose to use the AI Code Explainer features, you must provide your own Google Gemini API key. This key is saved strictly in your local browser storage.
*   **User Preferences:** Your UI preferences, such as Dark Mode toggles, Code Theme selections, chosen AI Model, and custom AI Prompts.
*   **Session Caches:** The extension temporarily caches fetched codes and AI chat histories in memory (and `chrome.storage.local`) to provide a fast experience when switching between friends' solutions. This cache can be cleared at any time by closing the browser or manually clearing extension data.

## 3. Data Transmitted to Third Parties

Because CF FetchCodes integrates Codeforces data and Google Gemini AI, it must communicate directly with their respective servers.

### A. Codeforces (https://codeforces.com)
The extension makes HTTPS requests directly to Codeforces to fetch:
*   **Public Contest Data:** Utilizing the official Codeforces API (`/api/contest.standings`) to determine which of your friends have solved the current problem.
*   **Submission Code:** Scraping the public submission pages of your friends to retrieve their accepted code.
*   *Note:* The extension uses your active Codeforces login session cookie to identify your friends list. We do not have access to your Codeforces password.

### B. Google Generative AI (https://generativelanguage.googleapis.com)
When you click the "Explain" button or use the right-click "Explain code with AI" context menu, the extension transmits data directly to Google's Gemini API. The data sent includes:
*   Your stored Gemini API Key (for authentication).
*   The specific code snippet or full solution you requested an explanation for.
*   The system prompt configured in your extension settings.
*   *Note:* How Google handles this data is governed by the [Google API Terms of Service](https://developers.google.com/terms) and [Google Privacy Policy](https://policies.google.com/privacy).

## 4. Permissions Required and Justifications

CF FetchCodes requires specific browser permissions to function. We only request the minimum permissions necessary:
*   `storage`: Used exclusively to save your settings, theme preferences, and your Gemini API key locally on your device.
*   `contextMenus`: Used to add the "Explain code with AI" option when you right-click on selected text.
*   `host_permissions` (`https://codeforces.com/*` and `https://generativelanguage.googleapis.com/*`): Required to inject the sidebar UI into Codeforces problem pages, fetch your friends' public submissions, and communicate securely with the Gemini AI API.

## 5. Security Measures

*   **Direct API Calls:** Your Gemini API key is never routed through a proxy server. It is sent securely via HTTPS directly from your browser to Google.
*   **Local Storage:** Settings are stored in Chrome's sandboxed local storage, which cannot be accessed by other websites you visit.
*   **No Code Execution:** Fetched friend codes are rendered strictly as plain text/HTML using Google Code Prettify. They are never executed as scripts in your browser context.

## 6. User Control and Data Deletion

You have complete control over your data:
*   **Clear API Key:** You can delete your Gemini API key at any time by opening the extension popup, deleting the text in the API key field, and clicking "Save Settings".
*   **Uninstalling:** If you uninstall the CF FetchCodes extension, all locally stored data, preferences, and caches associated with it are automatically deleted by the Chrome browser.

## 7. Children's Privacy

CF FetchCodes is not directed at children under the age of 13, and we do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information (which is impossible by design, as we do not collect personal data), please contact us, though we have no servers from which to delete data.

## 8. Changes to This Privacy Policy

We reserve the right to update this Privacy Policy to reflect changes in our practices, Chrome Web Store policies, or legal requirements. When we do, we will revise the "Last Updated" date at the top of this document. We encourage you to review this policy periodically.

## 9. Contact Us

If you have any questions, concerns, or feedback regarding this Privacy Policy or the privacy practices of CF FetchCodes, please contact the developer:
*   **Email:** sayanpauldeveloper@gmail.com
*   **GitHub:** [CF_FetchCodes Repository](https://github.com/sayanpaulcse/CF_FetchCodes)