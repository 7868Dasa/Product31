import { useState, useMemo, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, AlertTriangle, ChevronDown } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { Modal } from '../Modal.jsx';
import {
  parseCatalogCsv,
  buildSampleCsv,
  downloadTextFile,
  catalogKey,
  CSV_COLUMNS,
} from '../../lib/csv.js';

export function CsvImportModal({ existing = [], onConfirm, onClose }) {
  const { t } = useI18n();
  const [stage, setStage] = useState('pick'); // pick | preview
  const [result, setResult] = useState(null); // { valid, invalid }
  const [fileName, setFileName] = useState('');
  const [showSkipped, setShowSkipped] = useState(false);
  const inputRef = useRef(null);

  const existingKeys = useMemo(
    () => new Set(existing.map((x) => catalogKey(x.name, x.pack_size))),
    [existing],
  );

  const counts = useMemo(() => {
    if (!result) return { add: 0, update: 0 };
    let add = 0;
    let update = 0;
    for (const r of result.valid) {
      if (existingKeys.has(catalogKey(r.name, r.pack_size))) update += 1;
      else add += 1;
    }
    return { add, update };
  }, [result, existingKeys]);

  async function handleFile(file) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setResult(parseCatalogCsv(text));
    setShowSkipped(false);
    setStage('preview');
  }

  const pickBody = (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">{t('csv.pickHint')}</p>

      <button
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-xl2 border-2 border-dashed border-sand bg-white px-4 py-10 text-center active:bg-sand"
      >
        <Upload size={28} className="text-primary" />
        <span className="text-base font-semibold">{t('csv.choose')}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <button
        onClick={() => downloadTextFile('product31-catalog-template.csv', buildSampleCsv())}
        className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-sand py-3 font-semibold text-ink-soft active:bg-sand"
      >
        <Download size={18} /> {t('csv.sample')}
      </button>

      <div className="rounded-xl2 bg-sand/60 px-3 py-2 text-xs text-ink-soft">
        <code className="break-words">{CSV_COLUMNS.join(', ')}</code>
      </div>
    </div>
  );

  const previewBody = result && (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm font-bold">
        <span className="rounded-full bg-go/15 px-3 py-1 text-go">
          {t('csv.summaryAdd', { n: counts.add })}
        </span>
        <span className="rounded-full bg-primary-tint px-3 py-1 text-primary-dark">
          {t('csv.summaryUpdate', { n: counts.update })}
        </span>
        {result.invalid.length > 0 && (
          <span className="rounded-full bg-stop/15 px-3 py-1 text-stop">
            {t('csv.summarySkip', { n: result.invalid.length })}
          </span>
        )}
      </div>

      {result.valid.length === 0 ? (
        <p className="rounded-xl2 bg-stop/10 px-4 py-3 text-sm font-semibold text-stop">
          {t('csv.nothingValid')}
        </p>
      ) : (
        <ul className="divide-y divide-sand rounded-xl2 border-2 border-sand bg-white">
          {result.valid.map((r, i) => {
            const isUpdate = existingKeys.has(catalogKey(r.name, r.pack_size));
            return (
              <li key={i} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{r.name}</span>{' '}
                  <span className="text-ink-soft">{r.pack_size}</span>
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
                      isUpdate ? 'bg-primary-tint text-primary-dark' : 'bg-go/15 text-go'
                    }`}
                  >
                    {isUpdate ? t('csv.tagUpdate') : t('csv.tagNew')}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-ink-soft">
                  ₹{r.price} · {r.stock_qty}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {result.invalid.length > 0 && (
        <div className="rounded-xl2 border-2 border-sand bg-white">
          <button
            onClick={() => setShowSkipped((s) => !s)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-bold text-stop"
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={15} /> {t('csv.skippedTitle')} ({result.invalid.length})
            </span>
            <ChevronDown size={16} className={showSkipped ? 'rotate-180' : ''} />
          </button>
          {showSkipped && (
            <ul className="divide-y divide-sand border-t border-sand">
              {result.invalid.map((r, i) => (
                <li key={i} className="px-3 py-2 text-xs text-ink-soft">
                  {t('csv.skippedRow', { line: r.line, name: r.name, reason: r.reason })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        onClick={() => setStage('pick')}
        className="text-sm font-semibold text-primary underline"
      >
        {t('csv.back')}
      </button>
    </div>
  );

  return (
    <Modal
      title={
        <span className="inline-flex items-center gap-2">
          <FileSpreadsheet size={20} /> {stage === 'pick' ? t('csv.title') : t('csv.previewTitle')}
        </span>
      }
      size="lg"
      onClose={() => onClose(null)}
      footer={
        stage === 'preview' && (
          <div className="flex gap-2">
            <button
              onClick={() => onClose(null)}
              className="flex-1 rounded-full border-2 border-sand py-3 font-semibold text-ink-soft active:bg-sand"
            >
              {t('csv.cancel')}
            </button>
            <button
              disabled={!result || result.valid.length === 0}
              onClick={() => {
                onConfirm(result.valid);
                onClose(t('csv.done', { n: result.valid.length }));
              }}
              className="flex-[2] rounded-full bg-primary py-3 font-semibold text-white active:bg-primary-dark disabled:opacity-50"
            >
              {t('csv.confirm', { n: result?.valid.length ?? 0 })}
            </button>
          </div>
        )
      }
    >
      {stage === 'pick' ? pickBody : previewBody}
    </Modal>
  );
}
