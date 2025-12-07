// app/admin/mcp/page.tsx
"use client";
import { useState } from "react";
import { searchMcp } from "@/app/lib/agentClient";

export default function McpAdmin() {
  const [q,setQ]=useState("verify license");
  const [rows,setRows]=useState<any[]>([]);
  return (
    <div className="max-w-4xl mx-auto py-8">
      <h2 className="text-xl font-bold">MCP Console</h2>
      <div className="flex gap-2 mt-3">
        <input className="flex-1 p-2 border rounded" value={q} onChange={e=>setQ(e.target.value)} />
        <button className="px-3 py-2 rounded bg-black text-white" onClick={async()=>{
          const r = await searchMcp(q, []);
          setRows(r);
        }}>Search</button>
      </div>
      <div className="mt-6 space-y-4">
        {rows.map((r,i)=>(
          <div key={i} className="p-3 border rounded">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-semibold">{r.name} <span className="text-xs opacity-70">({r.scope})</span></div>
                <div className="text-sm opacity-80">{r.description}</div>
                {r.tags && r.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {r.tags.map((tag: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className='flex gap-2 ml-3'>
                <button
                  className='px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50'
                  onClick={async()=>{
                    const baseUrl = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';
                    await fetch(`${baseUrl}/api/agent/admin/promote`, {
                      method:'POST',
                      headers:{'content-type':'application/json'},
                      body:JSON.stringify({name:r.name})
                    });
                    alert(`Promoted ${r.name} to native tool`);
                    // Refresh the search to see updated tags
                    const updatedRows = await searchMcp(q, []);
                    setRows(updatedRows);
                  }}
                >
                  Promote
                </button>
                <button
                  className='px-2 py-1 text-xs bg-black text-white rounded hover:bg-gray-800'
                  onClick={async()=>{
                    const baseUrl = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';
                    const res = await fetch(`${baseUrl}/api/agent/admin/promote/pipeline`, {
                      method:'POST',
                      headers:{'content-type':'application/json'},
                      body:JSON.stringify({name:r.name})
                    });
                    const data = await res.json();
                    if (data.ok) {
                      alert(`✓ Codegen Native: ${data.fnName}\nFile: ${data.file}`);
                      // Auto-pin after successful codegen
                      await fetch(`${baseUrl}/api/agent/admin/promote/pin`, {
                        method:'POST',
                        headers:{'content-type':'application/json'},
                        body:JSON.stringify({name:r.name})
                      });
                      alert(`✓ Pinned ${r.name} as stable`);
                      const updatedRows = await searchMcp(q, []);
                      setRows(updatedRows);
                    } else {
                      alert(`✗ Failed to codegen ${r.name}`);
                    }
                  }}
                >
                  Codegen Native
                </button>
              </div>
            </div>
            <pre className="text-xs bg-gray-50 p-2 mt-2 rounded overflow-auto">{JSON.stringify(r.manifest,null,2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

