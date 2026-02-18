"""
Multi-Era Historical Game RAG Engine
Uses Phi-3.5B (via llama-cpp-python) + Sentence-Transformers for semantic validation.
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
    # Required fields (must be present in every JSON entry)
    step_id: int
    event: str
    situation: str
    character_pov: str
    facts: list[str]
    hint: str
    failure_message: str
    # Optional extended fields — present in newer JSON schemas, safely ignored if absent
    id: Optional[str] = None    # e.g. "ashoka_01_ujjain" — slug identifier
    year: Optional[int] = None  # e.g. -285 for 285 BCE


@dataclass
class GameState:
    character_id: str
    era_id: str
    current_step: int = 0
    history: list[dict] = field(default_factory=list)


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

    SIMILARITY_THRESHOLD = 0.70

    def __init__(
        self,
        data_root: str = "data",
        model_path: str = "models/phi-3.5-mini-instruct.Q4_K_M.gguf",
        embedding_model: str = "all-MiniLM-L6-v2",
        n_ctx: int = 4096,
        n_gpu_layers: int = -1,  # -1 = offload all layers to GPU if available
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

        # Runtime state
        self.steps: list[JourneyStep] = []
        self.state: Optional[GameState] = None

        # Embedding cache: step_id → hint_embedding (numpy array)
        self._hint_embeddings: dict[int, np.ndarray] = {}

    # ── Loading ────────────────────────────────

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

        # Pre-compute hint embeddings for all steps
        print(f"[RAG] Encoding {len(self.steps)} hint vectors …")
        hints = [s.hint for s in self.steps]
        vecs = self.embedder.encode(hints, normalize_embeddings=True)
        self._hint_embeddings = {s.step_id: vecs[i] for i, s in enumerate(self.steps)}

        self.state = GameState(character_id=character_id, era_id=era_id)
        return self.state

    # ── Core Gate Logic ────────────────────────

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Cosine similarity between two L2-normalised vectors (= dot product)."""
        return float(np.dot(a, b))

    def _semantic_check(self, user_input: str, step_id: int) -> tuple[bool, float]:
        """Return (passed, score)."""
        user_vec = self.embedder.encode(user_input, normalize_embeddings=True)
        hint_vec = self._hint_embeddings[step_id]
        score = self._cosine_similarity(user_vec, hint_vec)
        return score >= self.SIMILARITY_THRESHOLD, score

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
        """Return current step's public-facing content (situation + pov)."""
        if self.state is None:
            raise RuntimeError("Call load_character() first.")
        if self.state.current_step >= len(self.steps):
            return {"done": True, "message": "Journey complete!"}

        step = self.steps[self.state.current_step]
        return {
            "done": False,
            "step_id": step.step_id,
            "id": step.id,
            "year": step.year,
            "event": step.event,
            "situation": step.situation,
            "character_pov": step.character_pov,
        }

    def process_input(self, user_input: str) -> dict:
        """
        The Gate: validate user_input, call LLM on success, return failure_message on failure.

        Returns a dict with keys:
            success (bool), score (float), response (str), step_advanced (bool)
        """
        if self.state is None:
            raise RuntimeError("Call load_character() first.")
        if self.state.current_step >= len(self.steps):
            return {"success": False, "score": 0.0,
                    "response": "The journey is already complete.", "step_advanced": False}

        step = self.steps[self.state.current_step]
        passed, score = self._semantic_check(user_input, step.step_id)

        if passed:
            # ── SUCCESS PATH ──────────────────
            prompt = self._build_llm_prompt(step, user_input)
            narrative = self._call_llm(prompt)

            self.state.history.append({
                "step_id": step.step_id,
                "user_input": user_input,
                "score": round(score, 4),
                "outcome": "success",
                "narrative": narrative,
            })
            self.state.current_step += 1

            return {
                "success": True,
                "score": round(score, 4),
                "response": narrative,
                "step_advanced": True,
            }
        else:
            # ── FAILURE PATH ──────────────────
            self.state.history.append({
                "step_id": step.step_id,
                "user_input": user_input,
                "score": round(score, 4),
                "outcome": "failure",
            })
            return {
                "success": False,
                "score": round(score, 4),
                "response": step.failure_message,
                "step_advanced": False,
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
