import { Clock, Smile, AlertCircle, TrendingUp, MessageCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useApi } from '../hooks/useApi';
import fastAPIService from '../services/fastapi.service'; 

export function DashboardScreen() {
  // Fetch data from backend using custom hook
  const { data: summary, loading: summaryLoading } = useApi(
    () => fastAPIService.getDashboardSummary(),
    []
  );

  const { data: alerts, loading: alertsLoading } = useApi(
    () => fastAPIService.getAlerts(),
    []
  );

  if (summaryLoading || alertsLoading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px] bg-sand">
        <div className="text-ink/60">Loading dashboard...</div>
      </div>
    );
  }

  // Mock mood data for trends (7 days)
  const moodData = [
    { day: 'Mon', mood: 3 },
    { day: 'Tue', mood: 3.5 },
    { day: 'Wed', mood: 4 },
    { day: 'Thu', mood: 3.8 },
    { day: 'Fri', mood: 4.2 },
    { day: 'Sat', mood: 4.5 },
    { day: 'Sun', mood: 4 },
  ];

  // Weekly average mood (0-5 scale assumed)
  const weeklyAvg =
    moodData && moodData.length > 0
      ? (moodData.reduce((sum: number, item: any) => sum + item.mood, 0) / moodData.length).toFixed(1)
      : '0.0';

  return (
    <div className="p-4 space-y-4 bg-sand">
      {/* Summary Block */}
      <div className="bg-white rounded-2xl border border-cloud p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semi
          bold text-ink">Today&apos;s Summary</h2>
          <Clock className="w-5 h-5 text-ink/40" />
        </div>
      
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-periwinkle/15 rounded-xl border border-cloud">
            <MessageCircle className="w-6 h-6 text-periwinkle mx-auto mb-1" />
            <div className="text-2xl text-ink font-semibold">{summary?.conversationCount || 0}</div>
            <div className="text-xs text-ink/70">Conversations</div>
          </div>

          <div className="text-center p-3 bg-mist/25 rounded-xl border border-cloud">
            <Clock className="w-6 h-6 text-ink/70 mx-auto mb-1" />
            <div className="text-2xl text-ink font-semibold">{summary?.activeTimeMinutes || 0}m</div>
            <div className="text-xs text-ink/70">Active Time</div>
          </div>

          <div className="text-center p-3 bg-blush rounded-xl border border-sand/60">
            <Smile className="w-6 h-6 text-cocoa mx-auto mb-1" />
            <div className="text-2xl text-ink font-semibold">{summary?.currentMood || '😊'}</div>
            <div className="text-xs text-ink/70">Mood</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-cloud">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink/70">Last active</span>
            <span className="text-ink">
              {summary?.lastActiveTimestamp
                ? new Date(summary.lastActiveTimestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Mood Trends Block */}
      <div className="bg-white rounded-2xl border border-cloud p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink">Mood Trends</h2>
          <TrendingUp className="w-5 h-5 text-mist" />
        </div>

        <div className="h-40 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={moodData || []}>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#3a3c4c', opacity: 0.55 }}
              />
              <YAxis hide domain={[0, 5]} />
              <Line
                type="monotone"
                dataKey="mood"
                stroke="#95a3d1" // periwinkle
                strokeWidth={2}
                dot={{ fill: '#95a3d1', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-cloud">
          <div className="text-xs text-ink/70">Weekly Average</div>
          <div className="flex items-center gap-1">
            <Smile className="w-4 h-4 text-cocoa" />
            <span className="text-sm text-ink">{weeklyAvg}/5</span>
          </div>
        </div>
      </div>

      {/* Alerts & Check-ins Block */}
      <div className="bg-white rounded-2xl border border-cloud p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink">Alerts &amp; Check-ins</h2>
          <AlertCircle className="w-5 h-5 text-honey" />
        </div>

        <div className="space-y-3">
          {alerts && alerts.length > 0 ? (
            alerts.map((alert: any) => (
              <div
                key={alert._id || alert.id}
                className="flex gap-3 p-3 bg-cream rounded-xl border border-cloud"
              >
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    alert.severity === 'low'
                      ? 'bg-periwinkle'
                      : alert.severity === 'medium'
                      ? 'bg-honey'
                      : 'bg-rose'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink">{alert.message}</p>
                  <p className="text-xs text-ink/60 mt-0.5">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-ink/60 py-4 text-sm">No recent alerts</div>
          )}
        </div>

        <button
          className="w-full mt-3 py-2 text-sm text-periwinkle hover:bg-periwinkle/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-periwinkle/30"
        >
          View all alerts
        </button>
      </div>
    </div>
  );
}

