/**
 * =============================================================================
 * CF FetchCodes — API Layer
 * =============================================================================
 * Codeforces data fetching: friends list, submission data, and source code.
 * Depends on: constants.js (CONFIG, STATUS), utils.js (Utils, Logger)
 * =============================================================================
 */

const API = {
    /**
     * Fetch the current user's friends list by scraping the /friends page.
     * @returns {Promise<Array<{handle: string, cssClass: string}>>}
     */
    getFriendsList: async () => {
        try {
            const res = await fetch(`${CONFIG.cfBaseUrl}/friends`);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const friendsElements = Array.from(doc.querySelectorAll('.datatable .rated-user'));
            return friendsElements.map(el => ({
                handle: el.innerText.trim(),
                cssClass: el.className
            }));
        } catch (err) {
            Logger.info("Failed to fetch friends list:", err);
            return [];
        }
    },

    /**
     * Check if a friend has an accepted submission for a given problem.
     * @param {string} contestId
     * @param {string} problemId - Problem index (e.g., "A", "B1")
     * @param {string} handle - Friend's Codeforces handle
     * @returns {Promise<{id: string, language: string}|null>}
     */
    getSubmissionData: async (contestId, problemId, handle) => {
        try {
            const url = `${CONFIG.apiBaseUrl}/contest.status?contestId=${contestId}&handle=${encodeURIComponent(handle)}`;
            const res = await fetch(url);

            // Guard against 502/503 HTML error pages from CF
            if (!res.ok) {
                Logger.info(`contest.status returned ${res.status} for ${handle} — skipping`);
                return null;
            }

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                Logger.info(`contest.status returned non-JSON for ${handle} — skipping`);
                return null;
            }

            const data = await res.json();
            if (data.status === "OK" && data.result) {
                const accepted = data.result.find(sub =>
                    sub.contestId == contestId &&
                    sub.problem.index == problemId &&
                    sub.verdict === "OK"
                );
                if (accepted) {
                    return { id: accepted.id, language: accepted.programmingLanguage };
                }
            }
            return null;
        } catch (err) {
            Logger.info(`Submission check failed for ${handle} — skipping`);
            return null;
        }
    },

    /**
     * Fast discovery: check which friends solved a problem using contest.standings.
     *
     * The CF API forbids extra parameters (handles, showUnofficial) for non-gym
     * contests when called by non-admin users. So we fetch the FULL standings
     * with just `contestId` (anonymous, no cookies), then filter for friends
     * client-side using a Set for O(1) lookups.
     *
     * This means only official participants appear — virtual/practice solvers
     * are NOT in these standings. They are caught by Phase 2b (individual check).
     *
     * Returns null on failure — the caller MUST fall back to sequential checking
     * to guarantee no solutions are missed.
     *
     * @param {string} contestId
     * @param {string} problemId - Problem index (e.g., "A", "B1")
     * @param {Array<string>} handles - List of friend handles (used for client-side filtering)
     * @returns {Promise<{solvers: Set<string>, participants: Set<string>}|null>}
     *   - solvers: friend handles (lowercase) who solved this problem
     *   - participants: friend handles (lowercase) who appear in standings
     *   - null if the API call fails (caller should use fallback)
     */
    getContestStandings: async (contestId, problemId, handles) => {
        try {
            // Build a Set of friend handles for fast client-side filtering
            const friendSet = new Set(handles.map(h => h.toLowerCase()));

            // Anonymous request with ONLY contestId — no extra params allowed by CF
            const url = `${CONFIG.apiBaseUrl}/contest.standings?contestId=${contestId}`;
            const res = await fetch(url, { credentials: 'omit' });

            if (!res.ok) {
                Logger.info(`contest.standings returned ${res.status} — will use fallback`);
                return null;
            }

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                Logger.info("contest.standings returned non-JSON — will use fallback");
                return null;
            }

            const data = await res.json();

            if (data.status !== "OK" || !data.result) {
                Logger.info("contest.standings unavailable — will use fallback");
                return null;
            }

            // Find the index of the current problem in the problems array
            const problemIndex = data.result.problems.findIndex(
                p => p.index === problemId
            );

            if (problemIndex === -1) {
                Logger.info(`Problem ${problemId} not found in standings — will use fallback`);
                return null;
            }

            const solvers = new Set();
            const participants = new Set();

            // Scan all rows, but only track friends (skip everyone else)
            for (const row of data.result.rows) {
                if (!row.party || !row.party.members || row.party.members.length === 0) continue;

                const handle = row.party.members[0].handle.toLowerCase();

                // Skip non-friends — vast majority of rows
                if (!friendSet.has(handle)) continue;

                participants.add(handle);

                const result = row.problemResults[problemIndex];
                if (result && result.points > 0) {
                    solvers.add(handle);
                }
            }

            Logger.info(
                `Standings: scanned ${data.result.rows.length} participants, ` +
                `found ${participants.size} friends (${solvers.size} solved)`
            );

            return { solvers, participants };

        } catch (err) {
            Logger.info("contest.standings error — will use fallback");
            return null;
        }
    },

    /**
     * Fetch the source code of a specific submission by scraping the submission page.
     * Uses DOM parsing for robustness over regex matching.
     *
     * @param {string} contestId
     * @param {string} submissionId
     * @returns {Promise<{status: string, content?: string}>}
     */
    fetchCode: async (contestId, submissionId) => {
        try {
            await Utils.sleep(200);
            const url = `${CONFIG.cfBaseUrl}/contest/${contestId}/submission/${submissionId}`;
            const res = await fetch(url);

            // Detect auth redirect
            if (res.redirected) {
                const newUrl = new URL(res.url);
                if (newUrl.pathname === '/' || newUrl.pathname.includes('/enter')) {
                    return { status: STATUS.AUTH_ERROR };
                }
            }

            const text = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const sourceElement = doc.getElementById('program-source-text');

            if (sourceElement) {
                return { status: STATUS.OK, content: sourceElement.innerHTML };
            }

            // Fallback auth detection from page content
            if (text.includes('href="/enter?back') || text.includes('class="register-link"')) {
                return { status: STATUS.AUTH_ERROR };
            }

            return { status: STATUS.LOCKED_ERROR };

        } catch (e) {
            Logger.info("Fetch code error:", e);
            return { status: STATUS.GENERIC_ERROR };
        }
    }
};
