"use client";
import { useState } from 'react';
import { cssPath, suggestTestId } from './helpers';

type Step = {
  type: 'navigate' | 'wait' | 'toast' | 'click' | 'type' | 'expectText' | 'expectVisible' | 'expectCount';
  value?: string;
  ms?: number;
  selector?: string;
  text?: string;
  n?: number;
  retry?: {
    times?: number;
    interval_ms?: number;
  };
};

export default function DemoRecord() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [name, setName] = useState('Demo Script');
  const [key, setKey] = useState('default');
  const [suggestedTestId, setSuggestedTestId] = useState<string>('');

  async function start() {
    await fetch('/api/dev/demo/record/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    setSteps([]);
  }

  function addNavigate() {
    const path = prompt('Path to navigate (e.g., /agent)') || '';
    if (!path) return;
    setSteps((s) => [...s, { type: 'navigate', value: path }]);
    fetch('/api/dev/demo/record/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, step: { type: 'navigate', value: path } }),
    });
  }

  function addWait() {
    const ms = Number(prompt('ms to wait? (e.g., 1500)') || '0');
    setSteps((s) => [...s, { type: 'wait', value: String(ms), ms }]);
    fetch('/api/dev/demo/record/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, step: { type: 'wait', value: String(ms), ms } }),
    });
  }

  function addToast() {
    const txt = prompt('Toast text') || '';
    setSteps((s) => [...s, { type: 'toast', value: txt }]);
    fetch('/api/dev/demo/record/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, step: { type: 'toast', value: txt } }),
    });
  }

  function captureClick() {
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as Element;
      const sel = cssPath(target);
      const suggested = suggestTestId(target);
      setSuggestedTestId(suggested);
      const step = { type: 'click' as const, selector: sel };
      setSteps((s) => [...s, step]);
      fetch('/api/dev/demo/record/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, step }),
      });
      document.removeEventListener('click', handler, true);
    };
    document.addEventListener('click', handler, true);
    alert('Click on any element to capture it');
  }

  function captureType() {
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as Element;
      const sel = cssPath(target);
      const suggested = suggestTestId(target);
      setSuggestedTestId(suggested);
      const txt = prompt('Text to type:') || '';
      if (txt) {
        const step = { type: 'type' as const, selector: sel, text: txt };
        setSteps((s) => [...s, step]);
        fetch('/api/dev/demo/record/event', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key, step }),
        });
      }
      document.removeEventListener('click', handler, true);
    };
    document.addEventListener('click', handler, true);
    alert('Click on an input element to capture typing');
  }

  function addExpectText() {
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as Element;
      const sel = cssPath(target);
      const suggested = suggestTestId(target);
      setSuggestedTestId(suggested);
      const txt = prompt('Expected text to contain:') || '';
      if (txt) {
        const step = { type: 'expectText' as const, selector: sel, text: txt };
        setSteps((s) => [...s, step]);
        fetch('/api/dev/demo/record/event', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key, step }),
        });
      }
      document.removeEventListener('click', handler, true);
    };
    document.addEventListener('click', handler, true);
    alert('Click on an element to assert its text');
  }

  function addExpectVisible() {
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as Element;
      const sel = cssPath(target);
      const suggested = suggestTestId(target);
      setSuggestedTestId(suggested);
      const step = { type: 'expectVisible' as const, selector: sel };
      setSteps((s) => [...s, step]);
      fetch('/api/dev/demo/record/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, step }),
      });
      document.removeEventListener('click', handler, true);
    };
    document.addEventListener('click', handler, true);
    alert('Click on an element to assert it is visible');
  }

  function addExpectCount() {
    const sel = prompt('CSS selector for elements to count:') || '';
    const n = Number(prompt('Expected count:') || '0');
    if (sel) {
      const step = { type: 'expectCount' as const, selector: sel, n };
      setSteps((s) => [...s, step]);
      fetch('/api/dev/demo/record/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, step }),
      });
    }
  }

  async function stop() {
    const r = await fetch('/api/dev/demo/record/stop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, name }),
    });
    alert(await r.text());
  }

  function copyTestId() {
    if (suggestedTestId) {
      navigator.clipboard.writeText(suggestedTestId);
      alert('Copied to clipboard!');
    }
  }

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Demo Recorder & Smoke Test Builder</h1>

      {suggestedTestId && (
        <div className='mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs'>
          <p className='font-semibold mb-1'>💡 Suggested data-testid:</p>
          <div className='flex gap-2 items-center'>
            <code className='flex-1 px-2 py-1 bg-white border rounded font-mono'>
              data-testid="{suggestedTestId}"
            </code>
            <button
              className='px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700'
              onClick={copyTestId}
            >
              Copy
            </button>
          </div>
          <p className='text-gray-600 mt-1'>
            Add this to your element for stable, test-friendly selectors
          </p>
        </div>
      )}

      <div className='flex gap-2 text-xs items-center mt-4 flex-wrap'>
        <input
          className='p-2 border rounded'
          placeholder='script name'
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className='px-3 py-2 border rounded' onClick={start}>
          Start
        </button>
        <button className='px-3 py-2 border rounded' onClick={addNavigate}>
          + Navigate
        </button>
        <button className='px-3 py-2 border rounded' onClick={addWait}>
          + Wait
        </button>
        <button className='px-3 py-2 border rounded' onClick={addToast}>
          + Toast
        </button>
      </div>
      <div className='mt-3 pt-3 border-t'>
        <p className='text-xs font-semibold mb-2'>DOM Capture</p>
        <div className='flex gap-2 text-xs flex-wrap'>
          <button className='px-3 py-2 bg-blue-50 border rounded' onClick={captureClick}>
            Capture Click
          </button>
          <button className='px-3 py-2 bg-blue-50 border rounded' onClick={captureType}>
            Capture Type
          </button>
        </div>
      </div>
      <div className='mt-3 pt-3 border-t'>
        <p className='text-xs font-semibold mb-2'>Assertions</p>
        <div className='flex gap-2 text-xs flex-wrap'>
          <button className='px-3 py-2 bg-green-50 border rounded' onClick={addExpectText}>
            Expect Text
          </button>
          <button className='px-3 py-2 bg-green-50 border rounded' onClick={addExpectVisible}>
            Expect Visible
          </button>
          <button className='px-3 py-2 bg-green-50 border rounded' onClick={addExpectCount}>
            Expect Count
          </button>
        </div>
      </div>
      <div className='mt-3 pt-3 border-t'>
        <button className='px-4 py-2 bg-black text-white rounded text-xs' onClick={stop}>
          Save Script
        </button>
      </div>
      <ol className='mt-4 list-decimal ml-6 text-sm space-y-2'>
        {steps.map((s, i) => (
          <li key={i} className='py-2 border-b pb-3'>
            <div className='font-mono text-xs'>
              <span className='font-semibold'>{s.type}</span>
              {s.value && <span> — {s.value}</span>}
              {s.ms && <span> ({s.ms}ms)</span>}
              {s.selector && <span className='text-gray-600'> → {s.selector}</span>}
              {s.text && <span className='text-blue-600'> "{s.text}"</span>}
              {s.n !== undefined && <span className='text-green-600'> count={s.n}</span>}
            </div>
            <div className='flex gap-2 mt-2 items-center text-xs'>
              <label className='text-gray-600'>Retry:</label>
              <input
                type='number'
                min='0'
                max='10'
                className='w-16 px-2 py-1 border rounded'
                placeholder='2'
                value={s.retry?.times ?? ''}
                onChange={(e) => {
                  const times = Number(e.target.value) || undefined;
                  const updatedSteps = [...steps];
                  updatedSteps[i] = { ...s, retry: { ...s.retry, times } };
                  setSteps(updatedSteps);
                  fetch('/api/dev/demo/record/event', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      key,
                      step: { type: 'update', idx: i, retry: updatedSteps[i].retry }
                    }),
                  });
                }}
              />
              <label className='text-gray-600 ml-2'>Interval (ms):</label>
              <input
                type='number'
                min='0'
                step='100'
                className='w-20 px-2 py-1 border rounded'
                placeholder='300'
                value={s.retry?.interval_ms ?? ''}
                onChange={(e) => {
                  const interval_ms = Number(e.target.value) || undefined;
                  const updatedSteps = [...steps];
                  updatedSteps[i] = { ...s, retry: { ...s.retry, interval_ms } };
                  setSteps(updatedSteps);
                  fetch('/api/dev/demo/record/event', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      key,
                      step: { type: 'update', idx: i, retry: updatedSteps[i].retry }
                    }),
                  });
                }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}


