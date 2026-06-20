import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In — AgentUtils',
  description: 'Sign in to your AgentUtils account.',
  openGraph: { url: '/login' },
  alternates: {
    canonical: '/login',
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
