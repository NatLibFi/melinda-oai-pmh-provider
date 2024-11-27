

import moment from 'moment';
import {MarcRecord} from '@natlibfi/marc-record';
import {MARCXML} from '@natlibfi/marc-record-serializers';
import {createLogger} from '@natlibfi/melinda-backend-commons';
import {Parser, Builder} from 'xml2js';
import marcToDC from './marc-to-dc';
import {errors} from './../../common';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-oai-pmh-provider/response');
const debugDev = debug.extend('dev');
const debugDevData = debugDev.extend('data');

export default ({oaiIdentifierPrefix, supportEmail}) => {
  const logger = createLogger();

  return {
    generateErrorResponse, generateListMetadataFormatsResponse, generateListSetsResponse,
    generateIdentifyResponse, generateListRecordsResponse, generateListIdentifiersResponse,
    generateGetRecordResponse
  };

  function generateErrorResponse({logLabel = '', requestUrl, query, error}) {
    return generateResponse({logLabel, requestUrl, query: formatQuery(), payload: {
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

  async function generateGetRecordResponse({logLabel = '', requestUrl, query, format, ...record}) {
    debugDev(`${logLabel} generateGetRecordResponse`);
    return generateResponse({logLabel, requestUrl, query, payload: {
      GetRecord: {record: [await generateRecordObject({...record, format}, {logLabel})]}
    }});
  }

  function generateIdentifyResponse({logLabel = '', requestUrl, query, repoName, earliestTimestamp}) {
    debugDev(`${logLabel} generateIdentifyResponse`);
    return generateResponse({logLabel, requestUrl, query, payload: {
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

  function generateListMetadataFormatsResponse({logLabel = '', requestUrl, query, formats}) {
    return generateResponse({logLabel, requestUrl, query, payload: {
      ListMetadataFormats: {
        metadataFormat: formats.map(({prefix, schema, namespace}) => ({
          metadataPrefix: [prefix],
          schema: [schema],
          metadataNamespace: [namespace]
        }))
      }
    }});
  }

  function generateListSetsResponse({logLabel = '', requestUrl, query, sets}) {
    return generateResponse({logLabel, requestUrl, query, payload: {
      ListSets: {
        set: sets.map(({spec, name, description}) => ({
          setSpec: [spec],
          setName: [name],
          setDescription: [description]
        }))
      }
    }});
  }

  async function generateListRecordsResponse({logLabel = '', requestUrl, query, token, tokenExpirationTime, cursor, timeCursor, records, format}) {
    return generateResponse({logLabel, requestUrl, query, payload: {
      ListRecords: await generateListResourcesResponse({logLabel, records, token, tokenExpirationTime, cursor, timeCursor, format})
    }});
  }

  async function generateListIdentifiersResponse({logLabel = '', requestUrl, query, token, tokenExpirationTime, cursor, timeCursor, records, format}) {
    return generateResponse({logLabel, requestUrl, query, payload: {
      ListIdentifiers: await generateListResourcesResponse({logLabel, records, token, tokenExpirationTime, cursor, timeCursor, format})
    }});
  }

  function generateResponse({logLabel = '', requestUrl, query, payload}) {
    debugDev(`${logLabel} generateResponse`);
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

  async function generateListResourcesResponse({logLabel = '', records, token, tokenExpirationTime, cursor, timeCursor, format}) {
    debugDev(`${logLabel} generateListResourcesResponse`);
    const obj = {
      record: await Promise.all(records.map(record => generateRecordObject({logLabel, ...record, format})))
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
      return {expirationDate, cursor, timeCursor};
    }
  }

  async function generateRecordObject({time, id, record, isDeleted, format, logLabel = ''}) {
    debugDev(`${logLabel} generateRecordObject`);
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
      debugDev(`${logLabel} transformRecord`);
      const str = transform();

      return new Promise((resolve, reject) => {
        new Parser().parseString(str, (err, obj) => err ? /* istanbul ignore next: Too generic to test */ reject(err) : resolve(obj));
      });

      function transform() {
        const formattedRecord = removeInvalidCharacters();
        return doTransformation();

        // DEVELOP: do we need to do this here? marc-record-js does not accept controlcharacters since v7.3.0 if validationOptions: {noControlCharacters: true}
        // See https://github.com/Leonidas-from-XIV/node-xml2js/issues/547
        function removeInvalidCharacters() {
          debugDev(`${logLabel} removeInvalidCharacters`);
          const newRecord = MarcRecord.clone(record, {subfieldValues: false, noControlCharacters: true, noFailValidation: true});
          const validationErrors = newRecord.getValidationErrors();
          debugDevData(JSON.stringify(newRecord));
          debugDev(`${logLabel} validationErrors: ${JSON.stringify(validationErrors)}`);

          // Clean record only if we got validationErrors from our marcRecord
          if (validationErrors.length > 0) {
            debugDev(`${logLabel} We got validationErrors, cleaning up record`);
            const PATTERN = /[\0-\x08\x0B\f\x0E-\x1F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/gu; // eslint-disable-line no-control-regex
            newRecord.fields.forEach(field => {
              if (field.value) {
                if (PATTERN.test(field.value)) {
                  logger.warn(`${logLabel} Record ${id} contains invalid characters. Cleaning up...`);
                  field.value = field.value.replace(PATTERN, ''); // eslint-disable-line functional/immutable-data
                  return;
                }

                return;
              }

              field.subfields.forEach(subfield => {
                if (PATTERN.test(subfield.value)) {
                  logger.warn(`${logLabel} Record ${id} contains invalid characters. Cleaning up...`);
                  subfield.value = subfield.value.replace(PATTERN, ''); // eslint-disable-line functional/immutable-data
                  return;
                }

                return;
              });
            });
            // return cleaned record
            return newRecord;
          }
          debugDev(`${logLabel} No validationErrors, returning original record`);
          return record;
        }

        function doTransformation() {
          if (format === 'oai_dc') {
            debugDev(`${logLabel} Record to DC (${format})`);
            return marcToDC(formattedRecord);
          }

          debugDev(`${logLabel} Record to MARCXML (${format})`);
          return MARCXML.to(formattedRecord, {omitDeclaration: true});
        }
      }
    }
  }
};
