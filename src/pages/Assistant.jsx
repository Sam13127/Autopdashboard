import ChatPanel from '../components/ChatPanel';
import Sidebar from '../components/Sidebar';

export default function Assistant() {
  return (
    <div className="min-h-screen bg-bg text-text-primary font-sans flex">
      <Sidebar />

      <main className="ml-64 flex-1 p-8 md:p-10 max-w-4xl flex flex-col">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight mb-1 text-text-primary">Assistant IA</h1>
          <p className="text-text-secondary">Pose une question ou décris une action — ventes, stock, statistiques.</p>
        </div>

        <ChatPanel className="flex-1 min-h-[70vh]" />
      </main>
    </div>
  );
}
