import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { boxStyle } from './detection.js';
import { createDetectionSession } from './session.js';
import './style.css';
function App() {
  const [url, setUrl] = useState('https://example.com/sample.jpg');
  const [fixture, setFixture] = useState('single');
  const [session] = useState(createDetectionSession);
  const [{ result, error, busy, history }, setState] = useState(session.snapshot);
  useEffect(() => {
    const unsubscribe = session.subscribe(setState);
    return () => {
      unsubscribe();
      session.dispose();
    };
  }, [session]);
  function submit(event) {
    event.preventDefault();
    void session.run(url, fixture);
  }
  function download() {
    const payload = { schemaVersion: 1, source: 'synthetic fixture', fixture, boxes: result.boxes };
    const address = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = address;
    link.download = 'synthetic-detection.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(address), 1000);
  }
  return (
    <main>
      <header>
        <a href="https://cody-developer-portfolio.jones-cody.workers.dev/">
          ← Cody Jones / Portfolio
        </a>
        <span>SMART-BRAIN / ADAPTER LAB</span>
      </header>
      <p className="eyebrow">ONE BOUNDARY AT A TIME</p>
      <h1>Detection adapter lab.</h1>
      <p className="intro">
        A focused migration experiment: validate an input, map normalized bounds, and keep the
        external provider behind a testable interface.
      </p>
      <aside>
        <strong>Synthetic sample.</strong> No image is loaded, no face is recognized, and no
        identity is inferred.
      </aside>
      <form onSubmit={submit}>
        <label htmlFor="image">HTTPS image URL (validation only)</label>
        <input
          id="image"
          type="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            session.invalidate();
          }}
          required
        />
        <label htmlFor="fixture">Synthetic sample</label>
        <select
          id="fixture"
          value={fixture}
          onChange={(event) => {
            setFixture(event.target.value);
            session.invalidate();
          }}
        >
          <option value="single">One box</option>
          <option value="pair">Two boxes</option>
          <option value="empty">No detections</option>
        </select>
        <button disabled={busy}>{busy ? 'Checking…' : 'Run synthetic example'}</button>
      </form>
      <p className={error ? 'error' : ''} role="alert">
        {error}
      </p>
      {result && (
        <section>
          <div className="frame" aria-label="Illustrative synthetic detection frame">
            <span>ILLUSTRATION / NO IMAGE FETCHED</span>
            {result.boxes.map((box, i) => (
              <div key={i} className="box" style={boxStyle(box)} />
            ))}
          </div>
          <p role="status">
            {result.boxes.length === 0
              ? 'No synthetic detections.'
              : `${result.boxes.length} synthetic bounding ${result.boxes.length === 1 ? 'box' : 'boxes'}.`}{' '}
            No identity inferred. Nothing is sent to a server.
          </p>
          <button type="button" className="secondary" onClick={download}>
            Download synthetic result
          </button>
        </section>
      )}
      <section className="history" aria-label="Session history">
        <h2>This session</h2>
        <p>
          Last five completed samples, kept only in this tab. URLs are excluded from history and
          downloads.
        </p>
        {history.length ? (
          <ol>
            {history.map((item, index) => (
              <li key={index}>
                {item.fixture} sample · {item.count} {item.count === 1 ? 'box' : 'boxes'}
              </li>
            ))}
          </ol>
        ) : (
          <p>No completed samples yet.</p>
        )}
        <button type="button" className="secondary" onClick={() => session.clear()}>
          Clear session
        </button>
      </section>
      <footer>
        <p>
          Next: authenticated account flows, database migrations, and a server-only provider
          adapter. The original app is unchanged.
        </p>
        <a href="https://github.com/philosophies/Smart-Brain">Original repository ↗</a>
      </footer>
    </main>
  );
}
createRoot(document.getElementById('root')).render(<App />);
