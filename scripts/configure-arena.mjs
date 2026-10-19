import {writeFile} from 'node:fs/promises';
const url=new URL(process.argv[2]);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||['localhost','127.0.0.1'].includes(url.hostname))throw Error('Provide the public HTTPS Worker origin');
await writeFile(new URL('../public/multiplayer.json',import.meta.url),JSON.stringify({endpoint:url.origin})+'\n');console.log('Public multiplayer endpoint configured. Rebuild and publish the frontend.');
