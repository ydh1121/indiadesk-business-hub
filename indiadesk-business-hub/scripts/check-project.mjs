import { access, stat } from 'node:fs/promises';
const files=['public/index.html','public/assets/styles.css','public/assets/app.js','functions/api/login.ts','functions/api/content.ts','public/downloads/india-business-partner-v1.1.pdf','public/downloads/ctrl-shift-indiadesk-v2.1.pdf'];
let failed=false;
for(const file of files){try{await access(file);const s=await stat(file);console.log('OK',file,s.size);}catch(e){failed=true;console.error('MISSING',file);}}
if(failed)process.exit(1);
