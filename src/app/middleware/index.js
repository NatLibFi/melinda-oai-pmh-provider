
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
import {clone} from '@natlibfi/melinda-commons';
import {createLogger} from '@natlibfi/melinda-backend-commons';
import ApiError from '../../api-error';
import responseFactory from './response';
import {parseResumptionToken, generateResumptionToken, errors} from '../../common';
import contextFactory from './context';
import databaseFactory from './db';
import {metadataFormats, requestDateStampFormats} from './constants';
import {sanitizeQueryParams} from './util';

export default async ({
  contextOptions,
  pool, secretEncryptionKey, resumptionTokenTimeout,
  supportEmail, oaiIdentifierPrefix, sets,
  instanceUrl, maxResults, alephLibrary,
  socketTimeout
}) => {
  const logger = createLogger();
  const {
    generateErrorResponse, generateIdentifyResponse,
    generateListMetadataFormatsResponse, generateListSetsResponse,
    generateGetRecordResponse, generateListRecordsResponse, generateListIdentifiersResponse
  } = responseFactory({oaiIdentifierPrefix, supportEmail});

  logger.debug(`middleware`);
  const {repoName, isSupportedFormat, formatRecord} = contextFactory(contextOptions);
  const {getRecord, earliestTimestamp, listIdentifiers, listRecords} = await getMethods();

  return async (req, res, next) => {
    const {query: {verb}} = req;
    logger.debug(`Handling request: ${JSON.stringify(req.query)}`);
    // Will be fixed in Node.js 13 (https://github.com/nodejs/node/issues/31378)
    req.socket.setTimeout(socketTimeout);

    try {
      await handle();
    } catch (err) {
      return err instanceof ApiError ? sendResponse({error: err.code}) : next(err);
    }

    function handle() {
      res.type('application/xml');

      const error = validateParams();

      return error ? sendResponse({error}) : call();

      function validateParams() {
        const numParams = Object.keys(req.query).length;

        if (verb === 'Identify') {
          return validateIdentify();
        }

        if (verb === 'GetRecord') {
          return validateGetRecord();
        }

        if (verb === 'ListMetadataFormats') {
          return validateListMetadataFormats();
        }

        if (verb === 'ListSets') {
          return validateListSets();
        }

        if (['ListIdentifiers', 'ListRecords'].includes(verb)) {
          return validateListRequest();
        }

        return errors.badVerb;

        function validateIdentify() {
          if (numParams > 1) {
            return errors.badArgument;
          }
        }

        function validateGetRecord() {
          if (numParams === 3) {
            const error = validateMetadataPrefix(req.query.metadataPrefix);

            if (error) {
              return error;
            }

            if (isSupportedFormat(req.query.metadataPrefix) === false) {
              return errors.cannotDisseminateFormat;
            }

            if (isInvalidRecordIdentifier(req.query.identifier)) {
              return errors.idDoesNotExist;
            }

            return;
          }

          return errors.badArgument;
        }

        function validateListMetadataFormats() {
          if (numParams === 2) {
            if ('identifier' in req.query) {
              if (isInvalidRecordIdentifier(req.query.identifier)) {
                return errors.idDoesNotExist;
              }

              return;
            }

            return errors.badArgument;
          }
        }

        function validateListSets() {
          if (numParams === 2 && req.query.resumptionToken === undefined) {
            return errors.badArgument;
          }
        }

        function validateListRequest() {
          if (numParams >= 2) {
            if (req.query.resumptionToken === undefined) {
              const match = metadataFormats.find(({prefix}) => prefix === req.query.metadataPrefix);

              if (match) {
                if (isSupportedFormat(req.query.metadataPrefix) === false) {
                  return errors.noRecordsMatch;
                }

                return validateOptParams();
              }

              return errors.cannotDisseminateFormat;
            }

            return;
          }

          return errors.badArgument;

          function validateOptParams() {
            const hasInvalid = validate();

            if (hasInvalid) {
              return errors.badArgument;
            }

            function validate() {
              return Object.entries(req.query)
                .filter(([k]) => ['verb', 'metadataPrefix'].includes(k) === false)
                .some(([key, value]) => {
                  if (['from', 'until'].includes(key)) {
                    return validateTime();
                  }

                  if (key === 'set') {
                    return validateSet();
                  }

                  return true;

                  function validateSet() {
                    return sets.find(({spec}) => spec === value) === undefined;
                  }

                  function validateTime() {
                    const time = moment(value, requestDateStampFormats);
                    return time.isValid() === false;
                  }
                });
            }
          }
        }

        function validateMetadataPrefix(target) {
          const match = metadataFormats.find(({prefix}) => prefix === target);

          if (match === undefined) {
            return errors.cannotDisseminateFormat;
          }
        }

        function isInvalidRecordIdentifier(identifier) {
          return identifier.startsWith(`${oaiIdentifierPrefix}/`) === false;
        }
      }

      async function call() {
        const params = await getParams();
        const result = await wrap();

        return sendResponse({result, params});

        function getParams() {
          const params = 'resumptionToken' in req.query ? parseToken() : parse(req.query);
          return needsDb() ? addConnection() : params;

          function parseToken() {
            const params = parseResumptionToken({
              secretEncryptionKey, verb,
              token: req.query.resumptionToken
            });

            return parse(params);
          }

          function parse(params) {
            return Object.entries(params)
              .reduce((acc, [key, value]) => {
                if (['from', 'until'].includes(key)) {
                  return {...acc, [key]: parseTime(value)};
                }

                if (key === 'identifier') {
                  return {...acc, [key]: parseIdentifier(value)};
                }

                return {...acc, [key]: value};

                function parseTime(stamp) {
                  return moment.utc(stamp, requestDateStampFormats);
                }

                function parseIdentifier() {
                // Strip prefix (Slice takes offset and the length of the prefix which doesn't include the separator)
                  return value.slice(oaiIdentifierPrefix.length + 1);
                }
              }, {});
          }

          function needsDb() {
            return ['GetRecord', 'ListIdentifiers', 'ListRecords'].includes(verb);
          }

          async function addConnection() {
            logger.log('debug', 'Requesting a new connection from the pool...');

            const connection = await pool.getConnection();

            logger.log('debug', 'Connection acquired!');

            return {...params, connection};
          }
        }

        function wrap() {
          logger.debug(`wrap`);
          return new Promise(async (resolve, reject) => { // eslint-disable-line no-async-promise-executor
            req.on('close', handleClose);
            const method = getMethod();

            try {
              const result = await method(params);
              if (!result || result.length === 0) {
                throw error('Empty result!');
              }
              logger.debug(`We got result ${result.length}`);
              await closeConnection();
              return resolve(result);
            } catch (err) {
              await closeConnection();
              return reject(err);
            }

            function getMethod() {
              return {
                Identify: () => {}, // eslint-disable-line no-empty-function
                ListSets: listSets,
                ListMetadataFormats: listMetadataFormats,
                GetRecord: getRecord,
                ListIdentifiers: listIdentifiers,
                ListRecords: listRecords
              }[verb];
            }

            async function closeConnection() {
              logger.debug(`Closing connection: closeConnection`);
              if (req.aborted === false && params.connection) {
                await params.connection.break();
                return params.connection.close({drop: true});
              }
            }

            async function handleClose() {
              logger.log('info', 'Request cancelled (handleClose)');

              if (params.connection) { // eslint-disable-line functional/no-conditional-statements
                try {
                  await params.connection.break();
                  await params.connection.close({drop: true});
                  return resolve();
                } catch (err) {
                  logger.debug(err);
                  if (isExpectedOracleError(err) === false) {
                    return reject(err);
                  }
                  logger.debug(`Connection already closed`);
                  return resolve();
                }
              }

              return resolve();

              function isExpectedOracleError(err) {
                // Does new oracle dep use different error messages?
                if ('message' in err && (/^DPI-1010: not connected/u).test(err.message)) {
                  return err.message;
                }
                return 'message' in err && (/^NJS-003: invalid connection/u).test(err.message);
              }
            }
          });
        }

        function listMetadataFormats() {
          return metadataFormats.filter(({prefix}) => isSupportedFormat(prefix));
        }

        function listSets() {
          return sets.map(({spec, name, description}) => ({spec, name, description}));
        }
      }
    }

    async function sendResponse({error, result, params}) {
      const requestUrl = instanceUrl;
      const query = sanitizeQueryParams(clone(req.query)); // njsscan-ignore: express_xss

      if (error) {
        return res.send(await generateErrorResponse({query, requestUrl, error}));
      }

      return res.send(await generatePayload(verb));

      function generatePayload(method) {
        if (method === 'Identify') {
          return generateIdentifyResponse({requestUrl, query, repoName, earliestTimestamp});
        }

        if (method === 'ListMetadataFormats') {
          if (result.length === 0) {
            return generateErrorResponse({query, requestUrl, error: errors.idDoesNotExist});
          }

          return generateListMetadataFormatsResponse({requestUrl, query, formats: result});
        }

        if (method === 'ListSets') {
          return generateListSetsResponse({requestUrl, query, sets: result});
        }

        if (method === 'ListRecords') {
          return listResources(generateListRecordsResponse);
        }

        if (method === 'ListIdentifiers') {
          return listResources(generateListIdentifiersResponse);
        }

        if (method === 'GetRecord') {
          if (result) {
            return generateGetRecordResponse({
              requestUrl, query,
              format: params.metadataPrefix,
              ...result
            });
          }

          return generateErrorResponse({requestUrl, query, error: errors.idDoesNotExist});
        }

        function listResources(callback) {
          const {records, cursor, lastCount} = result;

          if (records.length === 0) {
            return generateErrorResponse({query, requestUrl, error: errors.noRecordsMatch});
          }


          if (cursor) {
            const newCount = calculateNewCount();

            const {token, tokenExpirationTime} = generateResumptionToken({
              ...params,
              lastCount: newCount,
              secretEncryptionKey, resumptionTokenTimeout, cursor
            });

            return callback({
              requestUrl, query, records, token, tokenExpirationTime,
              format: params.metadataPrefix,
              cursor: lastCount || 0
            });
          }

          return callback({
            requestUrl, query, records, format: params.metadataPrefix,
            cursor: lastCount || 0
          });

          function calculateNewCount() {
            const count = lastCount || 0;
            return count + records.length;
          }
        }
      }
    }
  };

  async function getMethods() {
    logger.debug(`getMethods - next getting connection`);
    const connection = await pool.getConnection();
    const methods = await databaseFactory({connection, sets, maxResults, alephLibrary, formatRecord});

    await connection.close();
    return methods;
  }
};
