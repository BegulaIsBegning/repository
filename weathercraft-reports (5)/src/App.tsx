import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, Droplets, Wind, Zap, Flame, Tornado, AlertTriangle, Camera, User, LogOut } from 'lucide-react';

// Types
interface User {
  id: string;
  username: string;
  avatar_url?: string;
}

interface Report {
  id: string;
  city: string;
  time: string;
  effective_until: string;
  type: string;
  clouds?: string;
  moisture: string;
  act_kind: string;
  damage_classification: string;
  photo_url?: string;
  title: string;
  author_name: string;
  created_at: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [view, setView] = useState<'list' | 'submit'>('list');
  const [loading, setLoading] = useState(true);
  
  // Login State
  const [showLogin, setShowLogin] = useState(false);
  const [loginStep, setLoginStep] = useState<'username' | 'verify'>('username');
  const [loginUsername, setLoginUsername] = useState('');
  const [verificationData, setVerificationData] = useState<any>(null);
  const [loginError, setLoginError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    city: '',
    time: '',
    effective_until: '',
    type: 'Normal',
    clouds: '',
    moisture: '0%',
    act_kind: 'None',
    damage_classification: 'None',
    title: ''
  });
  const [photo, setPhoto] = useState<File | null>(null);

  useEffect(() => {
    checkAuth();
    fetchReports();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      setUser(data.user);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setReports(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUsernameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setVerifying(true);
    
    try {
      const res = await fetch('/api/auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername })
      });
      
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok) {
          setVerificationData(data);
          setLoginStep('verify');
        } else {
          setLoginError(data.error || 'Failed to init verification');
        }
      } else {
        setLoginError(`Server Error: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      setLoginError('Connection error (Backend unreachable?)');
    } finally {
      setVerifying(false);
    }
  };

  // Polling for verification status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showLogin && loginStep === 'verify' && verificationData?.uuid) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/auth/status/${verificationData.uuid}`);
          const data = await res.json();
          
          if (data.verified) {
            setUser(data.user);
            setShowLogin(false);
            setLoginUsername('');
            setVerificationData(null);
            setLoginStep('username');
            clearInterval(interval);
          }
        } catch (e) {
          console.error('Polling error', e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [showLogin, loginStep, verificationData]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    setView('list');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, String(value));
    });
    if (photo) {
      data.append('photo', photo);
    }

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        body: data
      });
      
      if (res.ok) {
        alert('Report Submitted!');
        setFormData({
            city: '',
            time: '',
            effective_until: '',
            type: 'Normal',
            clouds: '',
            moisture: '0%',
            act_kind: 'None',
            damage_classification: 'None',
            title: ''
        });
        setPhoto(null);
        setView('list');
        fetchReports();
      } else {
        alert('Submission failed');
      }
    } catch (e) {
      alert('Error submitting form');
    }
  };

  // Listen for auth success from popup
  // Removed OAuth listener

  if (loading) return <div className="min-h-screen flex items-center justify-center text-4xl mc-text-shadow">Loading Chunks...</div>;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-mc-ui-dark border-b-4 border-black p-4 sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-mc-grass border-4 border-black relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-mc-dirt opacity-50"></div>
            </div>
            <h1 className="text-3xl md:text-4xl font-minecraft text-white mc-text-shadow tracking-wider">
              WEATHER<span className="text-mc-grass">CRAFT</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden md:flex items-center gap-2 text-mc-ui-bg">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="Skin" className="w-8 h-8 border border-white" />
                  ) : (
                    <User className="w-6 h-6" />
                  )}
                  <span className="text-xl">{user.username}</span>
                </div>
                <button 
                  onClick={() => setView(view === 'list' ? 'submit' : 'list')}
                  className="mc-btn bg-mc-dirt text-white"
                >
                  {view === 'list' ? 'Submit Report' : 'View Reports'}
                </button>
                <button onClick={handleLogout} className="mc-btn bg-red-700 text-white p-2">
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button onClick={() => setShowLogin(true)} className="mc-btn bg-blue-600 text-white flex items-center gap-2">
                <User className="w-5 h-5" />
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Login Modal */}
      <AnimatePresence>
        {showLogin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
          >
            <div className="mc-panel max-w-lg w-full bg-[#C6C6C6] relative">
              <button 
                onClick={() => setShowLogin(false)}
                className="absolute top-2 right-2 text-2xl font-bold hover:text-red-600"
              >
                &times;
              </button>
              <h2 className="text-2xl font-bold mb-4 border-b-2 border-gray-500 pb-2 text-center">
                {loginStep === 'username' ? 'Server Verification' : 'Type Command'}
              </h2>
              
              {loginStep === 'username' ? (
                <form onSubmit={handleUsernameSubmit} className="space-y-4 font-minecraft">
                  <div className="space-y-2">
                    <label className="block text-xl">Enter Username</label>
                    <input 
                      type="text"
                      required
                      className="mc-input"
                      value={loginUsername}
                      onChange={e => setLoginUsername(e.target.value)}
                      placeholder="e.g. Notch"
                      autoFocus
                    />
                  </div>
                  <button type="submit" disabled={verifying} className="mc-btn w-full bg-mc-grass text-white mt-4">
                    {verifying ? 'Checking...' : 'Next Step'}
                  </button>
                  {loginError && (
                    <div className="bg-red-200 border-2 border-red-600 text-red-800 p-2 text-center text-sm">
                      {loginError}
                    </div>
                  )}
                </form>
              ) : (
                <div className="space-y-4 font-minecraft text-center">
                  <div className="bg-blue-100 border-l-4 border-blue-500 p-4 text-sm">
                    <p className="font-bold text-lg mb-2">Join the Server!</p>
                    <p>Log in to your Minecraft server and type:</p>
                  </div>

                  <div className="bg-black text-green-400 p-4 font-mono text-xl border-2 border-gray-600 select-all">
                    /verify {verificationData?.code}
                  </div>

                  <div className="flex justify-center">
                     <div className="animate-pulse text-gray-600 text-sm">
                        Waiting for confirmation...
                     </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button 
                      type="button" 
                      onClick={() => setLoginStep('username')}
                      className="mc-btn flex-1 bg-gray-500 text-white"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto p-4 mt-8">
        
        <AnimatePresence mode="wait">
          {view === 'list' ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {reports.length === 0 ? (
                <div className="col-span-full text-center py-20">
                  <p className="text-2xl text-gray-400 font-minecraft">No weather reports yet.</p>
                  <p className="text-xl text-gray-500 mt-2">Be the first to scout the area.</p>
                </div>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="mc-panel flex flex-col gap-4 transform hover:-translate-y-1 transition-transform duration-200">
                    {report.photo_url && (
                      <div className="w-full h-48 bg-black border-2 border-gray-600 overflow-hidden relative group">
                        <img src={report.photo_url} alt={report.title} className="w-full h-full object-cover pixelated" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <span className="text-white font-minecraft text-xl">Attached Evidence</span>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <h3 className="text-2xl font-bold uppercase border-b-2 border-gray-400 pb-2 mb-2">{report.title}</h3>
                      <div className="flex justify-between items-start mb-4">
                        <div className="text-lg text-gray-700 font-bold">{report.city}</div>
                        <div className="text-sm bg-gray-200 px-2 py-1 border border-gray-400">{report.time}</div>
                      </div>

                      <div className="space-y-2 font-minecraft text-lg">
                        <div className="flex justify-between border-b border-gray-300 border-dashed">
                          <span className="text-gray-600">Type:</span>
                          <span>{report.type}</span>
                        </div>
                        {report.clouds && (
                          <div className="flex justify-between border-b border-gray-300 border-dashed">
                            <span className="text-gray-600">Clouds:</span>
                            <span>{report.clouds}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-b border-gray-300 border-dashed">
                          <span className="text-gray-600">Moisture:</span>
                          <span>{report.moisture}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-300 border-dashed">
                          <span className="text-gray-600">Phenomenon:</span>
                          <span className="text-red-700 font-bold">{report.act_kind}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-300 border-dashed">
                          <span className="text-gray-600">Damage:</span>
                          <span>{report.damage_classification}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-300 border-dashed">
                          <span className="text-gray-600">Valid Until:</span>
                          <span>{report.effective_until}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 flex items-center gap-2 text-gray-500 text-sm border-t-2 border-gray-300">
                      <div className="w-6 h-6 bg-mc-grass border border-black"></div>
                      <span>Scouted by {report.author_name}</span>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="submit"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              <div className="mc-panel bg-[#C6C6C6]">
                <h2 className="text-3xl font-bold mb-6 text-center border-b-4 border-gray-500 pb-4">Submit Weather Report</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-xl">City / Biome</label>
                      <input 
                        required
                        className="mc-input"
                        value={formData.city}
                        onChange={e => setFormData({...formData, city: e.target.value})}
                        placeholder="e.g. New York / Plains"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xl">Title</label>
                      <input 
                        required
                        className="mc-input"
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        placeholder="Brief summary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-xl">Time of Observation</label>
                      <input 
                        type="time"
                        required
                        className="mc-input"
                        value={formData.time}
                        onChange={e => setFormData({...formData, time: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xl">Effective Until</label>
                      <input 
                        type="time"
                        required
                        className="mc-input"
                        value={formData.effective_until}
                        onChange={e => setFormData({...formData, effective_until: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="block text-xl">Type</label>
                      <select 
                        className="mc-input"
                        value={formData.type}
                        onChange={e => setFormData({...formData, type: e.target.value})}
                      >
                        <option>Clear</option>
                        <option>Rain</option>
                        <option>Thunder</option>
                        <option>Snow</option>
                        <option>Dry</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xl">Moisture</label>
                      <input 
                        className="mc-input"
                        value={formData.moisture}
                        onChange={e => setFormData({...formData, moisture: e.target.value})}
                        placeholder="e.g. 85%"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xl">Clouds (Opt)</label>
                      <input 
                        className="mc-input"
                        value={formData.clouds}
                        onChange={e => setFormData({...formData, clouds: e.target.value})}
                        placeholder="e.g. Cumulus"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xl text-red-800 font-bold">Kind of Act (Danger)</label>
                    <select 
                      className="mc-input text-red-400"
                      value={formData.act_kind}
                      onChange={e => setFormData({...formData, act_kind: e.target.value})}
                    >
                      <option value="None">None</option>
                      <option value="Tornado">Tornado</option>
                      <option value="Squall">Squall</option>
                      <option value="Hurricane">Hurricane</option>
                      <option value="Cyclone">Cyclone</option>
                      <option value="Fire">Fire</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xl">Classification of Damage</label>
                    <input 
                      required
                      className="mc-input"
                      value={formData.damage_classification}
                      onChange={e => setFormData({...formData, damage_classification: e.target.value})}
                      placeholder="e.g. Severe, Structural, None"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xl">Annex Photo</label>
                    <div className="border-2 border-dashed border-gray-600 p-4 bg-gray-200 text-center cursor-pointer hover:bg-white transition-colors relative">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={e => setPhoto(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center gap-2">
                        <Camera className="w-8 h-8 text-gray-500" />
                        <span className="text-lg">{photo ? photo.name : 'Click to upload evidence'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setView('list')} className="mc-btn flex-1 bg-gray-500 text-white">
                      Cancel
                    </button>
                    <button type="submit" className="mc-btn flex-1 bg-mc-grass text-white">
                      Submit Report
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full bg-mc-ui-dark border-t-4 border-black p-2 text-center text-gray-400 font-minecraft text-lg">
        Server Status: Online | Players: {user ? '1 (You)' : 'Guest'} | World: Earth
      </footer>
    </div>
  );
}
