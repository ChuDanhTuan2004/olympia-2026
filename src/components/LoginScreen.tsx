import React, { useState } from 'react';
import { LogIn, LockKeyhole, Sparkles, Trophy, User } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => void;
  error?: string | null;
  isSubmitting: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, error, isSubmitting }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) return;
    onLogin(username.trim(), password);
  };

  return (
    <div className="olympia-login px-4 py-8 text-neutral-100 flex items-center justify-center">
      <div className="olympia-login-card w-full max-w-md border p-7 sm:p-9">
        <div className="mb-7 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-950/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Sân chơi tri thức
          </div>
          <h1 className="olympia-brand-title text-2xl font-black tracking-tight sm:text-3xl">ĐƯỜNG LÊN ĐỈNH OLYMPIA</h1>
          <p className="mt-2 text-sm text-blue-100/70">Thử sức với những vòng thi kiến thức hấp dẫn</p>
        </div>

        <div className="olympia-hero-emblem" aria-hidden="true">
          <Trophy className="relative z-10 h-14 w-14 stroke-[1.35]" />
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-neutral-400">Tên đăng nhập</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-xl border py-3.5 pl-11 pr-4 text-sm font-medium outline-none focus:border-amber-300"
                placeholder="Nhập tên tài khoản"
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-neutral-400">Mật khẩu</label>
            <div className="relative">
              <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border py-3.5 pl-11 pr-4 text-sm font-medium outline-none focus:border-amber-300"
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-900 bg-red-950/60 px-4 py-3 text-sm font-medium text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !username.trim() || !password}
            className="olympia-primary-button flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-black transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" /> {isSubmitting ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Người chơi không thể tự đăng ký. Hãy liên hệ quản trị viên để được cấp tài khoản.
        </p>
      </div>
    </div>
  );
};
