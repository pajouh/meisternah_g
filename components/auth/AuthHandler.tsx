import React, { useEffect, useRef, useState } from 'react';
import { 
  applyActionCode, 
  verifyPasswordResetCode,
  confirmPasswordReset, 
  checkActionCode 
} from 'firebase/auth';
import { auth } from '../../firebase';
import { Shield, CheckCircle, XCircle, Sparkle } from 'lucide-react';
import { motion } from 'motion/react';

export default function AuthHandler() {
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const m = params.get('mode');
    const oobCode = params.get('oobCode');
    setMode(m);

    if (!m || !oobCode) { 
      setStatus('error'); 
      setMessage('The link appears to be invalid or incomplete.'); 
      return; 
    }

    setStatus('working');

    (async () => {
      try {
        if (m === 'verifyEmail' || m === 'verifyAndChangeEmail') {
          await applyActionCode(auth, oobCode);
          setMessage('Email verified successfully! You can now close this window and sign in.');
        } else if (m === 'resetPassword') {
          // For a simple app, we might just verify it's valid.
          // Full password reset flow would need more UI.
          await verifyPasswordResetCode(auth, oobCode);
          setMessage('Password reset link verified. Please use the app to set a new password.');
          // In a real app, you'd show a form here.
        } else if (m === 'recoverEmail') {
          await checkActionCode(auth, oobCode);
          await applyActionCode(auth, oobCode);
          setMessage('Your email address has been recovered successfully.');
        } else {
          setMessage('Unknown action mode.');
          setStatus('error');
          return;
        }
        setStatus('done');
      } catch (e: any) {
        setStatus('error');
        setMessage(
          e.code === 'auth/expired-action-code' ? 'This link has expired. Please request a new one.' :
          e.code === 'auth/invalid-action-code' ? 'This link has already been used or is invalid.' :
          e.message
        );
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-ui-bg flex items-center justify-center p-6 text-center font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-12 rounded-[48px] shadow-2xl border border-ui-accent space-y-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-ui-primary to-ui-secondary" />
        
        <div className="flex justify-center">
          {status === 'working' ? (
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-20 h-20 bg-ui-surface rounded-full flex items-center justify-center border-4 border-ui-accent"
            >
              <Sparkle className="text-ui-primary" size={40} />
            </motion.div>
          ) : status === 'done' ? (
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center border-4 border-green-100">
              <CheckCircle className="text-green-500" size={40} />
            </div>
          ) : status === 'error' ? (
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center border-4 border-red-100">
              <XCircle className="text-red-500" size={40} />
            </div>
          ) : (
            <div className="w-20 h-20 bg-ui-surface rounded-full flex items-center justify-center border-4 border-ui-accent">
              <Shield className="text-stone-300" size={40} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-3xl font-bold serif text-stone-900">
            {status === 'working' ? 'Processing...' : 
             status === 'done' ? 'Success!' : 
             status === 'error' ? 'Action Failed' : 'Authentication'}
          </h2>
          <p className="text-stone-500 text-sm leading-relaxed">
            {message || 'Checking the security status of your request.'}
          </p>
        </div>

        {status !== 'working' && (
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-ui-primary text-white py-4 rounded-3xl font-bold hover:bg-opacity-90 transition-all shadow-lg shadow-ui-primary/20"
          >
            Go to Home
          </button>
        )}
        
        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-none">
          {mode === 'verifyEmail' ? 'Email Verification' : 
           mode === 'resetPassword' ? 'Password Reset' : 
           'Secure Auth Handler'}
        </p>
      </motion.div>
    </div>
  );
}
