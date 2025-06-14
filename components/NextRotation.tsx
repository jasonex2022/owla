'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface NextRotationProps {
  nextRotation: string;
}

export default function NextRotation({ nextRotation }: NextRotationProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const target = new Date(nextRotation);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('ROTATING NOW!');
        setIsUrgent(true);
        // Auto-refresh after 5 seconds
        setTimeout(() => window.location.reload(), 5000);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        setIsUrgent(minutes < 5);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextRotation]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`text-center p-6 border-4 ${
        isUrgent ? 'border-protest-red bg-red-900/20' : 'border-white bg-white/5'
      }`}
    >
      <p className="text-sm uppercase tracking-wider mb-2 text-gray-400">
        Next Crew Movement In
      </p>
      <div className={`text-5xl md:text-6xl font-protest ${
        isUrgent ? 'text-protest-red animate-pulse' : 'text-white'
      }`}>
        {timeLeft}
      </div>
      {isUrgent && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-protest-yellow uppercase tracking-wider"
        >
          Get ready to move!
        </motion.p>
      )}
    </motion.div>
  );
}