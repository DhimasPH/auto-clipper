import React from 'react';
import { Scissors, Clock, Settings, HelpCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useBackendHealth } from '../../hooks/useBackendHealth';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const backendStatus = useBackendHealth();
  const isConnected = backendStatus === 'Connected';
  const currentYear = new Date().getFullYear();

  return (
    <aside className="w-60 h-screen bg-bg-secondary border-r border-border flex flex-col transition-all duration-200 shrink-0">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-brand-gradient bg-clip-text text-transparent">
          Auto Clipper
        </h1>
        <div className="mt-1 flex items-center">
          <span className="text-caption text-text-tertiary bg-bg-surface px-1.5 py-0.5 rounded">v1.2.0</span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        <div className="text-overline text-text-tertiary px-3 mb-2 mt-4">{t('sidebar.menu', 'Menu')}</div>
        
        <NavLink 
          to="/" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-body transition-colors ${
              isActive 
                ? 'bg-accent/10 text-accent font-medium border-l-2 border-accent' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated border-l-2 border-transparent'
            }`
          }
        >
          <Scissors className="w-5 h-5" />
          {t('sidebar.workspace', 'Workspace')}
        </NavLink>
        
        <NavLink 
          to="/history" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-body transition-colors ${
              isActive 
                ? 'bg-accent/10 text-accent font-medium border-l-2 border-accent' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated border-l-2 border-transparent'
            }`
          }
        >
          <Clock className="w-5 h-5" />
          {t('sidebar.history', 'History')}
        </NavLink>
      </nav>

      <div className="p-4 mt-auto border-t border-border space-y-2">
        <NavLink 
          to="/settings" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-body transition-colors ${
              isActive 
                ? 'bg-accent/10 text-accent font-medium border-l-2 border-accent' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated border-l-2 border-transparent'
            }`
          }
        >
          <Settings className="w-5 h-5" />
          {t('sidebar.settings', 'Settings')}
        </NavLink>
        
        <NavLink 
          to="/help" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-body transition-colors ${
              isActive 
                ? 'bg-accent/10 text-accent font-medium border-l-2 border-accent' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated border-l-2 border-transparent'
            }`
          }
        >
          <HelpCircle className="w-5 h-5" />
          {t('sidebar.help', 'Help / FAQ')}
        </NavLink>

        <div className="mt-4 px-3 py-2 flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-success' : 'bg-error'}`}></span>
          </div>
          <span className="text-caption text-text-secondary">
            {backendStatus}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-border/30 flex flex-col items-center gap-1 text-caption text-text-tertiary">
          <span>&copy; {currentYear} Auto Clipper</span>
          <span 
            className="hover:text-text-primary transition-colors cursor-pointer"
            onClick={() => open('https://auto-clipper.dhims.web.id')}
          >
            Official Website
          </span>
        </div>
      </div>
    </aside>
  );
};
