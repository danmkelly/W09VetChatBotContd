var slotCache = {};
async function fetchSlots(serviceId) {
  if (slotCache[serviceId]) return slotCache[serviceId];
  try {
    var url = "test";
    var r = await fetch(url);
    return r;
  } catch(e) { return null; }
}
