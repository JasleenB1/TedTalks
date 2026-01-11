import { useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { ConversationTimelineScreen } from './components/ConversationTimelineScreen';
import { ParentAdvisorScreen } from './components/ParentAdvisorScreen';
import { Home, MessageSquare, Lightbulb, LogOut } from 'lucide-react';
import fastAPIService from './services/fastapi.service';

type Screen = 'login' | 'dashboard' | 'timeline' | 'advisor';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string>('');

  const handleLogin = (token: string, uid: string) => {
    fastAPIService.setToken(token);
    setUserId(uid);
    setIsLoggedIn(true);
    setCurrentScreen('dashboard');
  };

  const handleLogout = async () => {
    await fastAPIService.logout();
    setIsLoggedIn(false);
    setUserId('');
    setCurrentScreen('login');
  };

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="bg-offwhite border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <h1 className="font-semibold text-gray-900">TedTalks AI Assistant</h1>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <LogOut className="w-5 h-5 text-gray-600" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {currentScreen === 'dashboard' && <DashboardScreen />}
        {currentScreen === 'timeline' && <ConversationTimelineScreen />}
        {currentScreen === 'advisor' && <ParentAdvisorScreen userId={userId} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-offwhite border-t border-gray-200 px-4 py-3">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setCurrentScreen('dashboard')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              currentScreen === 'dashboard'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
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
          >
            <Lightbulb className="w-5 h-5" />
            <span className="text-xs">Advisor</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
