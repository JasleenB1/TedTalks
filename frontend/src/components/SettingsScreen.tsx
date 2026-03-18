import { useState, useEffect } from 'react';
import { ChevronDown, Shield, BookOpen } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { apiService } from '../services/api.service';
import { getParentAdvice } from '../services/ai.services';
import type { ConversationDay } from '../types';

interface SettingsScreenProps {
  userId: string;
}

function findLatestMood(
  conversations: ConversationDay[] | null
): { mood: string | null; flagged: boolean } {
  if (!conversations || conversations.length === 0) {
    return { mood: null, flagged: false };
  }

  let latest: { ts: number; mood: string | null; flagged: boolean } | null = null;

  for (const day of conversations) {
    for (const item of day.items || []) {
      const ts = new Date(item.timestamp).getTime();
      if (!latest || ts > latest.ts) {
        latest = { ts, mood: item.mood || null, flagged: !!item.flagged };
      }
    }
  }

  return { mood: latest?.mood ?? null, flagged: latest?.flagged ?? false };
}

function generateAdvice(mood: string | null, flagged: boolean, contentLevel: string) {
  const levelTone =
    contentLevel === 'ages-4-5'
      ? 'Use very simple, playful suggestions like games or short stories.'
      : contentLevel === 'ages-6-8'
        ? 'Offer friendly, concrete activities like short reading, drawing, or simple questions.'
        : contentLevel === 'ages-9-11'
          ? 'Suggest hands-on or discussion prompts like projects and open questions.'
          : 'Use more mature suggestions like collaborative problem solving and reflective questions.';

  if (flagged) {
    return `A recent conversation was flagged for review. Check in calmly, acknowledge your child's feelings, and review the conversation together if needed. ${levelTone}`;
  }

  if (!mood) {
    return `I don't have recent mood data yet. Try refreshing after new conversations are analyzed. ${levelTone}`;
  }

  const loweredMood = mood.toLowerCase();

  if (loweredMood.includes('sad') || mood.includes('😔') || mood.includes('😢')) {
    return `Your child seems a bit down. Try validating their feelings, offering a comforting activity, and asking an open question like "Want to tell me more about your day?" ${levelTone}`;
  }

  if (
    loweredMood.includes('happy') ||
    mood.includes('😊') ||
    mood.includes('😄') ||
    mood.includes('🤩')
  ) {
    return `Your child seems to be feeling good. Reinforce that by asking what made the day feel positive and building on it with a small activity together. ${levelTone}`;
  }

  return `A gentle check-in works well here: notice the feeling, name it, and offer a short activity together. ${levelTone}`;
}

export function SettingsScreen({ userId }: SettingsScreenProps) {
  const { data: preferences, loading: prefsLoading } = useApi(
    () => apiService.getPreferences(userId),
    [userId],
    10000
  );

  const { data: conversations, loading: convLoading, refetch: refetchConvos } = useApi(
    () => apiService.getConversations(userId, 0, 50),
    [userId],
    5000
  );

  const [contentLevel, setContentLevel] = useState('ages-6-8');
  const [advice, setAdvice] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (preferences) {
      setContentLevel(preferences.contentLevel || 'ages-6-8');
    }
  }, [preferences]);

  const handleGetAdvice = async () => {
    setGenerating(true);
    setAdvice(null);

    try {
      const conversationResponse = await apiService.getConversations(userId, 0, 50);
      const latest = findLatestMood(conversationResponse.data ?? conversations ?? null);

      try {
        const aiRes = await getParentAdvice({
          userId,
          latestMood: latest.mood,
          flagged: latest.flagged,
          contentLevel,
        });

        if (aiRes.success && aiRes.advice) {
          setAdvice(aiRes.advice);
          await refetchConvos();
          return;
        }
      } catch {
        // fall through to local advice generation
      }

      setAdvice(generateAdvice(latest.mood, latest.flagged, contentLevel));
      await refetchConvos();
    } catch {
      setAdvice('Failed to compute advice. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    if (preferences) {
      setContentLevel(preferences.contentLevel || 'ages-6-8');
    }
    setAdvice(null);
  };

  const loading = prefsLoading || convLoading;
  const latest = findLatestMood(conversations ?? null);

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[300px] bg-sand">
        <div className="text-ink/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-sand">
      <div className="rounded-2xl p-5 border border-cloud bg-gradient-to-r from-blush via-cream to-cream">
        <h2 className="text-xl text-ink">Parent Chatbot</h2>
        <p className="text-sm text-ink/70">
          Get quick, age-appropriate advice based on your child&apos;s latest mood.
        </p>
      </div>

      <div className="bg-offwhite rounded-2xl border border-cloud p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-mist/25 rounded-xl flex items-center justify-center border border-mist/40">
            <BookOpen className="w-5 h-5 text-ink/80" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm text-ink">Content Level</h3>
            <p className="text-xs text-ink/60">
              Choose the child&apos;s content level to tailor advice.
            </p>
          </div>
        </div>

        <div className="relative">
          <select
            value={contentLevel}
            onChange={(e) => setContentLevel(e.target.value)}
            className="w-full appearance-none bg-white border border-cloud rounded-lg px-4 py-3 pr-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-periwinkle/30 focus:border-periwinkle"
          >
            <option value="ages-4-5">Ages 4-5 (Preschool)</option>
            <option value="ages-6-8">Ages 6-8 (Early Elementary)</option>
            <option value="ages-9-11">Ages 9-11 (Elementary)</option>
            <option value="ages-12-14">Ages 12-14 (Middle School)</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40 pointer-events-none" />
        </div>
      </div>

      <div className="bg-offwhite rounded-2xl border border-cloud p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm text-ink">Latest Mood</h3>
            <p className="text-xs text-ink/60">
              Most recent detected mood from backend conversation data.
            </p>
          </div>
          <div className="text-sm text-ink/80">{latest.mood ?? '—'}</div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleGetAdvice}
            disabled={generating}
            className="w-full bg-rose text-cream py-3 rounded-xl hover:bg-rose/90 transition-colors focus:outline-none focus:ring-2 focus:ring-rose/30 disabled:bg-cloud disabled:text-ink/60 disabled:cursor-not-allowed"
            type="button"
          >
            {generating ? 'Thinking...' : 'Get Advice'}
          </button>

          <button
            onClick={handleReset}
            className="w-full mt-2 text-sm text-ink/70 hover:text-ink py-2"
            type="button"
          >
            Reset
          </button>
        </div>

        {advice && (
          <div className="mt-4 px-4 py-3 rounded-xl text-sm border bg-mist/25 text-ink border-mist/40">
            {advice}
          </div>
        )}
      </div>

      <div className="bg-periwinkle/12 border border-periwinkle/30 rounded-xl p-4">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-periwinkle flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm text-ink">Safety First</h4>
            <p className="text-xs text-ink/70">
              Advice is automated guidance only. For safety concerns, review flagged conversations directly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
