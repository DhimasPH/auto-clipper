import React from 'react';
import { FolderOutput, FolderOpen, X } from 'lucide-react';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { InputGroup } from '../ui/InputGroup';

interface OutputSectionProps {
  outputFolder: string;
  setOutputFolder: (folder: string) => void;
  quality: "best" | "2160p" | "1440p" | "1080p" | "720p" | "480p";
  setQuality: (q: "best" | "2160p" | "1440p" | "1080p" | "720p" | "480p") => void;
}

export const OutputSection: React.FC<OutputSectionProps> = ({
  outputFolder, setOutputFolder, quality, setQuality
}) => {

  const handleSelectFolder = async () => {
    if (window.electronAPI) {
      const folder = await window.electronAPI.selectFolder();
      if (folder) setOutputFolder(folder);
    } else {
      alert("Fitur pilih folder hanya tersedia di aplikasi Desktop.");
    }
  };

  return (
    <div className="bg-bg-secondary rounded-card border border-border p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent/10 rounded-lg text-accent">
          <FolderOutput className="w-5 h-5" />
        </div>
        <h2 className="text-section-title text-text-primary">Output</h2>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-label text-text-secondary">Folder Penyimpanan</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <InputGroup 
                readOnly
                value={outputFolder || "Default (temp_downloads)"}
                className="pointer-events-none"
              />
            </div>
            <Button variant="outline" icon={FolderOpen} onClick={handleSelectFolder}>
              Pilih Folder
            </Button>
            {outputFolder && (
              <Button variant="ghost" icon={X} onClick={() => setOutputFolder("")} title="Reset" />
            )}
          </div>
        </div>

        <Select
          label="Kualitas Video (Download)"
          value={quality}
          onChange={(e) => setQuality(e.target.value as any)}
          options={[
            { label: 'Best (Otomatis) (Bawaan)', value: 'best' },
            { label: '2160p (4K)', value: '2160p' },
            { label: '1440p (2K)', value: '1440p' },
            { label: '1080p', value: '1080p' },
            { label: '720p', value: '720p' },
            { label: '480p', value: '480p' }
          ]}
        />
      </div>
    </div>
  );
};
