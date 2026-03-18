import { useMemo, useState } from 'react';
import { MessageCircle, User, Search, Bot } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { apiService } from '../services/api.service';
import type { ConversationDay, ConversationItem } from '../types';

interface ConversationTimelineScreenProps {
  userId: string;
}

function buildSafeSummary(item: ConversationItem): string {
  if (item.summary?.trim()) {
    const summary = item.summary.trim();
    const lowerSummary = summary.toLowerCase();

    if (
      !lowerSummary.includes(item.content.trim().toLowerCase()) &&
      summary !== item.content.trim()
    ) {
      return summary;
    }
  }

  const typeLabel = item.type ? item.type.toLowerCase() : 'conversation';
  const moodLabel = item.mood ? `Mood was ${item.mood}.` : '';
  const topicLabel = item.topic ? `Child asked about ${item.topic}.` : `Child had a ${typeLabel}.`;
  const keywordLabel =
    item.keywords && item.keywords.length > 0
      ? `Main themes: ${item.keywords.slice(0, 3).join(', ')}.`
      : '';

  const synthesized = [topicLabel, moodLabel, keywordLabel].filter(Boolean).join(' ');

  if (synthesized) {
    return synthesized;
  }

  return 'Child had a conversation. Summary details are limited for privacy.';
}

export function ConversationTimelineScreen({ userId }: ConversationTimelineScreenProps) {
  const [search, setSearch] = useState('');
  const { data: conversations, loading, error } = useApi(
    () => apiService.getConversations(userId, 0, 100),
    [userId],
    5000
  );

  const filteredConversations = useMemo(() => {
    const allDays = conversations || [];
    const query = search.trim().toLowerCase();

    if (!query) {
      return allDays;
    }

    return allDays
      .map((day: ConversationDay) => ({
        ...day,
        items: day.items.filter((item: ConversationItem) => {
          const haystack = [
            item.content,
            item.summary,
            item.aiReply,
            item.topic,
            item.keywords?.join(' '),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(query);
        }),
      }))
      .filter((day) => day.items.length > 0);
  }, [conversations, search]);

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px] bg-sand">
        <div className="text-ink/60">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-sand min-h-[400px]">
        <div className="bg-white border border-rose/30 text-ink rounded-2xl p-5">
          Unable to load conversations. {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-sand">
      <div className="bg-cream rounded-2xl border border-cloud p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transcripts, topics, or keywords..."
            className="w-full pl-10 pr-4 py-2 bg-offwhite border border-cloud rounded-lg text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-periwinkle/30 focus:border-periwinkle"
          />
        </div>
      </div>

      <div className="space-y-6">
        {filteredConversations.length > 0 ? (
          filteredConversations.map((day) => (
            <div key={day.date} className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                <div className="h-px flex-1 bg-cloud" />
                <span className="text-xs text-ink/60">{day.date}</span>
                <div className="h-px flex-1 bg-cloud" />
              </div>

              <div className="space-y-2">
                {day.items.map((item) => (
                  <article
                    key={item.id}
                    className={[
                      'rounded-2xl border p-4 transition-all hover:shadow-sm',
                      item.flagged ? 'bg-cloud border-rose/60' : 'bg-offwhite border-cloud',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-periwinkle/80 to-cocoa/70">
                        <User className="w-5 h-5 text-cream" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-ink/60">{item.timeFormatted}</span>
                            <span className="text-xs bg-white/80 text-ink px-2 py-0.5 rounded-full border border-cloud">
                              {item.type}
                            </span>
                            {item.topic && (
                              <span className="text-xs bg-mist/50 text-ink px-2 py-0.5 rounded-full border border-mist/60">
                                {item.topic}
                              </span>
                            )}
                            {item.flagged && (
                              <span className="text-xs bg-rose/15 text-ink px-2 py-0.5 rounded-full border border-rose/30">
                                Flagged
                              </span>
                            )}
                          </div>
                          <span className="text-base">{item.mood}</span>
                        </div>

                        {item.flagged ? (
                          <>
                            <div className="rounded-xl border border-rose/25 bg-white/80 p-3">
                              <div className="text-xs text-ink/60 mb-1">Raw child message</div>
                              <p className="text-sm text-ink">{item.content}</p>
                            </div>

                            {item.aiReply && (
                              <div className="rounded-xl border border-cloud bg-white/70 p-3">
                                <div className="flex items-center gap-2 mb-1 text-xs text-ink/60">
                                  <Bot className="w-3.5 h-3.5" />
                                  TedTalks reply
                                </div>
                                <p className="text-sm text-ink">{item.aiReply}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="rounded-xl border border-cloud bg-white/70 p-3">
                            <div className="text-xs text-ink/60 mb-1">Conversation summary</div>
                            <p className="text-sm text-ink">{buildSafeSummary(item)}</p>
                          </div>
                        )}

                        {(item.keywords?.length || item.analysisStatus) && (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
                            <MessageCircle className="w-3.5 h-3.5" />
                            {item.analysisStatus && <span>{item.analysisStatus}</span>}
                            {item.keywords?.slice(0, 4).map((keyword) => (
                              <span
                                key={`${item.id}-${keyword}`}
                                className="bg-white px-2 py-1 rounded-full border border-cloud"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-ink/60 py-8">
            No conversations found for this user yet.
          </div>
        )}
      </div>
    </div>
  );
}
