import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Bottom-sheet on phones, centred dialog on wider screens. Closes on Escape
 * and backdrop click. `footer` sticks to the bottom; body scrolls.
 */
export function Modal({ title, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const maxW = size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`flex max-h-[92vh] w-full ${maxW} flex-col rounded-t-xl2 bg-cream sm:rounded-xl2`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-sand px-5 py-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-full p-2 text-ink-soft active:bg-sand"
          >
            <X size={22} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-sand px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
