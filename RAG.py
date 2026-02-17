import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
import torch

import warnings

from llama_cpp import Llama
import os
import torch
from pathlib import Path

# Suppress warnings
warnings.filterwarnings('ignore')


@dataclass
class ChronologicalEvent:
    """Represents a single chronological event with metadata."""
    id: str
    phase: str
    year: str
    content: str
    metadata: Dict[str, Any]
    index: int


class DatasetLoader:
    """Loads and processes chronological JSON datasets."""
    
    def __init__(self, folder_path: str):
        self.folder_path = Path(folder_path)
        self.events: List[ChronologicalEvent] = []
        
    def load_all_files(self) -> List[ChronologicalEvent]:
        """Load all JSON files from the folder and flatten into chronological order."""
        all_data = []
        
        json_files = sorted(self.folder_path.glob("*.json"))
        print(f"Found {len(json_files)} JSON files")
        
        for file_path in json_files:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                if isinstance(data, list):
                    all_data.extend(data)
                elif isinstance(data, dict):
                    if 'events' in data:
                        all_data.extend(data['events'])
                    else:
                        all_data.append(data)
        
        all_data.sort(key=lambda x: self._extract_year_for_sorting(x))
        
        for idx, item in enumerate(all_data):
            event = self._create_event(item, idx)
            self.events.append(event)
        
        print(f"Loaded {len(self.events)} events in chronological order")
        return self.events
    
    def _extract_year_for_sorting(self, item: Dict) -> int:
        """Extract year for sorting, handling various formats."""
        year = item.get('year', item.get('date', '0'))
        
        if isinstance(year, str):
            import re
            match = re.search(r'\d+', year)
            if match:
                return int(match.group())
            return 0
        return int(year)
    
    def _create_event(self, item: Dict, index: int) -> ChronologicalEvent:
        """Convert a JSON item into a ChronologicalEvent."""
        event_id = item.get('id', f"event_{index}")
        phase = item.get('phase', item.get('era', 'Unknown'))
        year = str(item.get('year', item.get('date', 'Unknown')))
        
        content_parts = []
        content_parts.append(f"Year: {year}")
        content_parts.append(f"Phase: {phase}")
        
        for field in ['event', 'situation', 'description', 'text', 'summary']:
            if field in item and item[field]:
                content_parts.append(f"{field.title()}: {item[field]}")
        
        if 'facts' in item and item['facts']:
            facts_text = " ".join(item['facts']) if isinstance(item['facts'], list) else item['facts']
            content_parts.append(f"Facts: {facts_text}")
        
        if 'choices' in item and item['choices']:
            choices_text = " ".join(item['choices']) if isinstance(item['choices'], list) else item['choices']
            content_parts.append(f"Choices: {choices_text}")
        
        if 'learning_focus' in item and item['learning_focus']:
            content_parts.append(f"Learning Focus: {item['learning_focus']}")
        
        content = "\n".join(content_parts)
        
        return ChronologicalEvent(
            id=event_id,
            phase=phase,
            year=year,
            content=content,
            metadata=item,
            index=index
        )


