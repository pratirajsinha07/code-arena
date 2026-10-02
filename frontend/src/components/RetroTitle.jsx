import React from 'react';

function RetroTitle({ size = 'large' }) {
  const isLarge = size === 'large';
  
  const textShadowLarge = `
    -2px -2px 0 #000,  
     2px -2px 0 #000,
    -2px  2px 0 #000,
     2px  2px 0 #000,
     4px  4px 0 #374151,
     6px  6px 0 #1f2937,
     8px  8px 0 #111827
  `;

  // Scale down the shadow for the compact version
  const textShadowCompact = `
    -1px -1px 0 #000,  
     1px -1px 0 #000,
    -1px  1px 0 #000,
     1px  1px 0 #000,
     2px  2px 0 #374151,
     3px  3px 0 #1f2937,
     4px  4px 0 #111827
  `;

  return (
    <div style={{
      fontFamily: "'Press Start 2P', monospace",
      textTransform: 'uppercase',
      letterSpacing: isLarge ? '0.25em' : '0.15em',
      color: '#e5e7eb',
      textShadow: isLarge ? textShadowLarge : textShadowCompact,
      fontSize: isLarge ? '2rem' : '1rem',
      textAlign: 'center',
      margin: 0,
      padding: isLarge ? '1rem 0' : '0'
    }}>
      CODE ARENA
    </div>
  );
}

export default RetroTitle;
