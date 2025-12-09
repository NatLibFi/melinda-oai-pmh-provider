

import assert from 'node:assert';
import {READERS} from '@natlibfi/fixura';
import {MarcRecord} from '@natlibfi/marc-record';
import {default as generateTests} from '@natlibfi/fixugen';
import {default as transform } from './marc-to-dc.js';

generateTests({
  path: [import.meta.dirname, '..', '..', '..', 'test-fixtures', 'marc-to-dc'],
  recurse: false,
  useMetadataFile: true,
  callback: ({getFixture}) => {
    const inputData = getFixture({components: ['input.json'], reader: READERS.JSON});
    console.log(`Running test for marc-to-json`);
    const expectedRecord = getFixture('output.xml');
    const record = new MarcRecord(inputData);
    assert.deepEqual(transform(record), expectedRecord);
    //expect(transform(record)).to.equal(expectedRecord);
  }
});
