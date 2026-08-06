import React, { useState } from 'react';
import { LogIn, LockKeyhole, User } from 'lucide-react';

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
    <div className="min-h-screen bg-[#09090b] px-4 py-10 text-neutral-100 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-7 sm:p-9 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-700 bg-neutral-900">
            <LockKeyhole className="h-6 w-6 stroke-[1.6]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">ĐƯỜNG LÊN ĐỈNH OLYMPIA</h1>
          <p className="mt-2 text-sm text-neutral-400">Đăng nhập bằng tài khoản được quản trị viên cấp.</p>
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
                className="w-full rounded-2xl border border-neutral-700 bg-neutral-900 py-3.5 pl-11 pr-4 text-sm font-medium outline-none focus:border-white"
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
                className="w-full rounded-2xl border border-neutral-700 bg-neutral-900 py-3.5 pl-11 pr-4 text-sm font-medium outline-none focus:border-white"
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
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-black text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
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
