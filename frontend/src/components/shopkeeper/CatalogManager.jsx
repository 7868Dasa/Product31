import { useState, useMemo } from 'react';
import { Plus, FileUp, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { useStore } from '../../store.jsx';
import { CatalogItemRow } from './CatalogItemRow.jsx';
import { AddItemModal } from './AddItemModal.jsx';
import { CsvImportModal } from './CsvImportModal.jsx';

export function CatalogManager({ slug }) {
  const { t } = useI18n();
  const { catalogForShop, addCatalogItem, importCatalogRows, updateCatalogItem, removeCatalogItem, resetDemoCatalog } =
    useStore();
  const items = catalogForShop(slug);
  const [modal, setModal] = useState(null); // 'add' | 'csv'
  const [toast, setToast] = useState(null);

  const flash = (msg) => {
    if (!msg) return;
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const groups = useMemo(() => {
    const by = new Map();
    for (const it of [...items].sort((a, b) => a.name.localeCompare(b.name))) {
      const k = it.category || 'Uncategorised';
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(it);
    }
    return [...by.entries()];
  }, [items]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-ink-soft">{t('cat.count', { n: items.length })}</p>
        <button
          onClick={() => {
            resetDemoCatalog(slug);
            flash(t('cat.reset'));
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft underline"
        >
          <RotateCcw size={13} /> {t('cat.resetBtn')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setModal('add')}
          className="flex items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-white active:bg-primary-dark"
        >
          <Plus size={18} /> {t('cat.addItem')}
        </button>
        <button
          onClick={() => setModal('csv')}
          className="flex items-center justify-center gap-2 rounded-full border-2 border-primary py-3 font-semibold text-primary active:bg-primary-tint"
        >
          <FileUp size={18} /> {t('cat.importCsv')}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl2 border-2 border-dashed border-sand px-4 py-10 text-center text-base text-ink-soft">
          {t('cat.empty')}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(([cat, list]) => (
            <section key={cat}>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">{cat}</h3>
              <ul className="divide-y divide-sand rounded-xl2 border-2 border-sand bg-white px-4">
                {list.map((it) => (
                  <CatalogItemRow
                    key={it.id}
                    item={it}
                    onChange={(id, patch) => updateCatalogItem(slug, id, patch)}
                    onRemove={(id) => {
                      removeCatalogItem(slug, id);
                      flash(t('cat.removed'));
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {modal === 'add' && (
        <AddItemModal
          existing={items}
          onSave={(item) => addCatalogItem(slug, item)}
          onClose={(outcome) => {
            setModal(null);
            flash(outcome === 'added' ? t('cat.added') : outcome === 'updated' ? t('cat.updated') : null);
          }}
        />
      )}
      {modal === 'csv' && (
        <CsvImportModal
          existing={items}
          onConfirm={(rows) => importCatalogRows(slug, rows)}
          onClose={(msg) => {
            setModal(null);
            flash(msg);
          }}
        />
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-16 z-50 flex justify-center px-4">
          <div className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
