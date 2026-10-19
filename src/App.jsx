import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, Link, NavLink, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowRight, BarChart3, Bell, BookOpen, CalendarDays, Check, ChevronRight, CircleUserRound, ClipboardList, Code2, Download, ExternalLink, Eye, EyeOff, FileText, Github, Goal, GraduationCap, LayoutDashboard, Lightbulb, LogOut, Menu, Moon, Network, Paperclip, Plus, Rocket, Search, Settings as SettingsIcon, ShieldCheck, Sparkles, Sun, Target, Users, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useStore, currentUser, scoreFor } from './store/useStore';
import { analyzeFeedback } from './lib/feedbackThemes';
import { createGoalPracticeQuiz, generateGoalPracticePlan, goalProgressBaseline, goalProgressFromTasks, gradeGoalPracticeQuiz } from './lib/goalPlanning';
import { planTasks } from './lib/planner';
import { builderScore } from './lib/builderScore';
import { service } from "./services/api";

const Icon = ({ name, size = 16 }) => { const C = { LayoutDashboard, CircleUserRound, Goal, Activity, CalendarDays, Sparkles, Target, Users, ClipboardList, Rocket, Bell, SettingsIcon, GraduationCap, BookOpen, Network, BarChart3, Code2, ShieldCheck, Lightbulb, Search, Menu, Moon, Sun, LogOut, Github, ExternalLink, Plus, ArrowRight, Check, ChevronRight }[name] || Sparkles; return <C size={size} strokeWidth={1.8} />; };
const initials = n => n?.split(' ').map(x => x[0]).join('').slice(0, 2);
function Button({ children, variant = 'primary', className = '', ...p }) { return <button className={`btn btn-${variant} ${className}`.trim()} {...p}>{children}</button>; }
function Card({ children, className = '' }) { return <div className={`card ${className}`}>{children}</div>; }
function PageHeader({ title, subtitle, action }) { return <div className="page-title"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="row">{action}</div>}</div>; }
function Badge({ children, tone = '' }) { return <span className={`badge ${tone ? `badge-${tone}` : ''}`}>{children}</span>; }
function ScoreBadge({ user }) { const s = scoreFor(user); return <Badge tone={s.tier === 'Pro' ? 'purple' : s.tier === 'Contributor' ? 'green' : 'amber'}>{s.total} · {s.tier}</Badge>; }
function StatCard({ label, value, detail, icon }) { return <Card><div className="row between"><span className="stat-label">{label}</span><span className="accent"><Icon name={icon} /></span></div><div className="stat-value">{value}</div><div className="muted">{detail}</div></Card>; }
function Field({ label, children }) { return <div className="field"><label className="label">{label}</label>{children}</div>; }
const FieldInput = p => <input className="input" {...p} />;

const studentNav = [['Dashboard','/dashboard','LayoutDashboard'],['Profile','/profile','CircleUserRound'],['Goals','/goals','Goal'],['Activity Log','/activities','Activity'],['Deadlines','/deadlines','CalendarDays'],['AI Action Plan','/planner','Sparkles'],['Challenges','/challenges','Target'],['Find Teammates','/challenges','Users'],['Invitations','/invitations','Users'],['My Hackathons','/hackathons','Trophy'],['Projects','/projects','ClipboardList'],['Startup','/startups/s1','Rocket'],['Notifications','/notifications','Bell'],['Settings','/settings','SettingsIcon']];
const organizerNav = [['Dashboard','/organizer','LayoutDashboard'],['Challenges','/organizer/challenges','Target'],['Create Challenge','/organizer/challenges/new','Plus'],['Participants','/organizer/participants','Users'],['Teams','/organizer/teams','Network'],['Adaptive Formation','/organizer/teamforge','Sparkles'],['Approved Teams','/organizer/approved','ShieldCheck'],['Notifications','/notifications','Bell'],['Settings','/settings','SettingsIcon']];
const mentorNav = [['Dashboard','/mentor','LayoutDashboard'],['Projects & Startups','/projects','Rocket'],['Notifications','/notifications','Bell'],['Settings','/settings','SettingsIcon']];
const invitationsUpdatedEvent = 'skillmesh:invitations-updated';

function publishPendingInvitationCount(invitations) {
  const pendingCount = invitations.filter(invitation => invitation.status === 'PENDING').length;
  window.dispatchEvent(new CustomEvent(invitationsUpdatedEvent, { detail: { pendingCount } }));
}

function isOrganizerNavActive(destination, pathname) {
  if (destination === '/organizer') return pathname === destination;
  if (destination === '/organizer/challenges') return pathname === destination;
  if (destination === '/organizer/challenges/new') {
    return pathname === destination || /^\/organizer\/challenges\/[^/]+\/edit$/.test(pathname);
  }
  if (destination === '/organizer/participants') {
    return pathname === destination || /^\/organizer\/challenges\/[^/]+\/participants$/.test(pathname);
  }
  if (destination === '/organizer/teams') {
    return pathname === destination || /^\/organizer\/challenges\/[^/]+\/teams$/.test(pathname);
  }
  if (destination === '/organizer/teamforge') {
    return pathname === destination || /^\/organizer\/challenges\/[^/]+\/teamforge$/.test(pathname);
  }
  if (destination === '/organizer/approved') {
    return pathname === destination || /^\/organizer\/challenges\/[^/]+\/approved$/.test(pathname);
  }
  return pathname === destination;
}

function Shell({ children }) {
  const s = useStore(), user = currentUser(s), location = useLocation(), navigate = useNavigate();
  const nav = user?.role === 'organizer' ? organizerNav : user?.role === 'mentor' ? mentorNav : studentNav;
  const [searchQuery, setSearchQuery] = useState('');
  const [remotePendingInvitationCount, setRemotePendingInvitationCount] = useState(null);
  const isDemoStudent = user?.role === 'student' && user.email?.endsWith('@skillmesh.demo');
  const pageTitle = location.pathname === '/'
    ? 'Home'
    : location.pathname.split('/').filter(Boolean).map(part =>
      part.replace(/(^|-)\w/g, character => character.toUpperCase()).replace(/-/g, ' ')
    ).join(' / ');
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    const pages = nav
      .filter(([, path], index, entries) => entries.findIndex(([, candidate]) => candidate === path) === index)
      .map(([title, path]) => ({ title, detail: 'Page', path, key: `page-${path}` }));
    const records = [];
    if (user?.role === 'student') {
      records.push(
        ...s.goals.filter(goal => goal.userId === user.id)
          .map(goal => ({ title: goal.title, detail: 'Goal', path: '/goals', key: `goal-${goal.id}` })),
        ...s.deadlines.filter(deadline => deadline.userId === user.id)
          .map(deadline => ({ title: deadline.title, detail: 'Deadline', path: '/deadlines', key: `deadline-${deadline.id}` })),
        ...s.challenges.map(challenge => ({
          title: challenge.title,
          detail: challenge.description,
          path: `/challenges/${challenge.id}`,
          key: `challenge-${challenge.id}`,
        })),
        ...s.projects.filter(project => project.members?.includes(user.id))
          .map(project => ({ title: project.name, detail: 'Project', path: `/projects/${project.id}`, key: `project-${project.id}` })),
        ...user.skills.map(skill => ({ title: skill.name, detail: 'Profile skill', path: '/profile', key: `skill-${skill.name}` })),
      );
    } else if (user?.role === 'mentor') {
      records.push(...s.projects.map(project => ({
        title: project.name,
        detail: 'Project',
        path: `/projects/${project.id}`,
        key: `project-${project.id}`,
      })));
    }
    return [...records, ...pages]
      .filter(result => `${result.title} ${result.detail}`.toLocaleLowerCase().includes(query))
      .slice(0, 8);
  }, [nav, searchQuery, s.challenges, s.deadlines, s.goals, s.projects, user]);
  const unreadNotificationCount = s.notifications.filter(notification =>
    notification.userId === user?.id && !notification.read
  ).length;
  const pendingInvitationCount = isDemoStudent
    ? s.invitations.filter(invitation => invitation.receiverId === user.id && invitation.status === 'Pending').length
    : remotePendingInvitationCount || 0;
  const showNotificationBadge = s.preferences?.showNotificationBadge !== false;
  useEffect(() => {
    if (user?.role !== 'student' || isDemoStudent) {
      setRemotePendingInvitationCount(null);
      return undefined;
    }

    let active = true;
    let requestVersion = 0;
    const refreshPendingInvitations = async () => {
      const version = ++requestVersion;
      try {
        const response = await service.getInvitations();
        if (active && version === requestVersion) {
          setRemotePendingInvitationCount(
            response.received.filter(invitation => invitation.status === 'PENDING').length
          );
        }
      } catch (requestError) {
        if (active && version === requestVersion) {
          console.error(
            'Pending invitation count refresh failed:',
            requestError.response?.data?.error?.message || requestError.message
          );
        }
      }
    };

    refreshPendingInvitations();
    const timer = window.setInterval(refreshPendingInvitations, 30_000);
    const handleInvitationUpdate = event => {
      if (Number.isInteger(event.detail?.pendingCount)) {
        requestVersion += 1;
        setRemotePendingInvitationCount(event.detail.pendingCount);
      } else {
        refreshPendingInvitations();
      }
    };
    window.addEventListener('focus', refreshPendingInvitations);
    window.addEventListener(invitationsUpdatedEvent, handleInvitationUpdate);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshPendingInvitations);
      window.removeEventListener(invitationsUpdatedEvent, handleInvitationUpdate);
    };
  }, [user?.id, user?.role, isDemoStudent]);
  useEffect(() => { document.documentElement.classList.toggle('dark', s.theme === 'dark'); }, [s.theme]);
  if (!user) return <Navigate to="/login" replace />;
  return <div className="app"><div className="shell"><aside className="sidebar"><Link className="brand" to="/dashboard"><span className="brand-mark">S</span><span>SkillMesh</span></Link><div className="nav-label">{user.role} workspace</div><nav>{nav.map(([label, to, icon]) => <NavLink key={to} end className={({ isActive }) => `nav-link ${(user.role === 'organizer' ? isOrganizerNavActive(to, location.pathname) : isActive) ? 'active' : ''}`} to={to}><Icon name={icon}/><span>{label}</span>{label === 'Invitations' && pendingInvitationCount > 0 && <Badge tone="red">{pendingInvitationCount}</Badge>}</NavLink>)}</nav><div style={{marginTop:'auto'}}><button className="nav-link" onClick={() => {s.logout();navigate('/login')}}><Icon name="LogOut"/><span>Log out</span></button></div></aside><main className="main"><header className="topbar"><div className="row"><Menu className="accent" size={18}/><span className="muted">{pageTitle}</span></div><div className="row"><div style={{ position: 'relative' }}><div className="row" style={{background:'#f5f5f4',borderRadius:8,padding:'6px 9px'}}><Search size={14}/><input aria-label="Search" placeholder="Search workspace" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setSearchQuery(''); if (event.key === 'Enter' && searchResults[0]) { navigate(searchResults[0].path); setSearchQuery(''); } }} style={{border:0,outline:0,background:'transparent',width:150,fontSize:12}}/></div>{searchQuery.trim() && <div role="listbox" aria-label="Search results" style={{ position: 'absolute', zIndex: 20, top: '100%', right: 0, marginTop: 6, width: 280, maxHeight: 320, overflowY: 'auto', background: 'var(--card, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: 6 }}>{searchResults.length ? searchResults.map(result => <button type="button" role="option" aria-selected="false" key={result.key} onClick={() => { navigate(result.path); setSearchQuery(''); }} style={{ display: 'block', width: '100%', border: 0, borderRadius: 6, padding: '8px 10px', textAlign: 'left', background: 'transparent', cursor: 'pointer' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{result.title}</span><span className="muted" style={{ fontSize: 11 }}>{result.detail}</span></button>) : <p className="muted" style={{ margin: 0, padding: '8px 10px', fontSize: 12 }}>No matching pages or saved items.</p>}</div>}</div><button className="btn btn-secondary" aria-label="Toggle theme" onClick={s.toggleTheme}>{s.theme === 'light' ? <Moon size={15}/> : <Sun size={15}/>}</button><Link to="/notifications" className="nav-link" style={{padding:7}} aria-label={`Notifications${showNotificationBadge && unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}><Bell size={17}/>{showNotificationBadge && unreadNotificationCount > 0 && <Badge tone="red">{unreadNotificationCount}</Badge>}</Link><div className="row"><div className="avatar">{initials(user.name)}</div><span className="muted">{user.name.split(' ')[0]}</span></div></div></header><div className="content">{children}</div></main></div></div>;
}

function Landing() { return <div className="login-wrap" style={{display:'block'}}><div className="content"><div className="brand"><span className="brand-mark">S</span> SkillMesh</div><section className="hero"><Badge tone="purple">Student growth, team formation, delivery</Badge><h1>Turn your learning momentum into <span className="accent">real outcomes.</span></h1><p>SkillMesh connects the signals that matter — practice, projects, people, and experiments — so every next step is clear and human-approved.</p><div className="row"><Link className="btn btn-primary" to="/login">Explore the demo <ArrowRight size={15}/></Link><Link className="btn btn-secondary" to="/register">Create account</Link></div></section><div className="grid grid-3"><Card><Sparkles className="accent"/><h2 style={{marginTop:12}}>StudentOS AI</h2><p>See your Builder Score as a transparent signal, then turn goals and deadlines into practical actions.</p></Card><Card><Users className="accent"/><h2 style={{marginTop:12}}>TeamForge</h2><p>Find complementary teammates with explainable recommendations and hard human approval gates.</p></Card><Card><Rocket className="accent"/><h2 style={{marginTop:12}}>VentureTrack</h2><p>Move from project evidence to customer conversations, experiments, and traction without losing context.</p></Card></div><Card className="grid grid-3" style={{marginTop:14, textAlign:'center'}}>{['Learn','Join challenge','Form team','Deliver project','Validate idea','Update records'].map((x,i)=><div key={x}><div className="avatar" style={{margin:'0 auto 8px'}}>{i+1}</div><b style={{fontSize:12}}>{x}</b></div>)}</Card></div></div> }

function Auth({ register = false }) {
  const s = useStore();
  const setAuthenticatedUser = useStore(state => state.setAuthenticatedUser);
  const nav = useNavigate();
  const googleButtonRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'student' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!googleClientId) return undefined;
    let active = true;
    const renderGoogleButton = () => {
      if (!active || !window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async response => {
          if (!response.credential) {
            setAuthError('Google did not return a sign-in credential. Please try again.');
            return;
          }
          setGoogleLoading(true);
          setAuthError('');
          try {
            const result = await service.googleLogin(response.credential);
            setAuthenticatedUser(result.user);
            toast.success(result.message);
            nav('/dashboard');
          } catch (error) {
            setAuthError(error.response?.data?.message || 'Google sign-in failed. Please try again.');
          } finally {
            setGoogleLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: register ? 'signup_with' : 'signin_with',
        width: Math.max(280, Math.floor(googleButtonRef.current.getBoundingClientRect().width)),
        logo_alignment: 'left',
      });
    };
    const existingScript = document.querySelector('script[data-skillmesh-google]');
    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else if (existingScript) {
      existingScript.addEventListener('load', renderGoogleButton);
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.skillmeshGoogle = 'true';
      script.addEventListener('load', renderGoogleButton);
      script.addEventListener('error', () => setAuthError('Google sign-in could not load. Check your connection or use email instead.'));
      document.head.appendChild(script);
    }
    return () => {
      active = false;
      existingScript?.removeEventListener('load', renderGoogleButton);
    };
  }, [googleClientId, nav, register, setAuthenticatedUser]);

  const finishSignIn = (response) => {
    setAuthenticatedUser(response.user);
    toast.success(response.message);
    nav('/dashboard');
  };

  const submit = async event => {
    event.preventDefault();
    setAuthError('');
    if (register && form.password !== form.confirmPassword) {
      setAuthError('Your passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const response = register
        ? await service.register({ name: form.name, email: form.email, password: form.password, role: form.role })
        : await service.login({ email: form.email, password: form.password });
      finishSignIn(response);
    } catch (error) {
      setAuthError(error.response?.data?.message || 'Unable to connect to SkillMesh. Check that the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap auth-wrap">
      <div className="auth-layout">
        <section className="auth-story">
          <Link className="brand auth-brand" to="/"><span className="brand-mark">S</span><span>SkillMesh</span></Link>
          <div className="auth-story-copy">
            <span className="auth-eyebrow">LEARN · BUILD · GROW</span>
            <h1>{register ? 'Build a learning habit that takes you somewhere.' : 'Your next big thing starts with one sign in.'}</h1>
            <p>Keep your goals, focused practice, team projects, and momentum together in one workspace.</p>
            <div className="auth-story-points">
              <span><Check size={15}/> Turn goals into real progress</span>
              <span><Check size={15}/> Find your people and build together</span>
              <span><Check size={15}/> See the work you have put in</span>
            </div>
          </div>
          <span className="auth-story-foot">A clearer path from learning to doing.</span>
        </section>
        <Card className="login-card auth-card">
          <Link className="brand auth-mobile-brand" to="/"><span className="brand-mark">S</span><span>SkillMesh</span></Link>
          <span className="auth-eyebrow">{register ? 'GET STARTED' : 'WELCOME BACK'}</span>
          <h2 className="auth-heading">{register ? 'Create your account' : 'Sign in to SkillMesh'}</h2>
          <p className="auth-description">{register ? 'Create an account and start moving your goals forward.' : 'Pick up where you left off.'}</p>
          {googleClientId && <div className="auth-google-button" ref={googleButtonRef} aria-label={register ? 'Sign up with Google' : 'Sign in with Google'}/>}
          {googleLoading && <p className="muted" role="status">Signing in with Google...</p>}
          {googleClientId && <div className="auth-divider"><span>or continue with email</span></div>}
          <form onSubmit={submit}>
            {register && <Field label="Full name"><FieldInput className="input auth-input" aria-label="Full name" required autoComplete="name" maxLength={120} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Your name"/></Field>}
            <Field label="Email address"><FieldInput className="input auth-input" aria-label="Email address" required type="email" autoComplete="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} placeholder="you@example.com"/></Field>
            <Field label="Password"><div className="auth-password-wrap"><FieldInput className="input auth-input" aria-label="Password" required minLength={6} autoComplete={register ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} placeholder={register ? 'At least 6 characters' : 'Enter your password'}/><button className="auth-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></Field>
            {register && <>
              <Field label="Confirm password"><div className="auth-password-wrap"><FieldInput className="input auth-input" aria-label="Confirm password" required minLength={6} autoComplete="new-password" type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={event => setForm(current => ({ ...current, confirmPassword: event.target.value }))} placeholder="Enter your password again"/><button className="auth-password-toggle" type="button" aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} onClick={() => setShowConfirmPassword(value => !value)}>{showConfirmPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></Field>
              <Field label="I am joining as"><select className="select auth-input" aria-label="I am joining as" value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value }))}><option value="student">Student</option><option value="organizer">Organizer</option><option value="mentor">Mentor</option></select></Field>
            </>}
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            <Button type="submit" disabled={loading || googleLoading} className="auth-submit">{loading ? 'Please wait...' : register ? 'Create account' : 'Sign in'}</Button>
          </form>
          {!register && <div className="auth-demo"><span className="auth-divider"><span>Just exploring?</span></span><p>Use a demo workspace without creating an account.</p><div className="grid grid-3"><Button type="button" variant="secondary" onClick={() => { s.login('aisha'); nav('/dashboard'); }}>Student demo</Button><Button type="button" variant="secondary" onClick={() => { s.login('organizer'); nav('/organizer'); }}>Organizer</Button><Button type="button" variant="secondary" onClick={() => { s.login('mentor'); nav('/mentor'); }}>Mentor</Button></div></div>}
          <p className="auth-switch">{register ? 'Already have an account?' : 'New to SkillMesh?'} <Link className="accent" to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
          <p className="auth-security">Your account is protected with secure authentication.</p>
        </Card>
      </div>
    </div>
  );
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" width="19" height="19"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.65 5.94c4.46-4.12 7.12-10.2 7.12-17.59Z" transform="translate(0 0)"/><path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 4)"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.86l-7.65-5.94c-2.13 1.43-4.87 2.27-8.25 2.27-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -4)"/></svg>;
}
function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

