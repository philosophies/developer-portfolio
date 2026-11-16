import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { detectFixture, boxStyle } from './detection.js';
import './style.css';
function App() {
  const [url, setUrl] = useState('https://example.com/sample.jpg');
  const [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(event) {
    event.preventDefault();
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const data = await detectFixture(url, { signal: active.signal });
      if (controller.current === active) setResult(data);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      if (controller.current === active) setBusy(false);
    }
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
            setResult(null);
            setError('');
          }}
          required
        />
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
            One synthetic bounding box. No identity inferred. No information saved.
          </p>
        </section>
      )}
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
