import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/sidebar/Sidebar';
import BusyOverlay from '../components/BusyOverlay';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-full bg-bg-primary overflow-hidden">
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto relative">
        <Outlet />
      </main>
      <BusyOverlay />
    </div>
  );
};
