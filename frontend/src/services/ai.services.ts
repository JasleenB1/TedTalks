const AI_BASE_URL = (import.meta.env.VITE_AI_BASE_URL || '').replace(/\/$/, '');

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

export async function getParentAdvice(
  payload: ParentAdviceRequest
): Promise<ParentAdviceResponse> {
  const endpoint = `${AI_BASE_URL}/api/ai/parent-advice`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: errorText || `Server error: ${res.statusText}` };
    }

    return (await res.json()) as ParentAdviceResponse;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Network error: ${errorMsg}` };
  }
}
