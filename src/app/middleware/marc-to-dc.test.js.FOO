

import assert from 'node:assert';
import {beforeEach, afterEach} from 'node:test';
import {READERS} from '@natlibfi/fixura';
import {MarcRecord} from '@natlibfi/marc-record';
import generateTests from '@natlibfi/fixugen';
import transform, {__RewireAPI__ as RewireAPI} from './marc-to-dc.js';

generateTests({
  path: [import.meta.dirname, '..', '..', '..', 'test-fixtures', 'marc-to-dc'],
  recurse: false,
  hooks: {
    beforeEach: () => RewireAPI.__Rewire__('moment', () => ({
      toISOString: () => '2000-01-01T00:00:00.000Z'
    })),
    afterEach: () => RewireAPI.__ResetDependency__('moment')
  },
  callback: ({getFixture}) => {
    const inputData = getFixture({components: ['input.json'], reader: READERS.JSON});
    const expectedRecord = getFixture('output.xml');
    const record = new MarcRecord(inputData);
    assert.deepEqual(transform(record), expectedRecord);
    //expect(transform(record)).to.equal(expectedRecord);
  }
});
