// Lightweight logging and user-reporting helper
(function(){
  function safeConsole(fn, ...args) {
    try { if (console && console[fn]) console[fn](...args); }
    catch(e){}
  }

  window.logger = {
    info: (...args) => safeConsole('info', ...args),
    warn: (...args) => safeConsole('warn', ...args),
    error: (...args) => safeConsole('error', ...args)
  };

  // Show a concise user-facing error message. If the app exposes showError, use it.
  window.reportUserError = function(userMessage, details) {
    try {
      // Log details for debugging
      window.logger.error(userMessage, details || '');
      if (window.showError && typeof window.showError === 'function') {
        window.showError(userMessage);
      } else {
        // create an ephemeral banner at top of body
        const id = 'global-error-banner';
        let b = document.getElementById(id);
        if (!b) {
          b = document.createElement('div');
          b.id = id;
          b.style.position = 'fixed';
          b.style.top = '0';
          b.style.left = '0';
          b.style.right = '0';
          b.style.zIndex = 10010;
          b.style.background = '#fee2e2';
          b.style.color = '#7f1d1d';
          b.style.padding = '10px 12px';
          b.style.fontWeight = '600';
          b.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
          b.style.display = 'flex';
          b.style.justifyContent = 'space-between';
          b.style.alignItems = 'center';
          const span = document.createElement('span');
          span.id = id + '-text';
          b.appendChild(span);
          const btn = document.createElement('button');
          btn.textContent = 'Dismiss';
          btn.style.marginLeft = '12px';
          btn.onclick = () => b.remove();
          b.appendChild(btn);
          document.body.appendChild(b);
        }
        const text = document.getElementById(id + '-text');
        if (text) text.textContent = userMessage;
      }
    } catch (e) {
      safeConsole('error', 'reportUserError failed', e);
    }
  };
})();
