import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, ChevronRight, Lightbulb, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { currentUser, scoreFor, useStore } from './store/useStore';
import { service } from './services/api';

const isDemo = user => user?.email?.endsWith('@skillmesh.demo');
const errorMessage = error => error.response?.data?.error?.message || error.message || 'Something went wrong. Please try again.';
const localInputDate = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const defaultSessionStart = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return localInputDate(date);
};
const dateLabel = value => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function Heading({ title, subtitle, action }) {
  return <div className="page-title"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="row">{action}</div>}</div>;
}

function Panel({ children, className = '' }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function ActionButton({ children, variant = 'primary', ...props }) {
  return <button className={`btn btn-${variant}`} {...props}>{children}</button>;
}

function Field({ label, children }) {
  return <div className="field"><label className="label">{label}{children}</label></div>;
}

function Input(props) {
  return <input className="input" {...props}/>;
}

function demoLeaderboard(store) {
  return store.users
    .filter(user => user.role === 'student')
    .map(user => ({ id: user.id, name: user.name, score: scoreFor(user).total, tier: scoreFor(user).tier, skills: (user.skills || []).map(skill => skill.name), activityMinutes: (store.activities || []).filter(activity => activity.userId === user.id).reduce((sum, activity) => sum + activity.duration, 0), quizAttempts: 0 }))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
}

export function MentorDashboard() {
  const store = useStore();
  const user = currentUser(store);
  const demo = isDemo(user);
  const [data, setData] = useState({ sessions: [], projects: [], leaderboard: [] });
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (demo) {
      setData({
        sessions: store.mentorSessions.filter(session => session.mentorId === user.id),
        projects: store.mentorProjects.filter(project => project.mentorId === user.id),
        leaderboard: demoLeaderboard(store),
      });
      setLoading(false);
      setError('');
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([service.getMentorSessions(), service.getMentorProjects(), service.getMentorLeaderboard()])
      .then(([sessions, projects, leaderboard]) => {
        if (active) setData({ sessions: sessions.sessions, projects: projects.projects, leaderboard: leaderboard.leaderboard });
      })
      .catch(requestError => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [demo, retry, store.mentorProjects, store.mentorSessions, store.users, store.activities, user.id]);

  const upcomingSessions = data.sessions.filter(session => session.status === 'OPEN' && new Date(session.startsAt) > new Date());
  const activeProjects = data.projects.filter(project => project.status === 'OPEN');
  const pendingIdeas = data.projects.reduce((total, project) =>
    total + (project.submissions || []).filter(submission => submission.status === 'PENDING').length, 0);

  return <>
    <Heading title={`Welcome, ${user.name.split(' ')[0]}`} subtitle="Guide students from promising ideas to shipped projects." action={<Link className="btn btn-primary" to="/mentor/sessions"><Plus size={14}/> Create a session</Link>}/>
    {error && <Panel><p role="alert">Could not load mentor workspace: {error}</p><ActionButton variant="secondary" onClick={() => setRetry(value => value + 1)}>Retry</ActionButton></Panel>}
    {loading ? <Panel><p>Loading your mentor workspace...</p></Panel> : <>
      <div className="grid grid-4">
        <div className="card"><div className="stat-label">Upcoming sessions</div><div className="stat-value">{upcomingSessions.length}</div><div className="muted">Sessions open for students</div></div>
        <div className="card"><div className="stat-label">Open project briefs</div><div className="stat-value">{activeProjects.length}</div><div className="muted">Accepting student ideas</div></div>
        <div className="card"><div className="stat-label">Ideas to review</div><div className="stat-value">{pendingIdeas}</div><div className="muted">Waiting for your feedback</div></div>
        <div className="card"><div className="stat-label">Student leaderboard</div><div className="stat-value">{data.leaderboard.length}</div><div className="muted">Ranked by Builder Score</div></div>
      </div>
      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <Panel>
          <div className="row between"><div><h2>Next sessions</h2><p>Keep time for focused student guidance.</p></div><Link className="accent" to="/mentor/sessions">Manage <ChevronRight size={14}/></Link></div>
          {upcomingSessions.slice(0, 3).map(session => <div className="list-item row between" key={session.id}><div><b>{session.title}</b><p>{dateLabel(session.startsAt)} · {session.duration} min</p></div><span className="muted">{session.bookedCount ?? session.bookings?.length ?? 0}/{session.capacity} booked</span></div>)}
          {!upcomingSessions.length && <p className="muted">No upcoming sessions yet. Create one to start meeting students.</p>}
        </Panel>
        <Panel>
          <div className="row between"><div><h2>Project ideas</h2><p>Student proposals connected to your briefs.</p></div><Link className="accent" to="/mentor/projects">Review ideas <ChevronRight size={14}/></Link></div>
          {data.projects.slice(0, 3).map(project => <div className="list-item row between" key={project.id}><div><b>{project.title}</b><p>{project.submissions?.length ?? project.submissionCount ?? 0} submissions · {project.status.toLowerCase()}</p></div><span className="muted">{project.submissions?.filter(submission => submission.status === 'PENDING').length || 0} pending</span></div>)}
          {!data.projects.length && <p className="muted">Publish a project brief so students can submit their ideas.</p>}
        </Panel>
      </div>
      <Panel className="mentor-leaderboard-preview" style={{ marginTop: 14 }}>
        <div className="row between"><div><h2>Student leaders</h2><p>Transparent performance signal based on skills, learning activity, evidence, and quiz results.</p></div><Link className="accent" to="/mentor/leaderboard">Full leaderboard <ChevronRight size={14}/></Link></div>
        {data.leaderboard.slice(0, 5).map((student, index) => <div className="list-item row between" key={student.id}><div className="row"><span className="badge badge-purple">#{index + 1}</span><div><b>{student.name}</b><p>{(student.skills || []).slice(0, 3).join(' · ') || 'Skills not added yet'}</p></div></div><span className="badge badge-green">{student.score} · {student.tier}</span></div>)}
      </Panel>
    </>}
  </>;
}

export function MentorSessions({ student = false }) {
  const store = useStore();
  const user = currentUser(store);
  const demo = isDemo(user);
  const [sessions, setSessions] = useState(() => demo ? store.mentorSessions : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [form, setForm] = useState({ title: '', description: '', startsAt: defaultSessionStart(), duration: 45, capacity: 6 });

  useEffect(() => {
    if (demo) {
      const all = store.mentorSessions.filter(session => student
        ? session.status === 'OPEN' && new Date(session.startsAt) > new Date()
        : session.mentorId === user.id);
      setSessions(student
        ? all.map(session => ({ ...session, bookedByMe: session.bookings.some(booking => booking.student?.id === user.id) }))
        : all);
      setLoading(false);
      setError('');
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    const request = student
      ? Promise.all([service.getOpenMentorSessions(), service.getBookedMentorSessions()])
        .then(([available, booked]) => {
          const bookedIds = new Set(booked.sessions.map(session => session.id));
          return available.sessions.map(session => ({ ...session, bookedByMe: session.bookedByMe || bookedIds.has(session.id) }));
        })
      : service.getMentorSessions().then(response => response.sessions);
    request.then(records => { if (active) setSessions(records); })
      .catch(requestError => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, retry, student, store.mentorSessions, user.id]);

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        startsAt: new Date(form.startsAt).toISOString(),
        duration: Number(form.duration),
        capacity: Number(form.capacity),
      };
      if (demo) store.addMentorSession(payload);
      else await service.createMentorSession(payload);
      setForm({ title: '', description: '', startsAt: defaultSessionStart(), duration: 45, capacity: 6 });
      toast.success('Mentor session created.');
      if (!demo) setRetry(value => value + 1);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const updateSessionStatus = async (session, status) => {
    setSaving(true);
    setError('');
    try {
      if (demo) store.updateMentorSessionStatus(session.id, status);
      else {
        await service.updateMentorSession(session.id, status);
        setSessions(current => current.map(item => item.id === session.id ? { ...item, status } : item));
      }
      toast.success(status === 'CANCELLED' ? 'Session cancelled.' : 'Session marked complete.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const book = async (session, cancel = false) => {
    setSaving(true);
    setError('');
    try {
      if (demo) {
        if (cancel) store.cancelSessionBooking(session.id);
        else store.bookMentorSession(session.id);
      } else if (cancel) await service.cancelMentorSessionBooking(session.id);
      else await service.bookMentorSession(session.id);
      if (demo) {
        const refreshed = store.mentorSessions.find(item => item.id === session.id);
        setSessions(current => current.map(item => item.id === session.id
          ? { ...refreshed, bookedByMe: refreshed.bookings.some(booking => booking.student?.id === user.id) }
          : item));
      } else {
        setSessions(current => current.map(item => item.id === session.id
          ? { ...item, bookedByMe: !cancel, bookedCount: Math.max(0, (item.bookedCount || 0) + (cancel ? -1 : 1)) }
          : item));
      }
      toast.success(cancel ? 'Your booking was cancelled.' : 'You are booked for this session.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const visibleSessions = sessions.slice().sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));

  return <>
    <Heading title={student ? 'Mentor sessions' : 'Mentorship sessions'} subtitle={student ? 'Find a time to get practical guidance from a mentor.' : 'Create office hours, workshops, and focused one-to-one sessions.'}/>
    {error && <Panel><p role="alert">{error}</p><ActionButton variant="secondary" onClick={() => setRetry(value => value + 1)}>Retry</ActionButton></Panel>}
    {loading && <Panel><p>Loading sessions...</p></Panel>}
    {!student && <Panel style={{ marginBottom: 14 }}>
      <h2><CalendarDays size={17}/> Create a session</h2>
      <form onSubmit={submit}>
        <div className="grid grid-2">
          <Field label="Session title"><Input required minLength={3} maxLength={120} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="e.g. Portfolio feedback clinic"/></Field>
          <Field label="Start time"><Input required type="datetime-local" value={form.startsAt} min={localInputDate(new Date())} onChange={event => setForm(current => ({ ...current, startsAt: event.target.value }))}/></Field>
          <Field label="Description"><textarea className="textarea" required minLength={10} maxLength={2000} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="What should students prepare?"/></Field>
          <div className="grid grid-2">
            <Field label="Duration (minutes)"><Input type="number" min="15" max="180" required value={form.duration} onChange={event => setForm(current => ({ ...current, duration: event.target.value }))}/></Field>
            <Field label="Student capacity"><Input type="number" min="1" max="50" required value={form.capacity} onChange={event => setForm(current => ({ ...current, capacity: event.target.value }))}/></Field>
          </div>
        </div>
        <ActionButton disabled={saving}>{saving ? 'Creating...' : <><Plus size={14}/> Publish session</>}</ActionButton>
      </form>
    </Panel>}
    {!loading && <div className="grid grid-2">
      {visibleSessions.map(session => {
        const bookedCount = session.bookedCount ?? session.bookings?.length ?? 0;
        const isFull = bookedCount >= session.capacity;
        return <Panel key={session.id}>
          <div className="row between"><span className={`badge ${session.status === 'OPEN' ? 'badge-green' : 'badge-amber'}`}>{session.status === 'OPEN' ? 'Open' : session.status}</span><span className="muted">{bookedCount}/{session.capacity} seats</span></div>
          <h2 style={{ marginTop: 12 }}>{session.title}</h2>
          <p>{session.description}</p>
          <p><b>{dateLabel(session.startsAt)}</b> · {session.duration} minutes</p>
          {student && session.mentor && <p>Mentor: {session.mentor.name}</p>}
          {!student && session.bookings?.length > 0 && <div className="list-item"><b>Booked students</b>{session.bookings.map(booking => <p key={booking.id || booking.student.id}>{booking.student.name}</p>)}</div>}
          {student && <ActionButton disabled={saving || (!session.bookedByMe && (isFull || session.status !== 'OPEN'))} variant={session.bookedByMe ? 'secondary' : 'primary'} onClick={() => book(session, session.bookedByMe)}>{session.bookedByMe ? 'Cancel booking' : isFull ? 'Session full' : 'Book session'}</ActionButton>}
          {!student && session.status === 'OPEN' && new Date(session.startsAt) > new Date() && <ActionButton disabled={saving} variant="danger" onClick={() => updateSessionStatus(session, 'CANCELLED')}>Cancel session</ActionButton>}
          {!student && session.status === 'OPEN' && new Date(session.startsAt) <= new Date() && <ActionButton disabled={saving} variant="secondary" onClick={() => updateSessionStatus(session, 'COMPLETED')}>Mark complete</ActionButton>}
          {(student ? session.bookedByMe : session.status !== 'CANCELLED') && <Link className="btn btn-secondary meeting-open-link" to={student ? `/meet/sessions/${session.id}` : `/mentor/sessions/${session.id}/meeting`}>Open meeting workspace</Link>}
        </Panel>;
      })}
      {!visibleSessions.length && <Panel className="empty">{student ? 'There are no open mentor sessions right now.' : 'No sessions yet. Create a session above to invite students.'}</Panel>}
    </div>}
  </>;
}

export function MentorProjects({ student = false }) {
  const store = useStore();
  const user = currentUser(store);
  const demo = isDemo(user);
  const [projects, setProjects] = useState(() => demo ? store.mentorProjects : []);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [form, setForm] = useState({ title: '', description: '', skills: '' });

  useEffect(() => {
    if (demo) {
      const records = store.mentorProjects.filter(project => student || project.mentorId === user.id);
      setProjects(student ? records.map(project => ({
        ...project,
        mySubmission: project.submissions.find(submission => submission.studentId === user.id) || null,
      })) : records);
      setLoading(false);
      setError('');
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    const request = student ? service.getOpenMentorProjects() : service.getMentorProjects();
    request.then(response => { if (active) setProjects(response.projects); })
      .catch(requestError => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, retry, student, store.mentorProjects, user.id]);

  const createProject = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { title: form.title.trim(), description: form.description.trim(), skills: form.skills.split(',').map(skill => skill.trim()).filter(Boolean) };
      if (demo) store.addMentorProject(payload);
      else await service.createMentorProject(payload);
      setForm({ title: '', description: '', skills: '' });
      toast.success('Project brief published for student ideas.');
      if (!demo) setRetry(value => value + 1);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const toggleProject = async project => {
    setSaving(true);
    setError('');
    const status = project.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    try {
      if (demo) store.updateMentorProjectStatus(project.id, status);
      else {
        await service.updateMentorProject(project.id, status);
        setProjects(current => current.map(item => item.id === project.id ? { ...item, status } : item));
      }
      toast.success(status === 'OPEN' ? 'Project ideas are open again.' : 'Project brief closed to new ideas.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const submitIdea = async (event, project) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const payload = { title: values.get('title').toString().trim(), summary: values.get('summary').toString().trim(), projectUrl: values.get('projectUrl').toString().trim() };
    setSaving(true);
    setError('');
    try {
      let submission;
      if (demo) {
        if (project.mySubmission) store.resubmitMentorProjectIdea(project.mySubmission.id, payload);
        else store.submitMentorProjectIdea(project.id, payload);
        submission = store.mentorProjects.find(item => item.id === project.id).submissions.find(idea => idea.studentId === user.id);
      } else if (project.mySubmission) {
        ({ submission } = await service.resubmitProjectIdea(project.mySubmission.id, payload));
      } else {
        ({ submission } = await service.submitProjectIdea(project.id, payload));
      }
      setProjects(current => current.map(item => item.id === project.id ? { ...item, mySubmission: submission } : item));
      toast.success('Your project idea has been submitted.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const reviewIdea = async (event, project, submission) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const payload = { status: values.get('status').toString(), mentorFeedback: values.get('mentorFeedback').toString().trim() };
    setSaving(true);
    setError('');
    try {
      if (demo) store.reviewMentorProjectIdea(submission.id, payload);
      else await service.reviewProjectIdea(submission.id, payload);
      setProjects(current => current.map(item => item.id === project.id ? {
        ...item,
        submissions: item.submissions.map(idea => idea.id === submission.id ? { ...idea, ...payload } : idea),
      } : item));
      toast.success('Your feedback was saved.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Heading title={student ? 'Project ideas' : 'Projects & student ideas'} subtitle={student ? 'Explore mentor-led project briefs and submit an idea to get started.' : 'Publish project opportunities and give students useful, actionable feedback.'}/>
    {error && <Panel><p role="alert">{error}</p><ActionButton variant="secondary" onClick={() => setRetry(value => value + 1)}>Retry</ActionButton></Panel>}
    {loading && <Panel><p>Loading project opportunities...</p></Panel>}
    {!student && <Panel style={{ marginBottom: 14 }}>
      <h2><Lightbulb size={17}/> Publish a project brief</h2>
      <form onSubmit={createProject}>
        <Field label="Project title"><Input required minLength={3} maxLength={120} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="What should students build?"/></Field>
        <Field label="Problem, goals, and context"><textarea className="textarea" required minLength={20} maxLength={4000} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Describe the need, constraints, and what a good outcome looks like."/></Field>
        <Field label="Useful skills (comma separated)"><Input value={form.skills} onChange={event => setForm(current => ({ ...current, skills: event.target.value }))} placeholder="Research, React, data visualization"/></Field>
        <ActionButton disabled={saving}>{saving ? 'Publishing...' : <><Plus size={14}/> Publish project</>}</ActionButton>
      </form>
    </Panel>}
    {!loading && <div className="grid grid-2">
      {projects.map(project => <Panel key={project.id}>
        <div className="row between"><span className={`badge ${project.status === 'OPEN' ? 'badge-green' : 'badge-amber'}`}>{project.status}</span>{student ? <span className="muted">{project.mentor?.name || 'Mentor-led project'}</span> : <span className="muted">{project.submissions?.length ?? project.submissionCount ?? 0} ideas</span>}</div>
        <h2 style={{ marginTop: 12 }}>{project.title}</h2>
        <p>{project.description}</p>
        {!!project.skills?.length && <p><b>Skills:</b> {project.skills.join(' · ')}</p>}
        {student && project.mySubmission && <div className="list-item"><b>Your idea · {project.mySubmission.status.replaceAll('_', ' ')}</b>{project.mySubmission.mentorFeedback && <p>Mentor feedback: {project.mySubmission.mentorFeedback}</p>}</div>}
        {student && (!project.mySubmission || project.mySubmission.status === 'NEEDS_REVISION') && project.status === 'OPEN' && <form onSubmit={event => submitIdea(event, project)}>
          <Field label="Idea title"><Input name="title" required minLength={3} maxLength={120} defaultValue={project.mySubmission?.title || ''} placeholder="A short name for your idea"/></Field>
          <Field label="How would you approach it?"><textarea className="textarea" name="summary" required minLength={20} maxLength={3000} defaultValue={project.mySubmission?.summary || ''} placeholder="Explain the problem, your idea, and how you would validate it."/></Field>
          <Field label="Prototype or portfolio link (optional)"><Input name="projectUrl" type="url" maxLength={1000} defaultValue={project.mySubmission?.projectUrl || ''} placeholder="https://..."/></Field>
          <ActionButton disabled={saving}>{saving ? 'Submitting...' : project.mySubmission ? 'Resubmit revised idea' : 'Submit your idea'}</ActionButton>
        </form>}
        {!student && <div className="row between" style={{ marginTop: 12 }}><span className="muted">{project.submissions?.filter(submission => submission.status === 'PENDING').length || 0} waiting for review</span><ActionButton variant="secondary" disabled={saving} onClick={() => toggleProject(project)}>{project.status === 'OPEN' ? 'Close submissions' : 'Reopen submissions'}</ActionButton></div>}
        {!student && project.submissions?.map(submission => <div className="list-item" key={submission.id}>
          <div className="row between"><b>{submission.title}</b><span className="badge">{submission.status.replaceAll('_', ' ')}</span></div>
          <p>By {submission.student?.name || submission.student?.id || 'Student'} · {dateLabel(submission.createdAt)}</p>
          {submission.student?.profile?.skills?.length > 0 && <p>Skills: {submission.student.profile.skills.map(item => item.skill?.name || item.name).join(' · ')}</p>}
          <p>{submission.summary}</p>
          {submission.projectUrl && <a className="accent" href={submission.projectUrl} target="_blank" rel="noreferrer">View prototype</a>}
          <form onSubmit={event => reviewIdea(event, project, submission)}>
            <div className="grid grid-2">
              <Field label="Decision"><select className="select" name="status" defaultValue={submission.status === 'PENDING' ? 'ACCEPTED' : submission.status}><option value="ACCEPTED">Accept</option><option value="NEEDS_REVISION">Request revision</option><option value="DECLINED">Decline</option></select></Field>
              <Field label="Feedback"><Input name="mentorFeedback" maxLength={2000} defaultValue={submission.mentorFeedback || ''} placeholder="A useful next step for the student"/></Field>
            </div>
            <ActionButton disabled={saving}><Check size={14}/> Save review</ActionButton>
          </form>
        </div>)}
      </Panel>)}
      {!projects.length && <Panel className="empty">{student ? 'No open project briefs yet. Check back soon.' : 'No project briefs yet. Publish one above and invite students to share ideas.'}</Panel>}
    </div>}
  </>;
}

export function MentorLeaderboard() {
  const store = useStore();
  const user = currentUser(store);
  const demo = isDemo(user);
  const [students, setStudents] = useState(() => demo ? demoLeaderboard(store) : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score');

  useEffect(() => {
    if (demo) {
      setStudents(demoLeaderboard(store));
      setLoading(false);
      setError('');
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    service.getMentorLeaderboard()
      .then(response => { if (active) setStudents(response.leaderboard); })
      .catch(requestError => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, retry, store.users, store.activities, user.id]);

  const visibleStudents = useMemo(() => students
    .filter(student => `${student.name} ${(student.skills || []).join(' ')}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .slice()
    .sort((left, right) => sortBy === 'activity'
      ? right.activityMinutes - left.activityMinutes || right.score - left.score
      : right.score - left.score || left.name.localeCompare(right.name)), [search, sortBy, students]);

  return <>
    <Heading title="Student leaderboard" subtitle="Compare recent learning performance using SkillMesh Builder Score. Scores combine skills, evidence, consistency, GitHub activity, profile quality, and quiz results."/>
    <Panel>
      <div className="grid grid-2">
        <div className="field"><label className="label" htmlFor="student-search"><Search size={14}/> Search students or skills</label><Input id="student-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name or skill"/></div>
        <div className="field"><label className="label" htmlFor="student-sort">Rank by</label><select className="select" id="student-sort" value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="score">Builder Score</option><option value="activity">Learning activity</option></select></div>
      </div>
      {error && <div><p role="alert">Could not load student performance: {error}</p><ActionButton variant="secondary" onClick={() => setRetry(value => value + 1)}>Retry</ActionButton></div>}
      {loading && <p>Loading student performance...</p>}
      {!loading && !error && visibleStudents.map((student, index) => <div className="list-item row between mentor-leaderboard-row" key={student.id}>
        <div className="row"><span className="badge badge-purple">#{index + 1}</span><div className="avatar">{student.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div><b>{student.name}</b><p>{(student.skills || []).join(' · ') || 'Add skills to show areas of strength'}</p></div></div>
        <div className="row"><span className="muted">{Math.round((student.activityMinutes || 0) / 60 * 10) / 10}h recent learning</span><span className="badge badge-green">{student.score} · {student.tier}</span></div>
      </div>)}
      {!loading && !error && !visibleStudents.length && <div className="empty">No students match that search.</div>}
    </Panel>
  </>;
}

export function StudentMentorSessions() {
  return <MentorSessions student/>;
}

export function StudentProjectIdeas() {
  return <MentorProjects student/>;
}
