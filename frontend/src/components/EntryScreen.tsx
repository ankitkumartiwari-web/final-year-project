import { motion } from 'motion/react';
import { useEffect } from 'react';

interface EntryScreenProps {
  onBeginJourney: () => void;
}

export function EntryScreen({ onBeginJourney }: EntryScreenProps) {
  useEffect(() => {
    // Automatically proceed after 2 seconds
    const timer = setTimeout(() => {
      onBeginJourney();
    }, 2000);

    // Cleanup timer if component unmounts
    return () => clearTimeout(timer);
  }, [onBeginJourney]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden cursor-pointer"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1759134335060-9ae159bc3e12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmNpZW50JTIwcGFyY2htZW50JTIwdGV4dHVyZXxlbnwxfHx8fDE3NjA1NjExNzV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: 'Merriweather, serif',
      }}
      onClick={onBeginJourney}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-900/20 via-transparent to-amber-900/30" />
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="relative z-10 text-center px-6"
      >
        <motion.h1
          animate={{
            textShadow: [
              '0 0 25px rgba(139, 69, 19, 0.8)',
              '0 0 35px rgba(139, 69, 19, 0.9)',
              '0 0 25px rgba(139, 69, 19, 0.8)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mb-6 text-6xl md:text-8xl"
          style={{
            fontFamily: 'Crimson Text, serif',
            color: '#f5deb3',
            fontWeight: 700,
          }}
        >
          Re-Living History
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mb-12 max-w-md mx-auto italic text-xl md:text-2xl"
          style={{
            color: '#f5deb3',
            fontWeight: 700,
            textShadow: '0 0 15px rgba(139, 69, 19, 0.7)',
          }}
        >
          Step into the past and relive great moments of history.
        </motion.p>
      </motion.div>

      {/* Decorative elements */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute top-10 left-10 w-32 h-32 border-2 border-amber-700/20 rounded-full"
      />
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
        className="absolute bottom-10 right-10 w-40 h-40 border-2 border-amber-700/20 rounded-full"
      />
    </motion.div>
  );
}