export function normalizeWorkspaceHost(host: string | null | undefined): string {
  const normalized = (host ?? '').trim().replace(/\/+$/, '');
  if (!normalized) return '';
  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
}
