export interface MailContent { subject: string; text: string; html: string }

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head><body><main><h1>LANDSIS LADERA-1</h1><h2>${escapeHtml(title)}</h2>${body}</main></body></html>`;
}

// El futuro servicio de autenticación construirá este enlace desde FRONTEND_URL.
// Aquí se rechazan esquemas activos y credenciales embebidas, sin crear tokens.
export function passwordRecoveryTemplate(input: { name: string; resetUrl: string }): MailContent {
  let url: URL;
  try { url = new URL(input.resetUrl); } catch { throw new Error('Enlace de recuperación inválido.'); }
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password || /[\r\n\0]/.test(input.resetUrl)) {
    throw new Error('Enlace de recuperación inválido.');
  }
  const subject = 'Recupera tu contraseña — LANDSIS LADERA-1';
  const notice = 'Este mensaje no es spam; forma parte del método de recuperación de contraseña de LANDSIS LADERA-1. Si solicitaste esta recuperación y el correo llegó a la carpeta de spam, márcalo como «No es spam» en Gmail.';
  return {
    subject,
    text: `Hola, ${input.name}.\n\nSolicitaste restablecer tu contraseña de LANDSIS LADERA-1.\nAbre este enlace: ${url.href}\nEl enlace vence en 15 minutos y solo puede utilizarse una vez.\nSi no hiciste esta solicitud, ignora este correo.\n\n${notice}`,
    html: layout('Recuperación de contraseña', `<p>Hola, ${escapeHtml(input.name)}.</p><p>Solicitaste restablecer tu contraseña de LANDSIS LADERA-1.</p><p><a href="${escapeHtml(url.href)}">Establecer nueva contraseña</a></p><p>El enlace vence en 15 minutos y solo puede utilizarse una vez.</p><p>Si no hiciste esta solicitud, ignora este correo.</p><p>${escapeHtml(notice)}</p>`),
  };
}

export function passwordChangedTemplate(input: { name: string }): MailContent {
  return {
    subject: 'Contraseña modificada — LANDSIS LADERA-1',
    text: `Hola, ${input.name}.\n\nTu contraseña de LANDSIS LADERA-1 fue modificada.\nSi no realizaste este cambio, contacta al administrador del sistema.`,
    html: layout('Contraseña modificada', `<p>Hola, ${escapeHtml(input.name)}.</p><p>Tu contraseña de LANDSIS LADERA-1 fue modificada.</p><p>Si no realizaste este cambio, contacta al administrador del sistema.</p>`),
  };
}
