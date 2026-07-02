// ─── Helpers de permisos por rol (archivo separado para Fast Refresh) ─
export const can = (user, action) => {
  if (!user) return false;
  const perms = {
    admin:    ['sell','annul','viewHistory','manageGames','manageUsers','closeNumbers','settings'],
    vendedor: ['sell','annul','viewHistory','settings'],
    // root solo puede controlar la disponibilidad — no opera la app
    root:     ['rootControl'],
  };
  return (perms[user.role] || []).includes(action);
};

/** Verdadero si el usuario es superusuario root */
export const isRoot = (user) => user?.role === 'root';
