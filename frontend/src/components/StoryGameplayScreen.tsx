import { motion } from 'motion/react';
import { ThreeDModelViewer } from './ThreeDModelViewer';
import { lowPolyModelUrl } from '../assets/lowPolyModel';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useState, useRef, useEffect } from 'react';
import { HistoricalEvent } from './EventSelectionScreen';
import { Character } from './CharacterSelectionScreen';
import { AlertCircle, BookOpenText, Lightbulb, Loader2, Sparkles, Swords } from 'lucide-react';

interface StoryGameplayScreenProps {
  event: HistoricalEvent;
  character: Character;
  onRestart: () => void;
  loadSavedGame?: boolean;
  onSaveStateChange?: () => Promise<void> | void;
}

type StorySegmentTone =
  | 'chronicle'
  | 'prompt'
  | 'guidance'
  | 'clue'
  | 'success'
  | 'error';

interface StorySegment {
  text: string;
  type: 'narrative' | 'hint' | 'success';
  tone?: StorySegmentTone;
}

interface StepData {
  done: boolean;
  step_id?: number;
  event?: string;
  situation?: string;
  character_pov?: string;
  year?: number;
}

interface ProgressData {
  current_step: number;
  total_steps: number;
  pct_complete: number;
}

interface InputResponse {
  success: boolean;
  done: boolean;
  type: 'success' | 'hint';
  response: string;
  score: number;
  step_advanced: boolean;
  next_step: StepData | null;
  progressive_hint?: string;
  attempts_left?: number;
}

const API_BASE = 'http://localhost:8000';

const ERA_MAP: Record<string, string> = {
  'mauryan-empire': 'mauryan',
  'revolt-1857': 'revolt1857',
  'indian-independence': 'independence',
  'ancient-civilizations': 'ancient',
};

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

const buildStepNarrative = (step: StepData) => {
  const yearLabel = step.year != null
    ? `${Math.abs(step.year)} ${step.year < 0 ? 'BCE' : 'CE'} - `
    : '';

  return [
    step.event ? `Chronicle: ${yearLabel}${step.event}` : '',
    step.situation ?? '',
    step.character_pov ?? '',
  ].filter(Boolean).join('\n\n');
};

const getSegmentPresentation = (segment: StorySegment) => {
  const tone = segment.tone
    ?? (segment.type === 'success'
      ? 'success'
      : segment.type === 'hint'
      ? 'guidance'
      : segment.text.startsWith('>')
      ? 'prompt'
      : 'chronicle');

  switch (tone) {
    case 'prompt':
      return {
        containerClass: 'bg-stone-100/80 border-l-4 border-stone-500 p-3 md:p-4 rounded',
        textClass: 'text-stone-900 italic',
        label: 'Prompt',
        labelClass: 'text-stone-800',
        icon: Swords,
        iconClass: 'text-stone-700',
      };
    case 'guidance':
      return {
        containerClass: 'bg-amber-100 border-l-4 border-amber-600 p-3 md:p-4 rounded',
        textClass: 'text-amber-950',
        label: 'Guidance',
        labelClass: 'text-amber-900',
        icon: AlertCircle,
        iconClass: 'text-amber-700',
      };
    case 'clue':
      return {
        containerClass: 'bg-sky-50 border-l-4 border-sky-600 p-3 md:p-4 rounded',
        textClass: 'text-sky-950',
        label: 'Hint',
        labelClass: 'text-sky-900',
        icon: Lightbulb,
        iconClass: 'text-sky-700',
      };
    case 'success':
      return {
        containerClass: 'bg-green-50 border-l-4 border-green-600 p-3 md:p-4 rounded',
        textClass: 'text-green-900',
        label: 'Success',
        labelClass: 'text-green-900',
        icon: Sparkles,
        iconClass: 'text-green-700',
      };
    case 'error':
      return {
        containerClass: 'bg-red-50 border-l-4 border-red-600 p-3 md:p-4 rounded',
        textClass: 'text-red-900',
        label: 'Error',
        labelClass: 'text-red-900',
        icon: AlertCircle,
        iconClass: 'text-red-700',
      };
    case 'chronicle':
    default:
      return {
        containerClass: 'bg-amber-50/70 border-l-4 border-amber-300 p-3 md:p-4 rounded',
        textClass: 'text-amber-950',
        label: 'Chronicle',
        labelClass: 'text-amber-900',
        icon: BookOpenText,
        iconClass: 'text-amber-700',
      };
  }
};

