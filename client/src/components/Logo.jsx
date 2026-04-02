import React from 'react';
import logoImg from '../assets/logo.png';

/**
 * Workforce Status (WMS) Logo Component
 * Definitive 1:1 Match using original PNG asset
 */
const Logo = ({ size = 32, className = '' }) => {
  return (
    <div 
      className={`logo-container ${className}`}
      style={{ 
        width: size, 
        height: size, 
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <img
        src={logoImg}
        alt="WMS Logo"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          // Definitive way to turn dark-on-white PNG to light-on-transparent:
          // 1. Invert colors: Dark Slate -> Light Slate, White -> Black
          // 2. mixBlendMode screen makes Black transparent on dark backgrounds
          filter: 'invert(1) brightness(1.1) contrast(1.1)',
          mixBlendMode: 'screen'
        }}
      />
    </div>
  );
};

export default Logo;
