import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, FileText, History, LayoutDashboard, LoaderCircle, Menu, Plus, Send, Sparkles, Upload, X } from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const sample = `We need an e-commerce website where customers can register, log in, browse products, add products to cart and place orders. Admin should manage products and orders. Customers should receive order notifications. The website should support online payments and be mobile-friendly. Users should also be able to track their orders. The website should be fast and secure.`;

function App() {
  const [text, setText] = useState('');
  const [source, setSource] = useState('Pasted requirements');
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [active, setActive] = useState('workspace');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadHistory = async () => { try { const res = await fetch(`${API}/analyses`); if (res.ok) setHistory(await res.json()); } catch { /* backend may not be started yet */ } };
  useEffect(() => { loadHistory(); }, []);

  const analyze = async () => {
    if (text.trim().length < 20) return setNotice({ type: 'error', message: 'Add at least 20 characters of requirements first.' });
    setLoading(true); setNotice(null);
    try {
      const res = await fetch(`${API}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, source_name: source }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.detail || 'Analysis failed');
      setAnalysis(data); setActive('workspace'); await loadHistory();
    } catch (error) { setNotice({ type: 'error', message: `${error.message}. Is the FastAPI server running?` }); }
    finally { setLoading(false); }
  };

  const upload = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    setLoading(true); setNotice(null);
    const body = new FormData(); body.append('file', file);
    try { const res = await fetch(`${API}/extract`, { method: 'POST', body }); const data = await res.json(); if (!res.ok) throw new Error(data.detail); setText(data.text); setSource(data.source_name); setNotice({ type: 'success', message: `${file.name} loaded. Review the text, then run analysis.` }); }
    catch (error) { setNotice({ type: 'error', message: error.message || 'Could not read that file.' }); }
    finally { setLoading(false); event.target.value = ''; }
  };

  const selectHistory = async (id) => { const res = await fetch(`${API}/analyses/${id}`); if (res.ok) { const data = await res.json(); setAnalysis(data); setText(data.requirement_text); setSource(data.source_name); setActive('workspace'); } };
  const loadSample = () => { setText(sample); setSource('Sample client requirement'); setNotice({ type: 'success', message: 'Sample requirement loaded.' }); };

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><Sparkles size={18}/></span><span>requirement<span className="accent">lens</span></span></div><div className="sidebar-label">Workspace</div><button className={active === 'workspace' ? 'nav active' : 'nav'} onClick={() => setActive('workspace')}><LayoutDashboard size={18}/> Analyzer</button><button className={active === 'history' ? 'nav active' : 'nav'} onClick={() => setActive('history')}><History size={18}/> Saved analyses <span className="count">{history.length}</span></button><div className="sidebar-bottom"><div className="status-dot"><span/> API ready</div><div className="stack-note">React · FastAPI · SQLite<br/>AI-assisted documentation</div></div></aside>
    <main className="main"><header className="topbar"><div className="mobile-brand"><span className="brand-mark"><Sparkles size={16}/></span> requirement<span className="accent">lens</span></div><div className="crumb">{active === 'history' ? 'Saved analyses' : 'Analyzer'} <span>/</span> {analysis ? 'Analysis result' : 'New analysis'}</div><button className="icon-button"><Menu size={20}/></button></header>
      {active === 'history' ? <HistoryView history={history} onSelect={selectHistory}/> : <>
        <section className="hero"><div><div className="eyebrow"><span className="eyebrow-line"/> AI REQUIREMENT ANALYZER</div><h1>Turn client words into<br/><em>build-ready clarity.</em></h1><p>Paste a requirement or upload a document. Requirement Lens finds what matters, what’s missing, and what your team should build next.</p></div><div className="hero-art"><div className="orb orb-one"/><div className="orb orb-two"/><ClipboardList size={70} strokeWidth={1.1}/><span className="art-label">STRUCTURE<br/>FROM CHAOS</span></div></section>
        <section className="input-card"><div className="card-heading"><div><span className="step">01</span><h2>Bring in your requirements</h2></div><button className="sample-link" onClick={loadSample}>Try sample requirement <ArrowRight size={15}/></button></div><div className="input-tabs"><button className="tab active"><FileText size={16}/> Paste text</button><label className="tab upload-tab"><Upload size={16}/> Upload PDF / TXT<input type="file" accept=".pdf,.txt,text/plain,application/pdf" onChange={upload}/></label></div><textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste the client’s raw requirements here…"/><div className="input-footer"><span>{text.length.toLocaleString()} characters</span><button className="analyze-button" disabled={loading} onClick={analyze}>{loading ? <><LoaderCircle className="spin" size={17}/> Working…</> : <><Sparkles size={17}/> Analyze requirements</>}</button></div></section>
        {notice && <div className={`notice ${notice.type}`}><span>{notice.type === 'success' ? <CheckCircle2 size={17}/> : <AlertTriangle size={17}/>}</span>{notice.message}<button onClick={() => setNotice(null)}><X size={16}/></button></div>}
        {analysis ? <Results data={analysis} /> : <section className="empty-state"><div className="empty-icon"><Sparkles size={22}/></div><h3>Your structured brief will appear here</h3><p>Run an analysis to generate objectives, features, user stories, acceptance criteria, and test cases.</p><div className="chips"><span>Objectives</span><span>Requirements</span><span>User stories</span><span>Test cases</span></div></section>}
      </>}
    </main>
  </div>
}

function Results({ data }) { const r = data.result; return <section className="results"><div className="result-header"><div><div className="eyebrow"><span className="eyebrow-line"/> ANALYSIS COMPLETE</div><h2>Project documentation</h2><p>Generated from <strong>{data.source_name}</strong> · {new Date(data.created_at).toLocaleString()}</p></div><span className="mode-badge">{r.analysis_mode === 'openai' ? 'OpenAI powered' : 'Demo analysis'}</span></div><div className="overview-grid"><div className="overview-card dark"><span className="card-kicker">PROJECT OVERVIEW</span><p>{r.project_overview}</p></div><div className="overview-card"><span className="card-kicker">OBJECTIVES</span><ul>{r.objectives?.map((x, i) => <li key={i}>{x}</li>)}</ul></div></div><div className="section-block"><SectionTitle n="02" title="Feature breakdown"/><div className="feature-grid">{r.features?.map((x, i) => <div className="feature" key={i}><span className="feature-num">0{i + 1}</span><div><h3>{x.name}</h3><p>{x.description}</p></div><span className={`priority ${x.priority?.toLowerCase().replaceAll(' ', '-')}`}>{x.priority}</span></div>)}</div></div><div className="two-col"><div className="section-block"><SectionTitle n="03" title="Requirements"/><List title="Functional" items={r.functional_requirements}/><List title="Non-functional" items={r.non_functional_requirements}/></div><div className="section-block"><SectionTitle n="04" title="Needs clarification"/><List title="Missing information" items={r.missing_information} warning/><List title="Ambiguities" items={r.ambiguous_requirements} warning/></div></div><div className="section-block"><SectionTitle n="05" title="User stories & acceptance criteria"/>{r.user_stories?.map(story => <div className="story" key={story.id}><div className="story-top"><span className="story-id">{story.id}</span><h3>{story.title}</h3></div><p>As a <strong>{story.as_a}</strong>, I want <strong>{story.i_want}</strong>, so that <strong>{story.so_that}</strong>.</p><div className="criteria">{story.acceptance_criteria?.map((x, i) => <span key={i}><CheckCircle2 size={14}/>{x}</span>)}</div></div>)}</div><div className="section-block"><SectionTitle n="06" title="Basic test cases"/><div className="table-wrap"><table><thead><tr><th>ID</th><th>Scenario</th><th>Steps</th><th>Expected result</th><th>Priority</th></tr></thead><tbody>{r.test_cases?.map(x => <tr key={x.id}><td><code>{x.id}</code></td><td>{x.scenario}</td><td>{x.steps}</td><td>{x.expected}</td><td><span className="table-priority">{x.priority}</span></td></tr>)}</tbody></table></div></div></section> }
function SectionTitle({ n, title }) { return <div className="section-title"><span className="step">{n}</span><h2>{title}</h2></div> }
function List({ title, items = [], warning }) { return <div className="list-block"><h3>{warning ? <AlertTriangle size={15}/> : <CheckCircle2 size={15}/>} {title}</h3>{items.map((x, i) => <div className="list-item" key={i}><span>{i + 1}</span>{x}</div>)}</div> }
function HistoryView({ history, onSelect }) { return <div className="history-view"><div className="eyebrow"><span className="eyebrow-line"/> LIBRARY</div><h1>Saved analyses</h1><p className="history-intro">Your previous requirement briefs, ready to revisit.</p>{history.length ? <div className="history-list">{history.map(item => <button className="history-item" key={item.id} onClick={() => onSelect(item.id)}><span className="history-icon"><FileText size={19}/></span><span className="history-copy"><strong>{item.source_name}</strong><small>{new Date(item.created_at).toLocaleString()} · {item.result?.features?.length || 0} features identified</small></span><ArrowRight size={17}/></button>)}</div> : <div className="empty-history"><History size={28}/><h3>No saved analyses yet</h3><p>Run your first analysis and it will show up here.</p></div>}</div> }

createRoot(document.getElementById('root')).render(<App />);
