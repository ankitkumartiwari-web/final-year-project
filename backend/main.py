from fastapi import FastAPI
from pathlib import Path
import json
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from rag_engine import HistoricalRAGEngine

app = FastAPI()

# Allow Vite frontend (5173) and any other local ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://localhost:5173",      # Vite default
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create ONE global engine instance
engine = HistoricalRAGEngine()
SAVE_DIR = Path(__file__).resolve().parent / "saves"
SAVE_PATH = SAVE_DIR / "current_game.json"


# ──────────────────────────────────────────────
# Request Models
# ──────────────────────────────────────────────

class StartRequest(BaseModel):
    character_id: str
    era_id: str

class InputRequest(BaseModel):
    user_input: str


class SaveMetadata(BaseModel):
    event_id: str
    event_title: str
    character_id: str
    character_name: str


class SaveRequest(BaseModel):
    metadata: SaveMetadata


def _write_save_file(metadata: SaveMetadata):
    state = engine.export_state()
    if state is None:
        raise RuntimeError("No active game to save.")

    SAVE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "metadata": metadata.model_dump(),
        "state": state,
        "progress": engine.get_progress(),
        "current_step_data": engine.present_step(),
    }
    with open(SAVE_PATH, "w", encoding="utf-8") as save_file:
        json.dump(payload, save_file, indent=2, ensure_ascii=False)


def _read_save_file() -> dict | None:
    if not SAVE_PATH.exists():
        return None

    with open(SAVE_PATH, "r", encoding="utf-8") as save_file:
        return json.load(save_file)


def _autosave_active_game():
    save_data = _read_save_file()
    if save_data is None or engine.state is None:
        return

    metadata = SaveMetadata(**save_data["metadata"])
    _write_save_file(metadata)


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Historical RAG Backend Running 🚀"}


@app.post("/start")
def start_game(data: StartRequest):
    state = engine.load_character(data.character_id, data.era_id)
    return {
        "message": "Game started",
        "state": engine.get_progress(),
        "first_step": engine.present_step()
    }


@app.get("/step")
def get_current_step():
    return engine.present_step()


@app.post("/input")
def process_input(data: InputRequest):
    if engine.state is None:
        return {
            "success": False,
            "type": "hint",
            "done": False,
            "score": 0.0,
            "step_advanced": False,
            "next_step": None,
            "response": "⚠️ Game not started yet — the character data is still loading. Please wait a moment and try again.",
        }

    result = engine.process_input(data.user_input)

    # Add `type` so the frontend can style the response correctly
    result["type"] = "success" if result["success"] else "hint"

    # Flag if the journey is now complete after this step
    result["done"] = engine.is_complete()

    # Include next step so frontend can display the next situation
    result["next_step"] = engine.present_step() if result["step_advanced"] and not engine.is_complete() else None
    _autosave_active_game()

    return result


@app.get("/progress")
def progress():
    return engine.get_progress()


@app.get("/save")
def get_saved_game():
    save_data = _read_save_file()
    if save_data is None:
        return {"has_save": False}

    return {
        "has_save": True,
        "metadata": save_data["metadata"],
        "progress": save_data["progress"],
        "current_step_data": save_data["current_step_data"],
    }


@app.post("/save")
def save_game(data: SaveRequest):
    _write_save_file(data.metadata)
    return {
        "message": "Game saved",
        "progress": engine.get_progress(),
    }


@app.post("/load")
def load_saved_game():
    save_data = _read_save_file()
    if save_data is None:
        return {
            "success": False,
            "message": "No saved game found.",
        }

    state = engine.restore_state(save_data["state"])
    current_step = engine.present_step()
    progress = engine.get_progress()

    refreshed_payload = {
        "metadata": save_data["metadata"],
        "state": engine.export_state(),
        "progress": progress,
        "current_step_data": current_step,
    }
    SAVE_DIR.mkdir(parents=True, exist_ok=True)
    with open(SAVE_PATH, "w", encoding="utf-8") as save_file:
        json.dump(refreshed_payload, save_file, indent=2, ensure_ascii=False)

    return {
        "success": True,
        "message": "Saved game loaded",
        "metadata": save_data["metadata"],
        "state": state,
        "progress": progress,
        "current_step_data": current_step,
    }


@app.delete("/save")
def clear_saved_game():
    if SAVE_PATH.exists():
        SAVE_PATH.unlink()
    return {"message": "Saved game cleared"}
