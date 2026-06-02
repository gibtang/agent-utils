import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import AgentForm from '@/models/AgentForm';
import FormResponse from '@/models/FormResponse';

// GET /api/form/:id — Get form + latest 100 responses
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const { id } = await params;
    await connectDB();

    const form = await AgentForm.findOne({
      _id: id,
      userId: authResult.apiKey.userId,
    }).lean();

    if (!form) {
      return errorResponse('Form not found', 404);
    }

    const responses = await FormResponse.find({ formId: form._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentutils.dev';

    return successResponse({
      form: {
        id: form._id.toString(),
        token: form.token,
        url: `${baseUrl}/f/${form.token}`,
        title: form.title,
        fields: form.fields,
        webhookUrl: form.webhookUrl,
        status: form.status,
        responseCount: form.responseCount,
        expiresAt: form.expiresAt,
      },
      responses: responses.map((resp) => ({
        id: resp._id.toString(),
        data: resp.data,
        sourceIp: resp.sourceIp,
        createdAt: resp.createdAt,
      })),
    });
  } catch (err) {
    console.error('Form get error:', err);
    return errorResponse('Failed to get form', 500);
  }
}

// DELETE /api/form/:id — Delete form + all responses
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const { id } = await params;
    await connectDB();

    const form = await AgentForm.findOne({
      _id: id,
      userId: authResult.apiKey.userId,
    });

    if (!form) {
      return errorResponse('Form not found', 404);
    }

    await Promise.all([
      FormResponse.deleteMany({ formId: form._id }),
      AgentForm.findByIdAndDelete(form._id),
    ]);

    return successResponse({ deleted: true });
  } catch (err) {
    console.error('Form delete error:', err);
    return errorResponse('Failed to delete form', 500);
  }
}
