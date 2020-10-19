/**
* Copyright 2019-2020 University Of Helsinki (The National Library Of Finland)
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

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
