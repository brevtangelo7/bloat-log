export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function severityBadge(sev) {
  if (!sev) return '';
  const cls = sev === 'High' ? 'badge-high' : sev === 'Medium' ? 'badge-med' : 'badge-low';
  const icon = sev === 'High' ? '🔴' : sev === 'Medium' ? '🟡' : '🟢';
  const label = sev === 'Medium' ? 'Med' : sev;
  return `<span class="badge ${cls}">${icon} ${label}</span>`;
}

export function sevToNum(s) {
  return s === 'High' ? 3 : s === 'Medium' ? 2 : s === 'Low' ? 1 : 0;
}

export function downloadCSV(entries) {
  const headers = ['Date', 'Time', 'Foods', 'Severity', 'Time to Bloat', 'Note'];
  const rows = entries.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(e => {
    const d = new Date(e.timestamp);
    const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return [date, time, e.foods, e.severity, e.timeToBloat, e.note]
      .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bloat-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
