// Los 161 casos de telemetría mantienen sus datos y expectativas. Inyectan
// un usuario autenticado explícito; auth real se prueba en auth.test.cjs.
const { createApp } = require('../dist/app.js');
const { createSecurity } = require('../dist/auth/security.js');
exports.createApp = (save, readings, nodes, daily) => {
  const security = createSecurity();
  security.requireAuth = (_req, res, next) => {
    res.locals.user = { id: 1, name: 'Prueba', email: 'test@example.invalid', role: 'INVESTIGADOR', active: true };
    next();
  };
  return createApp(save, readings, nodes, security, daily);
};
