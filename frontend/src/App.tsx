import { useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { ConversationTimelineScreen } from './components/ConversationTimelineScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { Home, MessageSquare, Brain, LogOut } from 'lucide-react';
import { apiService } from './services/api.service';

type Screen = 'login' | 'dashboard' | 'timeline' | 'advisor';

export default function App() {
  const savedUserId = apiService.getUserId() || '';
  const savedToken = apiService.getToken();

  const [currentScreen, setCurrentScreen] = useState<Screen>(
    savedUserId ? 'dashboard' : 'login'
  );
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(savedUserId || savedToken));
  const [userId, setUserId] = useState<string>(savedUserId);

  const handleLogin = (token: string, uid: string) => {
    apiService.setToken(token);
    apiService.setUserId(uid);
    setUserId(uid);
    setIsLoggedIn(true);
    setCurrentScreen('dashboard');
  };

  const handleLogout = async () => {
    await apiService.logout();
    setIsLoggedIn(false);
    setUserId('');
    setCurrentScreen('login');
  };

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-gray-900">TedTalks</h1>
          <p className="text-xs text-gray-500">{userId}</p>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          type="button"
        >
          <LogOut className="w-5 h-5 text-gray-600" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {currentScreen === 'dashboard' && <DashboardScreen userId={userId} />}
        {currentScreen === 'timeline' && <ConversationTimelineScreen userId={userId} />}
        {currentScreen === 'advisor' && <SettingsScreen userId={userId} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setCurrentScreen('dashboard')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              currentScreen === 'dashboard'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
            type="button"
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">Dashboard</span>
          </button>
          <button
            onClick={() => setCurrentScreen('timeline')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              currentScreen === 'timeline'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
            type="button"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs">Timeline</span>
          </button>
          <button
            onClick={() => setCurrentScreen('advisor')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              currentScreen === 'advisor'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
            type="button"
          >
            <Brain className="w-5 h-5" />
            <span className="text-xs">Advisor</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
