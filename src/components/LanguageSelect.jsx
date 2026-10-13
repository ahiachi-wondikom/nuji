import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { languages } from '../utils/constants.js';

export default function LanguageSelect({ language, setLanguage }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="selector-wrap">
      <button className="select-button" onClick={() => setOpen(!open)}>
        {language.name}
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="select-menu">
          {languages.map((l) => (
            <button
              key={l.name}
              onClick={() => {
                setLanguage(l);
                setOpen(false);
              }}
            >
              <span className={`dot ${l.color}`} />
              {l.name}
              {l.name === language.name && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { LanguageSelect };