class EmbeddingManager:
    """Manages text embeddings with configurable models."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", cache_folder: str = "./models"):
        """
        Initialize the embedding model with local caching.
        
        Args:
            model_name: HuggingFace model name for embeddings
            cache_folder: Local folder to cache models
        """
        print(f"Loading embedding model: {model_name}")
        
        # Create cache folder if it doesn't exist
        os.makedirs(cache_folder, exist_ok=True)
        
        # Detect device
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print(f"Embedding device: {self.device}")
        
        # Load model with increased timeout and local caching
        self.model = SentenceTransformer(
            model_name,
            cache_folder=cache_folder,
            device=self.device
        )
        
        # Enable GPU optimizations if available
        if self.device == 'cuda':
            self.model = self.model.half()  # Use FP16 for faster GPU inference
            print("GPU optimizations enabled (FP16)")
        
        self.dimension = self.model.get_sentence_embedding_dimension()
        print(f"Embedding dimension: {self.dimension}")
    
    def encode(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """Generate embeddings for a list of texts."""
        # Adjust batch size based on device
        if self.device == 'cuda':
            batch_size = 64  # Larger batches for GPU
        
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=True,
            convert_to_numpy=True,
            normalize_embeddings=True  # Pre-normalize for cosine similarity
        )
        return embeddings


class VectorStore:
    """FAISS-based vector store for efficient similarity search."""
    
    def __init__(self, dimension: int, use_gpu: bool = None):
        """
        Initialize vector store with optional GPU support.
        
        Args:
            dimension: Embedding dimension
            use_gpu: Whether to use GPU for FAISS. Auto-detects if None.
        """
        self.dimension = dimension
        self.use_gpu = torch.cuda.is_available() if use_gpu is None else use_gpu
        
        # Create base index
        self.index = faiss.IndexFlatIP(dimension)
        
        # Move to GPU if available
        if self.use_gpu:
            try:
                # Get GPU resources
                res = faiss.StandardGpuResources()
                self.index = faiss.index_cpu_to_gpu(res, 0, self.index)
                print(f"FAISS using GPU acceleration")
            except Exception as e:
                print(f"GPU acceleration not available for FAISS: {e}")
                print("Falling back to CPU")
                self.use_gpu = False
        else:
            print("FAISS using CPU")
        
        self.events: List[ChronologicalEvent] = []
        
    def add_events(self, events: List[ChronologicalEvent], embeddings: np.ndarray):
        """Add events and their embeddings to the vector store."""
        # Ensure float32 format
        embeddings = embeddings.astype('float32')
        
        # Normalize embeddings for cosine similarity
        faiss.normalize_L2(embeddings)
        
        self.index.add(embeddings)
        self.events = events
        
        print(f"Added {len(events)} events to vector store")
    
    def search(self, query_embedding: np.ndarray, k: int = 5) -> List[Tuple[ChronologicalEvent, float]]:
        """Search for similar events."""
        query_embedding = query_embedding.astype('float32').reshape(1, -1)
        faiss.normalize_L2(query_embedding)
        
        scores, indices = self.index.search(query_embedding, k)
        
        results = []
        for idx, score in zip(indices[0], scores[0]):
            if idx < len(self.events):
                results.append((self.events[idx], float(score)))
        
        return results
    
    def get_event_by_index(self, index: int) -> Optional[ChronologicalEvent]:
        """Get event by chronological index."""
        if 0 <= index < len(self.events):
            return self.events[index]
        return None
    
    def save(self, path: str):
        """Save the vector store to disk."""
        os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
        
        # Move index to CPU before saving if on GPU
        if self.use_gpu:
            index_to_save = faiss.index_gpu_to_cpu(self.index)
        else:
            index_to_save = self.index
        
        faiss.write_index(index_to_save, f"{path}.index")
        
        # Convert events to dict format for JSON serialization
        events_data = []
        for e in self.events:
            event_dict = asdict(e)
            events_data.append(event_dict)
        
        with open(f"{path}.json", 'w', encoding='utf-8') as f:
            json.dump(events_data, f, indent=2)
        
        print(f"Vector store saved to {path}")
    
    def load(self, path: str):
        """Load the vector store from disk."""
        # Load to CPU first
        cpu_index = faiss.read_index(f"{path}.index")
        
        # Move to GPU if enabled
        if self.use_gpu:
            try:
                res = faiss.StandardGpuResources()
                self.index = faiss.index_cpu_to_gpu(res, 0, cpu_index)
                print(f"Vector store loaded and moved to GPU")
            except Exception as e:
                print(f"Could not move to GPU: {e}")
                self.index = cpu_index
                self.use_gpu = False
        else:
            self.index = cpu_index
        
        with open(f"{path}.json", 'r', encoding='utf-8') as f:
            events_data = json.load(f)
            self.events = [ChronologicalEvent(**e) for e in events_data]
        print(f"Vector store loaded from {path}")


class ChronologicalRetriever:
    """Retrieves events with chronological context awareness."""
    
    def __init__(self, vector_store: VectorStore, embedding_manager: EmbeddingManager):
        self.vector_store = vector_store
        self.embedding_manager = embedding_manager
        self.current_index = 0
    
    def retrieve_next_event(self, context_window: int = 2) -> List[ChronologicalEvent]:
        """Retrieve the next event(s) in chronological order with context."""
        events = []
        
        for i in range(max(0, self.current_index - context_window), self.current_index):
            event = self.vector_store.get_event_by_index(i)
            if event:
                events.append(event)
        
        current_event = self.vector_store.get_event_by_index(self.current_index)
        if current_event:
            events.append(current_event)
            self.current_index += 1
        
        return events
    
    def retrieve_by_query(self, query: str, k: int = 3, context_window: int = 1) -> List[ChronologicalEvent]:
        """Retrieve events based on a semantic query."""
        query_embedding = self.embedding_manager.encode([query])[0]
        results = self.vector_store.search(query_embedding, k=k)
        
        event_indices = set()
        for event, score in results:
            event_indices.add(event.index)
            for i in range(max(0, event.index - context_window), event.index):
                event_indices.add(i)
        
        events = []
        for idx in sorted(event_indices):
            event = self.vector_store.get_event_by_index(idx)
            if event:
                events.append(event)
        
        return events
    
    def reset(self):
        """Reset the chronological progression."""
        self.current_index = 0


class StoryGenerator:
    """Generates narrative stories using a local LLM - OPTIMIZED VERSION."""
    
    def __init__(self, model_path: str, cache_folder: str = "./models"):
        """
        Initialize the story generator with a LOCAL LLM.
        
        Args:
            model_path: Path to your locally downloaded Phi-3.5 model
                       This should be either:
                       1. A local directory path (e.g., "./models/Phi-3.5-mini-instruct")
                       2. A HuggingFace model name (will download to cache_folder)
            cache_folder: Fallback cache folder for models
        """
        print(f"Loading LLM from: {model_path}")
        
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {self.device}")
        
        os.makedirs(cache_folder, exist_ok=True)
        
        # FIXED: Load from local path with proper offline settings
        # Check if model_path is a local directory
        local_path = Path(model_path)
        
        # AUTO-FIX: Handle HuggingFace cache directory structure
        if local_path.exists() and local_path.is_dir():
            # Check if this is a HF cache dir (has "snapshots" subdirectory)
            snapshots_dir = local_path / "snapshots"
            if snapshots_dir.exists() and snapshots_dir.is_dir():
                print(f"⚠ Detected HuggingFace cache directory structure")
                print(f"  Looking for snapshots in: {snapshots_dir}")
                
                # Find the most recent valid snapshot
                valid_snapshots = []
                for snapshot in snapshots_dir.iterdir():
                    if snapshot.is_dir():
                        # Check if has required files
                        has_config = (snapshot / "config.json").exists()
                        has_model = (
                            (snapshot / "model.safetensors").exists() or
                            len(list(snapshot.glob("*.safetensors"))) > 0
                        )
                        if has_config and has_model:
                            valid_snapshots.append(snapshot)
                
                if valid_snapshots:
                    # Use the last one (most recent)
                    model_source = str(valid_snapshots[-1])
                    print(f"✓ Found valid snapshot: {model_source}")
                    use_offline = True
                else:
                    print(f"❌ No valid snapshots found in cache directory!")
                    print(f"   Falling back to HuggingFace download")
                    model_source = model_path
                    use_offline = False
            else:
                # Regular directory with model files
                print(f"✓ Loading from local directory: {model_path}")
                model_source = str(local_path)
                use_offline = True
        else:
            print(f"⚠ Local path not found, will download from HuggingFace")
            model_source = model_path
            use_offline = False
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_source,
            trust_remote_code=True,
            cache_dir=cache_folder,
            local_files_only=use_offline  # FIXED: Don't connect to HF if local
        )
        
        # Ensure pad token is set
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # FIXED: Load model from local path with optimizations
        print("Loading model weights (this may take a moment)...")
        self.model = AutoModelForCausalLM.from_pretrained(
            model_source,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            device_map="auto" if self.device == "cuda" else None,
            trust_remote_code=True,
            cache_dir=cache_folder,
            local_files_only=use_offline,  # FIXED: Don't connect to HF if local
            attn_implementation="eager",  # More compatible than flash attention
            low_cpu_mem_usage=True
        )
        
        if self.device == "cpu":
            self.model = self.model.to(self.device)
        
        # Enable GPU optimizations
        if self.device == "cuda":
            print("GPU optimizations enabled:")
            print(f"  - Using FP16 precision")
            print(f"  - Device map: {self.model.hf_device_map if hasattr(self.model, 'hf_device_map') else 'auto'}")
        
        self.model.eval()
        print("✓ LLM loaded successfully")
        
        self.story_so_far = ""
    
    def generate_story_segment(
        self,
        events: List[ChronologicalEvent],
        max_length: int = 200,  # REDUCED: Faster generation
        temperature: float = 0.7
    ) -> str:
        """Generate a story segment from the retrieved events - OPTIMIZED."""
        if not events:
            return "No events to narrate."
        
        prompt = self._build_prompt(events)
        
        # OPTIMIZED: Limit input length to speed up processing
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=1024  # REDUCED: Less context to process = faster
        ).to(self.device)
        
        # OPTIMIZED generation parameters
        generation_kwargs = {
            "max_new_tokens": max_length,
            "temperature": temperature,
            "do_sample": True,
            "top_p": 0.9,
            "top_k": 50,
            "repetition_penalty": 1.1,
            "pad_token_id": self.tokenizer.pad_token_id,
            "eos_token_id": self.tokenizer.eos_token_id,
            "num_return_sequences": 1,
            "use_cache": True,  # CRITICAL FIX: Enable KV-cache for 10x speedup!
            "num_beams": 1,  # OPTIMIZED: Greedy/sampling is faster than beam search
        }
        
        # Generate with optimizations
        print("Generating response...", end=" ", flush=True)
        with torch.no_grad():
            if self.device == "cuda":
                # Use mixed precision for faster generation
                with torch.cuda.amp.autocast():
                    outputs = self.model.generate(**inputs, **generation_kwargs)
            else:
                outputs = self.model.generate(**inputs, **generation_kwargs)
        print("✓")
        
        # Decode
        generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Extract only the generated part
        if prompt in generated_text:
            story_segment = generated_text[len(prompt):].strip()
        else:
            # Fallback: take everything after the last instruction marker
            story_segment = generated_text.split("Story segment:")[-1].strip()
        
        # Clean up the output
        story_segment = self._clean_output(story_segment)
        
        self.story_so_far += "\n\n" + story_segment
        
        return story_segment
    
    def _clean_output(self, text: str) -> str:
        """Clean up generated text."""
        # Remove any instruction artifacts
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            line = line.strip()
            # Skip lines that look like instructions
            if any(marker in line.lower() for marker in ['instruction:', 'note:', 'remember:', 'important:']):
                continue
            if line:
                cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines)
    
    def _build_prompt(self, events: List[ChronologicalEvent]) -> str:
        """Build a prompt for the LLM based on events."""
        if not events:
            return ""
        
        is_continuation = len(self.story_so_far) > 0
        
        context_parts = []
        current_event = events[-1]
        previous_events = events[:-1]
        
        if previous_events:
            context_parts.append("Previous events:")
            for event in previous_events[-2:]:
                context_parts.append(f"- {event.year}: {event.metadata.get('event', 'Event occurred')}")
        
        context_parts.append(f"\nCurrent event to narrate:")
        context_parts.append(f"Year: {current_event.year}")
        context_parts.append(f"Phase: {current_event.phase}")
        
        if 'event' in current_event.metadata:
            context_parts.append(f"Event: {current_event.metadata['event']}")
        if 'situation' in current_event.metadata:
            context_parts.append(f"Situation: {current_event.metadata['situation']}")
        if 'facts' in current_event.metadata:
            facts = current_event.metadata['facts']
            if isinstance(facts, list):
                context_parts.append(f"Key Facts: {'; '.join(facts)}")
            else:
                context_parts.append(f"Key Facts: {facts}")
        
        if 'choices' in current_event.metadata and current_event.metadata['choices']:
            choices = current_event.metadata['choices']
            if isinstance(choices, list):
                context_parts.append(f"Choices made: {'; '.join(choices)}")
            else:
                context_parts.append(f"Choices made: {choices}")
        
        context = "\n".join(context_parts)
        
        # OPTIMIZED: Shorter, clearer prompt for faster processing
        if is_continuation:
            prompt = f"""Continue the historical narrative as Akbar.

