import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Award, BriefcaseBusiness, Check, ChevronRight, Clipboard, Code2, Download, Eye, FileText, GraduationCap, LayoutTemplate, Plus, Save, Search, ShieldCheck, Sparkles, Trash2, Upload } from 'lucide-react';
import { service } from './services/api';
import { currentUser, useStore } from './store/useStore';
import { createResumePdf } from './lib/resumePdf';

const errorMessage = error => error.response?.data?.error?.message || error.message || 'Something went wrong. Please try again.';
const formatSize = size => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
const dateLabel = value => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function Panel({ children, className = '' }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function Heading({ title, subtitle }) {
  return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div></div>;
}

function Notice({ children, onRetry }) {
  return <Panel><p role="alert">{children}</p>{onRetry && <button className="btn btn-secondary" onClick={onRetry}>Retry</button>}</Panel>;
}

function TagList({ title, values, tone }) {
  if (!values?.length) return null;
  return <div style={{ marginTop: 10 }}>
    <b style={{ fontSize: 12 }}>{title}</b>
    <div className="row" style={{ flexWrap: 'wrap', marginTop: 6 }}>
      {values.map((value, index) => <span className={`badge ${tone ? `badge-${tone}` : ''}`} key={`${value}-${index}`}>{value}</span>)}
    </div>
  </div>;
}

function AnalysisDetails({ analysis }) {
  if (!analysis) return null;
  return <div className="list-item">
    <div className="row between">
      <div><h3>AI resume analysis</h3><p>{analysis.summary}</p></div>
      {Number.isInteger(analysis.atsScore) && <span className="badge badge-purple">ATS readiness · {analysis.atsScore}%</span>}
    </div>
    <div className="grid grid-2" style={{ marginTop: 10 }}>
      <div><b style={{ fontSize: 12 }}>Experience level</b><p>{analysis.experienceLevel}</p></div>
      <div><TagList title="Suggested roles" values={analysis.suggestedRoles}/></div>
    </div>
    <TagList title="Skills found" values={analysis.skills} tone="purple"/>
    <TagList title="Strengths" values={analysis.strengths} tone="green"/>
    <TagList title="Growth opportunities" values={analysis.improvements} tone="amber"/>
    {analysis.formattingIssues?.length > 0 && <TagList title="ATS formatting checks" values={analysis.formattingIssues} tone="amber"/>}
  </div>;
}

function MatchDetails({ match }) {
  const result = match.results || {};
  return <div className="list-item">
    <div className="row between">
      <b>{match.jobTitle || 'Job description match'}</b>
      <div className="row"><span className="badge badge-purple">{match.score}% fit</span>{Number.isInteger(result.atsScore) && <span className="badge">{result.atsScore}% ATS keywords</span>}</div>
    </div>
    <p className="muted">{dateLabel(match.createdAt)}</p>
    <p>{result.rationale}</p>
    <TagList title="Matching skills" values={result.matchedSkills} tone="green"/>
    <TagList title="Skills to build" values={result.missingSkills} tone="amber"/>
    <TagList title="Matched ATS keywords" values={result.matchedKeywords} tone="green"/>
    <TagList title="Missing required keywords" values={result.missingRequiredKeywords} tone="red"/>
    <TagList title="Missing preferred keywords" values={result.missingPreferredKeywords} tone="amber"/>
    {result.keywordCoverage?.length > 0 && <div style={{ marginTop: 10 }}><b style={{ fontSize: 12 }}>Job keyword evidence</b><KeywordCoverage keywords={result.keywordCoverage}/></div>}
    <TagList title="Recommendations" values={result.recommendations}/>
    {result.keywordSuggestions?.length > 0 && <div style={{ marginTop: 10 }}><b style={{ fontSize: 12 }}>Suggested keywords — only add when accurate</b>{result.keywordSuggestions.map((item, index) => <p key={`${item.keyword}-${index}`}><b>{item.keyword}</b> · {item.reason} <span className="muted">{item.useWhenTrue}</span></p>)}</div>}
    {match.jobDescription && <details className="resume-job-reference"><summary>View saved job description</summary><p>{match.jobDescription}</p></details>}
  </div>;
}

const workspaceTabs = [
  { id: 'overview', label: 'Overview', icon: BriefcaseBusiness },
  { id: 'resumes', label: 'My resumes', icon: FileText },
  { id: 'builder', label: 'Resume builder', icon: LayoutTemplate },
  { id: 'ats', label: 'ATS review', icon: ShieldCheck },
  { id: 'jobs', label: 'Job matching', icon: Search },
  { id: 'career', label: 'Career plan', icon: Sparkles },
];

const resumeTemplates = [
  { id: 'modern', name: 'Modern', description: 'Clean, contemporary layout', color: '#6d4aff' },
  { id: 'classic', name: 'Classic', description: 'Traditional and polished', color: '#1f2937' },
  { id: 'technical', name: 'Technical', description: 'Skills-forward for tech roles', color: '#087e8b' },
  { id: 'minimal', name: 'Minimal', description: 'Simple, spacious, ATS-friendly', color: '#475569' },
];

const emptyResumeEntry = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: '',
  organization: '',
  location: '',
  startDate: '',
  endDate: '',
  description: '',
});

const emptyResumeDraft = () => ({
  fullName: '',
  jobTitle: '',
  email: '',
  phone: '',
  location: '',
  website: '',
  summary: '',
  skills: [],
  experience: [],
  education: [],
  projects: [],
  certifications: [],
});

