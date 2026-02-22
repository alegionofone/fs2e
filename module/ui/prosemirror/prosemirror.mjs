export const enrichProseMirrorContent = async (html, { document, secrets = false } = {}) =>
  foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", {
    async: true,
    secrets,
    documents: true,
    document
  });
