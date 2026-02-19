"""
Multi-Era Historical Game RAG Engine
Uses Phi-3.5B (via llama-cpp-python) + Sentence-Transformers for semantic validation.

Progressive Hint System
-----------------------
Each step supports up to 3 hint levels in the JSON under the key "hints":
    "hints": [
        "A vague thematic clue (attempt 1)",
        "A moderate directional clue (attempt 2)",
        "A near-explicit clue (attempt 3)"
    ]
If "hints" is absent, the engine auto-generates all 3 levels from the single "hint" field
using the LLM at load time (so no JSON edits are required to get started).

Threshold ladder (relaxes with each failed attempt):
    Attempt 1 → 0.58
    Attempt 2 → 0.50
    Attempt 3 → 0.42
    Attempt 4+ → reveal answer and advance
"""

import json
import os
import numpy as np
from pathlib import Path
from dataclasses import dataclass, field, fields
from typing import Optional

from sentence_transformers import SentenceTransformer
from llama_cpp import Llama


# ──────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────

@dataclass
class JourneyStep:
    # Required fields
    step_id: int
    event: str
    situation: str
    character_pov: str
    facts: list[str]
    hint: str
    failure_message: str
    # Optional extended fields
    id: Optional[str] = None
    year: Optional[int] = None
    # Progressive hints: [vague, moderate, obvious]
    # Auto-generated at load time if absent from JSON
    hints: Optional[list[str]] = None


@dataclass
class GameState:
    character_id: str
    era_id: str
    current_step: int = 0
    history: list[dict] = field(default_factory=list)
    step_attempts: dict = field(default_factory=dict)   # step_id → attempt count


# ──────────────────────────────────────────────
# RAG Engine
# ──────────────────────────────────────────────