function Dashboard() {
  const s = useStore();
  const u = currentUser(s);
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [activityType, setActivityType] = useState('practice');
  const [activityMinutes, setActivityMinutes] = useState(30);
  const [activityNotes, setActivityNotes] = useState('');
  const [activityError, setActivityError] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [reloadRemoteData, setReloadRemoteData] = useState(0);
  const [remoteData, setRemoteData] = useState({
    tasks: [],
    joinedChallenges: [],
    pendingInvitations: 0,
    planLoaded: false,
    challengesLoaded: false,
    invitationsLoaded: false,
    planError: '',
    challengesError: '',
    invitationsError: '',
    planLoading: true,
    challengesLoading: true,
    invitationsLoading: true,
  });

  useEffect(() => {
    if (u.role !== 'student' || u.email?.endsWith('@skillmesh.demo')) {
      setRemoteData(data => ({
        ...data,
        tasks: [],
        joinedChallenges: [],
        pendingInvitations: 0,
        planLoaded: false,
        challengesLoaded: false,
        invitationsLoaded: false,
        planError: '',
        challengesError: '',
        invitationsError: '',
        planLoading: false,
        challengesLoading: false,
        invitationsLoading: false,
      }));
      return undefined;
    }

    let active = true;
    setRemoteData(data => ({
      ...data,
      planError: '',
      challengesError: '',
      invitationsError: '',
      planLoading: true,
      challengesLoading: true,
      invitationsLoading: true,
    }));

    Promise.allSettled([
      service.getPracticePlan(),
      service.getPublishedChallenges(),
      service.getInvitations(),
    ]).then(([planResult, challengesResult, invitationsResult]) => {
      if (!active) return;
      setRemoteData(data => ({
        ...data,
        tasks: planResult.status === 'fulfilled' ? planResult.value.tasks : [],
        planLoaded: planResult.status === 'fulfilled',
        planError: planResult.status === 'rejected'
          ? planResult.reason.response?.data?.error?.message || 'Could not load your practice plan.'
          : '',
        planLoading: false,
        joinedChallenges: challengesResult.status === 'fulfilled'
          ? challengesResult.value.challenges.filter(challenge => challenge.joined)
          : [],
        challengesLoaded: challengesResult.status === 'fulfilled',
        challengesError: challengesResult.status === 'rejected'
          ? challengesResult.reason.response?.data?.error?.message || 'Could not load your hackathons.'
          : '',
        challengesLoading: false,
        pendingInvitations: invitationsResult.status === 'fulfilled'
          ? invitationsResult.value.received.filter(invitation => invitation.status === 'PENDING').length
          : 0,
        invitationsLoaded: invitationsResult.status === 'fulfilled',
        invitationsError: invitationsResult.status === 'rejected'
          ? invitationsResult.reason.response?.data?.error?.message || 'Could not load your invitations.'
          : '',
        invitationsLoading: false,
      }));
    });

    return () => {
      active = false;
    };
  }, [u.id, u.role, reloadRemoteData]);

  const goals = s.goals.filter(goal => goal.userId === u.id);
  const activeGoals = goals.filter(goal =>
    !['completed', 'complete', 'done'].includes(String(goal.status || '').toLowerCase())
    && Number(goal.progress || 0) < 100
  );
  const activities = s.activities
    .filter(activity => activity.userId === u.id)
    .sort((left, right) => parseLocalDate(right.date).getTime() - parseLocalDate(left.date).getTime());
  const recentActivityCutoff = new Date();
  recentActivityCutoff.setHours(0, 0, 0, 0);
  recentActivityCutoff.setDate(recentActivityCutoff.getDate() - 29);
  const recentActivityDays = new Set(activities
    .filter(activity => activity.type !== 'Platform login')
    .filter(activity => parseLocalDate(activity.date) >= recentActivityCutoff)
    .map(activity => localDateKey(parseLocalDate(activity.date)))).size;
  const score = scoreFor({ ...u, recentActivityDays });
  const skills = u.skills || [];
  const evidenceCount = skills.filter(skill => skill.evidence).length
    + (Number(u.profileEvidenceCount) || (Array.isArray(u.evidence) ? u.evidence.length : 0));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = localDateKey(today);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(weekStart.getDate() + 7);
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(weekStart.getDate() - 7);
  const thisWeekActivities = activities.filter(activity => {
    const date = parseLocalDate(activity.date);
    return date >= weekStart && date < nextWeekStart;
  });
  const previousWeekActivities = activities.filter(activity => {
    const date = parseLocalDate(activity.date);
    return date >= previousWeekStart && date < weekStart;
  });
  const weeklyMinutes = thisWeekActivities.reduce((sum, activity) => sum + (Number(activity.duration) || 0), 0);
  const previousWeeklyMinutes = previousWeekActivities.reduce((sum, activity) => sum + (Number(activity.duration) || 0), 0);
  const weeklyHours = weeklyMinutes / 60;
  const weeklyChange = previousWeeklyMinutes
    ? `${weeklyMinutes >= previousWeeklyMinutes ? '+' : ''}${Math.round((weeklyMinutes - previousWeeklyMinutes) / previousWeeklyMinutes * 100)}% vs last week`
    : weeklyMinutes ? 'No activity last week' : 'No activity logged this week';
  const deadlinesThisWeek = s.deadlines.filter(deadline => {
    if (deadline.userId !== u.id || deadline.status === 'Completed') return false;
    const date = parseLocalDate(deadline.date);
    return date >= today && date < nextWeekStart;
  });
  const highPriorityDeadlines = deadlinesThisWeek.filter(deadline =>
    String(deadline.importance || deadline.priority || '').toLowerCase() === 'high'
  ).length;
  const activityChart = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const key = localDateKey(date);
    const minutes = thisWeekActivities
      .filter(activity => localDateKey(parseLocalDate(activity.date)) === key)
      .reduce((sum, activity) => sum + (Number(activity.duration) || 0), 0);
    return { d: date.toLocaleDateString(undefined, { weekday: 'short' }), h: Math.round(minutes / 6) / 10 };
  });
  const todaysTasks = remoteData.tasks.filter(task =>
    task.scheduledFor && localDateKey(new Date(task.scheduledFor)) === todayKey
  );
  const localPriorities = planTasks([
    ...activeGoals.map(goal => {
      const dueDate = goal.targetDate ? parseLocalDate(goal.targetDate) : null;
      const daysUntilDue = dueDate ? Math.ceil((dueDate - today) / 86400000) : 7;
      return {
        id: `goal-${goal.id}`,
        title: goal.title,
        objective: `Continue this goal${dueDate ? ` · due ${dueDate.toLocaleDateString()}` : ''}.`,
        reason: 'Prioritized from your active goals.',
        duration: 45,
        importance: String(goal.priority).toLowerCase() === 'high' ? 90 : 65,
        urgency: Math.max(20, 100 - Math.max(0, daysUntilDue) * 8),
        effort: 40,
      };
    }),
    ...deadlinesThisWeek.map(deadline => {
      const dueDate = parseLocalDate(deadline.date);
      const daysUntilDue = Math.ceil((dueDate - today) / 86400000);
      return {
        id: `deadline-${deadline.id}`,
        title: deadline.title,
        objective: `${deadline.importance || 'Normal'} priority deadline · due ${dueDate.toLocaleDateString()}.`,
        reason: 'Prioritized from your upcoming deadlines.',
        duration: Math.min(90, Math.max(30, Number(deadline.effort) * 15 || 45)),
        importance: String(deadline.importance || '').toLowerCase() === 'high' ? 90 : 65,
        urgency: Math.max(20, 100 - Math.max(0, daysUntilDue) * 8),
        effort: Number(deadline.effort) || 40,
      };
    }),
  ], 3);
  const displayedPlanTasks = remoteData.planLoaded
    ? todaysTasks
    : localPriorities.map(task => ({ ...task, skillName: 'Local priority', status: 'Local' }));
  const joinedChallenges = u.role === 'student' && remoteData.challengesLoaded
    ? remoteData.joinedChallenges
    : s.challenges.filter(challenge => challenge.participants.includes(u.id));
  const pendingInvitations = u.role === 'student' && remoteData.invitationsLoaded
    ? remoteData.pendingInvitations
    : s.invitations.filter(invitation => invitation.receiverId === u.id && invitation.status === 'Pending').length;
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const formatHours = hours => `${Number(hours.toFixed(1))}h`;

  const logProgress = async event => {
    event.preventDefault();
    const minutes = Number(activityMinutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      setActivityError('Enter a duration between 1 and 1440 minutes.');
      return;
    }

    setSavingActivity(true);
    setActivityError('');
    try {
      s.addActivity({
        type: activityType,
        duration: minutes,
        date: todayKey,
        notes: activityNotes.trim() || `${activityType} session`,
      });
      setActivityNotes('');
      setShowProgressForm(false);
      toast.success('Progress logged and dashboard updated.');
    } catch (error) {
      setActivityError(error.message || 'Could not log progress. Try again.');
    } finally {
      setSavingActivity(false);
    }
  };

  return <>
    <PageHeader
      title={`${greeting}, ${u.name.split(' ')[0]}`}
      subtitle="Your growth graph is moving. Here’s the clearest next step."
      action={<Button onClick={() => { setActivityError(''); setShowProgressForm(open => !open); }}><Plus size={14}/> Log progress</Button>}
    />
    {showProgressForm && <Card style={{ marginBottom: 14 }}>
      <div className="row between"><h2>Log learning progress</h2><Button type="button" variant="secondary" onClick={() => setShowProgressForm(false)}>Cancel</Button></div>
      <form onSubmit={logProgress}>
        <div className="grid grid-3">
          <Field label="Activity type"><select className="select" value={activityType} onChange={event => setActivityType(event.target.value)}><option value="practice">Practice</option><option value="coding">Coding</option><option value="course">Course</option><option value="project">Project</option></select></Field>
          <Field label="Duration (minutes)"><FieldInput type="number" min="1" max="1440" value={activityMinutes} onChange={event => setActivityMinutes(event.target.value)}/></Field>
          <Field label="What did you work on?"><FieldInput value={activityNotes} onChange={event => setActivityNotes(event.target.value)} placeholder="Add a short note"/></Field>
        </div>
        {activityError && <p role="alert">{activityError}</p>}
        <Button disabled={savingActivity}>{savingActivity ? 'Saving...' : 'Save progress'}</Button>
      </form>
    </Card>}
    <div className="grid grid-4">
      <StatCard label="Active goals" value={activeGoals.length} detail={`${goals.length - activeGoals.length} completed`} icon="Goal"/>
      <StatCard label="Tasks due this week" value={deadlinesThisWeek.length} detail={`${highPriorityDeadlines} high priority`} icon="ClipboardList"/>
      <StatCard label="Weekly study hours" value={formatHours(weeklyHours)} detail={weeklyChange} icon="Activity"/>
      <StatCard label="Skills count" value={skills.length} detail={`${evidenceCount} with evidence`} icon="Sparkles"/>
    </div>
    <div className="grid grid-2" style={{ marginTop: 14 }}>
      <Card>
        <div className="row between"><div><h2>Builder Score</h2><p>A transparent signal, not a judgment of worth.</p></div><ScoreBadge user={{ ...u, recentActivityDays }}/></div>
        <div style={{ height: 210 }}><ResponsiveContainer><RadarChart data={score.components.map(component => ({ name: component.label.split(' ')[0], value: component.value }))}><PolarGrid/><PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }}/><PolarRadiusAxis domain={[0, 100]} tick={false}/><Radar dataKey="value" stroke="#6d4aff" fill="#6d4aff" fillOpacity=".28"/></RadarChart></ResponsiveContainer></div>
        <div className="grid grid-2">{score.components.map(component => <div key={component.key}><div className="row between"><span className="muted">{component.label}</span><span className="muted">{component.notLinked ? 'Not linked' : `${component.value}/100`}</span></div><div className="progress"><span style={{ width: `${component.value}%` }}/></div></div>)}</div>
        <p style={{ marginTop: 12 }}><b>How to improve:</b> {score.tips[0] || 'Keep shipping evidence and reflecting weekly.'}</p>
      </Card>
      <Card>
        <div className="row between"><h2>Weekly activity</h2><Badge tone={weeklyHours ? 'green' : 'amber'}>{formatHours(weeklyHours)} logged</Badge></div>
        <div style={{ height: 210 }}><ResponsiveContainer><BarChart data={activityChart}><CartesianGrid vertical={false} stroke="#eee"/><XAxis dataKey="d" tick={{ fontSize: 10 }}/><YAxis tick={{ fontSize: 10 }} unit="h"/><Tooltip formatter={value => [`${value}h`, 'Study time']}/><Bar dataKey="h" name="Hours" fill="#8b76ff" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div>
        <div className="list">{activities.slice(0, 3).map(activity => <div className="list-item row between" key={activity.id}><div><b style={{ fontSize: 12 }}>{activity.type}</b><p>{activity.notes}</p></div><span className="muted">{activity.duration}m · {parseLocalDate(activity.date).toLocaleDateString()}</span></div>)}
          {!activities.length && <p className="muted">Log a learning session to start tracking your weekly activity.</p>}
        </div>
        <Link className="accent muted" to="/activities">View activity log</Link>
      </Card>
    </div>
    <div className="grid grid-2" style={{ marginTop: 14 }}>
      <Card>
        <div className="row between"><h2>Today’s plan</h2><Link className="accent muted" to="/planner">View plan</Link></div>
        {remoteData.planLoading && <p className="muted">Loading your scheduled practice...</p>}
        {!remoteData.planLoading && remoteData.planError && <div><p role="alert">Could not load the saved practice plan: {remoteData.planError} Showing local priorities from your goals and deadlines.</p><Button type="button" variant="secondary" onClick={() => setReloadRemoteData(value => value + 1)}>Retry</Button></div>}
        {!remoteData.planLoading && !remoteData.planLoaded && displayedPlanTasks.map(task => <div className="list-item row between" key={task.id}><div><b style={{ fontSize: 13 }}>{task.title}</b><p>{task.objective}</p><span className="muted">{task.reason}</span></div><Badge tone="purple">{task.duration}m · Local</Badge></div>)}
        {!remoteData.planLoading && remoteData.planLoaded && displayedPlanTasks.map(task => <div className="list-item row between" key={task.id}><div><b style={{ fontSize: 13 }}>{task.title}</b><p>{task.skillName} · {task.objective}</p><span className="muted">{new Date(task.scheduledFor).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{task.status ? ` · ${task.status.toLowerCase()}` : ''}</span></div><Badge tone="purple">{task.duration}m</Badge></div>)}
        {!remoteData.planLoading && !displayedPlanTasks.length && <p className="muted">No practice sessions or local priorities for today. <Link className="accent" to="/goals">Add a goal</Link> or <Link className="accent" to="/planner">open your plan</Link>.</p>}
      </Card>
      <Card>
        <div className="row between"><h2>My hackathons</h2><Link className="accent muted" to="/challenges">Browse</Link></div>
        {remoteData.challengesLoading && <p className="muted">Loading your joined challenges...</p>}
        {!remoteData.challengesLoading && remoteData.challengesError && <div><p role="alert">Could not load live hackathons: {remoteData.challengesError} Showing your saved local challenges.</p><Button type="button" variant="secondary" onClick={() => setReloadRemoteData(value => value + 1)}>Retry</Button></div>}
        {!remoteData.challengesLoading && joinedChallenges.map(challenge => <div className="list-item" key={challenge.id}><div className="row between"><b style={{ fontSize: 13 }}>{challenge.title}</b><Badge tone="green">Joined</Badge></div><p>{challenge.requiredSkills.map(skill => typeof skill === 'string' ? skill : skill.name).join(' · ')} · deadline {parseLocalDate(challenge.deadline).toLocaleDateString()}</p></div>)}
        {!remoteData.challengesLoading && !joinedChallenges.length && <p className="muted">You have not joined a challenge yet. <Link className="accent" to="/challenges">Browse challenges</Link> to find one.</p>}
        {remoteData.invitationsLoading && <p className="muted">Checking invitations...</p>}
        {!remoteData.invitationsLoading && remoteData.invitationsError && <p role="alert">Could not load live invitations: {remoteData.invitationsError} Showing locally saved invitations. <Link className="accent" to="/invitations">View invitations</Link></p>}
        {!remoteData.invitationsLoading && pendingInvitations > 0 && <p className="accent"><Bell size={13}/> <Link className="accent" to="/invitations">{pendingInvitations} pending invitation{pendingInvitations === 1 ? '' : 's'}</Link></p>}
      </Card>
    </div>
  </>;
}

function LegacyProfile({ viewId }) {
  const s = useStore(), u = s.users.find(x => x.id === viewId) || currentUser(s), own = u.id === s.currentUserId, score = scoreFor(u);
  const [edit, setEdit] = useState({ education: u.education || '', careerGoal: u.careerGoal || '', interests: u.interests || [], preferredRoles: u.preferredRoles || [u.preferredRole].filter(Boolean) });
  const [interest, setInterest] = useState(''), [skillName, setSkillName] = useState(''), [skillLevel, setSkillLevel] = useState('Intermediate'), [skillEvidence, setSkillEvidence] = useState(''), [confirmRemove, setConfirmRemove] = useState(null), [link, setLink] = useState(u.github?.username || ''), [linkError, setLinkError] = useState(''), [refreshing, setRefreshing] = useState(false);
  const roles = ['Frontend','Backend','Product','Design','ML Engineer','DevOps','Mobile'];
  const dictionary = ['React','Node.js','TypeScript','Python','UI/UX','Testing','Databases','APIs','Machine Learning','Data Analysis','Cloud','DevOps','Product','Research','React Native'];
  const save = () => { s.updateProfile(edit); toast.success('Profile saved and Builder Score recomputed'); };
  const addInterest = () => { const value = interest.trim(); if (value && !edit.interests.includes(value)) setEdit({ ...edit, interests: [...edit.interests, value] }); setInterest(''); };
  const addSkill = () => { if (!skillName.trim()) return; s.upsertSkill({ name: skillName.trim(), level: skillLevel, evidence: skillEvidence.trim() }); setSkillName(''); setSkillEvidence(''); toast.success('Skill saved and Builder Score recomputed'); };
  
  
const syncGitHub = async (username) => {
  setRefreshing(true);

  try {
    // Fetch profile and repositories from your backend.
   
const [profileResponse, repoResponse, commitsResponse] =
  await Promise.all([
    service.getGitHubProfile(username),
    service.getGitHubRepositories(username),
    service.getGitHubCommits(username),
  ]);


    // Your backend r eturns { profile: {...} }.
    const profile = profileResponse?.profile;

    // Your backend returns { username, count, repositories: [...] }.
    const repositories = Array.isArray(repoResponse?.repositories)
      ? repoResponse.repositories
      : [];

    if (!profile || !Array.isArray(repoResponse?.repositories)) {
      throw new Error("Unexpected GitHub API response format.");
    }

    // Backend repository objects use "stars", not "stargazers_count".
    const stars = repositories.reduce(
      (total, repo) => total + (Number(repo.stars) || 0),
      0
    );

    // Collect unique programming languages.
    const topLanguages = [
      ...new Set(
        repositories
          .map((repo) => repo.language)
          .filter(Boolean)
      ),
    ];

    // Your backend uses "username", not "login".
    const githubUsername = profile.username || username;

    // Save the actual profile and repository statistics.
    s.saveLinks({
      github: {
        username: githubUsername,
        repos: Number(profile.publicRepositories) || Number(repoResponse.count) || repositories.length,
        commits: Number(commitsResponse?.commits) || 0,
        stars,
        languages: topLanguages.length,
        topLanguages,
        activity: [],
        lastSynced: new Date().toLocaleString(),
        source: "GitHub API",
        verified: true,
        avatarUrl: profile.avatarUrl || "",
        bio: profile.bio || "",
        followers: Number(profile.followers) || 0,
        following: Number(profile.following) || 0,
        publicProfileUrl:
          profile.profileUrl ||
          `https://github.com/${githubUsername}`,
      },
    });

    setLink(githubUsername);
    setLinkError("");

    toast.success("GitHub profile and repository statistics synced!");
  } catch (error) {
    console.error("GitHub sync error:", error);

    toast.error(
      error.response?.data?.message ||
      error.message ||
      "Unable to fetch GitHub data. Check your username and backend."
    );
  } finally {
    setRefreshing(false);
  }
};


  const saveGitHub = async () => {
    const value = link.trim();
    let username = value;

    // Accept a username or a GitHub profile URL.
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        const hostname = url.hostname.toLowerCase();
        const parts = url.pathname.split("/").filter(Boolean);

        if (
          !["github.com", "www.github.com"].includes(hostname) ||
          parts.length !== 1
        ) {
          setLinkError(
            "Enter a GitHub username or a profile URL like https://github.com/octocat."
          );
          return;
        }

        username = parts[0];
      } catch {
        setLinkError("Enter a valid GitHub username or profile URL.");
        return;
      }
    }

    if (
      username.length > 39 ||
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(username) ||
      username.includes("--")
    ) {
      setLinkError("Enter a valid GitHub username.");
      return;
    }

    await syncGitHub(username);
  };

  const refresh = async () => {
    if (!u.github?.username) {
      toast.error("Link your GitHub account first.");
      return;
    }

    await syncGitHub(u.github.username);
  };
 return <><PageHeader title={own ? 'My profile' : u.name} subtitle="Make your strengths legible with evidence and context." action={own && <Button onClick={save}><Check size={14}/> Save changes</Button>}/><div className="grid grid-2"><Card><h2>About</h2>{own ? <><div className="grid grid-2"><Field label="Education"><FieldInput value={edit.education} onChange={e=>setEdit({...edit,education:e.target.value})}/></Field><Field label="Career goal"><FieldInput value={edit.careerGoal} onChange={e=>setEdit({...edit,careerGoal:e.target.value})}/></Field></div><Field label="Interests"><div className="row"><FieldInput value={interest} onChange={e=>setInterest(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addInterest())} placeholder="Add an interest"/><Button variant="secondary" onClick={addInterest}><Plus size={14}/></Button></div><div className="row" style={{flexWrap:'wrap',marginTop:7}}>{edit.interests.map(x=><button className="badge badge-purple" key={x} onClick={()=>setEdit({...edit,interests:edit.interests.filter(i=>i!==x)})}>{x} <X size={11}/></button>)}</div></Field><Field label="Preferred roles"><div className="row" style={{flexWrap:'wrap'}}>{roles.map(role=><label className="badge" key={role}><input type="checkbox" checked={edit.preferredRoles.includes(role)} onChange={e=>setEdit({...edit,preferredRoles:e.target.checked?[...edit.preferredRoles,role]:edit.preferredRoles.filter(x=>x!==role)})}/>{role}</label>)}</div></Field></> : <p>{u.education} � {u.careerGoal}</p>}<h2 style={{marginTop:18}}>Skills manager</h2>{own&&<><div className="grid grid-2"><Field label="Search dictionary or enter free text"><FieldInput list="skill-dictionary" value={skillName} onChange={e=>setSkillName(e.target.value)} placeholder="e.g. React"/><datalist id="skill-dictionary">{dictionary.map(x=><option key={x} value={x}/>)}</datalist></Field><Field label="Proficiency"><select className="select" value={skillLevel} onChange={e=>setSkillLevel(e.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></Field></div><div className="row"><FieldInput value={skillEvidence} onChange={e=>setSkillEvidence(e.target.value)} placeholder="Optional evidence URL"/><Button onClick={addSkill}><Plus size={14}/> Add skill</Button></div></>}{(u.skills||[]).map(x=><div className="list-item row between" key={x.name}><div><b style={{fontSize:13}}>{x.name}</b><p>{x.level}{x.evidence?` � ${x.evidence}`:''}</p></div><div className="row">{x.evidence&&<Badge tone="green"><ShieldCheck size={12}/> Verified</Badge>}{own&&<Button variant="danger" onClick={()=>setConfirmRemove(x.name)}>Remove</Button>}</div></div>)}{confirmRemove&&<div className="row" style={{marginTop:10}}><span style={{fontSize:12}}>Remove {confirmRemove}?</span><Button variant="danger" onClick={()=>{s.removeSkill(confirmRemove);setConfirmRemove(null);toast.success('Skill removed; score updated')}}>Confirm</Button><Button variant="secondary" onClick={()=>setConfirmRemove(null)}>Cancel</Button></div>}</Card><Card><div className="row between"><div><h2>Builder Score</h2><p>A transparent signal, not a judgment of worth; never the only factor.</p></div><ScoreBadge user={u}/></div><div className="list" style={{marginTop:14}}>{score.components.map(c=><div key={c.key}><div className="row between"><span className="muted">{c.label} � {Math.round(c.weight*100)}%</span><span className="muted">{c.notLinked?'Not linked':`${c.value}/100`}</span></div><div className="progress"><span style={{width:`${c.value}%`}}/></div></div>)}</div><details style={{marginTop:14}}><summary className="muted">How Builder Score works (v4)</summary><p>Quiz performance 25%, GitHub activity 15%, skill strength 25%, evidence 15%, consistency 10%, profile completeness 10%. Completed quizzes are averaged over 90 days; no attempts start at a neutral 50. Each component is scored 0-100, weighted, summed, and rounded.</p><p>Tiers: Starter 0-39, Builder 40-64, Contributor 65-84, Pro 85-100.</p></details><h3 style={{marginTop:16}}>How to improve</h3>{score.tips.slice(0,3).map(t=><p key={t}>� {t}</p>)}</Card></div><div className="grid grid-2" style={{marginTop:14}}><Card><div className="row between"><div className="row"><div className="avatar"><Github size={16}/></div><div><h2 style={{margin:0}}>GitHub</h2>{u.github&&<a className="accent" href={`https://github.com/${u.github.username}`} target="_blank" rel="noreferrer">@{u.github.username} <ExternalLink size={11}/></a>}</div></div><Badge tone={u.github?'green':'amber'}>{u.github?(u.github.verified?'Verified':'Unverified'):'Not linked'}</Badge></div>{u.github?<><div className="grid grid-3" style={{margin:'16px 0'}}><div><span className="muted">Repos</span><div className="stat-value">{u.github.repos}</div></div><div><span className="muted">Stars</span><div className="stat-value">{u.github.stars}</div></div><div><span className="muted">Commits</span><div className="stat-value">{u.github.commits}</div></div></div><div style={{height:70}}><ResponsiveContainer><LineChart data={(u.github.activity||[]).map((value,i)=>({i,value}))}><Line type="monotone" dataKey="value" stroke="#6d4aff" strokeWidth={3} dot={false}/><Tooltip/></LineChart></ResponsiveContainer></div><div className="row" style={{flexWrap:'wrap'}}>{(u.github.topLanguages||[]).map(x=><Badge tone="purple" key={x}>{x}</Badge>)}</div><div className="row between" style={{marginTop:16}}><span className="muted">Last synced: {u.github.lastSynced||'Not yet'}</span><div className="row"><Button variant="secondary" onClick={refresh} disabled={refreshing}>{refreshing?'Refreshing�':'Refresh'}</Button><Button variant="secondary" onClick={()=>setLink(u.github.username)}>Edit</Button><Button variant="danger" onClick={()=>{s.saveLinks({github:null});toast.success('GitHub unlinked')}}>Unlink</Button></div></div></>:<><p>Link GitHub to enrich your score with real activity.</p><Field label="Username or profile URL"><FieldInput value={link} onChange={e=>{setLink(e.target.value);setLinkError('')}} placeholder="github.com/username"/></Field>{linkError&&<p style={{color:'#b91c1c'}}>{linkError}</p>}<Button onClick={saveGitHub}>Link GitHub</Button></>}</Card><Card><h2>Profile evidence</h2><p>Project evidence, activity consistency, and profile completeness contribute to the score. Keep your profile current and attach evidence links to skills.</p><div className="row" style={{flexWrap:'wrap',marginTop:12}}>{(u.interests||[]).map(x=><Badge tone="purple" key={x}>{x}</Badge>)}</div></Card></div><Card style={{marginTop:14}}><h2>Weekly availability</h2><div className="grid grid-4">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div className="row" key={d}><span style={{width:28,fontSize:11}}>{d}</span>{['AM','PM','Eve'].map(t=><Badge key={t} tone={d==='Tue'||t==='Eve'?'purple':''}>{t}</Badge>)}</div>)}</div></Card></>;
}
function Profile({ viewId }) {
  const store = useStore();
  const user = store.users.find(item => item.id === viewId) || currentUser(store);
  if (!user || user.id !== store.currentUserId) return <LegacyProfile viewId={viewId}/>;
  return <OwnProfile key={user.id} user={user}/>;
}

