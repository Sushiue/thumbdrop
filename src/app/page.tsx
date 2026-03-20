'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const supabase = createClient();
  const router   = useRouter();
  const [mode, setMode]         = useState<'login' | 'register'>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) { setError(error.message); setLoading(false); return; }
      router.push('/dashboard');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      router.push('/dashboard');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
         style={{ background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #0a0a0f 70%)' }}>

      {/* Logo */}
      <div className="text-center mb-10">
        <div className="text-7xl mb-4">🎴</div>
        <h1 className="text-5xl font-black text-white tracking-tight">
          Thumb<span className="text-purple-400">Drop</span>
        </h1>
        <p className="text-gray-400 mt-3 text-lg">Collectionne des miniatures YouTube. Deviens légendaire.</p>
        <div className="flex gap-3 justify-center mt-4 flex-wrap">
          {['⚪ Basique','🟢 Rare','🔵 Super Rare','🟣 Épique','✨ Secret','📺 Chaîne'].map(r => (
            <span key={r} className="text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1 text-gray-300">{r}</span>
          ))}
        </div>
      </div>

      {/* Form card */}
      <div className="w-full max-w-sm bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-8 shadow-2xl">
        {/* Tab switcher */}
        <div className="flex mb-6 bg-[#0a0a0f] rounded-xl p-1">
          {(['login','register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {m === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Pseudo</label>
              <input value={username} onChange={e => setUsername(e.target.value)}
                placeholder="TonPseudo" required minLength={3} maxLength={20}
                className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors" />
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="ton@email.com" required
              className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={6}
              className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors" />
          </div>

          {error && <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-lg px-4 py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-base transition-all shadow-lg shadow-purple-900/30">
            {loading ? '⏳ Chargement...' : mode === 'login' ? '🎮 Jouer' : '🚀 Créer mon compte'}
          </button>
        </form>
      </div>

      <p className="text-gray-600 text-xs mt-8">Aucune carte bancaire • 100% gratuit</p>
    </div>
  );
}
