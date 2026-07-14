var API_PROXY="https://meadow-vet-proxy.dan-m-kelly.workers.dev";

// === Key setup ===
(function(){
  if(typeof LLM_KEY==="undefined")window.LLM_KEY="";
  if(typeof LLM_URL==="undefined")window.LLM_URL="";
  if(typeof LLM_MODEL==="undefined")window.LLM_MODEL="";
})(window);

// === Google Sheet Data ===
var slotCache={}; function fetchSlots(serviceId){ return 'test'; }