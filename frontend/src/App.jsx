import React from 'react';
import Dashboard from './Dashboard.jsx';
import PublicBusiness from './PublicBusiness.jsx';
import LandingPage from './LandingPage.jsx';
import MarketAssistant from './Assistant.jsx';

function withAssistant(page) {
  return <>{page}<MarketAssistant /></>;
}

export default function App() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'empresa' && parts[1]) return withAssistant(<PublicBusiness slug={decodeURIComponent(parts[1])} />);
  if (parts[0] === 'entrar' || parts[0] === 'login') return withAssistant(<Dashboard initialAuthMode="login" />);
  if (parts[0] === 'cadastro' || parts[0] === 'registrar') return withAssistant(<Dashboard initialAuthMode="register" />);
  if (parts[0] === 'app' || parts[0] === 'painel') return withAssistant(<Dashboard initialAuthMode="login" />);
  return withAssistant(<LandingPage />);
}
