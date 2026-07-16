import { describe, expect, test } from 'bun:test';
import { createElement, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse as parseYaml } from 'yaml';
import { useVisualConfig } from '../src/hooks/useVisualConfig';
import { buildPublicUsageViewerURL } from '../src/services/api/usageAnalytics';

describe('public usage viewer', () => {
  test('builds anonymous endpoints outside the management API namespace', () => {
    expect(buildPublicUsageViewerURL('https://cpa.example/v0/management', 'usage-viewer')).toBe(
      'https://cpa.example/v0/public/usage-viewer'
    );
    expect(buildPublicUsageViewerURL('https://cpa.example/', '/usage-analytics')).toBe(
      'https://cpa.example/v0/public/usage-analytics'
    );
  });

  test('writes the explicit opt-in flag under remote-management', () => {
    function Harness() {
      const visualConfig = useVisualConfig();
      const [phase, setPhase] = useState(0);

      if (phase === 0) {
        visualConfig.setVisualValues({ rmPublicUsageViewer: true });
        setPhase(1);
      } else {
        return createElement(
          'pre',
          null,
          visualConfig.applyVisualChangesToYaml(
            'remote-management:\n  public-usage-viewer: false\n'
          )
        );
      }
      return null;
    }

    const markup = renderToStaticMarkup(createElement(Harness));
    const result = markup.slice('<pre>'.length, -'</pre>'.length);
    expect(parseYaml(result)).toEqual({
      'remote-management': { 'public-usage-viewer': true },
    });
  });
});
