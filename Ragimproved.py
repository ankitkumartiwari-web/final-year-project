import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import warnings

import numpy as np
import torch
import faiss
from sentence_transformers import SentenceTransformer
from llama_cpp import Llama

warnings.filterwarnings("ignore")


# =============================================================================
# Data Model
# =============================================================================

@dataclass
class ChronologicalEvent:
    id: str
    phase: str
    year: str
    content: str
    metadata: Dict[str, Any]
    index: int


# =============================================================================
# Dataset Loader (UNCHANGED)
# =============================================================================

class DatasetLoader:
    def __init__(self, folder_path: str):
        self.folder_path = Path(folder_path)
        self.events: List[ChronologicalEvent] = []

    def load_all_files(self) -> List[ChronologicalEvent]:
        all_data = []

        json_files = sorted(self.folder_path.glob("*.json"))
        print(f"Found {len(json_files)} JSON files")

        for file_path in json_files:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

                if isinstance(data, list):
                    all_data.extend(data)
                elif isinstance(data, dict) and "events" in data:
                    all_data.extend(data["events"])
                else:
                    all_data.append(data)

        all_data.sort(key=lambda x: self._extract_year(x))

        for idx, item in enumerate(all_data):
            self.events.append(self._create_event(item, idx))

        print(f"Loaded {len(self.events)} events")
        return self.events

    def _extract_year(self, item: Dict) -> int:
        year = item.get("year", item.get("date", "0"))
        digits = "".join(filter(str.isdigit, str(year)))
        return int(digits) if digits else 0

    def _create_event(self, item: Dict, index: int) -> ChronologicalEvent:
        content_parts = [
            f"Year: {item.get('year', 'Unknown')}",
            f"Phase: {item.get('phase', item.get('era', 'Unknown'))}"
        ]

        for field in ["event", "situation", "description", "facts", "choices"]:
            if field in item and item[field]:
                value = item[field]
                if isinstance(value, list):
                    value = "; ".join(map(str, value))
                content_parts.append(f"{field.capitalize()}: {value}")

        return ChronologicalEvent(
            id=item.get("id", f"event_{index}"),
            phase=item.get("phase", "Unknown"),
            year=str(item.get("year", "Unknown")),
            content="\n".join(content_parts),
            metadata=item,
            index=index
        )


# =============================================================================
# Embedding Manager (UNCHANGED)
# =============================================================================

