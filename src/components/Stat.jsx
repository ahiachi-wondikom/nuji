import React from 'react';

export default function Stat({ number, label, accent }) {
  return (
    <div className={`stat ${accent}`}>
      <strong>{number}</strong>
      <span>{label}</span>
      <i />
    </div>
  );
}

export { Stat };

