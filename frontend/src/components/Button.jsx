/**
 * One primary-action button style. Pill shape, big target, icon + text label
 * (spec §2 + blended premium feel). `icon` accepts a lucide-react component
 * or an emoji/string.
 */
export function Button({ children, icon: Icon, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary:
      'bg-primary text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.5)] active:bg-primary-dark disabled:opacity-50 disabled:shadow-none',
    ghost: 'bg-white text-ink border border-sand shadow-card active:bg-sand-soft disabled:opacity-50',
    danger: 'bg-white text-stop border border-stop/30 active:bg-stop/10 disabled:opacity-50',
  };
  // string / emoji → text; anything else truthy (a component, incl. lucide's
  // forwardRef objects) → render as an element.
  const renderIcon =
    typeof Icon === 'string' ? (
      <span aria-hidden="true" className="text-xl leading-none">
        {Icon}
      </span>
    ) : Icon ? (
      <Icon size={22} strokeWidth={2.25} aria-hidden="true" />
    ) : null;

  return (
    <button
      className={`flex w-full items-center justify-center gap-2.5 rounded-full px-5 py-3.5 text-lg font-semibold transition-transform duration-150 active:scale-[0.97] disabled:active:scale-100 ${styles[variant]} ${className}`}
      {...props}
    >
      {renderIcon}
      <span>{children}</span>
    </button>
  );
}
