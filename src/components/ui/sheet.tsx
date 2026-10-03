import { Dialog as BaseDialog } from '@base-ui/react/dialog';

/** A side-panel dialog. Base UI owns dismissal, focus containment and restoration. */
export const Sheet = {
  Root: BaseDialog.Root,
  Trigger: BaseDialog.Trigger,
  Portal: BaseDialog.Portal,
  Backdrop: BaseDialog.Backdrop,
  Viewport: BaseDialog.Viewport,
  Popup: BaseDialog.Popup,
  Title: BaseDialog.Title,
  Close: BaseDialog.Close,
};
