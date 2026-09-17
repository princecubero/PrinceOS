// Apply the saved preference before the page paints.
try {
  const theme = localStorage.getItem('princeos-theme');
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
} catch {
  document.documentElement.dataset.theme = 'dark';
}
