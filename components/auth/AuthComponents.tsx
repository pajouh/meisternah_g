import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkle, 
  ArrowLeft, 
  X, 
  Smartphone, 
  Mail, 
  Lock, 
  Shield, 
  User as UserIcon, 
  Briefcase,
  CheckCircle
} from 'lucide-react';
import { auth } from '../../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateEmail,
  verifyBeforeUpdateEmail,
  applyActionCode,
  signOut,
  sendEmailVerification,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithCustomToken,
  linkWithPhoneNumber
} from 'firebase/auth';
import { UserRole, UserProfile } from '../../types';
import { Button } from '../ui/Shared';

export function AuthModal({ onClose, onLogin, initialIsRegister = false, externalError = null }: { onClose: () => void, onLogin: any, initialIsRegister?: boolean, externalError?: string | null }) {
  const [mode, setMode] = useState<'options' | 'email' | 'phone'>('options');
  const [isRegister, setIsRegister] = useState(initialIsRegister);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [internalError, setInternalError] = useState('');
    const [success, setSuccess] = useState('');

    const error = internalError || externalError;
    const setError = (val: string) => setInternalError(val);
  
    const handleEmailAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');
      setSuccess('');
      try {
        if (isRegister) {
          const userCred = await createUserWithEmailAndPassword(auth, email, password);
          // Use native Firebase email verification
          try {
            const actionCodeSettings = {
              url: `${window.location.origin}/auth/action`,
              handleCodeInApp: true,
            };
            await sendEmailVerification(userCred.user, actionCodeSettings);
          } catch (vErr: any) {
            console.error("Verification email sending failed", vErr);
            setError("Account created, but we couldn't send the verification email automatically. You can resend it from the next screen.");
            setTimeout(() => onClose(), 3000);
            return;
          }
          setSuccess('Account created! A verification email has been sent.');
          setTimeout(() => onClose(), 2000);
        } else {
          await signInWithEmailAndPassword(auth, email, password);
          onClose();
        }
      } catch (err: any) {
        if (err.message.includes('requests-from-referer') || err.code === 'auth/requests-from-referer-blocked') {
          const domain = window.location.hostname;
          setError(`Auth Blocked: The domain "${domain}" must be added to your Firebase project's "Authorized domains" list in the Firebase Console (Authentication > Settings).`);
        } else if (err.code === 'auth/operation-not-allowed') {
          setError("Email/Password sign-in is not enabled in Firebase. Please go to your Firebase Console -> Authentication -> Sign-in method and enable 'Email/Password'.");
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const recaptchaVerifierRef = useRef<any>(null);

  const handleSendOtp = async () => {
    if (!phone) return;
    setLoading(true);
    setError('');
    try {
      // Initialize reCAPTCHA if not already done
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible'
        });
      }
      
      const result = await signInWithPhoneNumber(auth, phone, recaptchaVerifierRef.current);
      setConfirmationResult(result);
      setOtpSent(true);
    } catch (err: any) {
      // If first attempt fails, we might need to reset
      recaptchaVerifierRef.current = null;
      if (err.code === 'auth/captcha-check-failed') {
        setError("reCAPTCHA check failed. Please refresh and try again.");
      } else if (err.code === 'auth/invalid-phone-number') {
        setError("Invalid phone number format. Please use international format (e.g., +1234567890).");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || !confirmationResult) return;
    setLoading(true);
    setError('');
    try {
      const result = await confirmationResult.confirm(otp);
      await onLogin('phone', { user: result.user });
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/invalid-verification-code') {
        setError("The verification code is incorrect. Please try again.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans text-stone-800">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden border border-ui-accent"
      >
        <div className="p-10">
          <div className="flex items-center justify-between mb-8">
            {mode !== 'options' ? (
              <button onClick={() => { setMode('options'); setOtpSent(false); }} className="p-2 hover:bg-ui-surface rounded-full text-stone-400 transition-all">
                <ArrowLeft size={20} />
              </button>
            ) : <div className="w-8" />}
            <div className="flex items-center gap-2 font-bold text-ui-primary serif text-xl">
              <Sparkle size={24} />
              <span><span className="text-black">meister</span><span className="text-orange-500">nah</span></span>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-ui-surface rounded-full text-stone-300 transition-all">
              <X size={20} />
            </button>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold serif text-stone-900 mb-2 leading-tight">
              {mode === 'options' ? (isRegister ? 'Create Account' : 'Welcome Back') : mode === 'email' ? (isRegister ? 'Join meisternah' : 'Sign In') : 'Phone Sign In'}
            </h2>
            <p className="text-stone-500 text-xs text-balance">
              {mode === 'options' ? (isRegister ? 'Join our community of cleaning enthusiasts.' : 'Choose your preferred way to continue.') : 'Enter your details below to proceed.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 text-[10px] font-bold rounded-2xl flex items-center gap-2 border border-red-100">
              <Shield size={12} />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-2xl flex items-center gap-2 border border-emerald-100">
              <CheckCircle size={12} />
              {success}
            </div>
          )}

          {mode === 'options' && (
            <div className="space-y-4">
              <button 
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setError('');
                  try {
                    await onLogin('google');
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-3 bg-white border border-ui-accent py-4 rounded-3xl font-bold text-stone-700 hover:bg-ui-surface transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                ) : (
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5" alt="G" />
                )}
                {isRegister ? 'Sign up with Google' : 'Continue with Google'}
              </button>

              {(error?.includes('window was closed') || error?.includes('popup was blocked')) && (
                <button 
                  onClick={async () => {
                    setLoading(true);
                    setError('');
                    try {
                      await onLogin('google-redirect');
                    } catch (err: any) {
                      setError(err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="w-full text-[10px] text-ui-primary font-bold hover:underline"
                >
                  Problems with popup? Try Sign in with Redirect
                </button>
              )}
              <button 
                onClick={() => setMode('phone')}
                className="w-full flex items-center justify-center gap-3 bg-ui-primary text-white py-4 rounded-3xl font-bold hover:bg-opacity-90 transition-all shadow-lg shadow-ui-primary/20 active:scale-95"
              >
                <Smartphone size={20} />
                {isRegister ? 'Sign up with Phone' : 'Sign in with Phone'}
              </button>
              <button 
                onClick={() => setMode('email')}
                className="w-full flex items-center justify-center gap-3 bg-white border border-ui-accent py-4 rounded-3xl font-bold text-stone-700 hover:bg-ui-surface transition-all shadow-sm active:scale-95"
              >
                <Mail size={20} />
                {isRegister ? 'Sign up with Email' : 'Continue with Email'}
              </button>

              <p className="text-center text-xs text-stone-500 mt-8">
                {isRegister ? 'Already have an account?' : "Don't have an account?"}
                <button 
                  type="button"
                  onClick={() => setIsRegister(!isRegister)}
                  className="ml-2 text-ui-primary font-bold hover:underline"
                >
                  {isRegister ? 'Log In' : 'Sign Up'}
                </button>
              </p>
            </div>
          )}

          {mode === 'email' && (
            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-stone-400 ml-4">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-ui-surface border-none rounded-3xl text-sm focus:ring-2 focus:ring-ui-primary/20 outline-none"
                    placeholder="name@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-stone-400 ml-4">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-ui-surface border-none rounded-3xl text-sm focus:ring-2 focus:ring-ui-primary/20 outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <button 
                disabled={loading}
                className="w-full bg-ui-primary text-white py-4 rounded-3xl font-bold shadow-lg shadow-ui-primary/20 mt-4 disabled:opacity-50"
              >
                {loading ? 'Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
              </button>
              <p className="text-center text-xs text-stone-500 mt-6">
                {isRegister ? 'Already have an account?' : "Don't have an account?"}
                <button 
                  type="button"
                  onClick={() => setIsRegister(!isRegister)}
                  className="ml-2 text-ui-primary font-bold hover:underline"
                >
                  {isRegister ? 'Log In' : 'Sign Up'}
                </button>
              </p>
            </form>
          )}

          {mode === 'phone' && (
            <div className="space-y-6 text-left">
              <div id="recaptcha-container"></div>
              {!otpSent ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-stone-400 ml-4">Mobile Number</label>
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                      <input 
                        type="tel" 
                        required 
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-ui-surface border-none rounded-3xl text-sm focus:ring-2 focus:ring-ui-primary/20 outline-none"
                        placeholder="+49 123 456789"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleSendOtp}
                    disabled={loading || !phone}
                    className="w-full bg-ui-primary text-white py-4 rounded-3xl font-bold shadow-lg shadow-ui-primary/20 disabled:opacity-50"
                  >
                    {loading ? 'Sending SMS...' : 'Send SMS Code'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2 text-center text-xs">
                    <p className="text-stone-500">We sent a 6-digit code to <span className="font-bold text-stone-900">{phone}</span></p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-stone-400 ml-4">Verification Code</label>
                    <input 
                      type="text" 
                      maxLength={6}
                      required 
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-6 py-4 bg-ui-surface border-none rounded-3xl text-center text-2xl font-bold tracking-[0.5em] focus:ring-2 focus:ring-ui-primary/20 outline-none"
                      placeholder="000000"
                    />
                  </div>
                  <button 
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length < 6}
                    className="w-full bg-ui-primary text-white py-4 rounded-3xl font-bold shadow-lg shadow-ui-primary/20 disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Complete Sign In'}
                  </button>
                  <button 
                    onClick={() => setOtpSent(false)}
                    className="w-full text-xs text-stone-400 font-bold hover:text-stone-600 transition-all text-center"
                  >
                    Change Phone Number
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function OnboardingFlow({ user, existingProfile, onSelect }: { user: any, existingProfile: UserProfile | null, onSelect: any }) {
  const [step, setStep] = useState<'role' | 'addEmail' | 'email' | 'phone'>('role');
  const [role, setRole] = useState<UserRole | null>(existingProfile?.role || null);
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-advance step on mount
  useEffect(() => {
    if (existingProfile?.role) {
      setRole(existingProfile.role);
      checkRequirements(existingProfile.role);
    }
  }, []);

  const handleRoleSelect = (r: UserRole) => {
    setRole(r);
    checkRequirements(r);
  };

  const checkRequirements = async (selectedRole: UserRole) => {
    // Force a minor update check
    const current = auth.currentUser || user;
    
    // 1. Check if we have an email at all
    if (!current.email) {
      setStep('addEmail');
      return;
    }

    // 2. Check if email is verified
    if (!current.emailVerified) {
       // Deep check
       await current.reload();
       if (!current.emailVerified) {
         setStep('email');
         return;
       }
    }

    // 3. Check Phone
    const looksLikePhoneUid = user.uid && user.uid.startsWith('+') && user.uid.length > 5;
    
    try {
      if (user.phoneNumber || looksLikePhoneUid) {
         await onSelect(selectedRole, { number: user.phoneNumber || user.uid, verified: true });
      } else if (existingProfile?.phoneVerified) {
         await onSelect(selectedRole, { number: existingProfile.phoneNumber, verified: true });
      } else {
        setStep('phone');
      }
    } catch (err: any) {
      setError("Onboarding failed: " + err.message);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail) return;
    setLoading(true);
    setError('');
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: true,
      };
      // Use native Firebase update and verification
      await verifyBeforeUpdateEmail(user, newEmail, actionCodeSettings);
      setStep('email');
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError("Email/Password provider not enabled. Please enable 'Email/Password' in your Firebase Console (Authentication > Sign-in method) and ensure 'Email link (passwordless sign-in)' is also enabled if you want to use this flow.");
      } else if (err.code === 'auth/requires-recent-login') {
        setError("Security Timeout: For your protection, this sensitive operation requires a fresh login. Please log out and sign back in to continue setting up your email.");
      } else {
        setError("Failed to set email: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailVerified = async () => {
    // Force reload user to get latest verification status
    setLoading(true);
    setError('');
    try {
      await user.reload();
      await user.getIdToken(true);
      
      // Check both to be safe
      if (user.emailVerified || auth.currentUser?.emailVerified) {
        checkRequirements(role!);
      } else {
        setError("Email not verified yet. Please check your inbox and follow the link, then click this button again.");
      }
    } catch (err: any) {
      setError("Error reloading user: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyEmailCode = async () => {
    if (!emailCode) return;
    setLoading(true);
    setError('');
    try {
      await applyActionCode(auth, emailCode);
      
      // Wait a bit and reload multiple times if needed, or refresh token
      await user.reload();
      
      // Force refresh the ID token to get the latest claims
      await user.getIdToken(true);
      
      if (auth.currentUser?.emailVerified) {
        setSuccess("Email successfully verified and updated!");
        setTimeout(() => {
          setSuccess('');
          checkRequirements(role!);
        }, 1500);
      } else {
        // One more try
        await new Promise(resolve => setTimeout(resolve, 1000));
        await user.reload();
        if (auth.currentUser?.emailVerified) {
          setSuccess("Email successfully verified!");
          checkRequirements(role!);
        } else {
          setError("Code was accepted but email still shows as unverified. This can happen if the verification is still propagating. Please try clicking 'I have verified' in a moment.");
        }
      }
    } catch (err: any) {
      setError("Failed to verify code: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
        <div className="min-h-screen bg-ui-bg flex flex-col items-center justify-center px-4 font-sans text-stone-800">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] max-w-md w-full p-4 bg-red-50 text-red-600 text-[10px] font-bold rounded-2xl flex items-center gap-2 border border-red-100 shadow-xl">
          <Shield size={12} />
          {error}
        </div>
      )}
      {success && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] max-w-md w-full p-4 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-2xl flex items-center gap-2 border border-emerald-100 shadow-xl">
          <CheckCircle size={12} />
          {success}
        </div>
      )}
      <button 
        onClick={() => signOut(auth)}
        className="fixed top-6 right-6 z-[200] px-4 py-2 bg-white/50 hover:bg-white text-stone-400 hover:text-red-500 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all border border-ui-accent/50"
      >
        Sign Out
      </button>

      <AnimatePresence mode="wait">
        {step === 'role' ? (
          <motion.div 
            key="role"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl w-full text-center"
          >
            <div className="inline-flex p-4 bg-ui-surface rounded-[24px] text-ui-primary mb-8 border border-ui-accent">
              <Sparkle size={40} />
            </div>
            <h1 className="text-4xl font-bold mb-4 serif text-stone-900">Welcome to meisternah</h1>
            <p className="text-stone-500 mb-12 text-lg">Curating the perfect cleaning experience for you.</p>
            
            <div className={`grid sm:grid-cols-${user.email?.endsWith('@meisternah.de') ? '2 md:grid-cols-3' : '2'} gap-8 text-left w-full max-w-5xl mx-auto`}>
              <button 
                onClick={() => handleRoleSelect('customer')}
                className="group bg-white p-10 rounded-[40px] border-2 border-ui-accent/30 hover:border-ui-primary transition-all shadow-sm hover:shadow-xl hover:shadow-ui-primary/5"
              >
                <div className="w-16 h-16 bg-ui-bg rounded-2xl flex items-center justify-center text-ui-primary mb-8 group-hover:bg-ui-primary group-hover:text-white transition-all transform group-hover:rotate-6">
                  <UserIcon size={32} />
                </div>
                <h3 className="text-2xl font-bold mb-3 serif text-stone-900 leading-tight">I'm a Customer</h3>
                <p className="text-sm text-stone-400 leading-relaxed">I want to book professional cleaning services.</p>
              </button>
              <button 
                onClick={() => handleRoleSelect('provider')}
                className="group bg-white p-10 rounded-[40px] border-2 border-ui-accent/30 hover:border-ui-secondary transition-all shadow-sm hover:shadow-xl hover:shadow-ui-secondary/5"
              >
                <div className="w-16 h-16 bg-ui-bg rounded-2xl flex items-center justify-center text-ui-secondary mb-8 group-hover:bg-ui-secondary group-hover:text-white transition-all transform group-hover:-rotate-6">
                  <Briefcase size={32} />
                </div>
                <h3 className="text-2xl font-bold mb-3 serif text-stone-900 leading-tight">I'm a Provider</h3>
                <p className="text-sm text-stone-400 leading-relaxed">I provide high-end cleaning services.</p>
              </button>
              {user.email?.endsWith('@meisternah.de') && (
                <button 
                  onClick={() => handleRoleSelect('admin')}
                  className="group bg-white p-10 rounded-[40px] border-2 border-ui-accent/30 hover:border-ui-primary transition-all shadow-sm hover:shadow-xl hover:shadow-ui-primary/5 sm:col-span-2 md:col-span-1"
                >
                  <div className="w-16 h-16 bg-ui-bg rounded-2xl flex items-center justify-center text-ui-primary mb-8 group-hover:bg-ui-primary group-hover:text-white transition-all transform group-hover:rotate-6">
                    <Shield size={32} />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 serif text-stone-900 leading-tight">System Admin</h3>
                  <p className="text-sm text-stone-400 leading-relaxed">Technical oversight and platform management.</p>
                </button>
              )}
            </div>
          </motion.div>
        ) : step === 'addEmail' ? (
          <motion.div 
            key="addEmail"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full bg-white p-12 rounded-[48px] shadow-2xl border border-ui-accent text-center"
          >
            <div className="w-20 h-20 bg-ui-primary/10 rounded-full flex items-center justify-center mx-auto mb-8 text-ui-primary">
              <Mail size={40} />
            </div>
            <h2 className="text-3xl font-bold serif text-stone-900 mb-4">Email Required</h2>
            <p className="text-stone-500 mb-10 leading-relaxed text-sm">Please provide an email address to continue. We'll send a verification link.</p>
            
            {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
            
            <input 
              type="email" 
              placeholder="name@example.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="w-full px-6 py-4 bg-ui-surface border-none rounded-3xl text-sm mb-6 outline-none focus:ring-2 focus:ring-ui-primary/20"
            />
            
            <Button onClick={handleAddEmail} disabled={loading} className="w-full">
              {loading ? 'Sending Link...' : 'Continue'}
            </Button>
          </motion.div>
        ) : step === 'email' ? (
          <motion.div 
            key="email"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full bg-white p-12 rounded-[48px] shadow-2xl border border-ui-accent text-center"
          >
            <div className="w-20 h-20 bg-ui-primary/10 rounded-full flex items-center justify-center mx-auto mb-8 text-ui-primary">
              <Mail size={40} />
            </div>
            <h2 className="text-3xl font-bold serif text-stone-900 mb-4">Email Verification</h2>
            <p className="text-stone-500 mb-6 leading-relaxed text-sm">Please check your inbox at <span className="font-bold">{newEmail || user.email}</span> and follow the link to verify your account.</p>
            
            <div className="bg-stone-50 p-6 rounded-3xl mb-10 text-left border border-stone-100">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">Haven't received it?</h4>
              <ul className="text-[11px] text-stone-500 space-y-2 list-disc list-inside">
                <li>Check your <b>Spam</b> or <b>Promotions</b> folder.</li>
                <li>Wait 1-2 minutes for the delivery.</li>
                <li>Make sure the email address is correct.</li>
              </ul>
            </div>
            
            {showCodeInput ? (
              <div className="space-y-4 mb-6">
                <input 
                  type="text" 
                  placeholder="Paste your verification code here"
                  value={emailCode}
                  onChange={e => setEmailCode(e.target.value)}
                  className="w-full px-6 py-4 bg-ui-surface border-none rounded-3xl text-sm outline-none focus:ring-2 focus:ring-ui-primary/20"
                />
                <Button 
                  onClick={handleApplyEmailCode} 
                  disabled={loading || !emailCode}
                  className="w-full"
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </Button>
                <button 
                  onClick={() => setShowCodeInput(false)}
                  className="text-xs text-stone-400 hover:text-stone-600 block w-full text-center"
                >
                  Back to instructions
                </button>
              </div>
            ) : (
              <>
                <Button 
                  onClick={handleEmailVerified} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Checking...' : "I've Verified My Email"}
                </Button>
                <button 
                  onClick={() => setShowCodeInput(true)}
                  className="mt-4 text-xs text-ui-primary font-bold hover:underline block w-full text-center"
                >
                  I have a verification code
                </button>
              </>
            )}
            
                <button 
                  disabled={loading}
                  onClick={async (e) => {
                    const target = e.currentTarget;
                    target.disabled = true;
                    const originalText = target.innerText;
                    target.innerText = "Sending...";
                    try {
                      const currentUser = auth.currentUser;
                      if (!currentUser) {
                        throw new Error("No user found. Please try logging in again.");
                      }
                      const actionCodeSettings = {
                        url: `${window.location.origin}/auth/action`,
                        handleCodeInApp: true,
                      };
                      await sendEmailVerification(currentUser, actionCodeSettings);
                      setSuccess("Verification email resent!");
                      setTimeout(() => setSuccess(''), 5000);
                    } catch (err: any) {
                      setError("Failed to resend: " + err.message);
                    } finally {
                      target.disabled = false;
                      target.innerText = originalText;
                    }
                  }}
                  className="mt-6 text-xs text-stone-400 font-bold hover:text-stone-600 transition-all text-center block w-full disabled:opacity-50"
                >
                  Resend verification email
                </button>
            <button 
              onClick={() => setStep('addEmail')}
              className="mt-4 text-[10px] text-stone-300 font-bold hover:text-stone-500 block w-full text-center"
            >
              Wait, I used the wrong email
            </button>
          </motion.div>
        ) : (
          <motion.div 
            key="phone"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full bg-white p-12 rounded-[48px] shadow-2xl border border-ui-accent text-center"
          >
            <div className="w-20 h-20 bg-ui-primary/10 rounded-full flex items-center justify-center mx-auto mb-8 text-ui-primary">
              <Smartphone size={40} />
            </div>
            <h2 className="text-3xl font-bold serif text-stone-900 mb-4">Verification</h2>
            <p className="text-stone-500 mb-10 leading-relaxed text-sm">To ensure a secure marketplace, we require mobile verification for all members.</p>
            <PhoneVerification onVerified={(data) => onSelect(role!, data)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PhoneVerification({ onVerified }: { onVerified: (data: { number: string, verified: boolean }) => void }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const recaptchaVerifierRef = useRef<any>(null);

  const handleSendOtp = async () => {
    if (!phone) return;
    setLoading(true);
    setError('');
    try {
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-onboarding', {
          'size': 'invisible'
        });
      }
      
      const currentUser = auth.currentUser;
      let result;
      
      if (currentUser && !currentUser.isAnonymous) {
        // Link to existing account to avoid account switching/looping
        console.log("Linking phone to existing user:", currentUser.uid);
        result = await linkWithPhoneNumber(currentUser, phone, recaptchaVerifierRef.current);
      } else {
        // Normal sign in
        result = await signInWithPhoneNumber(auth, phone, recaptchaVerifierRef.current);
      }
      
      setConfirmationResult(result);
      setOtpSent(true);
    } catch (err: any) {
      recaptchaVerifierRef.current = null;
      if (err.code === 'auth/credential-already-in-use') {
        setError("This phone number is already associated with another account. Please use a different number or log in with that account.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || !confirmationResult) return;
    setLoading(true);
    setError('');
    try {
      const result = await confirmationResult.confirm(otp);
      onVerified({ number: phone, verified: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div id="recaptcha-onboarding"></div>
      {error && (
        <div className="p-4 bg-red-400 text-white text-[10px] font-bold rounded-2xl border border-red-500 flex items-center gap-2">
          <Shield size={12} />
          {error}
        </div>
      )}
      
      {!otpSent ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-stone-400 ml-4">Phone Number</label>
            <div className="relative">
              <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="tel" 
                required 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-ui-surface border-none rounded-3xl text-sm focus:ring-2 focus:ring-ui-primary/20 outline-none"
                placeholder="+49 123 456789"
              />
            </div>
          </div>
          <button 
            disabled={loading || !phone}
            onClick={handleSendOtp}
            className="w-full bg-ui-primary text-white py-4 rounded-3xl font-bold shadow-lg shadow-ui-primary/20 disabled:opacity-50 transition-all active:scale-95"
          >
            {loading ? 'Sending Code...' : 'Send Verification SMS'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-stone-400 ml-4">Verification Code</label>
            <input 
              type="text" 
              maxLength={6}
              required 
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full px-6 py-4 bg-ui-surface border-none rounded-3xl text-center text-2xl font-bold tracking-[0.5em] focus:ring-2 focus:ring-ui-primary/20 outline-none"
              placeholder="000000"
            />
          </div>
          <button 
            disabled={loading || otp.length < 6}
            onClick={handleVerifyOtp}
            className="w-full bg-ui-primary text-white py-4 rounded-3xl font-bold shadow-lg shadow-ui-primary/20 disabled:opacity-50 transition-all active:scale-95"
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
          <button 
            onClick={() => setOtpSent(false)}
            className="w-full text-sm text-stone-400 font-bold hover:text-stone-600 transition-all text-center"
          >
            Use a different number
          </button>
        </div>
      )}
    </div>
  );
}
