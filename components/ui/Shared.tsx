import React from 'react';

export const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon }: any) => {
  const variants: any = {
    primary: 'bg-ui-primary text-white hover:bg-opacity-90',
    secondary: 'bg-white text-ui-primary border border-ui-accent hover:bg-ui-surface',
    outline: 'bg-transparent text-stone-500 border border-ui-accent hover:bg-ui-surface',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  };
  return (
    <button 
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all active:scale-95 ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

export const Card = ({ children, className = '' }: any) => (
  <div className={`bg-white rounded-[32px] border border-ui-accent/30 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);
