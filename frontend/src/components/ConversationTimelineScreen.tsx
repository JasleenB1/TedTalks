import { MessageCircle, User, Search } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { mockService } from '../services/mock.service';
// import { apiService } from '../services/api.service'; // Use this when Java backend is ready

export function ConversationTimelineScreen() {
  const { data: conversations, loading } = useApi(
    () => mockService.getConversations(),
    // () => apiService.getConversations(0, 20),
    []
  );

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px] bg-sand">
        <div className="text-ink/60">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-sand">
      {/* Search Bar */}
      <div className="bg-cream rounded-2xl border border-cloud p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 bg-offwhite border border-cloud rounded-lg text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-periwinkle/30 focus:border-periwinkle"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {conversations && conversations.length > 0 ? (
          conversations.map((day) => (
            <div key={day.date} className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                <div className="h-px flex-1 bg-cloud" />
                <span className="text-xs text-ink/60">{day.date}</span>
                <div className="h-px flex-1 bg-cloud" />
              </div>

              <div className="space-y-2">
                {day.items.map((item) => (
                  <div
                    key={item.id}
                    className={[
                      'rounded-2xl border p-4 transition-all hover:shadow-sm',
                      item.flagged
                        ? 'bg-cloud border-rose/60'
                        : 'bg-offwhite border-cloud',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-periwinkle/80 to-cocoa/70">
                        <User className="w-5 h-5 text-cream" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-ink/60">
                              {item.timeFormatted}
                            </span>

                            {item.flagged && (
                              <span className="text-xs bg-mist/60 text-ink px-2 py-0.5 rounded-full border border-mist/70">
                                Flagged
                              </span>
                            )}
                          </div>
                          <span className="text-lg">{item.mood}</span>
                        </div>

                        <p className="text-sm text-ink mb-2">
                          {item.content}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-ink/60">
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span className="capitalize">
                            {item.type.toLowerCase()}
                          </span>
                        </div>
                      </div>

                      {/* Action */}
                      <button
                        className="text-ink/40 hover:text-ink/70 transition-colors focus:outline-none focus:ring-2 focus:ring-periwinkle/30 rounded-md"
                        aria-label="More actions"
                        type="button"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-ink/60 py-8">
            No conversations found
          </div>
        )}
      </div>

      {/* Load More */}
      {conversations && conversations.length > 0 && (
        <button className="w-full py-3 text-sm text-offwhite hover:underline rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-periwinkle/30">
          Load more conversations
        </button>
      )}
    </div>
  );
}

