import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, NavLink, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowRight, BarChart3, Bell, BookOpen, CalendarDays, Check, ChevronRight, CircleUserRound, ClipboardList, Code2, ExternalLink, Github, Goal, GraduationCap, LayoutDashboard, Lightbulb, LogOut, Menu, Moon, Network, Plus, Rocket, Search, Settings as SettingsIcon, ShieldCheck, Sparkles, Sun, Target, Users, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useStore, currentUser, scoreFor } from './store/useStore';
import { analyzeFeedback } from './lib/feedbackThemes';
import { planTasks } from './lib/planner';
import { scoreTeam } from './lib/teamScoring';
import { service } from "./services/api";

const Icon = ({ name, size = 16 }) => { const C = { LayoutDashboard, CircleUserRound, Goal, Activity, CalendarDays, Sparkles, Target, Users, ClipboardList, Rocket, Bell, SettingsIcon, GraduationCap, BookOpen, Network, BarChart3, Code2, ShieldCheck, Lightbulb, Search, Menu, Moon, Sun, LogOut, Github, ExternalLink, Plus, ArrowRight, Check, ChevronRight }[name] || Sparkles; return <C size={size} strokeWidth={1.8} />; };
const initials = n => n?.split(' ').map(x => x[0]).join('').slice(0, 2);
function Button({ children, variant = 'primary', ...p }) { return <button className={`btn btn-${variant}`} {...p}>{children}</button>; }
function Card({ children, className = '' }) { return <div className={`card ${className}`}>{children}</div>; }
function PageHeader({ title, subtitle, action }) { return <div className="page-title"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="row">{action}</div>}</div>; }
function Badge({ children, tone = '' }) { return <span className={`badge ${tone ? `badge-${tone}` : ''}`}>{children}</span>; }
function ScoreBadge({ user }) { const s = scoreFor(user); return <Badge tone={s.tier === 'Pro' ? 'purple' : s.tier === 'Contributor' ? 'green' : 'amber'}>{s.total} · {s.tier}</Badge>; }
function StatCard({ label, value, detail, icon }) { return <Card><div className="row between"><span className="stat-label">{label}</span><span className="accent"><Icon name={icon} /></span></div><div className="stat-value">{value}</div><div className="muted">{detail}</div></Card>; }
function Field({ label, children }) { return <div className="field"><label className="label">{label}</label>{children}</div>; }
const FieldInput = p => <input className="input" {...p} />;

const studentNav = [['Dashboard','/dashboard','LayoutDashboard'],['Profile','/profile','CircleUserRound'],['Goals','/goals','Goal'],['Activity Log','/activities','Activity'],['Deadlines','/deadlines','CalendarDays'],['AI Action Plan','/planner','Sparkles'],['Challenges','/challenges','Target'],['Find Teammates','/challenges','Users'],['Invitations','/invitations','Users'],['My Hackathons','/hackathons','Trophy'],['Projects','/projects','ClipboardList'],['Startup','/startups/s1','Rocket'],['Notifications','/notifications','Bell'],['Settings','/settings','SettingsIcon']];
const organizerNav = [['Dashboard','/organizer','LayoutDashboard'],['Challenges','/organizer/challenges','Target'],['Create Challenge','/organizer/challenges/new','Plus'],['Participants','/organizer/challenges/c1/participants','Users'],['Teams','/organizer/challenges/c1/teams','Network'],['Adaptive Formation','/organizer/challenges/c1/teamforge','Sparkles'],['Approved Teams','/organizer/challenges/c1/approved','ShieldCheck'],['Notifications','/notifications','Bell'],['Settings','/settings','SettingsIcon']];
const mentorNav = [['Dashboard','/mentor','LayoutDashboard'],['Projects & Startups','/projects','Rocket'],['Notifications','/notifications','Bell'],['Settings','/settings','SettingsIcon']];

function Shell({ children }) {
  const s = useStore(), user = currentUser(s), location = useLocation(), navigate = useNavigate();
  const nav = user?.role === 'organizer' ? organizerNav : user?.role === 'mentor' ? mentorNav : studentNav;
  useEffect(() => { document.documentElement.classList.toggle('dark', s.theme === 'dark'); }, [s.theme]);
  if (!user) return <Navigate to="/login" replace />;
  return <div className="app"><div className="shell"><aside className="sidebar"><Link className="brand" to="/dashboard"><span className="brand-mark">S</span><span>SkillMesh</span></Link><div className="nav-label">{user.role} workspace</div><nav>{nav.map(([label, to, icon]) => <NavLink key={to} className="nav-link" to={to}><Icon name={icon}/><span>{label}</span>{label === 'Invitations' && <Badge tone="red">{s.invitations.filter(i => i.receiverId === user.id && i.status === 'Pending').length}</Badge>}</NavLink>)}</nav><div style={{marginTop:'auto'}}><button className="nav-link" onClick={() => {s.logout();navigate('/login')}}><Icon name="LogOut"/><span>Log out</span></button></div></aside><main className="main"><header className="topbar"><div className="row"><Menu className="accent" size={18}/><span className="muted">{location.pathname === '/' ? 'Home' : location.pathname.split('/').filter(Boolean).join(' / ')}</span></div><div className="row"><div className="row" style={{background:'#f5f5f4',borderRadius:8,padding:'6px 9px'}}><Search size={14}/><input aria-label="Search" placeholder="Search workspace" style={{border:0,outline:0,background:'transparent',width:150,fontSize:12}}/></div><button className="btn btn-secondary" aria-label="Toggle theme" onClick={s.toggleTheme}>{s.theme === 'light' ? <Moon size={15}/> : <Sun size={15}/>}</button><Link to="/notifications" className="nav-link" style={{padding:7}}><Bell size={17}/><Badge tone="red">2</Badge></Link><div className="row"><div className="avatar">{initials(user.name)}</div><span className="muted">{user.name.split(' ')[0]}</span></div></div></header><div className="content">{children}</div></main></div></div>;
}

function Landing() { return <div className="login-wrap" style={{display:'block'}}><div className="content"><div className="brand"><span className="brand-mark">S</span> SkillMesh</div><section className="hero"><Badge tone="purple">Student growth, team formation, delivery</Badge><h1>Turn your learning momentum into <span className="accent">real outcomes.</span></h1><p>SkillMesh connects the signals that matter — practice, projects, people, and experiments — so every next step is clear and human-approved.</p><div className="row"><Link className="btn btn-primary" to="/login">Explore the demo <ArrowRight size={15}/></Link><Link className="btn btn-secondary" to="/register">Create account</Link></div></section><div className="grid grid-3"><Card><Sparkles className="accent"/><h2 style={{marginTop:12}}>StudentOS AI</h2><p>See your Builder Score as a transparent signal, then turn goals and deadlines into practical actions.</p></Card><Card><Users className="accent"/><h2 style={{marginTop:12}}>TeamForge</h2><p>Find complementary teammates with explainable recommendations and hard human approval gates.</p></Card><Card><Rocket className="accent"/><h2 style={{marginTop:12}}>VentureTrack</h2><p>Move from project evidence to customer conversations, experiments, and traction without losing context.</p></Card></div><Card className="grid grid-3" style={{marginTop:14, textAlign:'center'}}>{['Learn','Join challenge','Form team','Deliver project','Validate idea','Update records'].map((x,i)=><div key={x}><div className="avatar" style={{margin:'0 auto 8px'}}>{i+1}</div><b style={{fontSize:12}}>{x}</b></div>)}</Card></div></div> }

