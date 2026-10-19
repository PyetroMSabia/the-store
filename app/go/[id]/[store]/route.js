/**
 * Redireciona links legados /go/:id/:store para a nova rota oficial /go/:id
 */
export async function GET(request, { params }) {
  const { id } = await params;
  return Response.redirect(new URL(`/go/${id}`, request.url), 301);
}
