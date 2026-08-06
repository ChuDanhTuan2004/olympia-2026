import React, { useState } from 'react';
import { AccountSummary } from '../types';
import { KeyRound, Plus, Trash2, UserCog, X } from 'lucide-react';

interface AccountManagerModalProps {
  accounts: AccountSummary[];
  isOpen: boolean;
  onClose: () => void;
  onCreate: (username: string, password: string) => void;
  onDelete: (username: string) => void;
  message?: string | null;
}

export const AccountManagerModal: React.FC<AccountManagerModalProps> = ({
  accounts,
  isOpen,
  onClose,
  onCreate,
  onDelete,
  message,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || password.length < 4) return;
    onCreate(username.trim(), password);
    setUsername('');
    setPassword('');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="olympia-light-modal max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-neutral-500">
              <UserCog className="h-4 w-4" /> Quản trị hệ thống
            </div>
            <h2 className="mt-1 text-2xl font-black">QUẢN LÝ TÀI KHOẢN</h2>
          </div>
          <button onClick={onClose} className="rounded-xl border border-neutral-200 p-2 hover:bg-neutral-100" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mb-7 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Plus className="h-4 w-4" /> TẠO TÀI KHOẢN NGƯỜI CHƠI
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Tên đăng nhập"
              className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-black"
            />
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mật khẩu (ít nhất 4 ký tự)"
                className="w-full rounded-2xl border border-neutral-300 bg-white py-3 pl-11 pr-4 text-sm font-medium outline-none focus:border-black"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!username.trim() || password.length < 4}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-black text-white hover:bg-neutral-800 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> TẠO TÀI KHOẢN
          </button>
          {message && <p className="mt-3 text-center text-xs font-semibold text-neutral-600">{message}</p>}
        </form>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black">DANH SÁCH TÀI KHOẢN</h3>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">{accounts.length} tài khoản</span>
          </div>
          <div className="space-y-2">
            {accounts.map((account) => (
              <div key={account.username} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3">
                <div>
                  <div className="text-sm font-black">{account.username}</div>
                  <div className="text-xs text-neutral-500">{account.role === 'admin' ? 'Quản trị viên' : 'Người chơi'}</div>
                </div>
                {account.role === 'player' && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Xóa tài khoản ${account.username}?`)) onDelete(account.username);
                    }}
                    className="rounded-xl border border-red-200 p-2 text-red-700 hover:bg-red-50"
                    aria-label={`Xóa ${account.username}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
