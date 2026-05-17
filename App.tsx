import React, { useState, useEffect, useRef } from 'react';
import { AuthModal, OnboardingFlow } from './components/auth/AuthComponents';
import AuthHandler from './components/auth/AuthHandler';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut,
  signInWithCustomToken,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  Sparkle, 
  LogOut, 
  Plus, 
  MapPin, 
  Calendar, 
  Clock, 
  User as UserIcon, 
  Briefcase, 
  BarChart3,
  Activity,
  CheckCircle, 
  MessageSquare,
  ChevronRight,
  Star,
  Shield,
  Zap,
  Filter,
  Scissors,
  Hammer,
  Bell,
  Users,
  Smartphone,
  Mail,
  Lock,
  ArrowLeft,
  X
} from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  useMap, 
  useMapsLibrary, 
  useAdvancedMarkerRef 
} from '@vis.gl/react-google-maps';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO
} from 'date-fns';
import { NotificationManager } from './components/NotificationManager';
import { 
  UserProfile, 
  UserRole, 
  ServiceRequest, 
  Quote, 
  Message, 
  Notification, 
  NotificationType,
  Review
} from './types';
import { Button, Card } from './components/ui/Shared';

const MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || 'AIzaSyACUWVlW1nPpV5je-nIRFgPARjM1Kv5ZtU';
const hasValidMapsKey = Boolean(MAPS_API_KEY) && MAPS_API_KEY !== 'YOUR_API_KEY';

// Utility for notifications
const triggerNotification = async (userId: string, title: string, message: string, type: NotificationType, relatedId?: string) => {
  if (!userId) return;
  const notificationId = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  const notification: any = {
    notificationId,
    userId,
    title,
    message,
    type,
    read: false,
    createdAt: new Date().toISOString()
  };
  if (relatedId) notification.relatedId = relatedId;

  try {
    await setDoc(doc(db, `users/${userId}/notifications`, notificationId), notification);
  } catch (err) {
    console.error("Notification trigger failed:", err);
  }
};

// Common Components removed - using shared components from ./components/ui/Shared

// Main App
export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'market' | 'requests' | 'settings' | 'calendar' | 'admin'>('dashboard');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [reviewRequest, setReviewRequest] = useState<ServiceRequest | null>(null);

  const [authError, setAuthError] = useState<string | null>(null);

  const isAuthAction = window.location.pathname === '/auth/action';

  useEffect(() => {
    // Handle redirect result
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          console.log("Redirect sign-in successful", result.user);
        }
      } catch (e: any) {
        console.error("Redirect sign-in error", e);
        if (e.code === 'auth/account-exists-with-different-credential') {
          setAuthError("An account already exists with the same email address but different sign-in credentials. Please sign in using a provider associated with this email.");
        } else if (e.code === 'auth/auth-domain-config-required') {
          setAuthError("Firebase Auth configuration is missing. Please check your project settings.");
        } else {
          setAuthError(e.message);
        }
      } finally {
        setLoading(false);
      }
    };
    handleRedirect();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Force refresh verification status if it currently says false
        // This helps when returning to the app after verifying in another tab
        if (!u.emailVerified) {
          try {
            await u.reload();
          } catch (e) {
            console.error("Auth reload failed:", e);
          }
        }
        
        const freshUser = auth.currentUser;
        setUser(freshUser);

        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            setProfile(null);
          }
        } catch (e) {
          console.error("Error fetching profile", e);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, `users/${user.uid}/notifications`),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setNotifications(snapshot.docs.map(doc => ({ ...doc.data() } as Notification)));
      }, (e) => handleFirestoreError(e, OperationType.LIST, `users/${user.uid}/notifications`));
      return unsubscribe;
    }
  }, [user]);

  const handleMarkRead = async (notificationId: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/notifications`, notificationId), { read: true }, { merge: true });
    } catch (e) {
      console.error("Mark read failed", e);
    }
  };

  const handleLogin = async (type: 'google' | 'email' | 'phone' | 'google-redirect', data?: any) => {
    if (type === 'google' || type === 'google-redirect') {
      const provider = new GoogleAuthProvider();
      try {
        if (type === 'google-redirect') {
          await signInWithRedirect(auth, provider);
          return;
        }
        await signInWithPopup(auth, provider);
      } catch (error: any) {
        console.error("Login failed", error);
        
        if (error.code === 'auth/popup-closed-by-user') {
          const domain = window.location.hostname;
          throw new Error(`The sign-in window was closed. If this happened immediately, your browser might be blocking popups or "${domain}" isn't authorized in Firebase. Try clicking "Sign in with Redirect" below.`);
        }

        if (error.code === 'auth/popup-blocked') {
          throw new Error("The popup was blocked by your browser. Please allow popups or use the Redirect method below.");
        }

        if (error.message.includes('requests-from-referer') || error.code === 'auth/requests-from-referer-blocked') {
          const domain = window.location.hostname;
          throw new Error(`Auth Blocked: The domain "${domain}" must be added to your Firebase project's "Authorized domains" list in the Firebase Console (Authentication > Settings).`);
        }
        throw error;
      }
    } else if (type === 'phone' && data?.user) {
      // Native phone auth success - just ensure state is updated if needed (though onAuthStateChanged handles it)
      console.log("Phone sign in successful via native component");
    } else if (type === 'phone' && data?.token) {
      try {
        console.log("Attempting sign in with custom token...");
        await signInWithCustomToken(auth, data.token);
        console.log("Sign in with custom token successful");
      } catch (error: any) {
        console.error("Custom token login failed", error);
        if (error.message.includes('requests-from-referer') || error.code === 'auth/requests-from-referer-blocked') {
          const domain = window.location.hostname;
          throw new Error(`Auth Blocked: The domain "${domain}" must be added to your Firebase project's "Authorized domains" list in the Firebase Console (Authentication > Settings).`);
        }
        throw error;
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (isAuthAction) {
    return <AuthHandler />;
  }

  if (!hasValidMapsKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ui-bg p-6 text-center">
        <div className="max-w-md w-full bg-white p-12 rounded-[48px] shadow-xl border border-ui-accent space-y-8">
          <div className="w-20 h-20 bg-ui-primary/10 rounded-full flex items-center justify-center mx-auto">
            <MapPin className="text-ui-primary" size={40} />
          </div>
          <div>
            <h2 className="text-3xl font-bold serif text-stone-900 mb-4">Maps API Key Required</h2>
            <p className="text-stone-500 text-sm leading-relaxed">
              To enable address validation and maps, please provide a Google Maps Platform API key.
            </p>
          </div>
          <div className="text-left space-y-4 bg-ui-surface p-6 rounded-3xl border border-ui-accent text-xs">
            <p><strong>To add your API key:</strong></p>
            <ol className="list-decimal list-inside space-y-2 text-stone-600">
              <li>Open <strong>Settings</strong> (⚙️ gear icon)</li>
              <li>Select <strong>Secrets</strong></li>
              <li>Add <code>GOOGLE_MAPS_PLATFORM_KEY</code> as name</li>
              <li>Paste your key as value and press Enter</li>
            </ol>
          </div>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">The app rebuilds automatically after setup</p>
        </div>
      </div>
    );
  }

  const handleOnboardingFinish = async (role: UserRole, phoneData: { number: string, verified: boolean }) => {
    const activeUser = auth.currentUser;
    if (!activeUser) return;
    
    setLoading(true);
    let errorMessage = '';
    const now = new Date().toISOString();
    
    // Ensure we have latest verification status
    try {
      await activeUser.reload();
      // Force refresh the ID token so security rules see the email_verified claim
      await activeUser.getIdToken(true);
      // Update local user state so App re-renders with fresh verification info
      setUser(auth.currentUser);
    } catch (e) {
      console.error("Auth reload failed during onboarding", e);
    }
    
    // Better default name from email
    const defaultName = activeUser.displayName || (activeUser.email ? activeUser.email.split('@')[0] : null) || 'Member';
    
    const newProfile: UserProfile = {
      uid: activeUser.uid,
      email: activeUser.email || '',
      phoneNumber: phoneData.number || '',
      phoneVerified: phoneData.verified || false,
      role,
      fullName: defaultName,
      avatarUrl: activeUser.photoURL || null,
      rating: 5.0,
      totalJobs: 0,
      createdAt: now,
      updatedAt: now
    };
    try {
      await setDoc(doc(db, 'users', activeUser.uid), newProfile);
      setProfile(newProfile);
    } catch (e: any) {
      console.error("Onboarding failed", e);
      errorMessage = e.message || String(e);
      handleFirestoreError(e, OperationType.WRITE, `users/${activeUser.uid}`);
      setLoading(false);
      throw new Error(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ui-bg">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <Sparkle className="text-ui-primary" size={48} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Landing onLogin={handleLogin} authError={authError} />;
  }

  // Use auth.currentUser directly to ensure we have the most up-to-date verification status
  const currentAuthUser = auth.currentUser || user;
  
  // A profile is complete when it exists and has a role
  // We check phone verification and email verification status to decide if we show the flow
  const hasRole = profile && profile.role;
  const isEmailVerified = currentAuthUser?.emailVerified;
  const isPhoneVerified = profile?.phoneVerified;
  
  const needsOnboarding = !hasRole || !isEmailVerified || !isPhoneVerified;

  if (needsOnboarding && user) {
    return (
      <OnboardingFlow 
        user={currentAuthUser} 
        existingProfile={profile} 
        onSelect={handleOnboardingFinish} 
      />
    );
  }

  return (
    <APIProvider apiKey={MAPS_API_KEY} solutionChannel="GMP_mcp_codeassist_v1_aistudio">
      <div className={`min-h-screen bg-ui-bg font-sans text-stone-800 pb-20 md:pb-0 transition-colors duration-500 ${profile.role === 'customer' ? 'theme-customer' : 'theme-provider'}`}>
      <NotificationManager />
      {/* Top Header - Always visible but navigation items hidden on mobile */}
      <nav className="bg-ui-surface border-b border-ui-accent sticky top-0 z-50 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 font-bold text-2xl text-ui-primary serif tracking-tight">
              <Sparkle size={28} />
              <span>{profile.role === 'customer' ? <><span className="text-black">meister</span><span className="text-orange-500">nah</span></> : 'ProPanel'}</span>
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-semibold leading-none mt-1">
              {profile.role === 'customer' ? 'Cleaning Marketplace' : 'Expert Suite'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Desktop Navigation Items */}
            <div className="hidden md:flex bg-white/50 backdrop-blur-sm rounded-2xl p-1 border border-ui-accent/50 mr-4">
              <button 
                onClick={() => setView('dashboard')}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${view === 'dashboard' ? 'bg-white shadow-sm text-ui-primary' : 'text-stone-500 hover:text-stone-800'}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setView('calendar')}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${view === 'calendar' ? 'bg-white shadow-sm text-ui-primary' : 'text-stone-500 hover:text-stone-800'}`}
              >
                Schedule
              </button>
              {profile.role === 'provider' ? (
                <button 
                  onClick={() => setView('market')}
                  className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${view === 'market' ? 'bg-white shadow-sm text-ui-primary' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  Jobs Market
                </button>
              ) : (
                <button 
                  onClick={() => setView('requests')}
                  className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${view === 'requests' ? 'bg-white shadow-sm text-ui-primary' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  My Requests
                </button>
              )}
              <button 
                onClick={() => setView('settings')}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${view === 'settings' ? 'bg-white shadow-sm text-ui-primary' : 'text-stone-500 hover:text-stone-800'}`}
              >
                Profile
              </button>
              {profile.role === 'admin' && (
                <button 
                  onClick={() => setView('admin')}
                  className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${view === 'admin' ? 'bg-white shadow-sm text-ui-primary' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  Admin
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 border-l border-ui-accent pl-4 md:pl-6">
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-2 rounded-xl transition-all relative ${showNotifications ? 'bg-ui-surface text-ui-primary' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  <Bell size={22} />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-ui-secondary rounded-full border-2 border-white" />
                  )}
                </button>
                
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-4 w-80 bg-white rounded-3xl shadow-2xl border border-ui-accent z-[60] overflow-hidden"
                    >
                      <div className="p-4 border-b border-ui-accent flex items-center justify-between bg-ui-surface/30">
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-widest px-2">Notifications</span>
                        <button onClick={() => setShowNotifications(false)} className="text-stone-300 hover:text-stone-500">
                          <Plus size={18} className="rotate-45" />
                        </button>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-10 text-center text-stone-400 italic text-sm">Quiet for now...</div>
                        ) : (
                          notifications.map(n => (
                            <button 
                              key={n.notificationId} 
                              onClick={() => handleMarkRead(n.notificationId)}
                              className={`w-full p-4 text-left border-b border-ui-accent/50 hover:bg-ui-surface/50 transition-colors flex gap-3 ${!n.read ? 'bg-ui-primary/5' : ''}`}
                            >
                              <div className={`w-2 h-2 mt-1.5 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-ui-primary'}`} />
                              <div>
                                <h5 className="text-sm font-bold text-stone-800 leading-tight">{n.title}</h5>
                                <p className="text-xs text-stone-500 mt-1 leading-relaxed">{n.message}</p>
                                <span className="text-[10px] text-stone-300 font-medium block mt-2">{new Date(n.createdAt).toLocaleDateString()}</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-3">
                <img 
                  src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${profile.fullName}`} 
                  className="w-10 h-10 rounded-full border-2 border-white shadow-sm" 
                  alt="Avatar" 
                />
                <button onClick={handleLogout} className="text-stone-400 hover:text-red-500 transition-colors hidden md:block">
                  <LogOut size={22} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-ui-accent px-6 py-3 flex items-center justify-between shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
        <button 
          onClick={() => setView('dashboard')}
          className={`flex flex-col items-center gap-1 transition-all ${view === 'dashboard' ? 'text-ui-primary' : 'text-stone-400'}`}
        >
          <div className={`p-2 rounded-2xl transition-all ${view === 'dashboard' ? 'bg-ui-surface shadow-sm' : ''}`}>
            <Sparkle size={24} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Dash</span>
        </button>

        <button 
          onClick={() => setView('calendar')}
          className={`flex flex-col items-center gap-1 transition-all ${view === 'calendar' ? 'text-ui-primary' : 'text-stone-400'}`}
        >
          <div className={`p-2 rounded-2xl transition-all ${view === 'calendar' ? 'bg-ui-surface shadow-sm' : ''}`}>
            <Calendar size={24} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Schedule</span>
        </button>

        {profile.role === 'provider' ? (
          <button 
            onClick={() => setView('market')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'market' ? 'text-ui-primary' : 'text-stone-400'}`}
          >
            <div className={`p-2 rounded-2xl transition-all ${view === 'market' ? 'bg-ui-surface shadow-sm' : ''}`}>
              <Briefcase size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Market</span>
          </button>
        ) : (
          <button 
            onClick={() => setView('requests')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'requests' ? 'text-ui-primary' : 'text-stone-400'}`}
          >
            <div className={`p-2 rounded-2xl transition-all ${view === 'requests' ? 'bg-ui-surface shadow-sm' : ''}`}>
              <Clock size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Requests</span>
          </button>
        )}

        <button 
          onClick={() => setView('settings')}
          className={`flex flex-col items-center gap-1 transition-all ${view === 'settings' ? 'text-ui-primary' : 'text-stone-400'}`}
        >
          <div className={`p-2 rounded-2xl transition-all ${view === 'settings' ? 'bg-ui-surface shadow-sm' : ''}`}>
            <UserIcon size={24} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Profile</span>
        </button>

        {profile.role === 'admin' && (
          <button 
            onClick={() => setView('admin')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'admin' ? 'text-ui-primary' : 'text-stone-400'}`}
          >
            <div className={`p-2 rounded-2xl transition-all ${view === 'admin' ? 'bg-ui-surface shadow-sm' : ''}`}>
              <Shield size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Admin</span>
          </button>
        )}

        <button 
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 text-stone-400 hover:text-red-500 transition-colors"
        >
          <div className="p-2">
            <LogOut size={24} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Exit</span>
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-10">
        {view === 'settings' ? (
          <SettingsView profile={profile} onUpdate={(p) => setProfile(p)} setView={setView} />
        ) : view === 'calendar' ? (
          <CalendarView profile={profile} />
        ) : view === 'admin' && profile.role === 'admin' ? (
          <AdminView />
        ) : profile.role === 'customer' ? (
          <CustomerView profile={profile} view={view} setView={setView} onReview={(req) => setReviewRequest(req)} />
        ) : (
          <ProviderView profile={profile} view={view} setView={setView} />
        )}
      </main>

      <AnimatePresence>
        {reviewRequest && (
          <ReviewModal 
            request={reviewRequest} 
            userProfile={profile} 
            onClose={() => setReviewRequest(null)} 
          />
        )}
      </AnimatePresence>
    </div>
    </APIProvider>
  );
}

