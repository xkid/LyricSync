
import { GoogleGenAI, Type } from "@google/genai";
import { SongData } from "./types.ts";

export async function fetchLyricsWithGemini(videoUrl: string, apiKey: string): Promise<SongData> {
  if (!apiKey) {
    throw new Error("API Key is missing. Please provide a valid Gemini API key.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Analyze the YouTube video URL: ${videoUrl}.
      Identify the song and artist.
      Provide the full lyrics synchronized with timestamps (in seconds).
      For each line, include:
      1. Original text (the language of the song).
      2. English-style pronunciation (Romanization/Pinyin/etc).
      3. A high-quality Chinese translation.
      
      Format the output as valid JSON.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          artist: { type: Type.STRING },
          lyrics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.NUMBER, description: "Start time of the lyric in seconds" },
                text: { type: Type.STRING, description: "Original lyrics" },
                romanization: { type: Type.STRING, description: "Phonetic pronunciation" },
                translation: { type: Type.STRING, description: "Chinese translation" }
              },
              required: ["time", "text", "romanization", "translation"]
            }
          }
        },
        required: ["title", "artist", "lyrics"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Failed to receive lyrics from Gemini");
  
  return JSON.parse(text) as SongData;
}
