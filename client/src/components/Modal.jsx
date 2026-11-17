import { useEffect, useId, useRef } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  labelledBy,
  disableClose = false,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const generatedTitleId = useId();
  const titleId = labelledBy || generatedTitleId;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return undefined;

    const returnFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    const autofocusElement = dialog.querySelector("[data-autofocus]");
    autofocusElement?.focus();

    return () => {
      if (dialog.open) dialog.close();
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
        returnFocus.focus();
      }
    };
  }, [open]);

  function requestClose() {
    if (disableClose) return;
    onCloseRef.current?.();
  }

  return (
    <dialog
      ref={dialogRef}
      className="m-0 h-[100dvh] w-full max-w-none overflow-y-auto bg-transparent p-0 backdrop:bg-slate-950/60 sm:m-auto sm:h-auto sm:max-h-[90vh] sm:max-w-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section className="surface-card min-h-full rounded-none p-5 sm:min-h-0 sm:rounded-3xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            className="button-quiet -mr-2 -mt-2 grid h-10 w-10 place-items-center p-0 text-xl"
            aria-label="Close dialog"
            disabled={disableClose}
            onClick={requestClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {children}
      </section>
    </dialog>
  );
}