// --------------------------------------------------------------------------------
// Shared Calendar View
// --------------------------------------------------------------------------------

function CalendarView({ profile }: { profile: UserProfile }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [requests, setRequests] = useState<ServiceRequest[]>([]);

  useEffect(() => {
    // Fetch all requests related to this user that have a status that would put them on a calendar
    const field = profile.role === 'customer' ? 'customerId' : 'providerId';
    const q = query(
      collection(db, 'requests'),
      where(field, '==', profile.uid),
      where('status', 'in', ['booked', 'completed'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ ...doc.data() } as ServiceRequest)));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'requests'));
    return unsubscribe;
  }, [profile.uid, profile.role]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const getDayRequests = (day: Date) => {
    return requests.filter(req => {
      if (!req.scheduledDate) return false;
      try {
        return isSameDay(parseISO(req.scheduledDate), day);
      } catch {
        return false;
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold serif text-stone-900">Your Schedule</h1>
          <p className="text-stone-500 mt-1">Track your upcoming and past cleaning sessions.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-ui-accent shadow-sm">
          <button onClick={prevMonth} className="p-2 hover:bg-ui-surface rounded-xl transition-colors">
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <span className="font-bold serif text-lg min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button onClick={nextMonth} className="p-2 hover:bg-ui-surface rounded-xl transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-ui-accent shadow-xl shadow-ui-primary/5 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-ui-accent">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-4 text-center text-[10px] uppercase font-bold tracking-[0.2em] text-stone-400">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dayRequests = getDayRequests(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
              <div 
                key={i} 
                className={`min-h-[140px] p-4 border-r border-b border-ui-accent/50 last:border-r-0 ${!isCurrentMonth ? 'bg-ui-surface/20 opacity-40' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-bold ${isToday ? 'bg-ui-primary text-white w-7 h-7 rounded-full flex items-center justify-center -mt-1 -ml-1 shadow-md' : 'text-stone-800'}`}>
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayRequests.map(req => (
                    <div 
                      key={req.requestId}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-bold leading-tight truncate shadow-sm border ${
                        req.status === 'completed' 
                        ? 'bg-green-50 text-green-700 border-green-100' 
                        : 'bg-ui-primary/5 text-ui-primary border-ui-primary/10'
                      }`}
                    >
                      {req.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------
// Sub-components

function Landing({ onLogin, authError }: { onLogin: (type: 'google' | 'email' | 'phone' | 'google-redirect', data?: any) => void, authError?: string | null }) {
  const [showAuth, setShowAuth] = useState<{ open: boolean; isRegister: boolean }>({ open: false, isRegister: false });

  return (
    <div className="min-h-screen bg-natural-bg overflow-hidden font-sans text-stone-800">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-natural-surface rounded-b-[100px] blur-3xl -z-10" />
      
      {authError && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] max-w-md w-full p-4 bg-red-500 text-white text-xs font-bold rounded-2xl shadow-2xl flex items-center gap-3 border border-red-600 animate-bounce">
          <Shield size={20} />
          <p>{authError}</p>
        </div>
      )}
      <header className="max-w-7xl mx-auto px-4 h-24 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-2xl text-natural-primary serif tracking-tight">
          <Sparkle size={32} />
          <span><span className="text-black">meister</span><span className="text-orange-500">nah</span></span>
        </div>
        <Button onClick={() => setShowAuth({ open: true, isRegister: false })} variant="secondary">Sign In</Button>
      </header>

      <div className="max-w-7xl mx-auto px-4 pt-16 pb-32 grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-7xl font-bold tracking-tight text-stone-900 leading-[1.05] mb-6 serif">
            The modern way to <span className="text-natural-primary">book clean.</span>
          </h1>
          <p className="text-xl text-stone-500 mb-10 max-w-lg leading-relaxed">
            Connect with verified cleaning professionals in your neighborhood. 
            Transparent pricing, instant quotes, and quality guaranteed.
          </p>
          <div className="flex items-center gap-4">
            <Button onClick={() => setShowAuth({ open: true, isRegister: true })} className="px-10 py-5 text-lg">Get Started Free</Button>
            <div className="flex -space-x-3 ml-4">
              {[1, 2, 3, 4].map(i => (
                <img key={i} src={`https://i.pravatar.cc/100?img=${i+10}`} className="w-12 h-12 rounded-full border-4 border-white shadow-sm" alt="User" />
              ))}
              <div className="w-12 h-12 rounded-full bg-ui-accent border-4 border-white flex items-center justify-center text-xs font-bold text-stone-600">+1k</div>
            </div>
          </div>
          
          <div className="mt-20 grid grid-cols-2 gap-10">
            <div className="flex gap-4">
              <div className="w-14 h-14 bg-ui-surface rounded-[24px] flex items-center justify-center text-ui-primary shadow-sm">
                <Shield size={28} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 serif text-lg">Verified Pros</h3>
                <p className="text-sm text-stone-400">Background checked and rated.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-14 h-14 bg-ui-surface rounded-[24px] flex items-center justify-center text-ui-primary shadow-sm">
                <Zap size={28} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 serif text-lg">Instant Quotes</h3>
                <p className="text-sm text-stone-400">No waiting for call-backs.</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative px-8"
        >
          <div className="rounded-[40px] overflow-hidden shadow-2xl shadow-ui-primary/10 border-8 border-white">
            <img 
              src="https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&q=80&w=1200" 
              alt="Cleaning service" 
              className="w-full aspect-[4/5] object-cover"
            />
          </div>
          <div className="absolute -bottom-6 -left-0 bg-white p-6 rounded-[32px] shadow-xl border border-ui-accent max-w-[260px]">
            <div className="flex items-center gap-2 text-ui-secondary mb-2">
              <Star size={16} fill="currentColor" />
              <span className="font-bold">4.9/5 Average Rating</span>
            </div>
            <p className="text-sm text-stone-500 italic">"The simplest way to maintain a minimalist, spotless home environment."</p>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showAuth.open && (
          <AuthModal 
            onClose={() => setShowAuth({ open: false, isRegister: false })} 
            onLogin={onLogin} 
            initialIsRegister={showAuth.isRegister}
            externalError={authError}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// RoleSelection removed

        



// --------------------------------------------------------------------------------
// Customer Views
// --------------------------------------------------------------------------------

function CustomerView({ profile, view, setView, onReview }: { profile: UserProfile, view: string, setView: (v: any) => void, onReview: (req: ServiceRequest) => void }) {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [rebookData, setRebookData] = useState<Partial<ServiceRequest> | null>(null);

  const handleRebook = (req: ServiceRequest) => {
    setRebookData({
      title: req.title,
      description: req.description,
      category: req.category,
      location: req.location,
      lat: req.lat,
      lng: req.lng,
      addressTag: req.addressTag,
      scheduledDate: '', // User needs to pick a new date
      isRecurring: req.isRecurring,
      recurrenceInterval: req.recurrenceInterval,
      requiredCleaners: req.requiredCleaners,
      urgent: req.urgent
    });
    setSelectedService(req.category.split(' ')[0]); // heuristic to set main service
    setShowCreate(true);
  };

  const closeCreateModal = () => {
    setShowCreate(false);
    setRebookData(null);
  };

  useEffect(() => {
    const q = query(
      collection(db, 'requests'), 
      where('customerId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ ...doc.data() } as ServiceRequest)));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'requests'));
    return unsubscribe;
  }, [profile.uid]);

  const activeBookings = requests.filter(r => r.status === 'booked');

  if (!selectedService && view === 'dashboard') {
    return (
      <div className="space-y-12 py-10">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold serif text-stone-900 mb-4 text-balance">Hello, {profile.fullName.split(' ')[0]} 👋</h1>
          <p className="text-stone-500">What do you need help with today? Select a category to find the best professionals.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-8">
          {[
            { id: 'Cleaning', title: 'Cleaning', icon: Sparkle, color: 'bg-blue-50 text-blue-600', description: 'Deep cleaning, maintenance, or move-out.' },
            { id: 'HairCut', title: 'Mobile Hair Cut', icon: Scissors, color: 'bg-rose-50 text-rose-600', description: 'Professional stylists at your doorstep.' },
            { id: 'Handyman', title: 'Other Jobs', icon: Hammer, color: 'bg-amber-50 text-amber-600', description: 'Kleinhandwerk, repairs, and improvements.' }
          ].map(service => (
            <button
              key={service.id}
              onClick={() => setSelectedService(service.id)}
              className="group bg-white p-10 rounded-[40px] border-2 border-ui-accent/30 hover:border-ui-primary transition-all text-center shadow-sm hover:shadow-xl hover:-translate-y-1"
            >
              <div className={`w-20 h-20 ${service.color} rounded-[32px] flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform`}>
                <service.icon size={40} />
              </div>
              <h3 className="text-2xl font-bold mb-3 serif">{service.title}</h3>
              <p className="text-sm text-stone-400 leading-relaxed">{service.description}</p>
            </button>
          ))}
        </div>

        {activeBookings.length > 0 && (
          <div className="pt-12 border-t border-ui-accent/50">
            <h2 className="text-2xl font-bold serif text-stone-800 mb-8">Active Bookings</h2>
            <div className="grid gap-6">
              {activeBookings.map(req => (
                <RequestCard key={req.requestId} request={req} isProvider={false} onReview={onReview} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {view === 'dashboard' && (
            <button 
              onClick={() => setSelectedService(null)}
              className="p-2 hover:bg-ui-surface rounded-xl text-stone-400 transition-colors"
            >
              <ChevronRight size={24} className="rotate-180" />
            </button>
          )}
          <div>
            <h1 className="text-4xl font-bold serif text-stone-900">
              {view === 'dashboard' ? `${selectedService} Desk` : 'My Requests'}
            </h1>
            <p className="text-stone-500 mt-1">
              Manage your {selectedService?.toLowerCase()} requirements.
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} icon={Plus}>New Request</Button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateRequestModal 
            onClose={closeCreateModal} 
            profile={profile} 
            mainService={selectedService || 'Cleaning'} 
            initialData={rebookData || undefined}
          />
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <h2 className="text-2xl font-bold serif text-stone-800">
            {view === 'dashboard' ? 'Current Selections' : 'All Requests'}
          </h2>
          {requests.length === 0 ? (
            <div className="bg-white rounded-[40px] border border-dashed border-ui-accent p-16 text-center">
              <div className="w-20 h-20 bg-ui-bg rounded-full flex items-center justify-center text-ui-primary mx-auto mb-6">
                <Clock size={40} />
              </div>
              <h3 className="font-bold text-stone-900 mb-2 text-xl serif">No active requests</h3>
              <p className="text-stone-400 mb-10 max-w-sm mx-auto">Create your first request to let our network of professionals help you.</p>
              <Button onClick={() => setShowCreate(true)} variant="secondary" className="px-8">Post a Request</Button>
            </div>
          ) : (
            <div className="grid gap-6">
              {requests.map(req => (
                <RequestCard 
                  key={req.requestId} 
                  request={req} 
                  isProvider={false} 
                  onReview={onReview}
                  onRebook={handleRebook}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-8">
          <h2 className="text-2xl font-bold serif text-stone-800">Overview</h2>
          <Card className="p-8 border-ui-accent/50 bg-white shadow-xl shadow-ui-primary/5">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-stone-400 text-sm font-medium uppercase tracking-wider">Requests Posted</span>
                <span className="font-bold text-ui-primary text-xl">{requests.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-400 text-sm font-medium uppercase tracking-wider">Active Bookings</span>
                <span className="font-bold text-ui-primary text-xl">{activeBookings.length}</span>
              </div>
              <div className="pt-6 border-t border-ui-accent">
                <div className="flex items-start gap-4 text-stone-600 mb-2">
                  <div className="w-10 h-10 bg-ui-surface rounded-xl flex items-center justify-center text-ui-primary shrink-0">
                    <CheckCircle size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-stone-800">Curation Tip</p>
                    <p className="text-xs text-stone-400 leading-relaxed mt-1">Detailed descriptions help our professionals understand the unique needs of your home.</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const SERVICE_TO_SUB_CATEGORIES: Record<string, string[]> = {
  'Cleaning': ['Home Cleaning', 'Office Cleaning', 'Move In/Out', 'Window Cleaning', 'Carpet Cleaning', 'Deep Clean'],
  'HairCut': ['Men\'s Cut', 'Women\'s Cut', 'Styling', 'Coloring', 'Beard Trim'],
  'Handyman': ['Kleinhandwerk', 'Furniture Assembly', 'Painting', 'Electrical', 'Plumbing', 'Fixing & Mounting']
};

interface PlaceAutocompleteProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult | null) => void;
  className?: string;
  placeholder?: string;
  initialValue?: string;
}

const PlaceAutocomplete = ({ onPlaceSelect, className, placeholder, initialValue }: PlaceAutocompleteProps) => {
  const [placeAutocomplete, setPlaceAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary('places');

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const options = {
      fields: ['geometry', 'name', 'formatted_address']
    };
    setPlaceAutocomplete(new places.Autocomplete(inputRef.current, options));
  }, [places]);

  useEffect(() => {
    if (!placeAutocomplete) return;
    const listener = placeAutocomplete.addListener('place_changed', () => {
      onPlaceSelect(placeAutocomplete.getPlace());
    });
    return () => listener.remove();
  }, [onPlaceSelect, placeAutocomplete]);

  return (
    <input 
      ref={inputRef} 
      defaultValue={initialValue}
      placeholder={placeholder || "Street address, City"}
      className={className} 
    />
  );
};

function ChatInterface({ requestId, recipientId, displayName }: { requestId: string, recipientId: string, displayName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, `requests/${requestId}/messages`),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ ...doc.data() } as Message)));
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }, (e) => handleFirestoreError(e, OperationType.LIST, `requests/${requestId}/messages`));
    return unsubscribe;
  }, [requestId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;
    setLoading(true);
    const messageId = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const messageData: Message = {
      messageId,
      requestId,
      senderId: auth.currentUser!.uid,
      senderName: auth.currentUser!.displayName || 'User',
      text: newMessage,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, `requests/${requestId}/messages`, messageId), messageData);
      setNewMessage('');
      
      await triggerNotification(
        recipientId,
        'New Message',
        `${auth.currentUser!.displayName || 'Someone'} sent you a message about your request.`,
        'new_message',
        requestId
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `requests/${requestId}/messages/${messageId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-ui-surface/30">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <MessageSquare className="text-ui-accent mb-4" size={40} />
            <p className="text-stone-400 italic serif text-sm">Start the conversation with {displayName}.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            return (
              <div key={msg.messageId} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-[20px] text-sm font-medium shadow-sm border ${
                  isMe ? 'bg-ui-primary text-white border-ui-primary rounded-tr-none' : 'bg-white text-stone-800 border-ui-accent rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="p-6 bg-white border-t border-ui-accent flex gap-3 shrink-0">
        <input 
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Write a message..."
          className="flex-1 px-5 py-3 rounded-2xl bg-ui-bg border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none text-sm transition-all shadow-inner"
        />
        <button 
          disabled={!newMessage.trim() || loading}
          className="w-12 h-12 bg-ui-primary text-white rounded-2xl flex items-center justify-center hover:bg-opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:active:scale-100"
        >
          <Plus size={24} />
        </button>
      </form>
    </div>
  );
}

function RequestDetailModal({ onClose, request, isProvider }: { onClose: () => void, request: ServiceRequest, isProvider: boolean }) {
  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-lg z-[150] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        className="bg-ui-bg w-full max-w-4xl h-[85vh] rounded-[48px] overflow-hidden shadow-2xl border-8 border-white flex flex-col md:flex-row"
      >
        {/* Left Side: Info & Map */}
        <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-white">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 bg-ui-surface text-ui-primary rounded-full border border-ui-accent/50">
                  {request.category}
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full ${
                  request.status === 'open' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                  request.status === 'booked' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                  'bg-stone-100 text-stone-500 border border-stone-200'
                }`}>
                  {request.status}
                </span>
              </div>
              <button onClick={onClose} className="text-stone-300 hover:text-stone-500 transition-colors p-2 md:hidden">
                <Plus size={32} className="rotate-45" />
              </button>
          </div>

          <div>
            <h2 className="text-4xl font-bold serif text-stone-900 mb-4">{request.title}</h2>
            <p className="text-stone-500 leading-relaxed text-lg">{request.description}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-8 pt-8 border-t border-ui-accent/30">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-ui-surface rounded-2xl flex items-center justify-center text-ui-primary shrink-0 transition-transform hover:scale-110">
                  <MapPin size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Service Location</p>
                  <p className="font-bold text-stone-800 leading-tight">{request.location}</p>
                  {request.addressTag && <span className="text-[10px] bg-ui-primary/10 text-ui-primary px-2 py-0.5 rounded-md mt-2 inline-block">Saved as {request.addressTag}</span>}
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-ui-surface rounded-2xl flex items-center justify-center text-ui-primary shrink-0 transition-transform hover:scale-110">
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Scheduled Date</p>
                  <p className="font-bold text-stone-800 leading-tight">{request.scheduledDate}</p>
                  {request.isRecurring && <span className="text-[10px] text-ui-secondary font-bold uppercase mt-1 block">Repeats {request.recurrenceInterval}</span>}
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-ui-surface rounded-2xl flex items-center justify-center text-ui-primary shrink-0 transition-transform hover:scale-110">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Provider Type</p>
                  <p className="font-bold text-stone-800 leading-tight">{request.requiredCleaners || 'Any'}</p>
                </div>
              </div>
              {request.status === 'booked' && (
                 <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0 transition-transform hover:scale-110">
                    <Shield size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Assigned Partner</p>
                    <p className="font-bold text-stone-800 leading-tight">{isProvider ? request.customerName : request.providerName}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {request.lat && request.lng && (
            <div className="space-y-4 pt-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold serif text-stone-900">Exact Location Map</h3>
                <a 
                  href={`https://www.google.com/maps/dir/?api=1&destination=${request.lat},${request.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-primary text-xs font-bold uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  Open in Maps <ChevronRight size={14} />
                </a>
              </div>
              <div className="rounded-[40px] border-4 border-ui-bg overflow-hidden h-[300px] shadow-lg relative group">
                <Map
                  defaultCenter={{ lat: request.lat, lng: request.lng }}
                  defaultZoom={15}
                  mapId={`request_map_detail_${request.requestId}`}
                  disableDefaultUI
                  gestureHandling="cooperative"
                  className="w-full h-full"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                >
                  <AdvancedMarker position={{ lat: request.lat, lng: request.lng }}>
                    <Pin background="#f43f5e" glyphColor="#fff" scale={1.2} />
                  </AdvancedMarker>
                </Map>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Chat or Action */}
        <div className="w-full md:w-[400px] bg-ui-surface border-l border-ui-accent flex flex-col">
          <div className="p-8 border-b border-ui-accent flex items-center justify-between bg-white shrink-0">
             <div>
                <h3 className="font-bold text-stone-900 serif">Direct Messaging</h3>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Connect with your partner</p>
             </div>
             <button onClick={onClose} className="text-stone-300 hover:text-stone-500 transition-colors hidden md:block">
                <Plus size={32} className="rotate-45" />
             </button>
          </div>
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {request.status === 'booked' ? (
              <ChatInterface 
                requestId={request.requestId} 
                recipientId={isProvider ? request.customerId : request.providerId!} 
                displayName={isProvider ? request.customerName : request.providerName || 'Partner'}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-6">
                <div className="w-20 h-20 bg-white rounded-[32px] flex items-center justify-center text-ui-accent shadow-sm">
                  <Lock size={32} />
                </div>
                <div>
                  <h4 className="font-bold text-stone-800 serif text-lg mb-2">Chat is locked</h4>
                  <p className="text-sm text-stone-400 leading-relaxed">Direct communication becomes available once a booking is confirmed.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function CreateRequestModal({ onClose, profile, mainService, initialData }: { onClose: () => void, profile: UserProfile, mainService: string, initialData?: Partial<ServiceRequest> }) {
  const [loading, setLoading] = useState(false);
  const subCategories = SERVICE_TO_SUB_CATEGORIES[mainService] || ['General'];
  
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    category: initialData?.category || subCategories[0],
    location: initialData?.location || '',
    lat: initialData?.lat ?? (undefined as number | undefined),
    lng: initialData?.lng ?? (undefined as number | undefined),
    addressTag: initialData?.addressTag || '',
    scheduledDate: initialData?.scheduledDate || '',
    isRecurring: initialData?.isRecurring || false,
    recurrenceInterval: initialData?.recurrenceInterval || 'One-time' as 'One-time' | 'Weekly' | 'Bi-weekly' | 'Monthly',
    requiredCleaners: initialData?.requiredCleaners || 'Any' as 'Any' | 'Individual' | 'Group',
    urgent: initialData?.urgent || false
  });

  const handlePlaceSelect = (place: google.maps.places.PlaceResult | null) => {
    if (place && place.geometry && place.geometry.location) {
      setFormData({
        ...formData,
        location: place.formatted_address || place.name || '',
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        addressTag: 'Manual'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const requestId = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const newRequest: ServiceRequest = {
      requestId,
      customerId: profile.uid,
      customerName: profile.fullName,
      status: 'open',
      createdAt: new Date().toISOString(),
      quoteCount: 0,
      ...formData,
      lat: formData.lat || 0,
      lng: formData.lng || 0
    };

    try {
      await setDoc(doc(db, 'requests', requestId), newRequest);
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `requests/${requestId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-ui-bg w-full max-w-xl rounded-[48px] overflow-hidden shadow-2xl border-8 border-white"
      >
        <div className="p-10 border-b border-ui-accent bg-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-3xl font-bold serif text-stone-900">New Selection</h2>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
              <Plus size={28} className="rotate-45" />
            </button>
          </div>
          <p className="text-stone-400">Describe the environment for our professionals.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-10 space-y-8 bg-ui-bg max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-2">Service Title</label>
              <input 
                required
                placeholder="e.g. Minimalist Loft Deep Clean"
                className="w-full px-6 py-4 rounded-[20px] bg-white border border-ui-accent focus:ring-2 focus:ring-ui-primary focus:border-transparent outline-none transition-all placeholder:text-stone-300"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-2">Category</label>
                <div className="relative">
                  <select 
                    className="w-full px-6 py-4 rounded-[20px] bg-white border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all appearance-none pr-12"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    {subCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-stone-300">
                    <ChevronRight size={16} className="rotate-90" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-2">Preferred Date</label>
                <input 
                  type="date"
                  required
                  className="w-full px-6 py-4 rounded-[20px] bg-white border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all"
                  value={formData.scheduledDate}
                  onChange={e => setFormData({ ...formData, scheduledDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-2">Deployment Site</label>
              <div className="grid gap-3">
                {profile.addresses && profile.addresses.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {profile.addresses.map(addr => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => setFormData({ 
                          ...formData, 
                          location: addr.text, 
                          addressTag: addr.tag,
                          lat: addr.lat,
                          lng: addr.lng
                        })}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${formData.addressTag === addr.tag ? 'bg-ui-primary text-white border-ui-primary shadow-md' : 'bg-white text-stone-500 border-ui-accent hover:border-ui-primary'}`}
                      >
                        {addr.tag}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData({ 
                      ...formData, 
                      location: '', 
                      addressTag: 'Manual',
                      lat: undefined,
                      lng: undefined
                    })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${formData.addressTag === 'Manual' ? 'bg-ui-primary text-white border-ui-primary shadow-md' : 'bg-white text-stone-500 border-ui-accent hover:border-ui-primary'}`}
                    >
                      New Address
                    </button>
                  </div>
                ) : null}
                
                <div className="relative">
                  <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none" size={20} />
                  <PlaceAutocomplete 
                    onPlaceSelect={handlePlaceSelect}
                    initialValue={formData.location}
                    placeholder="Street address, City"
                    className="w-full pl-14 pr-6 py-4 rounded-[20px] bg-white border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all placeholder:text-stone-300"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-4">Service Frequency</label>
              <div className="grid grid-cols-4 gap-3">
                {['One-time', 'Weekly', 'Bi-weekly', 'Monthly'].map(interval => (
                  <button
                    key={interval}
                    type="button"
                    onClick={() => setFormData({ 
                      ...formData, 
                      recurrenceInterval: interval as any, 
                      isRecurring: interval !== 'One-time' 
                    })}
                    className={`py-3 rounded-2xl text-[10px] font-bold border transition-all ${formData.recurrenceInterval === interval ? 'bg-ui-primary text-white border-ui-primary shadow-md' : 'bg-white text-stone-500 border-ui-accent hover:border-ui-primary'}`}
                  >
                    {interval}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-4">Cleaner Preference</label>
              <div className="grid grid-cols-3 gap-4">
                {['Individual', 'Group', 'Any'].map(pref => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setFormData({ ...formData, requiredCleaners: pref as any })}
                    className={`py-3 rounded-2xl text-xs font-bold border transition-all ${formData.requiredCleaners === pref ? 'bg-ui-primary text-white border-ui-primary shadow-lg' : 'bg-white text-stone-500 border-ui-accent hover:border-ui-primary'}`}
                  >
                    {pref === 'Individual' ? 'Sole Professional' : pref === 'Group' ? 'Ensemble/Team' : 'No Preference'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-2">Service Details</label>
              <textarea 
                rows={3}
                placeholder="Share your requirements or special instructions..."
                className="w-full px-6 py-4 rounded-[20px] bg-white border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all placeholder:text-stone-300"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            
            <label className="flex items-center gap-4 cursor-pointer group">
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.urgent ? 'bg-ui-primary border-ui-primary' : 'border-ui-accent group-hover:border-ui-primary'}`}>
                {formData.urgent && <CheckCircle size={14} className="text-white" />}
              </div>
              <input 
                type="checkbox" 
                className="hidden"
                checked={formData.urgent}
                onChange={e => setFormData({ ...formData, urgent: e.target.checked })}
              />
              <span className="text-sm font-semibold text-stone-600">Mark as priority request</span>
            </label>
          </div>

          <div className="flex gap-4 pt-4 shrink-0">
            <Button className="flex-1 py-5 text-lg" onClick={() => {}}>{loading ? 'Curating...' : 'Post Request'}</Button>
            <Button variant="outline" type="button" onClick={onClose} className="px-8">Cancel</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// --------------------------------------------------------------------------------
// Review List Component
// --------------------------------------------------------------------------------

function ReviewList({ providerId }: { providerId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map(doc => ({ ...doc.data() } as Review)));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'reviews'));
    return unsubscribe;
  }, [providerId]);

  if (reviews.length === 0) return null;

  return (
    <div className="space-y-6 pt-10 border-t border-ui-accent">
      <h3 className="text-xl font-bold serif text-stone-800">Client Testimonials</h3>
      <div className="grid md:grid-cols-2 gap-6">
        {reviews.map(review => (
          <Card key={review.reviewId} className="p-6 border-ui-accent/50 lg:p-8">
             <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-ui-surface rounded-full flex items-center justify-center text-ui-primary font-bold">
                  {review.customerName[0]}
                </div>
                <div>
                  <p className="font-bold text-stone-800 leading-none">{review.customerName}</p>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">Verified Client</p>
                </div>
              </div>
              <div className="flex text-ui-secondary">
                {[1, 2, 3, 4, 5].map(star => (
                   <Star key={star} size={14} fill={star <= review.rating ? 'currentColor' : 'none'} className={star <= review.rating ? 'text-ui-secondary' : 'text-stone-200'} />
                ))}
              </div>
            </div>
            {review.comment && (
              <p className="text-sm text-stone-600 italic leading-relaxed">"{review.comment}"</p>
            )}
            <p className="text-[10px] text-stone-300 font-bold uppercase tracking-widest mt-4">
              {format(parseISO(review.createdAt), 'MMMM yyyy')}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------
// Provider Views
// --------------------------------------------------------------------------------

function ProviderView({ profile, view, setView }: { profile: UserProfile, view: string, setView: (v: any) => void }) {
  const [availableRequests, setAvailableRequests] = useState<ServiceRequest[]>([]);
  const [bookedRequests, setBookedRequests] = useState<ServiceRequest[]>([]);

  useEffect(() => {
    // Open Requests
    const qOpen = query(
      collection(db, 'requests'), 
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );
    const unsubOpen = onSnapshot(qOpen, (snapshot) => {
      setAvailableRequests(snapshot.docs.map(doc => ({ ...doc.data() } as ServiceRequest)));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'requests'));

    // Booked Requests
    const qBooked = query(
      collection(db, 'requests'),
      where('providerId', '==', profile.uid),
      where('status', '==', 'booked'),
      orderBy('createdAt', 'desc')
    );
    const unsubBooked = onSnapshot(qBooked, (snapshot) => {
      setBookedRequests(snapshot.docs.map(doc => ({ ...doc.data() } as ServiceRequest)));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'requests'));

    return () => {
      unsubOpen();
      unsubBooked();
    };
  }, [profile.uid]);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold serif text-stone-900">
            {view === 'dashboard' ? 'Professional Suite' : 'Jobs Market'}
          </h1>
          <p className="text-stone-500 mt-1">
            {view === 'dashboard' ? 'Discover opportunities that match your expertise.' : 'Review open requests from clients.'}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white border border-ui-accent text-ui-secondary px-5 py-2.5 rounded-2xl flex items-center gap-2 font-bold shadow-sm">
            <Star size={20} fill="currentColor" />
            <span className="text-lg">{profile.rating?.toFixed(1)}</span>
          </div>
          <div className="bg-ui-primary text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 font-bold shadow-sm">
            <CheckCircle size={20} />
            <span className="text-lg">{profile.totalJobs} Jobs</span>
          </div>
        </div>
      </div>

      {view === 'market' || view === 'dashboard' ? (
        <div className="grid lg:grid-cols-4 gap-10">
          {view === 'market' && (
            <aside className="lg:col-span-1 space-y-8">
              <h2 className="text-xl font-bold serif flex items-center gap-2 text-stone-800">
                <Filter size={20} />
                Refine Search
              </h2>
              <Card className="p-8 space-y-8 border-ui-accent bg-ui-surface/30">
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-4">Categories</label>
                  <div className="space-y-3">
                    {['Home Cleaning', 'Deep Clean', 'Office', 'Move In/Out'].map(cat => (
                      <label key={cat} className="flex items-center gap-3 text-sm text-stone-600 cursor-pointer hover:text-stone-900 transition-colors group">
                        <div className="w-5 h-5 rounded border-2 border-ui-accent bg-white group-hover:border-ui-primary transition-all flex items-center justify-center">
                          <div className="w-2.5 h-2.5 bg-ui-primary rounded-sm opacity-0 group-has-[:checked]:opacity-100 transition-all" />
                        </div>
                        <input type="checkbox" className="hidden" defaultChecked />
                        {cat}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="pt-8 border-t border-ui-accent">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-4">Max Distance</label>
                  <input type="range" className="w-full accent-ui-primary" />
                  <div className="flex justify-between text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-3">
                    <span>5km</span>
                    <span>50km</span>
                  </div>
                </div>
              </Card>
            </aside>
          )}

          <div className={view === 'market' ? 'lg:col-span-3 space-y-8' : 'lg:col-span-4 space-y-8'}>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold serif text-stone-800">Available Engagements ({availableRequests.length})</h2>
              <span className="text-xs text-ui-secondary font-bold uppercase tracking-widest bg-ui-secondary/10 px-3 py-1 rounded-full">Live Market</span>
            </div>
            
            {availableRequests.length === 0 ? (
              <div className="bg-white rounded-[40px] border border-dashed border-ui-accent p-20 text-center">
                <p className="text-stone-400 serif text-xl italic">The market is currently quiet...</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {availableRequests.map(req => (
                  <RequestCard key={req.requestId} request={req} isProvider={true} profile={profile} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold serif text-stone-800">Active Engagements</h2>
              <span className="text-xs text-blue-500 font-bold uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">Booked Sessions</span>
            </div>
            
            {bookedRequests.length === 0 ? (
              <div className="bg-white rounded-[40px] border border-dashed border-ui-accent p-20 text-center">
                <p className="text-stone-400 italic">No booked sessions currently. Check the Market for opportunities.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {bookedRequests.map(req => (
                  <RequestCard key={req.requestId} request={req} isProvider={true} profile={profile} />
                ))}
              </div>
            )}
          </div>
          <div className="space-y-8">
             <h2 className="text-2xl font-bold serif text-stone-800">Performance</h2>
             <Card className="p-10 bg-ui-primary text-white border-0 relative overflow-hidden shadow-2xl shadow-ui-primary/20">
                <div className="absolute -right-8 -top-8 w-48 h-48 bg-stone-300/10 rounded-full blur-3xl" />
                <Sparkle className="absolute -right-4 -top-4 text-white opacity-10 w-40 h-40" />
                <p className="text-ui-accent/80 text-xs font-bold uppercase tracking-[0.2em] mb-2">Cycle Earnings</p>
                <h3 className="text-5xl font-bold serif tracking-tight">$1,240.50</h3>
                <div className="mt-8 flex items-center gap-3">
                  <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold">+12% vs last cycle</span>
                  <span className="text-[10px] text-ui-accent/60 italic font-medium">Updated 5m ago</span>
                </div>
             </Card>
          </div>
        </div>
      )}
      {view === 'dashboard' && <ReviewList providerId={profile.uid} />}
    </div>
  );
}

// UI Helpers

function RequestCard({ request, isProvider, onReview, onRebook, profile }: any) {
  const [showQuotes, setShowQuotes] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [showQuoteForm, setShowQuoteForm] = useState(false);

  useEffect(() => {
    if (showQuotes || isProvider) {
      const q = query(collection(db, `requests/${request.requestId}/quotes`), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setQuotes(snapshot.docs.map(doc => ({ ...doc.data() } as Quote)));
      });
      return unsubscribe;
    }
  }, [showQuotes, request.requestId, isProvider]);

  const stats = [
    { icon: MapPin, text: request.location + (request.addressTag ? ` [${request.addressTag}]` : '') },
    { icon: Calendar, text: request.scheduledDate + (request.isRecurring ? ` (${request.recurrenceInterval})` : '') },
    { icon: Users, text: request.requiredCleaners || 'Any' },
    { icon: MessageSquare, text: `${request.quoteCount || 0} Quotes` },
  ];

  const [showChat, setShowChat] = useState(false);

  return (
    <Card className="relative group border-ui-accent/40 shadow-xl shadow-ui-primary/5 transition-all hover:shadow-ui-primary/10">
      {request.urgent && (
        <div className="absolute top-0 right-10 bg-ui-secondary text-white text-[10px] uppercase font-bold tracking-[0.2em] px-4 py-1.5 rounded-b-2xl shadow-sm">
          Priority
        </div>
      )}
      <div className="p-8">
        <div className="flex justify-between items-start gap-6 mb-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 bg-ui-surface text-ui-primary rounded-full border border-ui-accent/50">
                {request.category}
              </span>
              {request.isRecurring && (
                <span className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 bg-ui-primary text-white rounded-full flex items-center gap-1.5 shadow-sm">
                  <Zap size={10} fill="currentColor" /> {request.recurrenceInterval}
                </span>
              )}
              <span className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full ${
                request.status === 'open' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                request.status === 'booked' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                'bg-stone-100 text-stone-500 border border-stone-200'
              }`}>
                {request.status}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-stone-900 serif group-hover:text-ui-primary transition-colors">
              {request.title}
            </h3>
          </div>
          <button 
            onClick={() => setShowDetails(true)}
            className="text-ui-secondary font-bold text-xs hover:underline flex items-center gap-1 uppercase tracking-widest"
          >
            Details <ChevronRight size={14} />
          </button>
        </div>

        <p className="text-stone-500 text-sm mb-8 leading-relaxed max-w-2xl">{request.description}</p>

        {request.status === 'booked' && (
          <div className="space-y-6 mb-8">
            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                  <Briefcase size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none mb-1">Assigned Partner</p>
                  <p className="font-bold text-stone-800">{isProvider ? request.customerName : request.providerName}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setShowDetails(true)} variant="secondary" className="bg-white" icon={MessageSquare}>
                  Chat
                </Button>
                {!isProvider && (
                  <Button 
                    onClick={async () => {
                      if (!window.confirm("Mark this service as completed?")) return;
                      try {
                        await setDoc(doc(db, 'requests', request.requestId), { status: 'completed' }, { merge: true });
                        await triggerNotification(
                          request.providerId!,
                          'Service Completed',
                          `The client marked the service for "${request.title}" as completed.`,
                          'status_update',
                          request.requestId
                        );
                      } catch (e) {
                        handleFirestoreError(e, OperationType.UPDATE, `requests/${request.requestId}`);
                      }
                    }} 
                    variant="primary" 
                    icon={CheckCircle}
                    className="bg-emerald-600 border-emerald-600 hover:bg-emerald-700"
                  >
                    Complete
                  </Button>
                )}
              </div>
            </div>

            {request.lat && request.lng && (
              <div className="rounded-3xl border border-ui-accent overflow-hidden h-48 bg-stone-100 relative group/map">
                <Map
                  defaultCenter={{ lat: request.lat, lng: request.lng }}
                  defaultZoom={15}
                  mapId={`request_map_${request.requestId}`}
                  disableDefaultUI
                  gestureHandling="cooperative"
                  className="w-full h-full"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                >
                  <AdvancedMarker position={{ lat: request.lat, lng: request.lng }}>
                    <Pin background="#f43f5e" glyphColor="#fff" />
                  </AdvancedMarker>
                </Map>
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end opacity-0 group-hover/map:opacity-100 transition-opacity">
                   <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl text-[10px] font-bold text-stone-600 border border-white/50 shadow-lg">
                      EXACT LOCATION PREVIEW
                   </div>
                   <button 
                     onClick={() => setShowDetails(true)}
                     className="bg-ui-primary text-white p-2 rounded-xl shadow-lg hover:scale-105 transition-transform"
                   >
                     <ChevronRight size={18} />
                   </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-8 pt-8 border-t border-ui-accent/30">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs text-stone-400 font-bold uppercase tracking-widest">
              <stat.icon size={18} className="text-ui-accent" />
              <span>{stat.text}</span>
            </div>
          ))}
          <div className="ml-auto">
            {isProvider ? (
              request.status === 'open' && (
                <Button onClick={() => setShowQuoteForm(true)} variant={quotes.some(q => q.providerId === auth.currentUser?.uid) ? 'outline' : 'primary'} className="px-8">
                  {quotes.some(q => q.providerId === auth.currentUser?.uid) ? 'View My Quote' : 'Submit Proposal'}
                </Button>
              )
            ) : (
              <div className="flex gap-4">
                {request.status === 'open' && (
                  <Button variant="secondary" onClick={() => setShowQuotes(!showQuotes)} className="px-8">
                    {showQuotes ? 'Hide Quotes' : `View ${quotes.length || request.quoteCount} Quotes`}
                  </Button>
                )}
                {request.status === 'completed' && (
                  <div className="flex gap-4">
                    {onRebook && (
                      <Button onClick={() => onRebook(request)} variant="primary" icon={Plus} className="px-8">
                        Book Again
                      </Button>
                    )}
                    {onReview && (
                      <Button onClick={() => onReview(request)} variant="secondary" icon={Star} className="px-8">
                        Leave Feedback
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDetails && (
          <RequestDetailModal 
            onClose={() => setShowDetails(false)} 
            request={request} 
            isProvider={isProvider} 
          />
        )}
        {showQuotes && !isProvider && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-ui-accent/30 bg-ui-surface/20 overflow-hidden"
          >
            <div className="p-8 space-y-6">
              <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] px-1">Curated Proposals</h4>
              {quotes.length === 0 ? (
                <p className="text-stone-400 serif text-lg italic py-6">Waiting for matching professionals...</p>
              ) : (
                <div className="grid gap-4">
                  {quotes.map(quote => (
                    <QuoteItem key={quote.quoteId} quote={quote} requestId={request.requestId} onAccept={() => {}} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {showQuoteForm && isProvider && (
          <QuoteFormModal 
            onClose={() => setShowQuoteForm(false)} 
            request={request} 
            existingQuote={quotes.find(q => q.providerId === auth.currentUser?.uid)} 
            profile={profile}
          />
        )}
      </AnimatePresence>
    </Card>
  );
}

function QuoteItem({ quote, requestId, onAccept }: any) {
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!window.confirm("BINDING ORDER: Are you sure you want to accept this quote? This will create a binding contract and close the request to other professionals.")) return;
    setLoading(true);
    try {
      // Accept this quote
      await setDoc(doc(db, `requests/${requestId}/quotes`, quote.quoteId), { status: 'accepted' }, { merge: true });
      
      // Update request status
      await setDoc(doc(db, `requests`, requestId), { 
        status: 'booked',
        providerId: quote.providerId,
        providerName: quote.providerName
      }, { merge: true });

      // Reject other quotes
      const otherQuotesQuery = query(
        collection(db, `requests/${requestId}/quotes`),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(otherQuotesQuery);
      const batchPromises = snapshot.docs.map(d => 
        setDoc(doc(db, `requests/${requestId}/quotes`, d.id), { status: 'rejected' }, { merge: true })
      );
      await Promise.all(batchPromises);
      
      // Notify Provider
      await triggerNotification(
        quote.providerId,
        'Binding Order Confirmed!',
        `Your proposal for "${requestId}" has been accepted as a binding order. Please check your dashboard for deployment details.`,
        'booking_accepted',
        requestId
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `requests/${requestId}/quotes/${quote.quoteId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-[24px] border border-ui-accent/50 flex items-center gap-6 shadow-sm group/quote hover:shadow-md transition-all">
      <img src={quote.providerAvatar || `https://ui-avatars.com/api/?name=${quote.providerName}`} className="w-14 h-14 rounded-2xl border-2 border-white shadow-sm" alt="Pro" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <h5 className="font-bold text-stone-800 serif text-lg">{quote.providerName}</h5>
          <div className="flex text-amber-400 gap-0.5"><Star size={12} fill="currentColor" /> <Star size={12} fill="currentColor" /> <Star size={12} fill="currentColor" /></div>
        </div>
        {quote.assignedEmployees && quote.assignedEmployees.length > 0 && (
          <div className="flex gap-2 mb-2">
            {quote.assignedEmployees.map((emp: string) => (
              <span key={emp} className="text-[9px] font-bold uppercase tracking-tight bg-ui-surface px-2 py-0.5 rounded border border-ui-accent text-stone-500">
                {emp}
              </span>
            ))}
          </div>
        )}
        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-2">
          {quote.priceType === 'Hourly' ? `${quote.amount}€/h` : `Fixed: ${quote.amount}€`}
          {quote.transportCost > 0 && ` + ${quote.transportCost}€ Trans.`}
          {quote.materialCost > 0 ? ` + ${quote.materialCost}€ Mat.` : (quote.materialIncluded ? ' (Mat. Inc.)' : '')}
        </p>
        <p className="text-xs text-stone-400 italic line-clamp-1 mt-1">"{quote.message}"</p>
      </div>
      <div className="text-right pl-6 border-l border-ui-accent/30 min-w-[140px]">
        <div className="mb-2">
          <p className="text-2xl font-bold text-ui-primary serif leading-none">€{(quote.amount || 0) + (quote.transportCost || 0) + (quote.materialCost || 0)}</p>
          {quote.isNegotiable && (
            <span className="text-[9px] font-bold text-ui-secondary uppercase tracking-tighter bg-ui-secondary/10 px-1.5 py-0.5 rounded mt-1 inline-block">Negotiable</span>
          )}
        </div>
        {quote.status === 'pending' ? (
          <div className="flex flex-col gap-2">
            <Button onClick={handleAccept} variant="primary" className="py-2.5 px-4 text-[10px] uppercase font-bold">{loading ? '...' : 'Reserve Now'}</Button>
            {quote.isNegotiable && (
              <button 
                onClick={() => {
                  const offer = window.prompt("What is your counter-offer or question?");
                  if (offer) {
                    // This would ideally send a message via Chat
                    alert("Your interest has been shared with the professional.");
                  }
                }}
                className="text-[9px] font-bold text-stone-400 uppercase tracking-widest hover:text-ui-primary transition-colors"
              >
                Bargain
              </button>
            )}
          </div>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5 justify-center">
            <CheckCircle size={10} /> Reserved
          </span>
        )}
      </div>
    </div>
  );
}

function SettingsView({ profile, onUpdate, setView }: { profile: UserProfile, onUpdate: (p: UserProfile) => void, setView: (v: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<'address' | 'employee' | 'avatar' | null>(null);
  const [formData, setFormData] = useState({
    fullName: profile.fullName,
    bio: profile.bio || '',
    serviceArea: profile.serviceArea || '',
    skills: profile.skills?.join(', ') || ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const now = new Date().toISOString();
    const updatedProfile: UserProfile = {
      ...profile,
      fullName: formData.fullName,
      bio: formData.bio,
      serviceArea: formData.serviceArea,
      skills: formData.skills.split(',').map(s => s.trim()).filter(s => s !== ''),
      createdAt: profile.createdAt || now,
      updatedAt: now
    };

    try {
      const updateData = {
        fullName: updatedProfile.fullName,
        bio: updatedProfile.bio,
        serviceArea: updatedProfile.serviceArea,
        skills: updatedProfile.skills,
        updatedAt: updatedProfile.updatedAt
      };
      await setDoc(doc(db, 'users', profile.uid), updateData, { merge: true });
      onUpdate(updatedProfile);
      alert('Profile updated successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <AnimatePresence>
        {activeModal === 'address' && (
          <AddressModal 
            onClose={() => setActiveModal(null)} 
            onSave={async (tag, text, lat, lng) => {
              try {
                const now = new Date().toISOString();
                const newAddr = { id: Math.random().toString(36).substring(7), tag, text, lat, lng };
                const newAddresses = [...(profile.addresses || []), newAddr];
                await setDoc(doc(db, 'users', profile.uid), { addresses: newAddresses, updatedAt: now }, { merge: true });
                onUpdate({ ...profile, addresses: newAddresses, updatedAt: now });
                setActiveModal(null);
                alert('Address added successfully!');
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
              }
            }} 
          />
        )}
        {activeModal === 'employee' && (
          <EmployeeModal 
            onClose={() => setActiveModal(null)} 
            onSave={async (realName, pseudoName) => {
              try {
                const now = new Date().toISOString();
                const newEmp = { id: Math.random().toString(36).substring(7), realName, pseudoName, role: 'Cleaner', active: true };
                const newEmployees = [...(profile.employees || []), newEmp];
                await setDoc(doc(db, 'users', profile.uid), { employees: newEmployees, updatedAt: now }, { merge: true });
                onUpdate({ ...profile, employees: newEmployees, updatedAt: now });
                setActiveModal(null);
                alert('Team member added successfully!');
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
              }
            }} 
          />
        )}
        {activeModal === 'avatar' && (
          <AvatarModal 
            onClose={() => setActiveModal(null)} 
            currentUrl={profile.avatarUrl || ''}
            onSave={async (url) => {
              try {
                const now = new Date().toISOString();
                await setDoc(doc(db, 'users', profile.uid), { avatarUrl: url, updatedAt: now }, { merge: true });
                onUpdate({ ...profile, avatarUrl: url, updatedAt: now });
                setActiveModal(null);
                alert('Profile image updated!');
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
              }
            }} 
          />
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold serif text-stone-900">Professional Identity</h1>
          <p className="text-stone-500 mt-1">Refine how you present your expertise to the world.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-10">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-ui-accent text-center">
            <div className="relative inline-block mb-6 group cursor-pointer" onClick={() => setActiveModal('avatar')}>
              <img 
                src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${profile.fullName}`} 
                className="w-32 h-32 rounded-full border-4 border-white shadow-xl group-hover:opacity-80 transition-opacity" 
                alt="Avatar" 
              />
              <div className="absolute bottom-1 right-1 bg-ui-primary text-white p-2 rounded-full shadow-lg group-hover:scale-110 transition-transform">
                <Sparkle size={16} />
              </div>
            </div>
            <h3 className="text-xl font-bold text-stone-900 serif">{profile.fullName}</h3>
            <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">{profile.role}</p>
          </div>
          
          <Card className="p-6 border-ui-accent bg-ui-surface/30">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">Identity & Verification</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ui-accent/50">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-stone-400" />
                  <span className="text-sm text-stone-600">Email</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-stone-900 truncate max-w-[120px]">{profile.email}</span>
                  <CheckCircle size={14} className="text-emerald-500" />
                </div>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-ui-accent/50">
                <div className="flex items-center gap-2">
                  <Smartphone size={14} className="text-stone-400" />
                  <span className="text-sm text-stone-600">Phone</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-stone-900">{profile.phoneNumber}</span>
                  {profile.phoneVerified && <CheckCircle size={14} className="text-emerald-500" />}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-600">Rating</span>
                <span className="font-bold text-ui-secondary flex items-center gap-1">
                  <Star size={14} fill="currentColor" /> {profile.rating?.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-600">Jobs Completed</span>
                <span className="font-bold text-stone-900">{profile.totalJobs}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="md:col-span-2">
          <form onSubmit={handleSave} className="bg-white p-10 rounded-[48px] border border-ui-accent shadow-xl shadow-ui-primary/5 space-y-8">
            <div className="grid gap-8">
              <div>
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Full Name</label>
                <input 
                  required
                  className="w-full px-6 py-4 rounded-[20px] bg-ui-bg border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all font-medium text-stone-800"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Professional Bio</label>
                <textarea 
                  rows={4}
                  placeholder="Share your experience and philosophy..."
                  className="w-full px-6 py-4 rounded-[20px] bg-ui-bg border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all font-medium text-stone-600 text-sm"
                  value={formData.bio}
                  onChange={e => setFormData({ ...formData, bio: e.target.value })}
                />
              </div>

              {profile.role === 'provider' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Service Area</label>
                    <div className="relative">
                      <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-300" size={20} />
                      <input 
                        placeholder="e.g. Greater London, Kensington..."
                        className="w-full pl-14 pr-6 py-4 rounded-[20px] bg-ui-bg border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all font-medium text-stone-600"
                        value={formData.serviceArea}
                        onChange={e => setFormData({ ...formData, serviceArea: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Skills & Specializations</label>
                    <input 
                      placeholder="e.g. Steam Cleaning, Eco-Friendly, Upholstery (comma separated)"
                      className="w-full px-6 py-4 rounded-[20px] bg-ui-bg border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all font-medium text-stone-600"
                      value={formData.skills}
                      onChange={e => setFormData({ ...formData, skills: e.target.value })}
                    />
                    <p className="text-[10px] text-stone-400 mt-2 ml-2 italic">Separate multiple skills with commas.</p>
                  </div>
                </>
              )}
            </div>

            <div className="pt-6 border-t border-ui-accent flex gap-4">
              <Button className="px-10 py-4" onClick={() => {}}>{loading ? 'Saving...' : 'Update Identity'}</Button>
              <Button variant="outline" type="button" onClick={() => setView('dashboard')} className="px-10">Back to Dashboard</Button>
            </div>
          </form>

          {profile.role === 'customer' && (
            <div className="mt-12 bg-white p-10 rounded-[48px] border border-ui-accent shadow-xl shadow-ui-primary/5 space-y-8">
              <div>
                <h3 className="text-xl font-bold serif text-stone-900 mb-2">Saved Addresses</h3>
                <p className="text-sm text-stone-500 mb-6">Manage your frequently used cleaning locations.</p>
                <div className="grid gap-4">
                  {profile.addresses?.map(addr => (
                    <div key={addr.id} className="flex items-center justify-between p-4 bg-ui-surface rounded-2xl border border-ui-accent">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-ui-primary bg-white px-2 py-1 rounded-md border border-ui-accent mb-1 inline-block">{addr.tag}</span>
                        <p className="font-bold text-stone-800">{addr.text}</p>
                      </div>
                      <button 
                        onClick={async () => {
                          const now = new Date().toISOString();
                          const newAddresses = profile.addresses?.filter(a => a.id !== addr.id) || [];
                          await setDoc(doc(db, 'users', profile.uid), { addresses: newAddresses, updatedAt: now }, { merge: true });
                          onUpdate({ ...profile, addresses: newAddresses, updatedAt: now });
                        }}
                        className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                      >
                        <Plus className="rotate-45" size={20} />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setActiveModal('address')}
                    className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-ui-accent rounded-2xl text-stone-400 hover:text-ui-primary hover:border-ui-primary transition-all font-bold text-sm"
                  >
                    <Plus size={20} /> Add New Address
                  </button>
                </div>
              </div>
            </div>
          )}

          {profile.role === 'provider' && (
            <div className="mt-12 bg-white p-10 rounded-[48px] border border-ui-accent shadow-xl shadow-ui-primary/5 space-y-8">
              <div>
                <h3 className="text-xl font-bold serif text-stone-900 mb-2">Manage Team</h3>
                <p className="text-sm text-stone-500 mb-6">List your employees for professional job assignment.</p>
                <div className="grid gap-4">
                  {profile.employees?.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between p-4 bg-ui-surface rounded-2xl border border-ui-accent">
                      <div>
                        <p className="font-bold text-stone-800">{emp.realName} <span className="text-stone-400 font-normal text-sm ml-2">({emp.pseudoName})</span></p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{emp.role || 'Member'}</p>
                      </div>
                      <button 
                        onClick={async () => {
                          const now = new Date().toISOString();
                          const newEmployees = profile.employees?.filter(e => e.id !== emp.id) || [];
                          await setDoc(doc(db, 'users', profile.uid), { employees: newEmployees, updatedAt: now }, { merge: true });
                          onUpdate({ ...profile, employees: newEmployees, updatedAt: now });
                        }}
                        className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                      >
                        <Plus className="rotate-45" size={20} />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setActiveModal('employee')}
                    className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-ui-accent rounded-2xl text-stone-400 hover:text-ui-primary hover:border-ui-primary transition-all font-bold text-sm"
                  >
                    <Plus size={20} /> Add Team Member
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddressModal({ onClose, onSave }: { onClose: () => void, onSave: (tag: string, text: string, lat?: number, lng?: number) => Promise<void> }) {
  const [tag, setTag] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  
  const [markerRef, marker] = useAdvancedMarkerRef();
  const map = useMap();

  useEffect(() => {
    if (map && selectedLocation) {
      map.panTo(selectedLocation);
      map.setZoom(17);
    }
  }, [map, selectedLocation]);

  const handleSave = async () => {
    if (!tag || !text) return;
    setLoading(true);
    try {
      await onSave(tag, text, selectedLocation?.lat, selectedLocation?.lng);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-4xl rounded-[48px] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="grid md:grid-cols-2 h-[600px]">
          <form 
            className="p-10 space-y-8 overflow-y-auto"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div>
              <h2 className="text-3xl font-bold serif text-stone-900 mb-2">New Location</h2>
              <p className="text-stone-500">Search and save a new address.</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Search Address</label>
                <PlaceAutocomplete 
                  onPlaceSelect={(place) => {
                    if (place?.geometry?.location) {
                      const lat = place.geometry.location.lat();
                      const lng = place.geometry.location.lng();
                      setSelectedLocation({ lat, lng });
                      setText(place.formatted_address || '');
                      // Auto-suggest tag based on place name or locality
                      if (place.name && !tag) {
                        setTag(place.name.substring(0, 20));
                      }
                    }
                  }} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Label (e.g. Home, Office, Site A) <span className="text-red-500">*</span></label>
                <input 
                  className="w-full px-6 py-4 rounded-[20px] bg-ui-bg border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all font-medium text-stone-800"
                  placeholder="e.g. My Home"
                  required
                  value={tag}
                  onChange={e => setTag(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Confirmed Address <span className="text-red-500">*</span></label>
                <textarea 
                  rows={2}
                  className="w-full px-6 py-4 rounded-[20px] bg-ui-bg border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all font-medium text-stone-600 text-sm"
                  placeholder="Search above or type address here..."
                  value={text}
                  required
                  onChange={e => setText(e.target.value)}
                />
                {!text && !selectedLocation && (
                  <p className="mt-2 text-[10px] text-stone-400 italic">Tip: Use the search bar above for best results</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-4">
              {(!tag || !text) && (
                <p className="text-[10px] text-red-500 font-bold text-center uppercase tracking-wider animate-pulse">
                  Please provide both a label and an address
                </p>
              )}
              <div className="flex gap-4">
                <Button 
                  type="submit"
                  className="flex-1 py-4" 
                  disabled={!tag || !text || loading}
                >
                  {loading ? 'Saving Details...' : 'Save Details'}
                </Button>
                <Button type="button" variant="outline" className="px-8" onClick={onClose} disabled={loading}>Cancel</Button>
              </div>
            </div>
          </form>

          <div className="relative bg-stone-100 hidden md:block">
            <Map
              defaultCenter={{ lat: 51.5074, lng: -0.1278 }}
              defaultZoom={11}
              mapId="ADDRESS_MODAL_MAP"
              className="h-full w-full"
              disableDefaultUI
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
              {selectedLocation && (
                <AdvancedMarker 
                  ref={markerRef}
                  position={selectedLocation}
                >
                  <Pin background="#f43f5e" glyphColor="#fff" borderColor="#be123c" />
                </AdvancedMarker>
              )}
            </Map>
            <div className="absolute top-6 left-6 right-6">
              <div className="bg-white/90 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-lg border border-white/50 flex items-center gap-3">
                <MapPin className="text-ui-secondary shrink-0" size={20} />
                <p className="text-xs font-medium text-stone-600">Drag to adjust the exact location</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}



function EmployeeModal({ onClose, onSave }: { onClose: () => void, onSave: (realName: string, pseudoName: string) => Promise<void> }) {
  const [realName, setRealName] = useState('');
  const [pseudoName, setPseudoName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!realName || !pseudoName) return;
    setLoading(true);
    try {
      await onSave(realName, pseudoName);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold serif text-stone-900 mb-2">Team Member</h2>
            <p className="text-stone-500">Add a new professional to your roster.</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Real Name (Internal)</label>
              <input 
                autoFocus
                className="w-full px-6 py-4 rounded-[20px] bg-ui-bg border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all font-medium text-stone-800"
                value={realName}
                onChange={e => setRealName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Pseudo Name (Client View)</label>
              <input 
                className="w-full px-6 py-4 rounded-[20px] bg-ui-bg border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all font-medium text-stone-800"
                value={pseudoName}
                onChange={e => setPseudoName(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button className="flex-1 py-4" onClick={handleSave} disabled={!realName || !pseudoName || loading}>
              {loading ? 'Adding...' : 'Add Member'}
            </Button>
            <Button variant="outline" className="px-8" onClick={onClose} disabled={loading}>Cancel</Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AvatarModal({ onClose, currentUrl, onSave }: { onClose: () => void, currentUrl: string, onSave: (url: string) => Promise<void> }) {
  const [url, setUrl] = useState(currentUrl);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-10 space-y-8 text-center">
          <div>
            <h2 className="text-3xl font-bold serif text-stone-900 mb-2">Profile Image</h2>
            <p className="text-stone-500">Update your professional appearance.</p>
          </div>

          <div className="space-y-6">
            <div className="mx-auto w-24 h-24 rounded-full border-4 border-ui-accent overflow-hidden">
              <img src={url || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" alt="Preview" />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Image URL</label>
              <input 
                autoFocus
                className="w-full px-6 py-4 rounded-[20px] bg-ui-bg border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none transition-all font-medium text-stone-600 text-sm"
                value={url}
                placeholder="https://example.com/photo.jpg"
                onChange={e => setUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button className="flex-1 py-4" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Photo'}
            </Button>
            <Button variant="outline" className="px-8" onClick={onClose} disabled={loading}>Cancel</Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function QuoteFormModal({ onClose, request, existingQuote, profile }: { onClose: () => void, request: ServiceRequest, existingQuote?: Quote, profile: UserProfile }) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(existingQuote?.amount || 50);
  const [priceType, setPriceType] = useState<'Fixed' | 'Hourly'>(existingQuote?.priceType || 'Fixed');
  const [transportCost, setTransportCost] = useState(existingQuote?.transportCost || 0);
  const [materialCost, setMaterialCost] = useState(existingQuote?.materialCost || 0);
  const [materialIncluded, setMaterialIncluded] = useState(existingQuote?.materialIncluded || false);
  const [isNegotiable, setIsNegotiable] = useState(existingQuote?.isNegotiable || false);
  const [message, setMessage] = useState(existingQuote?.message || '');
  const [assignedEmployees, setAssignedEmployees] = useState<string[]>(existingQuote?.assignedEmployees || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const quoteId = existingQuote?.quoteId || (typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2));
    const quoteData: Quote = {
      quoteId,
      requestId: request.requestId,
      providerId: auth.currentUser!.uid,
      providerName: profile.fullName || 'Professional',
      providerAvatar: profile.avatarUrl || null,
      amount: Number(amount),
      priceType,
      transportCost: Number(transportCost),
      materialCost: Number(materialCost),
      materialIncluded,
      isNegotiable,
      message,
      assignedEmployees,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, `requests/${request.requestId}/quotes`, quoteId), quoteData);
      await setDoc(doc(db, 'requests', request.requestId), {
        quoteCount: (request.quoteCount || 0) + (existingQuote ? 0 : 1)
      }, { merge: true });
      
      // Notify Customer
      await triggerNotification(
        request.customerId,
        'New Proposal Received',
        `${profile.fullName} has sent a proposal for your request "${request.title}".`,
        'new_quote',
        request.requestId
      );
      
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `requests/${request.requestId}/quotes/${quoteId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="matrix-modal fixed inset-0 bg-stone-900/40 backdrop-blur-md z-[110] flex items-center justify-center p-4">
       <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-ui-bg w-full max-w-lg rounded-[48px] overflow-hidden shadow-2xl border-8 border-white"
      >
        <div className="p-8 bg-ui-primary text-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold serif">Submit Proposal</h2>
            <button onClick={onClose} className="text-stone-300 hover:text-white transition-colors">
              <ChevronRight size={28} className="rotate-90" />
            </button>
          </div>
          <p className="text-ui-accent/80 text-sm italic">For: {request.title}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Rate Structure</label>
              <div className="flex bg-ui-surface p-1 rounded-2xl border border-ui-accent">
                {['Fixed', 'Hourly'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPriceType(type as any)}
                    className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${priceType === type ? 'bg-white text-ui-primary shadow-sm border border-ui-accent' : 'text-stone-400'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">{priceType === 'Fixed' ? 'Total Proposal' : 'Rate / Hour'} (€)</label>
              <input 
                type="number"
                className="w-full px-6 py-3.5 rounded-2xl bg-white border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none font-bold text-lg"
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Deployment Cost (€)</label>
              <input 
                type="number"
                placeholder="Transport"
                className="w-full px-6 py-3.5 rounded-2xl bg-white border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none font-bold text-lg"
                value={transportCost}
                onChange={e => setTransportCost(Number(e.target.value))}
              />
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-2 ml-1">Transport/Travel</p>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Resource Fee (€)</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  disabled={materialIncluded}
                  placeholder="Material"
                  className={`flex-1 px-6 py-3.5 rounded-2xl bg-white border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none font-bold text-lg ${materialIncluded ? 'opacity-40 grayscale' : ''}`}
                  value={materialCost}
                  onChange={e => setMaterialCost(Number(e.target.value))}
                />
                <button
                  type="button"
                  onClick={() => setMaterialIncluded(!materialIncluded)}
                  className={`px-4 py-4 rounded-2xl border text-[10px] font-bold transition-all ${materialIncluded ? 'bg-ui-primary text-white border-ui-primary' : 'bg-white text-stone-400 border-ui-accent'}`}
                >
                  INC
                </button>
              </div>
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-2 ml-1">Cleaning Materials</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-5 bg-ui-surface rounded-2xl border border-ui-accent border-l-4 border-l-ui-secondary">
            <div>
              <p className="text-sm font-bold text-stone-800">Collaborative Pricing</p>
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-relaxed">Allow client to propose counter-offers (Bargain)</p>
            </div>
            <button
              type="button"
              onClick={() => setIsNegotiable(!isNegotiable)}
              className={`w-14 h-7 rounded-full transition-all relative ${isNegotiable ? 'bg-ui-secondary' : 'bg-stone-200'}`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isNegotiable ? 'left-8' : 'left-1'}`} />
            </button>
          </div>

          <div>
             <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-4">Assign Personnel</label>
             {profile.employees && profile.employees.length > 0 ? (
               <div className="grid grid-cols-2 gap-3">
                 {profile.employees.map(emp => (
                   <button
                    type="button"
                    key={emp.id}
                    onClick={() => {
                      if (assignedEmployees.includes(emp.pseudoName)) {
                        setAssignedEmployees(assignedEmployees.filter(e => e !== emp.pseudoName));
                      } else {
                        setAssignedEmployees([...assignedEmployees, emp.pseudoName]);
                      }
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all ${assignedEmployees.includes(emp.pseudoName) ? 'bg-ui-primary/5 border-ui-primary ring-1 ring-ui-primary' : 'bg-white border-ui-accent hover:border-ui-primary'}`}
                   >
                     <p className={`font-bold text-sm ${assignedEmployees.includes(emp.pseudoName) ? 'text-ui-primary' : 'text-stone-800'}`}>{emp.pseudoName}</p>
                     <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">{emp.role || 'Cleaner'}</p>
                   </button>
                 ))}
                 <button
                  type="button"
                  onClick={() => {
                    if (assignedEmployees.includes('Team (Group)')) {
                      setAssignedEmployees(assignedEmployees.filter(e => e !== 'Team (Group)'));
                    } else {
                      setAssignedEmployees([...assignedEmployees, 'Team (Group)']);
                    }
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all ${assignedEmployees.includes('Team (Group)') ? 'bg-ui-primary/5 border-ui-primary ring-1 ring-ui-primary' : 'bg-white border-ui-accent hover:border-ui-primary'}`}
                 >
                   <p className={`font-bold text-sm ${assignedEmployees.includes('Team (Group)') ? 'text-ui-primary' : 'text-stone-800'}`}>Full Ensemble</p>
                   <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">Company Group</p>
                 </button>
               </div>
             ) : (
                <div className="p-4 bg-ui-surface rounded-2xl border border-ui-accent text-center">
                  <p className="text-xs text-stone-500 font-medium italic">Single professional deployment (Company Owner)</p>
                </div>
             )}
          </div>

          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Professional Message</label>
            <textarea 
              rows={4}
              placeholder="Detail your approach and availability..."
              className="w-full px-6 py-4 rounded-[20px] bg-white border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none text-stone-600 text-sm placeholder:text-stone-300 transition-all font-medium"
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>

          <div className="flex gap-4">
             <Button className="flex-1 py-5 text-lg" onClick={() => {}}>{loading ? 'Negotiating...' : (existingQuote ? 'Update Proposal' : 'Declare Proposal')}</Button>
             <Button variant="outline" type="button" onClick={onClose} className="px-10">Cancel</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// --------------------------------------------------------------------------------
// Review Modal
// --------------------------------------------------------------------------------

function ReviewModal({ request, userProfile, onClose }: { request: ServiceRequest, userProfile: UserProfile, onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request.providerId) return;
    setLoading(true);

    const reviewId = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const reviewData: Review = {
      reviewId,
      requestId: request.requestId,
      providerId: request.providerId || '',
      customerId: userProfile.uid,
      customerName: userProfile.fullName,
      rating,
      comment,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'reviews', reviewId), reviewData);
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `reviews/${reviewId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-ui-bg w-full max-w-lg rounded-[48px] overflow-hidden shadow-2xl border-8 border-white"
      >
        <div className="p-8 bg-ui-primary text-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold serif">Rate Experience</h2>
            <button onClick={onClose} className="text-stone-300 hover:text-white transition-colors">
              <Plus size={28} className="rotate-45" />
            </button>
          </div>
          <p className="text-ui-accent/80 text-sm italic">Service: {request.title}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8">
          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-4 text-center">Your Rating</label>
            <div className="flex justify-center gap-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`p-2 transition-all transform hover:scale-110 ${rating >= star ? 'text-ui-secondary' : 'text-stone-200'}`}
                >
                  <Star size={40} fill={rating >= star ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Your Feedback</label>
            <textarea 
              rows={4}
              placeholder="How was the professional's performance?"
              className="w-full px-6 py-4 rounded-[20px] bg-white border border-ui-accent focus:ring-2 focus:ring-ui-primary outline-none text-stone-600 text-sm transition-all font-medium"
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>

          <div className="flex gap-4">
            <Button className="flex-1 py-5 text-lg" onClick={() => {}}>{loading ? 'Posting...' : 'Share Feedback'}</Button>
            <Button variant="outline" type="button" onClick={onClose} className="px-10">Skip</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function AdminView() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'requests'>('users');

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'users'));

    const unsubRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ ...doc.data() } as ServiceRequest)));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'requests'));

    setLoading(false);
    return () => {
      unsubUsers();
      unsubRequests();
    };
  }, []);

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Total Requests', value: requests.length, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Completed Jobs', value: requests.filter(r => r.status === 'completed').length, icon: CheckCircle, color: 'text-ui-primary', bg: 'bg-ui-surface' },
    { label: 'Active Quotes', value: requests.reduce((acc, curr) => acc + (curr.quoteCount || 0), 0), icon: MessageSquare, color: 'text-orange-500', bg: 'bg-orange-50' },
  ];

  if (loading) {
    return <div className="p-20 text-center animate-pulse serif text-stone-400">Syncing administrative data...</div>;
  }

  return (
    <div className="space-y-12 pb-20">
      <header>
        <h1 className="text-4xl font-bold serif text-stone-900">System Control</h1>
        <p className="text-stone-500 mt-2 text-lg">Cross-platform overview for network administrators.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label} 
            className="bg-white p-8 rounded-[40px] border border-ui-accent shadow-sm flex items-center gap-6"
          >
            <div className={`w-16 h-16 ${stat.bg} ${stat.color} rounded-[28px] flex items-center justify-center shrink-0`}>
              <stat.icon size={32} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-black text-stone-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-[48px] border border-ui-accent overflow-hidden shadow-xl">
        <div className="flex border-b border-ui-accent">
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-6 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-ui-surface text-ui-primary border-b-2 border-ui-primary' : 'text-stone-400 hover:text-stone-600'}`}
          >
            User Management ({users.length})
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-6 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'requests' ? 'bg-ui-surface text-ui-primary border-b-2 border-ui-primary' : 'text-stone-400 hover:text-stone-600'}`}
          >
            Service Requests ({requests.length})
          </button>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'users' ? (
              <motion.div 
                key="users"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="overflow-x-auto"
              >
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-ui-accent">
                      <th className="text-left py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">User</th>
                      <th className="text-left py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Role</th>
                      <th className="text-left py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Stats</th>
                      <th className="text-left py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ui-accent/50">
                    {users.map(u => (
                      <tr key={u.uid} className="group hover:bg-ui-surface/30 transition-colors">
                        <td className="py-5">
                          <div className="flex items-center gap-3">
                            <img src={u.avatarUrl || `https://ui-avatars.com/api/?name=${u.fullName}`} className="w-10 h-10 rounded-full" />
                            <div>
                              <p className="font-bold text-stone-800">{u.fullName}</p>
                              <p className="text-xs text-stone-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-5">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block ${
                            u.role === 'admin' ? 'bg-ui-primary/10 text-ui-primary border border-ui-primary/20' : 
                            u.role === 'provider' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 
                            'bg-stone-50 text-stone-600 border border-stone-200'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-5">
                          <div className="flex items-center gap-4 text-xs font-medium text-stone-500">
                            <span className="flex items-center gap-1"><Star size={14} className="text-ui-secondary fill-current" /> {u.rating || 0}</span>
                            <span className="flex items-center gap-1 font-bold">{u.totalJobs || 0} Jobs</span>
                          </div>
                        </td>
                        <td className="py-5 text-xs text-stone-400 font-medium">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            ) : (
              <motion.div 
                key="requests"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid gap-6"
              >
                {requests.map(req => (
                  <div key={req.requestId} className="flex items-center justify-between p-6 bg-ui-surface/20 rounded-[32px] border border-ui-accent group hover:bg-white transition-all shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-ui-primary shadow-sm group-hover:scale-110 transition-transform">
                        {req.category === 'Cleaning' ? <Sparkle size={24} /> : <Hammer size={24} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900">{req.title}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{req.category}</span>
                          <span className="text-stone-300">•</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">{req.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-stone-800">{req.customerName}</p>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">Requester</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
