import React from 'react';
import { FileDown, Printer } from 'lucide-react';
import { downloadCSV } from './constants.js';

export default function ExportBar({ rows, filename }) {
  return (
    <div className="admin-export">
      <button className="admin-export-btn" onClick={() => downloadCSV(filename, rows)} title="Download CSV"><FileDown size={14} /> CSV</button>
      <button className="admin-export-btn" onClick={() => window.print()} title="Print / Save as PDF"><Printer size={14} /> PDF</button>
    </div>
  );
}

export { ExportBar };

