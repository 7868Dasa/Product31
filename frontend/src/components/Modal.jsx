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
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-sm animate-[fade-up_0.2s_ease-out] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`flex max-h-[92dvh] w-full ${maxW} flex-col rounded-t-[28px] bg-cream shadow-pop animate-sheet-up sm:rounded-[28px] sm:animate-pop-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-sand sm:hidden"
          aria-hidden="true"
        />
        <div className="flex items-center justify-between px-5 pb-3 pt-3">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-full p-2 text-ink-soft transition-transform active:scale-90 active:bg-sand"
          >
            <X size={22} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-sand/70 px-5 py-4">
          {children}
        </div>
        {footer && (
          <div className="border-t border-sand/70 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
