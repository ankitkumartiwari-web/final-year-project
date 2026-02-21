import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { EntryScreen } from "./components/EntryScreen";
import {
  EventSelectionScreen,
  HistoricalEvent,
} from "./components/EventSelectionScreen";
import {
  CharacterSelectionScreen,
  Character,
} from "./components/CharacterSelectionScreen";
import { StoryGameplayScreen } from "./components/StoryGameplayScreen";

type Screen =
  | "entry"
  | "event-selection"
  | "character-selection"
  | "story";

export default function App() {
  const [currentScreen, setCurrentScreen] =
    useState<Screen>("entry");
  const [selectedEvent, setSelectedEvent] =
    useState<HistoricalEvent | null>(null);
  const [selectedCharacter, setSelectedCharacter] =
    useState<Character | null>(null);

  const handleBeginJourney = () => {
    setCurrentScreen("event-selection");
  };

  const handleEventSelected = (event: HistoricalEvent) => {
    setSelectedEvent(event);
    setCurrentScreen("character-selection");
  };

  const handleCharacterSelected = (character: Character) => {
    setSelectedCharacter(character);
    setCurrentScreen("story");
  };

  const handleRestart = () => {
    setCurrentScreen("entry");
    setSelectedEvent(null);
    setSelectedCharacter(null);
  };

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {currentScreen === "entry" && (
          <EntryScreen
            key="entry"
            onBeginJourney={handleBeginJourney}
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
            />
          )}
      </AnimatePresence>
    </div>
  );
}