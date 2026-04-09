import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getAIFeedback(artworkTitle: string, description: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an art critic and educator. A student described the artwork "${artworkTitle}" as follows: "${description}". 
      Provide constructive feedback in Korean (max 200 characters) to help the student observe more deeply and express more accurately. 
      Focus on details, colors, emotions, or composition they might have missed or could describe better.`,
    });
    return response.text || "피드백을 생성할 수 없습니다.";
  } catch (error) {
    console.error("AI Feedback Error:", error);
    return "AI 피드백 생성 중 오류가 발생했습니다.";
  }
}

export async function generateImageFromDescription(description: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { text: `Create a high-quality artistic image based on this description: ${description}. The style should be consistent with fine art.` },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image Generation Error:", error);
    return null;
  }
}

export async function extractTextFromImage(base64Data: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: "이 이미지에 있는 손글씨나 텍스트를 정확하게 추출해서 텍스트만 반환해줘. 다른 설명은 하지 마." },
            {
              inlineData: {
                data: base64Data,
                mimeType: "image/jpeg",
              },
            },
          ],
        },
      ],
    });
    return response.text || "";
  } catch (error) {
    console.error("OCR Error:", error);
    return "";
  }
}
