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

import {MarcRecord} from '@natlibfi/marc-record';

export function stripPrivateFields(record) {
  const newRecord = MarcRecord.clone(record);
  newRecord.get(/^CAT$/u).forEach(f => newRecord.removeField(f));
  return newRecord;
}

export function formatBib(params) {
  const prefixReplaceCodes = ['w'];
  const nonStandardSubfields = [{tagPattern: /.*/u, codes: ['9']}];

  return formatRecord({
    ...params,
    prefixReplaceCodes,
    nonStandardSubfields
  });
}

export function formatAut(params) {
  const prefixReplaceCodes = ['0', '1'];
  const nonStandardSubfields = [
    {tagPattern: /.*/u, codes: ['9']},
    {tagPattern: /^1../u, codes: ['0', '2']},
    {tagPattern: /^4../u, codes: ['0', '2', '7']},
    {tagPattern: /^5../u, codes: ['2']}
  ];

  return formatRecord({
    ...params,
    prefixReplaceCodes,
    nonStandardSubfields
  });
}

export function formatRecord({
  record, id, metadataPrefix,
  oldPrefix, newPrefix,
  prefixReplaceCodes,
  nonStandardSubfields
}) {
  const newRecord = MarcRecord.clone(record);

  formatAleph();
  replacePrefixes();

  return metadataPrefix === 'melinda_marc' ? newRecord : formatStandard();

  function formatAleph() {
    handle003();
    handle035();

    function handle003() {
      newRecord.insertField({
        tag: '003',
        value: newPrefix
      });
    }

    function handle035() {
      removeExisting();

      newRecord.insertField({
        tag: '035',
        ind1: ' ',
        ind2: ' ',
        subfields: [
          {
            code: 'a',
            value: `(${newPrefix})${id}`
          }
        ]
      });

      function removeExisting() {
        newRecord.get(/^035$/u)
          .filter(prefixFilter)
          .forEach(f => newRecord.removeField(f));

        function prefixFilter(field) {
          return field.subfields.some(({code, value}) => code === 'a' && new RegExp(`^\\((${newPrefix}|${oldPrefix})\\)`, 'u').test(value));
        }
      }
    }
  }

  function formatStandard() {
    removeFields();
    removeSubfields();

    return newRecord;

    function removeFields() {
      // Remove all fields with non-numeric tags
      newRecord.get(/[^0-9]+/u).forEach(f => newRecord.removeField(f));
    }

    function removeSubfields() {
      nonStandardSubfields.forEach(({tagPattern, codes}) => newRecord.getDatafields()
        .filter(({tag}) => tagPattern.test(tag))
        .forEach(field => {
          field.subfields
            .filter(({code}) => codes.includes(code))
            .forEach(sf => newRecord.removeSubfield(sf, field));
        }));

      // Remove fields with no subfields as a result of the previous operation
      newRecord.fields
        .filter(({subfields}) => subfields && subfields.length === 0)
        .forEach(f => newRecord.removeField(f));
    }
  }

  // Replace prefix in all specified subfields
  function replacePrefixes() {
    newRecord.getDatafields()
      .forEach(field => {
        field.subfields
          .filter(({code}) => prefixReplaceCodes.includes(code))
          .forEach(subfield => {
            const pattern = `(${oldPrefix})`;
            const replacement = `(${newPrefix})`;
            subfield.value = subfield.value.replace(pattern, replacement); // eslint-disable-line functional/immutable-data
          });
      });
  }
}
