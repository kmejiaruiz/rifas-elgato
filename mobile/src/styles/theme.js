// ============================================================
// theme.js — Sistema de diseño y tokens de estilo para Móvil
// Recrea el diseño Glassmorphic y de luces de neón en React Native
// ============================================================

export const COLORS = {
  bgBase: '#0b0f19',        // Fondo principal oscuro profundo
  bgCard: 'rgba(17, 24, 39, 0.7)', // Tarjeta translúcida (glassmorphism)
  bgElevated: '#1f2937',    // Componente elevado
  border: 'rgba(255, 255, 255, 0.08)', // Borde sutil del cristal
  borderFocus: '#7c3aed',   // Violeta foco
  
  textPrimary: '#f3f4f6',   // Blanco/Gris claro principal
  textSecondary: '#9ca3af', // Gris secundario
  textMuted: '#6b7280',     // Gris apagado

  primary: '#7c3aed',       // Violeta primario
  primaryLight: '#a78bfa',
  primaryGradient: ['#7c3aed', '#c084fc'], // Para gradientes

  success: '#10b981',       // Esmeralda éxito
  successLight: '#34d399',
  
  danger: '#ef4444',        // Rojo peligro/cerrado
  dangerLight: '#f87171',

  warning: '#f59e0b',       // Amarillo advertencia
  info: '#3b82f6',          // Azul informativo
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  lg: {
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
};

export const GLASS_STYLE = {
  backgroundColor: COLORS.bgCard,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: RADIUS.lg,
  overflow: 'hidden',
};
