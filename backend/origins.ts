const websiteOrigins = new Set(['https://www.happycapetours.com', 'https://happycapetours.com']);
/** Match exact loopback hosts, never lookalike domains or arbitrary preview hosts. */
export function isAllowedOrigin(origin:string):boolean {
  if (websiteOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      !url.username && !url.password && url.origin === origin;
  } catch {return false;}
}