export function StoryGameplayScreen({
  event,
  character,
  onRestart,
  loadSavedGame = false,
  onSaveStateChange,
}: StoryGameplayScreenProps) {
  const [story, setStory] = useState<StorySegment[]>([]);
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [story]);

  useEffect(() => {
    if (gameReady && !isComplete && !isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameReady, isComplete, isLoading]);

  useEffect(() => {
    const initializeGame = async () => {
      setIsLoading(true);
      setError(null);
      setStory([]);
      setIsComplete(false);
      setProgress(null);
      setGameReady(false);
      setSaveMessage(null);

      try {
        const res = loadSavedGame
          ? await fetch(`${API_BASE}/load`, { method: 'POST' })
          : await fetch(`${API_BASE}/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                era_id: ERA_MAP[event.id] ?? event.id,
                character_id: CHARACTER_MAP[character.id] ?? character.id,
              }),
            });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail ?? `Server error ${res.status}`);
        }

        const data = await res.json();
        if (loadSavedGame && !data.success) {
          throw new Error(data.message ?? 'No saved game found');
        }

        const nextProgress: ProgressData | null = data.progress ?? data.state ?? null;
        if (nextProgress) {
          setProgress(nextProgress);
        }

        const step: StepData | undefined = data.current_step_data ?? data.first_step;
        if (step && !step.done) {
          setStory([{
            text: loadSavedGame
              ? `Saved progress restored.\n\n${buildStepNarrative(step)}`
              : buildStepNarrative(step),
            type: 'narrative',
            tone: 'chronicle',
          }]);
          setGameReady(true);
        } else if (step?.done) {
          setIsComplete(true);
          setGameReady(true);
          setStory([{
            text: 'This saved journey is already complete. You can restart or begin a new timeline.',
            type: 'success',
            tone: 'success',
          }]);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        setError(msg);
        setStory([{
          text: `Could not connect to the game server.\n\n${msg}\n\nMake sure the backend is running:\n  cd backend\n  uvicorn main:app --reload --port 8000`,
          type: 'hint',
          tone: 'error',
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    initializeGame();
  }, [character.id, event.id, loadSavedGame]);

  const handleSaveGame = async () => {
    if (!gameReady || isLoading || isSaving) return;

    setIsSaving(true);
    setSaveMessage(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: {
            event_id: event.id,
            event_title: event.title,
            character_id: character.id,
            character_name: character.name,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? `Server error ${res.status}`);
      }

      setSaveMessage('Progress saved to the current single-player slot.');
      await onSaveStateChange?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save progress';
      setError(msg);
      setSaveMessage(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCommand = async () => {
    if (!command.trim() || isLoading || isComplete || !gameReady) return;

    const userCommand = command.trim();
    setCommand('');
    setSaveMessage(null);

    setStory((prev) => [...prev, { text: `> ${userCommand}`, type: 'narrative', tone: 'prompt' }]);
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
      setStory((prev) => [...prev, {
        text: data.response,
        type: data.type,
        tone: data.type === 'success' ? 'success' : 'guidance',
      }]);

      if (data.progressive_hint) {
        setStory((prev) => [
          ...prev,
          {
            text: `Clue: ${data.progressive_hint}`,
            type: 'hint',
            tone: 'clue',
          },
        ]);
      }

      if (data.step_advanced && data.next_step && !data.next_step.done) {
        setStory((prev) => [
          ...prev,
          { text: buildStepNarrative(data.next_step), type: 'narrative', tone: 'chronicle' },
        ]);
      }

      const prog = await fetch(`${API_BASE}/progress`).then((r) => r.json());
      setProgress(prog);

      if (data.done) {
        setIsComplete(true);
        setStory((prev) => [
          ...prev,
          {
            text: `Your journey through history is complete.\nYou have witnessed key moments of "${event.title}" through the eyes of ${character.name}.`,
            type: 'success',
            tone: 'success',
          },
        ]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setStory((prev) => [...prev, { text: `Error: ${msg}`, type: 'hint', tone: 'error' }]);
    } finally {
      setIsLoading(false);
    }
  };

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
                Step {Math.min(progress.current_step + 1, progress.total_steps)} / {progress.total_steps} &bull; {progress.pct_complete}%
              </p>
            )}
          </div>
        </div>
      </div>

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

      <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 p-4 md:p-6 overflow-hidden">
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
              <ThreeDModelViewer
                modelUrl={lowPolyModelUrl}
                title={event.title}
                subtitle={`${character.name} • ${event.period}`}
              />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900/90 to-transparent p-3 md:p-4 z-10"
            >
              <p className="text-amber-100 text-xs md:text-sm italic text-center" style={{ fontFamily: 'Crimson Text, serif' }}>
                Story tableau • rotate to inspect
              </p>
            </motion.div>
          </div>
        </motion.div>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 md:space-y-4 p-4 md:p-6 rounded-lg border-2 border-amber-600/30 overflow-y-auto"
            style={{ backgroundColor: 'rgba(250, 246, 239, 0.9)' }}
          >
            {story.map((segment, index) => {
              const presentation = getSegmentPresentation(segment);
              const Icon = presentation.icon;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className={presentation.containerClass}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <Icon className={`w-4 h-4 md:w-5 md:h-5 flex-shrink-0 mt-1 ${presentation.iconClass}`} />
                    <span className={`text-sm md:text-base font-semibold ${presentation.labelClass}`}>
                      {presentation.label}:
                    </span>
                  </div>
                  <p className={`text-sm md:text-base whitespace-pre-line ${presentation.textClass}`}>
                    {segment.text}
                  </p>
                </motion.div>
              );
            })}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-amber-700 py-2"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm italic">The narrator weaves your story...</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 p-4 md:p-6 pt-0">
        <div className="max-w-7xl mx-auto space-y-2 md:space-y-3">
          {error && <p className="text-red-600 text-xs">{error}</p>}
          {saveMessage && <p className="text-green-700 text-xs">{saveMessage}</p>}
          <div className="flex gap-2 md:gap-3">
            <Input
              ref={inputRef}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
              placeholder={
                isComplete
                  ? 'Journey complete!'
                  : !gameReady
                  ? 'Loading character data... please wait'
                  : isLoading
                  ? 'Awaiting the narrator... you can queue your next action'
                  : 'Type your action (e.g., "march forward")...'
              }
              disabled={isComplete || !gameReady}
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
            <Button
              onClick={handleSaveGame}
              disabled={!gameReady || isLoading || isSaving}
              variant="outline"
              className="border-amber-600 text-amber-900 hover:bg-amber-100 text-xs md:text-sm disabled:opacity-60"
              style={{ fontFamily: 'Merriweather, serif' }}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-amber-800 text-xs md:text-sm">
              {isComplete
                ? 'Your historical journey is complete'
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


