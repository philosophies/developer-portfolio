import React, {useState, useRef, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {detectFixture,boxStyle} from './detection.js';
import './style.css';
function App(){
 const [url,setUrl]=useState('https://example.com/sample.jpg');
 const [result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const controller=useRef(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function submit(event){event.preventDefault();controller.current?.abort();const active=new AbortController();controller.current=active;setBusy(true);setError('');setResult(null);
 try{const data=await detectFixture(url,{signal:active.signal});if(controller.current===active)setResult(data)}catch(e){if(e.name!=='AbortError')setError(e.message)}finally{if(controller.current===active)setBusy(false)} }
 return <main><p>SMART-BRAIN / MIGRATION PROTOTYPE</p><h1>A smaller, testable detection flow.</h1><p>AI-assisted modernization experiment based on the earlier Smart-Brain project. Synthetic output only: this does not recognize faces or load your image.</p><form onSubmit={submit}><label htmlFor="image">Public HTTPS image URL (validation only)</label><input id="image" type="url" value={url} onChange={e=>setUrl(e.target.value)} required/><button disabled={busy}>{busy?'Checking…':'Run synthetic example'}</button></form><p role="alert">{error}</p>{result&&<section><div className="frame" aria-label="Illustrative synthetic detection frame"><span>ILLUSTRATION / NO IMAGE FETCHED</span>{result.boxes.map((box,i)=><div key={i} className="box" style={boxStyle(box)} />)}</div><p role="status">One synthetic bounding box. No identity inferred. No information saved.</p></section>}<p>Remaining migration: authenticated Express API, PostgreSQL migrations, account ownership checks and a server-only provider adapter.</p><a href="https://github.com/philosophies/Smart-Brain">Original repository</a></main>
}
createRoot(document.getElementById('root')).render(<App/>);
