import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Circle, Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import { currentUser, useStore } from './store/useStore';
import { service } from './services/api';

const isDemo = user => user?.email?.endsWith('@skillmesh.demo');
const errorMessage = error => error.response?.data?.error?.message || error.message || 'The meeting action failed.';
const callWindowIsOpen = meeting => {
  const start = new Date(meeting.startsAt).getTime();
  const end = start + meeting.duration * 60 * 1000;
  return Date.now() >= start - 15 * 60 * 1000 && Date.now() <= end + 30 * 60 * 1000;
};

function MeetingVideo({ stream, label, muted = false, audioOnly = false }) {
  const mediaRef = useRef(null);
  useEffect(() => {
    if (mediaRef.current) mediaRef.current.srcObject = stream || null;
  }, [stream]);
  return <div className="meeting-video-tile">
    {audioOnly ? <audio ref={mediaRef} autoPlay muted={muted}/> : <video ref={mediaRef} autoPlay playsInline muted={muted}/>}
    {audioOnly && !stream && <div className="meeting-audio-placeholder"><Circle size={30}/></div>}
    <span className="meeting-video-label">{label}</span>
  </div>;
}

function meetingIceServers() {
  const configured = import.meta.env.VITE_WEBRTC_ICE_SERVERS;
  if (!configured) return [];
  try {
    const servers = JSON.parse(configured);
    if (!Array.isArray(servers)) throw new Error('VITE_WEBRTC_ICE_SERVERS must be a JSON array.');
    return servers;
  } catch (error) {
    throw new Error(`Invalid VITE_WEBRTC_ICE_SERVERS configuration: ${error.message}`);
  }
}

