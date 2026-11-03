import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, BookOpen, Check, CircleHelp, FileText, Github, Lightbulb, LoaderCircle, Plus, Rocket, Sparkles, Trash2, Upload, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { service } from './services/api';
import { currentUser, useStore } from './store/useStore';

const errorMessage = error => error.response?.data?.error?.message || error.message || 'Something went wrong. Please try again.';
const tabs = [
  { id: 'overview', label: 'My projects', icon: Rocket },
  { id: 'architecture', label: 'Architecture planner', icon: BookOpen },
  { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
  { id: 'debug', label: 'Debug help', icon: CircleHelp },
];

function Panel({ children, className = '' }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function Field({ label, children }) {
  return <div className="field"><label className="label">{label}</label>{children}</div>;
}

function Notice({ children, onRetry }) {
  return <Panel><p role="alert">{children}</p>{onRetry && <button className="btn btn-secondary" onClick={onRetry}>Retry</button>}</Panel>;
}

export default function ProjectMentor() {
  const user = currentUser(useStore());
  const [workspace, setWorkspace] = useState({ projects: [], teams: [] });
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsError, setRecommendationsError] = useState('');
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '', teamId: '' });
  const [savingRoadmap, setSavingRoadmap] = useState(false);
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [analyzingRepository, setAnalyzingRepository] = useState(false);
  const [taskDraft, setTaskDraft] = useState({ milestone: '', title: '', description: '', estimateHours: 2 });
  const [savingTask, setSavingTask] = useState(false);
  const [debugInput, setDebugInput] = useState({ errorText: '', language: '', context: '' });
  const [debugResult, setDebugResult] = useState(null);
  const [debugError, setDebugError] = useState('');
  const [debugging, setDebugging] = useState(false);
  const [showcaseUrl, setShowcaseUrl] = useState('');
  const [architectureDraft, setArchitectureDraft] = useState({ name: '', idea: '', techStack: '', teamId: '' });
  const [prdFile, setPrdFile] = useState(null);
  const [generatingArchitecture, setGeneratingArchitecture] = useState(false);
  const [architectureError, setArchitectureError] = useState('');
  const [removingRepository, setRemovingRepository] = useState(false);
  const [removingProjectId, setRemovingProjectId] = useState('');
  const [projectPendingRemoval, setProjectPendingRemoval] = useState(null);
  const removalDialogRef = useRef(null);
  const removalCancelRef = useRef(null);

  const project = workspace.projects.find(item => item.id === selectedProjectId) || workspace.projects[0] || null;
  const isOwner = project?.ownerId === user.id;
  const teamMembers = useMemo(() => {
    if (!project?.team) return [];
    const members = project.team.members.map(member => member.user);
    if (project.owner && !members.some(member => member.id === project.owner.id)) members.unshift(project.owner);
    return members;
  }, [project]);
  const completedTasks = project?.tasks.filter(task => task.status === 'DONE').length || 0;
  const projectProgress = project?.tasks.length ? Math.round(completedTasks / project.tasks.length * 100) : 0;

  useEffect(() => {
    if (!projectPendingRemoval) return undefined;
    removalCancelRef.current?.focus();
    const handleDialogKeyDown = event => {
      if (event.key === 'Escape' && !removingProjectId) {
        setProjectPendingRemoval(null);
      }
      if (event.key !== 'Tab') return;
      const focusable = removalDialogRef.current?.querySelectorAll('button:not(:disabled)');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKeyDown);
    return () => document.removeEventListener('keydown', handleDialogKeyDown);
  }, [projectPendingRemoval, removingProjectId]);

  const loadWorkspace = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await service.getProjectMentorWorkspace();
      setWorkspace(response);
      setSelectedProjectId(current => response.projects.some(item => item.id === current)
        ? current
        : response.projects[0]?.id || '');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWorkspace(); }, [user.id]);

  const updateProject = next => {
    setWorkspace(current => ({
      ...current,
      projects: current.projects.map(item => item.id === next.id ? next : item),
    }));
    setSelectedProjectId(next.id);
  };

  const generateRecommendations = async () => {
    setLoadingRecommendations(true);
    setRecommendationsError('');
    try {
      const response = await service.getProjectRecommendations();
      setRecommendations(response.recommendations);
    } catch (requestError) {
      setRecommendationsError(errorMessage(requestError));
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const startIdea = recommendation => {
    setDraft({ name: recommendation.title, description: recommendation.description, teamId: '' });
    setActiveTab('overview');
  };

  const createRoadmap = async event => {
    event.preventDefault();
    setSavingRoadmap(true);
    try {
      const response = await service.createProjectRoadmap({
        ...draft,
        teamId: draft.teamId || null,
      });
      setWorkspace(current => ({ ...current, projects: [response.project, ...current.projects] }));
      setSelectedProjectId(response.project.id);
      setDraft({ name: '', description: '', teamId: '' });
      toast.success('Project roadmap created.');
    } catch (requestError) {
      toast.error(errorMessage(requestError));
    } finally {
      setSavingRoadmap(false);
    }
  };

  const generateArchitecture = async event => {
    event.preventDefault();
    setGeneratingArchitecture(true);
    setArchitectureError('');
    try {
      const response = await service.generateProjectArchitecture({
        ...architectureDraft,
        techStack: architectureDraft.techStack,
        teamId: architectureDraft.teamId,
        prdFile,
      });
      setWorkspace(current => ({ ...current, projects: [response.project, ...current.projects] }));
      setSelectedProjectId(response.project.id);
      setArchitectureDraft({ name: '', idea: '', techStack: '', teamId: '' });
      setPrdFile(null);
      toast.success('Architecture and implementation roadmap generated.');
    } catch (requestError) {
      setArchitectureError(errorMessage(requestError));
    } finally {
      setGeneratingArchitecture(false);
    }
  };

  const addTask = async event => {
    event.preventDefault();
    if (!project) return;
    setSavingTask(true);
    try {
      const response = await service.createBuildTask(project.id, {
        ...taskDraft,
        estimateHours: Number(taskDraft.estimateHours),
      });
      updateProject(response.project);
      setTaskDraft({ milestone: '', title: '', description: '', estimateHours: 2 });
      toast.success('Task added to the roadmap.');
    } catch (requestError) {
      toast.error(errorMessage(requestError));
    } finally {
      setSavingTask(false);
    }
  };

  const updateTask = async (task, changes) => {
    try {
      const response = await service.updateBuildTask(project.id, task.id, changes);
      updateProject(response.project);
    } catch (requestError) {
      toast.error(errorMessage(requestError));
    }
  };

  const changeProjectStatus = async status => {
    try {
      const response = await service.updateBuildProjectStatus(project.id, status);
      updateProject(response.project);
      toast.success(status === 'COMPLETED' ? 'Project marked complete.' : 'Project reopened.');
    } catch (requestError) {
      toast.error(errorMessage(requestError));
    }
  };

  const analyzeRepository = async event => {
    event.preventDefault();
    setAnalyzingRepository(true);
    try {
      const response = await service.analyzeBuildRepository(project.id, repositoryUrl.trim());
      updateProject(response.project);
      setRepositoryUrl(response.project.githubUrl);
      toast.success('Repository analysis is ready.');
    } catch (requestError) {
      toast.error(errorMessage(requestError));
    } finally {
      setAnalyzingRepository(false);
    }
  };

  const removeRepository = async () => {
    if (!project || !window.confirm('Remove this repository URL and its saved analysis? Your project tasks and showcase link will be kept.')) return;
    setRemovingRepository(true);
    try {
      const response = await service.removeBuildRepository(project.id);
      updateProject(response.project);
      setRepositoryUrl('');
      toast.success('Repository URL and analysis removed.');
    } catch (requestError) {
      toast.error(errorMessage(requestError));
    } finally {
      setRemovingRepository(false);
    }
  };

  const removeProject = item => setProjectPendingRemoval(item);

  const confirmProjectRemoval = async () => {
    if (!projectPendingRemoval) return;
    const item = projectPendingRemoval;
    setRemovingProjectId(item.id);
    try {
      await service.deleteBuildProject(item.id);
      const remainingProjects = workspace.projects.filter(projectItem => projectItem.id !== item.id);
      setWorkspace(current => ({ ...current, projects: current.projects.filter(projectItem => projectItem.id !== item.id) }));
      setSelectedProjectId(current => current === item.id || !current ? remainingProjects[0]?.id || '' : current);
      if ((selectedProjectId || workspace.projects[0]?.id) === item.id) {
        setRepositoryUrl(remainingProjects[0]?.githubUrl || '');
      }
      setProjectPendingRemoval(null);
      toast.success('Project removed from your workspace.');
    } catch (requestError) {
      toast.error(errorMessage(requestError));
    } finally {
      setRemovingProjectId('');
    }
  };

  const explainError = async event => {
    event.preventDefault();
    setDebugging(true);
    setDebugError('');
    setDebugResult(null);
    try {
      setDebugResult(await service.explainBuildError(debugInput));
    } catch (requestError) {
      setDebugError(errorMessage(requestError));
    } finally {
      setDebugging(false);
    }
  };

  const publishProject = async published => {
    try {
      const response = await service.updateBuildProjectShowcase(project.id, {
        published,
        showcaseUrl: published ? (showcaseUrl.trim() || project.githubUrl || null) : null,
      });
      updateProject(response.project);
      toast.success(published ? 'Project published to your profile.' : 'Project removed from your profile.');
    } catch (requestError) {
      toast.error(errorMessage(requestError));
    }
  };

  if (loading) return <Panel><p>Loading your project workspace...</p></Panel>;
  if (error) return <Notice onRetry={loadWorkspace}>{error}</Notice>;

  return <div className="project-mentor">
    <div className="project-mentor-hero">
      <div>
        <span className="project-mentor-eyebrow"><Sparkles size={14}/> BUILD WITH DIRECTION</span>
        <h1>AI Project Mentor</h1>
        <p>Turn your skills and interests into a plan, build with your team, and share what you ship.</p>
      </div>
      <div className="project-mentor-hero-art"><Rocket size={28}/></div>
    </div>

    <div className="project-mentor-tabs" role="tablist" aria-label="Project mentor sections">
      {tabs.map(({ id, label, icon: Icon }) => <button
        type="button"
        role="tab"
        aria-selected={activeTab === id}
        className={`project-mentor-tab ${activeTab === id ? 'active' : ''}`}
        key={id}
        onClick={() => setActiveTab(id)}
      ><Icon size={15}/>{label}</button>)}
      {project && <button type="button" className={`project-mentor-tab ${activeTab === 'repository' ? 'active' : ''}`} onClick={() => setActiveTab('repository')}><Github size={15}/> GitHub review</button>}
    </div>

    {activeTab === 'recommendations' && <section role="tabpanel">
      <div className="project-mentor-section-heading">
        <div><h2>Ideas matched to your profile</h2><p>Recommendations use your saved skills, interests, and career goal.</p></div>
        <button type="button" className="btn btn-primary" onClick={generateRecommendations} disabled={loadingRecommendations}>
          {loadingRecommendations ? <LoaderCircle className="project-mentor-spin" size={14}/> : <Sparkles size={14}/>}
          {loadingRecommendations ? 'Finding ideas...' : 'Get recommendations'}
        </button>
      </div>
      {recommendationsError && <p className="project-mentor-error" role="alert">{recommendationsError}</p>}
      {recommendations.length > 0 ? <div className="grid grid-2">{recommendations.map((idea, index) => <Panel key={`${idea.title}-${index}`}>
        <div className="row between"><span className="badge badge-purple">{idea.difficulty}</span><span className="muted">{idea.estimatedWeeks} weeks</span></div>
        <h3 className="project-mentor-idea-title">{idea.title}</h3>
        <p>{idea.description}</p>
        <p><b>Why it fits:</b> {idea.whyItFits}</p>
        <div className="row project-mentor-wrap">{idea.skillsToPractice.map(skill => <span className="badge" key={skill}>{skill}</span>)}</div>
        <button type="button" className="btn btn-secondary project-mentor-action" onClick={() => startIdea(idea)}>Build this idea <ArrowRight size={14}/></button>
      </Panel>)}</div> : !loadingRecommendations && !recommendationsError && <Panel className="project-mentor-empty"><Lightbulb size={24}/><h3>Get a focused project idea</h3><p>Ask Gemini for practical ideas based on the skills and goals in your profile.</p></Panel>}
    </section>}

    {activeTab === 'architecture' && <section role="tabpanel" className="project-architecture-layout">
      <Panel>
        <div className="project-mentor-section-heading">
          <div><h2>Architecture &amp; roadmap planner</h2><p>Describe the idea, choose your stack, and optionally attach a PRD. Gemini creates a system design and a trackable milestone plan.</p></div>
          <BookOpen size={19} className="accent"/>
        </div>
        <form onSubmit={generateArchitecture}>
          <Field label="Project idea name"><input className="input" required minLength={2} maxLength={120} value={architectureDraft.name} onChange={event => setArchitectureDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Campus food sharing platform"/></Field>
          <Field label="Describe the idea and requirements"><textarea className="textarea project-architecture-idea" required minLength={20} maxLength={4000} value={architectureDraft.idea} onChange={event => setArchitectureDraft(current => ({ ...current, idea: event.target.value }))} placeholder="Who is it for? What problem does it solve? What are the core user flows and constraints?"/></Field>
          <Field label="Technology stack (comma separated)"><input className="input" required value={architectureDraft.techStack} onChange={event => setArchitectureDraft(current => ({ ...current, techStack: event.target.value }))} placeholder="React, Node.js, PostgreSQL, Redis"/></Field>
          <Field label="Attach a PRD (optional · PDF, DOC, DOCX, TXT, or Markdown · max 8 MB)">
            <label className="project-prd-upload">
              <Upload size={16}/>
              <span>{prdFile ? prdFile.name : 'Choose a requirements document'}</span>
              <input key={prdFile?.name || 'no-prd'} type="file" accept=".pdf,.doc,.docx,.txt,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" onChange={event => setPrdFile(event.target.files?.[0] || null)}/>
            </label>
            {prdFile && <button type="button" className="btn btn-secondary project-prd-clear" onClick={() => setPrdFile(null)}>Remove selected file</button>}
          </Field>
          <Field label="Create this in a team workspace (optional)"><select className="select" value={architectureDraft.teamId} onChange={event => setArchitectureDraft(current => ({ ...current, teamId: event.target.value }))}><option value="">Personal project</option>{workspace.teams.map(team => <option value={team.id} key={team.id}>{team.name} · {team.members.length} members</option>)}</select></Field>
          {architectureError && <p className="project-mentor-error" role="alert">{architectureError}</p>}
          <button type="submit" className="btn btn-primary" disabled={generatingArchitecture}>{generatingArchitecture ? <LoaderCircle className="project-mentor-spin" size={14}/> : <Sparkles size={14}/>}Generate architecture &amp; roadmap</button>
        </form>
        <p className="project-architecture-privacy">PDF, Word DOC/DOCX, TXT, and Markdown are supported. Documents are extracted or sent to Gemini for this request and are not saved to your project.</p>
      </Panel>
      {project?.architecture ? <ArchitectureReport project={project}/> : <Panel className="project-mentor-empty"><FileText size={24}/><h3>From requirements to a build plan</h3><p>Your generated system architecture, data model, API design, security checklist, and milestones will appear here.</p></Panel>}
    </section>}

    {activeTab === 'debug' && <section role="tabpanel" className="grid grid-2">
      <Panel>
        <h2>AI debugging assistant</h2>
        <p>Get an explanation and safe diagnostic steps. Submitted code is not executed.</p>
        <form onSubmit={explainError}>
          <Field label="Error message"><textarea className="textarea" required minLength={5} maxLength={10000} value={debugInput.errorText} onChange={event => setDebugInput(current => ({ ...current, errorText: event.target.value }))} placeholder="Paste the error or stack trace"/></Field>
          <Field label="Language or framework (optional)"><input className="input" maxLength={80} value={debugInput.language} onChange={event => setDebugInput(current => ({ ...current, language: event.target.value }))} placeholder="e.g. React, Python, PostgreSQL"/></Field>
          <Field label="What were you doing? (optional)"><textarea className="textarea" maxLength={2000} value={debugInput.context} onChange={event => setDebugInput(current => ({ ...current, context: event.target.value }))} placeholder="A short description of the context"/></Field>
          {debugError && <p role="alert" className="project-mentor-error">{debugError}</p>}
          <button type="submit" className="btn btn-primary" disabled={debugging}>{debugging ? <LoaderCircle className="project-mentor-spin" size={14}/> : <Sparkles size={14}/>}Explain this error</button>
        </form>
      </Panel>
      {debugResult ? <Panel>
        <h2>What this may mean</h2><p>{debugResult.explanation}</p>
        <h3>Likely causes</h3><ul>{debugResult.likelyCauses.map((item, index) => <li key={index}>{item}</li>)}</ul>
        <h3>Try these steps</h3><ol>{debugResult.steps.map((item, index) => <li key={index}>{item}</li>)}</ol>
        {debugResult.exampleFix && <><h3>Example fix to review</h3><pre className="project-mentor-code">{debugResult.exampleFix}</pre></>}
        <p className="muted">AI guidance can be wrong. Review suggestions before changing your project.</p>
      </Panel> : <Panel className="project-mentor-empty"><CircleHelp size={24}/><h3>Understand the error, not just the fix</h3><p>Share the message and a little context to get a step-by-step explanation.</p></Panel>}
    </section>}

    {activeTab === 'overview' && <section role="tabpanel" className="project-mentor-layout">
      <div className="project-mentor-main">
        <Panel>
          <div className="project-mentor-section-heading"><div><h2>Create a project roadmap</h2><p>Gemini turns a project brief into milestones and trackable tasks.</p></div><BookOpen size={19} className="accent"/></div>
          <form onSubmit={createRoadmap}>
            <Field label="Project name"><input className="input" required minLength={2} maxLength={120} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Campus food sharing app"/></Field>
            <Field label="What do you want to build?"><textarea className="textarea" required minLength={20} maxLength={2000} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="Describe the problem, who it helps, and the core features."/></Field>
            <Field label="Collaborate with an existing team (optional)"><select className="select" value={draft.teamId} onChange={event => setDraft(current => ({ ...current, teamId: event.target.value }))}><option value="">Just me for now</option>{workspace.teams.map(team => <option value={team.id} key={team.id}>{team.name} · {team.members.length} members</option>)}</select></Field>
            <button type="submit" className="btn btn-primary" disabled={savingRoadmap}>{savingRoadmap ? <LoaderCircle className="project-mentor-spin" size={14}/> : <Sparkles size={14}/>}Generate roadmap</button>
          </form>
        </Panel>

        {project ? <Panel>
          <div className="project-mentor-section-heading"><div><h2>{project.name}</h2><p>{project.description}</p></div><span className={`badge ${project.status === 'COMPLETED' ? 'badge-green' : 'badge-purple'}`}>{project.status === 'COMPLETED' ? 'Completed' : 'In progress'}</span></div>
          {project.team && <p className="project-mentor-team"><Users size={14}/> {project.team.name} · {teamMembers.length} team members</p>}
          <div className="project-mentor-progress"><div className="row between"><span className="muted">Task progress</span><b>{completedTasks}/{project.tasks.length} complete</b></div><div className="progress"><span style={{ width: `${projectProgress}%` }}/></div></div>

          <div className="project-mentor-section-heading"><h3>Roadmap &amp; team tasks</h3>{isOwner && (project.status === 'COMPLETED'
            ? <button type="button" className="btn btn-secondary" onClick={() => changeProjectStatus('ACTIVE')}>Reopen project</button>
            : <button type="button" className="btn btn-secondary" disabled={!project.tasks.length || projectProgress !== 100} onClick={() => changeProjectStatus('COMPLETED')}><Check size={14}/>Mark complete</button>)}</div>
          {project.tasks.length ? <div className="project-mentor-task-list">{project.tasks.map(task => <div className="project-mentor-task" key={task.id}>
            <div className="project-mentor-task-content"><div className="row project-mentor-wrap"><span className="badge badge-purple">{task.milestone}</span><b>{task.title}</b></div><p>{task.description}</p><span className="muted">{task.estimateHours}h estimate{task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ''}</span></div>
            <div className="project-mentor-task-controls">
              <select aria-label={`Status for ${task.title}`} className="select" value={task.status} onChange={event => updateTask(task, { status: event.target.value })}><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="BLOCKED">Blocked</option><option value="DONE">Done</option></select>
              {project.team && <select aria-label={`Assignee for ${task.title}`} className="select" value={task.assigneeId || ''} onChange={event => updateTask(task, { assigneeId: event.target.value || null })}><option value="">Unassigned</option>{teamMembers.map(member => <option value={member.id} key={member.id}>{member.name}</option>)}</select>}
            </div>
          </div>)}</div> : <p className="muted">Create a roadmap to add milestones and tasks.</p>}

          <details className="project-mentor-add-task"><summary><Plus size={14}/> Add a task</summary><form onSubmit={addTask}>
            <div className="grid grid-2"><Field label="Milestone"><input className="input" required maxLength={120} value={taskDraft.milestone} onChange={event => setTaskDraft(current => ({ ...current, milestone: event.target.value }))} placeholder="e.g. MVP"/></Field><Field label="Task title"><input className="input" required maxLength={160} value={taskDraft.title} onChange={event => setTaskDraft(current => ({ ...current, title: event.target.value }))} placeholder="A measurable next step"/></Field></div>
            <Field label="Task details"><textarea className="textarea" required maxLength={1000} value={taskDraft.description} onChange={event => setTaskDraft(current => ({ ...current, description: event.target.value }))}/></Field>
            <button type="submit" className="btn btn-secondary" disabled={savingTask}>{savingTask ? 'Adding...' : 'Add task'}</button>
          </form></details>

          {project.status === 'COMPLETED' && isOwner && <div className="project-mentor-showcase">
            <h3>Publish to your profile</h3><p>Share this completed project with mentors and teammates.</p>
            {!project.showcasedAt && <Field label="Public project link"><input className="input" type="url" value={showcaseUrl || project.githubUrl || ''} onChange={event => setShowcaseUrl(event.target.value)} placeholder="https://github.com/owner/repository"/></Field>}
            {project.showcasedAt ? <div className="row between"><span className="badge badge-green">Published on your profile</span><button type="button" className="btn btn-secondary" onClick={() => publishProject(false)}>Unpublish</button></div> : <button type="button" className="btn btn-primary" onClick={() => publishProject(true)}>Publish project</button>}
          </div>}
        </Panel> : <Panel className="project-mentor-empty"><Rocket size={24}/><h3>Your project workspace starts here</h3><p>Describe what you want to build and get a step-by-step roadmap.</p><button type="button" className="btn btn-secondary" onClick={() => setActiveTab('recommendations')}>Browse project ideas <ArrowRight size={14}/></button></Panel>}
      </div>

      <aside className="project-mentor-aside">
        <Panel><h3>Your workspaces</h3><p>Saved projects and their shared team tasks.</p>
          {workspace.projects.length ? <div className="project-mentor-project-list">{workspace.projects.map(item => <div className="project-mentor-project-item" key={item.id}>
            <button type="button" className={`project-mentor-project-link ${project?.id === item.id ? 'active' : ''}`} onClick={() => { setSelectedProjectId(item.id); setRepositoryUrl(item.githubUrl || ''); }}>
              <span>{item.name}</span><small>{item.tasks.filter(task => task.status === 'DONE').length}/{item.tasks.length} tasks · {item.team?.name || 'Personal'}</small>
            </button>
            {item.ownerId === user.id && <button type="button" className="btn btn-danger project-mentor-project-remove" aria-label={`Remove ${item.name} from workspace`} title="Remove project" disabled={Boolean(removingProjectId)} onClick={() => removeProject(item)}>
              <Trash2 size={15}/>
            </button>}
          </div>)}</div> : <p className="muted">No saved projects yet.</p>}
        </Panel>
        {project && <Panel>
          <div className="row between"><h3>Repository quality</h3><Github size={17} className="accent"/></div>
          {project.qualityScore !== null && project.qualityScore !== undefined ? <><div className="project-mentor-quality-score">{project.qualityScore}<span>/100</span></div><p className="muted">Evidence-based estimate, not a production or hiring certification.</p><button type="button" className="btn btn-secondary project-mentor-action" onClick={() => setActiveTab('repository')}>View analysis <ArrowRight size={14}/></button></> : <p className="muted">Analyze a public GitHub repository to get a transparent quality score and suggestions.</p>}
        </Panel>}
      </aside>
    </section>}

    {activeTab === 'repository' && <section role="tabpanel" className="grid grid-2">
      <Panel>
        <div className="row between"><h2>GitHub repository analysis</h2><Github size={18} className="accent"/></div>
        <p>Review structure, README, languages, commit activity, and areas to improve. Only public repositories are supported.</p>
        {isOwner ? <form onSubmit={analyzeRepository}>
          <Field label="Public repository URL"><input className="input" type="url" required maxLength={250} value={repositoryUrl} onChange={event => setRepositoryUrl(event.target.value)} placeholder="https://github.com/owner/repository"/></Field>
          <div className="row project-mentor-wrap"><button type="submit" className="btn btn-primary" disabled={analyzingRepository}>{analyzingRepository ? <LoaderCircle className="project-mentor-spin" size={14}/> : <Activity size={14}/>}Analyze repository</button>
            {(project.githubUrl || project.repositoryAnalysis) && <button type="button" className="btn btn-danger" disabled={removingRepository || analyzingRepository} onClick={removeRepository}>{removingRepository ? <LoaderCircle className="project-mentor-spin" size={14}/> : <Trash2 size={14}/>}Remove repository &amp; analysis</button>}
          </div>
        </form> : <p className="muted">Only the project owner can run a repository analysis.</p>}
      </Panel>
      {project?.repositoryAnalysis ? <RepositoryReport analysis={project.repositoryAnalysis}/> : <Panel className="project-mentor-empty"><Github size={24}/><h3>See what is already strong</h3><p>Get a structured review from repository evidence, with next steps grounded in the README and code layout.</p></Panel>}
    </section>}
    {projectPendingRemoval && <div
      className="project-removal-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !removingProjectId) setProjectPendingRemoval(null);
      }}
    >
      <section
        className="project-removal-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="project-removal-title"
        aria-describedby="project-removal-description"
        ref={removalDialogRef}
      >
        <button type="button" className="project-removal-close" aria-label="Close confirmation" disabled={Boolean(removingProjectId)} onClick={() => setProjectPendingRemoval(null)}><X size={18}/></button>
        <div className="project-removal-icon"><AlertTriangle size={22}/></div>
        <h2 id="project-removal-title">Delete this project?</h2>
        <p id="project-removal-description">You’re about to permanently delete <strong>{projectPendingRemoval.name}</strong> and all its tasks. This action can’t be undone.</p>
        <div className="project-removal-warning"><Trash2 size={15}/><span>The project will be removed from your workspace and any shared team workspace.</span></div>
        <div className="project-removal-actions">
          <button ref={removalCancelRef} type="button" className="btn btn-secondary" disabled={Boolean(removingProjectId)} onClick={() => setProjectPendingRemoval(null)}>Keep project</button>
          <button type="button" className="btn btn-danger project-removal-confirm" disabled={Boolean(removingProjectId)} onClick={confirmProjectRemoval}>
            {removingProjectId ? <LoaderCircle className="project-mentor-spin" size={15}/> : <Trash2 size={15}/>}
            {removingProjectId ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </section>
    </div>}
  </div>;
}

function RepositoryReport({ analysis }) {
  return <Panel className="project-mentor-report">
    <div className="row between"><div><h2>{analysis.repository}</h2><a className="accent" href={analysis.url} target="_blank" rel="noreferrer">Open repository <ArrowRight size={12}/></a></div><span className="project-mentor-quality-score">{analysis.quality.score}<span>/100</span></span></div>
    <p>{analysis.insights.summary}</p>
    <p className="muted">Heuristic evidence score, not a production or hiring certification. Analyzed {new Date(analysis.analyzedAt).toLocaleString()}.</p>
    <div className="project-mentor-score-dimensions">{Object.entries(analysis.quality.dimensions).map(([name, value]) => <div key={name}><div className="row between"><span>{name[0].toUpperCase() + name.slice(1)}</span><b>{value}/25</b></div><div className="progress"><span style={{ width: `${value * 4}%` }}/></div></div>)}</div>
    <div className="row project-mentor-wrap">{analysis.languages.map(language => <span className="badge badge-purple" key={language.name}>{language.name}</span>)}</div>
    <p className="muted">{analysis.tree.length} files in repository tree · {analysis.commits.length} recent commits · {analysis.stars} stars</p>
    <p className="muted">Default branch: {analysis.defaultBranch} · Last updated: {new Date(analysis.updatedAt).toLocaleDateString()}</p>
    <details><summary>Repository structure ({analysis.tree.length} paths scanned)</summary><pre className="project-mentor-readme">{analysis.tree.slice(0, 100).map(item => `${item.type === 'tree' ? '[dir] ' : ''}${item.path}`).join('\n')}{analysis.tree.length > 100 ? '\n…' : ''}</pre></details>
    <h3 style={{ marginTop: 12 }}>Recent commit activity</h3>
    {analysis.commits.map((commit, index) => <div className="list-item" key={`${commit.date}-${index}`}><b>{commit.message || 'Commit'}</b><p>{commit.date ? new Date(commit.date).toLocaleString() : 'Date unavailable'}</p></div>)}
    <h3>What is working</h3><ul>{analysis.insights.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul>
    <h3>Suggested next steps</h3><ul>{analysis.insights.nextSteps.map((item, index) => <li key={index}>{item}</li>)}</ul>
    {analysis.readme && <details><summary>README excerpt</summary><pre className="project-mentor-readme">{analysis.readme}</pre></details>}
  </Panel>;
}

function ArchitectureReport({ project }) {
  const architecture = project.architecture;
  return <Panel className="project-architecture-report">
    <div className="row between"><div><span className="badge badge-green">Architecture saved</span><h2 style={{ marginTop: 10 }}>{project.name}</h2></div><BookOpen size={19} className="accent"/></div>
    <p>{architecture.overview}</p>
    <ArchitectureDiagram architecture={architecture}/>
    {project.techStack?.length > 0 && <div className="project-architecture-report-section"><h3>Selected technology stack</h3><div className="row project-mentor-wrap">{project.techStack.map(item => <span className="badge badge-purple" key={item}>{item}</span>)}</div></div>}
    <div className="project-architecture-report-section"><h3>Assumptions</h3><ul>{architecture.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
    <div className="project-architecture-report-section"><h3>System components</h3>{architecture.components.map((component, index) => <div className="project-architecture-component" key={`${component.name}-${index}`}><div className="row between"><b>{component.name}</b><span className="badge">{component.technology}</span></div><p>{component.responsibilities}</p></div>)}</div>
    <div className="project-architecture-report-section"><h3>Data model</h3>{architecture.dataModel.map((entity, index) => <div className="project-architecture-component" key={`${entity.name}-${index}`}><b>{entity.name}</b><p>{entity.fields.join(' · ')}</p></div>)}</div>
    <div className="project-architecture-report-section"><h3>API design</h3><div className="project-architecture-endpoints">{architecture.apiEndpoints.map((endpoint, index) => <div className="project-architecture-endpoint" key={`${endpoint.method}-${endpoint.path}-${index}`}><span className="badge badge-purple">{endpoint.method}</span><code>{endpoint.path}</code><span>{endpoint.purpose}</span></div>)}</div></div>
    <div className="project-architecture-report-section"><h3>Data flow</h3><ol>{architecture.dataFlow.map((item, index) => <li key={index}>{item}</li>)}</ol></div>
    <div className="project-architecture-report-section"><h3>Security checklist</h3><ul>{architecture.securityConsiderations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
    <p className="muted">Generated architecture is a starting point. Validate security, scale, and implementation details for your actual requirements.</p>
  </Panel>;
}

function ArchitectureDiagram({ architecture }) {
  const systemView = architecture.diagram?.systemView;
  const componentFlows = architecture.diagram?.componentFlows?.length
    ? architecture.diagram.componentFlows
    : architecture.dataFlow.slice(0, -1).map((step, index) => ({
      from: `Step ${index + 1}`,
      to: `Step ${index + 2}`,
      label: step,
    }));
  const entityRelationships = architecture.diagram?.entityRelationships || [];
  const entitiesByName = new Map(architecture.dataModel.map(entity => [entity.name.toLocaleLowerCase(), entity]));
  const entityCard = entity => <div className="project-architecture-diagram-entity" key={entity.name}>
    <b>{entity.name}</b>
    <span>{entity.fields.join(' · ')}</span>
  </div>;

  return <section className="project-architecture-report-section" aria-label="Architecture diagrams">
    <h3>Architecture diagrams</h3>
    {systemView && <div className="project-architecture-system-view" aria-label="Platform data flow and technology stack diagram">
      <h4>Platform data flow &amp; technology stack</h4>
      <div className="project-architecture-system-actors">
        <b>Users</b>
        <div>{systemView.actors.map(actor => <span className="project-architecture-system-actor" key={actor}>{actor}</span>)}</div>
      </div>
      <div className="project-architecture-system-layers">
        {systemView.layers.map((layer, index) => <Fragment key={`${layer.name}-${index}`}>
          {index > 0 && <ArrowRight className="project-architecture-system-arrow" size={18} aria-hidden="true"/>}
          <article className="project-architecture-system-layer">
            <h5>{layer.name}</h5>
            <div className="project-architecture-system-technologies">{layer.technologies.map(technology => <span key={technology}>{technology}</span>)}</div>
            <ul>{layer.components.map(component => <li key={component}>{component}</li>)}</ul>
          </article>
        </Fragment>)}
      </div>
      <div className="project-architecture-system-support">
        {systemView.integrations.length > 0 && <div className="project-architecture-system-integrations">
          <b>External integrations</b>
          {systemView.integrations.map(integration => <div key={integration.name}><strong>{integration.name}</strong><span>{integration.purpose}</span></div>)}
        </div>}
        <div className="project-architecture-system-deployment"><b>Deployment</b><span>{systemView.deployment}</span></div>
      </div>
      <div className="project-architecture-system-flow">
        <b>Key user flow</b>
        <ol>{systemView.userFlow.map((step, index) => <li key={`${step}-${index}`}><span>{index + 1}</span>{step}</li>)}</ol>
      </div>
    </div>}
    <h4>System component flow</h4>
    <div className="project-architecture-diagram" aria-label="System component flow diagram">
      {componentFlows.map((flow, index) => <div className="project-architecture-diagram-flow" key={`${flow.from}-${flow.to}-${index}`}>
        <div className="project-architecture-diagram-node"><b>{flow.from}</b></div>
        <ArrowRight className="project-architecture-diagram-arrow" size={18} aria-hidden="true"/>
        <div className="project-architecture-diagram-node"><b>{flow.to}</b></div>
        <span className="project-architecture-diagram-label">{flow.label}</span>
      </div>)}
    </div>
    <h4 className="project-architecture-diagram-subheading">Data model relationships (ER)</h4>
    {entityRelationships.length
      ? <div className="project-architecture-diagram">
        {entityRelationships.map((relationship, index) => {
          const from = entitiesByName.get(relationship.from.toLocaleLowerCase());
          const to = entitiesByName.get(relationship.to.toLocaleLowerCase());
          if (!from || !to) return null;
          return <div className="project-architecture-diagram-er" key={`${relationship.from}-${relationship.to}-${index}`}>
            {entityCard(from)}
            <div className="project-architecture-diagram-relation">
              <span>{relationship.cardinality}</span>
              <b>{relationship.label}</b>
            </div>
            {entityCard(to)}
          </div>;
        })}
      </div>
      : <div className="project-architecture-diagram-entities">
        {architecture.dataModel.map(entityCard)}
        <p className="muted">Relationships were not included in this saved architecture.</p>
      </div>}
  </section>;
}
