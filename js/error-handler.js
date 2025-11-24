// Global error handlers to catch uncaught exceptions and unhandled promise rejections
(function(){
  function formatError(e) {
    try { return (e && e.stack) ? e.stack : String(e); } catch(x) { return String(e); }
  }

  window.addEventListener('error', function(ev){
    try {
      const msg = ev && ev.message ? ev.message : 'An unexpected error occurred';
      const details = ev && ev.error ? ev.error : ev;
      if (window.logger && typeof window.logger.error === 'function') window.logger.error('Uncaught error', details);
      if (window.reportUserError) window.reportUserError('An unexpected error occurred. Please reload the page.', details);
    } catch(e){ console.error('global error handler failed', e); }
  });

  window.addEventListener('unhandledrejection', function(ev){
    try {
      const reason = ev && ev.reason ? ev.reason : ev;
      if (window.logger && typeof window.logger.error === 'function') window.logger.error('Unhandled promise rejection', reason);
      if (window.reportUserError) window.reportUserError('An unexpected background error occurred. Try reloading or retrying the action.');
    } catch(e){ console.error('global unhandledrejection handler failed', e); }
  });
})();