export default function MeetingRoom() {
  const { id } = useParams();
  const store = useStore();
  const user = currentUser(store);
  const demo = isDemo(user);
  const [meeting, setMeeting] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [callError, setCallError] = useState('');
  const [noteError, setNoteError] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('NOTE');
  const [mediaMode, setMediaMode] = useState('video');
  const [localStream, setLocalStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState({});
  const [inCall, setInCall] = useState(false);
  const [joining, setJoining] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const socketRef = useRef(null);
  const demoChannelRef = useRef(null);
  const notesChannelRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const mediaStreamRef = useRef(null);
  const inCallRef = useRef(false);
  const notesRef = useRef([]);

  const loadMeeting = useCallback(async () => {
    if (demo) {
      const session = store.mentorSessions.find(item => item.id === id);
      const isMentor = session?.mentorId === user.id && user.role === 'mentor';
      const booking = session?.bookings.find(item => item.student?.id === user.id);
      if (!session || session.status === 'CANCELLED' || (!isMentor && !booking)) {
        setMeeting(null);
        setNotes([]);
        setLoading(false);
        setCallError('This meeting is only available to its mentor and booked students.');
        return;
      }
      const bookings = session.bookings.filter(item => item.student?.id);
      const attendees = [
        { id: session.mentorId, name: store.users.find(item => item.id === session.mentorId)?.name || 'Mentor' },
        ...bookings.map(item => item.student),
      ];
      const document = {
        id: session.id,
        title: session.title,
        description: session.description,
        startsAt: session.startsAt,
        duration: session.duration,
        status: session.status,
        canJoin: session.status === 'OPEN' && callWindowIsOpen(session),
        isMentor,
        attendees,
      };
      setMeeting(document);
      setNotes(store.meetingNotes.filter(note => note.sessionId === id));
      setLoading(false);
      setCallError('');
      return;
    }

    try {
      const response = await service.getMentorMeeting(id);
      setMeeting(response.meeting);
      setNotes(response.meeting.notes);
      setLoading(false);
      setCallError('');
    } catch (error) {
      setLoading(false);
      setMeeting(null);
      setCallError(errorMessage(error));
    }
  }, [demo, id, store.meetingNotes, store.mentorSessions, store.users, user.id, user.role]);

  useEffect(() => {
    void loadMeeting();
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, [loadMeeting]);

  useEffect(() => {
    if (!demo) {
      const timer = window.setInterval(() => {
        void service.getMentorMeeting(id).then(response => {
          setMeeting(response.meeting);
          setNotes(response.meeting.notes);
        }).catch(error => setNoteError(errorMessage(error)));
      }, 5000);
      return () => window.clearInterval(timer);
    }
    return undefined;
  }, [demo, id]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const stopCall = useCallback(() => {
    inCallRef.current = false;
    setInCall(false);
    for (const connection of peerConnectionsRef.current.values()) connection.close();
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
    setRemotePeers({});
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (demoChannelRef.current) {
      demoChannelRef.current.postMessage({ type: 'peer-left', peerId: user.id });
      demoChannelRef.current.close();
      demoChannelRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      setLocalStream(null);
    }
  }, [user.id]);

  useEffect(() => () => stopCall(), [stopCall]);

  const sendSignal = useCallback((peerId, signal) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'signal', toUserId: peerId, signal }));
      return;
    }
    demoChannelRef.current?.postMessage({
      type: 'signal',
      toUserId: peerId,
      from: { id: user.id, name: user.name },
      signal,
    });
  }, [user.id, user.name]);

  const createPeerConnection = useCallback((peer, initiateOffer) => {
    const existing = peerConnectionsRef.current.get(peer.id);
    if (existing) return existing;
    const connection = new RTCPeerConnection({ iceServers: meetingIceServers() });
    peerConnectionsRef.current.set(peer.id, connection);
    for (const track of mediaStreamRef.current?.getTracks() || []) connection.addTrack(track, mediaStreamRef.current);
    connection.onicecandidate = event => {
      if (event.candidate) sendSignal(peer.id, { candidate: event.candidate.toJSON() });
    };
    connection.ontrack = event => {
      setRemotePeers(current => ({
        ...current,
        [peer.id]: { id: peer.id, name: peer.name, stream: event.streams[0] },
      }));
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'failed' || connection.connectionState === 'disconnected') {
        setRemotePeers(current => ({ ...current, [peer.id]: { ...current[peer.id], disconnected: true } }));
      }
    };
    setRemotePeers(current => ({ ...current, [peer.id]: { id: peer.id, name: peer.name, stream: null } }));
    if (initiateOffer) {
      void connection.createOffer()
        .then(offer => connection.setLocalDescription(offer))
        .then(() => sendSignal(peer.id, { description: connection.localDescription.toJSON() }))
        .catch(error => setCallError(`Could not connect to ${peer.name}: ${error.message}`));
    }
    return connection;
  }, [sendSignal]);

  const handleSignal = useCallback(async message => {
    if (message.toUserId && message.toUserId !== user.id) return;
    if (message.type === 'peer-joined' || (demo && message.type === 'hello')) {
      const peer = message.peer;
      if (!peer || peer.id === user.id || peer.role && !['MENTOR', 'STUDENT'].includes(peer.role)) return;
      createPeerConnection(peer, user.id.localeCompare(peer.id) < 0);
      if (demo) demoChannelRef.current?.postMessage({
        type: 'hello',
        toUserId: peer.id,
        peer: { id: user.id, name: user.name },
      });
      return;
    }
    if (message.type === 'peer-left') {
      const connection = peerConnectionsRef.current.get(message.peerId);
      connection?.close();
      peerConnectionsRef.current.delete(message.peerId);
      setRemotePeers(current => {
        const next = { ...current };
        delete next[message.peerId];
        return next;
      });
      return;
    }
    if (message.type === 'signal') {
      const from = message.from;
      if (!from || from.id === user.id) return;
      let connection = peerConnectionsRef.current.get(from.id);
      if (!connection) connection = createPeerConnection(from, false);
      try {
        if (message.signal.description) {
          await connection.setRemoteDescription(message.signal.description);
          const pendingCandidates = pendingCandidatesRef.current.get(from.id) || [];
          pendingCandidatesRef.current.delete(from.id);
          for (const candidate of pendingCandidates) await connection.addIceCandidate(candidate);
          if (message.signal.description.type === 'offer') {
            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);
            sendSignal(from.id, { description: connection.localDescription.toJSON() });
          }
        } else if (message.signal.candidate) {
          if (connection.remoteDescription) {
            await connection.addIceCandidate(message.signal.candidate);
          } else {
            const pendingCandidates = pendingCandidatesRef.current.get(from.id) || [];
            pendingCandidates.push(message.signal.candidate);
            pendingCandidatesRef.current.set(from.id, pendingCandidates);
          }
        }
      } catch (error) {
        setCallError(`Could not establish a connection with ${from.name}: ${error.message}`);
      }
      return;
    }
    if (message.type === 'error') {
      stopCall();
      setCallError(message.message);
    }
    if (message.type === 'joined') {
      for (const peer of message.peers) createPeerConnection(peer, user.id.localeCompare(peer.id) < 0);
      inCallRef.current = true;
      setInCall(true);
      setCallError('');
    }
  }, [createPeerConnection, demo, sendSignal, stopCall, user.id, user.name]);

  const joinCall = async () => {
    if (!meeting || !callWindowIsOpen(meeting)) {
      setCallError('The meeting room opens 15 minutes before its scheduled start.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCallError('This browser does not support microphone or camera access. Open SkillMesh over HTTPS or localhost in a supported browser.');
      return;
    }
    setJoining(true);
    setCallError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mediaMode === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      mediaStreamRef.current = stream;
      setLocalStream(stream);
      setMicrophoneEnabled(true);
      setCameraEnabled(mediaMode === 'video');
      if (demo) {
        if (!('BroadcastChannel' in window)) throw new Error('This browser does not support live demo meetings.');
        const channel = new BroadcastChannel(`skillmesh-meeting-${id}`);
        demoChannelRef.current = channel;
        channel.onmessage = event => { void handleSignal(event.data); };
        channel.postMessage({ type: 'hello', peer: { id: user.id, name: user.name } });
        inCallRef.current = true;
        setInCall(true);
      } else {
        const socket = new WebSocket(service.getMeetingSocketUrl());
        socketRef.current = socket;
        socket.onopen = () => socket.send(JSON.stringify({ type: 'join', sessionId: id }));
        socket.onmessage = event => {
          try {
            void handleSignal(JSON.parse(event.data));
          } catch (error) {
            setCallError(`Could not read the meeting update: ${error.message}`);
          }
        };
        socket.onerror = () => setCallError('Could not connect to meeting signaling. Check that the backend is running.');
        socket.onclose = () => {
          if (mediaStreamRef.current) {
            stopCall();
            setCallError('The meeting connection closed. Check the backend and try joining again.');
          }
        };
      }
    } catch (error) {
      setCallError(errorMessage(error));
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        setLocalStream(null);
      }
    } finally {
      setJoining(false);
    }
  };

  const saveNote = async event => {
    event.preventDefault();
    const content = noteText.trim();
    if (!content || !meeting) return;
    setNoteError('');
    try {
      if (demo) {
        const note = store.addMeetingNote(id, { content, type: noteType });
        setNotes(current => [...current, note]);
        notesChannelRef.current?.postMessage({ type: 'note-added', note });
      } else {
        const response = await service.createMeetingNote(id, { content, type: noteType });
        setNotes(current => [...current, response.note]);
      }
      setNoteText('');
    } catch (error) {
      setNoteError(errorMessage(error));
    }
  };

  const deleteNote = async note => {
    setNoteError('');
    try {
      if (demo) {
        store.removeMeetingNote(note.id);
        notesChannelRef.current?.postMessage({ type: 'note-deleted', noteId: note.id });
      } else await service.deleteMeetingNote(id, note.id);
      setNotes(current => current.filter(item => item.id !== note.id));
    } catch (error) {
      setNoteError(errorMessage(error));
    }
  };

  useEffect(() => {
    if (!demo || !meeting) return undefined;
    const channel = new BroadcastChannel(`skillmesh-meeting-notes-${id}`);
    notesChannelRef.current = channel;
    channel.onmessage = event => {
      if (event.data.type === 'note-added' && !notesRef.current.some(note => note.id === event.data.note.id)) {
        setNotes(current => [...current, event.data.note]);
      }
      if (event.data.type === 'note-deleted') setNotes(current => current.filter(note => note.id !== event.data.noteId));
    };
    return () => {
      channel.close();
      notesChannelRef.current = null;
    };
  }, [demo, id, meeting?.id]);

  const toggleMicrophone = () => {
    const track = mediaStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicrophoneEnabled(track.enabled);
  };
  const toggleCamera = () => {
    const track = mediaStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraEnabled(track.enabled);
  };
  const canJoin = meeting?.status === 'OPEN' && callWindowIsOpen(meeting);
  const secondsUntilOpen = meeting ? Math.max(0, new Date(meeting.startsAt).getTime() - 15 * 60 * 1000 - now) : 0;
  const mediaConfig = (() => {
    try { return meetingIceServers().length > 0; } catch { return false; }
  })();

  if (loading) return <div className="card"><p>Loading meeting room...</p></div>;
  if (!meeting) return <div className="card"><h1>Meeting unavailable</h1><p role="alert">{callError}</p><Link className="btn btn-secondary" to={user.role === 'mentor' ? '/mentor/sessions' : '/mentor-sessions'}>Back to sessions</Link></div>;

  return <div className="meeting-workspace">
    <header className="meeting-header">
      <div><Link className="meeting-back-link" to={user.role === 'mentor' ? '/mentor/sessions' : '/mentor-sessions'}>← Back to sessions</Link><h1>{meeting.title}</h1><p>{new Date(meeting.startsAt).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })} · {meeting.duration} min · {meeting.attendees.length} participants</p></div>
      <div className={`meeting-live-badge ${inCall || canJoin ? 'meeting-live-badge-open' : ''}`}><span/> {inCall ? 'In the meeting' : canJoin ? 'Room is open' : 'Scheduled meeting'}</div>
    </header>
    <div className="meeting-layout">
      <main className="meeting-call-panel">
        <div className="meeting-video-grid">
          {inCall && localStream && <MeetingVideo stream={localStream} label={`${user.name} (you)`} muted audioOnly={mediaMode === 'audio'}/>}
          {Object.values(remotePeers).map(peer => <MeetingVideo key={peer.id} stream={peer.stream} label={peer.name || 'Meeting participant'} audioOnly={!peer.stream?.getVideoTracks().some(track => track.enabled)}/>)}
          {!inCall && <div className="meeting-waiting-state">
            <div className="meeting-waiting-icon"><Video size={28}/></div>
            <h2>{canJoin ? 'Your meeting room is ready' : 'Your meeting workspace'}</h2>
            <p>{canJoin ? `Join with video or audio-only. ${meeting.attendees.length} participants are expected.` : `Starts ${new Date(meeting.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}. The room opens 15 minutes before the start.`}</p>
            {callError && <p className="meeting-error" role="alert">{callError}</p>}
            <div className="meeting-join-controls">
              <label className="meeting-mode-option"><input type="radio" name="media-mode" value="video" checked={mediaMode === 'video'} onChange={() => setMediaMode('video')}/> Join with video</label>
              <label className="meeting-mode-option"><input type="radio" name="media-mode" value="audio" checked={mediaMode === 'audio'} onChange={() => setMediaMode('audio')}/> Join with audio only</label>
              <button className="btn btn-primary" type="button" disabled={!canJoin || joining} onClick={joinCall}>{joining ? 'Connecting…' : canJoin ? 'Join meeting' : secondsUntilOpen ? `Opens in ${Math.ceil(secondsUntilOpen / 60000)} min` : 'Meeting has ended'}</button>
            </div>
            {!mediaConfig && <p className="meeting-privacy-note">Peer connections use direct WebRTC. For attendees on different networks, configure your own TURN server with VITE_WEBRTC_ICE_SERVERS.</p>}
          </div>}
          {inCall && !Object.keys(remotePeers).length && <div className="meeting-waiting-state meeting-waiting-compact"><div className="meeting-waiting-icon"><Circle size={26}/></div><b>Waiting for other booked attendees</b><p>They can join this same room from their session link.</p></div>}
        </div>
        {inCall && <div className="meeting-call-toolbar">
          <button type="button" className={`meeting-control ${microphoneEnabled ? '' : 'meeting-control-muted'}`} onClick={toggleMicrophone} aria-label={microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'}>{microphoneEnabled ? <Mic/> : <MicOff/>}</button>
          {mediaMode === 'video' && <button type="button" className={`meeting-control ${cameraEnabled ? '' : 'meeting-control-muted'}`} onClick={toggleCamera} aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}>{cameraEnabled ? <Video/> : <VideoOff/>}</button>}
          <button type="button" className="meeting-control meeting-control-leave" onClick={stopCall} aria-label="Leave meeting"><PhoneOff/> Leave meeting</button>
        </div>}
        {callError && inCall && <p className="meeting-error" role="alert">{callError}</p>}
        <div className="meeting-attendees">
          <h3><Circle size={9}/> Participants</h3>
          {meeting.attendees.map(attendee => <div className="meeting-attendee" key={attendee.id}><span className="avatar">{attendee.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><span>{attendee.name}{attendee.id === user.id ? ' (you)' : ''}</span>{attendee.id === meeting.attendees[0]?.id && <span className="badge">Mentor</span>}{remotePeers[attendee.id] && <span className="meeting-connected">Connected</span>}</div>)}
        </div>
      </main>
      <aside className="meeting-notes-panel">
        <div><h2>Shared meeting notes</h2><p>Notes and key points are saved for everyone booked into this session.</p></div>
        {noteError && <p className="meeting-error" role="alert">{noteError}</p>}
        <form onSubmit={saveNote} className="meeting-note-form">
          <label className="label" htmlFor="meeting-note-type">Add to the workspace</label>
          <select className="select" id="meeting-note-type" value={noteType} onChange={event => setNoteType(event.target.value)}><option value="NOTE">Meeting note</option><option value="KEY_POINT">Important point</option></select>
          <textarea className="textarea" required maxLength={2000} value={noteText} onChange={event => setNoteText(event.target.value)} placeholder="Capture an idea, decision, action item, or question..."/>
          <button className="btn btn-primary" type="submit"><Check size={14}/> Save note</button>
        </form>
        <div className="meeting-notes-list" aria-live="polite">
          {notes.map(note => <article className={`meeting-note ${note.type === 'KEY_POINT' ? 'meeting-key-point' : ''}`} key={note.id}>
            <div className="row between"><span className={`badge ${note.type === 'KEY_POINT' ? 'badge-purple' : ''}`}>{note.type === 'KEY_POINT' ? 'Important point' : 'Note'}</span>{(note.authorId === user.id || meeting.isMentor) && <button type="button" className="meeting-note-delete" onClick={() => deleteNote(note)} aria-label="Delete note">×</button>}</div>
            <p>{note.content}</p>
            <small>{note.author?.name || note.authorName || 'Attendee'} · {new Date(note.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</small>
          </article>)}
          {!notes.length && <p className="muted">No notes yet. Add key decisions and follow-up points as you talk.</p>}
        </div>
      </aside>
    </div>
  </div>;
}
