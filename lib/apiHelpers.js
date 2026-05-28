export function successResponse(data, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function errorResponse(message, status = 400) {
  return Response.json({ success: false, error: message }, { status });
}

export function handleApiError(error) {
  console.error('[API Error]', error);

  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((e) => e.message);
    return errorResponse(messages.join(', '), 422);
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return errorResponse(`${field} already exists`, 409);
  }

  return errorResponse('Internal server error', 500);
}
