'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
        aria-expanded={open}
        className="p-3 min-w-[44px] min-h-[44px] flex flex-col justify-center items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors"
      >
        <span className={`block w-5 h-0.5 bg-current transition-transform duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
        <span className={`block w-5 h-0.5 bg-current transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-current transition-transform duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 w-full bg-space-black/95 backdrop-blur-md border-b border-border-subtle">
          <div className="flex flex-col px-[var(--spacing-gutter)] py-4 gap-1">
            <Link
              href="/docs"
              onClick={() => setOpen(false)}
              className="text-primary-container font-bold py-3 px-2 min-h-[44px] flex items-center hover:bg-zinc-900 rounded-md transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/human-in-the-loop"
              onClick={() => setOpen(false)}
              className="text-on-surface-variant py-3 px-2 min-h-[44px] flex items-center hover:bg-zinc-900 rounded-md transition-colors"
            >
              Human-in-the-Loop
            </Link>
            <Link
              href="/tools/dlq"
              onClick={() => setOpen(false)}
              className="text-on-surface-variant py-3 px-2 min-h-[44px] flex items-center hover:bg-zinc-900 rounded-md transition-colors"
            >
              DLQ
            </Link>
            <Link
              href="/tools/checkpoint"
              onClick={() => setOpen(false)}
              className="text-on-surface-variant py-3 px-2 min-h-[44px] flex items-center hover:bg-zinc-900 rounded-md transition-colors"
            >
              Checkpoint
            </Link>
            <Link
              href="/tools/kv-store"
              onClick={() => setOpen(false)}
              className="text-on-surface-variant py-3 px-2 min-h-[44px] flex items-center hover:bg-zinc-900 rounded-md transition-colors"
            >
              KV Store
            </Link>
            <Link
              href="/tools/audit-log"
              onClick={() => setOpen(false)}
              className="text-on-surface-variant py-3 px-2 min-h-[44px] flex items-center hover:bg-zinc-900 rounded-md transition-colors"
            >
              Audit Log
            </Link>
            <Link
              href="/tools/scheduler"
              onClick={() => setOpen(false)}
              className="text-on-surface-variant py-3 px-2 min-h-[44px] flex items-center hover:bg-zinc-900 rounded-md transition-colors"
            >
              Scheduler
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
