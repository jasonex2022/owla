'use client';

import { motion } from 'framer-motion';

interface StatsProps {
  stats: {
    totalCrews: number;
    totalProtesters: number;
    activeZones: number;
  };
  isLoading: boolean;
}

export default function CrewStats({ stats, isLoading }: StatsProps) {
  const statItems = [
    {
      label: 'CREWS',
      value: stats.totalCrews,
      color: 'text-protest-red',
    },
    {
      label: 'TOTAL',
      value: stats.totalProtesters,
      color: 'text-protest-yellow',
    },
    {
      label: 'ZONES',
      value: stats.activeZones,
      color: 'text-white',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
      {statItems.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          className="stat-box relative overflow-hidden"
        >
          {/* Background pulse effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-protest-red/10 to-transparent opacity-50" />
          
          <div className="relative z-10">
            <div className={`text-3xl md:text-4xl font-protest ${stat.color} mb-1`}>
              {isLoading ? (
                <span className="inline-block animate-pulse">---</span>
              ) : (
                <AnimatedNumber value={stat.value} />
              )}
            </div>
            <div className="text-sm uppercase tracking-wider text-gray-400">
              {stat.label}
            </div>
          </div>
          
          {/* FOMO-inducing messaging */}
          {!isLoading && stat.label === 'Total Protesters' && stat.value > 1000 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute -bottom-1 -right-1 bg-protest-yellow text-black text-xs font-bold px-2 py-1 rotate-3"
            >
              GROWING FAST!
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="inline-block"
    >
      {value.toLocaleString()}
    </motion.span>
  );
}