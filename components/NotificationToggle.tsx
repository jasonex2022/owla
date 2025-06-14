'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  isPushSupported,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getNotificationPreferences,
  showLocalNotification
} from '@/lib/services/notifications';

export default function NotificationToggle() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Check if notifications are already enabled
    const prefs = getNotificationPreferences();
    setIsEnabled(prefs?.enabled || false);
  }, []);

  async function toggleNotifications() {
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (!isEnabled) {
        // Enable notifications
        const permission = await requestNotificationPermission();
        if (permission) {
          const subscribed = await subscribeToPush();
          if (subscribed) {
            setIsEnabled(true);
            // Show test notification
            await showLocalNotification(
              'NOTIFICATIONS ACTIVE',
              'You\'ll be alerted when your crew moves',
              { silent: false }
            );
          }
        }
      } else {
        // Disable notifications
        await unsubscribeFromPush();
        setIsEnabled(false);
      }
    } catch (error) {
      console.error('Notification toggle error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isPushSupported()) {
    return null; // Don't show on unsupported browsers
  }

  return (
    <div className="relative w-full">
      <button
        onClick={toggleNotifications}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={isLoading}
        className={`
          btn-secondary w-full
          ${isEnabled 
            ? 'bg-protest-yellow text-black border-protest-yellow hover:bg-yellow-400' 
            : ''
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {isLoading ? (
          <span className="inline-block animate-pulse">...</span>
        ) : (
          isEnabled ? 'ALERTS ON' : 'ENABLE ALERTS'
        )}
      </button>

      <AnimatePresence>
        {showTooltip && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black border border-white text-sm whitespace-nowrap"
          >
            {isEnabled 
              ? 'Click to disable movement alerts'
              : 'Get notified when your crew moves'
            }
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-black border-r border-b border-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}