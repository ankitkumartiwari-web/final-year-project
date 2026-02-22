const API_URL = "http://localhost:8000";

export const startGame = async (characterId: string, eraId: string) => {
  const response = await fetch(`${API_URL}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      character_id: characterId,
      era_id: eraId,
    }),
  });

  return response.json();
};

export const sendInput = async (text: string) => {
  const response = await fetch(`${API_URL}/input`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_input: text,
    }),
  });

  return response.json();
};

export const getCurrentStep = async () => {
  const response = await fetch(`${API_URL}/step`);
  return response.json();
};