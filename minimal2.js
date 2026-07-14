var API_PROXY="test";
async function foo(id){
  try{
    var url=API_PROXY?API_PROXY+"/path?param="+encodeURIComponent(id||"");
  }catch(e){}
}
