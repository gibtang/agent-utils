'use client';

import Link, { type LinkProps } from 'next/link';
import type { MouseEventHandler, ReactNode } from 'react';
import { trackEvent } from '@/lib/analytics';

type TrackedLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  eventName: string;
  eventParameters?: Record<string, string | number | boolean>;
};

export default function TrackedLink({
  eventName,
  eventParameters,
  onClick,
  children,
  ...props
}: TrackedLinkProps & { onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        trackEvent(eventName, eventParameters);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
