// ─── Helpers de permisos por rol (archivo separado para Fast Refresh) ─
export const can = (user, action) => {
  if (!user) return false;
  const perms = {
    admin:    ['sell','annul','viewHistory','manageGames','manageUsers','closeNumbers','settings'],
    vendedor: ['sell','annul','viewHistory','settings'],
  };
  return (perms[user.role] || []).includes(action);
};