class HistoricalRAGEngine:
    """
    Character-agnostic RAG engine for multi-era historical games.

    Directory layout expected:
        data/<era_id>/<character_id>.json
    e.g.:
        data/mauryan/ashoka.json
        data/ww2/churchill.json
    """

    MAX_ATTEMPTS = 3   # after this many failures → reveal and advance

    # Threshold per attempt index (0-based). Gets easier each time.
    THRESHOLDS = [0.58, 0.50, 0.42]

    def __init__(
        self,
        data_root: str = "data",
        model_path: str = "models/phi-3.5-mini-instruct.Q4_K_M.gguf",
        embedding_model: str = "all-MiniLM-L6-v2",
        n_ctx: int = 4096,
        n_gpu_layers: int = -1,
    ):
        self.data_root = Path(data_root)

        print("[RAG] Loading embedding model …")
        self.embedder = SentenceTransformer(embedding_model)

        print("[RAG] Loading Phi-3.5B LLM …")
        self.llm = Llama(
            model_path=model_path,
            n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
            verbose=False,
        )
        # Print whether GPU or CPU is being used
        model_meta = self.llm.metadata if hasattr(self.llm, "metadata") else {}
        offloaded = getattr(self.llm, "_n_gpu_layers", 0)

        if offloaded and offloaded != 0:
            print(f"[RAG] ⚡ Running on GPU (n_gpu_layers={offloaded})")
        else:
            print("[RAG] 🐢 Running on CPU only (n_gpu_layers=0)")



        self.steps: list[JourneyStep] = []
        self.state: Optional[GameState] = None

        # Embedding cache: step_id → list of 3 hint embeddings (one per attempt level)
        self._hint_embeddings: dict[int, list[np.ndarray]] = {}

    # ── Loading ────────────────────────────────

    def _generate_progressive_hints(self, step: JourneyStep) -> list[str]:
        """Use the LLM to expand a single hint into 3 progressive clues."""
        prompt = (
            f"<|system|>\n"
            f"You are writing hints for a history game. A player needs to type an action to progress.\n"
            f"The correct answer concept is: {step.hint}\n"
            f"\n"
            f"Write 3 hints of increasing directness. IMPORTANT rules:\n"
            f"- Each hint must be SHORT (under 12 words)\n"
            f"- Use simple everyday English, NOT formal or academic language\n"
            f"- Write what a player would naturally TYPE as an action\n"
            f"- Hint 1: a vague nudge about the theme (e.g. 'Think about power and control')\n"
            f"- Hint 2: a clear action direction (e.g. 'Try punishing or cracking down on them')\n"
            f"- Hint 3: almost the exact answer phrased naturally (e.g. 'Audit the guilds and punish cheaters')\n"
            f"\n"
            f"Respond ONLY with a JSON array: [\"hint1\", \"hint2\", \"hint3\"]\n"
            f"No extra text, no markdown.<|end|>\n<|assistant|>\n"
        )
        raw = self.llm(prompt, max_tokens=150, temperature=0.2, stop=["<|end|>", "<|user|>"])
        text = raw["choices"][0]["text"].strip()
        # Strip any markdown fences
        text = text.replace("```json", "").replace("```", "").strip()
        try:
            hints = json.loads(text)
            if isinstance(hints, list) and len(hints) == 3:
                return [str(h) for h in hints]
        except Exception:
            pass
        # Fallback
        words = step.hint.split()
        return [
            "Think about using your authority here.",
            f"Try to enforce or punish the wrongdoers.",
            step.hint,
        ]

    def load_character(self, character_id: str, era_id: str) -> GameState:
        """Load a character JSON and return a fresh GameState."""
        json_path = self.data_root / era_id / f"{character_id}.json"
        if not json_path.exists():
            raise FileNotFoundError(f"Character data not found: {json_path}")

        with open(json_path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        self.steps = [
            JourneyStep(**{k: v for k, v in entry.items()
                           if k in {f.name for f in fields(JourneyStep)}})
            for entry in raw
        ]
        assert 20 <= len(self.steps) <= 25, (
            f"Expected 20–25 steps, got {len(self.steps)}"
        )

        # Build progressive hints — use disk cache so LLM only runs ONCE per character
        cache_path = self.data_root / era_id / f"{character_id}.hints_cache.json"
        hint_cache: dict[int, list[str]] = {}

        if cache_path.exists():
            with open(cache_path, "r", encoding="utf-8") as f:
                hint_cache = {int(k): v for k, v in json.load(f).items()}
            print(f"[RAG] Loaded hint cache ({len(hint_cache)} steps) — skipping LLM generation.")
        else:
            print(f"[RAG] Building progressive hints for {len(self.steps)} steps (one-time, will cache) …")

        cache_dirty = False
        for step in self.steps:
            if step.hints and len(step.hints) >= 3:
                pass  # JSON already has hand-crafted hints, use them
            elif step.step_id in hint_cache:
                step.hints = hint_cache[step.step_id]
            else:
                print(f"      Generating hints for step {step.step_id}: {step.event[:40]} …")
                step.hints = self._generate_progressive_hints(step)
                hint_cache[step.step_id] = step.hints
                cache_dirty = True

        if cache_dirty:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(hint_cache, f, indent=2, ensure_ascii=False)
            print(f"[RAG] Hint cache saved → {cache_path}")

        # Pre-compute embeddings for all 3 hint levels per step
        print(f"[RAG] Encoding hint embeddings (3 levels × {len(self.steps)} steps) …")
        self._hint_embeddings = {}
        for step in self.steps:
            vecs = self.embedder.encode(step.hints, normalize_embeddings=True)
            self._hint_embeddings[step.step_id] = [vecs[0], vecs[1], vecs[2]]

        self.state = GameState(character_id=character_id, era_id=era_id)
        return self.state

    # ── Core Gate Logic ────────────────────────

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b))

    def _semantic_check(self, user_input: str, step_id: int, attempt_index: int) -> tuple[bool, float]:
        """
        Check against the hint for the current attempt level.
        Also checks all previous levels and takes the best score,
        so a great answer on attempt 2 still passes.
        """
        user_vec = self.embedder.encode(user_input, normalize_embeddings=True)
        hint_vecs = self._hint_embeddings[step_id]

        # Score against current and all earlier hint levels, take best
        best_score = max(
            self._cosine_similarity(user_vec, hint_vecs[i])
            for i in range(min(attempt_index + 1, len(hint_vecs)))
        )
        threshold = self.THRESHOLDS[min(attempt_index, len(self.THRESHOLDS) - 1)]
        return best_score >= threshold, best_score, threshold

    def _build_llm_prompt(self, step: JourneyStep, user_input: str) -> str:
        facts_text = "\n".join(f"- {f}" for f in step.facts)
        return (
            f"<|system|>\n"
            f"You are a historically accurate narrator for an immersive adventure game. "
            f"Write a vivid 2–3 paragraph narrative transition in second-person that:\n"
            f"1. Acknowledges the player's action: \"{user_input}\"\n"
            f"2. Weaves in the following historical facts naturally:\n{facts_text}\n"
            f"3. Ends with a compelling hook for the next challenge.\n"
            f"Keep the tone fitting the era and character's voice.<|end|>\n"
            f"<|assistant|>\n"
        )

    def _call_llm(self, prompt: str, max_tokens: int = 400) -> str:
        response = self.llm(
            prompt,
            max_tokens=max_tokens,
            temperature=0.7,
            top_p=0.9,
            stop=["<|end|>", "<|user|>"],
        )
        return response["choices"][0]["text"].strip()

    # ── Public API ─────────────────────────────

    def present_step(self) -> dict:
        if self.state is None:
            raise RuntimeError("Call load_character() first.")
        if self.state.current_step >= len(self.steps):
            return {"done": True, "message": "Journey complete!"}

        step = self.steps[self.state.current_step]
        step_id = step.step_id
        attempts_so_far = self.state.step_attempts.get(step_id, 0)

        return {
            "done": False,
            "step_id": step_id,
            "id": step.id,
            "year": step.year,
            "event": step.event,
            "situation": step.situation,
            "character_pov": step.character_pov,
            # Show the appropriate progressive hint (shown AFTER first failure)
            "current_hint_level": attempts_so_far,
            "progressive_hint": step.hints[min(attempts_so_far - 1, 2)] if attempts_so_far > 0 else None,
        }

    def process_input(self, user_input: str) -> dict:
        """
        The Gate: validate user_input against the current attempt's hint level.
        Thresholds relax each attempt. After MAX_ATTEMPTS failures, reveal and advance.
        """
        if self.state is None:
            raise RuntimeError("Call load_character() first.")
        if self.state.current_step >= len(self.steps):
            return {"success": False, "score": 0.0,
                    "response": "The journey is already complete.", "step_advanced": False}

        step = self.steps[self.state.current_step]
        step_id = step.step_id
        attempt_index = self.state.step_attempts.get(step_id, 0)  # 0-based

        passed, score, threshold_used = self._semantic_check(user_input, step_id, attempt_index)

        if passed:
            # ── SUCCESS PATH ──────────────────
            prompt = self._build_llm_prompt(step, user_input)
            narrative = self._call_llm(prompt)

            self.state.history.append({
                "step_id": step_id,
                "user_input": user_input,
                "score": round(score, 4),
                "attempt": attempt_index + 1,
                "outcome": "success",
                "narrative": narrative,
            })
            self.state.current_step += 1

            return {
                "success": True,
                "score": round(score, 4),
                "threshold": threshold_used,
                "response": narrative,
                "step_advanced": True,
            }

        else:
            # ── FAILURE PATH ──────────────────
            new_attempt_count = attempt_index + 1
            self.state.step_attempts[step_id] = new_attempt_count

            self.state.history.append({
                "step_id": step_id,
                "user_input": user_input,
                "score": round(score, 4),
                "attempt": new_attempt_count,
                "outcome": "failure",
            })

            if new_attempt_count >= self.MAX_ATTEMPTS:
                # ── REVEAL & ADVANCE ──────────
                reveal_msg = (
                    f"The intended approach was: \"{step.hints[2]}\"\n\n"
                    f"{step.failure_message}"
                )
                prompt = self._build_llm_prompt(step, step.hints[2])
                narrative = self._call_llm(prompt)
                self.state.current_step += 1
                return {
                    "success": False,
                    "score": round(score, 4),
                    "threshold": threshold_used,
                    "response": reveal_msg,
                    "narrative": narrative,
                    "step_advanced": True,
                    "revealed": True,
                }

            # ── GIVE PROGRESSIVE HINT ─────────
            next_hint = step.hints[min(new_attempt_count - 1, 2)]  # current level hint
            attempts_left = self.MAX_ATTEMPTS - new_attempt_count
            return {
                "success": False,
                "score": round(score, 4),
                "threshold": threshold_used,
                "response": step.failure_message,
                "progressive_hint": next_hint,
                "step_advanced": False,
                "revealed": False,
                "attempts_left": attempts_left,
            }

    def is_complete(self) -> bool:
        return self.state is not None and self.state.current_step >= len(self.steps)

    def get_progress(self) -> dict:
        if self.state is None:
            return {}
        return {
            "character_id": self.state.character_id,
            "era_id": self.state.era_id,
            "current_step": self.state.current_step,
            "total_steps": len(self.steps),
            "pct_complete": round(self.state.current_step / len(self.steps) * 100, 1),
        }