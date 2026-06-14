import { useState } from 'react';
import ChatPanel from './ChatPanel';

export default function Chatbot() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <ChatPanel className="mb-4 w-[360px] sm:w-[420px] h-[560px]" />
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-20 h-20 bg-accent hover:bg-accent/90 text-white rounded-full shadow-xl shadow-accent/30 flex items-center justify-center transition-all active:scale-95"
        aria-label="Ouvrir l'assistant"
      >
        {open ? (
          <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
        ) : (
          <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
        )}
      </button>
    </div>
  );
}
