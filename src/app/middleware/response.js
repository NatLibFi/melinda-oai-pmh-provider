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

import moment from 'moment';
import {MarcRecord} from '@natlibfi/marc-record';
import {MARCXML} from '@natlibfi/marc-record-serializers';
import {createLogger} from '@natlibfi/melinda-backend-commons';
import {Parser, Builder} from 'xml2js';
import marcToDC from './marc-to-dc';
import {errors} from './../../common';

export default ({oaiIdentifierPrefix, supportEmail}) => {
  const logger = createLogger();

  return {
    generateErrorResponse, generateListMetadataFormatsResponse, generateListSetsResponse,
    generateIdentifyResponse, generateListRecordsResponse, generateListIdentifiersResponse,
    generateGetRecordResponse
  };

  function generateErrorResponse({requestUrl, query, error}) {
    return generateResponse({requestUrl, query: formatQuery(), payload: {
      error: {
        $: {code: error}
      }
    }});

    function formatQuery() {
      return Object.entries(query)
        .filter(([key]) => error === errors.badVerb ? key === 'verb' === false : true)
        .reduce((a, [k, v]) => ({...a, [k]: v}), {});
    }
  }

  async function generateGetRecordResponse({requestUrl, query, format, ...record}) {
    return generateResponse({requestUrl, query, payload: {
      GetRecord: {record: [await generateRecordObject({...record, format})]}
    }});
  }

  function generateIdentifyResponse({requestUrl, query, repoName, earliestTimestamp}) {
    return generateResponse({requestUrl, query, payload: {
      Identify: {
        repositoryName: [repoName],
        baseURL: [requestUrl.split('?')[0]],
        procotolVersion: ['2.0'],
        earliestTimestamp: [earliestTimestamp.toISOString()],
        deletedRecord: ['transient'],
        granularity: ['YYYY-MM-DDthh:mm:ssZ'],
        adminEmail: [supportEmail]
      }
    }});
  }

  function generateListMetadataFormatsResponse({requestUrl, query, formats}) {
    return generateResponse({requestUrl, query, payload: {
      ListMetadataFormats: {
        metadataFormat: formats.map(({prefix, schema, namespace}) => ({
          metadataPrefix: [prefix],
          schema: [schema],
          metadataNamespace: [namespace]
        }))
      }
    }});
  }

  function generateListSetsResponse({requestUrl, query, sets}) {
    return generateResponse({requestUrl, query, payload: {
      ListSets: {
        set: sets.map(({spec, name, description}) => ({
          setSpec: [spec],
          setName: [name],
          setDescription: [description]
        }))
      }
    }});
  }

  async function generateListRecordsResponse({requestUrl, query, token, tokenExpirationTime, cursor, records, format}) {
    return generateResponse({requestUrl, query, payload: {
      ListRecords: await generateListResourcesResponse({records, token, tokenExpirationTime, cursor, format})
    }});
  }

  async function generateListIdentifiersResponse({requestUrl, query, token, tokenExpirationTime, cursor, records, format}) {
    return generateResponse({requestUrl, query, payload: {
      ListIdentifiers: await generateListResourcesResponse({records, token, tokenExpirationTime, cursor, format})
    }});
  }

  function generateResponse({requestUrl, query, payload}) {
    const obj = generate();
    return toXML();

    function generate() {
      return {
        'OAI-PMH': {
          $: {
            xmlns: 'http://www.openarchives.org/OAI/2.0/',
            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
            'xsi:schemaLocation': 'http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd'
          },
          request: [generateRequestObject()],
          responseDate: [moment().toISOString()],
          ...payload
        }
      };

      function generateRequestObject() {
        return {
          _: requestUrl,
          $: getAttr()
        };

        function getAttr() {
          // Disabling ESLint rule because sort is actually just modifying the object entries of the variable and not the original
          return Object.entries(query) // eslint-disable-line functional/immutable-data
            .sort(sort)
            .reduce((acc, [key, value]) => ({...acc, [key]: value}), {});

          function sort([a], [b]) {
            /* istanbul ignore if: Not going to predict the ordering of keys, so only one of the if expressions will be met */
            if (a === 'verb') {
              return -1;
            }

            if (b === 'verb') {
              return 1;
            }

            return 0;
          }
        }
      }
    }

    function toXML() {
      try {
        return new Builder({
          xmldec: {
            version: '1.0',
            encoding: 'UTF-8',
            standalone: false
          },
          renderOpts: {
            pretty: true,
            indent: '\t'
          }
        }).buildObject(obj);
      } catch (err) {
        /* istanbul ignore next: Too generic to test */
        throw new Error(`XML conversion failed ${err.message} for query: ${JSON.stringify(query)}`);
      }
    }
  }

  async function generateListResourcesResponse({records, token, tokenExpirationTime, cursor, format}) {
    const obj = {
      record: await Promise.all(records.map(record => generateRecordObject({...record, format})))
    };

    if (token) {
      return {
        ...obj,
        resumptionToken: {
          $: genAttr(),
          _: token
        }
      };
    }

    return obj;

    function genAttr() {
      const expirationDate = tokenExpirationTime.toISOString();
      return {expirationDate, cursor};
    }
  }

  async function generateRecordObject({time, id, record, isDeleted, format}) {
    const obj = {
      header: [
        {
          identifier: [`${oaiIdentifierPrefix}/${id}`],
          datestamp: time.toISOString()
        }
      ]
    };

    if (isDeleted) {
      return {
        ...obj,
        header: [
          {
            ...obj.header[0],
            $: {
              status: 'deleted'
            }
          }
        ]
      };
    }

    if (record) {
      return {
        ...obj,
        metadata: [await transformRecord()]
      };
    }

    return obj;

    function transformRecord() {
      const str = transform();

      return new Promise((resolve, reject) => {
        new Parser().parseString(str, (err, obj) => err ? /* istanbul ignore next: Too generic to test */ reject(err) : resolve(obj));
      });

      function transform() {
        const formattedRecord = removeInvalidCharacters();
        return doTransformation();

        // See https://github.com/Leonidas-from-XIV/node-xml2js/issues/547
        function removeInvalidCharacters() {
          const PATTERN = /[\0-\x08\x0B\f\x0E-\x1F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/gu; // eslint-disable-line no-control-regex
          const newRecord = MarcRecord.clone(record, {subfieldValues: false});

          newRecord.fields.forEach(field => {
            if (field.value) {
              if (PATTERN.test(field.value)) {
                logger.log('warn', `Record ${id} contains invalid characters. Cleaning up...`);
                field.value = field.value.replace(PATTERN, ''); // eslint-disable-line functional/immutable-data
                return;
              }

              return;
            }

            field.subfields.forEach(subfield => {
              if (PATTERN.test(subfield.value)) {
                logger.log('warn', `Record ${id} contains invalid characters. Cleaning up...`);
                subfield.value = subfield.value.replace(PATTERN, ''); // eslint-disable-line functional/immutable-data
                return;
              }

              return;
            });
          });

          return newRecord;
        }

        function doTransformation() {
          if (format === 'oai_dc') {
            return marcToDC(formattedRecord);
          }

          return MARCXML.to(formattedRecord, {omitDeclaration: true});
        }
      }
    }
  }
};
