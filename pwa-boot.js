(function(){
  if (!('serviceWorker' in navigator)) return;
  var v = 'build-20250814145257';
  var reloadedKey = 'reloaded:'+v;

  function register() {
    navigator.serviceWorker.register('/sw.js?v='+v).then(function(reg){

      // If there's an updated SW waiting, tell it to activate now
      if (reg.waiting) { try { reg.waiting.postMessage({type:'SKIP_WAITING'}); } catch(e){} }

      reg.addEventListener('updatefound', function(){
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function(){
          if (nw.state === 'installed' && reg.waiting) {
            try { reg.waiting.postMessage({type:'SKIP_WAITING'}); } catch(e){}
          }
        });
      });
    }).catch(console.error);
  }

  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if (refreshing) return;
    if (sessionStorage.getItem(reloadedKey)) return;
    refreshing = true;
    sessionStorage.setItem(reloadedKey, '1');
    location.reload();
  });

  register();
})();
