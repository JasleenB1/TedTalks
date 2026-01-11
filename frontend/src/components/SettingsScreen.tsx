import { useState, useEffect } from 'react';
import { ChevronDown, Shield, Volume2, Brain, Clock, BookOpen } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { apiService } from '../services/api.service'; 
import type { AIPreferences } from '../types';

interface SettingsScreenProps {
  userId: string;
}

export function SettingsScreen({ userId }: SettingsScreenProps) {
  const { data: preferences, loading } = useApi(
    () => apiService.getPreferences(userId),
    [userId]
  );

  const [voiceType, setVoiceType] = useState('friendly-female');
  const [responseStyle, setResponseStyle] = useState('balanced');
  const [contentLevel, setContentLevel] = useState('ages-6-8');
  const [sessionDuration, setSessionDuration] = useState('30');
  const [learningFocus, setLearningFocus] = useState('general');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (preferences) {
      setVoiceType(preferences.voiceType);
      setResponseStyle(preferences.responseStyle);
      setContentLevel(preferences.contentLevel);
      setSessionDuration(preferences.sessionDurationMinutes.toString());
      setLearningFocus(preferences.learningFocus);
    }
  }, [preferences]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    const updatedPreferences: AIPreferences = {
      voiceType,
      responseStyle,
      contentLevel,
      sessionDurationMinutes: parseInt(sessionDuration),
      learningFocus,
    };

    try {
      await apiService.updatePreferences(userId, updatedPreferences);
      setSaveMessage('Preferences saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setSaveMessage('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (preferences) {
      setVoiceType(preferences.voiceType);
      setResponseStyle(preferences.responseStyle);
      setContentLevel(preferences.contentLevel);
      setSessionDuration(preferences.sessionDurationMinutes.toString());
      setLearningFocus(preferences.learningFocus);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px] bg-sand">
        <div className="text-ink/60">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-sand">
      {/* Header */}
      <div className="rounded-2xl p-5 border border-cloud bg-gradient-to-r from-blush via-cream to-cream">
        <h2 className="text-xl mb-1 text-ink">AI Preferences</h2>
        <p className="text-sm text-ink/70">Customize your child&apos;s AI assistant experience</p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={[
            'px-4 py-3 rounded-xl text-sm border',
            saveMessage.toLowerCase().includes('success')
              ? 'bg-mist/25 text-ink border-mist/40'
              : 'bg-rose/10 text-ink border-rose/30',
          ].join(' ')}
        >
          {saveMessage}
        </div>
      )}

      {/* Settings Groups */}
      <div className="space-y-3">
        {/* Voice Type */}
        <div className="bg-offwhite rounded-2xl border border-cloud p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-periwinkle/15 rounded-xl flex items-center justify-center border border-cloud">
              <Volume2 className="w-5 h-5 text-periwinkle" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm text-ink">Voice Type</h3>
              <p className="text-xs text-ink/60">Select AI voice personality</p>
            </div>
          </div>

          <div className="relative">
            <select
              value={voiceType}
              onChange={(e) => setVoiceType(e.target.value)}
              className="w-full appearance-none bg-white border border-cloud rounded-lg px-4 py-3 pr-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-periwinkle/30 focus:border-periwinkle"
            >
              <option className="bg-white text-ink" value="friendly-female">Friendly Female</option>
              <option className="bg-white text-ink" value="friendly-male">Friendly Male</option>
              <option className="bg-white text-ink" value="energetic-female">Energetic Female</option>
              <option className="bg-white text-ink" value="calm-male">Calm Male</option>
              <option className="bg-white text-ink" value="storyteller">Storyteller</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40 pointer-events-none" />
          </div>
        </div>

        {/* Response Style */}
        <div className="bg-offwhite rounded-2xl border border-cloud p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blush rounded-xl flex items-center justify-center border border-sand/60">
              <Brain className="w-5 h-5 text-cocoa" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm text-ink">Response Style</h3>
              <p className="text-xs text-ink/60">How AI communicates</p>
            </div>
          </div>

          <div className="relative">
            <select
              value={responseStyle}
              onChange={(e) => setResponseStyle(e.target.value)}
              className="w-full appearance-none bg-white border border-cloud rounded-lg px-4 py-3 pr-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-periwinkle/30 focus:border-periwinkle"
            >
              <option className="bg-white text-ink" value="detailed">Detailed &amp; Educational</option>
              <option className="bg-white text-ink" value="balanced">Balanced</option>
              <option className="bg-white text-ink" value="concise">Brief &amp; Simple</option>
              <option className="bg-white text-ink" value="encouraging">Encouraging &amp; Positive</option>
              <option className="bg-white text-ink" value="socratic">Question-Based (Socratic)</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40 pointer-events-none" />
          </div>
        </div>

        {/* Content Level */}
        <div className="bg-offwhite rounded-2xl border border-cloud p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-mist/25 rounded-xl flex items-center justify-center border border-mist/40">
              <BookOpen className="w-5 h-5 text-ink/80" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm text-ink">Content Level</h3>
              <p className="text-xs text-ink/60">Age-appropriate content</p>
            </div>
          </div>

          <div className="relative">
            <select
              value={contentLevel}
              onChange={(e) => setContentLevel(e.target.value)}
              className="w-full appearance-none bg-white border border-cloud rounded-lg px-4 py-3 pr-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-periwinkle/30 focus:border-periwinkle"
            >
              <option className="bg-white text-ink" value="ages-4-5">Ages 4-5 (Preschool)</option>
              <option className="bg-white text-ink" value="ages-6-8">Ages 6-8 (Early Elementary)</option>
              <option className="bg-white text-ink" value="ages-9-11">Ages 9-11 (Elementary)</option>
              <option className="bg-white text-ink" value="ages-12-14">Ages 12-14 (Middle School)</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40 pointer-events-none" />
          </div>
        </div>

        {/* Session Duration */}
        <div className="bg-offwhite rounded-2xl border border-cloud p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-honey/25 rounded-xl flex items-center justify-center border border-honey/40">
              <Clock className="w-5 h-5 text-ink/80" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm text-ink">Session Duration</h3>
              <p className="text-xs text-ink/60">Maximum usage time</p>
            </div>
          </div>

          <div className="relative">
            <select
              value={sessionDuration}
              onChange={(e) => setSessionDuration(e.target.value)}
              className="w-full appearance-none bg-white border border-cloud rounded-lg px-4 py-3 pr-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-periwinkle/30 focus:border-periwinkle"
            >
              <option className="bg-white text-ink" value="15">15 minutes</option>
              <option className="bg-white text-ink" value="30">30 minutes</option>
              <option className="bg-white text-ink" value="45">45 minutes</option>
              <option className="bg-white text-ink" value="60">1 hour</option>
              <option className="bg-white text-ink" value="0">Unlimited</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40 pointer-events-none" />
          </div>
        </div>

        {/* Learning Focus */}
        <div className="bg-offwhite rounded-2xl border border-cloud p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-rose/10 rounded-xl flex items-center justify-center border border-rose/25">
              <Shield className="w-5 h-5 text-rose" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm text-ink">Learning Focus</h3>
              <p className="text-xs text-ink/60">Educational priorities</p>
            </div>
          </div>

          <div className="relative">
            <select
              value={learningFocus}
              onChange={(e) => setLearningFocus(e.target.value)}
              className="w-full appearance-none bg-white border border-cloud rounded-lg px-4 py-3 pr-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-periwinkle/30 focus:border-periwinkle"
            >
              <option className="bg-white text-ink" value="general">General Knowledge</option>
              <option className="bg-white text-ink" value="stem">STEM Focus</option>
              <option className="bg-white text-ink" value="language">Language &amp; Reading</option>
              <option className="bg-white text-ink" value="creative">Creative &amp; Arts</option>
              <option className="bg-white text-ink" value="social-emotional">Social-Emotional Learning</option>
              <option className="bg-white text-ink" value="homework">Homework Support</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-rose text-cream py-3 rounded-xl hover:bg-rose/90 transition-colors focus:outline-none focus:ring-2 focus:ring-rose/30 disabled:bg-cloud disabled:text-ink/60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>

        <button onClick={handleReset} className="w-full mt-2 text-sm text-ink/70 hover:text-ink py-2">
          Reset to Defaults
        </button>
      </div>

      {/* Safety Note */}
      <div className="bg-periwinkle/12 border border-periwinkle/30 rounded-xl p-4">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-periwinkle flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm text-ink mb-1">Safety First</h4>
            <p className="text-xs text-ink/70">
              All conversations are monitored for safety. Inappropriate content is automatically filtered and flagged for review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

