export interface ParentAdviceRequest {
  userId: string;
  latestMood: string | null;
  flagged: boolean;
  contentLevel: string;
}

export interface ParentAdviceResponse {
  success: boolean;
  advice?: string;
  model?: string;
  error?: string;
}

export async function getParentAdvice(payload: ParentAdviceRequest): Promise<ParentAdviceResponse> {
  try {
    const res = await fetch('/api/ai/parent-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('AI service error response:', errorText);
      return { success: false, error: `Server error: ${res.statusText}` };
    }

    const data: ParentAdviceResponse = await res.json();
    return data;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('AI service network error:', errorMsg);
    return { success: false, error: `Network error: ${errorMsg}` };
  }
}