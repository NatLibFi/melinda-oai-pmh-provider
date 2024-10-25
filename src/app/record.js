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


import {AlephSequential} from '@natlibfi/marc-record-serializers';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-oai-pmh-provider/record');
const debugDev = debug.extend('dev');
const debugDevData = debugDev.extend('data');


export function parseRecord({data, validate = false, noFailValidation = false, logLabel}) {
  debugDev(`${logLabel} parseRecord: create AlephSequential from dbResult data`);
  const buffer = Buffer.from(data);
  return iterate();

  function iterate(offset = 0, lines = []) {
    if (offset + 4 > buffer.length) {
      const str = lines.join('\n');
      return transformRecord(str);
    }

    const length = Number(buffer.toString('utf8', offset, offset + 4));
    const line = buffer.toString('utf8', offset + 4, offset + 4 + length);

    return iterate(offset + 4 + length, lines.concat(format(line)));

    // Format Aleph-database string to Aleph Sequential
    function format(l) {
      const start = l.substr(0, 5);
      const end = l.substr(6);
      return `000000000 ${start} L ${end}`;
    }

    function transformRecord(str) {
      debugDev(`${logLabel} transformRecord: create marcRecord object from AlephSequential`);
      // Create record from AlephSequential string
      const record = AlephSequential.from(str, getValidationOptions());

      format();

      return record;

      // This could be done in marc-record-js / marc-record-serializers
      function format() {
        debugDev(`${logLabel} format whitespace in fixed fields`);
        record.leader = formatWhitespace(record.leader); // eslint-disable-line functional/immutable-data
        // we handle only fields with values = fixed length fields
        record.fields.filter(({value}) => value).forEach(({value}) => formatWhitespace(value));

        function formatWhitespace(value) {
          return value.replace(/\^/gu, ' ');
        }
      }

      function getValidationOptions() {
        // Note that marc-record-js has currently more validationOptions than these
        // noFailValidation: return record and possible validationErrors
        if (validate) {
          // ignore missing subfieldValues anyways
          return {subfieldValues: false, noFailValidation};
        }
        // DEVELOP: Note that marc-record-js has more validationOptions than these
        return {fields: false, subfields: false, subfieldValues: false, noFailValidation};
      }
    }
  }
}

// Create record in Aleph-db-text form from record object, used for tests
export function dbDataStringFromRecord(record) {
  debugDev(`dbDataStringFromRecord: create record data `);
  const seq = AlephSequential.to(record, {subfieldValues: false});
  debugDev(`Created AlephSequential from record`);
  debugDevData(seq);
  debugDev(`Creating dbResult like string from AlephSequential`);

  const buffers = seq.split('\n').slice(0, -1).map(str => {
    const data = str.slice(10);
    const start = data.slice(0, 5);
    // Offset is after is first 5 chars  + `L `
    const end = data.slice(8);
    // We need a buffer so that the total number of bytes can calculated
    const dataBuffer = Buffer.from(`${start}L${end}`);
    const lengthPrefix = String(dataBuffer.length).padStart(4, '0');

    return Buffer.concat([Buffer.from(lengthPrefix), dataBuffer]);
  });

  return Buffer.concat(buffers);
}
