import connectDB from '@/lib/mongodb';
import AgentForm from '@/models/AgentForm';

export const dynamic = 'force-dynamic';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

function NotFoundView({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-zinc-100">{message}</h1>
        <p className="mt-2 text-zinc-400">This form may have expired or been deleted.</p>
      </div>
    </div>
  );
}

interface FormData {
  title: string;
  fields: FormField[];
  [key: string]: unknown;
}

function FormView({ form, token }: { form: FormData; token: string }) {
  const fields: FormField[] = form.fields;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-zinc-100 mb-1">{form.title}</h1>
          <p className="text-sm text-zinc-500 mb-6">Powered by AgentUtils</p>

          <form action={`/api/form-submit/${token}`} method="POST" className="space-y-5">
            {fields.map((field) => (
              <div key={field.name}>
                <label htmlFor={field.name} className="block text-sm font-medium text-zinc-300 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    id={field.name}
                    name={field.name}
                    required={field.required}
                    placeholder={field.placeholder}
                    rows={4}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                ) : field.type === 'select' ? (
                  <select
                    id={field.name}
                    name={field.name}
                    required={field.required}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  >
                    <option value="">Select...</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <div className="flex items-center gap-2">
                    <input
                      id={field.name}
                      name={field.name}
                      type="checkbox"
                      required={field.required}
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-zinc-100"
                    />
                    <span className="text-sm text-zinc-400">{field.placeholder || 'Yes'}</span>
                  </div>
                ) : (
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    required={field.required}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                )}
              </div>
            ))}

            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white transition-colors"
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeanForm = any;

export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await connectDB();
  const form: LeanForm = await AgentForm.findOne({ token: id }).lean();

  if (!form) {
    return <NotFoundView message="Form Not Found" />;
  }

  const now = new Date();
  if (form.status === 'paused' || form.status === 'expired' || (form.expiresAt && form.expiresAt < now)) {
    return <NotFoundView message="Form No Longer Available" />;
  }

  return <FormView form={form} token={id} />;
}
