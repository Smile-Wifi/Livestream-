import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  Video, 
  MessageSquare, 
  Users, 
  Heart, 
  Share2, 
  MoreVertical, 
  Send, 
  Zap, 
  Trophy, 
  Bell,
  Settings,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  ExternalLink,
  DollarSign,
  Menu,
  X,
  Facebook,
  Mail,
  LogOut,
  Youtube,
  Globe,
  Key,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Play,
  Link as LinkIcon,
  Library,
  Music,
  Film
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, googleProvider, facebookProvider, handleFirestoreError, OperationType } from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';

// --- Error Boundary ---
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error) errorMessage = `Firestore Error: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#18181b] border border-white/10 rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Application Error</h2>
            <p className="text-gray-400 mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Types ---
interface ChatMessage {
  id: string;
  user: string;
  text: string;
  color: string;
  isMod?: boolean;
}

interface Alert {
  id: string;
  type: 'follower' | 'donation' | 'subscriber';
  user: string;
  amount?: string;
}

// --- Constants ---
const CHAT_COLORS = ['text-cyan-400', 'text-green-400', 'text-pink-400', 'text-yellow-400', 'text-purple-400'];
const INITIAL_MESSAGES: ChatMessage[] = [
  { id: '1', user: 'ModBot', text: 'Welcome to the stream! Be respectful.', color: 'text-gray-400', isMod: true },
  { id: '2', user: 'GamerPro', text: 'LETS GOOOO!', color: 'text-cyan-400' },
  { id: '3', user: 'PixelArt', text: 'The quality is amazing today.', color: 'text-pink-400' },
];

const VIDEO_GALLERY = [
  { id: '1', title: 'Big Buck Bunny', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumb: 'https://picsum.photos/seed/bunny/200/120', type: 'video' as const },
  { id: '2', title: 'Elephant Dream', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', thumb: 'https://picsum.photos/seed/elephant/200/120', type: 'video' as const },
  { id: '3', title: 'Tears of Steel', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', thumb: 'https://picsum.photos/seed/steel/200/120', type: 'video' as const },
  { id: '4', title: 'Sintel', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', thumb: 'https://picsum.photos/seed/sintel/200/120', type: 'video' as const },
];

const MEDIA_GALLERY = [
  ...VIDEO_GALLERY,
  { id: 'm1', title: 'Synthwave Dreams', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', thumb: 'https://picsum.photos/seed/music1/200/120', type: 'audio' as const },
  { id: 'm2', title: 'Cyberpunk Beat', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', thumb: 'https://picsum.photos/seed/music2/200/120', type: 'audio' as const },
  { id: 'm3', title: 'Ambient Chill', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', thumb: 'https://picsum.photos/seed/music3/200/120', type: 'audio' as const },
];

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [isLive, setIsLive] = useState(false);
  const [streamSource, setStreamSource] = useState<'camera' | 'video'>('camera');
  const [videoUrl, setVideoUrl] = useState<string>('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [viewers, setViewers] = useState(1242);
  const [uptime, setUptime] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; avatar: string; uid: string; role: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
  const [isHost, setIsHost] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [streamState, setStreamState] = useState<any>(null);
  const [destinations, setDestinations] = useState({
    youtube: { connected: false, name: '' },
    facebook: { connected: false, name: '' },
    custom: { connected: false, url: '', key: '' }
  });
  const [activeDestination, setActiveDestination] = useState<'youtube' | 'facebook' | 'custom' | null>(null);
  const [showStreamSettings, setShowStreamSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'destinations' | 'overlays' | 'server' | 'media'>('destinations');
  const [overlaySettings, setOverlaySettings] = useState({
    borderColor: '#06b6d4',
    borderWidth: 2,
    alertPosition: 'top-left' as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center',
    showBorder: false,
    borderGlow: true
  });
  const [serverStatus, setServerStatus] = useState<{ online: boolean; viewers: number; uptime: number }>({ online: false, viewers: 0, uptime: 0 });
  const socketRef = useRef<WebSocket | null>(null);

  // --- Auth Logic ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const role = userData.role || (firebaseUser.email === 'kaptenlanaja2024@gmail.com' ? 'admin' : 'user');
            const updatedUser = {
              uid: firebaseUser.uid,
              name: userData.displayName || firebaseUser.displayName || 'Anonymous',
              email: firebaseUser.email || '',
              avatar: userData.photoURL || firebaseUser.photoURL || `https://picsum.photos/seed/${firebaseUser.uid}/200`,
              role: role
            };
            setUser(updatedUser);
            setIsAdmin(role === 'admin');
          } else {
            // Create user profile if it doesn't exist
            const role = firebaseUser.email === 'kaptenlanaja2024@gmail.com' ? 'admin' : 'user';
            const newUser = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Anonymous',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || `https://picsum.photos/seed/${firebaseUser.uid}/200`,
              role: role
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser({
              ...newUser,
              name: newUser.displayName,
              avatar: newUser.photoURL
            });
            setIsAdmin(role === 'admin');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setIsHost(false);
      }
      setIsAuthReady(true);
    });

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  // --- Stream Synchronization Logic ---
  useEffect(() => {
    if (!isAuthReady) return;

    const unsubscribe = onSnapshot(doc(db, 'stream_state', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setStreamState(data);
        
        // Update isHost based on Firestore data
        if (user && data.hostId === user.uid) {
          setIsHost(true);
        } else {
          setIsHost(false);
        }

        // Only sync if we are NOT the host (viewers follow host)
        if (user && data.hostId !== user.uid) {
          if (data.isLive !== undefined) setIsLive(data.isLive);
          
          if (data.mediaUrl !== videoUrl) {
            setVideoUrl(data.mediaUrl);
            setMediaType(data.mediaType);
          }
          
          if (videoRef.current) {
            const timeDiff = Math.abs(videoRef.current.currentTime - data.currentTime);
            // Sync if time difference is more than 2 seconds
            if (timeDiff > 2) {
              videoRef.current.currentTime = data.currentTime;
            }
            
            if (data.isPlaying && videoRef.current.paused) {
              videoRef.current.play().catch(() => {});
            } else if (!data.isPlaying && !videoRef.current.paused) {
              videoRef.current.pause();
            }
          }
        }
      } else if (user) {
        // If no stream state exists, current user can be host
        setStreamState(null);
        setIsHost(true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stream_state/current');
    });

    return () => unsubscribe();
  }, [isAuthReady, user, videoUrl]);

  // Update global state if we are the host
  const updateGlobalStreamState = async (updates: any) => {
    if (!user) return;
    // Allow update if we are the host, OR if there is no current stream state (we are starting it), OR if we are an admin
    if (streamState && !isHost && !isAdmin) return;
    
    try {
      await updateDoc(doc(db, 'stream_state', 'current'), {
        ...updates,
        isLive: updates.isLive !== undefined ? updates.isLive : isLive,
        lastUpdated: Date.now(),
        updatedBy: user.uid,
        hostId: user.uid
      });
    } catch (error) {
      try {
        // If doc doesn't exist, create it
        await setDoc(doc(db, 'stream_state', 'current'), {
          mediaUrl: videoUrl,
          mediaType: mediaType,
          isPlaying: !videoRef.current?.paused,
          currentTime: videoRef.current?.currentTime || 0,
          isLive: updates.isLive !== undefined ? updates.isLive : isLive,
          lastUpdated: Date.now(),
          updatedBy: user.uid,
          hostId: user.uid,
          ...updates
        });
      } catch (innerError) {
        handleFirestoreError(innerError, OperationType.WRITE, 'stream_state/current');
      }
    }
  };

  // --- WebSocket Logic ---
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('Connected to local stream server');
      setServerStatus(prev => ({ ...prev, online: true }));
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'STATUS') {
          setServerStatus(prev => ({ ...prev, ...payload.data }));
        } else if (payload.type === 'VIEWERS') {
          setServerStatus(prev => ({ ...prev, viewers: payload.data }));
          setViewers(payload.data + 1200); // Base viewers + server clients
        } else if (payload.type === 'CHAT') {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            user: payload.data.user,
            text: payload.data.text,
            color: CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)]
          }].slice(-50));
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };

    socket.onclose = () => {
      setServerStatus(prev => ({ ...prev, online: false }));
    };

    return () => socket.close();
  }, []);
  const [showVideoGallery, setShowVideoGallery] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamInterval = useRef<NodeJS.Timeout | null>(null);

  // --- Stream Logic ---
  useEffect(() => {
    if (isLive && streamSource === 'camera' && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => {
          console.error("Camera access error:", err);
          setIsLive(false);
        });
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [isLive, streamSource]);

  const toggleLive = async (sourceOverride?: 'camera' | 'video') => {
    const source = sourceOverride || streamSource;
    
    if (isLive) {
      if (streamSource === 'camera') {
        const stream = videoRef.current?.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      }
      setIsLive(false);
      setUptime(0);
      if (streamInterval.current) clearInterval(streamInterval.current);
      
      if (isHost || isAdmin) {
        updateGlobalStreamState({ isLive: false, isPlaying: false });
      }
    } else {
      setStreamSource(source);
      setIsLive(true);
      
      streamInterval.current = setInterval(() => {
        setUptime(prev => prev + 1);
        setViewers(prev => prev + Math.floor(Math.random() * 10) - 4);
      }, 1000);

      // Simulate a random alert shortly after going live
      setTimeout(() => {
        addAlert({ type: 'follower', user: 'NewFan_99' });
      }, 5000);

      if (isHost || isAdmin || !streamState) {
        updateGlobalStreamState({ 
          isLive: true, 
          isPlaying: true, 
          mediaUrl: videoUrl, 
          mediaType: mediaType,
          currentTime: videoRef.current?.currentTime || 0
        });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setStreamSource('video');
      // If already live and source is video, update the source
      if (isLive && streamSource === 'video' && videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.play();
      }
    }
  };

  const handleUrlStream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    setVideoUrl(customUrl);
    setStreamSource('video');
    toggleLive('video');
  };

  const selectGalleryVideo = (url: string, type: 'video' | 'audio' = 'video') => {
    setVideoUrl(url);
    setMediaType(type);
    setStreamSource('video');
    setShowVideoGallery(false);
    toggleLive('video');
    
    if (isHost || isAdmin || !streamState) {
      updateGlobalStreamState({
        mediaUrl: url,
        mediaType: type,
        isPlaying: true,
        currentTime: 0
      });
    }
  };

  const addAlert = (alert: Omit<Alert, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setAlerts(prev => [...prev, { ...alert, id }]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }, 5000);
  };

  const sendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const newMessage = {
      user: user?.name || 'You',
      text: inputText
    };

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'CHAT', data: newMessage }));
    } else {
      // Fallback if server is down
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        user: newMessage.user,
        text: newMessage.text,
        color: 'text-white font-bold'
      }]);
    }
    
    setInputText('');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleLogin = async (providerName: 'google' | 'facebook') => {
    try {
      const provider = providerName === 'google' ? googleProvider : facebookProvider;
      await signInWithPopup(auth, provider);
      setIsSidebarOpen(false);
    } catch (error) {
      console.error("Login error:", error);
      addAlert({ type: 'follower', user: 'Login failed. Please try again.' });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsSidebarOpen(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const connectDestination = (platform: 'youtube' | 'facebook') => {
    // Simulate OAuth flow
    setDestinations(prev => ({
      ...prev,
      [platform]: { connected: true, name: platform === 'youtube' ? 'Kapten Gaming' : 'Kapten Lanaja' }
    }));
    setActiveDestination(platform);
  };

  const disconnectDestination = (platform: 'youtube' | 'facebook' | 'custom') => {
    setDestinations(prev => ({
      ...prev,
      [platform]: { ...prev[platform as keyof typeof prev], connected: false }
    }));
    if (activeDestination === platform) setActiveDestination(null);
  };

  return (
    <div className="min-h-screen bg-[#0e0e10] text-gray-100 font-sans selection:bg-cyan-500/30">
      {/* --- Video Gallery Modal --- */}
      <AnimatePresence>
        {showVideoGallery && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVideoGallery(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-[#18181b] border border-white/10 rounded-3xl z-[201] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <Library className="w-5 h-5 text-cyan-500" />
                  </div>
                  <h2 className="text-xl font-bold">Video Gallery</h2>
                </div>
                <button onClick={() => setShowVideoGallery(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {VIDEO_GALLERY.map((video) => (
                    <div 
                      key={video.id}
                      onClick={() => selectGalleryVideo(video.url)}
                      className="group relative aspect-video rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-cyan-500/50 transition-all"
                    >
                      <img src={video.thumb} alt={video.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
                        <p className="font-bold text-white group-hover:text-cyan-500 transition-colors">{video.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Play className="w-3 h-3 text-cyan-500 fill-current" />
                          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Preview</span>
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/10 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- Stream Settings Modal --- */}
      <AnimatePresence>
        {showStreamSettings && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStreamSettings(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-[#18181b] border border-white/10 rounded-3xl z-[201] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <Settings className="w-5 h-5 text-cyan-500" />
                  </div>
                  <h2 className="text-xl font-bold">Stream Settings</h2>
                </div>
                <button onClick={() => setShowStreamSettings(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex border-b border-white/10 bg-white/2">
                <button 
                  onClick={() => setSettingsTab('destinations')}
                  className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${settingsTab === 'destinations' ? 'border-cyan-500 text-cyan-500 bg-cyan-500/5' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                  DESTINATIONS
                </button>
                <button 
                  onClick={() => setSettingsTab('overlays')}
                  className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${settingsTab === 'overlays' ? 'border-cyan-500 text-cyan-500 bg-cyan-500/5' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                  OVERLAYS
                </button>
                <button 
                  onClick={() => setSettingsTab('server')}
                  className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${settingsTab === 'server' ? 'border-cyan-500 text-cyan-500 bg-cyan-500/5' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                  LOCAL SERVER
                </button>
                <button 
                  onClick={() => setSettingsTab('media')}
                  className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${settingsTab === 'media' ? 'border-cyan-500 text-cyan-500 bg-cyan-500/5' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                  MEDIA
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {settingsTab === 'destinations' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* YouTube Card */}
                      <div className={`p-5 rounded-2xl border transition-all ${destinations.youtube.connected ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-600 rounded-lg">
                              <Youtube className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold">YouTube Live</span>
                          </div>
                          {destinations.youtube.connected && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                        </div>
                        {destinations.youtube.connected ? (
                          <div className="space-y-3">
                            <p className="text-sm text-gray-400">Connected as <span className="text-white font-medium">{destinations.youtube.name}</span></p>
                            <button 
                              onClick={() => disconnectDestination('youtube')}
                              className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-bold transition-colors"
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => connectDestination('youtube')}
                            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-all"
                          >
                            Connect YouTube
                          </button>
                        )}
                      </div>

                      {/* Facebook Card */}
                      <div className={`p-5 rounded-2xl border transition-all ${destinations.facebook.connected ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#1877f2] rounded-lg">
                              <Facebook className="w-5 h-5 text-white fill-current" />
                            </div>
                            <span className="font-bold">Facebook Live</span>
                          </div>
                          {destinations.facebook.connected && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                        </div>
                        {destinations.facebook.connected ? (
                          <div className="space-y-3">
                            <p className="text-sm text-gray-400">Connected as <span className="text-white font-medium">{destinations.facebook.name}</span></p>
                            <button 
                              onClick={() => disconnectDestination('facebook')}
                              className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-bold transition-colors"
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => connectDestination('facebook')}
                            className="w-full py-2.5 bg-[#1877f2] hover:bg-[#166fe5] text-white rounded-lg text-sm font-bold transition-all"
                          >
                            Connect Facebook
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Custom RTMP Section */}
                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                      <div className="flex items-center gap-3 mb-6">
                        <Globe className="w-5 h-5 text-cyan-500" />
                        <h3 className="font-bold">Custom RTMP Destination</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Server URL</label>
                          <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input 
                              type="text" 
                              placeholder="rtmps://live-api-s.facebook.com:443/rtmp/"
                              className="w-full bg-[#26262c] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/50 transition-all"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Stream Key</label>
                          <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input 
                              type="password" 
                              placeholder="••••••••••••••••"
                              className="w-full bg-[#26262c] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/50 transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-cyan-500 shrink-0" />
                      <p className="text-xs text-cyan-200 leading-relaxed">
                        Streaming to external platforms requires a server-side relay. This preview simulates the API connection and configuration flow.
                      </p>
                    </div>
                  </div>
                ) : settingsTab === 'overlays' ? (
                  <div className="space-y-8">
                    {/* Webcam Border Settings */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-lg">Stream Border</h3>
                          <p className="text-sm text-gray-400">Add a decorative frame to your stream</p>
                        </div>
                        <button 
                          onClick={() => setOverlaySettings(prev => ({ ...prev, showBorder: !prev.showBorder }))}
                          className={`w-12 h-6 rounded-full transition-all relative ${overlaySettings.showBorder ? 'bg-cyan-500' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${overlaySettings.showBorder ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>

                      {overlaySettings.showBorder && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-6 pt-4 border-t border-white/5"
                        >
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Border Color</label>
                              <div className="flex gap-2">
                                {['#06b6d4', '#ef4444', '#22c55e', '#a855f7', '#f59e0b'].map(color => (
                                  <button 
                                    key={color}
                                    onClick={() => setOverlaySettings(prev => ({ ...prev, borderColor: color }))}
                                    className={`w-8 h-8 rounded-lg border-2 transition-all ${overlaySettings.borderColor === color ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="space-y-3">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Border Width ({overlaySettings.borderWidth}px)</label>
                              <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                value={overlaySettings.borderWidth}
                                onChange={(e) => setOverlaySettings(prev => ({ ...prev, borderWidth: parseInt(e.target.value) }))}
                                className="w-full accent-cyan-500"
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-cyan-500/10 rounded-lg">
                                <Zap className="w-4 h-4 text-cyan-500" />
                              </div>
                              <span className="text-sm font-medium text-white">Enable Neon Glow</span>
                            </div>
                            <button 
                              onClick={() => setOverlaySettings(prev => ({ ...prev, borderGlow: !prev.borderGlow }))}
                              className={`w-10 h-5 rounded-full transition-all relative ${overlaySettings.borderGlow ? 'bg-cyan-500' : 'bg-white/10'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${overlaySettings.borderGlow ? 'left-5.5' : 'left-0.5'}`} />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Alert Box Positioning */}
                    <div className="space-y-6 pt-8 border-t border-white/10">
                      <div>
                        <h3 className="font-bold text-lg">Alert Positioning</h3>
                        <p className="text-sm text-gray-400">Choose where stream alerts appear on screen</p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { id: 'top-left', label: 'Top Left' },
                          { id: 'top-right', label: 'Top Right' },
                          { id: 'center', label: 'Center' },
                          { id: 'bottom-left', label: 'Bottom Left' },
                          { id: 'bottom-right', label: 'Bottom Right' }
                        ].map(pos => (
                          <button 
                            key={pos.id}
                            onClick={() => setOverlaySettings(prev => ({ ...prev, alertPosition: pos.id as any }))}
                            className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-3 ${overlaySettings.alertPosition === pos.id ? 'bg-cyan-500/10 border-cyan-500 text-cyan-500' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}
                          >
                            <div className="w-16 h-10 bg-black/40 rounded border border-white/10 relative overflow-hidden">
                              <div className={`absolute w-3 h-3 bg-cyan-500 rounded-sm shadow-[0_0_8px_rgba(6,182,212,0.5)] ${
                                pos.id === 'top-left' ? 'top-1 left-1' :
                                pos.id === 'top-right' ? 'top-1 right-1' :
                                pos.id === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' :
                                pos.id === 'bottom-left' ? 'bottom-1 left-1' :
                                'bottom-1 right-1'
                              }`} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider">{pos.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${serverStatus.online ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                          <Globe className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">Local Stream Server</h3>
                          <p className="text-sm text-gray-400">
                            Status: <span className={serverStatus.online ? 'text-green-500' : 'text-red-500'}>{serverStatus.online ? 'Online' : 'Offline'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Active Clients</p>
                        <p className="text-2xl font-black text-white">{serverStatus.viewers}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4">
                          <Zap className="w-5 h-5 text-cyan-500" />
                          <span className="font-bold">Real-time Sync</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          Your local server handles real-time chat synchronization and viewer count tracking across all connected clients.
                        </p>
                      </div>
                      <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4">
                          <Share2 className="w-5 h-5 text-cyan-500" />
                          <span className="font-bold">Stream Relay</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          The local server acts as a relay point for your video stream, allowing for lower latency and better distribution.
                        </p>
                      </div>
                    </div>

                    <div className="p-6 bg-[#26262c] rounded-2xl border border-white/5">
                      <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-gray-500" />
                        Server Configuration
                      </h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">WebSocket URL</span>
                          <code className="bg-black/40 px-2 py-1 rounded text-cyan-500 text-xs">
                            {window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//{window.location.host}
                          </code>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">API Endpoint</span>
                          <code className="bg-black/40 px-2 py-1 rounded text-cyan-500 text-xs">/api/server-status</code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-white/5 border-t border-white/10 flex justify-end gap-3">
                <button 
                  onClick={() => setShowStreamSettings(false)}
                  className="px-8 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- Side Panel (Drawer) --- */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-[#18181b] border-r border-white/10 z-[101] shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-500 fill-current" />
                  <span className="font-bold text-lg tracking-tight">Account Settings</span>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                {/* Livestream Player Section in Sidebar */}
                <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-2">
                      <VideoIcon className="w-4 h-4 text-cyan-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Livestream Player</span>
                    </div>
                    {isLive && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded-full border border-red-500/20">
                        <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>

                  <div className="relative aspect-video rounded-xl overflow-hidden bg-black/40 border border-white/5 group-hover:border-cyan-500/30 transition-all duration-500">
                    {isLive ? (
                      <>
                        <video 
                          src={streamSource === 'video' ? videoUrl : undefined}
                          autoPlay 
                          muted 
                          playsInline 
                          loop
                          className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] text-white font-medium bg-black/40 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/10">
                            <Users className="w-3 h-3 text-cyan-500" />
                            {viewers.toLocaleString()}
                          </div>
                          <button 
                            onClick={() => {
                              setIsSidebarOpen(false);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-1.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg transition-all shadow-lg shadow-cyan-500/20"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-500">
                          <VideoOff className="w-5 h-5 text-gray-600" />
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">No active stream</p>
                      </div>
                    )}
                  </div>

                  {!isLive && (
                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98, y: 0 }}
                      onClick={() => {
                        if (!user) {
                          // If guest, show login prompt or just scroll to top
                          setIsSidebarOpen(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        } else {
                          setIsSidebarOpen(false);
                          toggleLive('camera');
                        }
                      }}
                      className="w-full mt-4 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      Go Live Now
                    </motion.button>
                  )}
                </div>

                {user ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                      <img src={user.avatar} alt="Avatar" className="w-12 h-12 rounded-full border border-cyan-500/50" referrerPolicy="no-referrer" />
                      <div>
                        <p className="font-bold text-white">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <button 
                        onClick={() => { setShowStreamSettings(true); setIsSidebarOpen(false); }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors text-sm font-medium"
                      >
                        <Globe className="w-4 h-4 text-cyan-500" />
                        Stream Destinations
                      </button>
                      <button className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors text-sm font-medium">
                        <Settings className="w-4 h-4 text-gray-400" />
                        Channel Settings
                      </button>
                      <button className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors text-sm font-medium">
                        <Users className="w-4 h-4 text-gray-400" />
                        Community
                      </button>
                    </div>

                    <button 
                      onClick={handleLogout}
                      className="w-full mt-auto flex items-center justify-center gap-2 p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors text-sm font-bold border border-red-500/20"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Live Now Button for Guests */}
                    {isLive && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20 text-center relative overflow-hidden group"
                      >
                        <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                        <div className="relative z-10">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Live Now</span>
                          </div>
                          <h4 className="text-lg font-bold text-white mb-4 leading-tight">StreamFlow is Live!</h4>
                          <button 
                            onClick={() => {
                              setIsSidebarOpen(false);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="w-full py-3 bg-red-500 hover:bg-red-400 text-white font-black rounded-xl transition-all shadow-lg shadow-red-500/20 text-xs uppercase tracking-widest"
                          >
                            Watch Stream
                          </button>
                        </div>
                        <div className="absolute -bottom-4 -right-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                          <Zap className="w-24 h-24 text-red-500 fill-current" />
                        </div>
                      </motion.div>
                    )}

                    <div className="text-center">
                      <h3 className="text-xl font-bold text-white mb-2">Join StreamFlow</h3>
                      <p className="text-sm text-gray-400">Connect with your favorite creators and start your own journey.</p>
                    </div>

                    <div className="space-y-3">
                      <button 
                        onClick={() => handleLogin('google')}
                        className="w-full flex items-center justify-center gap-3 p-3.5 bg-white text-black hover:bg-gray-200 rounded-xl transition-all font-bold text-sm shadow-lg shadow-white/5"
                      >
                        <Mail className="w-5 h-5" />
                        Continue with Google
                      </button>
                      <button 
                        onClick={() => handleLogin('facebook')}
                        className="w-full flex items-center justify-center gap-3 p-3.5 bg-[#1877f2] text-white hover:bg-[#166fe5] rounded-xl transition-all font-bold text-sm shadow-lg shadow-blue-500/20"
                      >
                        <Facebook className="w-5 h-5 fill-current" />
                        Continue with Facebook
                      </button>
                    </div>

                    <div className="pt-8 border-t border-white/5">
                      <p className="text-[10px] text-center text-gray-500 uppercase tracking-widest leading-relaxed">
                        By continuing, you agree to StreamFlow's <br />
                        <span className="text-cyan-500 cursor-pointer">Terms of Service</span> and <span className="text-cyan-500 cursor-pointer">Privacy Policy</span>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- Header --- */}
      <header className="h-14 border-b border-white/10 bg-[#18181b] flex items-center justify-between px-4 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden relative"
            >
              <Menu className="w-6 h-6" />
              {isLive && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#18181b] animate-pulse"></span>
              )}
            </button>
            <div className="flex items-center gap-2 group cursor-pointer">
              <motion.div 
                whileHover={{ rotate: 15, scale: 1.1 }}
                className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20"
              >
                <Zap className="w-5 h-5 text-black fill-current" />
              </motion.div>
              <span className="font-bold text-xl tracking-tighter group-hover:text-cyan-400 transition-colors">STREAMFLOW</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-gray-400">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="hidden lg:flex items-center gap-2 hover:text-white transition-colors relative"
            >
              <Menu className="w-4 h-4" />
              Menu
              {isLive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[#18181b] animate-pulse"></span>
              )}
            </button>
            <a href="#" className="text-white hover:text-cyan-400 transition-colors">Browse</a>
            <a href="#" className="hover:text-white transition-colors">Following</a>
            
            {isLive && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 text-[10px] font-black uppercase tracking-widest"
              >
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                Live Now
              </motion.button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isLive && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="md:hidden flex items-center gap-2 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 text-[8px] font-black uppercase tracking-widest"
            >
              <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>
              Live
            </motion.button>
          )}
          {user && !isLive && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleLive('camera')}
              className="hidden sm:flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black text-xs font-black rounded-xl transition-all shadow-xl shadow-cyan-500/20 uppercase tracking-widest"
            >
              <VideoIcon className="w-4 h-4 fill-current" />
              Go Live
            </motion.button>
          )}
          {!user && !isLive && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSidebarOpen(true)}
              className="hidden sm:flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-black rounded-xl transition-all border border-white/10 uppercase tracking-widest"
            >
              <VideoIcon className="w-4 h-4" />
              Go Live
            </motion.button>
          )}
          {!user && (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="hidden sm:block px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-bold rounded-lg transition-colors"
            >
              Log In
            </button>
          )}
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-cyan-500 rounded-full border-2 border-[#18181b]"></span>
          </button>
          <div 
            onClick={() => setIsSidebarOpen(true)}
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-green-400 border border-white/20 cursor-pointer overflow-hidden"
          >
            {user ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* --- Main Content Area --- */}
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
          
          {/* --- Video Player Section --- */}
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/20">
                  <VideoIcon className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight uppercase italic">Livestream Player</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Global Broadcast Channel</p>
                </div>
              </div>
              {isLive && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-500 text-xs font-black uppercase rounded-lg border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Live
                  </div>
                </div>
              )}
            </div>
            <div className="relative aspect-video bg-black group overflow-hidden rounded-3xl shadow-2xl shadow-black/50 border border-white/5">
            {/* Custom Stream Border */}
            {overlaySettings.showBorder && (
              <div 
                className="absolute inset-0 z-10 pointer-events-none transition-all duration-300"
                style={{ 
                  border: `${overlaySettings.borderWidth}px solid ${overlaySettings.borderColor}`,
                  boxShadow: overlaySettings.borderGlow ? `inset 0 0 20px ${overlaySettings.borderColor}40, 0 0 20px ${overlaySettings.borderColor}40` : 'none'
                }}
              />
            )}

            <video 
              ref={videoRef}
              src={isLive && streamSource === 'video' ? videoUrl : undefined}
              autoPlay 
              playsInline 
              muted={isMuted}
              loop={isLive && streamSource === 'video'}
              className={`w-full h-full object-cover ${isVideoOff || mediaType === 'audio' ? 'hidden' : ''}`}
              onPlay={() => isHost && updateGlobalStreamState({ isPlaying: true, currentTime: videoRef.current?.currentTime || 0 })}
              onPause={() => isHost && updateGlobalStreamState({ isPlaying: false, currentTime: videoRef.current?.currentTime || 0 })}
              onTimeUpdate={() => {
                if (isHost && videoRef.current && Math.floor(videoRef.current.currentTime) % 5 === 0) {
                  updateGlobalStreamState({ currentTime: videoRef.current.currentTime });
                }
              }}
            />
            
            {/* Audio Placeholder */}
            {isLive && mediaType === 'audio' && !isVideoOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-cyan-500/20 z-10">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-6 backdrop-blur-xl border border-white/10 shadow-2xl"
                >
                  <Music className="w-16 h-16 text-pink-500 drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-2">Now Playing</h3>
                <p className="text-gray-400 font-medium">Audio Stream Active</p>
                
                {/* Visualizer simulation */}
                <div className="flex items-end gap-1 mt-8 h-12">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [10, Math.random() * 40 + 10, 10] }}
                      transition={{ duration: 0.5 + Math.random(), repeat: Infinity }}
                      className="w-1.5 bg-cyan-500 rounded-full"
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Placeholder when not live or video off */}
            {(!isLive || isVideoOff) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1f1f23] z-20">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <VideoOff className="w-10 h-10 text-gray-500" />
                </div>
                <p className="text-gray-400 font-medium">
                  {isLive ? 'Stream is hidden' : 'Stream is currently offline'}
                </p>
                {!isLive && (
                  <div className="flex flex-col gap-4 mt-6 w-full max-w-sm px-4">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleLive('camera')}
                  className="w-full px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  <VideoIcon className="w-5 h-5" />
                  GO LIVE WITH CAMERA
                </motion.button>
                
                <div className="grid grid-cols-2 gap-2">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowVideoGallery(true)}
                    className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2 hover:border-cyan-500/30"
                  >
                    <Library className="w-4 h-4 text-cyan-500" />
                    GALLERY
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2 hover:border-cyan-500/30"
                  >
                    <Share2 className="w-4 h-4 text-cyan-500 rotate-90" />
                    UPLOAD
                  </motion.button>
                </div>

                    <form onSubmit={handleUrlStream} className="relative group">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/5 group-focus-within:bg-cyan-500/10 transition-colors">
                        <LinkIcon className="w-4 h-4 text-gray-500 group-focus-within:text-cyan-500 transition-colors" />
                      </div>
                      <input 
                        type="url" 
                        placeholder="Paste MP4 URL to stream..."
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        className="w-full bg-[#26262c] border border-white/10 rounded-xl py-3.5 pl-12 pr-12 text-sm outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-500"
                      />
                      <button 
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg transition-all"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    </form>

                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="video/mp4,video/x-m4v,video/*" 
                      className="hidden" 
                    />
                  </div>
                )}
              </div>
            )}

            {/* --- Overlay UI --- */}
            <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-30">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-2">
                  {isLive && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider"
                    >
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      Live
                    </motion.div>
                  )}
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-3 text-sm font-medium border border-white/10">
                    <div className="flex items-center gap-1.5 text-white">
                      <Users className="w-4 h-4" />
                      {viewers.toLocaleString()}
                    </div>
                    <div className="w-px h-3 bg-white/20"></div>
                    <div className="text-gray-300">
                      {formatTime(uptime)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pointer-events-auto">
                  <button 
                    onClick={() => setShowStreamSettings(true)}
                    className="p-2 bg-black/60 backdrop-blur-md hover:bg-black/80 rounded-lg border border-white/10 transition-colors flex items-center gap-2"
                  >
                    <Globe className="w-5 h-5 text-cyan-500" />
                    <span className="text-xs font-bold hidden sm:inline">Settings</span>
                  </button>
                  <button className="p-2 bg-black/60 backdrop-blur-md hover:bg-black/80 rounded-lg border border-white/10 transition-colors">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Alerts Center */}
              <div className={`absolute flex flex-col gap-4 pointer-events-none p-6 ${
                overlaySettings.alertPosition === 'top-left' ? 'top-16 left-0' :
                overlaySettings.alertPosition === 'top-right' ? 'top-16 right-0' :
                overlaySettings.alertPosition === 'bottom-left' ? 'bottom-20 left-0' :
                overlaySettings.alertPosition === 'bottom-right' ? 'bottom-20 right-0' :
                'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
              }`}>
                <AnimatePresence>
                  {alerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 50, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="bg-gradient-to-r from-cyan-600 to-green-500 p-px rounded-xl shadow-2xl shadow-cyan-500/20"
                    >
                      <div className="bg-[#18181b] px-8 py-4 rounded-[11px] flex flex-col items-center text-center min-w-[200px]">
                        <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center mb-2">
                          {alert.type === 'follower' ? <Heart className="text-cyan-500 fill-current" /> : <Zap className="text-yellow-400 fill-current" />}
                        </div>
                        <h3 className="text-[10px] font-bold text-cyan-500 uppercase tracking-[0.2em] mb-1">
                          {alert.type === 'follower' ? 'New Follower!' : 'New Donation!'}
                        </h3>
                        <p className="text-lg font-black text-white italic uppercase">
                          {alert.user}
                        </p>
                        {alert.amount && (
                          <p className="text-xl font-black text-green-400 mt-1">
                            {alert.amount}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Bottom Controls (Visible on Hover) */}
              <div className="flex justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-3 rounded-full backdrop-blur-md border border-white/10 transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-black/60 text-white hover:bg-black/80'}`}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
                <button 
                  onClick={() => setIsVideoOff(!isVideoOff)}
                  className={`p-3 rounded-full backdrop-blur-md border border-white/10 transition-all ${isVideoOff ? 'bg-red-500/20 text-red-500' : 'bg-black/60 text-white hover:bg-black/80'}`}
                >
                  {isVideoOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
                </button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleLive()}
                  className={`px-8 py-3 rounded-full font-bold transition-all shadow-xl ${isLive ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20' : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/20'}`}
                >
                  {isLive ? 'STOP STREAM' : 'START STREAM'}
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* --- Stream Info Section --- */}
        <div className="p-6 bg-[#0e0e10]">
            <div className="flex flex-col md:flex-row justify-between gap-6">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-500 to-green-400 p-1">
                  <div className="w-full h-full rounded-full bg-[#0e0e10] p-1">
                    <div className="w-full h-full rounded-full bg-gray-800 overflow-hidden">
                      <img src="https://picsum.photos/seed/streamer/200" alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    KaptenLanaja
                    <motion.span 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center"
                    >
                      <Zap className="w-2.5 h-2.5 text-black fill-current" />
                    </motion.span>
                  </h1>
                  <p className="text-cyan-500 font-medium text-sm">Playing Just Chatting</p>
                  <div className="flex gap-3 mt-3">
                    <span className="px-2 py-1 bg-white/5 rounded text-xs font-medium text-gray-400">English</span>
                    <span className="px-2 py-1 bg-white/5 rounded text-xs font-medium text-gray-400">Creative</span>
                    <span className="px-2 py-1 bg-white/5 rounded text-xs font-medium text-gray-400">Coding</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-colors">
                  <Heart className="w-4 h-4 fill-current" />
                  Follow
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg transition-colors border border-white/10">
                  <Zap className="w-4 h-4 text-cyan-500" />
                  Subscribe
                </button>
                <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Donation Goal Bar */}
            <div className="mt-8 bg-[#18181b] border border-white/5 rounded-2xl p-6">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Donation Goal</h3>
                  <p className="text-xl font-black text-white">$742.00 <span className="text-gray-500 text-sm font-normal">/ $1,000.00</span></p>
                </div>
                <div className="text-right">
                  <p className="text-cyan-500 font-bold">74%</p>
                  <p className="text-xs text-gray-500">12 days left</p>
                </div>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '74%' }}
                  className="h-full bg-gradient-to-r from-cyan-500 to-green-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                />
              </div>
            </div>

            {/* About Section */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-[#18181b] border border-white/5 rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">About KaptenLanaja</h2>
                <p className="text-gray-400 leading-relaxed">
                  Full-stack developer by day, chaotic streamer by night. I build cool things with React and AI while listening to synthwave. Join the community and let's build the future together!
                </p>
                <div className="flex gap-4 mt-6">
                  <a href="#" className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"><Share2 className="w-5 h-5" /></a>
                  <a href="#" className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"><ExternalLink className="w-5 h-5" /></a>
                </div>
              </div>
              <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <Trophy className="w-8 h-8 text-cyan-500 mb-4" />
                  <h3 className="font-bold text-lg">Top Supporter</h3>
                  <p className="text-gray-400 text-sm mt-1">This month's legend</p>
                </div>
                <div className="mt-4">
                  <p className="text-xl font-black text-white">CryptoWhale</p>
                  <p className="text-cyan-500 font-bold">$2,450.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- Chat Sidebar --- */}
        <aside className="w-full lg:w-80 bg-[#18181b] border-l border-white/10 flex flex-col">
          <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 shrink-0">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Stream Chat</span>
            <button className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400">
              <Users className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className="text-sm leading-relaxed group">
                <span className="text-gray-500 text-[10px] mr-2 opacity-0 group-hover:opacity-100 transition-opacity">12:34</span>
                {msg.isMod && <span className="inline-block w-3 h-3 bg-green-500 rounded-sm mr-1.5 align-middle"></span>}
                <span className={`${msg.color} font-bold mr-2 hover:underline cursor-pointer`}>{msg.user}:</span>
                <span className="text-gray-200">{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-white/10 bg-[#18181b]">
            <form onSubmit={sendMessage} className="relative">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Send a message..."
                className="w-full bg-[#26262c] border border-transparent focus:border-cyan-500/50 rounded-lg py-2.5 pl-3 pr-10 text-sm outline-none transition-all placeholder:text-gray-500"
              />
              <button 
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-cyan-500 hover:text-cyan-400 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between mt-3 px-1">
              <div className="flex gap-2">
                <button className="p-1.5 hover:bg-white/5 rounded text-gray-500 hover:text-gray-300"><MessageSquare className="w-4 h-4" /></button>
                <button className="p-1.5 hover:bg-white/5 rounded text-gray-500 hover:text-gray-300"><DollarSign className="w-4 h-4" /></button>
              </div>
              <button className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 text-[10px] font-bold uppercase rounded transition-colors">
                Chat Settings
              </button>
            </div>
          </div>
        </aside>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  );
}
