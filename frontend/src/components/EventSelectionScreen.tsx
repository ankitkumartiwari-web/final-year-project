import { motion } from 'motion/react';
import { Card } from './ui/card';
import { useState } from 'react';

export interface HistoricalEvent {
  id: string;
  title: string;
  description: string;
  image: string;
  period: string;
}

interface EventSelectionScreenProps {
  onEventSelected: (event: HistoricalEvent) => void;
}

const historicalEvents: HistoricalEvent[] = [
  {
    id: 'mauryan-empire',
    title: 'The Mauryan Empire',
    description: 'Experience the reign of Emperor Ashoka and the Kalinga War',
    image: 'https://images.unsplash.com/photo-1682507467714-47fd0217f1ba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYXVyeWFuJTIwZW1waXJlJTIwYXNob2thJTIwcGlsbGFyfGVufDF8fHx8MTc2MDU2MTE3NXww&ixlib=rb-4.1.0&q=80&w=1080',
    period: '322-185 BCE',
  },
  {
    id: 'revolt-1857',
    title: 'The Revolt of 1857',
    description: 'The first war of Indian independence against British rule',
    image: 'https://images.unsplash.com/photo-1708005178542-9c875fbd1510?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbGQlMjBoaXN0b3JpY2FsJTIwZm9ydCUyMGluZGlhfGVufDF8fHx8MTc2MDU2MTE3N3ww&ixlib=rb-4.1.0&q=80&w=1080',
    period: '1857-1858',
  },
  {
    id: 'indian-independence',
    title: 'Indian Independence Movement',
    description: 'Join the struggle for freedom under Mahatma Gandhi',
    image: 'https://images.unsplash.com/photo-1705756569166-1eb6ae8554a2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpYW4lMjBpbmRlcGVuZGVuY2UlMjBnYXRlJTIwbW9udW1lbnR8ZW58MXx8fHwxNzYwNTYxMTc2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    period: '1919-1947',
  },
  {
    id: 'ancient-civilizations',
    title: 'Ancient Indian Civilizations',
    description: 'Explore the Indus Valley and Vedic period',
    image: 'https://images.unsplash.com/photo-1722709229926-b85e2e5e11eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmNpZW50JTIwaW5kaWFuJTIwdGVtcGxlJTIwaGlzdG9yeXxlbnwxfHx8fDE3NjA1NjExNzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    period: '3300-500 BCE',
  },
];

export function EventSelectionScreen({ onEventSelected }: EventSelectionScreenProps) {
  const handleEventClick = (event: HistoricalEvent) => {
    // Add a brief delay for visual feedback before transitioning
    setTimeout(() => {
      onEventSelected(event);
    }, 300);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen py-12 px-6"
      style={{
        background: 'linear-gradient(to bottom, #f4e8d0, #e8d4b0)',
        fontFamily: 'Merriweather, serif',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="mb-3 text-amber-900" style={{ fontFamily: 'Crimson Text, serif' }}>
            Choose Your Historical Journey
          </h2>
          <p className="text-amber-800">Select an era to explore and experience firsthand</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {historicalEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.03, y: -8 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className="cursor-pointer overflow-hidden border-2 border-amber-400 hover:border-amber-600 transition-all duration-300 hover:shadow-2xl"
                style={{
                  backgroundColor: '#faf6ef',
                }}
                onClick={() => handleEventClick(event)}
              >
                <div className="relative h-48 overflow-hidden">
                  <motion.img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-full object-cover"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-amber-900/70 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-amber-50 mb-1" style={{ fontFamily: 'Crimson Text, serif' }}>
                      {event.title}
                    </h3>
                    <p className="text-amber-200 text-sm">{event.period}</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-amber-900">{event.description}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}