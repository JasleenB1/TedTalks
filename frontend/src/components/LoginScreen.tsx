import { useState } from 'react';
import { Lock, Mail } from 'lucide-react';
import { apiService } from '../services/api.service'; 

interface LoginScreenProps {
  onLogin: (token: string, userId: string) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.login({ email, password });

      if (response.success && response.data) {
        onLogin(response.data.token, response.data.userId);
      } else {
        setError(response.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blush/70 via-cream to-cream flex flex-col items-center justify-center px-6 max-w-md mx-auto">
      {/* subtle background tint */}

      <div className="relative w-full flex flex-col items-center justify-center">
        {/* Logo/Icon Area */}
        <div className="mt-12 mb-4 text-center">
          <img
            src="/src/assets/logo.png"
            alt="TedTalk Logo"
            className="w-[360px] max-w-full h-auto mx-auto mb-2 object-contain"
          />
        </div>

        {/* Login Form */}
        <div className="w-full bg-white rounded-2xl shadow-sm border border-cloud p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-rose/10 border border-rose/30 text-ink px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm text-ink/80 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-cream border border-sand/70 rounded-lg text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-periwinkle/30 focus:border-periwinkle disabled:opacity-60"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-ink/80 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-cream border border-sand/70 rounded-lg text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-periwinkle/30 focus:border-periwinkle disabled:opacity-60"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-rose text-cream py-3 rounded-lg hover:bg-rose/90 transition-colors focus:outline-none focus:ring-2 focus:ring-rose/30 disabled:bg-cloud disabled:text-ink/60 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a
              href="#"
              className="text-sm text-periwinkle hover:underline focus:outline-none focus:ring-2 focus:ring-periwinkle/30 rounded"
            >
              Forgot password?
            </a>
          </div>
        </div>

        <p className="mt-6 text-sm text-ink/70 text-center">
          Don&apos;t have an account?{' '}
          <a
            href="#"
            className="text-periwinkle hover:underline focus:outline-none focus:ring-2 focus:ring-periwinkle/30 rounded"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

