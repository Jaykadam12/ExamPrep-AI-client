// Auto-normalize API base URL: handles trailing slashes and missing /api path cleanly
const rawBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api")
  .trim()
  .replace(/\/+$/, "");
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  return res.json();
}

export async function analyzeTextContent({ text, instructions, title }) {
  const res = await fetch(`${API_BASE_URL}/sessions/text-and-analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, instructions, title }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to analyze text content");
  }

  return res.json();
}

export async function uploadAndAnalyzePDF({ file, instructions, title }) {
  const formData = new FormData();
  formData.append("file", file);
  if (instructions) formData.append("instructions", instructions);
  if (title) formData.append("title", title);

  const res = await fetch(`${API_BASE_URL}/sessions/upload-and-analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to analyze study material");
  }

  return res.json();
}

export async function fetchSession(sessionId) {
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to fetch study session");
  }
  return res.json();
}

export async function updateSessionPreferences(sessionId, instructions) {
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/instructions`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructions }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update study instructions");
  }
  return res.json();
}

export async function fetchDetailedAnswer(questionId, forceRegenerate = false) {
  const res = await fetch(`${API_BASE_URL}/questions/${questionId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forceRegenerate }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to generate detailed answer");
  }
  return res.json();
}

export async function sendChatMessage(sessionId, { message, selectedQuestion }) {
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, selectedQuestion }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to communicate with AI tutor");
  }
  return res.json();
}

export default {
  checkHealth,
  analyzeTextContent,
  uploadAndAnalyzePDF,
  fetchSession,
  updateSessionPreferences,
  fetchDetailedAnswer,
  sendChatMessage,
};
