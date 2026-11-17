import { detectFixture } from './detection.js';

export function createDetectionSession(detect = detectFixture) {
  let state = { busy: false, error: '', result: null, history: [] };
  let active = null;
  const listeners = new Set();
  function publish(patch) {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  }
  function invalidate() {
    active?.abort();
    active = null;
    publish({ result: null, error: '', busy: false });
  }
  return {
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    invalidate,
    clear() {
      invalidate();
      publish({ history: [] });
    },
    dispose() {
      active?.abort();
      active = null;
      listeners.clear();
    },
    async run(url, fixture = 'single') {
      active?.abort();
      const request = new AbortController();
      active = request;
      publish({ busy: true, error: '', result: null });
      try {
        const result = await detect(url, { signal: request.signal, fixture });
        if (active !== request) return;
        publish({
          result,
          history: [{ fixture, count: result.boxes.length }, ...state.history].slice(0, 5),
        });
      } catch (error) {
        if (active === request && error.name !== 'AbortError') publish({ error: error.message });
      } finally {
        if (active === request) {
          active = null;
          publish({ busy: false });
        }
      }
    },
  };
}
