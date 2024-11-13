

import {expect} from 'chai';
import {READERS} from '@natlibfi/fixura';
import {MarcRecord} from '@natlibfi/marc-record';
import generateTests from '@natlibfi/fixugen';
import transform, {__RewireAPI__ as RewireAPI} from './marc-to-dc';

generateTests({
  path: [__dirname, '..', '..', '..', 'test-fixtures', 'marc-to-dc'],
  recurse: false,
  mocha: {
    beforeEach: () => RewireAPI.__Rewire__('moment', () => ({
      toISOString: () => '2000-01-01T00:00:00.000Z'
    })),
    afterEach: () => RewireAPI.__ResetDependency__('moment')
  },
  callback: ({getFixture}) => {
    const inputData = getFixture({components: ['input.json'], reader: READERS.JSON});
    const expectedRecord = getFixture('output.xml');
    const record = new MarcRecord(inputData);
    expect(transform(record)).to.equal(expectedRecord);
  }
});
