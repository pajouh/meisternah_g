import React, { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging, db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Bell, ShieldCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const NotificationManager: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>(Notification.permission);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Show prompt if permission is not granted/denied yet
    if (Notification.permission === 'default') {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // Listen for foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      // You can show a custom toast here if you want
      if (payload.notification) {
        new Notification(payload.notification.title || 'New Update', {
          body: payload.notification.body,
          icon: '/logo.png',
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const requestPermission = async () => {
    try {
      const status = await Notification.requestPermission();
      setPermission(status);
      setShowPrompt(false);

      if (status === 'granted') {
        const token = await getToken(messaging, {
          // You would put your VAPID key here from Firebase Console -> Project Settings -> Cloud Messaging
          // vapidKey: 'YOUR_VAPID_KEY'
        });

        if (token && auth.currentUser) {
          console.log('FCM Token:', token);
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            fcmToken: token,
          });
        }
      }
    } catch (error) {
      console.error('Notification permission failed:', error);
    }
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed bottom-24 right-4 md:right-8 z-[100] max-w-sm w-full bg-white rounded-[32px] p-6 shadow-2xl border border-ui-accent flex flex-col gap-4"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 bg-ui-primary/10 rounded-2xl flex items-center justify-center text-ui-primary">
              <Bell size={24} />
            </div>
            <button 
              onClick={() => setShowPrompt(false)}
              className="p-2 hover:bg-ui-surface rounded-full text-stone-300 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-stone-900 serif">Enable Notifications</h3>
            <p className="text-sm text-stone-500 mt-1 leading-relaxed">
              Stay updated on your booking status, new quotes, and provider messages in real-time.
            </p>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={requestPermission}
              className="flex-1 bg-ui-primary text-white py-3 rounded-2xl font-bold text-sm shadow-lg shadow-ui-primary/20 hover:bg-opacity-90 active:scale-95 transition-all"
            >
              Allow Updates
            </button>
            <button
              onClick={() => setShowPrompt(false)}
              className="px-5 py-3 rounded-2xl font-bold text-sm text-stone-400 hover:bg-ui-surface transition-all"
            >
              Maybe Later
            </button>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-stone-400 font-medium uppercase tracking-widest bg-ui-surface p-2 rounded-xl border border-ui-accent/50">
            <ShieldCheck size={12} className="text-green-500" />
            <span>Secure & Private</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