function Auth({ register = false }) {
  const s = useStore();
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
  });

  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    if (
      !form.email.trim() ||
      form.password.length < 6 ||
      (register && !form.name.trim())
    ) {
      return toast.error(
        "Enter the required details and a password of 6+ characters."
      );
    }

    setLoading(true);

    try {
      const response = register
        ? await service.register(form)
        : await service.login({
            email: form.email,
            password: form.password,
          });

      s.setAuthenticatedUser(response.user);

      toast.success(response.message);
      nav("/dashboard");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Unable to connect to SkillMesh. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <Card className="login-card">
        <Link className="brand" to="/">
          <span className="brand-mark">S</span>
          <span>SkillMesh</span>
        </Link>

        <h1>{register ? "Create your account" : "Welcome back"}</h1>

        <p>
          {register
            ? "Start building your learning graph."
            : "Sign in with your credentials."}
        </p>

        <form onSubmit={submit}>
          {register && (
            <Field label="Name">
              <FieldInput
                required
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                placeholder="Your name"
              />
            </Field>
          )}

          <Field label="Email">
            <FieldInput
              required
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password">
            <FieldInput
              required
              minLength={6}
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
              placeholder="6+ characters"
            />
          </Field>

          {register && (
            <Field label="Role">
              <select
                className="select"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value })
                }
              >
                <option value="student">Student</option>
                <option value="organizer">Organizer</option>
                <option value="mentor">Mentor</option>
              </select>
            </Field>
          )}

          <Button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading
              ? "Please wait..."
              : register
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>

        {!register && (
          <>
            <div
              className="muted"
              style={{ textAlign: "center", margin: "16px 0 8px" }}
            >
              Quick demo access
            </div>

            <div className="grid grid-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  s.login("aisha");
                  nav("/dashboard");
                }}
              >
                Student
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  s.login("organizer");
                  nav("/organizer");
                }}
              >
                Organizer
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  s.login("mentor");
                  nav("/mentor");
                }}
              >
                Mentor
              </Button>
            </div>
          </>
        )}

        <p style={{ textAlign: "center", marginTop: 18 }}>
          <Link
            className="accent"
            to={register ? "/login" : "/register"}
          >
            {register
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </Link>
        </p>
      </Card>
    </div>
  );
}
function Dashboard() { const s=useStore(),u=currentUser(s), score=scoreFor(u), goals=s.goals.filter(x=>x.userId===u.id), acts=s.activities.filter(x=>x.userId===u.id), joined=s.challenges.filter(c=>c.participants.includes(u.id)), pending=s.invitations.filter(i=>i.receiverId===u.id&&i.status==='Pending'); const chart=score.components.map(c=>({name:c.label.split(' ')[0],value:c.value})); return <><PageHeader title={`Good morning, ${u.name.split(' ')[0]}`} subtitle="Your growth graph is moving. Here’s the clearest next step." action={<Button><Plus size={14}/> Log progress</Button>}/><div className="grid grid-4"><StatCard label="Active goals" value={goals.length} detail="2 on track" icon="Goal"/><StatCard label="Tasks due this week" value="4" detail="1 high priority" icon="ClipboardList"/><StatCard label="Weekly study hours" value="8.5h" detail="+18% vs last week" icon="Activity"/><StatCard label="Skills count" value={u.skills.length} detail="3 with evidence" icon="Sparkles"/></div><div className="grid grid-2" style={{marginTop:14}}><Card><div className="row between"><div><h2>Builder Score</h2><p>A transparent signal, not a judgment of worth.</p></div><ScoreBadge user={u}/></div><div style={{height:210}}><ResponsiveContainer><RadarChart data={chart}><PolarGrid/><PolarAngleAxis dataKey="name" tick={{fontSize:10}}/><PolarRadiusAxis domain={[0,100]} tick={false}/><Radar dataKey="value" stroke="#6d4aff" fill="#6d4aff" fillOpacity=".28"/></RadarChart></ResponsiveContainer></div><div className="grid grid-2">{score.components.map(c=><div key={c.key}><div className="row between"><span className="muted">{c.label}</span><span className="muted">{c.notLinked?'Not linked':`${c.value}/100`}</span></div><div className="progress"><span style={{width:`${c.value}%`}}/></div></div>)}</div><p style={{marginTop:12}}><b>How to improve:</b> {score.tips[0] || 'Keep shipping evidence and reflecting weekly.'}</p></Card><Card><div className="row between"><h2>Weekly activity</h2><Badge tone="green">On track</Badge></div><div style={{height:210}}><ResponsiveContainer><BarChart data={[{d:'Mon',h:1.5},{d:'Tue',h:2},{d:'Wed',h:0.5},{d:'Thu',h:2.5},{d:'Fri',h:1},{d:'Sat',h:1},{d:'Sun',h:0}]}><CartesianGrid vertical={false} stroke="#eee"/><XAxis dataKey="d" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip/><Bar dataKey="h" fill="#8b76ff" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div><div className="list">{acts.slice(0,2).map(a=><div className="list-item row between" key={a.id}><div><b style={{fontSize:12}}>{a.type}</b><p>{a.notes}</p></div><span className="muted">{a.duration}m</span></div>)}</div></Card></div><div className="grid grid-2" style={{marginTop:14}}><Card><div className="row between"><h2>Today’s AI plan</h2><Link className="accent muted" to="/planner">View plan</Link></div>{planTasks([{title:'Practice two medium problems',duration:45,importance:80,urgency:90,effort:40},{title:'Polish onboarding flow',duration:60,importance:90,urgency:70,effort:50}],3).map(x=><div className="list-item row between" key={x.title}><div><b style={{fontSize:13}}>{x.title}</b><p>{x.reason}</p></div><Badge tone="purple">{x.duration}m</Badge></div>)}</Card><Card><div className="row between"><h2>My hackathons</h2><Link className="accent muted" to="/challenges">Browse</Link></div>{joined.map(c=><div className="list-item" key={c.id}><div className="row between"><b style={{fontSize:13}}>{c.title}</b><Badge tone="green">Joined</Badge></div><p>{c.requiredSkills.join(' · ')} · deadline {c.deadline}</p></div>)}{pending.length>0&&<p className="accent"><Bell size={13}/> {pending.length} pending invitation</p>}</Card></div></> }

