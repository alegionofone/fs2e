export class FS2EItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, { submitOnChange: true, submitOnClose: true });
  }
}
