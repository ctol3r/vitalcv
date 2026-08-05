import { chromium } from '@playwright/test';
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:3994/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1200);
await p.click('#clh-npi'); await p.fill('#clh-npi','1003000134');
await p.click('button[data-home-primary-cta]');
await p.waitForTimeout(5000);
const info = await p.evaluate(()=>{
  const all=[...document.querySelectorAll('[data-clh-reveal]')];
  return all.map(e=>({cls:e.className||e.tagName, seen:e.hasAttribute('data-seen'), op:getComputedStyle(e).opacity}));
});
console.log(JSON.stringify(info,null,1));
