export async function enrichProseMirrorContent(html, { document, secrets = false } = {}) {
  const source = html ?? "";
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(source, {
    async: true,
    secrets,
    documents: true,
    document
  });
}
