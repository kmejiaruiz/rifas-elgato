// ─── Helpers de permisos por rol (archivo separado para Fast Refresh) ─
export const can = (user, action) => {
  if (!user) return false;
  const perms = {
    admin:    ['sell','annul','viewHistory','manageGames','manageUsers','closeNumbers','settings'],
    vendedor: ['sell','annul','viewHistory','settings'],
    // root tiene control total sobre la app, incluyendo todas las funciones de admin
    root:     ['sell','annul','viewHistory','manageGames','manageUsers','closeNumbers','settings','rootControl'],
  };
  return (perms[user.role] || []).includes(action);
};

/** Verdadero si el usuario es superusuario root */
export const isRoot = (user) => user?.role === 'root';
