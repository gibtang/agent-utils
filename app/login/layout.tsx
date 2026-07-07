import type { Metadata } from 'next';

// Auth pages are not content surfaces — keep them out of the index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
