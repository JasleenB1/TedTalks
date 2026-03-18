import { Clock, Smile, AlertCircle, TrendingUp, MessageCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useApi } from '../hooks/useApi';
import { apiService } from '../services/api.service';
import type { Alert, MoodDataPoint } from '../types';

interface DashboardScreenProps {
  userId: string;
}

export function DashboardScreen({ userId }: DashboardScreenProps) {
  const { data: summary, loading: summaryLoading, error: summaryError } = useApi(
    () => apiService.getDashboardSummary(userId),
    [userId],
    5000
  );

  const { data: moodData, loading: moodLoading } = useApi(
    () => apiService.getMoodTrends(userId, 7),
    [userId],
    5000
  );

  const { data: alerts, loading: alertsLoading } = useApi(
    () => apiService.getAlerts(userId, 0, 10),
    [userId],
    5000
  );

  if (summaryLoading || moodLoading || alertsLoading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px] bg-sand">
        <div className="text-ink/60">Loading dashboard...</div>
      </div>
    );
  }

  if (summaryError) {
    return (
      <div className="p-4 bg-sand min-h-[400px]">
        <div className="bg-white border border-rose/30 text-ink rounded-2xl p-5">
          Unable to load backend data. {summaryError}
        </div>
      </div>
    );
  }

  const safeMoodData = moodData || [];
  const safeAlerts = alerts || [];
  const weeklyAvg =
    safeMoodData.length > 0
      ? (
          safeMoodData.reduce((sum: number, item: MoodDataPoint) => sum + item.mood, 0) /
          safeMoodData.length
        ).toFixed(1)
      : '0.0';

  return (
    <div className="p-4 space-y-4 bg-sand">
      <div className="bg-white rounded-2xl border border-cloud p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink">Today&apos;s Summary</h2>
          <Clock className="w-5 h-5 text-ink/40" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-periwinkle/15 rounded-xl border border-cloud">
            <MessageCircle className="w-6 h-6 text-periwinkle mx-auto mb-1" />
            <div className="text-2xl text-ink">{summary?.conversationCount || 0}</div>
            <div className="text-xs text-ink/70">Conversations</div>
          </div>

          <div className="text-center p-3 bg-mist/25 rounded-xl border border-cloud">
            <Clock className="w-6 h-6 text-ink/70 mx-auto mb-1" />
            <div className="text-2xl text-ink">{summary?.activeTimeMinutes || 0}m</div>
            <div className="text-xs text-ink/70">Active Time</div>
          </div>

          <div className="text-center p-3 bg-blush rounded-xl border border-sand/60">
            <Smile className="w-6 h-6 text-cocoa mx-auto mb-1" />
            <div className="text-2xl text-ink">{summary?.currentMood || 'No mood yet'}</div>
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

      <div className="bg-white rounded-2xl border border-cloud p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink">Mood Trends</h2>
          <TrendingUp className="w-5 h-5 text-mist" />
        </div>

        <div className="h-40 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={safeMoodData}>
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
                stroke="#95a3d1"
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

      <div className="bg-white rounded-2xl border border-cloud p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink">Alerts &amp; Check-ins</h2>
          <AlertCircle className="w-5 h-5 text-honey" />
        </div>

        <div className="space-y-3">
          {safeAlerts.length > 0 ? (
            safeAlerts.map((alert: Alert) => (
              <div
                key={alert.id}
                className="flex gap-3 p-3 bg-cream rounded-xl border border-cloud"
              >
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-honey" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink">{alert.message}</p>
                  <p className="text-xs text-ink/60 mt-0.5">{alert.timeAgo}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-ink/60 py-4 text-sm">No recent alerts</div>
          )}
        </div>
      </div>
    </div>
  );
}
