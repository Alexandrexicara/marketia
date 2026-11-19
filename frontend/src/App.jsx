import React from 'react';
import Dashboard from './Dashboard.jsx';
import PublicBusiness from './PublicBusiness.jsx';
import LandingPage from './LandingPage.jsx';

export default function App() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'empresa' && parts[1]) return <PublicBusiness slug={decodeURIComponent(parts[1])} />;
  if (parts[0] === 'entrar' || parts[0] === 'login') return <Dashboard initialAuthMode="login" />;
  if (parts[0] === 'cadastro' || parts[0] === 'registrar') return <Dashboard initialAuthMode="register" />;
  if (parts[0] === 'app' || parts[0] === 'painel') return <Dashboard initialAuthMode="login" />;
  return <LandingPage />;
}
