import { suppress } from '../../src/modules/dashboard/dashboard.service';

describe('small-count suppression', () => {
  it('hides cells below the threshold', () => {
    const rows = [{ key: 'A', count: 4 }, { key: 'B', count: 5 }, { key: 'C', count: 40 }];
    expect(suppress(rows, 5).map((r) => r.key)).toEqual(['B', 'C']);
  });
});
