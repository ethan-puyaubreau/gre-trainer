import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * A confirmation-sized modal on the native <dialog>: showModal() brings the focus trap, the inert page and Escape.
 * Focus goes back to whatever opened it. Put the buttons in a `.modal-actions` row inside the children.
 */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const d = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    d.showModal();
    return () => {
      d.close();
      trigger?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby={titleId}
      // Escape: keep the state in React, which closes the dialog in the effect above.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the ::backdrop targets the dialog itself, outside its box.
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
      }}
    >
      {open && (
        <>
          <h2 id={titleId}>{title}</h2>
          {children}
        </>
      )}
    </dialog>
  );
}
