const fs = require('fs');
const path = require('path');
const file = '/Users/christoler/vitalcv/apps/web/app/passport/page.tsx';

let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "  { id: 'fsmb', name: 'FSMB / State Board', description: 'State medical board licensure verification via the Federation of State Medical Boards' },",
  "  { id: 'fsmb', name: 'FSMB / State Board', description: 'State medical board licensure verification via the Federation of State Medical Boards', locked: true },"
);

code = code.replace(
  "<p className=\"text-sm font-medium text-foreground\">{src.name}</p>",
  "<div className=\"flex items-center gap-2\">\n                          <p className=\"text-sm font-medium text-foreground\">{src.name}</p>\n                          {src.locked && <span className=\"rounded-sm bg-muted/50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground flex items-center gap-1\"><svg className=\"w-2.5 h-2.5\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z\" /></svg>Access Required</span>}\n                        </div>"
);

fs.writeFileSync(file, code);
