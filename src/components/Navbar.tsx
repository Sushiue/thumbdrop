'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Home, Package, BookOpen, Trophy, LogOut, ArrowLeftRight } from 'lucide-react';

const NAV = [
  { href: '/dashboard',   label: 'Accueil',     icon: Home },
  { href: '/shop',        label: 'Boutique',    icon: Package },
  { href: '/collection',  label: 'Collection',  icon: BookOpen },
  { href: '/trades',      label: 'Échanges',    icon: ArrowLeftRight },
  { href: '/leaderboard', label: 'Classement',  icon: Trophy },
];

export default function Navbar({ username, tubes, crystals }: { username: string; tubes: number; crystals: number }) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <>
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#0d0d14]/90 backdrop-blur border-b border-[#2a2a3a] flex items-center px-4 gap-4">
        <Link href="/dashboard" className="font-black text-lg text-white mr-auto">
          Thumb<span className="text-purple-400">Drop</span>
        </Link>
        {/* Currencies */}
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 bg-[#1e1e2a] border border-[#2a2a3a] rounded-full px-3 py-1 font-semibold text-amber-400">
            🪙 {tubes.toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5 bg-[#1e1e2a] border border-[#2a2a3a] rounded-full px-3 py-1 font-semibold text-cyan-400">
            💎 {crystals}
          </span>
        </div>
        <span className="text-gray-400 text-sm hidden sm:block">{username}</span>
        <button onClick={logout} className="text-gray-500 hover:text-red-400 transition-colors" title="Déconnexion">
          <LogOut size={16} />
        </button>
      </header>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d14]/95 backdrop-blur border-t border-[#2a2a3a] flex sm:hidden">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
            pathname === href ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
          }`}>
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Side nav (desktop) */}
      <nav className="fixed left-0 top-14 bottom-0 z-40 hidden sm:flex flex-col w-52 bg-[#0d0d14] border-r border-[#2a2a3a] p-4 gap-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
            pathname === href
              ? 'bg-purple-600/20 text-purple-300 border border-purple-600/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}>
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
