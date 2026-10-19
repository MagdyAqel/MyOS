import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
const root = "dist",
  files = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) await walk(path);
    else if (e.name !== "sw.js") files.push(path);
  }
}
await walk(root);
files.sort();
const digest = createHash("sha256");
for (const path of files) {
  digest.update(relative(root, path));
  digest.update(await readFile(path));
}
const version = digest.digest("hex").slice(0, 16),
  assets = files.map(
    (path) => "./" + relative(root, path).replaceAll("\\", "/"),
  );
await writeFile(
  join(root, "sw.js"),
  `/* Generated from the verified production build. */
const VERSION=${JSON.stringify(version)};
const SCOPE=new URL(self.registration.scope);
const CACHE='myos-offline-'+encodeURIComponent(SCOPE.pathname)+'-'+VERSION;
const PREFIX='myos-offline-'+encodeURIComponent(SCOPE.pathname)+'-';
const ASSETS=${JSON.stringify(assets)}.map(path=>new URL(path,SCOPE).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'}))))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname))return;
 if(url.pathname===new URL('multiplayer.json',SCOPE).pathname)event.respondWith((async()=>{const cache=await caches.open(CACHE),key=new URL('multiplayer.json',SCOPE).href,abort=new AbortController(),timer=setTimeout(()=>abort.abort(),4000);try{const response=await fetch(request,{cache:'no-store',signal:abort.signal});if(response.ok){await cache.put(key,response.clone());return response;}}catch{}finally{clearTimeout(timer);}return (await cache.match(key))||new Response(JSON.stringify({endpoint:''}),{headers:{'Content-Type':'application/json'}});})());
 else if(request.mode==='navigate')event.respondWith((async()=>{const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),6000);try{const response=await fetch(request,{signal:abort.signal});if(response.ok)return response;}catch{}finally{clearTimeout(timer);}return (await caches.match(new URL('index.html',SCOPE).href))||new Response('Offline: open the app online once.',{status:503});})());
 else if(ASSETS.includes(url.href))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(request))||fetch(request)));
});
`,
);
console.log(
  `Offline build ${version}: ${assets.length} local assets cached; external requests excluded.`,
);
