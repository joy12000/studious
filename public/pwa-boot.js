(function(){
  // Remove stray literal "\\1" text nodes
  try {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(n){ if (n.nodeValue && n.nodeValue.trim() === "\\1") n.nodeValue = ""; });
  } catch(e){}

  // SW register with cache-busting
  if ('serviceWorker' in navigator) {
    var v = Date.now().toString().slice(-8);
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('/sw.js?v=' + v).catch(function(){});
    });
  }
})();
