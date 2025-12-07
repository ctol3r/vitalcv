"use client";

export default function ShipBar() {
  return (
    <div className='text-xs px-2 py-1 rounded bg-blue-50 border flex gap-3'>
      Ready to ship →
      <a href='/admin/rc' className='underline'>RC Gate</a> •
      <a href='/docs/bugbash' className='underline'>Bug-Bash</a>
    </div>
  );
}

