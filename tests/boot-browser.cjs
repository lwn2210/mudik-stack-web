// Run after build: PLAYWRIGHT_MODULE_PATH=/path/to/playwright node tests/boot-browser.cjs output.json [model|module|healthy]
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {once}=require('node:events');
const root=path.resolve(__dirname,'../dist');
const output=process.argv[2], mode=process.argv[3]||'model';
(async()=>{
 let injected=0, browser;
 const result={mode,attempted:1,passed:0,failed:0,blocked:0,pageErrors:[],consoleErrors:[],httpErrors:[]};
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  if(injected===0 && ((mode==='model' && name.endsWith('/avanza.glb')) || (mode==='module' && /\/game-[^/]+\.js$/.test(name)))){
   injected++;res.writeHead(503,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('deliberate boot failure');return;
  }
  if(name==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const file=path.join(root,name==='/'?'index.html':name);
  fs.readFile(file,(err,data)=>{const ext=path.extname(file);res.writeHead(err?404:200,{'Cache-Control':'no-store','Content-Type':{'.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.glb':'model/gltf-binary'}[ext]||'text/html'});res.end(err?'not found':data)});
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text())});
  page.on('response',r=>{if(r.status()>=400)result.httpErrors.push({url:r.url(),status:r.status()})});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  if(mode!=='healthy'){
   await page.locator('#boot-status').filter({hasText:'Gagal memuat game'}).waitFor({state:'visible',timeout:12000});
   assert.equal(injected,1,'a real model/module HTTP failure was injected');
   assert.equal(await page.locator('#menu').getAttribute('hidden'),'','no inert start menu exposed');
   assert.equal(await page.locator('#start').isEnabled(),false);
   assert.equal(await page.locator('#mute').isVisible(),false);
   assert.equal(await page.locator('#boot-retry').isVisible(),true);
   await page.locator('#boot-retry').focus();
   await Promise.all([page.waitForEvent('load'),page.keyboard.press('Enter')]);
  }
  await page.locator('#start').waitFor({state:'visible',timeout:20000});
  assert.equal(await page.locator('#start').isEnabled(),true);
  assert.equal(await page.locator('#boot').isVisible(),false);
  await page.locator('#start').click();
  await page.waitForFunction(()=>!document.getElementById('hud').hidden);
  await page.locator('#score').waitFor({state:'visible'});
  await page.waitForTimeout(1200);
  assert.deepEqual(result.pageErrors,[],'boot failure must be caught, not an unhandled rejection');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  result.passed=1;result.startedAfterRecovery=mode!=='healthy';
 }catch(e){result.failed=1;result.failure=String(e);process.exitCode=1}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
