(function(){
  // ------ Remove stray "\1" text nodes ------
  try {
    var walker = document.createTreeWalker(document.body || document, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(n){ if (n.nodeValue && n.nodeValue.trim() === "\\1") n.nodeValue = ""; });
  } catch(e){}

  // ------ Error overlay ------
  function ensureOverlay(){
    var el = document.getElementById('__error_overlay__');
    if (el) return el;
    el = document.createElement('div');
    el.id = '__error_overlay__';
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.right = '0';
    el.style.zIndex = '999999';
    el.style.background = 'rgba(220, 38, 38, 0.98)';
    el.style.color = '#fff';
    el.style.font = '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    el.style.padding = '10px 12px';
    el.style.whiteSpace = 'pre-wrap';
    el.style.display = 'none';
    document.body && document.body.appendChild(el);
    return el;
  }
  function showError(msg){
    try {
      var el = ensureOverlay();
      el.textContent = '[App Error] ' + msg;
      el.style.display = 'block';
    } catch(e){}
  }
  window.addEventListener('error', function(e){
    showError(String(e.message || e.error || e));
  });
  window.addEventListener('unhandledrejection', function(e){
    showError('Unhandled promise: ' + String((e&&e.reason)||''));
  });

  // ------ Service worker register with cache-busting ------
  if ('serviceWorker' in navigator) {
    var v = (window.BUILD_VERSION || 'v10') + '-' + Date.now().toString().slice(-6);
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('/sw.js?v=' + v).catch(function(err){
        console && console.warn && console.warn('SW register failed:', err);
      });
    });
  }
})();
