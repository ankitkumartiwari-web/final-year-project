import { motion } from 'motion/react';
import { Card } from './ui/card';
import { HistoricalEvent } from './EventSelectionScreen';
import { User, Crown, Sword, BookOpen } from 'lucide-react';

export interface Character {
  id: string;
  name: string;
  description: string;
  icon: typeof User;
}

interface CharacterSelectionScreenProps {
  event: HistoricalEvent;
  onCharacterSelected: (character: Character) => void;
}

const charactersByEvent: Record<string, Character[]> = {
  'mauryan-empire': [
    {
      id: 'ashoka',
      name: 'Emperor Ashoka',
      description: 'Lead the empire and make decisions that shaped history',
      icon: Crown,
    },
    {
      id: 'soldier',
      name: 'Mauryan Soldier',
      description: 'Experience the Kalinga War from the battlefield',
      icon: Sword,
    },
    {
      id: 'monk',
      name: 'Buddhist Monk',
      description: 'Witness the spread of Buddhism across the empire',
      icon: BookOpen,
    },
    {
      id: 'minister',
      name: 'Royal Minister',
      description: 'Advise the emperor on matters of state and policy',
      icon: User,
    },
  ],
  'revolt-1857': [
    {
      id: 'sepoy',
      name: 'Indian Sepoy',
      description: 'Join the rebellion against British East India Company',
      icon: Sword,
    },
    {
      id: 'leader',
      name: 'Rebellion Leader',
      description: 'Organize and lead the fight for independence',
      icon: Crown,
    },
    {
      id: 'civilian',
      name: 'Village Elder',
      description: 'Protect your community during the uprising',
      icon: User,
    },
    {
      id: 'messenger',
      name: 'Royal Messenger',
      description: 'Carry critical information between rebel groups',
      icon: BookOpen,
    },
  ],
  'indian-independence': [
    {
      id: 'freedom-fighter',
      name: 'Freedom Fighter',
      description: 'Participate in the non-violent resistance movement',
      icon: User,
    },
    {
      id: 'leader',
      name: 'Movement Leader',
      description: 'Organize protests and inspire the masses',
      icon: Crown,
    },
    {
      id: 'student',
      name: 'Student Activist',
      description: 'Spread awareness and mobilize youth for freedom',
      icon: BookOpen,
    },
    {
      id: 'journalist',
      name: 'Journalist',
      description: 'Document the struggle and expose injustices',
      icon: User,
    },
  ],
  'ancient-civilizations': [
    {
      id: 'merchant',
      name: 'Indus Merchant',
      description: 'Trade across ancient cities and establish routes',
      icon: User,
    },
    {
      id: 'priest',
      name: 'Vedic Priest',
      description: 'Preserve sacred knowledge and conduct rituals',
      icon: BookOpen,
    },
    {
      id: 'craftsperson',
      name: 'Master Craftsperson',
      description: 'Create artifacts that will last millennia',
      icon: User,
    },
    {
      id: 'chief',
      name: 'Tribal Chief',
      description: 'Lead your people through changing times',
      icon: Crown,
    },
  ],
};

export function CharacterSelectionScreen({
  event,
  onCharacterSelected,
}: CharacterSelectionScreenProps) {
  const characters = charactersByEvent[event.id] || [];

  const handleCharacterClick = (character: Character) => {
    // Add a brief delay for visual feedback before transitioning
    setTimeout(() => {
      onCharacterSelected(character);
    }, 300);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen py-12 px-6 relative"
      style={{
        fontFamily: 'Merriweather, serif',
      }}
    >
      {/* Background with event image */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('${event.image}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(8px) brightness(0.4)',
        }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-amber-900/50 via-amber-900/70 to-amber-900/60" />

      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="mb-3 text-amber-100" style={{ fontFamily: 'Crimson Text, serif' }}>
            Choose Your Role in History
          </h2>
          <p className="text-amber-200 mb-2">{event.title}</p>
          <p className="text-amber-300 text-sm italic">{event.period}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {characters.map((character, index) => {
            const IconComponent = character.icon;
            return (
              <motion.div
                key={character.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                whileHover={{ scale: 1.05, y: -8 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  className="cursor-pointer overflow-hidden border-2 border-amber-600/50 hover:border-amber-500 transition-all duration-300 hover:shadow-2xl h-full"
                  style={{
                    backgroundColor: 'rgba(250, 246, 239, 0.95)',
                  }}
                  onClick={() => handleCharacterClick(character)}
                >
                  <div className="p-6 h-full flex flex-col">
                    <div className="flex items-start gap-4">
                      <motion.div
                        className="p-3 rounded-full bg-amber-600 flex-shrink-0"
                        whileHover={{ rotate: 360, backgroundColor: '#b45309' }}
                        transition={{ duration: 0.5 }}
                      >
                        <IconComponent className="w-6 h-6 text-amber-50" />
                      </motion.div>
                      <div className="flex-1">
                        <h3 className="text-amber-900 mb-2" style={{ fontFamily: 'Crimson Text, serif' }}>
                          {character.name}
                        </h3>
                        <p className="text-amber-800">{character.description}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}