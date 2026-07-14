var API_PROXY="https://meadow-vet-proxy.dan-m-kelly.workers.dev";

// === Key setup ===
(function(){
  if(typeof LLM_KEY==="undefined")window.LLM_KEY="";
  if(typeof LLM_URL==="undefined")window.LLM_URL="";
  if(typeof LLM_MODEL==="undefined")window.LLM_MODEL="";
})(window);

// === Google Sheet Data ===
var SHEET_CSV="https://docs.google.com/spreadsheets/d/1JhSODtviGHzXru6Eb5MhfXfVIF5vtJk3pclzzv7j2l4/gviz/tq?tqx=out:csv&gid=1277715587";
var allServices=[];
var filteredServices=[];
var activeSpecies=["dog","cat","rabbit","small mammal","bird"];
var offersOnly=false;
var bookableOnly=false;

// === State ===
var conv=[],gibberishCount=0,expectingName=false,expectingConsent=false,expectingHumanBot=false;
var currentQuery="",spokeLast=false,lastBotAsked=false;
function escHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}

// === Irish Public Holidays ===
var holidayCache=null;
function dateToYMD(d){
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
async function fetchIrishHolidays(){
  if(holidayCache)return holidayCache;
  var thisYear=new Date().getFullYear();
  var nextYear=thisYear+1;
  try{
    var url=API_PROXY?API_PROXY+"/api/holidays":"https://date.nager.at/api/v4/Holidays/IE/"+thisYear;
    var r=await fetch(url);
    if(!r.ok)throw new Error("HTTP "+r.status);
    var thisYearHols=await r.json();
    var nextUrl=API_PROXY?API_PROXY+"/api/holidays?year="+nextYear:"https://date.nager.at/api/v4/Holidays/IE/"+nextYear;
    var r2=await fetch(nextUrl);
    var nextYearHols=r2.ok?await r2.json():[];
    holidayCache=(thisYearHols||[]).concat(nextYearHols||[]);
    return holidayCache;
  }catch(e){console.warn("[Holidays] fetch fail:",e.message);return[]}
}
function isHoliday(dateObj){
  if(!holidayCache)return null;
  var ymd=dateToYMD(dateObj);
  for(var i=0;i<holidayCache.length;i++){if(holidayCache[i].date===ymd)return holidayCache[i]}
  return null;
}
function getHolidayContext(){

var slotCache={};
async function fetchSlots(serviceId){
  if(slotCache[serviceId])return slotCache[serviceId];
  try{
    var url=API_PROXY?API_PROXY+"/api/slots?service_id="+encodeURIComponent(serviceId||"");
    var r=await fetch(url);
    if(!r.ok)throw new Error("HTTP "+r.status);
    var d=await r.json();
    slotCache[serviceId]=d.slots;
    return d.slots;
  }catch(e){console.warn("[Slots] fail:",e.message);return null}
}