import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-gray-200 rounded-2xl shadow-xl p-8 relative overflow-hidden">
        {/* Decorative blur */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent/10 rounded-full blur-3xl"></div>

        <div className="relative z-10">
          <div className="text-center mb-10">
            <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-accent/20 mx-auto mb-4">
              A
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Auto'P</h1>
            <p className="text-text-secondary">Connectez-vous à votre espace sécurisé</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-danger px-4 py-3 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Email professionnel</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-bg border border-gray-200 rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                placeholder="contact@autop.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Mot de passe</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-bg border border-gray-200 rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-accent hover:bg-accent/90 text-white font-medium rounded-xl shadow-lg shadow-accent/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