class EmbeddingManager:
    def __init__(self, model_name="all-MiniLM-L6-v2", cache_folder="./models"):
        print(f"Loading embedding model: {model_name}")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        self.model = SentenceTransformer(
            model_name,
            cache_folder=cache_folder,
            device=self.device
        )

        if self.device == "cuda":
            self.model = self.model.half()

        self.dimension = self.model.get_sentence_embedding_dimension()

    def encode(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        return self.model.encode(
            texts,
            batch_size=batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False
        ).astype("float32")


# =============================================================================
# Vector Store (UNCHANGED)
# =============================================================================

class VectorStore:
    def __init__(self, dimension: int, use_gpu: bool = None):
        self.dimension = dimension
        self.use_gpu = torch.cuda.is_available() if use_gpu is None else use_gpu

        index = faiss.IndexFlatIP(dimension)

        if self.use_gpu:
            try:
                res = faiss.StandardGpuResources()
                index = faiss.index_cpu_to_gpu(res, 0, index)
                print("FAISS GPU enabled")
            except Exception:
                print("FAISS GPU unavailable, falling back to CPU")
                self.use_gpu = False

        self.index = index
        self.events: List[ChronologicalEvent] = []

    def add_events(self, events: List[ChronologicalEvent], embeddings: np.ndarray):
        faiss.normalize_L2(embeddings)
        self.index.add(embeddings)
        self.events = events

    def search(self, query_embedding: np.ndarray, k: int):
        query_embedding = query_embedding.reshape(1, -1)
        faiss.normalize_L2(query_embedding)

        scores, indices = self.index.search(query_embedding, k)
        return [
            (self.events[i], float(scores[0][idx]))
            for idx, i in enumerate(indices[0])
            if i < len(self.events)
        ]

    def get_event_by_index(self, index: int) -> Optional[ChronologicalEvent]:
        return self.events[index] if 0 <= index < len(self.events) else None


# =============================================================================
# Chronological Retriever (UNCHANGED)
# =============================================================================

class ChronologicalRetriever:
    def __init__(self, vector_store: VectorStore, embedding_manager: EmbeddingManager):
        self.vector_store = vector_store
        self.embedding_manager = embedding_manager
        self.current_index = 0

    def retrieve_next_event(self, context_window: int = 2) -> List[ChronologicalEvent]:
        events = []

        for i in range(max(0, self.current_index - context_window), self.current_index):
            e = self.vector_store.get_event_by_index(i)
            if e:
                events.append(e)

        current = self.vector_store.get_event_by_index(self.current_index)
        if current:
            events.append(current)
            self.current_index += 1

        return events

    def retrieve_by_query(self, query: str, k: int = 3, context_window: int = 1):
        emb = self.embedding_manager.encode([query])[0]
        results = self.vector_store.search(emb, k)

        indices = set()
        for event, _ in results:
            for i in range(max(0, event.index - context_window), event.index + 1):
                indices.add(i)

        return [
            self.vector_store.get_event_by_index(i)
            for i in sorted(indices)
            if self.vector_store.get_event_by_index(i)
        ]

    def reset(self):
        self.current_index = 0


# =============================================================================
# Story Generator (llama.cpp – PRODUCTION)
# =============================================================================

class StoryGenerator:
    def __init__(self, model_path: str):
        if not model_path.endswith(".gguf"):
            raise ValueError("Only GGUF models are supported")

        if not Path(model_path).exists():
            raise FileNotFoundError(model_path)

        print(f"Loading GGUF model via llama.cpp:\n{model_path}")

        self.llm = Llama(
            model_path=model_path,
            n_ctx=2048,
            n_threads=os.cpu_count(),
            n_gpu_layers=-1,   # RTX 3070 FULL OFFLOAD
            use_mmap=True,
            use_mlock=True,
            verbose=False
        )

        self.story_so_far = ""

    def generate_story_segment(
        self,
        events: List[ChronologicalEvent],
        max_tokens: int = 200,
        temperature: float = 0.7
    ) -> str:

        if not events:
            return "No events to narrate."

        prompt = self._build_prompt(events)

        output = self.llm(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=0.9,
            repeat_penalty=1.1,
            stop=["</s>"]
        )

        text = output["choices"][0]["text"].strip()
        self.story_so_far += "\n\n" + text
        return text

    def _build_prompt(self, events: List[ChronologicalEvent]) -> str:
        current = events[-1]
        previous = events[:-1][-2:]

        parts = []

        if previous:
            parts.append("Previous events:")
            for e in previous:
                parts.append(f"- {e.year}: {e.metadata.get('event','')}")

        parts.append("\nCurrent event:")
        parts.append(current.content)

        return (
            "Continue narrating history as Akbar.\n\n"
            + "\n".join(parts)
            + "\n\nWrite a concise, vivid paragraph:"
        )

    def reset_context(self):
        self.story_so_far = ""


# =============================================================================
# RAG System (UNCHANGED INTERFACE)
# =============================================================================

class RAGSystem:
    def __init__(
        self,
        dataset_folder: str,
        embedding_model: str,
        llm_model_path: str,
        cache_folder: str = "./models",
        use_gpu: bool = None
    ):
        print("=" * 60)
        print("Initializing Production RAG System (llama.cpp)")
        print("=" * 60)

        self.loader = DatasetLoader(dataset_folder)
        self.embedding_manager = EmbeddingManager(embedding_model, cache_folder)
        self.vector_store = VectorStore(self.embedding_manager.dimension, use_gpu)
        self.story_generator = StoryGenerator(llm_model_path)

        self._initialize_dataset()
        self.retriever = ChronologicalRetriever(self.vector_store, self.embedding_manager)

    def _initialize_dataset(self):
        events = self.loader.load_all_files()
        embeddings = self.embedding_manager.encode([e.content for e in events])
        self.vector_store.add_events(events, embeddings)

    def generate_next_segment(self, context_window: int = 2) -> str:
        events = self.retriever.retrieve_next_event(context_window)
        return self.story_generator.generate_story_segment(events)

    def generate_from_query(self, query: str, k: int = 3, context_window: int = 1) -> str:
        events = self.retriever.retrieve_by_query(query, k, context_window)
        return self.story_generator.generate_story_segment(events)

    def reset(self):
        self.retriever.reset()
        self.story_generator.reset_context()

if __name__ == "__main__":
    DATASET_FOLDER = "./historical_events"
    EMBEDDING_MODEL = "all-MiniLM-L6-v2"

    LLM_MODEL_PATH = r"C:\Users\LEGION\OneDrive\Desktop\Python Shit\A.i Gui V2\phi-2.Q4_K_M.gguf"

    rag = RAGSystem(
        dataset_folder=DATASET_FOLDER,
        embedding_model=EMBEDDING_MODEL,
        llm_model_path=LLM_MODEL_PATH,
        cache_folder="./models",
        use_gpu=True
    )

    print("\n=== GENERATING STORY ===\n")
    print(rag.generate_next_segment())

    print("\n=== QUERY MODE ===\n")
    print(rag.generate_from_query("Describe major conflicts and decisions"))
