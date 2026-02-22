from fastapi import FastAPI
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


# ──────────────────────────────────────────────
# Request Models
# ──────────────────────────────────────────────

class StartRequest(BaseModel):
    character_id: str
    era_id: str

class InputRequest(BaseModel):
    user_input: str


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

    return result


@app.get("/progress")
def progress():
    return engine.get_progress()
