// ─── Página: Login ────────────────────────────────────────────
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Ticket, Eye, EyeOff, LogIn } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'var(--bg-base)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Fondo decorativo */}
      <div style={{
        position: 'absolute', top: '-30%', left: '-20%',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-20%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(96,165,250,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', position: 'relative' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '24px', margin: '0 auto 1rem',
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(124,58,237,0.4)',
        }}>
          <Ticket size={36} color="#fff" />
        </div>
        <h1 style={{
          fontSize: '2rem', fontWeight: 900,
          background: 'linear-gradient(90deg, #f1f5f9, #c084fc)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: '0.25rem',
        }}>
          Rifas Express
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Inicia sesión para continuar
        </p>
      </div>

      {/* Formulario */}
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '2rem',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label htmlFor="login-username">Usuario</label>
            <input
              id="login-username"
              className="form-control"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nombre de usuario"
              autoComplete="username"
              autoFocus
              required
              style={{ fontSize: '1rem' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="form-control"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                style={{ fontSize: '1rem', paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setShowPass((v) => !v)}
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                aria-label="Ver contraseña"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 8, padding: '0.7rem 0.9rem',
              color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              Error: {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            id="login-submit-btn"
            disabled={loading}
            style={{ padding: '0.9rem', fontSize: '1rem', marginTop: '0.25rem' }}
          >
            {loading
              ? <><span className="spinner" style={{ width: 18, height: 18 }} /> Verificando...</>
              : <><LogIn size={18} /> Iniciar Sesión</>
            }
          </button>
        </form>

        {/* Hint de credenciales */}
        <div style={{
          marginTop: '1.25rem', paddingTop: '1.25rem',
          borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: '0.3rem',
        }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '0.3rem' }}>
            Credenciales por defecto:
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: '0.72rem', padding: '0.4rem' }}
              onClick={() => { setUsername('admin'); setPassword('admin123'); }}
              id="hint-admin-btn"
            >
              admin / admin123
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: '0.72rem', padding: '0.4rem' }}
              onClick={() => { setUsername('vendedor'); setPassword('1234'); }}
              id="hint-vendedor-btn"
            >
              vendedor / 1234
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
