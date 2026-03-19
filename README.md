# 🎮 Reliving History

> *An AI-powered Historical RPG that transforms learning into experience.*

---

## 📖 Table of Contents

* [Overview](#-overview)
* [Quickstart](#-quickstart)
* [Features](#-features)
* [Project Structure](#-project-structure)
* [Project Index](#-project-index)
* [Roadmap](#-roadmap)
* [Contribution](#-contribution)
* [License](#-license)
* [Acknowledgements](#-acknowledgements)

---

## 🌍 Overview

**Reliving History** is an AI-driven, text-based Role Playing Game (RPG) designed to make history learning interactive and immersive.

Instead of memorizing facts, users:

* Select a historical event
* Choose a character from that timeline
* Interact using natural language commands
* Experience consequences based on real historical logic

The system dynamically generates story responses using an AI engine while maintaining historical accuracy.

---

## ⚡ Quickstart

### 🔧 Prerequisites

* Node.js (v18+)
* npm
* Python (3.10+)
* Git

---

### 🚀 Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

### ⚙️ Backend Setup

```bash
cd backend
python -m venv myenv
myenv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

---

### 🔗 Environment Variables

Create `.env` file:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## ✨ Features

* 🎯 **Event-Based Gameplay** – Choose historical timelines (e.g., Ashoka Empire)
* 👤 **Dynamic Character Selection** – Characters fetched from backend
* 💬 **Natural Language Commands** – Type actions instead of clicking
* 🧠 **AI Story Engine** – Generates real-time narrative responses
* 📚 **Historical Accuracy System** – Provides hints for incorrect actions
* 🔄 **Backend-Driven Content** – No hardcoded stories
* 🎨 **Minimal UI** – Focus on storytelling
* 📈 **Scalable Design** – Add unlimited events & characters
* 🎮 **Immersive Experience** – Supports animations & visual storytelling
* 🎓 **Educational Impact** – Learning through interaction

---

## 🏗️ Project Structure

```
final-year-project/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── assets/
│   │   ├── services/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── prompt_builder.py
│   ├── requirements.txt
│   └── database/
│
├── README.md
└── .gitignore
```

---

## 📌 Project Index

| Section          | Description                 |
| ---------------- | --------------------------- |
| Overview         | Project purpose and concept |
| Quickstart       | Setup instructions          |
| Features         | Key functionalities         |
| Structure        | Folder architecture         |
| Roadmap          | Future improvements         |
| Contribution     | How to contribute           |
| License          | Legal permissions           |
| Acknowledgements | Credits                     |

---

## 🛣️ Roadmap

### ✅ Completed

* UI Design (React + Vite)
* Event Selection Screen
* Character Selection Screen
* Story Gameplay Interface
* Basic Command System

### 🚧 In Progress

* Backend API Integration
* AI Story Engine Connection
* Dynamic Story Fetching

### 🔮 Future Plans

* Voice Interaction
* Multiplayer Mode
* VR/3D Immersive Experience
* Advanced AI Narrative Engine
* Player Progress Tracking
* Adaptive Difficulty System

---

## 🤝 Contribution

Contributions are welcome!

### Steps:

1. Fork the repository
2. Create a new branch (`feature-name`)
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

### Guidelines:

* Keep code clean & modular
* Follow project structure
* Maintain UI consistency
* Write meaningful commit messages

---

## 📜 License

This project is licensed under the **MIT License**.

---

## 🙌 Acknowledgements

* Open Source Community
* React & Vite Ecosystem
* FastAPI Documentation
* AI/LLM Research Community
* Educational Game Design Resources
* Faculty & Mentors

---

## 🧠 Project Vision

> “Don’t just study history. Live it.”

Reliving History aims to redefine education by combining:

* Artificial Intelligence
* Interactive Storytelling
* Game-Based Learning

This project transforms history into an **experience**, not just information.

---

## 📸 Screenshots

### Entry Screen
<img width="1912" height="917" src="https://github.com/user-attachments/assets/f27f3451-0e3d-46a8-b8f2-e5960d3aad79" />

### Event Selection Screen
<img width="1908" height="1061" src="https://github.com/user-attachments/assets/06593fbe-68e0-44ee-9c6a-a9e779516b6f" />

### Character Selection Screen
<img width="1919" height="1079" src="https://github.com/user-attachments/assets/0aa5bcc3-96cb-4e43-b4e5-96a1265f0228" />

### Gameplay Screen
<img width="1910" height="1070" src="https://github.com/user-attachments/assets/00202364-85d8-4fdf-8e96-39b31eb95f4b" />

---

## 👨‍💻 Contributors

| Name | Role |
|------|------|
| [Ankit Tiwari](https://github.com/ankitkumartiwari-web) | Frontend, Backend |
| [Arya Kurtadikar](https://github.com/AryaUK-004) | Research, Integration |
| [Sam Khair](https://github.com/Samrile) | RAG & LLM Development |
| [Ayush Shinde](https://github.com/AyushShinde2004) | RAG & LLM Optimization |

> Developed as a collaborative final year project.
---

⭐ If you like this project, consider giving it a star!