function OwnProfile({ user }) {
  const updateStoreProfile = useStore(state => state.updateProfile);
  const [profile, setProfile] = useState(null), [edit, setEdit] = useState(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [interest, setInterest] = useState(''), [skillName, setSkillName] = useState(''), [skillLevel, setSkillLevel] = useState('Intermediate'), [skillEvidence, setSkillEvidence] = useState('');
  const [evidenceTitle, setEvidenceTitle] = useState(''), [evidenceUrl, setEvidenceUrl] = useState(''), [activityMinutes, setActivityMinutes] = useState(30), [githubUsername, setGithubUsername] = useState(user.github?.username || ''), [githubError, setGithubError] = useState(''), [githubLoading, setGithubLoading] = useState(false);
  const roles = ['Frontend','Backend','Product','Design','ML Engineer','DevOps','Mobile'];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const slots = [{ id:'AM', label:'Morning' },{ id:'PM', label:'Afternoon' },{ id:'EVENING', label:'Evening' }];
  const refreshProfile = async () => {
    const response = await service.getProfile();
    const next = response.profile;
    setProfile(next);
    setEdit({ education: next.education, careerGoal: next.careerGoal, interests: next.interests, preferredRoles: next.preferredRoles });
    setGithubUsername(next.github?.username || '');
    updateStoreProfile({ ...response.user, ...next, profileEvidenceCount: next.evidence.length });
  };
  useEffect(() => {
    let active = true;
    service.getProfile().then(response => {
      if (!active) return;
      setProfile(response.profile);
      setEdit({ education: response.profile.education, careerGoal: response.profile.careerGoal, interests: response.profile.interests, preferredRoles: response.profile.preferredRoles });
      setGithubUsername(response.profile.github?.username || '');
      updateStoreProfile({ ...response.user, ...response.profile, profileEvidenceCount: response.profile.evidence.length });
    }).catch(requestError => {
      if (active) setError(requestError.response?.data?.error?.message || 'Could not load your profile.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id]);
  const saveAbout = async () => {
    setSaving(true); setError('');
    try { await service.updateProfileAbout(edit); await refreshProfile(); toast.success('About section saved.'); }
    catch (requestError) { setError(requestError.response?.data?.error?.message || 'Could not save your profile.'); }
    finally { setSaving(false); }
  };
  const toggleAvailability = async (dayOfWeek, slot) => {
    const key = `${dayOfWeek}:${slot}`;
    const current = profile.availability;
    const slotsNext = current.some(item => `${item.dayOfWeek}:${item.slot}` === key)
      ? current.filter(item => `${item.dayOfWeek}:${item.slot}` !== key)
      : [...current, { dayOfWeek, slot }];
    setProfile({ ...profile, availability: slotsNext });
    try {
      const response = await service.saveProfileAvailability(slotsNext);
      setProfile(response.profile);
      updateStoreProfile({ ...response.user, ...response.profile, profileEvidenceCount: response.profile.evidence.length });
    } catch (requestError) {
      setProfile({ ...profile, availability: current });
      toast.error(requestError.response?.data?.error?.message || 'Could not save availability.');
    }
  };
  const addSkill = async () => {
    if (!skillName.trim()) return;
    try {
      const response = await service.saveProfileSkill({ name: skillName.trim(), level: skillLevel, evidence: skillEvidence.trim() });
      setProfile(response.profile); updateStoreProfile({ ...response.user, ...response.profile, profileEvidenceCount: response.profile.evidence.length });
      setSkillName(''); setSkillEvidence(''); toast.success('Skill saved and Builder Score updated.');
    } catch (requestError) { toast.error(requestError.response?.data?.error?.message || 'Could not save skill.'); }
  };
  const removeSkill = async (skill) => {
    try {
      const response = await service.deleteProfileSkill(skill.id);
      setProfile(response.profile); updateStoreProfile({ ...response.user, ...response.profile, profileEvidenceCount: response.profile.evidence.length });
      toast.success('Skill removed and Builder Score updated.');
    } catch (requestError) { toast.error(requestError.response?.data?.error?.message || 'Could not remove skill.'); }
  };
  const addEvidence = async (event) => {
    event.preventDefault();
    try {
      const response = await service.addProfileEvidence({ title: evidenceTitle, url: evidenceUrl, kind: 'PROJECT' });
      setProfile(response.profile); updateStoreProfile({ ...response.user, ...response.profile, profileEvidenceCount: response.profile.evidence.length });
      setEvidenceTitle(''); setEvidenceUrl(''); toast.success('Evidence saved and Builder Score updated.');
    } catch (requestError) { toast.error(requestError.response?.data?.error?.message || 'Could not save evidence.'); }
  };
  const removeEvidence = async (evidenceId) => {
    try {
      const response = await service.deleteProfileEvidence(evidenceId);
      setProfile(response.profile); updateStoreProfile({ ...response.user, ...response.profile, profileEvidenceCount: response.profile.evidence.length });
      toast.success('Evidence removed.');
    } catch (requestError) { toast.error(requestError.response?.data?.error?.message || 'Could not remove evidence.'); }
  };
  const logActivity = async () => {
    try {
      const response = await service.logProfileActivity({ category: 'Learning session', minutes: Number(activityMinutes) });
      setProfile(response.profile); updateStoreProfile({ ...response.user, ...response.profile, profileEvidenceCount: response.profile.evidence.length });
      toast.success('Learning activity logged and Builder Score updated.');
    } catch (requestError) { toast.error(requestError.response?.data?.error?.message || 'Could not log activity.'); }
  };
  const syncGitHub = async (username) => {
    setGithubLoading(true); setGithubError('');
    try {
      const [profileResponse, repoResponse, commitsResponse] = await Promise.all([
        service.getGitHubProfile(username), service.getGitHubRepositories(username), service.getGitHubCommits(username),
      ]);
      const githubProfile = profileResponse.profile;
      const repositories = repoResponse.repositories;
      const topLanguages = [...new Set(repositories.map(repo => repo.language).filter(Boolean))];
      const github = {
        username: githubProfile.username || username,
        repos: Number(githubProfile.publicRepositories) || Number(repoResponse.count) || repositories.length,
        commits: Number(commitsResponse.commits) || 0,
        stars: repositories.reduce((total, repo) => total + (Number(repo.stars) || 0), 0),
        languages: topLanguages.length,
        topLanguages,
        activity: [],
        lastSynced: new Date().toLocaleString(),
        source: 'GitHub API',
        verified: true,
        avatarUrl: githubProfile.avatarUrl || '',
        bio: githubProfile.bio || '',
        followers: Number(githubProfile.followers) || 0,
        following: Number(githubProfile.following) || 0,
        publicProfileUrl: githubProfile.profileUrl || `https://github.com/${username}`,
      };
      const response = await service.saveGitHubStats(github);
      setProfile(response.profile); updateStoreProfile({ ...response.user, ...response.profile, profileEvidenceCount: response.profile.evidence.length });
      setGithubUsername(github.username); toast.success('GitHub profile and repository stats synced.');
    } catch (requestError) {
      setGithubError(requestError.response?.data?.message || requestError.response?.data?.error?.message || requestError.message || 'Could not sync GitHub profile.');
    } finally { setGithubLoading(false); }
  };
  const score = profile ? builderScore({
    ...profile,
    profileEvidenceCount: profile.evidence.length,
    availabilitySlots: profile.availability.length,
    recentActivityDays: profile.stats.recentActivityDays,
  }) : null;
  if (loading) return <Card><p>Loading your saved profile...</p></Card>;
  if (error && !profile) return <Card><p>{error}</p><Button variant="secondary" onClick={refreshProfile}>Retry</Button></Card>;
  return <><PageHeader title="My profile" subtitle="Edit your profile, availability, evidence, and the real signals behind your Builder Score." action={<Button onClick={saveAbout} disabled={saving || !edit}>{saving?'Saving...':<><Check size={14}/> Save about</>}</Button>}/>{error&&<Card style={{marginBottom:14}}><p role="alert">{error}</p></Card>}<div className="grid grid-2"><Card><h2>About</h2><div className="grid grid-2"><Field label="Education"><FieldInput value={edit?.education||''} onChange={event=>setEdit({...edit,education:event.target.value})} placeholder="Degree or education"/></Field><Field label="Career goal"><FieldInput value={edit?.careerGoal||''} onChange={event=>setEdit({...edit,careerGoal:event.target.value})} placeholder="What do you want to build?"/></Field></div><Field label="Interests"><div className="row"><FieldInput value={interest} onChange={event=>setInterest(event.target.value)} onKeyDown={event=>event.key==='Enter'&&(event.preventDefault(),edit.interests.includes(interest.trim())?setInterest(''):setEdit({...edit,interests:[...edit.interests,interest.trim()]}))} placeholder="Add an interest"/><Button type="button" variant="secondary" onClick={()=>{const value=interest.trim();if(value&&!edit.interests.includes(value))setEdit({...edit,interests:[...edit.interests,value]});setInterest('')}}><Plus size={14}/></Button></div><div className="row" style={{flexWrap:'wrap',marginTop:7}}>{edit?.interests.map(value=><button type="button" className="badge badge-purple" key={value} onClick={()=>setEdit({...edit,interests:edit.interests.filter(item=>item!==value)})}>{value} <X size={11}/></button>)}</div></Field><Field label="Preferred roles"><div className="row" style={{flexWrap:'wrap'}}>{roles.map(role=><label className="badge" key={role}><input type="checkbox" checked={edit?.preferredRoles.includes(role)||false} onChange={event=>setEdit({...edit,preferredRoles:event.target.checked?[...edit.preferredRoles,role]:edit.preferredRoles.filter(item=>item!==role)})}/>{role}</label>)}</div></Field><h2 style={{marginTop:18}}>Skills manager</h2><div className="grid grid-2"><Field label="Skill"><FieldInput value={skillName} onChange={event=>setSkillName(event.target.value)} placeholder="e.g. React"/></Field><Field label="Proficiency"><select className="select" value={skillLevel} onChange={event=>setSkillLevel(event.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></Field></div><Field label="Evidence URL (optional)"><FieldInput value={skillEvidence} onChange={event=>setSkillEvidence(event.target.value)} placeholder="https://..."/></Field><Button onClick={addSkill}><Plus size={14}/> Save skill</Button>{profile.skills.map(skill=><div className="list-item row between" key={skill.id}><div><b>{skill.name}</b><p>{skill.level}{skill.evidence?` · ${skill.evidence}`:''}</p></div><Button variant="danger" onClick={()=>removeSkill(skill)}>Remove</Button></div>)}</Card><Card><div className="row between"><div><h2>Builder Score</h2><p>Evidence-based profile signal, not a judgment of ability.</p></div><Badge tone={score.total>=85?'purple':score.total>=65?'green':'amber'}>{score.total} · {score.tier}</Badge></div><div className="list" style={{marginTop:14}}>{score.components.map(component=><div key={component.key}><div className="row between"><span className="muted">{component.label} · {Math.round(component.weight*100)}%</span><span className="muted">{component.noAttempts ? `No quiz attempts (neutral ${component.value}/100)` : `${component.value}/100`}</span></div><div className="progress"><span style={{width:`${component.value}%`}}/></div></div>)}</div><details style={{marginTop:14}} open><summary className="muted">How this score is calculated (v4)</summary><p><b>Builder Score</b> = 25% quiz performance + 15% GitHub activity + 25% skill strength + 15% evidence + 10% consistency + 10% profile completeness. The 90-day average of completed quiz scores is used; with no quiz attempts, that component starts at a neutral 50. Each component is scored 0-100, weighted, summed, and rounded.</p><p>GitHub activity uses a capped logarithmic scale: repos + stars/12 + 2* public commits in the last 30 days, normalized to 40 repos, 500 stars, and 120 commits. Unlinked GitHub receives a neutral 50.</p><p>Skill strength averages Beginner 40, Intermediate 70, Advanced 100. Evidence is 20 points per saved evidence URL, capped at 5 links. Consistency is active logged days in the last 30 days divided by 12, capped at 100. Profile completeness gives equal credit for education, career goal, interests, preferred roles, at least one skill, and at least one availability slot.</p><p>Tiers: Starter 0-39, Builder 40-64, Contributor 65-84, Pro 85-100.</p></details><h3 style={{marginTop:16}}>Activity for consistency</h3><p>{profile.stats.recentActivityDays} active days and {profile.stats.recentActivityMinutes} logged minutes in the last 30 days.</p><div className="row"><select className="select" style={{maxWidth:150}} value={activityMinutes} onChange={event=>setActivityMinutes(event.target.value)}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={120}>2 hours</option></select><Button variant="secondary" onClick={logActivity}>Log learning session</Button></div></Card></div><div className="grid grid-2" style={{marginTop:14}}><Card><div className="row between"><div className="row"><div className="avatar"><Github size={16}/></div><div><h2 style={{margin:0}}>GitHub</h2>{profile.github&&<a className="accent" href={profile.github.publicProfileUrl} target="_blank" rel="noreferrer">@{profile.github.username} <ExternalLink size={11}/></a>}</div></div><Badge tone={profile.github?'green':'amber'}>{profile.github?'Synced':'Not linked'}</Badge></div>{profile.github?<><div className="grid grid-3" style={{margin:'16px 0'}}><div><span className="muted">Repos</span><div className="stat-value">{profile.github.repos}</div></div><div><span className="muted">Stars</span><div className="stat-value">{profile.github.stars}</div></div><div><span className="muted">Commits (30d)</span><div className="stat-value">{profile.github.commits}</div></div></div><div className="row" style={{flexWrap:'wrap'}}>{profile.github.topLanguages.map(language=><Badge tone="purple" key={language}>{language}</Badge>)}</div><div className="row between" style={{marginTop:16}}><span className="muted">Last synced: {profile.github.lastSynced}</span><Button variant="secondary" onClick={()=>syncGitHub(profile.github.username)} disabled={githubLoading}>{githubLoading?'Refreshing...':'Refresh GitHub'}</Button></div></>:<><p>Link GitHub to add live public repository, star, language, and recent-commit statistics.</p><Field label="GitHub username or profile URL"><FieldInput value={githubUsername} onChange={event=>{setGithubUsername(event.target.value);setGithubError('')}} placeholder="github.com/username"/></Field>{githubError&&<p role="alert" style={{color:'#b91c1c'}}>{githubError}</p>}<Button onClick={()=>syncGitHub(githubUsername.trim())} disabled={githubLoading||!githubUsername.trim()}>{githubLoading?'Syncing...':'Connect GitHub'}</Button></>}</Card><Card><h2>Profile evidence</h2><p>Add project, portfolio, certificate, or other links. Evidence is persisted and contributes to your score.</p><form onSubmit={addEvidence}><Field label="Title"><FieldInput value={evidenceTitle} onChange={event=>setEvidenceTitle(event.target.value)} placeholder="Project, certificate, portfolio..."/></Field><Field label="URL"><FieldInput type="url" value={evidenceUrl} onChange={event=>setEvidenceUrl(event.target.value)} placeholder="https://..."/></Field><Button disabled={!evidenceTitle.trim()||!evidenceUrl.trim()}><Plus size={14}/> Add evidence</Button></form>{profile.evidence.length===0?<p className="muted" style={{marginTop:12}}>No evidence links yet.</p>:profile.evidence.map(item=><div className="list-item row between" key={item.id}><div><a href={item.url} target="_blank" rel="noreferrer" className="accent">{item.title} <ExternalLink size={12}/></a><p>{item.kind} · {new Date(item.createdAt).toLocaleDateString()}</p></div><Button variant="danger" onClick={()=>removeEvidence(item.id)} aria-label={`Remove ${item.title}`}>Remove</Button></div>)}</Card></div><Card style={{marginTop:14}}><div className="row between"><div><h2>Weekly availability</h2><p>Select the times you’re generally available. Changes save automatically.</p></div><Badge tone="purple">{profile.availability.length} slots · about {profile.availability.length*2}h/week</Badge></div><div className="availability-grid"><div className="availability-row availability-heading"><span>Day</span>{slots.map(slot=><span key={slot.id}>{slot.label}</span>)}</div>{days.map((day,index)=><div className="availability-row" key={day}><b>{day}</b>{slots.map(slot=>{const selected=profile.availability.some(item=>item.dayOfWeek===index&&item.slot===slot.id);return <label className={`availability-toggle ${selected?'selected':''}`} key={slot.id}><input type="checkbox" checked={selected} onChange={()=>toggleAvailability(index,slot.id)} aria-label={`${day} ${slot.label}`}/><span>{selected?'Available':'—'}</span></label>})}</div>)}</div><p className="muted">Weekly schedule is used for team matching. It is not treated as proof of work or as a score by itself.</p></Card></>;
}

function Goals() {
  const store = useStore();
  const user = currentUser(store);
  const [newGoal, setNewGoal] = useState({ title: '', targetDate: '', priority: 'Medium' });
  const [newGoalError, setNewGoalError] = useState('');
  const [taskDrafts, setTaskDrafts] = useState({});
  const [progressDrafts, setProgressDrafts] = useState({});
  const [expandedGoals, setExpandedGoals] = useState({});
  const [activeGoalQuiz, setActiveGoalQuiz] = useState(null);
  const [goalQuizAnswers, setGoalQuizAnswers] = useState([]);
  const goals = store.goals.filter(goal => goal.userId === user.id);
  const today = new Date();
  const todayKey = localDateKey(today);

  const createGoal = event => {
    event.preventDefault();
    const title = newGoal.title.trim();
    if (!title) {
      setNewGoalError('Add a title for your goal.');
      return;
    }
    if (newGoal.targetDate && parseLocalDate(newGoal.targetDate) < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      setNewGoalError('The target date cannot be in the past.');
      return;
    }
    store.addGoal({
      title,
      targetDate: newGoal.targetDate,
      priority: newGoal.priority,
      status: 'In progress',
      progress: 0,
      progressBaseline: 0,
      progressHistory: [{ progress: 0, note: 'Goal created', date: new Date().toISOString() }],
      tasks: [],
    });
    setNewGoal({ title: '', targetDate: '', priority: 'Medium' });
    setNewGoalError('');
    toast.success('Goal created.');
  };

  const updateGoalProgress = (goal, nextProgress, note) => {
    const progress = Math.max(0, Math.min(100, Math.round(Number(nextProgress))));
    const previousProgress = Number(goal.progress) || 0;
    if (progress === previousProgress) return;
    const progressHistory = [...(goal.progressHistory || []), {
      progress,
      note,
      date: new Date().toISOString(),
    }];
    const tasks = goal.tasks || [];
    const baseline = goalProgressBaseline(progress, tasks);
    store.updateGoal(goal.id, {
      progress,
      progressBaseline: baseline,
      status: progress >= 100 ? 'Completed' : 'In progress',
      progressHistory,
    });
  };

  const generatePractice = goal => {
    if (goal.tasks?.length && !window.confirm('Replace this goal’s current tasks and practice plan? Progress entries will be preserved, but task checklist progress will restart.')) {
      return;
    }
    const tasks = generateGoalPracticePlan(goal);
    const savedTasks = tasks.map((task, index) => ({ ...task, id: `${goal.id}-task-${Date.now()}-${index}` }));
    const baseline = Number(goal.progress) || 0;
    store.updateGoal(goal.id, {
      tasks: savedTasks,
      progressBaseline: baseline,
      progress: baseline,
      status: baseline >= 100 ? 'Completed' : 'In progress',
      progressHistory: [...(goal.progressHistory || []), {
        progress: baseline,
        note: 'Generated a goal-based practice plan',
        date: new Date().toISOString(),
      }],
    });
    setExpandedGoals(current => ({ ...current, [goal.id]: true }));
    setActiveGoalQuiz({ goalId: goal.id, taskId: savedTasks[0].id });
    setGoalQuizAnswers(Array(savedTasks[0].quiz.length).fill(''));
    toast.success('Goal practice plan and interactive quizzes created.');
  };

  const startGoalQuiz = (goal, task) => {
    const quiz = task.quiz || createGoalPracticeQuiz(goal.title, task.title, task.kind);
    if (!task.quiz) {
      store.updateGoal(goal.id, {
        tasks: (goal.tasks || []).map(item => item.id === task.id ? { ...item, quiz } : item),
      });
    }
    setActiveGoalQuiz({ goalId: goal.id, taskId: task.id });
    setGoalQuizAnswers(Array(quiz.length).fill(''));
  };

  const submitGoalQuiz = (event, goal, task) => {
    event.preventDefault();
    const quiz = task.quiz || createGoalPracticeQuiz(goal.title, task.title, task.kind);
    if (goalQuizAnswers.length !== quiz.length || goalQuizAnswers.some(answer => answer === '')) {
      toast.error(`Answer all ${quiz.length} questions before submitting.`);
      return;
    }
    const result = gradeGoalPracticeQuiz(quiz, goalQuizAnswers);
    if (!result) {
      toast.error('This quiz could not be graded. Reopen it and try again.');
      return;
    }
    const tasks = (goal.tasks || []).map(item => item.id === task.id
      ? { ...item, quiz, completed: true, completedAt: new Date().toISOString(), quizScore: result.score }
      : item);
    const baseline = Math.min(100, Math.max(0, Number(goal.progressBaseline ?? goal.progress) || 0));
    const progress = goalProgressFromTasks(baseline, tasks);
    store.updateGoal(goal.id, {
      tasks,
      progress,
      status: progress >= 100 ? 'Completed' : 'In progress',
      progressHistory: [...(goal.progressHistory || []), {
        progress,
        note: `Completed practice quiz: ${task.title} (${result.score}%)`,
        date: new Date().toISOString(),
      }],
    });
    setActiveGoalQuiz(null);
    setGoalQuizAnswers([]);
    toast.success(`Practice quiz completed · ${result.score}%`);
  };

  const addGoalTask = goal => {
    const draft = taskDrafts[goal.id] || { title: '', dueDate: goal.targetDate || todayKey, minutes: '30', kind: 'milestone' };
    const title = draft.title.trim();
    if (!title || !draft.dueDate || !Number.isFinite(Number(draft.minutes)) || Number(draft.minutes) < 1 || Number(draft.minutes) > 1440) {
      toast.error('Enter a task title, due date, and a duration between 1 and 1440 minutes.');
      return;
    }
    const tasks = [...(goal.tasks || []), {
      id: `${goal.id}-task-${Date.now()}`,
      title,
      dueDate: draft.dueDate,
      minutes: Number(draft.minutes),
      kind: draft.kind,
      details: 'Added to this goal.',
      completed: false,
      createdAt: new Date().toISOString(),
      ...(draft.kind === 'practice' ? { quiz: createGoalPracticeQuiz(goal.title, title, draft.kind) } : {}),
    }];
    const baseline = Number(goal.progressBaseline ?? goal.progress) || 0;
    const progress = goalProgressFromTasks(baseline, tasks);
    store.updateGoal(goal.id, {
      tasks,
      progress,
      status: progress >= 100 ? 'Completed' : 'In progress',
      progressHistory: [...(goal.progressHistory || []), { progress, note: `Added task: ${title}`, date: new Date().toISOString() }],
    });
    setTaskDrafts(current => ({ ...current, [goal.id]: { ...draft, title: '' } }));
    setExpandedGoals(current => ({ ...current, [goal.id]: true }));
    toast.success('Task added to goal.');
  };

  const toggleGoalTask = (goal, taskId) => {
    const currentTask = (goal.tasks || []).find(task => task.id === taskId);
    if (currentTask?.quiz && !currentTask.completed) return;
    const tasks = (goal.tasks || []).map(task =>
      task.id === taskId ? {
        ...task,
        completed: !task.completed,
        completedAt: !task.completed ? new Date().toISOString() : null,
        ...(task.completed && task.quiz ? { quizScore: null } : {}),
      } : task
    );
    const baseline = Math.min(100, Math.max(0, Number(goal.progressBaseline ?? goal.progress) || 0));
    const progress = goalProgressFromTasks(baseline, tasks);
    const changedTask = tasks.find(task => task.id === taskId);
    store.updateGoal(goal.id, {
      tasks,
      progress,
      status: progress >= 100 ? 'Completed' : 'In progress',
      progressHistory: [...(goal.progressHistory || []), {
        progress,
        note: `${changedTask.completed ? 'Completed' : 'Reopened'} task: ${changedTask.title}`,
        date: new Date().toISOString(),
      }],
    });
  };

  const removeGoalTask = (goal, taskId) => {
    const tasks = (goal.tasks || []).filter(task => task.id !== taskId);
    const baseline = Math.min(100, Math.max(0, Number(goal.progressBaseline ?? goal.progress) || 0));
    const progress = goalProgressFromTasks(baseline, tasks);
    store.updateGoal(goal.id, {
      tasks,
      progress,
      status: progress >= 100 ? 'Completed' : 'In progress',
      progressHistory: [...(goal.progressHistory || []), { progress, note: 'Removed a goal task', date: new Date().toISOString() }],
    });
  };

  const updateManualProgress = goal => {
    const draft = progressDrafts[goal.id];
    if (draft === undefined || !Number.isFinite(Number(draft))) return;
    const nextProgress = Math.max(0, Math.min(100, Number(draft)));
    const baseline = goalProgressBaseline(nextProgress, goal.tasks || []);
    store.updateGoal(goal.id, {
      progress: Math.round(nextProgress),
      progressBaseline: baseline,
      status: nextProgress >= 100 ? 'Completed' : 'In progress',
      progressHistory: [...(goal.progressHistory || []), {
        progress: Math.round(nextProgress),
        note: 'Progress updated',
        date: new Date().toISOString(),
      }],
    });
    setProgressDrafts(current => ({ ...current, [goal.id]: '' }));
  };

  const deleteGoal = goal => {
    if (!window.confirm(`Delete “${goal.title}” and its goal tasks?`)) return;
    store.removeGoal(goal.id);
    toast.success('Goal deleted.');
  };

  const openTaskCount = goals.reduce((total, goal) => total + (goal.tasks || []).filter(task => !task.completed).length, 0);
  const completedGoalCount = goals.filter(goal => Number(goal.progress) >= 100).length;

  return <>
    <PageHeader title="Goals" subtitle="Turn your goals into a trackable plan with focused practice, due tasks, and a progress history."/>
    <div className="grid grid-3">
      <StatCard label="Active goals" value={goals.filter(goal => Number(goal.progress) < 100).length} detail={`${completedGoalCount} completed`} icon="Goal"/>
      <StatCard label="Open goal tasks" value={openTaskCount} detail="Across your active plans" icon="ClipboardList"/>
      <StatCard label="Overall progress" value={goals.length ? `${Math.round(goals.reduce((total, goal) => total + Number(goal.progress || 0), 0) / goals.length)}%` : '0%'} detail={`${goals.length} tracked goal${goals.length === 1 ? '' : 's'}`} icon="Activity"/>
    </div>
    <Card style={{ marginTop: 14 }}>
      <h2>Create a goal</h2>
      <form onSubmit={createGoal}>
        <div className="grid grid-4">
          <Field label="Goal"><FieldInput value={newGoal.title} onChange={event => setNewGoal(current => ({ ...current, title: event.target.value }))} placeholder="e.g. Build a portfolio project" maxLength={160}/></Field>
          <Field label="Target date"><FieldInput type="date" min={todayKey} value={newGoal.targetDate} onChange={event => setNewGoal(current => ({ ...current, targetDate: event.target.value }))}/></Field>
          <Field label="Priority"><select className="select" value={newGoal.priority} onChange={event => setNewGoal(current => ({ ...current, priority: event.target.value }))}><option>Low</option><option>Medium</option><option>High</option></select></Field>
          <div className="field"><span className="label">&nbsp;</span><Button type="submit"><Plus size={14}/> Create goal</Button></div>
        </div>
        {newGoalError && <p role="alert">{newGoalError}</p>}
      </form>
    </Card>
    {!goals.length
      ? <Card style={{ marginTop: 14 }}><h2>No goals yet</h2><p>Create a goal to generate a tailored practice plan and track progress here.</p></Card>
      : <div className="grid grid-2" style={{ marginTop: 14 }}>
        {goals.map(goal => {
          const tasks = goal.tasks || [];
          const completedTasks = tasks.filter(task => task.completed).length;
          const isExpanded = Boolean(expandedGoals[goal.id]);
          const draft = taskDrafts[goal.id] || { title: '', dueDate: goal.targetDate || todayKey, minutes: '30', kind: 'milestone' };
          const history = [...(goal.progressHistory || [])].slice(-4).reverse();
          return <Card key={goal.id}>
            <div className="row between" style={{ flexWrap: 'wrap' }}>
              <div className="row"><Badge tone={goal.priority === 'High' ? 'red' : goal.priority === 'Low' ? '' : 'purple'}>{goal.priority || 'Medium'}</Badge><Badge tone={Number(goal.progress) >= 100 ? 'green' : 'amber'}>{Number(goal.progress) >= 100 ? 'Completed' : 'In progress'}</Badge></div>
              <span className="muted">{goal.targetDate ? `Target ${parseLocalDate(goal.targetDate).toLocaleDateString()}` : 'No target date'}</span>
            </div>
            <h2 style={{ marginTop: 14 }}>{goal.title}</h2>
            <div className="row between"><span className="muted">Progress</span><b style={{ fontSize: 12 }}>{Number(goal.progress) || 0}%</b></div>
            <div className="progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(goal.progress) || 0))}%` }}/></div>
            <p className="muted">{tasks.length ? `${completedTasks} of ${tasks.length} goal tasks complete` : goal.status || 'No tasks added yet.'}</p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Button type="button" onClick={() => generatePractice(goal)}><Sparkles size={14}/>{tasks.length ? 'Regenerate practice plan' : 'Generate practice plan'}</Button>
              <Button type="button" variant="secondary" onClick={() => setExpandedGoals(current => ({ ...current, [goal.id]: !current[goal.id] }))}>{isExpanded ? 'Hide details' : 'Track goal'}</Button>
              <Button type="button" variant="danger" onClick={() => deleteGoal(goal)}>Delete goal</Button>
            </div>
            {isExpanded && <div style={{ marginTop: 14 }}>
              <div className="list-item">
                <div className="row between"><div><b>Goal progress</b><p>Update the percentage manually or complete tasks below to calculate it automatically.</p></div><span className="muted">{Number(goal.progress) || 0}%</span></div>
                <div className="row"><input aria-label={`Progress for ${goal.title}`} type="range" min="0" max="100" value={progressDrafts[goal.id] ?? goal.progress ?? 0} onChange={event => setProgressDrafts(current => ({ ...current, [goal.id]: event.target.value }))} style={{ flex: 1 }}/><Button type="button" variant="secondary" onClick={() => updateManualProgress(goal)}>Save progress</Button></div>
                {history.length > 0 && <div style={{ marginTop: 10 }}><b className="muted">Progress history</b>{history.map((entry, index) => <p className="muted" key={`${entry.date}-${index}`}>{entry.progress}% · {entry.note} · {new Date(entry.date).toLocaleDateString()}</p>)}</div>}
              </div>
              <h3 style={{ marginTop: 14 }}>Goal practice and due tasks</h3>
              {tasks.length ? tasks.map(task => <div className="list-item row between" key={task.id}>
                <div style={{ minWidth: 0, flex: 1 }}><div className="row" style={{ flexWrap: 'wrap' }}><label className="row"><input type="checkbox" checked={Boolean(task.completed)} disabled={Boolean(task.quiz && !task.completed)} onChange={() => toggleGoalTask(goal, task.id)}/><b style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</b></label><Badge tone={task.kind === 'practice' ? 'purple' : ''}>{task.kind}</Badge>{task.quizScore != null && <Badge tone="green">Quiz {task.quizScore}%</Badge>}</div><p>{task.details}</p><span className="muted">Due {parseLocalDate(task.dueDate).toLocaleDateString()} · {task.minutes} min</span>
                  {(task.quiz || task.kind === 'practice' || task.kind === 'review') && <div style={{ marginTop: 8 }}><Button type="button" variant="secondary" onClick={() => startGoalQuiz(goal, task)}>{task.completed ? 'Retake quiz' : 'Start quiz'}</Button></div>}
                  {activeGoalQuiz?.goalId === goal.id && activeGoalQuiz.taskId === task.id && <form className="list-item" style={{ marginTop: 10 }} onSubmit={event => submitGoalQuiz(event, goal, task)}>
                    <h4>Goal-focused practice quiz</h4><p className="muted">Locally generated questions based on this goal and task. Submit to record your score and complete the task.</p>
                    {(task.quiz || createGoalPracticeQuiz(goal.title, task.title, task.kind)).map((question, questionIndex) => <div key={`${task.id}-question-${questionIndex}`} style={{ marginTop: 10 }}><b>Question {questionIndex + 1}</b><p>{question.prompt}</p>{question.options.map((option, optionIndex) => <label className="list-item row" key={optionIndex}><input type="radio" name={`${task.id}-answer-${questionIndex}`} checked={goalQuizAnswers[questionIndex] === String(optionIndex)} onChange={() => setGoalQuizAnswers(current => current.map((answer, answerIndex) => answerIndex === questionIndex ? String(optionIndex) : answer))}/>{option}</label>)}</div>)}
                    <div className="row" style={{ marginTop: 10 }}><Button type="submit">Submit quiz &amp; complete task</Button><Button type="button" variant="secondary" onClick={() => setActiveGoalQuiz(null)}>Close quiz</Button></div>
                  </form>}
                </div>
                <Button type="button" variant="danger" onClick={() => removeGoalTask(goal, task.id)}>Remove</Button>
              </div>) : <p className="muted">Generate a goal-based practice plan or add your own task.</p>}
              <form onSubmit={event => { event.preventDefault(); addGoalTask(goal); }}>
                <h3 style={{ marginTop: 14 }}>Add a goal task</h3>
                <Field label="Task title"><FieldInput value={draft.title} onChange={event => setTaskDrafts(current => ({ ...current, [goal.id]: { ...draft, title: event.target.value } }))} placeholder="Next measurable step" maxLength={160}/></Field>
                <div className="grid grid-3">
                  <Field label="Due date"><FieldInput type="date" value={draft.dueDate} onChange={event => setTaskDrafts(current => ({ ...current, [goal.id]: { ...draft, dueDate: event.target.value } }))}/></Field>
                  <Field label="Duration (minutes)"><FieldInput type="number" min="1" max="1440" value={draft.minutes} onChange={event => setTaskDrafts(current => ({ ...current, [goal.id]: { ...draft, minutes: event.target.value } }))}/></Field>
                  <Field label="Task type"><select className="select" value={draft.kind} onChange={event => setTaskDrafts(current => ({ ...current, [goal.id]: { ...draft, kind: event.target.value } }))}><option value="milestone">Deadline task</option><option value="practice">Practice session</option></select></Field>
                </div>
                <Button type="submit"><Plus size={14}/> Add task to goal</Button>
              </form>
            </div>}
          </Card>;
        })}
      </div>}
  </>;
}
function Activities() {
  const s = useStore();
  const u = currentUser(s);
  const [range, setRange] = useState(7);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const demoMode = u.email?.endsWith('@skillmesh.demo');

  const loadActivities = async () => {
    setLoading(true);
    setError('');
    try {
      if (demoMode) {
        setActivities(s.activities.filter(activity => activity.userId === u.id));
        return;
      }
      const response = await service.getProfile();
      setActivities(response.profile.activity.map(activity => ({
        id: activity.id,
        type: activity.category,
        duration: activity.minutes,
        loggedAt: activity.loggedAt,
        notes: activity.category === 'Platform login'
          ? 'Signed in to SkillMesh'
          : activity.category.startsWith('Practice: ')
            ? activity.category.slice('Practice: '.length)
            : activity.category,
      })));
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load your activity history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [u.id, demoMode]);

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const rangeStart = new Date(todayStart);
  rangeStart.setDate(todayStart.getDate() - range + 1);
  const getActivityDate = activity => {
    if (activity.loggedAt) return new Date(activity.loggedAt);
    return parseLocalDate(activity.date);
  };
  const filteredActivities = activities
    .filter(activity => getActivityDate(activity) >= rangeStart && getActivityDate(activity) < new Date(todayStart.getTime() + 86400000))
    .sort((left, right) => getActivityDate(right) - getActivityDate(left));
  const learningActivities = filteredActivities.filter(activity => activity.type !== 'Platform login');
  const activeDayKeys = new Set(activities
    .filter(activity => activity.type !== 'Platform login')
    .map(activity => localDateKey(getActivityDate(activity))));
  const activeDays = [...activeDayKeys].filter(key => {
    const date = parseLocalDate(key);
    return date >= rangeStart && date <= todayStart;
  }).length;
  const totalMinutes = learningActivities.reduce((sum, activity) => sum + (Number(activity.duration) || 0), 0);
  const loginCount = filteredActivities.filter(activity => activity.type === 'Platform login').length;
  const streakStart = activeDayKeys.has(localDateKey(todayStart))
    ? todayStart
    : new Date(todayStart.getTime() - 86400000);
  let currentStreak = 0;
  for (let date = streakStart; activeDayKeys.has(localDateKey(date)); date.setDate(date.getDate() - 1)) {
    currentStreak += 1;
  }
  const dailyActivity = Array.from({ length: range }, (_, index) => {
    const date = new Date(rangeStart);
    date.setDate(rangeStart.getDate() + index);
    const dayActivities = learningActivities.filter(activity => localDateKey(getActivityDate(activity)) === localDateKey(date));
    return {
      day: date.toLocaleDateString(undefined, { weekday: range === 7 ? 'short' : undefined, month: range === 7 ? undefined : 'numeric', day: 'numeric' }),
      minutes: dayActivities.reduce((sum, activity) => sum + (Number(activity.duration) || 0), 0),
      sessions: dayActivities.length,
    };
  });
  const categoryTotals = learningActivities.reduce((totals, activity) => {
    const category = String(activity.type).split(':')[0];
    totals[category] ||= { minutes: 0, sessions: 0 };
    totals[category].minutes += Number(activity.duration) || 0;
    totals[category].sessions += 1;
    return totals;
  }, {});
  const categories = Object.entries(categoryTotals).sort((left, right) => right[1].minutes - left[1].minutes || right[1].sessions - left[1].sessions);
  const formatDuration = minutes => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

  return <>
    <PageHeader
      title="Activity log"
      subtitle="Learning activity is recorded from your sign-ins and completed practice tasks."
      action={<select className="select" aria-label="Activity date range" value={range} onChange={event => setRange(Number(event.target.value))}>
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
      </select>}
    />
    {error && <Card style={{ marginBottom: 14 }}><p role="alert">{error}</p><Button variant="secondary" onClick={loadActivities}>Retry</Button></Card>}
    {loading ? <Card><p>Loading your activity history...</p></Card> : <>
      <div className="grid grid-4">
        <StatCard label="Learning sessions" value={learningActivities.length} detail="Recorded sessions and completed tasks" icon="Activity"/>
        <StatCard label="Practice time" value={formatDuration(totalMinutes)} detail="Recorded minutes; quiz time is capped" icon="CalendarDays"/>
        <StatCard label="Active days" value={activeDays} detail={`In the last ${range} days`} icon="Goal"/>
        <StatCard label="Current streak" value={`${currentStreak} days`} detail={`${loginCount} sign-in${loginCount === 1 ? '' : 's'} in range`} icon="Sparkles"/>
      </div>
      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <Card>
          <div className="row between"><div><h2>Learning over time</h2><p>Recorded minutes and completed learning sessions per day.</p></div><Badge tone="purple">{formatDuration(totalMinutes)}</Badge></div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer>
              <ComposedChart data={dailyActivity}>
                <CartesianGrid vertical={false} stroke="#eee"/>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={range === 7 ? 0 : 4}/>
                <YAxis yAxisId="minutes" tick={{ fontSize: 10 }} allowDecimals={false} label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}/>
                <YAxis yAxisId="sessions" orientation="right" tick={{ fontSize: 10 }} allowDecimals={false}/>
                <Tooltip formatter={(value, name) => [name === 'Practice time' ? `${value} min` : value, name]}/>
                <Bar yAxisId="minutes" dataKey="minutes" name="Practice time" fill="#6d4aff" radius={[4, 4, 0, 0]}/>
                <Line yAxisId="sessions" type="monotone" dataKey="sessions" name="Completed sessions" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2>Learning by activity</h2>
          <p>Time is grouped by the activity recorded when it happened.</p>
          {categories.length ? <div className="list">{categories.map(([category, total]) => <div className="list-item" key={category}>
            <div className="row between"><b style={{ fontSize: 13 }}>{category}</b><span className="muted">{total.sessions} session{total.sessions === 1 ? '' : 's'} · {formatDuration(total.minutes)}</span></div>
            <div className="progress"><span style={{ width: `${totalMinutes ? Math.max(2, total.minutes / totalMinutes * 100) : total.sessions / learningActivities.length * 100}%` }}/></div>
          </div>)}</div> : <p className="muted">Your activity breakdown will appear after you complete a practice task.</p>}
        </Card>
      </div>
      <Card style={{ marginTop: 14 }}>
        <div className="row between"><div><h2>Recent activity</h2><p>Learning sessions, completed tasks, and sign-in history for this period.</p></div><Badge>{filteredActivities.length} events</Badge></div>
        {!filteredActivities.length ? <div className="list-item"><p className="muted">No activity recorded in this period. Sign-ins and completed practice tasks will appear here automatically.</p></div> : filteredActivities.map(activity => <div className="list-item row between" key={activity.id}>
          <div><Badge tone={activity.type === 'Platform login' ? '' : 'purple'}>{activity.type === 'Platform login' ? 'Sign in' : activity.type.startsWith('Practice: ') ? 'Practice task' : activity.type}</Badge><span style={{ marginLeft: 10, fontSize: 13 }}>{activity.notes}</span></div>
          <span className="muted">{getActivityDate(activity).toLocaleString()} · {activity.duration || 0}m</span>
        </div>)}
      </Card>
      <p className="muted" style={{ marginTop: 10 }}>For completed quizzes, practice time counts while the quiz is visible in the browser and is capped at the task’s scheduled duration. Sign-ins are recorded as events and do not add learning minutes.</p>
    </>}
  </>;
}
function Deadlines() {
  const store = useStore();
  const user = currentUser(store);
  const today = new Date();
  const todayKey = localDateKey(today);
  const [form, setForm] = useState({ title: '', date: todayKey, effort: '1', importance: 'Medium' });
  const [editingId, setEditingId] = useState('');
  const [filter, setFilter] = useState('open');
  const [formError, setFormError] = useState('');

  const deadlines = store.deadlines
    .filter(deadline => deadline.userId === user.id)
    .map(deadline => ({ ...deadline, dateValue: parseLocalDate(deadline.date) }))
    .sort((left, right) => left.dateValue - right.dateValue);
  const openDeadlines = deadlines.filter(deadline => deadline.status !== 'Completed');
  const overdueDeadlines = openDeadlines.filter(deadline => deadline.dateValue < new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const dueSoon = openDeadlines.filter(deadline =>
    deadline.dateValue >= new Date(today.getFullYear(), today.getMonth(), today.getDate())
    && deadline.dateValue < nextWeek
  );
  const dueSoonEffort = dueSoon.reduce((total, deadline) => total + (Number(deadline.effort) || 0), 0);
  const highPriority = openDeadlines.filter(deadline => deadline.importance === 'High').length;
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dayKey = localDateKey(date);
    const due = openDeadlines.filter(deadline => localDateKey(deadline.dateValue) === dayKey);
    return {
      date,
      key: dayKey,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      dayLabel: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      hours: due.reduce((total, deadline) => total + (Number(deadline.effort) || 0), 0),
      count: due.length,
    };
  });
  const maxHours = Math.max(4, ...weekDays.map(day => day.hours));
  const visibleDeadlines = deadlines.filter(deadline => {
    if (filter === 'completed') return deadline.status === 'Completed';
    if (filter === 'all') return true;
    return deadline.status !== 'Completed';
  });
  const resetForm = () => {
    setForm({ title: '', date: todayKey, effort: '1', importance: 'Medium' });
    setEditingId('');
    setFormError('');
  };
  const saveDeadline = event => {
    event.preventDefault();
    const title = form.title.trim();
    const dueDate = parseLocalDate(form.date);
    const effort = Number(form.effort);
    if (!title) {
      setFormError('Enter a title for this deadline.');
      return;
    }
    if (!form.date || Number.isNaN(dueDate.getTime())) {
      setFormError('Choose a valid due date.');
      return;
    }
    if (!Number.isFinite(effort) || effort <= 0 || effort > 1000) {
      setFormError('Estimated effort must be greater than 0 and no more than 1000 hours.');
      return;
    }
    const values = { title, date: form.date, effort, importance: form.importance };
    if (editingId) {
      store.updateDeadline(editingId, values);
      toast.success('Deadline updated.');
    } else {
      store.addDeadline({ ...values, status: 'Open' });
      toast.success('Deadline added.');
    }
    resetForm();
  };
  const editDeadline = deadline => {
    setEditingId(deadline.id);
    setForm({
      title: deadline.title,
      date: deadline.date,
      effort: String(deadline.effort),
      importance: deadline.importance || 'Medium',
    });
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const toggleComplete = deadline => {
    const status = deadline.status === 'Completed' ? 'Open' : 'Completed';
    store.updateDeadline(deadline.id, { status });
    toast.success(status === 'Completed' ? 'Deadline marked complete.' : 'Deadline reopened.');
  };
  const removeDeadline = deadline => {
    store.removeDeadline(deadline.id);
    if (editingId === deadline.id) resetForm();
    toast.success('Deadline removed.');
  };

  return <>
    <PageHeader title="Deadlines" subtitle="Plan upcoming work, understand the workload, and track what’s complete."/>
    <div className="grid grid-4">
      <StatCard label="Open deadlines" value={openDeadlines.length} detail="Across all dates" icon="CalendarDays"/>
      <StatCard label="Due this week" value={dueSoon.length} detail={`${Number(dueSoonEffort.toFixed(1))}h estimated effort`} icon="ClipboardList"/>
      <StatCard label="Overdue" value={overdueDeadlines.length} detail="Open past due dates" icon="Target"/>
      <StatCard label="High priority" value={highPriority} detail="Open deadlines" icon="Goal"/>
    </div>
    <div className="grid grid-2" style={{ marginTop: 14 }}>
      <Card>
        <div className="row between"><div><h2>Next 7 days’ workload</h2><p>Estimated effort assigned to each upcoming due date.</p></div><Badge tone="purple">{Number(weekDays.reduce((total, day) => total + day.hours, 0).toFixed(1))}h</Badge></div>
        <div className="grid grid-4" style={{ marginTop: 14 }}>
          {weekDays.map(day => {
            const intensity = day.hours === 0 ? 0 : Math.min(1, day.hours / maxHours);
            const background = intensity === 0
              ? 'var(--surface-subtle, #f5f5f4)'
              : `rgba(109, 74, 255, ${0.12 + intensity * 0.38})`;
            return <div key={day.key} style={{ padding: 13, background, borderRadius: 8, textAlign: 'center', fontSize: 12 }}>
              <span>{day.label}</span><br/><span className="muted">{day.dayLabel}</span>
              <div style={{ marginTop: 7 }}><b>{Number(day.hours.toFixed(1))}h</b></div>
              <span className="muted">{day.count} deadline{day.count === 1 ? '' : 's'}</span>
            </div>;
          })}
        </div>
        <div style={{ height: 200, marginTop: 12 }}>
          <ResponsiveContainer>
            <BarChart data={weekDays}>
              <CartesianGrid vertical={false} stroke="#eee"/>
              <XAxis dataKey="label" tick={{ fontSize: 10 }}/>
              <YAxis allowDecimals={false} unit="h" tick={{ fontSize: 10 }}/>
              <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload.date.toLocaleDateString()} formatter={value => [`${value}h`, 'Estimated workload']}/>
              <Bar dataKey="hours" name="Estimated workload" fill="#6d4aff" radius={[4, 4, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <h2>{editingId ? 'Edit deadline' : 'Add a deadline'}</h2>
        <p>Set a date and estimated effort to see its workload impact.</p>
        <form onSubmit={saveDeadline}>
          <Field label="Title"><FieldInput value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="e.g. Submit project proposal" maxLength={160}/></Field>
          <div className="grid grid-2">
            <Field label="Due date"><FieldInput type="date" value={form.date} onChange={event => setForm(current => ({ ...current, date: event.target.value }))}/></Field>
            <Field label="Estimated effort (hours)"><FieldInput type="number" min="0.25" max="1000" step="0.25" value={form.effort} onChange={event => setForm(current => ({ ...current, effort: event.target.value }))}/></Field>
          </div>
          <Field label="Priority"><select className="select" value={form.importance} onChange={event => setForm(current => ({ ...current, importance: event.target.value }))}><option>Low</option><option>Medium</option><option>High</option></select></Field>
          {formError && <p role="alert">{formError}</p>}
          <div className="row">
            <Button type="submit"><Plus size={14}/>{editingId ? 'Save changes' : 'Add deadline'}</Button>
            {editingId && <Button type="button" variant="secondary" onClick={resetForm}>Cancel edit</Button>}
          </div>
        </form>
      </Card>
    </div>
    <Card style={{ marginTop: 14 }}>
      <div className="row between">
        <div><h2>Your deadlines</h2><p>Mark work complete, update details, or remove deadlines you no longer need.</p></div>
        <select className="select" aria-label="Filter deadlines" value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="open">Open deadlines</option><option value="all">All deadlines</option><option value="completed">Completed</option>
        </select>
      </div>
      {!visibleDeadlines.length
        ? <p className="muted">{filter === 'completed' ? 'No completed deadlines yet.' : 'No deadlines in this view. Add one above to plan your work.'}</p>
        : visibleDeadlines.map(deadline => {
          const isCompleted = deadline.status === 'Completed';
          const isOverdue = !isCompleted && deadline.dateValue < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          return <div className="list-item row between" key={deadline.id}>
            <div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13, textDecoration: isCompleted ? 'line-through' : 'none' }}>{deadline.title}</b>
                <Badge tone={isCompleted ? 'green' : deadline.importance === 'High' ? 'red' : deadline.importance === 'Low' ? '' : 'purple'}>{isCompleted ? 'Completed' : deadline.importance || 'Medium'}</Badge>
                {isOverdue && <Badge tone="red">Overdue</Badge>}
              </div>
              <p>{deadline.dateValue.toLocaleDateString()} · {deadline.effort}h estimated effort</p>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button type="button" variant="secondary" onClick={() => toggleComplete(deadline)}>{isCompleted ? 'Reopen' : 'Complete'}</Button>
              <Button type="button" variant="secondary" onClick={() => editDeadline(deadline)}>Edit</Button>
              <Button type="button" variant="danger" onClick={() => removeDeadline(deadline)}>Remove</Button>
            </div>
          </div>;
        })}
    </Card>
  </>;
}
function Planner() {
  const store = useStore();
  const navigate = useNavigate();
  const openedTaskRef = useRef('');
  const quizElapsedSecondsRef = useRef(0);
  const quizVisibleSinceRef = useRef(0);
  const [tasks, setTasks] = useState([]);
  const [profileReadiness, setProfileReadiness] = useState({ skills: [], availability: [] });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeTaskId, setActiveTaskId] = useState('');
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const activeTask = tasks.find(task => task.id === activeTaskId);
  useEffect(() => {
    const updateVisibleTime = () => {
      if (document.visibilityState === 'hidden') {
        if (quizVisibleSinceRef.current) {
          quizElapsedSecondsRef.current += (Date.now() - quizVisibleSinceRef.current) / 1000;
          quizVisibleSinceRef.current = 0;
        }
      } else if (activeTaskId && !result && !quizVisibleSinceRef.current) {
        quizVisibleSinceRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', updateVisibleTime);
    updateVisibleTime();
    return () => document.removeEventListener('visibilitychange', updateVisibleTime);
  }, [activeTaskId, result]);
  const loadPlan = async () => {
    setLoading(true);
    setError('');
    try {
      const plan = await service.getPracticePlan();
      setTasks(plan.tasks);
      setProfileReadiness({ skills: plan.skills, availability: plan.availability });
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load your practice plan.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadPlan(); }, []);
  useEffect(() => {
    if (!tasks.length) return;
    const taskId = new URLSearchParams(window.location.search).get('task');
    if (taskId && taskId !== openedTaskRef.current && tasks.some(task => task.id === taskId)) {
      openedTaskRef.current = taskId;
      startQuiz(taskId);
    }
  }, [tasks]);
  const generatePlan = async () => {
    setGenerating(true);
    setError('');
    try {
      const response = await service.generatePracticePlan(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      setTasks(response.tasks);
      setActiveTaskId('');
      setResult(null);
      toast.success(`Scheduled ${response.tasks.length} skill practice sessions.`);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not generate your weekly plan.');
    } finally {
      setGenerating(false);
    }
  };
  const startQuiz = async taskId => {
    setError('');
    setResult(null);
    try {
      const response = await service.generatePracticeQuiz(taskId);
      setTasks(current => current.map(task => task.id === taskId ? response.task : task));
      setActiveTaskId(taskId);
      setAnswers(Array(response.task.questions.length).fill(''));
      quizElapsedSecondsRef.current = 0;
      quizVisibleSinceRef.current = document.visibilityState === 'visible' ? Date.now() : 0;
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not prepare this quiz.');
    }
  };
  const submitQuiz = async event => {
    event.preventDefault();
    if (answers.length !== 5 || answers.some(answer => !String(answer).trim())) {
      setError('Answer all five questions before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const elapsedSeconds = quizElapsedSecondsRef.current
        + (quizVisibleSinceRef.current ? (Date.now() - quizVisibleSinceRef.current) / 1000 : 0);
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
      const activeMinutes = Math.min(activeTask?.duration || 1440, elapsedMinutes);
      const submission = await service.submitPracticeQuiz(activeTaskId, answers, activeMinutes);
      setResult(submission);
      quizVisibleSinceRef.current = 0;
      quizElapsedSecondsRef.current = 0;
      await loadPlan();
      toast.success(`Quiz submitted: ${submission.score}% · Builder Score updated.`);
      try {
        const profileResponse = await service.getProfile();
        store.updateProfile({
          ...profileResponse.user,
          ...profileResponse.profile,
          profileEvidenceCount: profileResponse.profile.evidence.length,
          quizScore: profileResponse.profile.stats.quizScore,
        });
      } catch {
        setError('Quiz saved, but the latest Builder Score could not be refreshed. Open your profile again to reload it.');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not submit this quiz.');
    } finally {
      setSubmitting(false);
    }
  };
  const closeQuiz = () => {
    setActiveTaskId('');
    setResult(null);
    quizVisibleSinceRef.current = 0;
    quizElapsedSecondsRef.current = 0;
    navigate('/planner', { replace: true });
  };
  if (loading) return <Card><p>Loading your saved practice plan...</p></Card>;
  return <><PageHeader title="AI action plan" subtitle="Practice sessions scheduled around your saved skills and weekly availability." action={<Button onClick={generatePlan} disabled={generating}>{generating ? 'Generating...' : <><Sparkles size={14}/>{tasks.length ? ' Regenerate week' : ' Generate weekly plan'}</>}</Button>}/>{error && <Card style={{marginBottom:14}}><p role="alert">{error}</p></Card>}
    {!tasks.length && <Card><h2>{!profileReadiness.skills.length || !profileReadiness.availability.length ? 'Your skills, your schedule' : 'No practice plan scheduled yet'}</h2>{!profileReadiness.skills.length || !profileReadiness.availability.length ? <><p>{!profileReadiness.skills.length && !profileReadiness.availability.length ? 'Save at least one skill and select weekly availability in your profile.' : !profileReadiness.skills.length ? 'Save at least one skill in your profile to prepare skill-focused practice.' : 'Select weekly availability in your profile so practice sessions can be scheduled.'}</p><Link className="btn btn-secondary" to="/profile">Update profile</Link></> : <><p>Your profile has {profileReadiness.skills.length} saved skill{profileReadiness.skills.length === 1 ? '' : 's'} and {profileReadiness.availability.length} availability slot{profileReadiness.availability.length === 1 ? '' : 's'}.</p><Button variant="secondary" onClick={generatePlan} disabled={generating}>{generating ? 'Generating...' : 'Create this week’s plan'}</Button></>}</Card>}
    {activeTask && <Card style={{marginBottom:14}}><div className="row between"><div><h2>{activeTask.title}</h2><p>{activeTask.skillName} · {activeTask.objective}</p></div><Button variant="secondary" onClick={closeQuiz}>Close quiz</Button></div>
      {!result && <form onSubmit={submitQuiz}>{activeTask.questions?.map((question, index) => <div className="list-item" key={`${activeTask.id}-${index}`}><b>Question {index + 1} · {question.type === 'coding' ? 'Coding practice' : 'Skill check'}</b><p>{question.prompt}</p>{question.type === 'multiple_choice' ? question.options.map((option, optionIndex) => <label className="list-item row" key={optionIndex}><input type="radio" name={`answer-${index}`} checked={answers[index] === String(optionIndex)} onChange={() => setAnswers(current => current.map((value, answerIndex) => answerIndex === index ? String(optionIndex) : value))}/>{option}</label>) : <textarea className="textarea" rows={7} value={answers[index] || ''} onChange={event => setAnswers(current => current.map((value, answerIndex) => answerIndex === index ? event.target.value : value))} placeholder="Write your code or explain your solution."/>}</div>)}<p className="muted">{activeTask.generationSource === 'LOCAL' ? 'Local practice grading checks response detail, not code execution. Add a Gemini API key for AI-based rubric grading.' : 'Coding responses are assessed by Gemini against a rubric; code is not executed.'}</p><Button disabled={submitting}>{submitting ? 'Grading...' : 'Submit quiz'}</Button></form>}
      {result && <><Badge tone="purple">Score: {result.score}%</Badge>{result.feedback.map(item => <div className="list-item" key={item.questionIndex}><b>Question {item.questionIndex + 1}: {item.score}%</b><p>{item.explanation}</p></div>)}<p>Your recent quiz average now contributes 25% of your Builder Score.</p><Button onClick={closeQuiz}>Back to plan</Button></>}
    </Card>}
    {tasks.length > 0 && <Card><div className="row between"><div><h2>Scheduled skill practice</h2><p>Notifications appear here in Notifications when each session is due.</p></div><Badge tone="purple">{tasks.length} sessions</Badge></div>{tasks.map(task => <div className="list-item row between" key={task.id}><div><div className="row"><b>{task.title}</b><Badge tone={task.status === 'COMPLETED' ? 'green' : 'purple'}>{task.status === 'COMPLETED' ? `Completed · ${task.latestAttempt?.score ?? 0}%` : task.skillName}</Badge>{task.generationSource === 'LOCAL' && <Badge>Local templates</Badge>}</div><p>{task.objective}</p><span className="muted">{new Date(task.scheduledFor).toLocaleString()} · {task.duration} min</span></div><Button variant="secondary" onClick={() => startQuiz(task.id)}>{task.hasQuiz ? 'Start quiz' : 'Prepare quiz'}</Button></div>)}</Card>}
  </>;
}

function Challenges() {
  const [challenges, setChallenges] = useState([]);
  const [q, setQ] = useState('');
  const [skill, setSkill] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await service.getPublishedChallenges({ search: q, skill });
      setChallenges(response.challenges);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load published challenges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [q, skill]);

  const join = async (challenge) => {
    try {
      await service.joinChallenge(challenge.id);
      setChallenges(current => current.map(item => item.id === challenge.id ? { ...item, joined: true, participantCount: item.participantCount + 1 } : item));
      toast.success('Challenge joined');
    } catch (requestError) {
      toast.error(requestError.response?.data?.error?.message || 'Could not join the challenge.');
    }
  };

  return <><PageHeader title="Browse challenges" subtitle="Only published challenges created by organizers appear here." action={<div className="row"><Search size={15}/><FieldInput value={q} onChange={e=>setQ(e.target.value)} placeholder="Search published challenges"/></div>}/><div className="row" style={{marginBottom:14}}><FieldInput value={skill} onChange={e=>setSkill(e.target.value)} placeholder="Filter by required skill"/></div>{loading ? <Card><p>Loading published challenges...</p></Card> : error ? <Card><p>{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card> : challenges.length === 0 ? <Card><h2>No published challenges found</h2><p>Organizers have not published a matching challenge yet.</p></Card> : <div className="grid grid-3">{challenges.map(c=><Card key={c.id}><div className="row between"><Badge tone="green">Published</Badge><span className="muted">{c.participantCount} joined</span></div><h2 style={{marginTop:13}}>{c.title}</h2><p>{c.description}</p><p className="muted">Organizer: {c.organizer.name}</p><div className="row" style={{flexWrap:'wrap',margin:'12px 0'}}>{c.requiredSkills.map(x=><Badge key={x.id}>{x.name}</Badge>)}</div><div className="row between"><span className="muted">Teams of {c.teamSize} · {new Date(c.deadline).toLocaleDateString()}</span>{c.joined ? <div className="row"><Badge tone="green">Joined</Badge><Link className="btn btn-secondary" to={`/challenges/${c.id}/find-teammates`}>Find teammates</Link></div> : <Button onClick={() => join(c)}>Join</Button>}</div></Card>)}</div>}</>;
}
function ChallengeDetail() { const {id}=useParams(),s=useStore(),u=currentUser(s),c=s.challenges.find(x=>x.id===id)||s.challenges[0],joined=c.participants.includes(u.id); return <><PageHeader title={c.title} subtitle={c.description} action={joined?<Badge tone="green">Joined</Badge>:<Button onClick={()=>{s.joinChallenge(c.id);toast.success('Challenge joined')}}>Join challenge</Button>}/><div className="grid grid-2"><Card><h2>Challenge brief</h2><p>Required skills and roles are signals for a balanced team, not a ranking of people.</p><h3 style={{marginTop:16}}>Required skills</h3><div className="row" style={{flexWrap:'wrap'}}>{c.requiredSkills.map(x=><Badge tone="purple" key={x}>{x}</Badge>)}</div><h3 style={{marginTop:16}}>Team constraints</h3><p>Up to {c.teamSize} members · deadline {c.deadline}</p></Card><Card><h2>Your match</h2><div className="stat-value">78%</div><p>Your profile covers React and UI/UX. Add a data teammate to close the biggest gap.</p><div className="progress"><span style={{width:'78%'}}/></div><div className="row" style={{marginTop:18}}><Link className="btn btn-primary" to={`/challenges/${c.id}/find-teammates`}>Find teammates <Users size={14}/></Link><Link className="btn btn-secondary" to={`/challenges/${c.id}/my-team`}>My team</Link></div></Card></div></> }
function LegacyFindTeammates() { const {id}=useParams(),s=useStore(),u=currentUser(s),c=s.challenges.find(x=>x.id===id)||s.challenges[0], [sent,setSent]=useState(null);const people=s.users.filter(x=>x.id!==u.id&&c.participants.includes(x.id));return <><PageHeader title="Find teammates" subtitle={`${people.length} participants in ${c.title}.`} action={<Badge tone="amber">Human approval required</Badge>}/><div className="grid grid-3">{people.map(p=><Card key={p.id}><div className="row between"><div className="row"><div className="avatar">{initials(p.name)}</div><div><Link className="accent" to={`/students/${p.id}`}><b style={{fontSize:13}}>{p.name}</b></Link><p>{p.preferredRole}</p></div></div><ScoreBadge user={p}/></div><div className="row" style={{flexWrap:'wrap',margin:'13px 0'}}>{p.skills.slice(0,3).map(x=><Badge key={x.name}>{x.name}</Badge>)}</div><div className="row between"><span className="muted">78% availability match</span><Button onClick={()=>setSent(p)}>Send invite</Button></div></Card>)}</div>{sent&&<div className="login-wrap" style={{position:'fixed',inset:0,zIndex:5,background:'#11182766'}}><Card className="login-card"><div className="row between"><h2>Invite {sent.name}</h2><button className="btn btn-secondary" onClick={()=>setSent(null)}><X size={15}/></button></div><Field label="Role offered"><select className="select"><option>{sent.preferredRole}</option><option>Contributor</option></select></Field><Field label="Message"><textarea className="textarea" defaultValue={`I’d love your ${sent.skills[0]?.name} perspective on this challenge.`}/></Field><div className="row" style={{justifyContent:'flex-end'}}><Button variant="secondary" onClick={()=>setSent(null)}>Cancel</Button><Button onClick={()=>{try{s.sendInvite({challengeId:c.id,receiverId:sent.id,role:sent.preferredRole,requiredSkills:c.requiredSkills,message:'Let’s build together.'});toast.success('Invitation sent');setSent(null)}catch(e){toast.error(e.message)}}}>Send invite</Button></div></Card></div>}</> }
function FindTeammates() {
  const { id } = useParams();
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selected, setSelected] = useState(null), [message, setMessage] = useState('I would like to invite you to join my team.');
  const [sending, setSending] = useState(false);
  const load = async () => {
    setLoading(true); setError('');
    try { setData(await service.getChallengeTeammates(id)); } catch (requestError) { setError(requestError.response?.data?.error?.message || 'Could not load teammates for this challenge.'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);
  const sendInvite = async () => {
    setSending(true);
    try {
      await service.sendInvitation(id, { recipientId: selected.id, message });
      toast.success(`Invitation sent to ${selected.name}`);
      setData(current => ({ ...current, candidates: current.candidates.filter(candidate => candidate.id !== selected.id) }));
      setSelected(null);
    } catch (requestError) {
      toast.error(requestError.response?.data?.error?.message || 'Could not send the invitation.');
    } finally {
      setSending(false);
    }
  };
  if (loading) return <Card><p>Loading teammates...</p></Card>;
  if (error) return <Card><p>{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card>;
  const { challenge, candidates } = data;
  return <><PageHeader title="Find teammates" subtitle={`${candidates.length} registered participants available for ${challenge.title}.`} action={<Badge tone="amber">Human approval required</Badge>}/><Card style={{marginBottom:14}}><div className="row between"><div><h2>{challenge.title}</h2><p>Only students who joined this challenge appear here. Students already assigned to a team are excluded.</p></div><Badge tone="purple">Teams of {challenge.teamSize}</Badge></div><div className="row" style={{flexWrap:'wrap',marginTop:10}}>{challenge.requiredSkills.map(skill=><Badge key={skill.id}>{skill.name}</Badge>)}</div></Card>{candidates.length === 0 ? <Card><h2>No teammates available yet</h2><p>Another student must join this challenge and must not already be assigned to a team to appear here.</p></Card> : <div className="grid grid-3">{candidates.map(candidate=><Card key={candidate.id}><div className="row"><div className="avatar">{initials(candidate.name)}</div><div><Link className="accent" to={`/students/${candidate.id}`}><b style={{fontSize:13}}>{candidate.name}</b></Link><p>{candidate.headline || 'Student participant'}</p></div></div><div className="row" style={{flexWrap:'wrap',margin:'13px 0'}}>{candidate.skills.slice(0,5).map(skill=><Badge key={skill.id}>{skill.name} · {skill.proficiency.toLowerCase()}</Badge>)}</div><div className="row between"><span className="muted">{candidate.available ? `${candidate.weeklyCapacity}h weekly capacity` : 'Currently unavailable'}</span><div className="row"><Badge tone={candidate.available ? 'green' : 'amber'}>{candidate.available ? 'Available' : 'Unavailable'}</Badge><Button disabled={!candidate.available} onClick={()=>{setSelected(candidate);setMessage(`I would like to invite you to join my team for ${challenge.title}.`)}}><Users size={14}/> Invite</Button></div></div></Card>)}</div>}{selected&&<div className="login-wrap" style={{position:'fixed',inset:0,zIndex:5,background:'#11182766'}}><Card className="login-card"><div className="row between"><h2>Invite {selected.name}</h2><button className="btn btn-secondary" onClick={()=>setSelected(null)}><X size={15}/></button></div><p>This invitation will be saved and appear in the student's Received tab.</p><Field label="Message"><textarea className="textarea" value={message} onChange={event=>setMessage(event.target.value)}/></Field><div className="row" style={{justifyContent:'flex-end'}}><Button variant="secondary" onClick={()=>setSelected(null)}>Cancel</Button><Button disabled={sending} onClick={sendInvite}>{sending?'Sending...':'Send invitation'}</Button></div></Card></div>}</>;
}

function LegacyInvitations() { const s=useStore(),u=currentUser(s), incoming=s.invitations.filter(i=>i.receiverId===u.id), getUser=id=>s.users.find(x=>x.id===id);return <><PageHeader title="Invitations" subtitle="Build teams with clear expectations and consent."/><div className="tabs"><button className="tab active">Received ({incoming.length})</button><button className="tab">Sent</button></div><div className="grid grid-2">{incoming.map(i=>{const from=getUser(i.senderId);return <Card key={i.id}><div className="row between"><div className="row"><div className="avatar">{initials(from?.name)}</div><div><b style={{fontSize:13}}>{from?.name}</b><p>{i.role} · {i.createdAt}</p></div></div><Badge tone={i.status==='Pending'?'amber':i.status==='Accepted'?'green':'red'}>{i.status === 'Accepted' ? 'Invitation accepted' : i.status}</Badge></div><p style={{margin:'14px 0'}}>{i.message}</p>{i.status==='Pending'&&<div className="row"><Button onClick={()=>{try { s.respondInvite(i.id,'Accepted'); toast.success('Invitation accepted'); } catch (error) { toast.error(error.message); }}}><Check size={14}/> Accept</Button><Button variant="secondary" onClick={()=>s.respondInvite(i.id,'Declined')}>Decline</Button></div>}</Card>})}</div></> }

function Invitations() {
  const [data, setData] = useState({ received: [], sent: [] }), [tab, setTab] = useState('received'), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const invitations = await service.getInvitations();
      setData(invitations);
      publishPendingInvitationCount(invitations.received);
    } catch (requestError) { setError(requestError.response?.data?.error?.message || 'Could not load invitations.'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const respond = async (invitation, status) => {
    try { await service.respondToInvitation(invitation.id, status); toast.success(status === 'ACCEPTED' ? 'Invitation accepted' : 'Invitation rejected'); await load(); } catch (requestError) { toast.error(requestError.response?.data?.error?.message || 'Could not update invitation.'); }
  };
  if (loading) return <Card><p>Loading invitations...</p></Card>;
  if (error) return <Card><p>{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card>;
  const invitations = tab === 'received' ? data.received : data.sent;
  const pendingReceivedCount = data.received.filter(invitation => invitation.status === 'PENDING').length;
  return <><PageHeader title="Invitations" subtitle="Send and respond to persistent team invitations."/><div className="tabs"><button className={`tab ${tab === 'received' ? 'active' : ''}`} onClick={()=>setTab('received')}>Received ({data.received.length}) {pendingReceivedCount > 0 && <Badge tone="amber">{pendingReceivedCount} pending</Badge>}</button><button className={`tab ${tab === 'sent' ? 'active' : ''}`} onClick={()=>setTab('sent')}>Sent ({data.sent.length})</button></div>{invitations.length === 0 ? <Card><h2>No {tab} invitations</h2><p>{tab === 'received' ? 'Invitations from teammates will appear here.' : 'Invitations you send from Find teammates will appear here.'}</p></Card> : <div className="grid grid-2">{invitations.map(invitation=><Card key={invitation.id}><div className="row between"><div><b>{tab === 'received' ? invitation.sender.name : invitation.recipient.name}</b><p>{invitation.team.challenge.title} · {new Date(invitation.createdAt).toLocaleDateString()}</p></div><Badge tone={invitation.status === 'PENDING' ? 'amber' : invitation.status === 'ACCEPTED' ? 'green' : 'red'}>{invitation.status}</Badge></div><p style={{margin:'14px 0'}}>{invitation.message || 'Team invitation'}</p>{tab === 'received' && invitation.status === 'PENDING' && <div className="row"><Button onClick={()=>respond(invitation,'ACCEPTED')}><Check size={14}/> Accept</Button><Button variant="secondary" onClick={()=>respond(invitation,'REJECTED')}>Reject</Button></div>}{invitation.status === 'ACCEPTED' && <Link className="btn btn-primary" to={`/challenges/${invitation.team.challenge.id}/my-team`}>Open team and group chat</Link>}</Card>)}</div>}</>;
}
function LegacyHackathons() { const s=useStore(),u=currentUser(s),teams=s.teams.filter(t=>t.members.includes(u.id));return <><PageHeader title="My hackathons" subtitle="Your active challenge commitments and team health."/><div className="grid grid-2">{s.challenges.filter(c=>c.participants.includes(u.id)).map(c=>{const t=teams.find(x=>x.challengeId===c.id);return <Card key={c.id}><div className="row between"><h2>{c.title}</h2><Badge tone={t?.approval==='Approved'?'green':'amber'}>{t?t.approval:'No team yet'}</Badge></div><p>Deadline {c.deadline} · team size {c.teamSize}</p>{t?<><div className="row" style={{margin:'14px 0'}}>{t.members.map(id=><div className="avatar" title={s.users.find(x=>x.id===id)?.name} key={id}>{initials(s.users.find(x=>x.id===id)?.name)}</div>)}</div><div className="row" style={{flexWrap:'wrap'}}>{(t.coveredSkills||c.requiredSkills.slice(0,2)).map(x=><Badge tone="green" key={x}>{x}</Badge>)}{(t.missingSkills||c.requiredSkills.slice(2)).map(x=><Badge tone="red" key={x}>{x}</Badge>)}</div></>:<Link className="btn btn-primary" to={`/challenges/${c.id}/find-teammates`} style={{marginTop:14}}>Find teammates</Link>}</Card>})}</div></> }

function Hackathons() {
  const { id: challengeId } = useParams();
  const user = useStore(currentUser);
  const [challenges, setChallenges] = useState([]), [teams, setTeams] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [challengeResponse, teamResponse] = await Promise.all([service.getPublishedChallenges(), service.getMyTeams()]);
      setChallenges(challengeResponse.challenges.filter(challenge => challenge.joined));
      setTeams(teamResponse.teams.filter(team => !challengeId || team.challenge.id === challengeId));
    } catch (requestError) { setError(requestError.response?.data?.error?.message || 'Could not load your teams and hackathons.'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [challengeId]);
  if (loading) return <Card><p>Loading your hackathons...</p></Card>;
  if (error) return <Card><p>{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card>;
  return <><PageHeader title={challengeId ? 'Challenge team' : 'My hackathons & teams'} subtitle="See your teammates and coordinate in your private team chat."/><h2 style={{marginTop:18}}>My teams</h2>{teams.length === 0 ? <Card><h2>No team memberships yet</h2><p>When you accept an invitation, or a teammate accepts yours, your team will appear here.</p></Card> : <div className="grid grid-2">{teams.map(team=><Card key={team.id}><div className="row between"><div><h2>{team.name}</h2><p>{team.challenge.title}</p></div><Badge tone="green">{team.status}</Badge></div><h3 style={{marginTop:14}}>Teammates ({team.members.length})</h3><div className="team-roster">{team.members.map(member=><div className="row team-roster-member" key={member.id}><div className="avatar">{initials(member.name)}</div><div><b style={{fontSize:12}}>{member.name}{member.id === user?.id ? ' (you)' : ''}</b><p>{member.id === team.leaderId ? 'Team lead' : 'Member'}</p></div></div>)}</div>{team.members.length > 1 ? <TeamChat teamId={team.id}/> : <p className="muted">Group chat will be available when a teammate accepts your invitation.</p>}</Card>)}</div>}<h2 style={{marginTop:24}}>Joined challenges</h2><div className="grid grid-2">{challenges.length === 0 ? <Card><p>No joined challenges found.</p><Link className="btn btn-primary" to="/challenges" style={{marginTop:12}}>Browse challenges</Link></Card> : challenges.map(challenge=><Card key={challenge.id}><div className="row between"><h2>{challenge.title}</h2><Badge tone="green">Joined</Badge></div><p>{challenge.description}</p><p>Deadline {new Date(challenge.deadline).toLocaleDateString()} · teams of {challenge.teamSize}</p><div className="row" style={{flexWrap:'wrap',margin:'12px 0'}}>{challenge.requiredSkills.map(skill=><Badge key={skill.id}>{skill.name}</Badge>)}</div><Link className="btn btn-primary" to={`/challenges/${challenge.id}/find-teammates`}>Find teammates <Users size={14}/></Link></Card>)}</div></>;
}

function TeamChat({ teamId }) {
  const [messages, setMessages] = useState([]), [body, setBody] = useState(''), [file, setFile] = useState(null), [error, setError] = useState(''), [sending, setSending] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await service.getTeamChat(teamId);
        if (active) { setMessages(response.messages); setError(''); }
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.error?.message || 'Could not load team chat.');
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [teamId]);
  const send = async (event) => {
    event.preventDefault();
    if (!body.trim() && !file) return;
    setSending(true);
    try {
      const response = file
        ? await service.uploadTeamChatMessage(teamId, body, file)
        : await service.sendTeamChatMessage(teamId, body);
      setMessages(current => [...current, response.message]);
      setBody('');
      setFile(null);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not send your message.');
    } finally {
      setSending(false);
    }
  };
  return <div className="team-chat"><div className="row between"><h3>Team group chat</h3><span className="muted">Updates automatically</span></div>{error && <p role="alert" style={{color:'#b91c1c'}}>{error}</p>}<div className="team-chat-messages" aria-live="polite">{messages.length === 0 ? <p className="muted">No messages yet. Say hello to your team.</p> : messages.map(message=><div className="team-chat-message" key={message.id}><div className="row between"><b>{message.sender.name}</b><span className="muted">{new Date(message.createdAt).toLocaleString()}</span></div>{message.body && <p>{message.body}</p>}{message.attachments?.map(attachment=><div className="chat-attachment" key={attachment.id}>{attachment.mimeType.startsWith('image/') ? <a href={service.getTeamChatAttachmentUrl(attachment.downloadUrl)} target="_blank" rel="noreferrer"><img className="chat-image" src={service.getTeamChatAttachmentUrl(attachment.downloadUrl, true)} alt={attachment.fileName}/></a> : null}<a className="chat-attachment-link" href={service.getTeamChatAttachmentUrl(attachment.downloadUrl)} target="_blank" rel="noreferrer" download><FileText size={16}/><span>{attachment.fileName}<small>{(attachment.size / 1024 / 1024).toFixed(2)} MB</small></span><Download size={14}/></a></div>)}</div>)}</div><form className="team-chat-form" onSubmit={send}><FieldInput value={body} onChange={event=>setBody(event.target.value)} maxLength={2000} aria-label="Message to your team" placeholder="Write a message to your team"/><label className="btn btn-secondary chat-attach-button"><Paperclip size={15}/><span>Attach</span><input type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp" onChange={event=>setFile(event.target.files?.[0] || null)} aria-label="Attach a document or image"/></label><Button disabled={sending || (!body.trim() && !file)}>{sending ? 'Sending...' : 'Send'}</Button></form>{file && <div className="row chat-selected-file"><span className="muted">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span><button type="button" className="btn btn-secondary" aria-label="Remove attachment" onClick={()=>setFile(null)}><X size={13}/></button></div>}<p className="muted">PDF, Word, text, PNG, JPG, GIF, or WEBP · max 10 MB</p></div>;
}
function Projects() { const s=useStore();return <><PageHeader title="Projects" subtitle="Evidence grows when work is visible, shared, and shipped." action={<Button><Plus size={14}/> New project</Button>}/><div className="grid grid-3">{s.projects.map(p=><Card key={p.id}><div className="row between"><Badge tone="green">{p.status}</Badge><span className="muted">{p.progress}%</span></div><h2 style={{marginTop:14}}>{p.name}</h2><p>{p.description}</p><div className="progress" style={{margin:'14px 0'}}><span style={{width:`${p.progress}%`}}/></div><div className="row between"><span className="muted">{p.tasks.length} tasks · {p.members.length} members</span><Link className="btn btn-secondary" to={`/projects/${p.id}`}>Open</Link></div></Card>)}</div></> }
function ProjectDetail() { const {id}=useParams(),s=useStore(),p=s.projects.find(x=>x.id===id)||s.projects[0],cols=['To Do','In Progress','Review','Done'];return <><PageHeader title={p.name} subtitle={p.description} action={<Badge tone="green">{p.progress}% delivered</Badge>}/><div className="tabs"><button className="tab active">Tasks</button><button className="tab">Milestones</button><button className="tab">Members</button><button className="tab">Evidence</button></div><div className="grid grid-4">{cols.map(col=><Card key={col}><div className="row between"><h3>{col}</h3><Badge>{p.tasks.filter(t=>t.column===col).length}</Badge></div>{p.tasks.filter(t=>t.column===col).map(t=><div className="list-item" key={t.id}><div className="row between"><b style={{fontSize:12}}>{t.title}</b><Badge tone={t.priority==='High'?'red':''}>{t.priority}</Badge></div><p>{s.users.find(u=>u.id===t.assignee)?.name}</p><select className="select" value={t.column} onChange={e=>s.moveTask(p.id,t.id,e.target.value)} aria-label={`Move ${t.title}`}>{cols.map(c=><option key={c}>{c}</option>)}</select></div>)}</Card>)}</div><div className="grid grid-2" style={{marginTop:14}}><Card><h2>Milestones</h2>{p.milestones.map(m=><div className="list-item row between" key={m.id}><div><b style={{fontSize:13}}>{m.title}</b><p>{m.status}</p></div><Badge tone="purple">{m.progress}%</Badge></div>)}</Card><Card><h2>Evidence</h2>{p.evidence.map(e=><div className="list-item row between" key={e.id}><span>{e.label}</span><a className="accent" href={e.url} target="_blank" rel="noreferrer"><ExternalLink size={14}/></a></div>)}</Card></div></> }

function Organizer() {
  const store = useStore();
  const user = currentUser(store);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      let challenges;
      let teams;
      if (isDemoOrganizer(user)) {
        challenges = store.challenges.map(demoChallengeRecord);
        teams = store.teams.map(team => demoOrganizerTeam(team, store));
      } else {
        const [challengeResponse, teamResponse] = await Promise.all([
          service.getOrganizerChallenges(),
          service.getOrganizerTeams(),
        ]);
        challenges = challengeResponse.challenges;
        teams = teamResponse.teams;
      }
      const teamsByChallenge = new Map();
      teams.forEach(team => {
        teamsByChallenge.set(team.challengeId, [...(teamsByChallenge.get(team.challengeId) || []), team]);
      });
      const activeChallenges = challenges.filter(challenge =>
        challenge.status === 'PUBLISHED' && new Date(challenge.deadline) > new Date()
      );
      const participantCount = challenges.reduce((total, challenge) => total + challenge.participantCount, 0);
      const unmatchedCount = challenges.reduce((total, challenge) => {
        const assignedCount = (teamsByChallenge.get(challenge.id) || [])
          .filter(team => team.status !== 'REJECTED')
          .reduce((teamTotal, team) => teamTotal + team.members.length, 0);
        return total + Math.max(0, challenge.participantCount - assignedCount);
      }, 0);
      const recentActivity = [
        ...challenges.map(challenge => ({
          id: `challenge-${challenge.id}`,
          label: `Challenge created: ${challenge.title}`,
          date: challenge.createdAt,
          path: '/organizer/challenges',
        })),
        ...teams.map(team => ({
          id: `team-${team.id}`,
          label: `Team ${team.name} · ${team.status.toLowerCase()}`,
          date: team.createdAt,
          path: team.status === 'APPROVED' ? '/organizer/approved' : '/organizer/teams',
        })),
      ].filter(activity => activity.date)
        .sort((first, second) => new Date(second.date) - new Date(first.date))
        .slice(0, 6);
      setData({
        challenges,
        teams,
        demo: isDemoOrganizer(user),
        activeChallenges,
        participantCount,
        unmatchedCount,
        pendingApprovals: teams.filter(team => ['FORMING', 'SUBMITTED'].includes(team.status)).length,
        recentActivity,
      });
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load organizer dashboard data.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [user?.id, store.challenges, store.teams]);
  return <>
    <PageHeader title="Organizer dashboard" subtitle="Monitor your challenges, participant pool, and team review queue." action={<Button variant="secondary" onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button>}/>
    {error && <Card><p role="alert">{error}</p><Button variant="secondary" onClick={load} disabled={loading}>Retry</Button></Card>}
    {loading && !data ? <Card><p>Loading organizer dashboard...</p></Card> : data && <>
      <div className="grid grid-4">
        <StatCard label="Active challenges" value={data.activeChallenges.length} detail={`${data.challenges.length} total challenges`} icon="Target"/>
        <StatCard label="Participants" value={data.participantCount} detail="Joined to your challenges" icon="Users"/>
        <StatCard label="Pending approvals" value={data.pendingApprovals} detail="Requires organizer review" icon="ShieldCheck"/>
        <StatCard label="Unassigned participants" value={data.unmatchedCount} detail="Across your challenges" icon="Network"/>
      </div>
      <Card style={{marginTop:14}}>
        <div className="row between"><h2>{data.demo ? 'Workspace overview' : 'Recent activity'}</h2><Link className="accent muted" to="/organizer/challenges">View challenges</Link></div>
        {data.demo && <p className="muted">Demo data is stored in this browser; no activity timestamps are available.</p>}
        {data.recentActivity.length ? data.recentActivity.map(activity => <Link className="list-item row between" key={activity.id} to={activity.path} style={{color:'inherit',textDecoration:'none'}}><span style={{fontSize:13}}>{activity.label}</span><span className="muted">{new Date(activity.date).toLocaleString()}</span></Link>) : <p className="muted">Activity will appear here as you create challenges and review teams.</p>}
      </Card>
    </>}
  </>;
}
function OrganizerChallenges() {
  const store = useStore();
  const user = currentUser(store);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setChallenges(isDemoOrganizer(user)
        ? store.challenges.map(demoChallengeRecord)
        : (await service.getOrganizerChallenges()).challenges);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load your challenges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id, store.challenges]);

  return <><PageHeader title="Challenges" subtitle="Design constraints that help people collaborate well." action={<Link className="btn btn-primary" to="/organizer/challenges/new"><Plus size={14}/> Create challenge</Link>}/>{loading ? <Card><p>Loading challenges...</p></Card> : error ? <Card><p>{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card> : challenges.length === 0 ? <Card><h2>No challenges yet</h2><p>Create your first challenge to start building a participant pool.</p></Card> : <div className="grid grid-3">{challenges.map(c => <Card key={c.id}><div className="row between"><Badge tone={c.status === 'PUBLISHED' ? 'green' : 'amber'}>{c.status.toLowerCase()}</Badge><span className="muted">{c.participantCount} participants</span></div><h2 style={{marginTop:12}}>{c.title}</h2><p>{c.description}</p><p className="muted">Teams of {c.teamSize} · deadline {new Date(c.deadline).toLocaleDateString()}</p><div className="row" style={{flexWrap:'wrap'}}>{c.requiredSkills.map(skill => <Badge key={skill.id}>{skill.name}</Badge>)}</div><div className="row" style={{flexWrap:'wrap'}}><Link className="btn btn-secondary" to={`/organizer/challenges/${c.id}/participants`}>Participants</Link>{c.status === 'PUBLISHED' && <Link className="btn btn-secondary" to={`/organizer/challenges/${c.id}/teams`}>Teams</Link>}<Link className="btn btn-secondary" to={`/organizer/challenges/${c.id}/teamforge`}>Adaptive TeamForge</Link></div></Card>)}</div>}</>;
}

function ChallengeEditor() {
  const store = useStore();
  const user = currentUser(store);
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', deadline: '', teamSize: 4, requiredSkills: 'React, Data Analysis, Product' });
  const [saving, setSaving] = useState(false);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minimumDeadline = localDateKey(tomorrow);

  const save = async (publish) => {
    const requiredSkills = [...new Set(form.requiredSkills.split(',').map(skill => skill.trim()).filter(Boolean))];
    const teamSize = Number(form.teamSize);
    if (!form.title.trim() || !form.description.trim() || !form.deadline || requiredSkills.length === 0) {
      toast.error('Complete the title, description, deadline, and at least one required skill.');
      return;
    }
    if (!Number.isInteger(teamSize) || teamSize < 2 || teamSize > 20) {
      toast.error('Team size must be a whole number between 2 and 20.');
      return;
    }
    if (new Date(`${form.deadline}T00:00:00`).getTime() <= Date.now()) {
      toast.error('Choose a deadline in the future.');
      return;
    }
    setSaving(true);
    try {
      const challengeData = { ...form, title: form.title.trim(), description: form.description.trim(), teamSize, requiredSkills };
      const challenge = isDemoOrganizer(user)
        ? store.addChallenge(challengeData)
        : (await service.createChallenge(challengeData)).challenge;
      if (publish) {
        if (isDemoOrganizer(user)) store.updateChallenge(challenge.id, { status: 'PUBLISHED' });
        else await service.publishChallenge(challenge.id);
      }
      toast.success(publish ? 'Challenge published' : 'Challenge saved as draft');
      navigate('/organizer/challenges');
    } catch (requestError) {
      toast.error(requestError.response?.data?.error?.message || requestError.message || 'Could not save the challenge.');
    } finally {
      setSaving(false);
    }
  };

  return <><PageHeader title="Create challenge" subtitle="Define the basics, then review before publishing." action={<div className="row"><Button variant="secondary" disabled={saving} onClick={() => save(false)}>Save draft</Button><Button disabled={saving} onClick={() => save(true)}>Publish</Button></div>}/><div className="grid grid-2"><Card><h2>Basics</h2><Field label="Challenge title"><FieldInput required maxLength="160" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Climate Action Sprint"/></Field><Field label="Description"><textarea className="textarea" required maxLength="5000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe the problem and the audience." /></Field><div className="grid grid-2"><Field label="Deadline"><FieldInput required type="date" min={minimumDeadline} value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/></Field><Field label="Team size"><FieldInput required type="number" min="2" max="20" step="1" value={form.teamSize} onChange={e=>setForm({...form,teamSize:e.target.value})}/></Field></div></Card><Card><h2>Requirements</h2><Field label="Required skills (comma separated)"><FieldInput required value={form.requiredSkills} onChange={e=>setForm({...form,requiredSkills:e.target.value})} placeholder="React, Product, Data Analysis"/></Field><div className="row" style={{flexWrap:'wrap',marginTop:12}}>{form.requiredSkills.split(',').map(skill=>skill.trim()).filter(Boolean).map(skill=><Badge tone="purple" key={skill}>{skill}</Badge>)}</div><h2 style={{marginTop:24}}>Review</h2><p>Drafts are private to the organizer. Publishing makes the challenge visible to students and eligible for registrations.</p></Card></div></>;
}

function isDemoOrganizer(user) {
  return user?.role === 'organizer' && user.email?.endsWith('@skillmesh.demo');
}

function demoChallengeRecord(challenge) {
  return {
    ...challenge,
    status: challenge.status || 'PUBLISHED',
    requiredSkills: (challenge.requiredSkills || []).map(skill =>
      typeof skill === 'string' ? { id: skill, name: skill } : skill
    ),
    participantCount: challenge.participantCount ?? challenge.participants?.length ?? 0,
  };
}

function demoOrganizerTeam(team, store) {
  const challenge = store.challenges.find(item => item.id === team.challengeId);
  return {
    id: team.id,
    name: team.name || `Team ${team.id.slice(-3)}`,
    status: team.status || (team.approval === 'Approved' ? 'APPROVED' : team.approval === 'Rejected' ? 'REJECTED' : 'SUBMITTED'),
    createdAt: team.createdAt || team.approvedAt,
    challengeId: team.challengeId,
    challenge: challenge ? { id: challenge.id, title: challenge.title, deadline: challenge.deadline } : { id: team.challengeId, title: 'Challenge', deadline: '' },
    members: (team.members || []).map(memberId => store.users.find(user => user.id === memberId)).filter(Boolean).map(member => ({
      id: member.id,
      name: member.name,
      skills: (member.skills || []).map(skill => ({ id: skill.name, name: skill.name })),
    })),
  };
}

function evaluateDemoFormationTeam(config, members) {
  const skills = config.requiredSkills.filter(skill => skill.name.trim());
  const requiredRoles = config.requiredRoles || [];
  const totalSkillWeight = skills.reduce((total, skill) => total + skill.weight, 0);
  const memberSkills = new Set(members.flatMap(member =>
    (member.skills || []).map(skill => (typeof skill === 'string' ? skill : skill.name).trim().toLocaleLowerCase())
  ));
  const coveredSkills = skills.filter(skill => memberSkills.has(skill.name.trim().toLocaleLowerCase())).map(skill => skill.name.trim());
  const missingSkills = skills.filter(skill => !memberSkills.has(skill.name.trim().toLocaleLowerCase())).map(skill => skill.name.trim());
  const skillCoverage = totalSkillWeight
    ? skills.filter(skill => memberSkills.has(skill.name.trim().toLocaleLowerCase())).reduce((total, skill) => total + skill.weight, 0) / totalSkillWeight
    : 1;
  const roles = new Set(members.flatMap(member => member.preferredRoles || [member.preferredRole]).filter(Boolean).map(role => role.trim().toLocaleLowerCase()));
  const coveredRoles = requiredRoles.filter(role => roles.has(role.trim().toLocaleLowerCase()));
  const missingRoles = requiredRoles.filter(role => !roles.has(role.trim().toLocaleLowerCase()));
  const roleCoverage = requiredRoles.length ? coveredRoles.length / requiredRoles.length : 1;
  const capacity = members.reduce((total, member) => total + Number(member.weeklyHours || 0), 0);
  const availabilityFit = config.requiredWeeklyCapacity > 0
    ? Math.min(1, capacity / config.requiredWeeklyCapacity)
    : 1;
  const violations = [];
  if (members.length < config.minTeamSize) violations.push(`Team requires at least ${config.minTeamSize} members.`);
  if (members.length > config.maxTeamSize) violations.push(`Team cannot exceed ${config.maxTeamSize} members.`);
  if (missingSkills.length) violations.push(`Missing skills: ${missingSkills.join(', ')}.`);
  if (missingRoles.length) violations.push(`Missing roles: ${missingRoles.join(', ')}.`);
  if (availabilityFit < 1) violations.push('The team does not meet the required weekly capacity.');
  const weights = config.objectiveWeights || { skills: 0.55, roles: 0.2, availability: 0.25 };
  const score = skillCoverage * weights.skills + roleCoverage * weights.roles + availabilityFit * weights.availability;
  return {
    feasible: violations.length === 0,
    score: Math.round(score * 10000) / 100,
    metrics: {
      skillCoverage: Math.round(skillCoverage * 10000) / 100,
      roleCoverage: Math.round(roleCoverage * 10000) / 100,
      availabilityFit: Math.round(availabilityFit * 10000) / 100,
    },
    coveredSkills,
    missingSkills,
    coveredRoles,
    missingRoles,
    violations,
  };
}

function generateDemoFormationAlternatives(challenge, store, config) {
  const assignedMemberIds = new Set(store.teams
    .filter(team => team.challengeId === challenge.id && team.approval !== 'Rejected')
    .flatMap(team => team.members));
  const pool = (challenge.participants || [])
    .filter(memberId => !assignedMemberIds.has(memberId))
    .map(memberId => store.users.find(user => user.id === memberId))
    .filter(Boolean);
  const alternatives = [];
  for (let rank = 1; rank <= 3 && pool.length >= config.minTeamSize; rank += 1) {
    const members = [];
    while (members.length < config.maxTeamSize && pool.length) {
      const best = pool.map(member => ({
        member,
        score: evaluateDemoFormationTeam(config, [...members, member]).score,
      })).sort((left, right) => right.score - left.score || left.member.id.localeCompare(right.member.id))[0];
      members.push(best.member);
      pool.splice(pool.findIndex(member => member.id === best.member.id), 1);
    }
    const result = evaluateDemoFormationTeam(config, members);
    alternatives.push({
      id: `demo-${challenge.id}-${rank}`,
      rank,
      memberIds: members.map(member => member.id),
      score: result.score,
      feasible: result.feasible,
      metrics: result.metrics,
      coveredSkills: result.coveredSkills,
      missingSkills: result.missingSkills,
      missingRoles: result.missingRoles,
      violations: result.violations,
    });
  }
  return alternatives;
}

function OrganizerChallengePicker({ title, subtitle, destination }) {
  const store = useStore();
  const user = currentUser(store);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setChallenges(isDemoOrganizer(user)
        ? store.challenges.map(demoChallengeRecord)
        : (await service.getOrganizerChallenges()).challenges);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load your challenges.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [user?.id, store.challenges]);
  return <>
    <PageHeader title={title} subtitle={subtitle}/>
    {loading ? <Card><p>Loading your challenges...</p></Card> : error ? <Card><p role="alert">{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card> : challenges.length ? <div className="grid grid-2">{challenges.map(challenge => <Card key={challenge.id}>
      <div className="row between"><Badge tone={challenge.status === 'PUBLISHED' ? 'green' : 'amber'}>{challenge.status}</Badge><span className="muted">{challenge.participantCount} participants</span></div>
      <h2 style={{marginTop:12}}>{challenge.title}</h2><p>{challenge.description}</p>
      <div className="row between"><span className="muted">Deadline {new Date(challenge.deadline).toLocaleDateString()}</span><Link className="btn btn-secondary" to={destination(challenge.id)}>Open</Link></div>
    </Card>)}</div> : <Card><h2>No challenges yet</h2><p>Create a challenge before managing participants or forming teams.</p><Link className="btn btn-primary" to="/organizer/challenges/new"><Plus size={14}/> Create challenge</Link></Card>}
  </>;
}

function Participants() {
  const { id } = useParams();
  const store = useStore();
  const user = currentUser(store);
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const load = async () => {
    if (!id) return;
    setLoading(true); setError(''); setData(null);
    try {
      if (isDemoOrganizer(user)) {
        const challenge = store.challenges.find(item => item.id === id);
        if (!challenge) throw new Error('Challenge not found in this demo workspace.');
        const participants = (challenge.participants || []).map(participantId => {
          const participant = store.users.find(item => item.id === participantId);
          if (!participant) return null;
          const team = store.teams.find(item => item.challengeId === id && item.approval !== 'Rejected' && item.members.includes(participantId));
          return {
            id: participant.id,
            name: participant.name,
            joinedAt: null,
            skills: participant.skills || [],
            team: team ? { id: team.id, name: team.name || `Team ${team.id.slice(-3)}`, status: team.approval } : null,
            available: !team,
          };
        }).filter(Boolean);
        setData({ challenge: { id: challenge.id, title: challenge.title }, participants });
      } else {
        setData(await service.getChallengeParticipants(id));
      }
    } catch (requestError) { setError(requestError.response?.data?.error?.message || requestError.message || 'Could not load challenge participants.'); } finally { setLoading(false); }
  };
  useEffect(() => { if (id) load(); else setLoading(false); }, [id, user?.id, store.challenges, store.teams]);
  if (!id) return <OrganizerChallengePicker title="Participants" subtitle="Choose one of your challenges to review its participants." destination={challengeId => `/organizer/challenges/${challengeId}/participants`}/>;
  if (error) return <Card><p>{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card>;
  if (loading || !data) return <Card><p>Loading participants...</p></Card>;
  const { challenge, participants } = data;
  return <><PageHeader title="Participants" subtitle={`${challenge.title} · ${participants.length} joined`}/>{participants.length === 0 ? <Card><h2>No students have joined yet</h2><p>Students who join this published challenge will appear here.</p></Card> : <Card>{participants.map(participant=><div className="list-item row between" key={participant.id}><div className="row"><div className="avatar">{initials(participant.name)}</div><div><b style={{fontSize:13}}>{participant.name}</b><p>{participant.skills.map(skill=>skill.name).join(' · ') || 'No skills added yet'}</p></div></div><div className="row"><Badge tone={participant.available?'green':'amber'}>{participant.available?'Available':'Unavailable'}</Badge>{participant.team ? <Badge tone="purple">{participant.team.name}</Badge> : <Badge tone="green">Available to team</Badge>}</div></div>)}</Card>}</>;
}
function TeamForgeStudio() {
  const { id } = useParams();
  const store = useStore();
  const user = currentUser(store);
  const [config, setConfig] = useState(null), [run, setRun] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [saving, setSaving] = useState(false), [teamName, setTeamName] = useState('TeamForge team');
  const load = async () => {
    if (!id) return;
    setLoading(true); setError(''); setConfig(null); setRun(null);
    try {
      if (isDemoOrganizer(user)) {
        const challenge = store.challenges.find(item => item.id === id);
        if (!challenge) throw new Error('Challenge not found in this demo workspace.');
        setConfig(challenge.formationConfig || {
          minTeamSize: challenge.teamSize,
          maxTeamSize: challenge.teamSize,
          requiredSkills: (challenge.requiredSkills || []).map(skill => ({ name: typeof skill === 'string' ? skill : skill.name, weight: 1 })),
          requiredRoles: challenge.roles || [],
          requiredWeeklyCapacity: 0,
          objectiveWeights: { skills: 0.55, roles: 0.2, availability: 0.25 },
        });
      } else {
        setConfig((await service.getFormationConfig(id)).config);
      }
    } catch (requestError) { setError(requestError.response?.data?.error?.message || requestError.message || 'Could not load formation configuration.'); } finally { setLoading(false); }
  };
  useEffect(() => { if (id) load(); else setLoading(false); }, [id, user?.id, store.challenges]);
  const updateSkill = (index, field, value) => setConfig(current => ({ ...current, requiredSkills: current.requiredSkills.map((skill, skillIndex) => skillIndex === index ? { ...skill, [field]: field === 'weight' ? Number(value) : value } : skill) }));
  const generate = async () => {
    setSaving(true); setError('');
    try {
      if (isDemoOrganizer(user)) {
        const challenge = store.challenges.find(item => item.id === id);
        if (!challenge) throw new Error('Challenge not found in this demo workspace.');
        if (config.minTeamSize > config.maxTeamSize) throw new Error('Maximum team size must be at least the minimum.');
        const alternatives = generateDemoFormationAlternatives(challenge, store, config);
        setRun({ id: `demo-run-${Date.now()}`, status: 'DRAFT', alternatives });
        toast.success(`${alternatives.length} local team arrangement${alternatives.length === 1 ? '' : 's'} generated.`);
      } else {
        const response = await service.generateFormationRun(id, config);
        setRun(response.run);
        toast.success(`${response.run.alternatives.length} feasible alternatives generated`);
      }
    } catch (requestError) { setError(requestError.response?.data?.error?.message || requestError.message || 'Could not generate alternatives.'); } finally { setSaving(false); }
  };
  const approve = async (alternative) => {
    setSaving(true);
    try {
      if (teamName.trim().length < 2) throw new Error('Enter a team name with at least 2 characters.');
      if (isDemoOrganizer(user)) {
        if (!alternative.feasible) throw new Error('Only feasible arrangements can be approved.');
        store.addTeam({
          challengeId: id,
          name: teamName.trim(),
          members: alternative.memberIds,
          approval: 'Approved',
          score: alternative.score,
          coveredSkills: alternative.coveredSkills,
          missingSkills: alternative.missingSkills,
        });
      } else {
        await service.approveFormationAlternative(run.id, { alternativeId: alternative.id, teamName });
      }
      toast.success('Team approved and saved.');
      setRun(current => ({ ...current, status: 'APPROVED' }));
    } catch (requestError) { toast.error(requestError.response?.data?.error?.message || requestError.message || 'Could not approve this team.'); } finally { setSaving(false); }
  };
  if (!id) return <OrganizerChallengePicker title="Adaptive TeamForge" subtitle="Choose a challenge to configure constraints and generate explainable team arrangements." destination={challengeId => `/organizer/challenges/${challengeId}/teamforge`}/>;
  if (error && !config) return <Card><p>{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card>;
  if (loading || !config) return <Card><p>Loading TeamForge configuration...</p></Card>;
  return <><PageHeader title="Adaptive TeamForge" subtitle="Generate explainable, constraint-checked team arrangements from registered participants." action={<Badge tone="amber">Human approval required</Badge>}/>{error && <Card style={{marginBottom:14}}><p role="alert">{error}</p></Card>}<div className="grid grid-2"><Card><h2>Formation constraints</h2><div className="grid grid-2"><Field label="Minimum team size"><FieldInput type="number" min="1" max="20" value={config.minTeamSize} onChange={e=>setConfig({...config,minTeamSize:Number(e.target.value)})}/></Field><Field label="Maximum team size"><FieldInput type="number" min="1" max="20" value={config.maxTeamSize} onChange={e=>setConfig({...config,maxTeamSize:Number(e.target.value)})}/></Field></div><Field label="Required weekly capacity"><FieldInput type="number" min="0" value={config.requiredWeeklyCapacity} onChange={e=>setConfig({...config,requiredWeeklyCapacity:Number(e.target.value)})}/></Field><h3>Weighted skills</h3>{config.requiredSkills.map((skill,index)=><div className="row" key={`${skill.name}-${index}`} style={{marginBottom:8}}><FieldInput value={skill.name} aria-label={`Skill ${index + 1}`} onChange={e=>updateSkill(index,'name',e.target.value)}/><FieldInput type="number" min="0.01" max="10" step="0.1" value={skill.weight} aria-label={`Weight for ${skill.name}`} onChange={e=>updateSkill(index,'weight',e.target.value)}/></div>)}<div className="row"><Button variant="secondary" onClick={()=>setConfig({...config,requiredSkills:[...config.requiredSkills,{name:'',weight:1}]})}><Plus size={14}/> Add skill</Button><Button onClick={async()=>{try{if(isDemoOrganizer(user)){if(config.minTeamSize>config.maxTeamSize)throw new Error('Maximum team size must be at least the minimum.');store.updateChallenge(id,{teamSize:config.maxTeamSize,requiredSkills:config.requiredSkills.map(skill=>skill.name.trim()).filter(Boolean),formationConfig:config});setRun(null);toast.success('Formation configuration saved.')}else{await service.updateFormationConfig(id,config);toast.success('Formation configuration saved.')}}catch(requestError){toast.error(requestError.response?.data?.error?.message||requestError.message||'Could not save configuration.')}}}>Save configuration</Button></div></Card><Card><h2>Generate alternatives</h2><p>{isDemoOrganizer(user)?'The local demo generator ranks registered participants by required-skill coverage.':'Only eligible challenge participants with persisted profiles and skills are considered. Identical input produces deterministic rankings.'}</p><Field label="Approved team name"><FieldInput value={teamName} onChange={e=>setTeamName(e.target.value)}/></Field><Button onClick={generate} disabled={saving}>{saving?'Generating...':<><Sparkles size={14}/> Generate alternatives</>}</Button>{run?.alternatives?.length===0&&<div className="empty">No feasible arrangement was found. Relax a hard constraint or add eligible participants.</div>}</Card></div>{run?.alternatives?.length>0&&<div style={{marginTop:14}}><PageHeader title="Candidate arrangements" subtitle="Scores are transparent comparisons, not guarantees of success."/><div className="grid grid-2">{run.alternatives.map(alternative=><Card key={alternative.id || alternative.rank}><div className="row between"><h2>Option {alternative.rank}</h2><Badge tone={alternative.feasible?'green':'red'}>{alternative.feasible?'Feasible':'Infeasible'}</Badge></div><div className="grid grid-3"><div><span className="muted">Score</span><div className="stat-value">{alternative.score}</div></div><div><span className="muted">Skills</span><div className="stat-value">{alternative.metrics?.skillCoverage ?? alternative.evaluation?.metrics?.skillCoverage}%</div></div><div><span className="muted">Availability</span><div className="stat-value">{alternative.metrics?.availabilityFit ?? alternative.evaluation?.metrics?.availabilityFit}%</div></div></div><p>Members: {alternative.memberIds.map(memberId=>store.users.find(member=>member.id===memberId)?.name||memberId).join(', ')}</p>{alternative.missingSkills?.length>0&&<p>Missing skills: {alternative.missingSkills.join(', ')}</p>}<Button disabled={saving || run.status==='APPROVED' || !alternative.feasible} onClick={()=>approve(alternative)}><Check size={14}/> Approve this arrangement</Button></Card>)}</div></div>}</>;
}
function Teams({ approved = false }) {
  const { id } = useParams();
  const store = useStore();
  const user = currentUser(store);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingTeamId, setSavingTeamId] = useState('');
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setTeams(isDemoOrganizer(user)
        ? store.teams.map(team => demoOrganizerTeam(team, store))
        : (await service.getOrganizerTeams()).teams);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load teams for your challenges.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id, user?.id, store.teams]);
  const reviewTeam = async (team, status) => {
    setSavingTeamId(team.id);
    setError('');
    try {
      const nextStatus = isDemoOrganizer(user)
        ? (status === 'APPROVED' ? 'Approved' : 'Rejected')
        : (await service.reviewOrganizerTeam(team.id, status)).team.status;
      if (isDemoOrganizer(user)) store.reviewTeam(team.id, nextStatus);
      setTeams(current => current.map(item => item.id === team.id ? { ...item, status } : item));
      toast.success(status === 'APPROVED' ? 'Team approved.' : 'Team rejected.');
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not update team status.');
    } finally {
      setSavingTeamId('');
    }
  };
  const visibleTeams = teams.filter(team =>
    (!id || team.challengeId === id) && (approved ? team.status === 'APPROVED' : ['FORMING', 'SUBMITTED'].includes(team.status))
  );
  if (loading) return <Card><p>Loading teams...</p></Card>;
  return <>
    <PageHeader title={approved ? 'Approved teams' : 'Teams'} subtitle={approved ? 'Teams approved for challenges you organize.' : 'Review team requests and keep every approval under organizer control.'} action={<Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>}/>
    {error && <Card style={{marginBottom:14}}><p role="alert">{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card>}
    {!approved && <Card style={{background:'#fff7ed',borderColor:'#fed7aa',marginBottom:14}}><b style={{fontSize:13}}>Organizer review</b><p>Only approve a team when its membership and challenge fit have been reviewed.</p></Card>}
    {visibleTeams.length === 0 ? <Card><h2>{approved ? 'No approved teams yet' : 'No teams need review'}</h2><p>{approved ? 'Approved teams will be listed here.' : 'Team submissions for your challenges will appear here.'}</p>{!id && <Link className="btn btn-secondary" to="/organizer/teamforge">Open Adaptive TeamForge</Link>}</Card> : <div className="grid grid-2">{visibleTeams.map(team => <Card key={team.id}>
      <div className="row between"><div><Badge tone={team.status === 'APPROVED' ? 'green' : team.status === 'REJECTED' ? 'red' : 'amber'}>{team.status}</Badge><h2 style={{marginTop:10}}>{team.name}</h2></div><span className="muted">{team.members.length} members</span></div>
      <p><Link className="accent" to={`/organizer/challenges/${team.challengeId}/participants`}>{team.challenge.title}</Link></p>
      <div className="list-item">{team.members.map(member => <div className="row between" key={member.id} style={{padding:'5px 0'}}><div className="row"><div className="avatar">{initials(member.name)}</div><span style={{fontSize:12}}>{member.name}</span></div><span className="muted">{member.skills.map(skill => skill.name).join(' · ') || 'No skills listed'}</span></div>)}</div>
      {['FORMING', 'SUBMITTED'].includes(team.status) && <div className="row" style={{marginTop:12}}><Button disabled={Boolean(savingTeamId)} onClick={() => reviewTeam(team, 'APPROVED')}><Check size={14}/>{savingTeamId === team.id ? 'Saving...' : 'Approve team'}</Button><Button variant="danger" disabled={Boolean(savingTeamId)} onClick={() => reviewTeam(team, 'REJECTED')}>{savingTeamId === team.id ? 'Saving...' : 'Reject'}</Button></div>}
    </Card>)}</div>}
  </>;
}
function Startup({ tab='overview' }) { const s=useStore(),st=s.startups[0], [feedback,setFeedback]=useState(''); if(tab==='feedback') return <><PageHeader title="Customer feedback" subtitle="Suggestions are hypotheses to test, not proof of business success." action={<Button onClick={()=>{const themes=analyzeFeedback(st.feedback);toast.success(`${themes.length} themes found`)}}><Sparkles size={14}/> Analyze with AI</Button>}/><div className="grid grid-2"><Card><h2>Add feedback</h2><Field label="Comment"><textarea className="textarea" value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="What did the customer say?"/></Field><Button onClick={()=>{if(feedback){s.addFeedback(st.id,{comment:feedback,source:'New interview',consent:true});setFeedback('');toast.success('Feedback saved')}}}>Save comment</Button></Card><Card><h2>Theme signals</h2>{analyzeFeedback(st.feedback).map(t=><div className="list-item" key={t.label}><div className="row between"><b style={{fontSize:13}}>{t.label}</b><Badge tone="purple">{t.frequency}</Badge></div><p>{t.summary}</p></div>)}</Card></div><Card style={{marginTop:14}}><h2>Source comments</h2>{st.feedback.map(f=><div className="list-item" key={f.id}><div className="row between"><span style={{fontSize:13}}>{f.comment}</span><Badge tone="green">Consent recorded</Badge></div><p>{f.source}</p></div>)}</Card></>; if(tab==='experiments') return <><PageHeader title="Hypotheses & experiments" subtitle="Make assumptions explicit and give them a measurable next step."/><Card>{st.experiments.map(x=><div className="list-item row between" key={x.id}><div><b style={{fontSize:13}}>{x.hypothesis}</b><p>{x.method} · {x.audience} · success: {x.metric}</p></div><Badge tone={x.status==='validated'?'green':x.status==='running'?'purple':'amber'}>{x.status}</Badge></div>)}</Card></>; if(tab==='metrics') return <><PageHeader title="Traction metrics" subtitle="A small, honest evidence base beats vanity metrics."/><Card><div style={{height:260}}><ResponsiveContainer><LineChart data={st.metrics}><CartesianGrid stroke="#eee"/><XAxis dataKey="week"/><YAxis/><Tooltip/><Line type="monotone" dataKey="signups" stroke="#6d4aff" strokeWidth={3}/><Line type="monotone" dataKey="repeat" stroke="#16a34a" strokeWidth={2}/></LineChart></ResponsiveContainer></div></Card></>; if(tab==='risks') return <><PageHeader title="Risk register" subtitle="Make uncertainty visible while there is still time to act."/><Card>{st.risks.map(r=><div className="list-item row between" key={r.id}><div><b style={{fontSize:13}}>{r.title}</b><p>Owner {r.owner} · {r.mitigation}</p></div><Badge tone="red">L{r.likelihood} · I{r.impact}</Badge></div>)}</Card></>; return <><PageHeader title={st.name} subtitle={st.problem} action={<Badge tone="purple">{st.stage}</Badge>}/><div className="grid grid-3"><StatCard label="Interviews" value="11" detail="8 this month" icon="Users"/><StatCard label="Sign-ups" value="33" detail="+58% week over week" icon="BarChart3"/><StatCard label="Next experiment" value="Trust" detail="Verify condition photos" icon="Lightbulb"/></div><div className="grid grid-2" style={{marginTop:14}}><Card><h2>Suggested next step</h2><p>Run a 5-person test of verified condition photos and measure whether trust language increases checkout intent.</p><Link className="btn btn-primary" to="/startups/s1/experiments">Open experiments <ArrowRight size={14}/></Link></Card><Card><h2>Workspace</h2><div className="row" style={{flexWrap:'wrap'}}>{[['Experiments','experiments'],['Feedback','feedback'],['Metrics','metrics'],['Risks','risks']].map(x=><Link className="btn btn-secondary" to={`/startups/s1/${x[1]}`} key={x[1]}>{x[0]}</Link>)}</div></Card></div></> }
function Notifications() {
  const store = useStore();
  const user = currentUser(store);
  const navigate = useNavigate();
  const [serverNotifications, setServerNotifications] = useState([]);
  const [error, setError] = useState('');
  const notifications = useMemo(() => [
    ...store.notifications.filter(notification => notification.userId === user?.id),
    ...serverNotifications,
  ], [store.notifications, serverNotifications, user?.id]);
  const load = async () => {
    if (isDemoOrganizer(user)) {
      setServerNotifications([]);
      setError('');
      return;
    }
    try {
      const response = await service.getNotifications();
      setServerNotifications(response.notifications);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load notifications.');
    }
  };
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const openNotification = async notification => {
    try {
      if (!notification.read && notification.practiceTaskId) {
        await service.markNotificationRead(notification.id);
      } else if (!notification.read) {
        store.markNotificationRead(notification.id);
      }
      if (notification.practiceTaskId) {
        navigate(`/planner?task=${encodeURIComponent(notification.practiceTaskId)}`);
      } else {
        await load();
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not open this notification.');
    }
  };
  return <><PageHeader title="Notifications" subtitle="Invites, decisions, and scheduled skill-practice reminders."/><Card>{error && <p role="alert">{error}</p>}{notifications.length === 0 && !error && <p className="muted">No notifications yet. Generate a practice plan to schedule skill reminders.</p>}{notifications.map(notification => {const scheduled=notification.scheduledFor&&new Date(notification.scheduledFor)>new Date();return <div className="list-item row between" key={notification.id} style={{opacity:notification.read?.6:1}}><div className="row"><div className="avatar"><Bell size={14}/></div><div><b style={{fontSize:13}}>{notification.title}</b><p>{notification.body}</p><span className="muted">{scheduled?'Scheduled for ':''}{new Date(notification.scheduledFor || notification.createdAt).toLocaleString()}</span></div></div>{!scheduled&&(notification.practiceTaskId || !notification.read) && <Button variant="secondary" onClick={() => openNotification(notification)}>{notification.practiceTaskId ? 'Open practice' : 'Mark read'}</Button>}</div>})}</Card></>;
}
function Settings() {
  const store = useStore();
  const user = currentUser(store);
  const navigate = useNavigate();
  const [account, setAccount] = useState({ name: user?.name || '', email: user?.email || '' });
  useEffect(() => setAccount({ name: user?.name || '', email: user?.email || '' }), [user?.id, user?.name, user?.email]);
  const preferences = store.preferences || { showNotificationBadge: true };
  const saveAccount = event => {
    event.preventDefault();
    const name = account.name.trim();
    const email = account.email.trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a name and a valid email address.');
      return;
    }
    store.updateProfile({ name, email });
    toast.success('Account details saved on this device.');
  };
  const demoAccount = user?.email?.endsWith('@skillmesh.demo');
  return <>
    <PageHeader title="Settings" subtitle="Manage your account, workspace preferences, and sign-in."/>
    <div className="grid grid-2">
      <Card><h2>Account</h2><form onSubmit={saveAccount}><Field label="Name"><FieldInput required value={account.name} onChange={event => setAccount(current => ({ ...current, name: event.target.value }))}/></Field><Field label="Email"><FieldInput required type="email" value={account.email} onChange={event => setAccount(current => ({ ...current, email: event.target.value }))}/></Field><Button type="submit">Save changes</Button><p className="muted">Account display details are saved in this browser.</p></form></Card>
      <Card><h2>Preferences</h2><div className="row between list-item"><span style={{fontSize:13}}>Theme</span><Button variant="secondary" onClick={store.toggleTheme}>{store.theme === 'light' ? <Moon size={14}/> : <Sun size={14}/>} {store.theme}</Button></div><label className="row between list-item"><span style={{fontSize:13}}>Show unread notification count in header</span><input type="checkbox" checked={preferences.showNotificationBadge !== false} onChange={event => store.updatePreferences({ showNotificationBadge: event.target.checked })}/></label><div className="list-item"><div className="row between"><span style={{fontSize:13}}>Email delivery</span><Badge>Not configured</Badge></div><p className="muted">In-app notifications remain available from the Notifications page.</p></div></Card>
    </div>
    <Card style={{marginTop:14}}><h2>Session</h2>{demoAccount && <><p>Demo data is stored locally in this browser. Reset restores the fictional seed data.</p><Button variant="secondary" onClick={() => { store.resetDemo(); toast.success('Demo data reset'); }}>Reset demo data</Button></>}<div style={{marginTop:12}}><Button variant="danger" onClick={() => { store.logout(); navigate('/login'); }}><LogOut size={14}/> Log out</Button></div></Card>
  </>;
}
function SimpleGuard({ roles, children }) { const s=useStore(),u=currentUser(s); if(!u)return <Navigate to="/login"/>; if(roles&&!roles.includes(u.role))return <Page><PageHeader title="403 · Access restricted" subtitle="This workspace is available to another role."/></Page>; return children; }
function Page({children}) { return <Shell>{children}</Shell>; }
function StudentProfileRoute() { const { id } = useParams(); return <Page><Profile viewId={id}/></Page>; }
function StartupRoute() { const { tab } = useParams(); return <Page><Startup tab={tab}/></Page>; }
function App() { return <Routes><Route path="/" element={<Landing/>}/><Route path="/login" element={<Auth/>}/><Route path="/register" element={<Auth register/>}/><Route path="/dashboard" element={<SimpleGuard roles={['student','organizer','mentor']}><Page><Dashboard/></Page></SimpleGuard>}/><Route path="/profile" element={<SimpleGuard roles={['student']}><Page><Profile/></Page></SimpleGuard>}/><Route path="/students/:id" element={<SimpleGuard roles={['student','organizer']}><StudentProfileRoute/></SimpleGuard>}/><Route path="/goals" element={<SimpleGuard roles={['student']}><Page><Goals/></Page></SimpleGuard>}/><Route path="/activities" element={<SimpleGuard roles={['student']}><Page><Activities/></Page></SimpleGuard>}/><Route path="/deadlines" element={<SimpleGuard roles={['student']}><Page><Deadlines/></Page></SimpleGuard>}/><Route path="/planner" element={<SimpleGuard roles={['student']}><Page><Planner/></Page></SimpleGuard>}/><Route path="/challenges" element={<SimpleGuard roles={['student']}><Page><Challenges/></Page></SimpleGuard>}/><Route path="/challenges/:id" element={<SimpleGuard roles={['student']}><Page><ChallengeDetail/></Page></SimpleGuard>}/><Route path="/challenges/:id/find-teammates" element={<SimpleGuard roles={['student']}><Page><FindTeammates/></Page></SimpleGuard>}/><Route path="/challenges/:id/my-team" element={<SimpleGuard roles={['student']}><Page><Hackathons/></Page></SimpleGuard>}/><Route path="/invitations" element={<SimpleGuard roles={['student']}><Page><Invitations/></Page></SimpleGuard>}/><Route path="/hackathons" element={<SimpleGuard roles={['student']}><Page><Hackathons/></Page></SimpleGuard>}/><Route path="/projects" element={<SimpleGuard roles={['student','mentor']}><Page><Projects/></Page></SimpleGuard>}/><Route path="/projects/:id" element={<SimpleGuard roles={['student','mentor']}><Page><ProjectDetail/></Page></SimpleGuard>}/><Route path="/startups/:id" element={<SimpleGuard roles={['student','mentor']}><Page><Startup/></Page></SimpleGuard>}/><Route path="/startups/:id/:tab" element={<SimpleGuard roles={['student','mentor']}><StartupRoute/></SimpleGuard>}/><Route path="/notifications" element={<SimpleGuard roles={['student','organizer','mentor']}><Page><Notifications/></Page></SimpleGuard>}/><Route path="/settings" element={<SimpleGuard roles={['student','organizer','mentor']}><Page><Settings/></Page></SimpleGuard>}/><Route path="/organizer" element={<SimpleGuard roles={['organizer']}><Page><Organizer/></Page></SimpleGuard>}/><Route path="/organizer/challenges" element={<SimpleGuard roles={['organizer']}><Page><OrganizerChallenges/></Page></SimpleGuard>}/><Route path="/organizer/challenges/new" element={<SimpleGuard roles={['organizer']}><Page><ChallengeEditor/></Page></SimpleGuard>}/><Route path="/organizer/challenges/:id/edit" element={<SimpleGuard roles={['organizer']}><Page><ChallengeEditor/></Page></SimpleGuard>}/><Route path="/organizer/participants" element={<SimpleGuard roles={['organizer']}><Page><Participants/></Page></SimpleGuard>}/><Route path="/organizer/teams" element={<SimpleGuard roles={['organizer']}><Page><Teams/></Page></SimpleGuard>}/><Route path="/organizer/teamforge" element={<SimpleGuard roles={['organizer']}><Page><TeamForgeStudio/></Page></SimpleGuard>}/><Route path="/organizer/approved" element={<SimpleGuard roles={['organizer']}><Page><Teams approved/></Page></SimpleGuard>}/><Route path="/organizer/challenges/:id/participants" element={<SimpleGuard roles={['organizer']}><Page><Participants/></Page></SimpleGuard>}/><Route path="/organizer/challenges/:id/teams" element={<SimpleGuard roles={['organizer']}><Page><Teams/></Page></SimpleGuard>}/><Route path="/organizer/challenges/:id/teamforge" element={<SimpleGuard roles={['organizer']}><Page><TeamForgeStudio/></Page></SimpleGuard>}/><Route path="/organizer/challenges/:id/approved" element={<SimpleGuard roles={['organizer']}><Page><Teams approved/></Page></SimpleGuard>}/><Route path="/mentor" element={<SimpleGuard roles={['mentor']}><Page><Organizer/></Page></SimpleGuard>}/><Route path="*" element={<Page><PageHeader title="404 · Page not found" subtitle="Try a workspace link from the sidebar."/></Page>}/></Routes> }

export default App;
