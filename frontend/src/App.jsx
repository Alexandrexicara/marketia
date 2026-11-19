import React from 'react';
import Dashboard from './Dashboard.jsx';
import PublicBusiness from './PublicBusiness.jsx';

export default function App() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[0] === 'empresa' && parts[1] ? <PublicBusiness slug={decodeURIComponent(parts[1])} /> : <Dashboard />;
}
