"""
game_loop.py – Interactive CLI for the Historical RAG Engine.

Usage:
    python game_loop.py --era mauryan --character ashoka
    python game_loop.py --era ww2 --character churchill
"""

import argparse
import textwrap
from rag_engine import HistoricalRAGEngine


SEPARATOR = "─" * 70


def print_box(title: str, text: str, width: int = 70):
    print(f"\n{'═' * width}")
    print(f"  {title.upper()}")
    print(f"{'─' * width}")
    for line in textwrap.wrap(text, width - 4):
        print(f"  {line}")
    print(f"{'═' * width}")


def print_hint_box(hint: str, attempt: int, width: int = 70):
    """Render the progressive hint with a visual level indicator."""
    level_labels = {
        1: "💭 CLUE  (level 1/3 — vague nudge)",
        2: "🔍 CLUE  (level 2/3 — getting warmer)",
        3: "🔑 CLUE  (level 3/3 — almost there!)",
    }
    label = level_labels.get(attempt, "💭 CLUE")
    print(f"\n{'─' * width}")
    print(f"  {label}")
    print(f"{'─' * width}")
    for line in textwrap.wrap(hint, width - 4):
        print(f"  {line}")
    print(f"{'─' * width}")


def run_game(era_id: str, character_id: str, model_path: str, data_root: str):
    engine = HistoricalRAGEngine(
        data_root=data_root,
        model_path=model_path,
    )

    print(f"\n🏛  Loading {character_id.title()} ({era_id.upper()}) …")
    engine.load_character(character_id=character_id, era_id=era_id)
    print("✅  Character loaded. Your journey begins.\n")
    print(SEPARATOR)

    while not engine.is_complete():
        step_data = engine.present_step()
        if step_data.get("done"):
            break

        progress = engine.get_progress()
        year_str = ""
        if step_data.get("year") is not None:
            y = step_data["year"]
            year_str = f"  |  {abs(y)} {'BCE' if y < 0 else 'CE'}"

        print(f"\n📍 Step {progress['current_step'] + 1} / {progress['total_steps']}  "
              f"({progress['pct_complete']}% complete){year_str}")
        print_box("Event", step_data["event"])
        print_box("Situation", step_data["situation"])
        print_box("Your perspective", step_data["character_pov"])

        # Show a progressive hint if the player has already failed this step
        if step_data.get("progressive_hint"):
            print_hint_box(step_data["progressive_hint"], step_data["current_hint_level"])

        # Accept user input
        while True:
            print()
            user_input = input("▶  What do you do? ").strip()
            if user_input:
                break
            print("   (Please enter an action.)")

        result = engine.process_input(user_input)
        threshold = result.get("threshold", 0.0)
        print(f"\n   [Score: {result['score']:.3f} / threshold: {threshold:.2f}]")

        if result["success"]:
            print("\n✨  SUCCESS")
            print_box("Narrative", result["response"])

        elif result.get("revealed"):
            print("\n💡  Out of attempts — correct approach revealed. Moving on.")
            print_box("Correct Approach", result["response"])
            print_box("Narrative", result["narrative"])

        else:
            attempts_left = result.get("attempts_left", "?")
            print(f"\n⚠️   Not quite right … ({attempts_left} attempt(s) remaining before reveal)")
            print_box("Guidance", result["response"])
            # Show the next progressive hint immediately
            if result.get("progressive_hint"):
                next_attempt_num = engine.MAX_ATTEMPTS - attempts_left
                print_hint_box(result["progressive_hint"], next_attempt_num)
            print()

        print(SEPARATOR)

    print("\n🎉  Journey complete! Congratulations.")
    progress = engine.get_progress()
    print(f"    Character: {progress['character_id'].title()}")
    print(f"    Era:       {progress['era_id'].upper()}")
    print(f"    Steps:     {progress['total_steps']}")


def main():
    parser = argparse.ArgumentParser(description="Multi-Era Historical Game")
    parser.add_argument("--era", required=True, help="Era folder name (e.g. mauryan, ww2)")
    parser.add_argument("--character", required=True, help="Character id (e.g. ashoka, churchill)")
    parser.add_argument("--model", default="models/phi-3.5-mini-instruct.Q4_K_M.gguf",
                        help="Path to Phi-3.5B GGUF model")
    parser.add_argument("--data", default="data", help="Root data directory")
    args = parser.parse_args()

    run_game(
        era_id=args.era,
        character_id=args.character,
        model_path=args.model,
        data_root=args.data,
    )


if __name__ == "__main__":
    main()