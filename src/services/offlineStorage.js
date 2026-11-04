/**
 * Offline Storage & Session Cache Manager
 * Uses localStorage with key prefixing and fallback protection.
 */

const STORAGE_KEYS = {
  CURRENT_SESSION: "examprep_current_session",
  SESSION_LIST: "examprep_session_history",
  DETAILED_ANSWERS_CACHE: "examprep_cached_answers",
  CHAT_MESSAGES_CACHE: "examprep_cached_chat",
};

/**
 * Save current active study session snapshot
 */
export function saveLocalSession({
  sessionId,
  sessionData,
  questions = [],
  selectedQuestion = null,
  messages = [],
  sessionTitle = "",
  studyInstructions = "",
  activeTab = "important",
}) {
  try {
    const payload = {
      sessionId,
      sessionData,
      questions,
      selectedQuestion,
      messages,
      sessionTitle,
      studyInstructions,
      activeTab,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(payload));

    // Also update lightweight session history list for quick switching
    if (sessionId) {
      updateSessionHistoryList({
        id: sessionId,
        title: sessionTitle || sessionData?.title || "Study Session",
        questionCount: questions.length,
        savedAt: payload.savedAt,
      });
    }
  } catch (err) {
    console.warn("[OfflineCache] Failed to save session snapshot:", err);
  }
}

/**
 * Load the last saved study session from local storage
 */
export function loadLocalSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.warn("[OfflineCache] Failed to load session snapshot:", err);
    return null;
  }
}

/**
 * Save / cache detailed answer for a specific question ID
 */
export function cacheDetailedAnswer(questionId, answer) {
  if (!questionId || !answer) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DETAILED_ANSWERS_CACHE) || "{}";
    const cache = JSON.parse(raw);
    cache[String(questionId)] = {
      answer,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.DETAILED_ANSWERS_CACHE, JSON.stringify(cache));
  } catch (err) {
    console.warn("[OfflineCache] Failed to cache detailed answer:", err);
  }
}

/**
 * Get cached detailed answer for a question
 */
export function getCachedDetailedAnswer(questionId) {
  if (!questionId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DETAILED_ANSWERS_CACHE) || "{}";
    const cache = JSON.parse(raw);
    return cache[String(questionId)]?.answer || null;
  } catch (err) {
    return null;
  }
}

/**
 * Keep a list of recent sessions in localStorage
 */
function updateSessionHistoryList(item) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION_LIST) || "[]";
    const list = JSON.parse(raw);
    const filtered = list.filter((s) => s.id !== item.id);
    const updated = [item, ...filtered].slice(0, 10); // keep last 10
    localStorage.setItem(STORAGE_KEYS.SESSION_LIST, JSON.stringify(updated));
  } catch (err) {
    // Ignore quota errors
  }
}

/**
 * Clear cached session
 */
export function clearLocalSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
  } catch (err) {}
}

export default {
  saveLocalSession,
  loadLocalSession,
  cacheDetailedAnswer,
  getCachedDetailedAnswer,
  clearLocalSession,
};