function Profile({ viewId }) {
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
 return <><PageHeader title={own ? 'My profile' : u.name} subtitle="Make your strengths legible with evidence and context." action={own && <Button onClick={save}><Check size={14}/> Save changes</Button>}/><div className="grid grid-2"><Card><h2>About</h2>{own ? <><div className="grid grid-2"><Field label="Education"><FieldInput value={edit.education} onChange={e=>setEdit({...edit,education:e.target.value})}/></Field><Field label="Career goal"><FieldInput value={edit.careerGoal} onChange={e=>setEdit({...edit,careerGoal:e.target.value})}/></Field></div><Field label="Interests"><div className="row"><FieldInput value={interest} onChange={e=>setInterest(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addInterest())} placeholder="Add an interest"/><Button variant="secondary" onClick={addInterest}><Plus size={14}/></Button></div><div className="row" style={{flexWrap:'wrap',marginTop:7}}>{edit.interests.map(x=><button className="badge badge-purple" key={x} onClick={()=>setEdit({...edit,interests:edit.interests.filter(i=>i!==x)})}>{x} <X size={11}/></button>)}</div></Field><Field label="Preferred roles"><div className="row" style={{flexWrap:'wrap'}}>{roles.map(role=><label className="badge" key={role}><input type="checkbox" checked={edit.preferredRoles.includes(role)} onChange={e=>setEdit({...edit,preferredRoles:e.target.checked?[...edit.preferredRoles,role]:edit.preferredRoles.filter(x=>x!==role)})}/>{role}</label>)}</div></Field></> : <p>{u.education} � {u.careerGoal}</p>}<h2 style={{marginTop:18}}>Skills manager</h2>{own&&<><div className="grid grid-2"><Field label="Search dictionary or enter free text"><FieldInput list="skill-dictionary" value={skillName} onChange={e=>setSkillName(e.target.value)} placeholder="e.g. React"/><datalist id="skill-dictionary">{dictionary.map(x=><option key={x} value={x}/>)}</datalist></Field><Field label="Proficiency"><select className="select" value={skillLevel} onChange={e=>setSkillLevel(e.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></Field></div><div className="row"><FieldInput value={skillEvidence} onChange={e=>setSkillEvidence(e.target.value)} placeholder="Optional evidence URL"/><Button onClick={addSkill}><Plus size={14}/> Add skill</Button></div></>}{(u.skills||[]).map(x=><div className="list-item row between" key={x.name}><div><b style={{fontSize:13}}>{x.name}</b><p>{x.level}{x.evidence?` � ${x.evidence}`:''}</p></div><div className="row">{x.evidence&&<Badge tone="green"><ShieldCheck size={12}/> Verified</Badge>}{own&&<Button variant="danger" onClick={()=>setConfirmRemove(x.name)}>Remove</Button>}</div></div>)}{confirmRemove&&<div className="row" style={{marginTop:10}}><span style={{fontSize:12}}>Remove {confirmRemove}?</span><Button variant="danger" onClick={()=>{s.removeSkill(confirmRemove);setConfirmRemove(null);toast.success('Skill removed; score updated')}}>Confirm</Button><Button variant="secondary" onClick={()=>setConfirmRemove(null)}>Cancel</Button></div>}</Card><Card><div className="row between"><div><h2>Builder Score</h2><p>A transparent signal, not a judgment of worth; never the only factor.</p></div><ScoreBadge user={u}/></div><div className="list" style={{marginTop:14}}>{score.components.map(c=><div key={c.key}><div className="row between"><span className="muted">{c.label} � {Math.round(c.weight*100)}%</span><span className="muted">{c.notLinked?'Not linked':`${c.value}/100`}</span></div><div className="progress"><span style={{width:`${c.value}%`}}/></div></div>)}</div><details style={{marginTop:14}}><summary className="muted">How is this calculated?</summary><p>Builder Score = 25% GitHub Activity + 30% Skill Strength + 20% Project Evidence + 15% Consistency + 10% Profile Quality.</p><p>Tiers: Starter 0�39, Builder 40�64, Contributor 65�84, Pro 85�100.</p></details><h3 style={{marginTop:16}}>How to improve</h3>{score.tips.slice(0,3).map(t=><p key={t}>� {t}</p>)}</Card></div><div className="grid grid-2" style={{marginTop:14}}><Card><div className="row between"><div className="row"><div className="avatar"><Github size={16}/></div><div><h2 style={{margin:0}}>GitHub</h2>{u.github&&<a className="accent" href={`https://github.com/${u.github.username}`} target="_blank" rel="noreferrer">@{u.github.username} <ExternalLink size={11}/></a>}</div></div><Badge tone={u.github?'green':'amber'}>{u.github?(u.github.verified?'Verified':'Unverified'):'Not linked'}</Badge></div>{u.github?<><div className="grid grid-3" style={{margin:'16px 0'}}><div><span className="muted">Repos</span><div className="stat-value">{u.github.repos}</div></div><div><span className="muted">Stars</span><div className="stat-value">{u.github.stars}</div></div><div><span className="muted">Commits</span><div className="stat-value">{u.github.commits}</div></div></div><div style={{height:70}}><ResponsiveContainer><LineChart data={(u.github.activity||[]).map((value,i)=>({i,value}))}><Line type="monotone" dataKey="value" stroke="#6d4aff" strokeWidth={3} dot={false}/><Tooltip/></LineChart></ResponsiveContainer></div><div className="row" style={{flexWrap:'wrap'}}>{(u.github.topLanguages||[]).map(x=><Badge tone="purple" key={x}>{x}</Badge>)}</div><div className="row between" style={{marginTop:16}}><span className="muted">Last synced: {u.github.lastSynced||'Not yet'}</span><div className="row"><Button variant="secondary" onClick={refresh} disabled={refreshing}>{refreshing?'Refreshing�':'Refresh'}</Button><Button variant="secondary" onClick={()=>setLink(u.github.username)}>Edit</Button><Button variant="danger" onClick={()=>{s.saveLinks({github:null});toast.success('GitHub unlinked')}}>Unlink</Button></div></div></>:<><p>Link GitHub to enrich your score with real activity.</p><Field label="Username or profile URL"><FieldInput value={link} onChange={e=>{setLink(e.target.value);setLinkError('')}} placeholder="github.com/username"/></Field>{linkError&&<p style={{color:'#b91c1c'}}>{linkError}</p>}<Button onClick={saveGitHub}>Link GitHub</Button></>}</Card><Card><h2>Profile evidence</h2><p>Project evidence, activity consistency, and profile completeness contribute to the score. Keep your profile current and attach evidence links to skills.</p><div className="row" style={{flexWrap:'wrap',marginTop:12}}>{(u.interests||[]).map(x=><Badge tone="purple" key={x}>{x}</Badge>)}</div></Card></div><Card style={{marginTop:14}}><h2>Weekly availability</h2><div className="grid grid-4">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div className="row" key={d}><span style={{width:28,fontSize:11}}>{d}</span>{['AM','PM','Eve'].map(t=><Badge key={t} tone={d==='Tue'||t==='Eve'?'purple':''}>{t}</Badge>)}</div>)}</div></Card></>;
}
function Goals() { const s=useStore(),u=currentUser(s),[title,setTitle]=useState('');return <><PageHeader title="Goals" subtitle="Turn intent into visible momentum." action={<div className="row"><FieldInput value={title} onChange={e=>setTitle(e.target.value)} placeholder="New goal title"/><Button onClick={()=>{if(title){s.addGoal({title,targetDate:'2026-11-15',priority:'Medium',status:'In progress'});setTitle('');toast.success('Goal added')}}}><Plus size={14}/> Add</Button></div>}/><div className="grid grid-3">{s.goals.filter(x=>x.userId===u.id).map(g=><Card key={g.id}><div className="row between"><Badge tone={g.priority==='High'?'red':'purple'}>{g.priority}</Badge><span className="muted">{g.targetDate}</span></div><h2 style={{marginTop:14}}>{g.title}</h2><div className="progress"><span style={{width:`${g.progress}%`}}/></div><div className="row between" style={{marginTop:8}}><span className="muted">{g.status}</span><b style={{fontSize:12}}>{g.progress}%</b></div></Card>)}</div></> }
function Activities() { const s=useStore(),u=currentUser(s),[type,setType]=useState('coding'),[duration,setDuration]=useState(45);return <><PageHeader title="Activity log" subtitle="Consistency beats intensity. Keep the record honest."/><div className="grid grid-3"><Card><h2>Log activity</h2><Field label="Type"><select className="select" value={type} onChange={e=>setType(e.target.value)}><option>coding</option><option>course</option><option>project</option><option>practice</option></select></Field><Field label="Duration (minutes)"><FieldInput type="number" value={duration} onChange={e=>setDuration(e.target.value)}/></Field><Button onClick={()=>{s.addActivity({type,duration:Number(duration),date:'2026-10-15',notes:'Focused practice session'});toast.success('Activity logged')}}><Plus size={14}/> Save activity</Button></Card><Card><h2>Consistency</h2><div className="stat-value">8 day streak</div><p>Weekly total 8.5 hours · 86% consistency</p><div className="progress"><span style={{width:'72%'}}/></div></Card><Card><h2>Weekly hours</h2><div style={{height:130}}><ResponsiveContainer><BarChart data={[{d:'M',h:1.5},{d:'T',h:2},{d:'W',h:.5},{d:'T',h:2.5},{d:'F',h:1}]}><XAxis dataKey="d"/><Bar dataKey="h" fill="#6d4aff"/></BarChart></ResponsiveContainer></div></Card></div><Card style={{marginTop:14}}><h2>Recent activity</h2>{s.activities.filter(x=>x.userId===u.id).map(a=><div className="list-item row between" key={a.id}><div><Badge tone="purple">{a.type}</Badge><span style={{marginLeft:10,fontSize:13}}>{a.notes}</span></div><span className="muted">{a.date} · {a.duration}m</span></div>)}</Card></> }
function Deadlines() { const s=useStore(),u=currentUser(s),[title,setTitle]=useState('');return <><PageHeader title="Deadlines" subtitle="See workload before it becomes a surprise." action={<Button onClick={()=>{if(title){s.addDeadline({title,date:'2026-11-20',effort:4,importance:'Medium'});setTitle('');toast.success('Deadline added')}}}><Plus size={14}/> Add deadline</Button>}/><div className="grid grid-2"><Card><h2>Workload heatmap</h2><div className="grid grid-4">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun','Next'].map((d,i)=><div key={d} style={{padding:18,background:i===1||i===4?'#fed7aa':'#dcfce7',borderRadius:8,textAlign:'center',fontSize:12}}>{d}<br/><b>{i===1?8:i===4?6:2}h</b></div>)}</div></Card><Card><h2>Add a deadline</h2><Field label="Title"><FieldInput placeholder="Pitch deck review" value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Date"><FieldInput type="date" defaultValue="2026-11-20"/></Field><Field label="Estimated effort"><FieldInput placeholder="4 hours"/></Field></Card></div><Card style={{marginTop:14}}><h2>Upcoming</h2>{s.deadlines.filter(x=>x.userId===u.id).map(d=><div className="list-item row between" key={d.id}><div><b style={{fontSize:13}}>{d.title}</b><p>{d.importance} importance · {d.effort}h effort</p></div><Badge tone="amber">{d.date}</Badge></div>)}</Card></> }
function Planner() { const items=planTasks([{title:'Practice two medium problems',duration:45,urgency:90,importance:82,effort:40},{title:'Prepare sprint pitch',duration:60,urgency:80,importance:95,effort:55},{title:'Review accessibility checklist',duration:30,urgency:65,importance:70,effort:20}],3);return <><PageHeader title="AI action plan" subtitle="Planning assistance, not a guarantee." action={<Button variant="secondary">Regenerate plan</Button>}/><Card><div className="row between"><div><h2>Today’s focus</h2><p>3 hours available · 2h 15m planned</p></div><Badge tone="purple">75% fit</Badge></div><div className="progress" style={{margin:'12px 0'}}><span style={{width:'75%'}}/></div>{items.map(i=><div className="list-item row between" key={i.title}><div><div className="row"><b style={{fontSize:13}}>{i.title}</b><Badge tone="purple">{i.score} score</Badge></div><p>{i.reason}</p></div><Button variant="secondary">Accept</Button></div>)}</Card></> }

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
  const load = async () => {
    setLoading(true); setError('');
    try { setData(await service.getChallengeTeammates(id)); } catch (requestError) { setError(requestError.response?.data?.error?.message || 'Could not load teammates for this challenge.'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);
  if (loading) return <Card><p>Loading teammates...</p></Card>;
  if (error) return <Card><p>{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card>;
  const { challenge, candidates } = data;
  return <><PageHeader title="Find teammates" subtitle={`${candidates.length} registered participants available for ${challenge.title}.`} action={<Badge tone="amber">Human approval required</Badge>}/><Card style={{marginBottom:14}}><div className="row between"><div><h2>{challenge.title}</h2><p>Only students who joined this challenge appear here. Students already assigned to a team are excluded.</p></div><Badge tone="purple">Teams of {challenge.teamSize}</Badge></div><div className="row" style={{flexWrap:'wrap',marginTop:10}}>{challenge.requiredSkills.map(skill=><Badge key={skill.id}>{skill.name}</Badge>)}</div></Card>{candidates.length === 0 ? <Card><h2>No teammates available yet</h2><p>Other students must join this challenge and complete their profiles before they appear here.</p></Card> : <div className="grid grid-3">{candidates.map(candidate=><Card key={candidate.id}><div className="row"><div className="avatar">{initials(candidate.name)}</div><div><Link className="accent" to={`/students/${candidate.id}`}><b style={{fontSize:13}}>{candidate.name}</b></Link><p>{candidate.headline || 'Student participant'}</p></div></div><div className="row" style={{flexWrap:'wrap',margin:'13px 0'}}>{candidate.skills.slice(0,5).map(skill=><Badge key={skill.id}>{skill.name} · {skill.proficiency.toLowerCase()}</Badge>)}</div><div className="row between"><span className="muted">{candidate.available ? `${candidate.weeklyCapacity}h weekly capacity` : 'Currently unavailable'}</span><Badge tone={candidate.available ? 'green' : 'amber'}>{candidate.available ? 'Available' : 'Unavailable'}</Badge></div></Card>)}</div>}</>;
}

function Invitations() { const s=useStore(),u=currentUser(s), incoming=s.invitations.filter(i=>i.receiverId===u.id), getUser=id=>s.users.find(x=>x.id===id);return <><PageHeader title="Invitations" subtitle="Build teams with clear expectations and consent."/><div className="tabs"><button className="tab active">Received ({incoming.length})</button><button className="tab">Sent</button></div><div className="grid grid-2">{incoming.map(i=>{const from=getUser(i.senderId);return <Card key={i.id}><div className="row between"><div className="row"><div className="avatar">{initials(from?.name)}</div><div><b style={{fontSize:13}}>{from?.name}</b><p>{i.role} · {i.createdAt}</p></div></div><Badge tone={i.status==='Pending'?'amber':i.status==='Accepted'?'green':'red'}>{i.status === 'Accepted' ? 'Invitation accepted' : i.status}</Badge></div><p style={{margin:'14px 0'}}>{i.message}</p>{i.status==='Pending'&&<div className="row"><Button onClick={()=>{try { s.respondInvite(i.id,'Accepted'); toast.success('Invitation accepted'); } catch (error) { toast.error(error.message); }}}><Check size={14}/> Accept</Button><Button variant="secondary" onClick={()=>s.respondInvite(i.id,'Declined')}>Decline</Button></div>}</Card>})}</div></> }
function LegacyHackathons() { const s=useStore(),u=currentUser(s),teams=s.teams.filter(t=>t.members.includes(u.id));return <><PageHeader title="My hackathons" subtitle="Your active challenge commitments and team health."/><div className="grid grid-2">{s.challenges.filter(c=>c.participants.includes(u.id)).map(c=>{const t=teams.find(x=>x.challengeId===c.id);return <Card key={c.id}><div className="row between"><h2>{c.title}</h2><Badge tone={t?.approval==='Approved'?'green':'amber'}>{t?t.approval:'No team yet'}</Badge></div><p>Deadline {c.deadline} · team size {c.teamSize}</p>{t?<><div className="row" style={{margin:'14px 0'}}>{t.members.map(id=><div className="avatar" title={s.users.find(x=>x.id===id)?.name} key={id}>{initials(s.users.find(x=>x.id===id)?.name)}</div>)}</div><div className="row" style={{flexWrap:'wrap'}}>{(t.coveredSkills||c.requiredSkills.slice(0,2)).map(x=><Badge tone="green" key={x}>{x}</Badge>)}{(t.missingSkills||c.requiredSkills.slice(2)).map(x=><Badge tone="red" key={x}>{x}</Badge>)}</div></>:<Link className="btn btn-primary" to={`/challenges/${c.id}/find-teammates`} style={{marginTop:14}}>Find teammates</Link>}</Card>})}</div></> }

function Hackathons() {
  const [challenges, setChallenges] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { const response = await service.getPublishedChallenges(); setChallenges(response.challenges.filter(challenge => challenge.joined)); } catch (requestError) { setError(requestError.response?.data?.error?.message || 'Could not load your hackathons.'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  if (loading) return <Card><p>Loading your hackathons...</p></Card>;
  if (error) return <Card><p>{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card>;
  return <><PageHeader title="My hackathons" subtitle="Challenges you joined from the database."/><div className="grid grid-2">{challenges.length === 0 ? <Card><h2>No joined challenges yet</h2><p>Join a published challenge to see it here and find teammates for it.</p><Link className="btn btn-primary" to="/challenges" style={{marginTop:14}}>Browse challenges</Link></Card> : challenges.map(challenge=><Card key={challenge.id}><div className="row between"><h2>{challenge.title}</h2><Badge tone="green">Joined</Badge></div><p>{challenge.description}</p><p>Deadline {new Date(challenge.deadline).toLocaleDateString()} · teams of {challenge.teamSize}</p><div className="row" style={{flexWrap:'wrap',margin:'12px 0'}}>{challenge.requiredSkills.map(skill=><Badge key={skill.id}>{skill.name}</Badge>)}</div><Link className="btn btn-primary" to={`/challenges/${challenge.id}/find-teammates`}>Find teammates <Users size={14}/></Link></Card>)}</div></>;
}
function Projects() { const s=useStore();return <><PageHeader title="Projects" subtitle="Evidence grows when work is visible, shared, and shipped." action={<Button><Plus size={14}/> New project</Button>}/><div className="grid grid-3">{s.projects.map(p=><Card key={p.id}><div className="row between"><Badge tone="green">{p.status}</Badge><span className="muted">{p.progress}%</span></div><h2 style={{marginTop:14}}>{p.name}</h2><p>{p.description}</p><div className="progress" style={{margin:'14px 0'}}><span style={{width:`${p.progress}%`}}/></div><div className="row between"><span className="muted">{p.tasks.length} tasks · {p.members.length} members</span><Link className="btn btn-secondary" to={`/projects/${p.id}`}>Open</Link></div></Card>)}</div></> }
function ProjectDetail() { const {id}=useParams(),s=useStore(),p=s.projects.find(x=>x.id===id)||s.projects[0],cols=['To Do','In Progress','Review','Done'];return <><PageHeader title={p.name} subtitle={p.description} action={<Badge tone="green">{p.progress}% delivered</Badge>}/><div className="tabs"><button className="tab active">Tasks</button><button className="tab">Milestones</button><button className="tab">Members</button><button className="tab">Evidence</button></div><div className="grid grid-4">{cols.map(col=><Card key={col}><div className="row between"><h3>{col}</h3><Badge>{p.tasks.filter(t=>t.column===col).length}</Badge></div>{p.tasks.filter(t=>t.column===col).map(t=><div className="list-item" key={t.id}><div className="row between"><b style={{fontSize:12}}>{t.title}</b><Badge tone={t.priority==='High'?'red':''}>{t.priority}</Badge></div><p>{s.users.find(u=>u.id===t.assignee)?.name}</p><select className="select" value={t.column} onChange={e=>s.moveTask(p.id,t.id,e.target.value)} aria-label={`Move ${t.title}`}>{cols.map(c=><option key={c}>{c}</option>)}</select></div>)}</Card>)}</div><div className="grid grid-2" style={{marginTop:14}}><Card><h2>Milestones</h2>{p.milestones.map(m=><div className="list-item row between" key={m.id}><div><b style={{fontSize:13}}>{m.title}</b><p>{m.status}</p></div><Badge tone="purple">{m.progress}%</Badge></div>)}</Card><Card><h2>Evidence</h2>{p.evidence.map(e=><div className="list-item row between" key={e.id}><span>{e.label}</span><a className="accent" href={e.url} target="_blank" rel="noreferrer"><ExternalLink size={14}/></a></div>)}</Card></div></> }

function Organizer() { const s=useStore();return <><PageHeader title="Organizer dashboard" subtitle="Keep the challenge fair, explainable, and moving."/><div className="grid grid-4"><StatCard label="Active challenges" value={s.challenges.length} detail="All accepting teams" icon="Target"/><StatCard label="Participants" value={s.users.length} detail="+12 this week" icon="Users"/><StatCard label="Pending approvals" value={s.teams.filter(t=>t.approval!=='Approved').length} detail="Needs human review" icon="ShieldCheck"/><StatCard label="Unmatched pool" value="7" detail="Across challenges" icon="Network"/></div><Card style={{marginTop:14}}><h2>Recent activity</h2>{['Aisha joined Campus Innovation Lab','Ben sent an invitation','Team CampusCart was approved'].map((x,i)=><div className="list-item row between" key={x}><span style={{fontSize:13}}>{x}</span><span className="muted">{i+1}h ago</span></div>)}</Card></> }
function OrganizerChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await service.getOrganizerChallenges();
      setChallenges(response.challenges);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load your challenges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return <><PageHeader title="Challenges" subtitle="Design constraints that help people collaborate well." action={<Link className="btn btn-primary" to="/organizer/challenges/new"><Plus size={14}/> Create challenge</Link>}/>{loading ? <Card><p>Loading challenges...</p></Card> : error ? <Card><p>{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card> : challenges.length === 0 ? <Card><h2>No challenges yet</h2><p>Create your first challenge to start building a participant pool.</p></Card> : <div className="grid grid-3">{challenges.map(c => <Card key={c.id}><div className="row between"><Badge tone={c.status === 'PUBLISHED' ? 'green' : 'amber'}>{c.status.toLowerCase()}</Badge><span className="muted">{c.participantCount} participants</span></div><h2 style={{marginTop:12}}>{c.title}</h2><p>{c.description}</p><p className="muted">Teams of {c.teamSize} · deadline {new Date(c.deadline).toLocaleDateString()}</p><div className="row" style={{flexWrap:'wrap'}}>{c.requiredSkills.map(skill => <Badge key={skill.id}>{skill.name}</Badge>)}</div><div className="row"><Link className="btn btn-secondary" to={`/organizer/challenges/${c.id}/participants`}>Participants</Link>{c.status === 'PUBLISHED' && <Link className="btn btn-secondary" to={`/organizer/challenges/${c.id}/teams`}>Teams</Link>}</div></Card>)}</div>}</>;
}

function ChallengeEditor() {
  const [form, setForm] = useState({ title: '', description: '', deadline: '', teamSize: 4, requiredSkills: 'React, Data Analysis, Product' });
  const [saving, setSaving] = useState(false);

  const save = async (publish) => {
    const requiredSkills = form.requiredSkills.split(',').map(skill => skill.trim()).filter(Boolean);
    if (!form.title.trim() || !form.description.trim() || !form.deadline || requiredSkills.length === 0) {
      toast.error('Complete the title, description, deadline, and at least one required skill.');
      return;
    }
    setSaving(true);
    try {
      const response = await service.createChallenge({ ...form, teamSize: Number(form.teamSize), requiredSkills });
      if (publish) await service.publishChallenge(response.challenge.id);
      toast.success(publish ? 'Challenge published' : 'Challenge saved as draft');
    } catch (requestError) {
      toast.error(requestError.response?.data?.error?.message || 'Could not save the challenge.');
    } finally {
      setSaving(false);
    }
  };

  return <><PageHeader title="Create challenge" subtitle="Define the basics, then review before publishing." action={<div className="row"><Button variant="secondary" disabled={saving} onClick={() => save(false)}>Save draft</Button><Button disabled={saving} onClick={() => save(true)}>Publish</Button></div>}/><div className="grid grid-2"><Card><h2>Basics</h2><Field label="Challenge title"><FieldInput value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Climate Action Sprint"/></Field><Field label="Description"><textarea className="textarea" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe the problem and the audience." /></Field><div className="grid grid-2"><Field label="Deadline"><FieldInput type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/></Field><Field label="Team size"><FieldInput type="number" min="2" max="20" value={form.teamSize} onChange={e=>setForm({...form,teamSize:e.target.value})}/></Field></div></Card><Card><h2>Requirements</h2><Field label="Required skills (comma separated)"><FieldInput value={form.requiredSkills} onChange={e=>setForm({...form,requiredSkills:e.target.value})} placeholder="React, Product, Data Analysis"/></Field><div className="row" style={{flexWrap:'wrap',marginTop:12}}>{form.requiredSkills.split(',').map(skill=>skill.trim()).filter(Boolean).map(skill=><Badge tone="purple" key={skill}>{skill}</Badge>)}</div><h2 style={{marginTop:24}}>Review</h2><p>Drafts are private to the organizer. Publishing makes the challenge visible to students and eligible for registrations.</p></Card></div></>;
}
function Participants() { const {id}=useParams(),s=useStore(),c=s.challenges.find(x=>x.id===id)||s.challenges[0];return <><PageHeader title="Participants" subtitle={`${c.title} · ${c.participants.length} joined`}/><Card>{c.participants.map(id=>{const u=s.users.find(x=>x.id===id);return <div className="list-item row between" key={id}><div className="row"><div className="avatar">{initials(u?.name)}</div><div><b style={{fontSize:13}}>{u?.name}</b><p>{u?.skills.map(x=>x.name).join(' · ')}</p></div></div><div className="row"><ScoreBadge user={u}/><Badge tone="green">Joined</Badge></div></div>})}</Card></> }
function TeamForgeStudio() {
  const { id } = useParams();
  const [config, setConfig] = useState(null), [run, setRun] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [saving, setSaving] = useState(false), [teamName, setTeamName] = useState('TeamForge team');
  const load = async () => {
    setLoading(true); setError('');
    try { setConfig((await service.getFormationConfig(id)).config); } catch (requestError) { setError(requestError.response?.data?.error?.message || 'Could not load formation configuration.'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);
  const updateSkill = (index, field, value) => setConfig(current => ({ ...current, requiredSkills: current.requiredSkills.map((skill, skillIndex) => skillIndex === index ? { ...skill, [field]: field === 'weight' ? Number(value) : value } : skill) }));
  const generate = async () => {
    setSaving(true); setError('');
    try { const response = await service.generateFormationRun(id, config); setRun(response.run); toast.success(`${response.run.alternatives.length} feasible alternatives generated`); } catch (requestError) { setError(requestError.response?.data?.error?.message || 'Could not generate alternatives.'); } finally { setSaving(false); }
  };
  const approve = async (alternative) => {
    setSaving(true);
    try { await service.approveFormationAlternative(run.id, { alternativeId: alternative.id, teamName }); toast.success('Team approved and persisted.'); setRun(current => ({ ...current, status: 'APPROVED' })); } catch (requestError) { toast.error(requestError.response?.data?.error?.message || 'Could not approve this team.'); } finally { setSaving(false); }
  };
  if (loading) return <Card><p>Loading TeamForge configuration...</p></Card>;
  if (error && !config) return <Card><p>{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card>;
  return <><PageHeader title="Adaptive TeamForge" subtitle="Generate explainable, constraint-checked team arrangements from registered participants." action={<Badge tone="amber">Human approval required</Badge>}/>{error && <Card style={{marginBottom:14}}><p>{error}</p></Card>}<div className="grid grid-2"><Card><h2>Formation constraints</h2><div className="grid grid-2"><Field label="Minimum team size"><FieldInput type="number" min="1" max="20" value={config.minTeamSize} onChange={e=>setConfig({...config,minTeamSize:Number(e.target.value)})}/></Field><Field label="Maximum team size"><FieldInput type="number" min="1" max="20" value={config.maxTeamSize} onChange={e=>setConfig({...config,maxTeamSize:Number(e.target.value)})}/></Field></div><Field label="Required weekly capacity"><FieldInput type="number" min="0" value={config.requiredWeeklyCapacity} onChange={e=>setConfig({...config,requiredWeeklyCapacity:Number(e.target.value)})}/></Field><h3>Weighted skills</h3>{config.requiredSkills.map((skill,index)=><div className="row" key={`${skill.name}-${index}`} style={{marginBottom:8}}><FieldInput value={skill.name} aria-label={`Skill ${index + 1}`} onChange={e=>updateSkill(index,'name',e.target.value)}/><FieldInput type="number" min="0.01" max="10" step="0.1" value={skill.weight} aria-label={`Weight for ${skill.name}`} onChange={e=>updateSkill(index,'weight',e.target.value)}/></div>)}<div className="row"><Button variant="secondary" onClick={()=>setConfig({...config,requiredSkills:[...config.requiredSkills,{name:'',weight:1}]})}><Plus size={14}/> Add skill</Button><Button onClick={async()=>{try{await service.updateFormationConfig(id,config);toast.success('Formation configuration saved.')}catch(requestError){toast.error(requestError.response?.data?.error?.message||'Could not save configuration.')}}}>Save configuration</Button></div></Card><Card><h2>Generate alternatives</h2><p>Only eligible challenge participants with persisted profiles and skills are considered. Identical input produces deterministic rankings.</p><Field label="Approved team name"><FieldInput value={teamName} onChange={e=>setTeamName(e.target.value)}/></Field><Button onClick={generate} disabled={saving}>{saving?'Generating...':<><Sparkles size={14}/> Generate alternatives</>}</Button>{run?.alternatives?.length===0&&<div className="empty">No feasible arrangement was found. Relax a hard constraint or add eligible participants.</div>}</Card></div>{run?.alternatives?.length>0&&<div style={{marginTop:14}}><PageHeader title="Candidate arrangements" subtitle="Scores are transparent comparisons, not guarantees of success."/><div className="grid grid-2">{run.alternatives.map(alternative=><Card key={alternative.id || alternative.rank}><div className="row between"><h2>Option {alternative.rank}</h2><Badge tone={alternative.feasible?'green':'red'}>{alternative.feasible?'Feasible':'Infeasible'}</Badge></div><div className="grid grid-3"><div><span className="muted">Score</span><div className="stat-value">{alternative.score}</div></div><div><span className="muted">Skills</span><div className="stat-value">{alternative.metrics?.skillCoverage ?? alternative.evaluation?.metrics?.skillCoverage}%</div></div><div><span className="muted">Availability</span><div className="stat-value">{alternative.metrics?.availabilityFit ?? alternative.evaluation?.metrics?.availabilityFit}%</div></div></div><p>Members: {alternative.memberIds.join(', ')}</p>{alternative.missingSkills?.length>0&&<p>Missing skills: {alternative.missingSkills.join(', ')}</p>}<Button disabled={saving || run.status==='APPROVED'} onClick={()=>approve(alternative)}><Check size={14}/> Approve this arrangement</Button></Card>)}</div></div>}</>;
}
function Teams({ approved = false }) { const {id}=useParams(),s=useStore(),c=s.challenges.find(x=>x.id===id)||s.challenges[0], teams=s.teams.filter(t=>t.challengeId===c.id);return <><PageHeader title={approved?'Approved teams':'TeamForge'} subtitle={approved?'Teams cleared by a human organizer.':'Recommendations are signals — every team requires human approval.'} action={!approved&&<Button onClick={()=>toast.success('3 deterministic recommendations generated')}><Sparkles size={14}/> Generate recommendations</Button>}/>{!approved&&<div className="card" style={{background:'#fff7ed',borderColor:'#fed7aa',marginBottom:14}}><b style={{fontSize:13}}>Requires human approval</b><p>No team is final until approved.</p></div>}<div className="grid grid-2">{(approved?teams.filter(t=>t.approval==='Approved'):teams).map(t=>{const members=t.members.map(mid=>s.users.find(x=>x.id===mid)).filter(Boolean), result=scoreTeam(c,members);return <Card key={t.id}><div className="row between"><h2>Team {t.id.slice(-3)}</h2><Badge tone={t.approval==='Approved'?'green':'amber'}>{t.approval}</Badge></div><div className="row" style={{margin:'12px 0'}}>{members.map(m=><div className="row" key={m.id}><div className="avatar">{initials(m.name)}</div><span style={{fontSize:11}}>{m.name.split(' ')[0]}</span></div>)}</div><div className="grid grid-3"><div><span className="muted">Overall</span><div className="stat-value">{result.score}</div></div><div><span className="muted">Coverage</span><div className="stat-value">{result.breakdown.skillCoverage}%</div></div><div><span className="muted">Availability</span><div className="stat-value">{result.breakdown.availabilityFit}%</div></div></div><div className="row" style={{flexWrap:'wrap',margin:'10px 0'}}>{result.coveredSkills.map(x=><Badge tone="green" key={x}>{x}</Badge>)}{result.missingSkills.map(x=><Badge tone="red" key={x}>{x}</Badge>)}</div>{t.approval!=='Approved'&&<Button onClick={()=>{s.approveTeam(t.id);toast.success('Team approved')}}><Check size={14}/> Approve team</Button>}</Card>})}</div></> }
function Startup({ tab='overview' }) { const s=useStore(),st=s.startups[0], [feedback,setFeedback]=useState(''); if(tab==='feedback') return <><PageHeader title="Customer feedback" subtitle="Suggestions are hypotheses to test, not proof of business success." action={<Button onClick={()=>{const themes=analyzeFeedback(st.feedback);toast.success(`${themes.length} themes found`)}}><Sparkles size={14}/> Analyze with AI</Button>}/><div className="grid grid-2"><Card><h2>Add feedback</h2><Field label="Comment"><textarea className="textarea" value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="What did the customer say?"/></Field><Button onClick={()=>{if(feedback){s.addFeedback(st.id,{comment:feedback,source:'New interview',consent:true});setFeedback('');toast.success('Feedback saved')}}}>Save comment</Button></Card><Card><h2>Theme signals</h2>{analyzeFeedback(st.feedback).map(t=><div className="list-item" key={t.label}><div className="row between"><b style={{fontSize:13}}>{t.label}</b><Badge tone="purple">{t.frequency}</Badge></div><p>{t.summary}</p></div>)}</Card></div><Card style={{marginTop:14}}><h2>Source comments</h2>{st.feedback.map(f=><div className="list-item" key={f.id}><div className="row between"><span style={{fontSize:13}}>{f.comment}</span><Badge tone="green">Consent recorded</Badge></div><p>{f.source}</p></div>)}</Card></>; if(tab==='experiments') return <><PageHeader title="Hypotheses & experiments" subtitle="Make assumptions explicit and give them a measurable next step."/><Card>{st.experiments.map(x=><div className="list-item row between" key={x.id}><div><b style={{fontSize:13}}>{x.hypothesis}</b><p>{x.method} · {x.audience} · success: {x.metric}</p></div><Badge tone={x.status==='validated'?'green':x.status==='running'?'purple':'amber'}>{x.status}</Badge></div>)}</Card></>; if(tab==='metrics') return <><PageHeader title="Traction metrics" subtitle="A small, honest evidence base beats vanity metrics."/><Card><div style={{height:260}}><ResponsiveContainer><LineChart data={st.metrics}><CartesianGrid stroke="#eee"/><XAxis dataKey="week"/><YAxis/><Tooltip/><Line type="monotone" dataKey="signups" stroke="#6d4aff" strokeWidth={3}/><Line type="monotone" dataKey="repeat" stroke="#16a34a" strokeWidth={2}/></LineChart></ResponsiveContainer></div></Card></>; if(tab==='risks') return <><PageHeader title="Risk register" subtitle="Make uncertainty visible while there is still time to act."/><Card>{st.risks.map(r=><div className="list-item row between" key={r.id}><div><b style={{fontSize:13}}>{r.title}</b><p>Owner {r.owner} · {r.mitigation}</p></div><Badge tone="red">L{r.likelihood} · I{r.impact}</Badge></div>)}</Card></>; return <><PageHeader title={st.name} subtitle={st.problem} action={<Badge tone="purple">{st.stage}</Badge>}/><div className="grid grid-3"><StatCard label="Interviews" value="11" detail="8 this month" icon="Users"/><StatCard label="Sign-ups" value="33" detail="+58% week over week" icon="BarChart3"/><StatCard label="Next experiment" value="Trust" detail="Verify condition photos" icon="Lightbulb"/></div><div className="grid grid-2" style={{marginTop:14}}><Card><h2>Suggested next step</h2><p>Run a 5-person test of verified condition photos and measure whether trust language increases checkout intent.</p><Link className="btn btn-primary" to="/startups/s1/experiments">Open experiments <ArrowRight size={14}/></Link></Card><Card><h2>Workspace</h2><div className="row" style={{flexWrap:'wrap'}}>{[['Experiments','experiments'],['Feedback','feedback'],['Metrics','metrics'],['Risks','risks']].map(x=><Link className="btn btn-secondary" to={`/startups/s1/${x[1]}`} key={x[1]}>{x[0]}</Link>)}</div></Card></div></> }
function Notifications() { const s=useStore(),u=currentUser(s),ns=s.notifications.filter(n=>n.userId===u.id);return <><PageHeader title="Notifications" subtitle="Keep decisions, invites, and approvals in one place."/><Card>{ns.map(n=><div className="list-item row between" key={n.id} style={{opacity:n.read?.6:1}}><div className="row"><div className="avatar"><Bell size={14}/></div><div><b style={{fontSize:13}}>{n.title}</b><p>{n.body}</p></div></div>{!n.read&&<Button variant="secondary" onClick={()=>s.markNotificationRead(n.id)}>Mark read</Button>}</div>)}</Card></> }
function Settings() { const s=useStore(),u=currentUser(s),nav=useNavigate();return <><PageHeader title="Settings" subtitle="Control your account, preferences, and demo data."/><div className="grid grid-2"><Card><h2>Account</h2><Field label="Name"><FieldInput defaultValue={u.name}/></Field><Field label="Email"><FieldInput defaultValue={u.email}/></Field><Button onClick={()=>toast.success('Account details saved')}>Save changes</Button></Card><Card><h2>Preferences</h2><div className="row between list-item"><span style={{fontSize:13}}>Theme</span><Button variant="secondary" onClick={s.toggleTheme}>{s.theme==='light'?<Moon size={14}/>:<Sun size={14}/>} {s.theme}</Button></div><div className="row between list-item"><span style={{fontSize:13}}>Email notifications</span><Badge tone="green">Enabled</Badge></div><div className="row between list-item"><span style={{fontSize:13}}>Data visibility</span><Badge>Profile + score</Badge></div></Card></div><Card style={{marginTop:14}}><h2>Demo controls</h2><p>Reset restores the fictional seed data. No external account data is connected.</p><div className="row"><Button variant="secondary" onClick={()=>{s.resetDemo();toast.success('Demo data reset')}}>Reset demo data</Button><Button variant="danger" onClick={()=>{s.logout();nav('/login')}}><LogOut size={14}/> Log out</Button></div></Card></> }
function SimpleGuard({ roles, children }) { const s=useStore(),u=currentUser(s); if(!u)return <Navigate to="/login"/>; if(roles&&!roles.includes(u.role))return <Page><PageHeader title="403 · Access restricted" subtitle="This workspace is available to another role."/></Page>; return children; }
function Page({children}) { return <Shell>{children}</Shell>; }
function StudentProfileRoute() { const { id } = useParams(); return <Page><Profile viewId={id}/></Page>; }
function StartupRoute() { const { tab } = useParams(); return <Page><Startup tab={tab}/></Page>; }
function App() { return <Routes><Route path="/" element={<Landing/>}/><Route path="/login" element={<Auth/>}/><Route path="/register" element={<Auth register/>}/><Route path="/dashboard" element={<SimpleGuard roles={['student','organizer','mentor']}><Page><Dashboard/></Page></SimpleGuard>}/><Route path="/profile" element={<SimpleGuard roles={['student']}><Page><Profile/></Page></SimpleGuard>}/><Route path="/students/:id" element={<SimpleGuard roles={['student','organizer']}><StudentProfileRoute/></SimpleGuard>}/><Route path="/goals" element={<SimpleGuard roles={['student']}><Page><Goals/></Page></SimpleGuard>}/><Route path="/activities" element={<SimpleGuard roles={['student']}><Page><Activities/></Page></SimpleGuard>}/><Route path="/deadlines" element={<SimpleGuard roles={['student']}><Page><Deadlines/></Page></SimpleGuard>}/><Route path="/planner" element={<SimpleGuard roles={['student']}><Page><Planner/></Page></SimpleGuard>}/><Route path="/challenges" element={<SimpleGuard roles={['student']}><Page><Challenges/></Page></SimpleGuard>}/><Route path="/challenges/:id" element={<SimpleGuard roles={['student']}><Page><ChallengeDetail/></Page></SimpleGuard>}/><Route path="/challenges/:id/find-teammates" element={<SimpleGuard roles={['student']}><Page><FindTeammates/></Page></SimpleGuard>}/><Route path="/challenges/:id/my-team" element={<SimpleGuard roles={['student']}><Page><Hackathons/></Page></SimpleGuard>}/><Route path="/invitations" element={<SimpleGuard roles={['student']}><Page><Invitations/></Page></SimpleGuard>}/><Route path="/hackathons" element={<SimpleGuard roles={['student']}><Page><Hackathons/></Page></SimpleGuard>}/><Route path="/projects" element={<SimpleGuard roles={['student','mentor']}><Page><Projects/></Page></SimpleGuard>}/><Route path="/projects/:id" element={<SimpleGuard roles={['student','mentor']}><Page><ProjectDetail/></Page></SimpleGuard>}/><Route path="/startups/:id" element={<SimpleGuard roles={['student','mentor']}><Page><Startup/></Page></SimpleGuard>}/><Route path="/startups/:id/:tab" element={<SimpleGuard roles={['student','mentor']}><StartupRoute/></SimpleGuard>}/><Route path="/notifications" element={<SimpleGuard roles={['student','organizer','mentor']}><Page><Notifications/></Page></SimpleGuard>}/><Route path="/settings" element={<SimpleGuard roles={['student','organizer','mentor']}><Page><Settings/></Page></SimpleGuard>}/><Route path="/organizer" element={<SimpleGuard roles={['organizer']}><Page><Organizer/></Page></SimpleGuard>}/><Route path="/organizer/challenges" element={<SimpleGuard roles={['organizer']}><Page><OrganizerChallenges/></Page></SimpleGuard>}/><Route path="/organizer/challenges/new" element={<SimpleGuard roles={['organizer']}><Page><ChallengeEditor/></Page></SimpleGuard>}/><Route path="/organizer/challenges/:id/edit" element={<SimpleGuard roles={['organizer']}><Page><ChallengeEditor/></Page></SimpleGuard>}/><Route path="/organizer/challenges/:id/participants" element={<SimpleGuard roles={['organizer']}><Page><Participants/></Page></SimpleGuard>}/><Route path="/organizer/challenges/:id/teams" element={<SimpleGuard roles={['organizer']}><Page><Teams/></Page></SimpleGuard>}/><Route path="/organizer/challenges/:id/teamforge" element={<SimpleGuard roles={['organizer']}><Page><TeamForgeStudio/></Page></SimpleGuard>}/><Route path="/organizer/challenges/:id/approved" element={<SimpleGuard roles={['organizer']}><Page><Teams approved/></Page></SimpleGuard>}/><Route path="/mentor" element={<SimpleGuard roles={['mentor']}><Page><Organizer/></Page></SimpleGuard>}/><Route path="*" element={<Page><PageHeader title="404 · Page not found" subtitle="Try a workspace link from the sidebar."/></Page>}/></Routes> }

export default App;
