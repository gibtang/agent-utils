import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up — AgentUtils',
  description: 'Create your AgentUtils account and get an API key in 30 seconds.',
  alternates: {
    canonical: '/signup',
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
