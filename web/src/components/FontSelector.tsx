import React from 'react';

const FONTS = [
  { id: '', label: 'Preset Default (Ikut Style)', family: 'inherit' },
  { id: 'Impact', label: 'Impact', family: 'Impact, sans-serif' },
  { id: 'Arial', label: 'Arial', family: 'Arial, sans-serif' },
  { id: 'Montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif" },
  { id: 'Bebas Neue', label: 'Bebas Neue', family: "'Bebas Neue', sans-serif" },
  { id: 'Poppins', label: 'Poppins', family: "'Poppins', sans-serif" },
  { id: 'Oswald', label: 'Oswald', family: "'Oswald', sans-serif" },
  { id: 'Anton', label: 'Anton', family: "'Anton', sans-serif" },
  { id: 'Permanent Marker', label: 'Permanent Marker', family: "'Permanent Marker', cursive" },
];

interface FontSelectorProps {
  value: string;
  onChange: (font: string) => void;
}

export const FontSelector: React.FC<FontSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col space-y-2 mt-4">
      <label className="text-sm font-medium text-neutral-300">Custom Font (Override)</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm rounded-lg p-2.5 focus:outline-none focus:border-blue-500 hover:border-neutral-600 transition-colors cursor-pointer"
        style={{ fontFamily: FONTS.find(f => f.id === value)?.family || 'inherit' }}
      >
        {FONTS.map(font => (
          <option 
            key={font.label} 
            value={font.id} 
            style={{ fontFamily: font.family }}
          >
            {font.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-neutral-500">
        Pilih font kustom untuk menimpa font bawaan dari preset style di atas.
      </p>
    </div>
  );
};
