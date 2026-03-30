import React, { useState, useEffect, useRef } from 'react';
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
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

export default function App() {
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
  const [user, setUser] = useState<{ name: string; email: string; avatar: string } | null>(null);
  const [destinations, setDestinations] = useState({
    youtube: { connected: false, name: '' },
    facebook: { connected: false, name: '' },
    custom: { connected: false, url: '', key: '' }
  });
  const [activeDestination, setActiveDestination] = useState<'youtube' | 'facebook' | 'custom' | null>(null);
  const [showStreamSettings, setShowStreamSettings] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamInterval = useRef<NodeJS.Timeout | null>(null);

  // --- Stream Logic ---
  const toggleLive = async (sourceOverride?: 'camera' | 'video') => {
    const source = sourceOverride || streamSource;
    
    if (isLive) {
      if (streamSource === 'camera') {
        const stream = videoRef.current?.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = '';
      }
      setIsLive(false);
      setUptime(0);
      if (streamInterval.current) clearInterval(streamInterval.current);
    } else {
      setStreamSource(source);
      try {
        if (source === 'camera') {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } else {
          if (videoRef.current) {
            videoRef.current.src = videoUrl;
            videoRef.current.loop = true;
            videoRef.current.play();
          }
        }
        
        setIsLive(true);
        streamInterval.current = setInterval(() => {
          setUptime(prev => prev + 1);
          setViewers(prev => prev + Math.floor(Math.random() * 10) - 4);
        }, 1000);

        // Simulate a random alert shortly after going live
        setTimeout(() => {
          addAlert({ type: 'follower', user: 'NewFan_99' });
        }, 5000);
      } catch (err) {
        console.error("Error starting stream:", err);
        alert("Could not start stream. Please check permissions or video file.");
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
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      user: 'You',
      text: inputText,
      color: 'text-white font-bold',
    };
    
    setMessages(prev => [...prev, newMessage]);
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

  const handleLogin = (provider: 'google' | 'facebook') => {
    // Simulate login
    setUser({
      name: provider === 'google' ? 'Google User' : 'Facebook User',
      email: provider === 'google' ? 'user@gmail.com' : 'user@facebook.com',
      avatar: `https://picsum.photos/seed/${provider}/200`
    });
    setIsSidebarOpen(false);
  };

  const handleLogout = () => {
    setUser(null);
    setIsSidebarOpen(false);
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
                  <h2 className="text-xl font-bold">Stream Destinations</h2>
                </div>
                <button onClick={() => setShowStreamSettings(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
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

              <div className="p-6 bg-white/5 border-t border-white/10 flex justify-end gap-3">
                <button 
                  onClick={() => setShowStreamSettings(false)}
                  className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setShowStreamSettings(false)}
                  className="px-8 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                >
                  Save Settings
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

              <div className="flex-1 p-6">
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
              className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-black fill-current" />
              </div>
              <span className="font-bold text-xl tracking-tighter">STREAMFLOW</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-gray-400">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="hidden lg:flex items-center gap-2 hover:text-white transition-colors"
            >
              <Menu className="w-4 h-4" />
              Menu
            </button>
            <a href="#" className="text-white">Browse</a>
            <a href="#" className="hover:text-white transition-colors">Following</a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {!user && (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="hidden sm:block px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-lg transition-colors border border-white/10"
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
          <div className="relative aspect-video bg-black group">
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted={isMuted}
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            
            {/* Placeholder when not live or video off */}
            {(!isLive || isVideoOff) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1f1f23]">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <VideoOff className="w-10 h-10 text-gray-500" />
                </div>
                <p className="text-gray-400 font-medium">
                  {isLive ? 'Stream is hidden' : 'Stream is currently offline'}
                </p>
                {!isLive && (
                  <div className="flex flex-col gap-3 mt-6">
                    <button 
                      onClick={() => toggleLive('camera')}
                      className="px-8 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all transform hover:scale-105 flex items-center gap-2"
                    >
                      <VideoIcon className="w-4 h-4" />
                      GO LIVE WITH CAMERA
                    </button>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => toggleLive('video')}
                        className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg transition-all border border-white/10 flex items-center justify-center gap-2"
                      >
                        <Zap className="w-4 h-4 text-cyan-500" />
                        STREAM MP4
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg transition-all border border-white/10"
                        title="Upload Custom MP4"
                      >
                        <Share2 className="w-4 h-4 rotate-90" />
                      </button>
                    </div>
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
            <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
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
                    <span className="text-xs font-bold hidden sm:inline">Destinations</span>
                  </button>
                  <button className="p-2 bg-black/60 backdrop-blur-md hover:bg-black/80 rounded-lg border border-white/10 transition-colors">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Alerts Center */}
              <div className="flex flex-col items-center gap-4 mb-12">
                <AnimatePresence>
                  {alerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 50, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="bg-gradient-to-r from-cyan-600 to-green-500 p-px rounded-xl shadow-2xl shadow-cyan-500/20"
                    >
                      <div className="bg-[#18181b] px-8 py-4 rounded-[11px] flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center mb-2">
                          {alert.type === 'follower' ? <Heart className="text-cyan-500 fill-current" /> : <Zap className="text-yellow-400 fill-current" />}
                        </div>
                        <h3 className="text-xs font-bold text-cyan-500 uppercase tracking-[0.2em] mb-1">
                          {alert.type === 'follower' ? 'New Follower!' : 'New Donation!'}
                        </h3>
                        <p className="text-xl font-black text-white italic uppercase italic">
                          {alert.user}
                        </p>
                        {alert.amount && (
                          <p className="text-2xl font-black text-green-400 mt-1">
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
                <button 
                  onClick={toggleLive}
                  className={`px-8 py-3 rounded-full font-bold transition-all ${isLive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-cyan-500 hover:bg-cyan-400 text-black'}`}
                >
                  {isLive ? 'STOP STREAM' : 'START STREAM'}
                </button>
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
