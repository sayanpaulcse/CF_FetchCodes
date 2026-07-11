/**
 * =============================================================================
 * CF FetchCodes — Main Entry Point
 * =============================================================================
 * Click-triggered architecture:
 *   - On page load: only injects the sidebar box + modal (zero API calls)
 *   - On "Show Codes" click: starts two-phase discovery
 *
 * Two-phase discovery:
 *   Phase 1 (Fast Discovery):
 *     Uses contest.standings API to check ALL friends in 1 call.
 *     Classifies friends into: solvers, non-solvers, non-participants.
 *
 *   Phase 2 (Detail Fetch):
 *     2a: For confirmed solvers → fetch submission ID + language
 *     2b: For non-participants → check individually via contest.status
 *
 *   Fallback:
 *     If contest.standings fails, falls back to sequential per-friend approach.
 *
 * Depends on: All other modules (constants, utils, chat-manager, api, ui)
 * =============================================================================
 */

/** @type {boolean} Guard flag — prevents re-fetching on repeated "Show Codes" clicks */
let _fetchStarted = false;

/** @type {string|null} Contest ID extracted from the current page URL */
let _contestId = null;

/** @type {string|null} Problem index extracted from the current page URL */
let _problemId = null;

/**
 * Sequentially check a list of friends for accepted submissions.
 * Used for Phase 2b (non-participants) and the full fallback path.
 *
 * @param {Array<Object>} friendsList - Friends to check
 * @param {string} contestId
 * @param {string} problemId
 * @param {Object} progressState - Mutable progress counter
 * @param {number} progressState.checked - Current count (mutated in place)
 * @param {number} progressState.total - Total to check
 * @param {string} [phaseLabel] - Label prefix for progress display
 */
async function checkFriendsSequentially(friendsList, contestId, problemId, progressState, phaseLabel) {
    for (const friend of friendsList) {
        // Rate-limiting: longer pause between batches, human-like within batches
        if (progressState.checked > 0 && progressState.checked % CONFIG.batchSize === 0) {
            await Utils.sleep(CONFIG.batchRestTime);
        } else {
            await Utils.humanSleep();
        }

        const subData = await API.getSubmissionData(contestId, problemId, friend.handle);

        if (subData) {
            UI.addFriendToList(friend, contestId, subData.id, subData.language);
        }

        progressState.checked++;
        const label = phaseLabel
            ? `${phaseLabel}: ${progressState.checked} / ${progressState.total}`
            : undefined;
        UI.updateProgress(progressState.checked, progressState.total, label);
    }
}

/**
 * Called by the "Show Codes" button in ui.js. Fetches friends and discovers
 * accepted solutions using the two-phase approach. Only runs once per page —
 * subsequent clicks just show the already-populated modal.
 */
async function startFetching() {
    if (_fetchStarted) return;
    _fetchStarted = true;

    const contestId = _contestId;
    const problemId = _problemId;

    Logger.info(`Starting discovery for contest ${contestId}, problem ${problemId}`);

    // -------------------------------------------------------------------------
    // Fetch friends list
    // -------------------------------------------------------------------------
    const friends = await API.getFriendsList();
    if (friends.length === 0) {
        UI.updateProgress(0, 0);
        const textEl = document.getElementById(UI.progressTextId);
        if (textEl) textEl.innerText = "No friends found.";
        Logger.info("No friends found.");
        return;
    }

    const totalFriends = friends.length;
    Logger.info(`Found ${totalFriends} friends.`);

    // Build a case-insensitive lookup: lowercase handle → friend object
    const friendsByHandle = new Map();
    for (const f of friends) {
        friendsByHandle.set(f.handle.toLowerCase(), f);
    }
    const allHandles = friends.map(f => f.handle);

    // -------------------------------------------------------------------------
    // Phase 1: Fast discovery via contest.standings
    // -------------------------------------------------------------------------
    UI.updateProgress(0, totalFriends, `Analyzing standings for ${totalFriends} friends...`);
    const standings = await API.getContestStandings(contestId, problemId, allHandles);

    if (standings) {
        // ----- Optimized two-phase path -----
        const { solvers, participants } = standings;

        // Classify friends into three groups
        const solverFriends = [];
        const nonParticipants = [];
        let confirmedNonSolverCount = 0;

        for (const friend of friends) {
            const key = friend.handle.toLowerCase();
            if (solvers.has(key)) {
                solverFriends.push(friend);
            } else if (participants.has(key)) {
                // In standings but didn't solve → confirmed skip
                confirmedNonSolverCount++;
            } else {
                // Not in standings → might have solved via practice
                nonParticipants.push(friend);
            }
        }

        const totalToCheck = solverFriends.length + nonParticipants.length;

        Logger.info(
            `Standings result: ${solverFriends.length} solvers, ` +
            `${confirmedNonSolverCount} confirmed non-solvers (skipped), ` +
            `${nonParticipants.length} non-participants (need practice check)`
        );

        const progress = { checked: 0, total: totalToCheck };

        // -----------------------------------------------------------------
        // Phase 2a: Fetch submission IDs for confirmed solvers (fast)
        // -----------------------------------------------------------------
        if (solverFriends.length > 0) {
            Logger.info(`Phase 2a: Fetching details for ${solverFriends.length} solvers...`);
            for (const friend of solverFriends) {
                // Lighter delay — we know they solved, just need submission ID
                await Utils.sleep(400);

                const subData = await API.getSubmissionData(contestId, problemId, friend.handle);
                if (subData) {
                    UI.addFriendToList(friend, contestId, subData.id, subData.language);
                }

                progress.checked++;
                UI.updateProgress(
                    progress.checked,
                    progress.total,
                    `Fetching solver details: ${progress.checked} / ${progress.total}`
                );
            }
        }

        // -----------------------------------------------------------------
        // Phase 2b: Check non-participants for practice solutions
        // -----------------------------------------------------------------
        if (nonParticipants.length > 0) {
            Logger.info(`Phase 2b: Checking ${nonParticipants.length} non-participants for practice solutions...`);
            Utils.shuffleArray(nonParticipants);
            await checkFriendsSequentially(
                nonParticipants, contestId, problemId, progress,
                "Checking practice submissions"
            );
        }

        // Done
        UI.updateProgress(progress.total, progress.total);

    } else {
        // ----- Fallback: standings API unavailable -----
        Logger.info("Standings API unavailable (gym/private contest?) — using sequential fallback.");
        Utils.shuffleArray(friends);

        const progress = { checked: 0, total: totalFriends };
        await checkFriendsSequentially(friends, contestId, problemId, progress);
    }

    Logger.info("Done checking all friends.");
}

/**
 * Extension entry point. Only injects the UI — makes ZERO API calls.
 * Fetching starts when the user clicks "Show Codes".
 */
function initExtension() {
    _contestId = Utils.getContestIdFromUrl();
    _problemId = Utils.getProblemIdFromUrl();

    if (!_contestId || !_problemId) {
        Logger.info("Not a problem page — extension inactive.");
        return;
    }

    Logger.info(`Ready on contest ${_contestId}, problem ${_problemId} — waiting for user to click "Show Codes".`);
    UI.init();
}

// Launch (UI only — no API calls)
initExtension();
