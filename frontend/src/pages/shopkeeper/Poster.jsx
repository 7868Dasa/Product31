import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { useStore } from '../../store.jsx';
import { demoShop } from '../../lib/mockData.js';
import { shopShareUrl } from '../../lib/qr.js';
import { QrImage } from '../../components/QrImage.jsx';

/**
 * Printable shop poster (spec §11.1). The page IS the poster; the toolbar is
 * hidden on print. "Print / Save as PDF" uses the browser's print dialog —
 * zero dependencies, works on every OS. Production also serves a server-side
 * pdfkit file at GET /api/v1/shops/:slug/poster.pdf.
 */
export function Poster() {
  const { slug } = useParams();
  const { t } = useI18n();
  const { myShop } = useStore();

  const shop = useMemo(() => {
    if (myShop?.slug === slug) return myShop;
    return demoShop(slug);
  }, [myShop, slug]);

  if (!shop) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-lg text-ink-soft">{t('error.SHOP_NOT_FOUND')}</p>
        <Link to="/shop" className="mt-4 inline-block font-semibold text-primary underline">
          {t('onb.goDashboard')}
        </Link>
      </div>
    );
  }

  const url = shopShareUrl(shop.slug);

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @media print {
          .p31-noprint { display: none !important; }
          @page { margin: 12mm; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="p31-noprint sticky top-0 flex items-center justify-between border-b border-sand bg-cream px-4 py-3">
        <Link to="/shop" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft">
          <ArrowLeft size={16} /> {t('onb.goDashboard')}
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-white active:bg-primary-dark"
        >
          <Printer size={18} /> {t('poster.print')}
        </button>
      </div>

      <div className="mx-auto flex max-w-lg flex-col items-center px-8 py-12 text-center text-ink">
        <h1 className="text-4xl font-extrabold">{shop.shop_name}</h1>
        <p className="mt-3 text-xl text-ink-soft">{t('poster.tagline')}</p>

        <QrImage
          text={url}
          size={900}
          alt="Shop QR code"
          className="my-8 aspect-square w-full max-w-sm border-2 border-ink"
        />

        <p className="text-base font-bold tracking-wide">{url}</p>
        {shop.address && <p className="mt-6 text-sm text-ink-soft">{shop.address}</p>}
        <p className="mt-8 text-xs text-ink-soft">{t('poster.footer')}</p>
      </div>
    </div>
  );
}
