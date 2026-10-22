import { test, expect, Page } from '@playwright/test';

// Provider failure states and alert sound, covered by intercepting the USGS
// feed. BMKG and JMA calls are left untouched (they only affect their own
// panels), except in the offline tests where nothing remote may succeed.

const USGS = '**/earthquake.usgs.gov/**';

function usgsFeature(id: string, mag: number, place: string, lon: number, lat: number, depthKm: number, time: number) {
  return {
    type: 'Feature',
    id,
    properties: {
      mag, place, time, updated: time, tz: null,
      url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
      felt: null, cdi: null, mmi: null, alert: null, status: 'reviewed',
      tsunami: 0, sig: Math.round(mag * 100), net: 'us', code: id,
      ids: `,${id},`, sources: ',us,', types: ',origin,phase-data,',
      nst: null, dmin: null, rms: 0.5, gap: 40, magType: 'mw',
      type: 'earthquake', title: `M ${mag} - ${place}`,
    },
    geometry: { type: 'Point', coordinates: [lon, lat, depthKm] },
  };
}

function usgsCollection(features: ReturnType<typeof usgsFeature>[]) {
  return {
    type: 'FeatureCollection',
    metadata: { generated: Date.now(), count: features.length, status: 200, title: 'USGS All Earthquakes, Past Day' },
    features,
  };
}

const NOW = Date.now();
const PALU = usgsFeature('test-palu', 6.4, '12 km SSE of Palu, Indonesia', 119.9, -0.9, 10, NOW - 5 * 60_000);
const AMBON = usgsFeature('test-ambon', 5.2, '8 km W of Ambon, Indonesia', 128.1, -3.7, 22, NOW - 25 * 60_000);

async function stubAudio(page: Page) {
  await page.addInitScript(() => {
    const calls: string[] = [];
    (window as unknown as { __soundCalls: string[] }).__soundCalls = calls;
    class FakeParam {
      value = 0;
      setValueAtTime() {}
      exponentialRampToValueAtTime() {}
    }
    class FakeNode {
      connect(d: unknown) { return d; }
    }
    class FakeOsc extends FakeNode {
      type = '';
      frequency = new FakeParam();
      start() { calls.push('osc'); }
      stop() {}
    }
    class FakeGain extends FakeNode {
      gain = new FakeParam();
    }
    function FakeCtx(this: unknown) {
      calls.push('ctx');
      return {
        currentTime: 0,
        destination: {},
        createOscillator: () => new FakeOsc(),
        createGain: () => new FakeGain(),
        resume: () => { calls.push('resume'); return Promise.resolve(); },
        close: () => { calls.push('close'); return Promise.resolve(); },
      };
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
  });
}

async function soundCalls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __soundCalls: string[] }).__soundCalls);
}

test('USGS network failure shows OFFLINE with an honest empty state', async ({ page }) => {
  await page.route(USGS, (r) => r.abort());
  await page.goto('/');
  await expect(page.getByRole('status').first()).toContainText('OFFLINE', { timeout: 30_000 });
  await expect(page.getByText(/feed unreachable — no data/)).toBeVisible();
  await expect(page.getByText('No data in current selection').first()).toBeVisible();
  await expect(page.locator('footer')).toContainText(/Feed status \(USGS[^)]*\): OFFLINE/);
});

test('USGS HTTP 500 surfaces the server error, not a fake live state', async ({ page }) => {
  await page.route(USGS, (r) => r.fulfill({ status: 500, body: 'boom' }));
  await page.goto('/');
  await expect(page.getByRole('status').first()).toContainText('OFFLINE', { timeout: 30_000 });
  await expect(page.locator('footer')).toContainText('USGS feed returned HTTP 500');
});

test('STALE keeps last good data when a later refresh fails', async ({ page }) => {
  let fail = false;
  await page.route(USGS, (r) => (fail ? r.abort() : r.fulfill({ json: usgsCollection([PALU, AMBON]) })));
  await page.goto('/');
  const feed = page.getByRole('region', { name: 'Earthquake event feed' });
  await expect(feed.getByRole('listitem').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status').first()).toContainText('LIVE');

  fail = true;
  await page.getByRole('button', { name: 'Refresh now' }).click();
  await expect(page.getByRole('status').first()).toContainText('STALE', { timeout: 30_000 });
  await expect(page.getByText(/showing last good data/)).toBeVisible();
  await expect(feed.getByRole('listitem')).toHaveCount(2);
  await expect(feed).toContainText('Palu');
});

test('a triggered alert rule plays a beep and logs the alert', async ({ page }) => {
  await stubAudio(page);
  await page.route(USGS, (r) => r.fulfill({ json: usgsCollection([PALU]) }));
  await page.goto('/');
  const log = page.getByRole('log', { name: 'Triggered alerts' });
  await expect(log).toContainText('Palu', { timeout: 30_000 });
  await expect(log).toContainText('Magnitude 6.0+');
  await expect.poll(() => soundCalls(page)).toContain('ctx');
  const calls = await soundCalls(page);
  expect(calls.filter((c) => c === 'osc')).toHaveLength(2); // two-tone beep, one per alert batch
  await expect(page.getByRole('button', { name: 'Toggle alert sound' })).toHaveAttribute('aria-pressed', 'true');
});

test('muted alert sound stays silent while alerts still fire', async ({ page }) => {
  await stubAudio(page);
  await page.addInitScript(() => localStorage.setItem('quakewatch:alert-sound', 'off'));
  await page.route(USGS, (r) => r.fulfill({ json: usgsCollection([PALU]) }));
  await page.goto('/');
  const log = page.getByRole('log', { name: 'Triggered alerts' });
  await expect(log).toContainText('Palu', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Toggle alert sound' })).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(1_000); // give a wrongly-played beep a chance to register
  expect(await soundCalls(page)).toHaveLength(0);
});
