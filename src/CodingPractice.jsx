import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Clock3, Code2, ExternalLink, Play, RotateCcw, Square, Timer, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { currentUser, useStore } from './store/useStore';
import { service } from './services/api';
import { estimateGrowth, normalizeOutput, PRACTICE_PROBLEMS, STARTER_CODE } from './lib/codingPractice';

const errorMessage = error => error.response?.data?.error?.message || error.message || 'Could not run Java code.';
const todayKey = () => new Date().toLocaleDateString();
const formatDuration = seconds => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

function loadSavedCode(userId) {
  return localStorage.getItem(`skillmesh-practice-code-${userId}-java`)
    || localStorage.getItem(`skillmesh-practice-code-${userId}-62`)
    || STARTER_CODE.java;
}

function loadTimer(key) {
  const saved = localStorage.getItem(key);
  if (!saved) return { active: false, elapsedSeconds: 0, baseSeconds: 0, startedAt: null };
  try {
    const timer = JSON.parse(saved);
    if (timer.active && Number.isFinite(timer.startedAt) && Number.isFinite(timer.baseSeconds)) {
      return {
        active: true,
        startedAt: timer.startedAt,
        baseSeconds: timer.baseSeconds,
        elapsedSeconds: timer.baseSeconds + Math.floor((Date.now() - timer.startedAt) / 1000),
      };
    }
    if (Number.isFinite(timer.elapsedSeconds) && timer.elapsedSeconds > 0) {
      return { active: false, elapsedSeconds: timer.elapsedSeconds, baseSeconds: timer.elapsedSeconds, startedAt: null };
    }
  } catch (error) {
    console.error('Could not restore the coding practice timer:', error.message);
  }
  return { active: false, elapsedSeconds: 0, baseSeconds: 0, startedAt: null };
}

