import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { CommandPalette } from '../CommandPalette';
import { useState } from 'react';

export function Layout(): JSX.Element {
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-terminal-bg">
      <Header />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto bg-terminal-bg">
          <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 lg:px-6 py-4 pb-8">
            <Outlet />
          </div>
        </main>
      </div>
      <StatusBar />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onOpen={() => setPaletteOpen(true)} />
    </div>
  );
}
