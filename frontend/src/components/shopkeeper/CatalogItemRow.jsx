import { Minus, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';

export function CatalogItemRow({ item, onChange, onRemove }) {
  const { t, lang } = useI18n();
  const name = lang === 'ta' && item.name_ta ? item.name_ta : item.name;
  const sellable = item.is_available && item.stock_qty > 0;

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold">
            <span className="mr-1">{item.icon || '🛒'}</span>
            {name} <span className="text-sm font-normal text-ink-soft">{item.pack_size}</span>
          </div>
          {item.brand && <div className="text-xs text-ink-soft">{item.brand}</div>}
        </div>
        <button
          onClick={() => onRemove(item.id)}
          aria-label={t('cat.remove')}
          className="-mr-1 shrink-0 rounded-full p-2 text-ink-soft active:bg-sand"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 rounded-full border-2 border-sand bg-white px-3 py-1.5 text-sm">
          <span className="text-ink-soft">₹</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            value={item.price}
            onChange={(e) => onChange(item.id, { price: Math.max(0, Number(e.target.value)) })}
            className="w-16 bg-transparent font-bold outline-none"
            aria-label={t('cat.price')}
          />
        </label>

        <div className="flex items-center gap-1 rounded-full border-2 border-sand bg-white py-1 pl-1.5 pr-2">
          <button
            onClick={() => onChange(item.id, { stock_qty: Math.max(0, item.stock_qty - 1) })}
            className="rounded-full p-1.5 active:bg-sand"
            aria-label="−1"
          >
            <Minus size={16} />
          </button>
          <span className="w-10 text-center font-bold tabular-nums">{item.stock_qty}</span>
          <button
            onClick={() => onChange(item.id, { stock_qty: item.stock_qty + 1 })}
            className="rounded-full p-1.5 active:bg-sand"
            aria-label="+1"
          >
            <Plus size={16} />
          </button>
        </div>

        <button
          onClick={() => onChange(item.id, { is_available: !item.is_available })}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
            sellable ? 'bg-go/15 text-go' : 'border-2 border-sand bg-white text-ink-soft'
          }`}
        >
          {sellable ? <Eye size={15} /> : <EyeOff size={15} />}
          {sellable ? t('cat.selling') : t('cat.hidden')}
        </button>
      </div>
    </li>
  );
}