{context}

Write a brief, engaging paragraph (100-150 words):"""
        else:
            prompt = f"""Begin narrating this historical event as Akbar.

{context}

Write a brief, engaging paragraph (100-150 words):"""
        
        return prompt
    
    def reset_context(self):
        """Reset the story context."""
        self.story_so_far = ""


class RAGSystem:
    """Complete RAG system orchestrating all components."""
    
    def __init__(
        self,
        dataset_folder: str,
        embedding_model: str = "all-MiniLM-L6-v2",
        llm_model_path: str = "./models/Phi-3.5-mini-instruct",  # CHANGED: Default to local path
        cache_folder: str = "./models",
        use_gpu: bool = None
    ):
        """
        Initialize the complete RAG system.
        
        Args:
            dataset_folder: Path to folder containing JSON files
            embedding_model: Name of embedding model to use
            llm_model_path: Path to your LOCAL Phi-3.5 model or HuggingFace model name
            cache_folder: Folder to cache downloaded models
            use_gpu: Force GPU usage (True/False) or auto-detect (None)
        """
        print("=" * 70)
        print("Initializing OPTIMIZED RAG System for Chronological Storytelling")
        print("=" * 70)
        
        # Check GPU availability
        if use_gpu is None:
            use_gpu = torch.cuda.is_available()
        
        if use_gpu and torch.cuda.is_available():
            print(f"\n🚀 GPU detected: {torch.cuda.get_device_name(0)}")
            print(f"   CUDA version: {torch.version.cuda}")
            print(f"   Available memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
        else:
            print("\n💻 Running on CPU")
        
        # Initialize components with caching
        self.loader = DatasetLoader(dataset_folder)
        self.embedding_manager = EmbeddingManager(embedding_model, cache_folder)
        self.vector_store = VectorStore(self.embedding_manager.dimension, use_gpu)
        self.story_generator = StoryGenerator(llm_model_path, cache_folder)  # FIXED: Pass local path
        
        self._initialize_dataset()
        
        self.retriever = ChronologicalRetriever(self.vector_store, self.embedding_manager)
        
        print("\n" + "=" * 70)
        print("RAG System Ready!")
        print("=" * 70 + "\n")
    
    def _initialize_dataset(self):
        """Load dataset and create vector store."""
        print("\n--- Loading Dataset ---")
        events = self.loader.load_all_files()
        
        if not events:
            raise ValueError("No events loaded from dataset!")
        
        print("\n--- Creating Embeddings ---")
        texts = [event.content for event in events]
        embeddings = self.embedding_manager.encode(texts)
        
        print("\n--- Building Vector Store ---")
        self.vector_store.add_events(events, embeddings)
    
    def generate_next_segment(self, context_window: int = 2) -> str:
        """Generate the next story segment in chronological order."""
        events = self.retriever.retrieve_next_event(context_window)
        
        if not events:
            return "The story has concluded."
        
        story = self.story_generator.generate_story_segment(events)
        return story
    
    def generate_from_query(self, query: str, k: int = 3, context_window: int = 1) -> str:
        """Generate a story segment based on a user query."""
        events = self.retriever.retrieve_by_query(query, k, context_window)
        
        if not events:
            return "No relevant events found for this query."
        
        story = self.story_generator.generate_story_segment(events)
        return story
    
    def reset(self):
        """Reset the system to start from the beginning."""
        self.retriever.reset()
        self.story_generator.reset_context()
    
    def save_vector_store(self, path: str):
        """Save the vector store to disk for later use."""
        self.vector_store.save(path)
    
    def load_vector_store(self, path: str):
        """Load a previously saved vector store."""
        self.vector_store.load(path)
    
    def get_progress(self) -> Tuple[int, int]:
        """Get current progress through the story."""
        return (self.retriever.current_index, len(self.vector_store.events))


# ============================================================================
# Example Usage
# ============================================================================

def main():
    """Example usage of the OPTIMIZED RAG system."""
    
    # Configuration
    DATASET_FOLDER = "./historical_events"
    EMBEDDING_MODEL = "all-MiniLM-L6-v2"
    
    # IMPORTANT: Update this to point to your local Phi-3.5 model
    # The code now auto-detects HuggingFace cache structure!
    
    # Option 1: HuggingFace cache directory (auto-detects snapshots)
    LLM_MODEL_PATH = r"C:\Users\LEGION\OneDrive\Desktop\DND\models\models--microsoft--Phi-3.5-mini-instruct"
    
    # Option 2: Direct snapshot path
    # LLM_MODEL_PATH = r"C:\Users\LEGION\OneDrive\Desktop\DND\models\models--microsoft--Phi-3.5-mini-instruct\snapshots\<hash>"
    
    # Option 3: Simple local directory
    # LLM_MODEL_PATH = "./models/Phi-3.5-mini-instruct"
    
    # Option 4: Or use the HuggingFace name (will download if needed)
    # LLM_MODEL_PATH = "microsoft/Phi-3.5-mini-instruct"
    
    CACHE_FOLDER = "./models"
    USE_GPU = None  # Auto-detect (set to True/False to force)
    
    try:
        # Initialize RAG system
        rag = RAGSystem(
            dataset_folder=DATASET_FOLDER,
            embedding_model=EMBEDDING_MODEL,
            llm_model_path=LLM_MODEL_PATH,  # FIXED: Use local path
            cache_folder=CACHE_FOLDER,
            use_gpu=USE_GPU
        )
        
        print("\n" + "="*70)
        print("OPTIMIZED RAG SYSTEM DEMO")
        print("="*70)
        
        # Example 1: Generate story chronologically
        print("\n--- Example 1: Sequential Story Generation ---\n")
        
        for i in range(3):
            print(f"\n[Segment {i+1}]")
            story_segment = rag.generate_next_segment(context_window=2)
            print(story_segment)
            print("\n" + "-"*70)
        
        current, total = rag.get_progress()
        print(f"\nProgress: {current}/{total} events processed")
        
        # Example 2: Query-based retrieval
        print("\n--- Example 2: Query-based Story Generation ---\n")
        
        query = "What were the major conflicts or battles?"
        print(f"Query: {query}\n")
        
        story_segment = rag.generate_from_query(query, k=3, context_window=1)
        print(story_segment)
        
        # Save vector store
        print("\n--- Saving Vector Store ---")
        rag.save_vector_store("./rag_vectorstore")
        
        # Print performance info if on GPU
        if torch.cuda.is_available():
            print("\n--- GPU Memory Usage ---")
            print(f"Allocated: {torch.cuda.memory_allocated(0) / 1e9:.2f} GB")
            print(f"Reserved: {torch.cuda.memory_reserved(0) / 1e9:.2f} GB")
        
    except Exception as e:
        print(f"\nError occurred: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()