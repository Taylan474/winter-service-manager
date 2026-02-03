import { useState } from 'react';
import '../styles/login.css';
import { supabase } from '../lib/supabase';
import Footer from '../components/Footer'; 


// Login Page - Nur Anmeldung, keine Registrierung (RBAC System)
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Email-Format validieren
  const validateEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

  // Benutzer anmelden
  const handleLogin = async () => {
    setErrorMsg('');
    
    if (!email.trim()) return setErrorMsg('Bitte Email eingeben.');
    if (!validateEmail(email)) return setErrorMsg('Bitte eine gültige Email-Adresse eingeben.');
    if (!password.trim()) return setErrorMsg('Bitte Passwort eingeben.');

    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });
    
    setLoading(false);

    if (error) {
      console.error('❌ Login-Fehler:', error);
      // Benutzerfreundliche Fehlermeldung
      if (error.message.includes('Invalid login credentials')) {
        return setErrorMsg('Ungültige Anmeldedaten. Bitte überprüfe Email und Passwort.');
      }
      return setErrorMsg(error.message);
    }
  };

  // Enter-Taste zum Absenden
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleLogin();
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <svg
              className="login-icon"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <h2>Winterdienst Login</h2>
            <p className="login-subtitle">
              Melde dich an um fortzufahren
            </p>
          </div>

          <form className="login-form" onSubmit={(e) => e.preventDefault()}>
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <div className="input-wrapper">
                <svg
                  className="input-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  id="email"
                  type="email"
                  placeholder="deine@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="password">Passwort</label>
              <div className="input-wrapper">
                <svg
                  className="input-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="error-msg">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {errorMsg}
              </div>
            )}

            <button
              className="login-button"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Logge ein...
                </>
              ) : (
                <>
                  Einloggen
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="login-info">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span>Kontaktiere deinen Administrator für einen Account.</span>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}