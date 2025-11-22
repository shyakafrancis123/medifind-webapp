// Settings manager for MediFind
(function() {
  const SETTINGS_KEY = 'medifind_settings_v2';
  const DEFAULTS = {
    darkMode: false,
    sortOrder: 'brand_asc',
    autoSearch: true,
    showRecalls: true,
    fontSize: 'normal'
  };
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch (e) { return { ...DEFAULTS }; }
  }
  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  window.getAppSettings = loadSettings;
  window.saveAppSettings = saveSettings;
})();