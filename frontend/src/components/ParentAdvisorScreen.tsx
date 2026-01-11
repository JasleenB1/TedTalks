import { useState, useEffect, useRef } from 'react';
import { Send, Lightbulb, Heart } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import fastAPIService from '../services/fastapi.service';

interface ParentAdvisorScreenProps {
  userId: string;
}

interface Message {
  id: number;
  type: 'user' | 'advisor';
  content: string;
  timestamp: Date;
}

export function ParentAdvisorScreen({ userId }: ParentAdvisorScreenProps) {
  const { data: preferences } = useApi(
    () => fastAPIService.getPreferences(),
    [userId]
  );

  const { data: dashboard } = useApi(
    () => fastAPIService.getDashboardSummary(),
    [userId]
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with greeting message
  useEffect(() => {
    if (preferences && dashboard) {
      setLoading(false);
      const greeting = generateGreeting(preferences.contentLevel, dashboard.currentMood);
      setMessages([
        {
          id: 1,
          type: 'advisor',
          content: greeting,
          timestamp: new Date(),
        },
      ]);
    }
  }, [preferences, dashboard]);

  const generateGreeting = (contentLevel: string, mood: string): string => {
    const ageGroup: Record<string, string> = {
      'ages-4-5': 'preschooler',
      'ages-6-8': '6-8 year old',
      'ages-9-11': '9-11 year old',
      'ages-12-14': 'early teen',
    };

    const moodInsight: Record<string, string> = {
      happy: 'doing wonderfully',
      excited: 'full of energy',
      neutral: 'doing okay',
      sad: 'having a tough time',
      frustrated: 'feeling frustrated',
    };

    const age = ageGroup[contentLevel] || 'child';
    const moodDesc = moodInsight[mood.toLowerCase()] || 'doing well';

    return `Hello! I'm here to provide personalized parenting advice for your ${age}, who seems to be ${moodDesc} right now. Feel free to ask me any questions about learning strategies, emotional development, screen time management, or any parenting challenges you're facing. What's on your mind today?`;
  };

  const generateAdvice = (_userMessage: string, contentLevel: string, mood: string): string => {
    const adviceBase: Record<string, string[]> = {
      'ages-4-5': [
        'At this age, short 10-15 minute sessions work best. Preschoolers have limited attention spans, so frequent short breaks are key.',
        'Use positive reinforcement with stickers or praise. Preschoolers respond well to immediate rewards.',
        'Mix learning with play. Everything is a game for this age group.',
        'Keep things simple and concrete. Avoid abstract concepts.',
      ],
      'ages-6-8': [
        'Early elementary kids love structure and clear expectations. Set consistent learning times.',
        'Combine screen time with hands-on activities to reinforce learning.',
        'Celebrate small wins. This age is developing confidence and intrinsic motivation.',
        'Encourage curiosity through questions rather than just answers.',
      ],
      'ages-9-11': [
        'This age can handle deeper concepts and longer sessions (30-45 minutes).',
        'Encourage independent exploration and critical thinking.',
        'Balance challenging content with confidence-building activities.',
        'Help them connect learning to real-world applications.',
      ],
      'ages-12-14': [
        'Early teens can engage with complex topics and self-directed learning.',
        'Support their growing independence while maintaining appropriate boundaries.',
        'Help them develop digital literacy and healthy online habits.',
        'Connect learning to their interests and future goals.',
      ],
    };

    const moodAdjustment: Record<string, string> = {
      happy: 'Your child seems in great spirits - this is a perfect time for learning!',
      excited: "Great energy today! Channel it into engaging activities.",
      neutral: 'Your child is in a balanced state. Good time for balanced learning.',
      sad: 'Your child might need some extra emotional support. Consider lighter, confidence-building activities.',
      frustrated: 'Your child is frustrated. Try shorter sessions and more breaks today.',
    };

    const advicePool = adviceBase[contentLevel] || adviceBase['ages-6-8'];
    const randomAdvice = advicePool[Math.floor(Math.random() * advicePool.length)];
    const moodNote = moodAdjustment[mood.toLowerCase()] || 'Keep monitoring your child\'s emotional state.';

    return `${randomAdvice}\n\n💡 Current mood insight: ${moodNote}`;
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !preferences || !dashboard) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);

    // Add user message
    const userMsg: Message = {
      id: messages.length + 1,
      type: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Generate advisor response based on content level and mood
    const advisorResponse = generateAdvice(
      userMessage,
      preferences.contentLevel,
      dashboard.currentMood
    );

    const advisorMsg: Message = {
      id: messages.length + 2,
      type: 'advisor',
      content: advisorResponse,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, advisorMsg]);
    setSending(false);
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px] bg-sand">
        <div className="text-ink/60">Loading advisor...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-sand">
      {/* Header */}
      <div className="rounded-2xl m-4 mb-2 p-5 border border-cloud bg-gradient-to-r from-blush via-cream to-cream">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-periwinkle/15 rounded-xl flex items-center justify-center border border-cloud">
            <Lightbulb className="w-5 h-5 text-periwinkle" />
          </div>
          <h2 className="text-xl text-ink">Parent Advisor</h2>
        </div>
        {dashboard && (
          <div className="flex items-center gap-2 ml-13 text-sm text-ink/70">
            <Heart className="w-4 h-4 text-rose" />
            <span>Current mood: {dashboard.currentMood}</span>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-4 py-3 rounded-2xl ${
                msg.type === 'user'
                  ? 'bg-rose text-cream rounded-br-none'
                  : 'bg-offwhite border border-cloud text-ink rounded-bl-none'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <span className="text-xs opacity-60 mt-2 block">
                {msg.timestamp.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-offwhite border border-cloud text-ink rounded-2xl rounded-bl-none px-4 py-3">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-ink/40 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-ink/40 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-ink/40 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-cloud bg-offwhite px-4 py-4 mb-20">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask for parenting advice..."
            disabled={sending}
            className="flex-1 px-4 py-3 bg-white border border-cloud rounded-xl text-sm text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-periwinkle/30 focus:border-periwinkle disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !input.trim()}
            className="bg-rose text-cream px-4 py-3 rounded-xl hover:bg-rose/90 transition-colors disabled:bg-cloud disabled:text-ink/60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
