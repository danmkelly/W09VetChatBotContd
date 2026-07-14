var slotCache = {};
async function fetchSlots(serviceId) {
  if (slotCache[serviceId]) return slotCache[serviceId];
  try {
    var url = API_PROXY ? API_PROXY + "/api/slots?service_id=" + encodeURIComponent(serviceId || "") : "";
    var r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    var d = await r.json();
    slotCache[serviceId] = d.slots;
    return d.slots;
  } catch(e) { console.warn("[Slots] fail:", e.message); return null; }
}
