import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { EntryScreen } from "./components/EntryScreen";
import {
  EventSelectionScreen,
  HistoricalEvent,
  getHistoricalEventById,
} from "./components/EventSelectionScreen";
import {
  CharacterSelectionScreen,
  Character,
  getCharacterByEventAndId,
} from "./components/CharacterSelectionScreen";
import { StoryGameplayScreen } from "./components/StoryGameplayScreen";

type Screen =
  | "entry"
  | "event-selection"
  | "character-selection"
  | "story";

export default function App() {
  const [shouldLoadSavedGame, setShouldLoadSavedGame] = useState(false);
  const [savedGame, setSavedGame] = useState<{
    eventId: string;
    eventTitle: string;
    characterId: string;
    characterName: string;
    currentStep: number;
    totalSteps: number;
  } | null>(null);
  const [currentScreen, setCurrentScreen] =
    useState<Screen>("entry");
  const [selectedEvent, setSelectedEvent] =
    useState<HistoricalEvent | null>(null);
  const [selectedCharacter, setSelectedCharacter] =
    useState<Character | null>(null);

  const loadSaveStatus = async () => {
    try {
      const res = await fetch("http://localhost:8000/save");
      if (!res.ok) return;

      const data = await res.json();
      if (!data.has_save) {
        setSavedGame(null);
        return;
      }

      setSavedGame({
        eventId: data.metadata.event_id,
        eventTitle: data.metadata.event_title,
        characterId: data.metadata.character_id,
        characterName: data.metadata.character_name,
        currentStep: data.progress.current_step,
        totalSteps: data.progress.total_steps,
      });
    } catch {
      setSavedGame(null);
    }
  };

  useEffect(() => {
    loadSaveStatus();
  }, []);

  const handleBeginJourney = () => {
    setCurrentScreen("event-selection");
  };

  const handleEventSelected = (event: HistoricalEvent) => {
    setSelectedEvent(event);
    setCurrentScreen("character-selection");
  };

  const handleCharacterSelected = (character: Character) => {
    setSelectedCharacter(character);
    setShouldLoadSavedGame(false);
    setCurrentScreen("story");
  };

  const handleRestart = () => {
    setCurrentScreen("entry");
    setSelectedEvent(null);
    setSelectedCharacter(null);
    setShouldLoadSavedGame(false);
  };

  const handleContinueSavedJourney = () => {
    if (!savedGame) return;

    const event = getHistoricalEventById(savedGame.eventId);
    const character = event
      ? getCharacterByEventAndId(event.id, savedGame.characterId)
      : null;

    if (!event || !character) {
      return;
    }

    setSelectedEvent(event);
    setSelectedCharacter(character);
    setShouldLoadSavedGame(true);
    setCurrentScreen("story");
  };

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {currentScreen === "entry" && (
          <EntryScreen
            key="entry"
            onBeginJourney={handleBeginJourney}
            onContinueJourney={savedGame ? handleContinueSavedJourney : undefined}
            hasSavedGame={Boolean(savedGame)}
            savedGameLabel={savedGame
              ? `${savedGame.eventTitle} as ${savedGame.characterName} • Step ${savedGame.currentStep} / ${savedGame.totalSteps}`
              : null}
          />
        )}

        {currentScreen === "event-selection" && (
          <EventSelectionScreen
            key="event-selection"
            onEventSelected={handleEventSelected}
          />
        )}

        {currentScreen === "character-selection" &&
          selectedEvent && (
            <CharacterSelectionScreen
              key="character-selection"
              event={selectedEvent}
              onCharacterSelected={handleCharacterSelected}
            />
          )}

        {currentScreen === "story" &&
          selectedEvent &&
          selectedCharacter && (
            <StoryGameplayScreen
              key="story"
              event={selectedEvent}
              character={selectedCharacter}
              onRestart={handleRestart}
              loadSavedGame={shouldLoadSavedGame}
              onSaveStateChange={loadSaveStatus}
            />
          )}
      </AnimatePresence>
    </div>
  );
}

