export const shortTime = (value: string) => new Date(value).toLocaleTimeString('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
});
export const quantity = (value: string, unit: string) => {
  const kg = unit === 'g' && Number(value) >= 1000;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(Number(value) / (kg ? 1000 : 1))} ${kg ? 'kg' : unit}`;
};
export const elapsed = (at: string, now: number) => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(at)) / 60000));
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `${Math.floor(minutes / 1440)} dia(s)`;
};
