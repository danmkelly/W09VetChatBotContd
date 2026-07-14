var API_PROXY="https://meadow-vet-proxy.dan-m-kelly.workers.dev";
(function(){
  if(typeof LLM_KEY==="undefined")window.LLM_KEY="";
})(window);
var slotCache={};
async function fetchSlots(serviceId){
  if(slotCache[serviceId])return slotCache[serviceId];
  try{
    var url=API_PROXY?API_PROXY+"/api/slots?service_id="+encodeURIComponent(serviceId||"");
  }catch(e){}
}
