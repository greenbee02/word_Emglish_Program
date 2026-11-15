export function emptyState() {
  return {
    words: [],
    imports: [],
    sessions: [],
    settings: { dailyNew: 10, dailyReview: 30, speechVoice: '', speechRate: 0.82 },
  };
}

export function validateState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, message: 'state must be an object' };
  }
  for (const field of ['words', 'imports', 'sessions']) {
    if (!Array.isArray(value[field])) return { valid: false, message: `${field} must be an array` };
  }
  if (!value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings)) {
    return { valid: false, message: 'settings must be an object' };
  }
  return { valid: true };
}
