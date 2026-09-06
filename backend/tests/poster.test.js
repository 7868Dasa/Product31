import { describe, it, expect } from 'vitest';
import { buildQrPng, buildPosterPdf, shopUrl } from '../src/modules/shops/poster.service.js';

describe('shopUrl', () => {
  it('builds the /s/:slug deep link', () => {
    expect(shopUrl('K7M2Q9AB')).toMatch(/\/s\/K7M2Q9AB$/);
  });
});

describe('buildQrPng', () => {
  it('returns a PNG buffer', async () => {
    const png = await buildQrPng('K7M2Q9AB');
    expect(Buffer.isBuffer(png)).toBe(true);
    // PNG magic bytes
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});

describe('buildPosterPdf', () => {
  it('returns a PDF buffer with the shop name and URL', async () => {
    const pdf = await buildPosterPdf({
      slug: 'K7M2Q9AB',
      shopName: 'Sri Murugan Stores',
      address: 'Gandhi Road, Kallakurichi',
    });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.subarray(-6).toString().trim()).toContain('EOF');
  });
});