function CodePractice() {
  const store = useStore();
  const user = currentUser(store);
  const [activeTab, setActiveTab] = useState('practice');
  const [problemId, setProblemId] = useState(PRACTICE_PROBLEMS[0].id);
  const problem = PRACTICE_PROBLEMS.find(item => item.id === problemId);
  const codeKey = `skillmesh-practice-code-${user.id}-java`;
  const [code, setCode] = useState(() => loadSavedCode(user.id));
  const playgroundCodeKey = `skillmesh-playground-code-${user.id}-java`;
  const [playgroundCode, setPlaygroundCode] = useState(() => localStorage.getItem(playgroundCodeKey) || STARTER_CODE.java);
  const [playgroundInput, setPlaygroundInput] = useState('');
  const [playgroundResult, setPlaygroundResult] = useState(null);
  const [playgroundError, setPlaygroundError] = useState('');
  const [playgroundRunning, setPlaygroundRunning] = useState(false);
  const [customInput, setCustomInput] = useState(problem.sampleInput);
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [benchmarkText, setBenchmarkText] = useState('');
  const timerKey = `skillmesh-practice-timer-${user.id}`;
  const [timer, setTimer] = useState(() => loadTimer(timerKey));
  const [timerMessage, setTimerMessage] = useState('');

  const todayMinutes = useMemo(() => store.codingPracticeSessions
    .filter(session => session.userId === user.id && new Date(session.completedAt).toLocaleDateString() === todayKey())
    .reduce((total, session) => total + session.minutes, 0), [store.codingPracticeSessions, user.id]);
  const weeklyMinutes = useMemo(() => {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    return store.codingPracticeSessions
      .filter(session => session.userId === user.id && new Date(session.completedAt) >= weekStart)
      .reduce((total, session) => total + session.minutes, 0);
  }, [store.codingPracticeSessions, user.id]);

  useEffect(() => {
    localStorage.setItem(codeKey, code);
  }, [code, codeKey]);

  useEffect(() => {
    localStorage.setItem(playgroundCodeKey, playgroundCode);
  }, [playgroundCode, playgroundCodeKey]);

  useEffect(() => {
    localStorage.setItem(timerKey, JSON.stringify(timer));
  }, [timer, timerKey]);

  useEffect(() => {
    setCustomInput(problem.sampleInput);
    setResults([]);
    setBenchmarkText('');
  }, [problem]);

  useEffect(() => {
    if (!timer.active) return undefined;
    const interval = window.setInterval(() => {
      setTimer(current => current.active
        ? { ...current, elapsedSeconds: current.baseSeconds + Math.floor((Date.now() - current.startedAt) / 1000) }
        : current);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timer.active]);

  const runCode = async stdin => {
    return service.executePracticeCode(code, stdin);
  };

  const runPlayground = async () => {
    setPlaygroundRunning(true);
    setPlaygroundError('');
    setPlaygroundResult(null);
    try {
      setPlaygroundResult(await service.executePracticeCode(playgroundCode, playgroundInput));
    } catch (error) {
      setPlaygroundError(errorMessage(error));
    } finally {
      setPlaygroundRunning(false);
    }
  };

  const runSample = async () => {
    setRunning(true);
    setRunError('');
    setResults([]);
    setBenchmarkText('');
    try {
      const result = await runCode(customInput);
      const isSampleInput = normalizeOutput(customInput) === normalizeOutput(problem.sampleInput);
      setResults([{
        ...result,
        expected: isSampleInput ? problem.sampleOutput : null,
        passed: result.statusId === 3 && (!isSampleInput || normalizeOutput(result.stdout) === normalizeOutput(problem.sampleOutput)),
      }]);
    } catch (error) {
      setRunError(errorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  const runAllTests = async () => {
    setRunning(true);
    setRunError('');
    setResults([]);
    setBenchmarkText('');
    try {
      const outputs = [];
      for (const test of problem.testCases) {
        const result = await runCode(test.input);
        outputs.push({
          ...result,
          expected: test.output,
          passed: result.statusId === 3 && normalizeOutput(result.stdout) === normalizeOutput(test.output),
        });
      }
      setResults(outputs);
    } catch (error) {
      setRunError(errorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  const runBenchmark = async () => {
    setRunning(true);
    setRunError('');
    setBenchmarkText('');
    setResults([]);
    try {
      const sizes = [100, 500, 2000];
      const measurements = [];
      for (const size of sizes) {
        const result = await runCode(problem.benchmarkInput(size));
        if (result.statusId !== 3 || !Number.isFinite(Number(result.time))) {
          throw new Error(`Benchmark stopped at input size ${size}: ${result.status}.`);
        }
        measurements.push({ size, seconds: Number(result.time) });
      }
      const trend = estimateGrowth(measurements) || 'Browser timing resolution was too coarse for an estimate';
      setBenchmarkText(`${trend}. Measurements are noisy and cannot prove Big-O.`);
    } catch (error) {
      setRunError(errorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  const toggleTimer = () => {
    setTimerMessage('');
    if (!timer.active) {
      setTimer(current => ({ active: true, elapsedSeconds: current.elapsedSeconds, baseSeconds: current.elapsedSeconds, startedAt: Date.now() }));
      return;
    }
    setTimer(current => ({
      active: false,
      elapsedSeconds: current.baseSeconds + Math.floor((Date.now() - current.startedAt) / 1000),
      baseSeconds: current.baseSeconds + Math.floor((Date.now() - current.startedAt) / 1000),
      startedAt: null,
    }));
  };

  const finishSession = async () => {
    const totalSeconds = timer.active
      ? timer.baseSeconds + Math.floor((Date.now() - timer.startedAt) / 1000)
      : timer.elapsedSeconds;
    const minutes = Math.floor(totalSeconds / 60);
    setTimer({ active: false, elapsedSeconds: 0, baseSeconds: 0, startedAt: null });
    if (minutes < 1) {
      setTimerMessage('A session must be at least one minute to save.');
      return;
    }
    store.addCodingPracticeSession({ problem: problem.title, minutes });
    setTimerMessage(`${minutes} minute${minutes === 1 ? '' : 's'} saved to your practice history.`);
    if (!user.email?.endsWith('@skillmesh.demo')) {
      try {
        await service.logProfileActivity({ category: 'Coding practice', minutes });
      } catch (error) {
        toast.error(`Practice time was saved on this device, but not to your profile: ${errorMessage(error)}`);
      }
    }
  };

  const resetCode = () => {
    setCode(STARTER_CODE.java);
  };

  return <div className="coding-practice">
    <header className="practice-heading">
      <div>
        <div className="practice-eyebrow"><Code2 size={14}/> STUDENT WORKSPACE</div>
        <h1>Coding practice</h1>
        <p>Practice algorithms, compile Java online, and track your focused time.</p>
      </div>
      <div className="practice-time-summary"><Clock3 size={17}/><span>Today <b>{todayMinutes} min</b></span><i/><span>This week <b>{weeklyMinutes} min</b></span></div>
    </header>

    <div className="practice-mode-tabs" role="tablist" aria-label="Coding workspace">
      <button type="button" role="tab" aria-selected={activeTab === 'practice'} className={activeTab === 'practice' ? 'active' : ''} onClick={() => setActiveTab('practice')}>
        <Trophy size={15}/> Practice set
      </button>
      <button type="button" role="tab" aria-selected={activeTab === 'playground'} className={activeTab === 'playground' ? 'active' : ''} onClick={() => setActiveTab('playground')}>
        <Code2 size={15}/> Playground
      </button>
    </div>

    {activeTab === 'practice' ? <>
    <div className="practice-layout">
      <aside className="practice-sidebar">
        <section className="practice-sidebar-card">
          <div className="practice-section-title"><Timer size={16}/> Focus timer</div>
          <div className="practice-timer-display" aria-live="polite">{formatDuration(timer.elapsedSeconds)}</div>
          <div className="practice-timer-actions">
            <button type="button" className="btn btn-primary" onClick={toggleTimer}>{timer.active ? 'Pause' : timer.elapsedSeconds ? 'Resume' : 'Start session'}</button>
            <button type="button" className="btn btn-secondary" disabled={!timer.elapsedSeconds && !timer.active} onClick={finishSession}><Square size={13}/> Finish</button>
          </div>
          {timerMessage && <p className="practice-timer-message" role="status">{timerMessage}</p>}
        </section>

        <section className="practice-sidebar-card">
          <div className="practice-section-title"><Trophy size={16}/> Practice set</div>
          <div className="practice-problem-list">
            {PRACTICE_PROBLEMS.map((item, index) => <button key={item.id} type="button" className={`practice-problem-choice ${item.id === problemId ? 'active' : ''}`} onClick={() => setProblemId(item.id)}>
              <span className="practice-problem-number">{String(index + 1).padStart(2, '0')}</span>
              <span><b>{item.title}</b><small>{item.difficulty} · {item.topic}</small></span>
            </button>)}
          </div>
        </section>

        <section className="practice-sidebar-card">
          <div className="practice-section-title"><ExternalLink size={16}/> Practice platforms</div>
          <p>Open a platform problem, then use the workspace to test your solution with custom input.</p>
          <div className="practice-platform-links">{problem.platforms.map(platform => <a key={platform.name} href={platform.url} target="_blank" rel="noreferrer">{platform.name}<ArrowUpRight size={13}/></a>)}</div>
        </section>
      </aside>

      <main className="practice-main">
        <section className="practice-problem-panel">
          <div className="practice-problem-heading"><div><span className="badge badge-purple">{problem.difficulty}</span><span className="practice-topic">{problem.topic}</span></div><span className="practice-original-label">SkillMesh practice</span></div>
          <h2>{problem.title}</h2>
          <p>{problem.statement}</p>
          <div className="practice-input-format"><b>Input format</b><span>{problem.inputFormat}</span></div>
          <div className="practice-samples"><div><b>Sample input</b><pre>{problem.sampleInput}</pre></div><div><b>Expected output</b><pre>{problem.sampleOutput}</pre></div></div>
          <div className="practice-complexity-hint"><b>Expected solution complexity</b><span>{problem.expectedComplexity}</span></div>
        </section>

        <section className="practice-editor-panel">
          <div className="practice-editor-toolbar">
            <span className="badge badge-purple">Java 25</span>
            <button type="button" className="btn btn-secondary practice-reset" onClick={resetCode}><RotateCcw size={13}/> Starter</button>
          </div>
          <textarea className="practice-code-editor" aria-label="Code editor" spellCheck="false" autoCapitalize="off" autoCorrect="off" value={code} onChange={event => setCode(event.target.value)} />
          <div className="practice-input-editor">
            <label htmlFor="practice-stdin">Custom input</label>
            <textarea id="practice-stdin" className="textarea" value={customInput} onChange={event => setCustomInput(event.target.value)} spellCheck="false"/>
          </div>
          <div className="practice-run-actions">
            <button type="button" className="btn btn-primary" disabled={running || !code.trim()} onClick={runSample}><Play size={14}/>{running ? 'Running…' : 'Run input'}</button>
            <button type="button" className="btn btn-secondary" disabled={running || !code.trim()} onClick={runAllTests}><Check size={14}/>Run sample tests</button>
            <button type="button" className="btn btn-secondary" disabled={running || !code.trim()} onClick={runBenchmark}><Clock3 size={14}/>Benchmark growth</button>
          </div>
          <p className="practice-sandbox-note">Java 25 runs on OnlineCompiler.io. Your code and input are sent to the compiler service to execute; do not include passwords, API keys, or other secrets. Use <code>public class Main</code> and standard Java libraries.</p>
          <p className="practice-demo-note">Runs are securely isolated by OnlineCompiler.io. The API key is stored on the SkillMesh backend and is never sent to your browser.</p>
          {runError && <p className="practice-run-error" role="alert">{runError}</p>}
          {benchmarkText && <div className="practice-benchmark-result"><b>Observed input-growth trend</b><span>{benchmarkText}</span><small>This is a benchmark estimate, not a proof of algorithmic complexity. Use the expected Big-O guidance above for the theoretical analysis.</small></div>}
          {results.map((result, index) => <article className={`practice-result ${result.passed ? 'passed' : 'failed'}`} key={`${index}-${result.status}`}>
            <div className="practice-result-heading"><b>{result.statusId !== 3 ? result.status : result.expected === null ? 'Execution succeeded' : result.passed ? 'Accepted' : 'Output differs'}</b><span>{results.length > 1 ? `Test ${index + 1}` : 'Run result'}</span></div>
            <div className="practice-metrics"><span>Execution time <b>{result.time !== null && result.time !== undefined ? `${Number(result.time).toFixed(3)} s` : 'Not reported'}</b></span><span>Process memory <b>{result.memory !== null && result.memory !== undefined ? `${Number(result.memory).toLocaleString()} KB` : 'Not reported'}</b></span></div>
            <label>Output</label><pre>{result.stdout || result.stderr || result.compileOutput || result.message || '(no output)'}</pre>
            {result.statusId === 3 && result.expected !== null && !result.passed && <><label>Expected</label><pre>{result.expected}</pre></>}
          </article>)}
          <p className="practice-complexity-disclaimer">Execution time and memory are reported by the compiler service. Big-O is theoretical and cannot be inferred exactly from one run.</p>
        </section>
      </main>
    </div>
    </> : <section className="practice-editor-panel practice-playground" role="tabpanel">
      <div className="practice-playground-heading">
        <div>
          <h2>Java playground</h2>
          <p>Write and run your own Java program with custom input.</p>
        </div>
        <span className="badge badge-purple">Java 25</span>
      </div>
      <textarea className="practice-code-editor" aria-label="Playground Java code editor" spellCheck="false" autoCapitalize="off" autoCorrect="off" value={playgroundCode} onChange={event => setPlaygroundCode(event.target.value)} />
      <div className="practice-input-editor">
        <label htmlFor="playground-stdin">Custom input</label>
        <textarea id="playground-stdin" className="textarea" value={playgroundInput} onChange={event => setPlaygroundInput(event.target.value)} spellCheck="false" />
      </div>
      <div className="practice-run-actions">
        <button type="button" className="btn btn-primary" disabled={playgroundRunning || !playgroundCode.trim()} onClick={runPlayground}>
          <Play size={14}/>{playgroundRunning ? 'Running…' : 'Run Java'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={playgroundRunning} onClick={() => setPlaygroundCode(STARTER_CODE.java)}>
          <RotateCcw size={13}/> Starter
        </button>
      </div>
      <p className="practice-sandbox-note">Use <code>public class Main</code> as the entry point. Code and input are sent to OnlineCompiler.io to run; do not include passwords, API keys, or other secrets.</p>
      {playgroundError && <p className="practice-run-error" role="alert">{playgroundError}</p>}
      {playgroundResult && <article className={`practice-result ${playgroundResult.statusId === 3 ? 'passed' : 'failed'}`}>
        <div className="practice-result-heading"><b>{playgroundResult.status}</b><span>Playground run</span></div>
        <div className="practice-metrics">
          <span>Execution time <b>{playgroundResult.time !== null && playgroundResult.time !== undefined ? `${Number(playgroundResult.time).toFixed(3)} s` : 'Not reported'}</b></span>
          <span>Process memory <b>{playgroundResult.memory !== null && playgroundResult.memory !== undefined ? `${Number(playgroundResult.memory).toLocaleString()} KB` : 'Not reported'}</b></span>
        </div>
        <label>Output</label><pre>{playgroundResult.stdout || playgroundResult.stderr || '(no output)'}</pre>
      </article>}
    </section>}
  </div>;
}

export default CodePractice;