function ResumePreview({ content, template }) {
  const skills = content.skills.filter(Boolean);
  const sections = [
    { key: 'experience', title: 'Experience', icon: BriefcaseBusiness },
    { key: 'projects', title: 'Projects', icon: Code2 },
    { key: 'education', title: 'Education', icon: GraduationCap },
    { key: 'certifications', title: 'Certifications', icon: Award },
  ];
  const contact = [content.email, content.phone, content.location, content.website].filter(Boolean).join('  ·  ');
  return <article className={`resume-paper resume-paper-${template}`}>
    <header className="resume-paper-header">
      <div className="resume-paper-name">{content.fullName || 'Your name'}</div>
      {content.jobTitle && <div className="resume-paper-title">{content.jobTitle}</div>}
      {contact && <div className="resume-paper-contact">{contact}</div>}
    </header>
    {content.summary && <section className="resume-paper-section"><h3>Professional summary</h3><p>{content.summary}</p></section>}
    {template === 'technical' && skills.length > 0 && <section className="resume-paper-section"><h3>Technical skills</h3><p>{skills.join('  ·  ')}</p></section>}
    {sections.map(({ key, title }) => {
      const entries = content[key].filter(entry => entry.title || entry.organization || entry.description);
      if (!entries.length) return null;
      return <section className="resume-paper-section" key={key}><h3>{title}</h3>{entries.map(entry => <div className="resume-paper-entry" key={entry.id}>
        <div className="resume-paper-entry-heading"><b>{entry.title}</b><span>{[entry.startDate, entry.endDate].filter(Boolean).join(' – ')}</span></div>
        {(entry.organization || entry.location) && <div className="resume-paper-entry-sub">{[entry.organization, entry.location].filter(Boolean).join(' · ')}</div>}
        {entry.description && <p>{entry.description}</p>}
      </div>)}</section>;
    })}
    {template !== 'technical' && skills.length > 0 && <section className="resume-paper-section"><h3>Skills</h3><p>{skills.join('  ·  ')}</p></section>}
    {!content.summary && !skills.length && !sections.some(({ key }) => content[key].length > 0) && <div className="resume-paper-empty"><Eye size={16}/>Your live resume preview will appear here as you add details.</div>}
  </article>;
}

function ResumeBuilderField({ label, value, onChange, multiline = false, ...props }) {
  const Input = multiline ? 'textarea' : 'input';
  return <label className="resume-builder-field"><span>{label}</span><Input className={multiline ? 'textarea' : 'input'} value={value} onChange={event => onChange(event.target.value)} {...props}/></label>;
}

function ResumeEntryEditor({ title, entries, onChange, labels }) {
  const updateEntry = (id, field, value) => onChange(entries.map(entry => entry.id === id ? { ...entry, [field]: value } : entry));
  const updateEntries = (id, field, value) => updateEntry(id, field, value);
  return <section className="resume-builder-section">
    <div className="row between"><div><h3>{title}</h3><p>Add the most relevant information first.</p></div><button type="button" className="btn btn-secondary" onClick={() => onChange([...entries, emptyResumeEntry()])}><Plus size={14}/> Add {title.toLowerCase().replace(/s$/, '')}</button></div>
    {!entries.length && <p className="resume-builder-empty">No entries yet. Add one when you’re ready.</p>}
    {entries.map((entry, index) => <div className="resume-entry-editor" key={entry.id}>
      <div className="row between"><b>{labels.singular} {index + 1}</b><button type="button" className="btn btn-danger" onClick={() => onChange(entries.filter(item => item.id !== entry.id))}>Remove</button></div>
      <div className="grid grid-2">
        <ResumeBuilderField label={labels.title} value={entry.title} onChange={value => updateEntries(entry.id, 'title', value)} maxLength={160}/>
        <ResumeBuilderField label={labels.organization} value={entry.organization} onChange={value => updateEntries(entry.id, 'organization', value)} maxLength={160}/>
      </div>
      {labels.location && <ResumeBuilderField label="Location (optional)" value={entry.location} onChange={value => updateEntries(entry.id, 'location', value)} maxLength={120}/>}
      {labels.dates && <div className="grid grid-2"><ResumeBuilderField label="Start date" value={entry.startDate} onChange={value => updateEntries(entry.id, 'startDate', value)} placeholder="e.g. Jan 2023" maxLength={40}/><ResumeBuilderField label="End date" value={entry.endDate} onChange={value => updateEntries(entry.id, 'endDate', value)} placeholder="e.g. Present" maxLength={40}/></div>}
      {labels.description && <ResumeBuilderField label={labels.description} value={entry.description} onChange={value => updateEntries(entry.id, 'description', value)} multiline rows={4} maxLength={2500} placeholder="Describe your contribution and results. Only include facts you can verify."/>}
    </div>)}
  </section>;
}

function ScoreCard({ label, value, detail }) {
  return <div className="card resume-score-card"><span className="stat-label">{label}</span><div className="stat-value">{value}</div><span className="muted">{detail}</span></div>;
}

function KeywordCoverage({ keywords = [] }) {
  if (!keywords.length) return <p className="muted">No keyword results yet. Run an ATS review or compare against a job description.</p>;
  return <div className="resume-keyword-list">{keywords.map((item, index) => <div className="resume-keyword-row" key={`${item.keyword}-${index}`}>
    <span className={`badge ${item.found ? 'badge-green' : 'badge-amber'}`}>{item.found ? 'Found' : 'Gap'}</span>
    <div><b>{item.keyword}</b><p>{item.evidence || item.suggestion || 'Not found in the resume.'}</p></div>
    {item.importance && <span className="muted">{item.importance}</span>}
  </div>)}</div>;
}

