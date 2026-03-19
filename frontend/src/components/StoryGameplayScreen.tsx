import { motion } from 'motion/react';
import { ThreeDModelViewer } from './ThreeDModelViewer';
import { lowPolyModelUrl } from '../assets/lowPolyModel';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useState, useRef, useEffect } from 'react';
import { HistoricalEvent } from './EventSelectionScreen';
import { Character } from './CharacterSelectionScreen';
import { AlertCircle, Sparkles, Loader2 } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoryGameplayScreenProps {
  event: HistoricalEvent;
  character: Character;
  onRestart: () => void;
}

interface StorySegment {
  text: string;
  type: 'narrative' | 'hint' | 'success';
}

interface StepData {
  done: boolean;
  step_id?: number;
  event?: string;
  situation?: string;
  character_pov?: string;
  year?: number;
}

interface InputResponse {
  success: boolean;
  done: boolean;
  type: 'success' | 'hint';
  response: string;
  score: number;
  step_advanced: boolean;
  next_step: StepData | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:8000';

/**
 * Maps frontend event.id → backend era_id (your data/ folder names).
 * Update these to match your actual folder structure under backend/data/
 */
const ERA_MAP: Record<string, string> = {
  'mauryan-empire': 'mauryan',
  'revolt-1857': 'revolt1857',
  'indian-independence': 'independence',
  'ancient-civilizations': 'ancient',
};

/**
 * Maps frontend character.id → backend character_id (your JSON file names).
 * Update these to match your actual .json filenames under backend/data/<era>/
 */
const CHARACTER_MAP: Record<string, string> = {
  ashoka: 'ashoka',
  soldier: 'soldier',
  monk: 'monk',
  minister: 'minister',
  sepoy: 'sepoy',
  leader: 'leader',
  civilian: 'civilian',
  messenger: 'messenger',
  'freedom-fighter': 'freedom_fighter',
  student: 'student',
  journalist: 'journalist',
  merchant: 'merchant',
  priest: 'priest',
  craftsperson: 'craftsperson',
  chief: 'chief',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function StoryGameplayScreen({ event, character, onRestart }: StoryGameplayScreenProps) {
  const [story, setStory] = useState<StorySegment[]>([]);
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gameReady, setGameReady] = useState(false); // true only after /start succeeds
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState<{ current_step: number; total_steps: number; pct_complete: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever story updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [story]);

  // Call /start when the component mounts
  useEffect(() => {
    startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── /start ──────────────────────────────────────────────────────────────────
  const startGame = async () => {
    setIsLoading(true);
    setError(null);
    setStory([]);
    setIsComplete(false);
    setProgress(null);
    setGameReady(false);

    const era_id = ERA_MAP[event.id] ?? event.id;
    const character_id = CHARACTER_MAP[character.id] ?? character.id;

    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ era_id, character_id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? `Server error ${res.status}`);
      }

      const data: { message: string; state: typeof progress; first_step: StepData } = await res.json();

      // Update progress bar
      if (data.state) setProgress(data.state);

      // Build the intro from the first step fields
      const step = data.first_step;
      if (step && !step.done) {
        const yearLabel = step.year != null
          ? `${Math.abs(step.year)} ${step.year < 0 ? 'BCE' : 'CE'} — `
          : '';
        const introText = [
          step.event ? `📜 ${yearLabel}${step.event}` : '',
          step.situation ?? '',
          step.character_pov ?? '',
        ].filter(Boolean).join('\n\n');

        setStory([{ text: introText, type: 'narrative' }]);
        setGameReady(true); // ✅ only enable input after /start fully succeeds
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
      setStory([{
        text: `⚠️ Could not connect to the game server.\n\n${msg}\n\nMake sure the backend is running:\n  cd backend\n  uvicorn main:app --reload --port 8000`,
        type: 'hint',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── /input ──────────────────────────────────────────────────────────────────
  const handleCommand = async () => {
    if (!command.trim() || isLoading || isComplete || !gameReady) return;

    const userCommand = command.trim();
    setCommand('');

    // Show the player's command immediately
    setStory((prev) => [...prev, { text: `> ${userCommand}`, type: 'narrative' }]);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: userCommand }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? `Server error ${res.status}`);
      }

      const data: InputResponse = await res.json();

      // Append the LLM narrative or the hint
      setStory((prev) => [...prev, { text: data.response, type: data.type }]);

      // If step advanced, show the next situation as a new narrative block
      if (data.step_advanced && data.next_step && !data.next_step.done) {
        const next = data.next_step;
        const yearLabel = next.year != null
          ? `${Math.abs(next.year)} ${next.year < 0 ? 'BCE' : 'CE'} — `
          : '';
        const nextText = [
          next.event ? `📜 ${yearLabel}${next.event}` : '',
          next.situation ?? '',
          next.character_pov ?? '',
        ].filter(Boolean).join('\n\n');

        setStory((prev) => [...prev, { text: nextText, type: 'narrative' }]);
      }

      // Fetch updated progress
      const prog = await fetch(`${API_BASE}/progress`).then((r) => r.json());
      setProgress(prog);

      // Journey complete
      if (data.done) {
        setIsComplete(true);
        setStory((prev) => [
          ...prev,
          {
            text: `✨ Your journey through history is complete!\nYou have witnessed key moments of "${event.title}" through the eyes of ${character.name}.`,
            type: 'success',
          },
        ]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setStory((prev) => [...prev, { text: `⚠️ Error: ${msg}`, type: 'hint' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom, #f4e8d0, #e8d4b0)',
        fontFamily: 'Merriweather, serif',
      }}
    >
      {/* ── Header ── */}
      <div
        className="relative h-24 md:h-32 flex items-end p-4 md:p-6 flex-shrink-0"
        style={{
          backgroundImage: `url('${event.image}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-amber-900/80" />
        <div className="relative z-10">
          <h2 className="text-amber-50 mb-1 text-xl md:text-2xl" style={{ fontFamily: 'Crimson Text, serif' }}>
            {event.title}
          </h2>
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-amber-200 text-sm md:text-base">Playing as: {character.name}</p>
            {progress && (
              <p className="text-amber-300 text-xs">
                Step {progress.current_step} / {progress.total_steps} &bull; {progress.pct_complete}%
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {progress && (
        <div className="h-1 bg-amber-200 flex-shrink-0">
          <motion.div
            className="h-full bg-amber-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress.pct_complete}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 p-4 md:p-6 overflow-hidden">

        {/* 3D Model panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="lg:w-2/5 flex-shrink-0 h-48 md:h-64 lg:h-full"
        >
          <div
            className="relative rounded-lg overflow-hidden border-4 border-amber-700/40 shadow-2xl h-full"
            style={{ backgroundColor: 'rgba(139, 69, 19, 0.1)' }}
          >
            <div className="absolute top-0 left-0 w-6 h-6 md:w-8 md:h-8 border-t-4 border-l-4 border-amber-800 z-10" />
            <div className="absolute top-0 right-0 w-6 h-6 md:w-8 md:h-8 border-t-4 border-r-4 border-amber-800 z-10" />
            <div className="absolute bottom-0 left-0 w-6 h-6 md:w-8 md:h-8 border-b-4 border-l-4 border-amber-800 z-10" />
            <div className="absolute bottom-0 right-0 w-6 h-6 md:w-8 md:h-8 border-b-4 border-r-4 border-amber-800 z-10" />
            <div className="relative w-full h-full flex items-center justify-center">
              <ThreeDModelViewer modelUrl={lowPolyModelUrl} />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900/90 to-transparent p-3 md:p-4 z-10"
            >
              <p className="text-amber-100 text-xs md:text-sm italic text-center" style={{ fontFamily: 'Crimson Text, serif' }}>
                {event.title} • {event.period}
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Narrative scroll panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 md:space-y-4 p-4 md:p-6 rounded-lg border-2 border-amber-600/30 overflow-y-auto"
            style={{ backgroundColor: 'rgba(250, 246, 239, 0.9)' }}
          >
            {story.map((segment, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`${
                  segment.type === 'hint'
                    ? 'bg-amber-100 border-l-4 border-amber-600 p-3 md:p-4 rounded'
                    : segment.type === 'success'
                    ? 'bg-green-50 border-l-4 border-green-600 p-3 md:p-4 rounded'
                    : ''
                }`}
              >
                {segment.type === 'hint' && (
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-amber-700 flex-shrink-0 mt-1" />
                    <span className="text-amber-900 text-sm md:text-base font-semibold">Guidance:</span>
                  </div>
                )}
                {segment.type === 'success' && (
                  <div className="flex items-start gap-2 mb-2">
                    <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-green-700 flex-shrink-0 mt-1" />
                    <span className="text-green-900 text-sm md:text-base font-semibold">Success!</span>
                  </div>
                )}
                <p
                  className={`text-sm md:text-base whitespace-pre-line ${
                    segment.type === 'hint'
                      ? 'text-amber-900'
                      : segment.type === 'success'
                      ? 'text-green-900'
                      : 'text-amber-900'
                  } ${segment.text.startsWith('>') ? 'italic text-amber-700' : ''}`}
                >
                  {segment.text}
                </p>
              </motion.div>
            ))}

            {/* Spinner while LLM is generating */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-amber-700 py-2"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm italic">The narrator weaves your story…</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Command input ── */}
      <div className="flex-shrink-0 p-4 md:p-6 pt-0">
        <div className="max-w-7xl mx-auto space-y-2 md:space-y-3">
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-2 md:gap-3">
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
              placeholder={
                isComplete
                  ? 'Journey complete!'
                  : !gameReady
                  ? 'Loading character data… please wait'
                  : isLoading
                  ? 'Awaiting the narrator…'
                  : 'Type your action (e.g., "march forward")…'
              }
              disabled={isLoading || isComplete || !gameReady}
              className="flex-1 border-2 border-amber-600/50 focus:border-amber-700 bg-amber-50/80 text-sm md:text-base disabled:opacity-60"
              style={{ fontFamily: 'Merriweather, serif' }}
            />
            <Button
              onClick={handleCommand}
              disabled={isLoading || isComplete || !command.trim() || !gameReady}
              className="px-4 md:px-6 bg-amber-700 hover:bg-amber-800 text-amber-50 text-sm md:text-base disabled:opacity-60"
              style={{ fontFamily: 'Merriweather, serif' }}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Act'}
            </Button>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-amber-800 text-xs md:text-sm">
              {isComplete
                ? '✨ Your historical journey is complete'
                : 'Describe your action to shape history'}
            </p>
            <Button
              onClick={onRestart}
              variant="outline"
              className="border-amber-600 text-amber-900 hover:bg-amber-100 text-xs md:text-sm"
              style={{ fontFamily: 'Merriweather, serif' }}
            >
              Restart
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