export function StudentResumeWorkspace() {
  const store = useStore();
  const user = currentUser(store);
  const [resumes, setResumes] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canRetryLoad, setCanRetryLoad] = useState(false);
  const [retry, setRetry] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [busyResume, setBusyResume] = useState('');
  const [content, setContent] = useState(emptyResumeDraft);
  const [template, setTemplate] = useState('modern');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [draftStatus, setDraftStatus] = useState('unsaved');
  const [savingDraft, setSavingDraft] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [job, setJob] = useState({ resumeId: '', jobTitle: '', jobDescription: '' });
  const selectedResume = resumes.find(resume => resume.id === job.resumeId);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setCanRetryLoad(false);
    Promise.allSettled([service.getResumes(), service.getResumeBuilderDraft()])
      .then(([resumeResult, draftResult]) => {
        if (!active) return;
        if (resumeResult.status === 'fulfilled') {
          setResumes(resumeResult.value.resumes);
          setJob(current => ({
            ...current,
            resumeId: resumeResult.value.resumes.some(resume => resume.id === current.resumeId)
              ? current.resumeId
              : resumeResult.value.resumes[0]?.id || '',
          }));
        } else {
          setError(errorMessage(resumeResult.reason));
          setCanRetryLoad(true);
        }
        if (draftResult.status === 'fulfilled') {
          const draft = draftResult.value.draft;
          if (draft) {
            setTemplate(draft.template);
            setContent({ ...emptyResumeDraft(), ...draft.content });
            setDraftStatus('saved');
          } else {
            setContent({
              ...emptyResumeDraft(),
              fullName: user?.name || '',
              email: user?.email || '',
            });
          }
          setDraftLoaded(true);
          setDraftError('');
        } else {
          setDraftError(errorMessage(draftResult.reason));
          setDraftLoaded(true);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry, user?.id]);

  const updateContent = (field, value) => {
    setContent(current => ({ ...current, [field]: value }));
    setDraftStatus('unsaved');
  };

  const saveDraft = async () => {
    if (!content.fullName.trim()) {
      setDraftError('Add your name before saving your resume.');
      return false;
    }
    if (content.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.email.trim())) {
      setDraftError('Enter a valid email address or leave the email field blank.');
      return false;
    }
    setSavingDraft(true);
    setDraftError('');
    setDraftStatus('saving');
    try {
      const { draft } = await service.saveResumeBuilderDraft({
        template,
        content: {
          ...content,
          fullName: content.fullName.trim(),
          skills: content.skills.map(skill => skill.trim()).filter(Boolean),
        },
      });
      setDraftStatus('saved');
      setDraftLoaded(true);
      setContent(current => ({ ...emptyResumeDraft(), ...draft.content }));
      setTemplate(draft.template);
      return true;
    } catch (requestError) {
      setDraftStatus('error');
      setDraftError(errorMessage(requestError));
      return false;
    } finally {
      setSavingDraft(false);
    }
  };

  const downloadBuiltResume = async () => {
    if (!content.fullName.trim()) {
      setDraftError('Add your name before downloading your resume.');
      return;
    }
    setGeneratingPdf(true);
    setDraftError('');
    try {
      const fileName = `${content.fullName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-resume.pdf`;
      (await createResumePdf(content, template)).save(fileName);
    } catch (requestError) {
      setDraftError(`Could not create the PDF: ${errorMessage(requestError)}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const upload = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    setCanRetryLoad(false);
    try {
      const { resume } = await service.uploadResume(file);
      setResumes(current => [resume, ...current]);
      setJob(current => ({ ...current, resumeId: resume.id }));
      setActiveTab('resumes');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setUploading(false);
    }
  };

  const analyze = async resumeId => {
    setBusyResume(resumeId);
    setError('');
    setCanRetryLoad(false);
    try {
      const { resume } = await service.analyzeResume(resumeId);
      setResumes(current => current.map(item => item.id === resume.id ? resume : item));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusyResume('');
    }
  };

  const match = async event => {
    event.preventDefault();
    if (!job.resumeId) return setError('Upload a resume before matching it to a job.');
    setBusyResume(job.resumeId);
    setError('');
    setCanRetryLoad(false);
    try {
      const { match: result } = await service.matchResumeToJob(job.resumeId, {
        jobTitle: job.jobTitle,
        jobDescription: job.jobDescription,
      });
      setResumes(current => current.map(resume => resume.id === job.resumeId
        ? { ...resume, matches: [result, ...(resume.matches || []).filter(item => item.id !== result.id)].slice(0, 20) }
        : resume));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusyResume('');
    }
  };

  const remove = async resume => {
    if (!window.confirm(`Delete "${resume.fileName}" and its analysis and job matches?`)) return;
    setBusyResume(resume.id);
    setError('');
    setCanRetryLoad(false);
    try {
      await service.deleteResume(resume.id);
      setResumes(current => current.filter(item => item.id !== resume.id));
      setJob(current => current.resumeId === resume.id
        ? { ...current, resumeId: resumes.find(item => item.id !== resume.id)?.id || '' }
        : current);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusyResume('');
    }
  };

  const copyText = async text => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (requestError) {
      setError(`Could not copy to clipboard: ${errorMessage(requestError)}`);
    }
  };

  const downloadReport = (title, content) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-career-report.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadAtsReport = () => {
    const analysis = selectedResume?.analysis;
    if (!analysis) return;
    const sections = Object.entries(analysis.sections || {}).map(([name, present]) => `${name}: ${present ? 'present' : 'missing'}`);
    const keywords = (analysis.atsKeywords || []).map(item => `${item.found ? '[FOUND]' : '[GAP]'} ${item.keyword} - ${item.evidence || 'Not found'}`);
    const suggestions = (analysis.keywordSuggestions || []).map(item => `${item.keyword}: ${item.reason} Add only when true: ${item.useWhenTrue}`);
    const sectionFeedback = (analysis.sectionFeedback || []).map(item => `${item.section} (${item.status}): ${item.feedback}`);
    const bulletRewrites = (analysis.bulletRewrites || []).map(item => `${item.section}\nCurrent: ${item.original}\nSuggested: ${item.suggestion}\nNote: ${item.note}`);
    const content = [
      `Resume ATS readiness estimate: ${analysis.atsScore}%`,
      `Resume: ${selectedResume.fileName}`,
      `Summary: ${analysis.summary}`,
      `Suggested roles: ${(analysis.suggestedRoles || []).join(', ')}`,
      `Skills: ${(analysis.skills || []).join(', ')}`,
      `Strengths: ${(analysis.strengths || []).join('; ')}`,
      '',
      'Section checklist',
      ...sections,
      '',
      'Section feedback',
      ...sectionFeedback,
      '',
      'Keyword coverage',
      ...keywords,
      '',
      'Keyword suggestions (verify they reflect your real experience)',
      ...suggestions,
      '',
      'Formatting checks',
      ...(analysis.formattingIssues || []),
      '',
      'Improvement suggestions',
      ...(analysis.improvements || []),
      '',
      'Evidence-preserving bullet rewrites',
      ...bulletRewrites,
      '',
      'AI estimates are guidance, not a score from an employer ATS. Never add unsupported skills or experience.',
    ].join('\n');
    downloadReport(selectedResume.fileName, content);
  };

  const atsSuggestions = selectedResume?.analysis?.keywordSuggestions || [];
  const latestMatchResult = selectedResume?.matches?.[0]?.results;
  const careerSuggestions = [
    ...(selectedResume?.analysis?.suggestedRoles || []).map(role => ({ title: 'Target role', text: `Explore ${role} opportunities and tailor a resume version to the specific job requirements.` })),
    ...(selectedResume?.analysis?.improvements || []).map(text => ({ title: 'Resume improvement', text })),
    ...atsSuggestions.map(item => ({ title: `ATS keyword: ${item.keyword}`, text: `${item.reason} ${item.useWhenTrue}` })),
    ...(latestMatchResult?.keywordCoverage || []).filter(item => !item.found).map(item => ({ title: `${item.importance === 'required' ? 'Required' : 'Preferred'} keyword gap: ${item.keyword}`, text: `${item.suggestion} Evidence: ${item.evidence || 'No resume evidence found.'}` })),
    ...(latestMatchResult?.recommendations || []).map(text => ({ title: 'Job match next step', text })),
  ];

  return <>
    <div className="resume-workspace-hero">
      <div><span className="resume-eyebrow"><Sparkles size={13}/> SKILLMESH CAREER STUDIO</span><h1>Resume & career studio</h1><p>One private workspace to improve your resume, check ATS keywords, and prepare for your next role.</p></div>
      <div className="resume-hero-meta"><ShieldCheck size={18}/><span>Private to you and signed-in mentors</span></div>
    </div>
    <div className="resume-workspace-tabs" role="tablist" aria-label="Career studio sections">
      {workspaceTabs.map(({ id, label, icon: TabIcon }) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={`resume-workspace-tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}><TabIcon size={15}/>{label}</button>)}
    </div>
    {error && <Notice onRetry={canRetryLoad ? () => setRetry(value => value + 1) : undefined}>{error}</Notice>}
    {loading ? <Panel><p>Loading your career studio…</p></Panel> : canRetryLoad ? null : <>
      {activeTab === 'overview' && <>
        <div className="grid grid-3">
          <ScoreCard label="Resume versions" value={resumes.length} detail="Manage tailored versions in one place"/>
          <ScoreCard label="ATS readiness" value={Number.isInteger(selectedResume?.analysis?.atsScore) ? `${selectedResume.analysis.atsScore}%` : 'Not checked'} detail={selectedResume?.analysis ? 'Refresh to see full ATS report' : 'Run a free resume review'}/>
          <ScoreCard label="Saved job matches" value={resumes.reduce((count, resume) => count + (resume.matches?.length || 0), 0)} detail="Compare skills and ATS terms"/>
        </div>
        <Panel className="resume-overview-panel">
          <div className="row between"><div><h2>Start where you left off</h2><p>{selectedResume ? `Selected resume: ${selectedResume.fileName}` : 'Upload your first resume to begin your career review.'}</p></div><FileText size={24} className="accent"/></div>
          <div className="resume-quick-actions">
            <button className="resume-quick-action" onClick={() => setActiveTab('resumes')}><Upload size={18}/><b>Manage resumes</b><span>Upload, select, or remove a version</span><ChevronRight size={15}/></button>
            <button className="resume-quick-action" onClick={() => setActiveTab('ats')}><ShieldCheck size={18}/><b>Run ATS review</b><span>Check sections, keywords, and formatting</span><ChevronRight size={15}/></button>
            <button className="resume-quick-action" onClick={() => setActiveTab('jobs')}><BriefcaseBusiness size={18}/><b>Match a job</b><span>Compare your resume to a job posting</span><ChevronRight size={15}/></button>
          </div>
          <p className="resume-disclaimer"><AlertCircle size={13}/> AI feedback is an estimate, not a guarantee or a score from an employer's ATS. Only use suggestions that accurately reflect your experience.</p>
        </Panel>
        {selectedResume?.matches?.length > 0 && <Panel><h2>Recent job matches</h2>{selectedResume.matches.slice(0, 3).map(item => <MatchDetails key={item.id} match={item}/>)}</Panel>}
      </>}

      {activeTab === 'resumes' && <>
        <Panel>
          <div className="row between">
            <div><h2>Resume library</h2><p>Upload PDF or plain-text resumes up to 5 MB. AI actions send your resume content to Gemini.</p></div>
            <label className={`btn btn-primary ${uploading ? 'disabled' : ''}`}>
              <Upload size={15}/>{uploading ? 'Uploading…' : 'Upload resume'}
              <input type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={upload} disabled={uploading} hidden/>
            </label>
          </div>
        </Panel>
        {resumes.length === 0
          ? <Panel><div className="empty"><FileText size={28}/><h2>Your resume library is empty</h2><p>Upload a PDF or TXT file to get your first ATS review and career suggestions.</p></div></Panel>
          : <div className="list">{resumes.map(resume => <Panel key={resume.id}>
            <div className="resume-file-card">
              <button className={`resume-file-select ${job.resumeId === resume.id ? 'active' : ''}`} onClick={() => setJob(current => ({ ...current, resumeId: resume.id }))} aria-pressed={job.resumeId === resume.id}>
                <div className="avatar"><FileText size={16}/></div><div><b>{resume.fileName}</b><p className="muted">{formatSize(resume.size)} · Added {dateLabel(resume.createdAt)}</p></div>{job.resumeId === resume.id && <Check size={17} className="accent"/>}
              </button>
              <div className="row">
                <a className="btn btn-secondary" href={service.getResumeDownloadUrl(resume.id)} target="_blank" rel="noreferrer"><Download size={14}/> Download</a>
                <button className="btn btn-secondary" onClick={() => { setJob(current => ({ ...current, resumeId: resume.id })); setActiveTab('ats'); }}><ShieldCheck size={14}/> ATS review</button>
                <button className="btn btn-danger" aria-label={`Delete ${resume.fileName}`} onClick={() => remove(resume)} disabled={Boolean(busyResume)}><Trash2 size={14}/></button>
              </div>
            </div>
            {resume.analysis && <div className="row" style={{ marginTop: 10 }}><span className="badge badge-purple">ATS readiness {resume.analysis.atsScore}%</span><span className="muted">{resume.analysis.suggestedRoles?.slice(0, 3).join(' · ')}</span></div>}
            {resume.matches?.length > 0 && <p className="muted" style={{ marginTop: 8 }}>{resume.matches.length} saved job match{resume.matches.length === 1 ? '' : 'es'}{resume.matches[0]?.jobTitle ? ` · Latest: ${resume.matches[0].jobTitle}` : ''}</p>}
          </Panel>)}</div>}
      </>}

      {activeTab === 'builder' && <div className="resume-builder">
          <Panel>
            <div className="row between"><div><h2>Choose your resume template</h2><p>Professional, readable layouts. All templates use a single-column design for ATS readability.</p></div><LayoutTemplate className="accent"/></div>
            <div className="resume-template-grid">{resumeTemplates.map(item => <button type="button" className={`resume-template-choice ${template === item.id ? 'active' : ''}`} key={item.id} onClick={() => { setTemplate(item.id); setDraftStatus('unsaved'); }}>
              <div className={`resume-template-swatch resume-template-swatch-${item.id}`}><span/><i/><i/><i/><i/></div><b>{item.name}</b><span>{item.description}</span>{template === item.id && <Check size={15}/>}
            </button>)}</div>
          </Panel>
          <div className="resume-builder-toolbar">
            <div><h2>Build your resume</h2><p>{draftStatus === 'saved' ? 'Your latest draft is saved.' : draftStatus === 'saving' ? 'Saving your draft…' : draftStatus === 'error' ? 'Your changes are not saved.' : 'Your changes are not saved yet.'}</p></div>
            <div className="row"><button type="button" className="btn btn-secondary" disabled={!draftLoaded || savingDraft} onClick={saveDraft}><Save size={14}/>{savingDraft ? 'Saving…' : 'Save draft'}</button><button type="button" className="btn btn-primary" disabled={generatingPdf} onClick={downloadBuiltResume}><Download size={14}/>{generatingPdf ? 'Creating PDF…' : 'Download PDF'}</button></div>
          </div>
          {draftError && <Notice>{draftError}</Notice>}
          {!draftLoaded ? <Panel><p>Loading your saved resume draft…</p></Panel> : <div className="resume-builder-layout">
            <div className="resume-builder-editor">
              <Panel><h3>Contact & headline</h3><div className="grid grid-2">
                <ResumeBuilderField label="Full name" required value={content.fullName} onChange={value => updateContent('fullName', value)} maxLength={120} placeholder="Your name"/>
                <ResumeBuilderField label="Target job title" value={content.jobTitle} onChange={value => updateContent('jobTitle', value)} maxLength={160} placeholder="e.g. Software Engineer"/>
                <ResumeBuilderField label="Email" type="email" value={content.email} onChange={value => updateContent('email', value)} maxLength={254} placeholder="you@example.com"/>
                <ResumeBuilderField label="Phone" type="tel" value={content.phone} onChange={value => updateContent('phone', value)} maxLength={60}/>
                <ResumeBuilderField label="Location" value={content.location} onChange={value => updateContent('location', value)} maxLength={160} placeholder="City, Country"/>
                <ResumeBuilderField label="Website or LinkedIn" type="url" value={content.website} onChange={value => updateContent('website', value)} maxLength={500} placeholder="https://"/>
              </div></Panel>
              <Panel><h3>Professional summary</h3><p>Write a short, factual introduction tailored to your target role.</p><ResumeBuilderField label="Summary" multiline rows={5} value={content.summary} onChange={value => updateContent('summary', value)} maxLength={2500} placeholder="Summarize your experience, strengths, and the role you are targeting."/></Panel>
              <Panel><h3>Skills</h3><p>List skills you can demonstrate. Separate each skill with a comma or a new line.</p><ResumeBuilderField label="Skills" multiline rows={4} value={content.skills.join(', ')} onChange={value => updateContent('skills', value.split(/[,\n]/).map(skill => skill.trim()).filter(Boolean).slice(0, 50))} placeholder="JavaScript, React, SQL"/></Panel>
              <Panel><ResumeEntryEditor title="Experience" entries={content.experience} onChange={value => updateContent('experience', value)} labels={{ singular: 'Role', title: 'Job title', organization: 'Company', location: true, dates: true, description: 'Achievements and responsibilities' }}/></Panel>
              <Panel><ResumeEntryEditor title="Projects" entries={content.projects} onChange={value => updateContent('projects', value)} labels={{ singular: 'Project', title: 'Project name', organization: 'Organization or link', location: false, dates: true, description: 'What you built and your contribution' }}/></Panel>
              <Panel><ResumeEntryEditor title="Education" entries={content.education} onChange={value => updateContent('education', value)} labels={{ singular: 'Education', title: 'Degree or qualification', organization: 'School or institution', location: true, dates: true, description: 'Relevant details (optional)' }}/></Panel>
              <Panel><ResumeEntryEditor title="Certifications" entries={content.certifications} onChange={value => updateContent('certifications', value)} labels={{ singular: 'Certification', title: 'Certification name', organization: 'Issuing organization', location: false, dates: true, description: 'Credential details (optional)' }}/></Panel>
              <div className="resume-builder-bottom-actions"><button type="button" className="btn btn-secondary" disabled={savingDraft} onClick={saveDraft}><Save size={14}/>{savingDraft ? 'Saving…' : 'Save draft'}</button><button type="button" className="btn btn-primary" disabled={generatingPdf} onClick={downloadBuiltResume}><Download size={14}/>{generatingPdf ? 'Creating PDF…' : 'Download resume PDF'}</button></div>
            </div>
            <aside className="resume-builder-preview"><div className="resume-preview-heading"><Eye size={15}/> Live preview · {resumeTemplates.find(item => item.id === template)?.name}</div><ResumePreview content={content} template={template}/></aside>
          </div>}
          <p className="resume-disclaimer"><AlertCircle size={13}/> Drafts save to your signed-in account. Review all details before using your resume; AI suggestions should never replace accurate information.</p>
      </div>}

      {activeTab === 'ats' && <Panel>
        <div className="row between"><div><h2>ATS resume review</h2><p>Review common parsing-readiness signals, section completeness, and role-relevant keywords.</p></div>
          <select className="select resume-inline-select" aria-label="Choose resume for ATS review" value={job.resumeId} onChange={event => setJob(current => ({ ...current, resumeId: event.target.value }))}><option value="">Choose a resume</option>{resumes.map(resume => <option key={resume.id} value={resume.id}>{resume.fileName}</option>)}</select>
        </div>
        {!selectedResume ? <div className="empty"><p>Upload a resume in My resumes to begin an ATS review.</p><button className="btn btn-primary" onClick={() => setActiveTab('resumes')}><Upload size={14}/> Go to resume library</button></div>
          : <><div className="row between resume-review-actions"><span className="muted">Reviewing {selectedResume.fileName}</span><div className="row"><button className="btn btn-secondary" onClick={downloadAtsReport} disabled={!selectedResume.analysis}><Download size={14}/> Export report</button><button className="btn btn-primary" onClick={() => analyze(selectedResume.id)} disabled={Boolean(busyResume)}><Sparkles size={14}/>{busyResume === selectedResume.id ? 'Reviewing…' : selectedResume.analysis ? 'Refresh review' : 'Run ATS review'}</button></div></div>
            {!selectedResume.analysis ? <div className="resume-empty-report"><ShieldCheck size={25}/><h3>Your review is ready to run</h3><p>Gemini will inspect resume sections, ATS-friendly formatting signals, strengths, and potential keywords.</p></div>
              : <div className="resume-report">
                {!Number.isInteger(selectedResume.analysis.atsScore) && <div className="resume-inline-notice"><AlertCircle size={15}/> This is an older basic review. Refresh it to generate the full ATS keyword and section report.</div>}
                <div className="resume-report-score"><div className="resume-score-number">{Number.isInteger(selectedResume.analysis.atsScore) ? selectedResume.analysis.atsScore : '—'}{Number.isInteger(selectedResume.analysis.atsScore) && <span>%</span>}</div><div><h3>ATS readiness estimate</h3><p>Common resume parsing and completeness signals. Not an employer ATS score or hiring prediction.</p></div></div>
                <div className="resume-report-section"><h3>Section checklist</h3><div className="resume-section-grid">{Object.entries({ contact: 'Contact details', summary: 'Professional summary', experience: 'Work experience', education: 'Education', skills: 'Skills', projects: 'Projects', certifications: 'Certifications' }).map(([key, label]) => {
                  const present = Boolean(selectedResume.analysis.sections?.[key]);
                  return <div className={`resume-section-check ${present ? 'present' : 'missing'}`} key={key}><span>{present ? <Check size={14}/> : <AlertCircle size={14}/>}</span><b>{label}</b><small>{present ? 'Found' : 'Not detected'}</small></div>;
                })}</div></div>
                <div className="resume-report-section"><div className="row between"><div><h3>ATS keyword coverage</h3><p>Terms found in the resume and terms to consider only when accurate.</p></div><button className="btn btn-secondary" onClick={() => copyText((selectedResume.analysis.atsKeywords || []).map(item => `${item.found ? 'FOUND' : 'GAP'}: ${item.keyword}`).join('\n'))}><Clipboard size={14}/> Copy keywords</button></div><KeywordCoverage keywords={selectedResume.analysis.atsKeywords}/></div>
                {selectedResume.analysis.keywordSuggestions?.length > 0 && <div className="resume-report-section"><h3>Potential keywords to add</h3><p>Use a suggested keyword only if you can support it with real work, projects, or training.</p>{selectedResume.analysis.keywordSuggestions.map((item, index) => <div className="resume-suggestion" key={`${item.keyword}-${index}`}><b>{item.keyword}</b><p>{item.reason}</p><small>Use when true: {item.useWhenTrue}</small></div>)}</div>}
                <div className="grid grid-2">
                  <div className="resume-report-section"><h3>What is working</h3><TagList title="Strengths" values={selectedResume.analysis.strengths} tone="green"/><TagList title="Skills found" values={selectedResume.analysis.skills} tone="purple"/></div>
                  <div className="resume-report-section"><h3>Improve next</h3><TagList title="Recommendations" values={selectedResume.analysis.improvements} tone="amber"/><TagList title="Formatting checks" values={selectedResume.analysis.formattingIssues} tone="red"/></div>
                </div>
                {selectedResume.analysis.sectionFeedback?.length > 0 && <div className="resume-report-section"><h3>Section-by-section feedback</h3>{selectedResume.analysis.sectionFeedback.map((item, index) => <div className="resume-feedback-row" key={`${item.section}-${index}`}><span className={`badge ${item.status === 'present' ? 'badge-green' : 'badge-amber'}`}>{item.status.replace('_', ' ')}</span><div><b>{item.section}</b><p>{item.feedback}</p></div></div>)}</div>}
                {selectedResume.analysis.bulletRewrites?.length > 0 && <div className="resume-report-section"><h3>Evidence-preserving bullet rewrites</h3><p>Suggestions keep the facts provided; verify every statement before using it.</p>{selectedResume.analysis.bulletRewrites.map((item, index) => <div className="resume-bullet-rewrite" key={`${item.section}-${index}`}><span className="badge">{item.section}</span><p><b>Current:</b> {item.original}</p><p><b>Suggested:</b> {item.suggestion}</p><small>{item.note}</small><button className="btn btn-secondary" onClick={() => copyText(item.suggestion)}><Clipboard size={13}/> Copy rewrite</button></div>)}</div>}
                <AnalysisDetails analysis={selectedResume.analysis}/>
              </div>}
          </>}
      </Panel>}

      {activeTab === 'jobs' && <div className="grid grid-2 resume-job-layout">
        <Panel>
          <div className="row"><BriefcaseBusiness className="accent"/><div><h2>Compare a job description</h2><p>Paste a job posting to see evidence-based fit and explicit ATS keyword coverage.</p></div></div>
          <form onSubmit={match} style={{ marginTop: 14 }}>
            <div className="field"><label className="label" htmlFor="match-resume">Resume version</label><select className="select" id="match-resume" required value={job.resumeId} onChange={event => setJob(current => ({ ...current, resumeId: event.target.value }))}><option value="">Choose a resume</option>{resumes.map(resume => <option key={resume.id} value={resume.id}>{resume.fileName}</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="match-title">Job title</label><input className="input" id="match-title" value={job.jobTitle} maxLength={160} onChange={event => setJob(current => ({ ...current, jobTitle: event.target.value }))} placeholder="e.g. Frontend Engineer"/></div>
            <div className="field"><label className="label" htmlFor="job-description">Job description</label><textarea className="textarea resume-job-description" id="job-description" required minLength={30} maxLength={12000} value={job.jobDescription} onChange={event => setJob(current => ({ ...current, jobDescription: event.target.value }))} placeholder="Paste role responsibilities and required/preferred qualifications."/></div>
            <p className="muted">{job.jobDescription.length}/12,000 characters · Include the full requirements for better keyword coverage.</p>
            <button className="btn btn-primary" type="submit" disabled={!job.resumeId || Boolean(busyResume)}><Sparkles size={14}/>{busyResume === job.resumeId ? 'Analyzing…' : 'Analyze fit & ATS keywords'}</button>
          </form>
          <p className="resume-disclaimer"><AlertCircle size={13}/> Job postings and resume content are sent to Gemini for this analysis. Add missing keywords only when they truthfully describe your experience.</p>
        </Panel>
        <Panel><h2>Saved match history</h2>{!selectedResume ? <p>Choose or upload a resume to view job matches.</p> : selectedResume.matches?.length ? selectedResume.matches.map(item => <MatchDetails key={item.id} match={item}/>) : <div className="resume-empty-report"><BriefcaseBusiness size={23}/><p>No matches saved for this resume yet.</p></div>}</Panel>
      </div>}

      {activeTab === 'career' && <Panel>
        <div className="row"><Sparkles className="accent"/><div><h2>Your career action plan</h2><p>Practical next steps from your resume review and latest job match.</p></div></div>
        {!selectedResume ? <div className="empty"><p>Select a resume to build a personalized career plan.</p><button className="btn btn-secondary" onClick={() => setActiveTab('resumes')}>Open resume library</button></div>
          : !selectedResume.analysis && !selectedResume.matches?.length ? <div className="resume-empty-report"><p>Run a resume review or job match to generate actionable suggestions.</p><div className="row"><button className="btn btn-primary" onClick={() => setActiveTab('ats')}>Review resume</button><button className="btn btn-secondary" onClick={() => setActiveTab('jobs')}>Match a job</button></div></div>
            : <><div className="row between" style={{ margin: '14px 0' }}><span className="badge">{selectedResume.fileName}</span><button className="btn btn-secondary" onClick={() => downloadReport(selectedResume.fileName, careerSuggestions.map((item, index) => `${index + 1}. ${item.title}\n${item.text}`).join('\n\n'))} disabled={!careerSuggestions.length}><Download size={14}/> Export action plan</button></div>
              {careerSuggestions.length ? <div className="resume-career-plan">{careerSuggestions.map((item, index) => <div className="resume-career-step" key={`${item.title}-${index}`}><span>{index + 1}</span><div><b>{item.title}</b><p>{item.text}</p></div></div>)}</div> : <div className="resume-empty-report"><p>No suggestions were returned. Refresh the ATS review or analyze a job description for more specific next steps.</p><button className="btn btn-secondary" onClick={() => setActiveTab('ats')}>Refresh ATS review</button></div>}
              {atsSuggestions.length > 0 && <p className="resume-disclaimer"><AlertCircle size={13}/> AI suggestions are prompts to review—not claims to paste. Only include keywords and achievements you can substantiate.</p>}
            </>}
      </Panel>}
    </>}
  </>;
}

export function MentorResumeStudents() {
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canRetryLoad, setCanRetryLoad] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setCanRetryLoad(false);
    service.getMentorResumeStudents()
      .then(response => { if (active) setStudents(response.students); })
      .catch(requestError => {
        if (active) {
          setError(errorMessage(requestError));
          setCanRetryLoad(true);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  const filteredStudents = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    if (!search) return students;
    return students.filter(student => [
      student.name,
      student.profile?.headline,
      student.profile?.degree,
      student.profile?.careerGoal,
      ...student.resumes.map(resume => resume.fileName),
      ...student.resumes.flatMap(resume => resume.analysis?.skills || []),
    ].filter(Boolean).join(' ').toLocaleLowerCase().includes(search));
  }, [query, students]);

  return <>
    <Heading title="Students with resumes" subtitle="Review student-submitted resumes, AI feedback, and job-match insights to guide career conversations."/>
    <Panel>
      <label className="row" style={{ maxWidth: 520 }}>
        <Search size={16} className="muted"/>
        <input className="input" aria-label="Search students and resumes" placeholder="Search students, skills, or career goals" value={query} onChange={event => setQuery(event.target.value)}/>
      </label>
      <p className="muted">{students.length} student{students.length === 1 ? '' : 's'} with resumes</p>
    </Panel>
    {error && <Notice onRetry={canRetryLoad ? () => setRetry(value => value + 1) : undefined}>{error}</Notice>}
    {loading ? <Panel><p>Loading student resumes…</p></Panel> : canRetryLoad ? null : filteredStudents.length === 0
      ? <Panel><p>{students.length ? 'No students match this search.' : 'No students have uploaded a resume yet.'}</p></Panel>
      : <div className="list">{filteredStudents.map(student => <Panel key={student.id}>
        <div className="row between">
          <div><h2>{student.name}</h2><p>{student.profile?.headline || student.profile?.degree || 'Student'}{student.profile?.careerGoal ? ` · ${student.profile.careerGoal}` : ''}</p></div>
          <span className="badge">{student.resumes.length} resume{student.resumes.length === 1 ? '' : 's'}</span>
        </div>
        {student.resumes.map(resume => <div className="list-item" key={resume.id}>
          <div className="row between">
            <div className="row"><FileText size={16} className="accent"/><div><b>{resume.fileName}</b><p className="muted">{formatSize(resume.size)} · Uploaded {dateLabel(resume.createdAt)}</p></div></div>
            <a className="btn btn-secondary" href={service.getResumeDownloadUrl(resume.id)} target="_blank" rel="noreferrer"><Download size={14}/> View resume</a>
          </div>
          <AnalysisDetails analysis={resume.analysis}/>
          {resume.matches?.length > 0 && <div style={{ marginTop: 12 }}><h3>Job matches</h3>{resume.matches.map(match => <MatchDetails key={match.id} match={match}/>)}</div>}
        </div>)}
      </Panel>)}</div>}
  </>;
}
