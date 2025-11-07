

import moment from 'moment';
import {clone} from '@natlibfi/melinda-commons';
import {createLogger} from '@natlibfi/melinda-backend-commons';
import {default as ApiError} from '../../api-error.js';
import {default as responseFactory} from './response.js';
import {parseResumptionToken, generateResumptionToken, errors} from '../../common.js';
import {default as contextFactory} from './context/index.js';
import {default as databaseFactory} from './db/index.js';
import {metadataFormats, requestDateStampFormats} from './constants.js';
import {sanitizeQueryParams} from './util.js';
import {v4 as uuid} from 'uuid';
import {default as createDebugLogger} from 'debug';

export default async ({
  contextOptions,
  pool, secretEncryptionKey, resumptionTokenTimeout,
  supportEmail, oaiIdentifierPrefix, sets,
  instanceUrl, maxResults, alephLibrary,
  socketTimeout
}) => {
  const logger = createLogger();
  const debug = createDebugLogger('@natlibfi/melinda-oai-pmh-provider/middleware');
  const debugDev = debug.extend('dev');
  const {
    generateErrorResponse, generateIdentifyResponse,
    generateListMetadataFormatsResponse, generateListSetsResponse,
    generateGetRecordResponse, generateListRecordsResponse, generateListIdentifiersResponse
  } = responseFactory({oaiIdentifierPrefix, supportEmail});

  logger.debug(`middleware`);
  const {repoName, isSupportedFormat, formatRecord} = contextFactory(contextOptions);
  const {getRecord, earliestTimestamp, listIdentifiers, listRecords} = await getMethods();

  return async (req, res, next) => {
    req.logLabel = uuid();
    const {query: {verb}, logLabel} = req;
    logger.debug(`${logLabel} Handling request from ${req.ip} : ${JSON.stringify(req.query)}`);
    // Will be fixed in Node.js 13 (https://github.com/nodejs/node/issues/31378)
    req.socket.setTimeout(socketTimeout);

    try {
      await handle();
      debugDev(`DONE?`)
    } catch (err) {
      logger.debug(`middleware/error, sending apiError: ${JSON.stringify(err)}`);
      return err instanceof ApiError ? sendResponse({error: err.code}) : next(err);
    }

    async function handle() {
      debugDev(`--- Handle.`);
      res.type('application/xml');

      const error = await validateParams();
      debugDev(`validateParams result: ${error} (undefined = no errors)`);

      return error ? sendResponse({error}) : call();

      async function validateParams() {
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
          debugDev(`LIST REQUEST`);
          return validateListRequest();
        }

        return errors.badVerb;

        function validateIdentify() {
          if (numParams > 1) {
            return errors.badArgument;
          }
        }

        async function validateGetRecord() {
          if (numParams === 3) {
            const error = await validateMetadataPrefix(req.query.metadataPrefix);

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

        async function validateListMetadataFormats() {
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

        async function validateListSets() {
          if (numParams === 2 && req.query.resumptionToken === undefined) {
            return errors.badArgument;
          }
        }

        async function validateListRequest() {
          debugDev(`validateListRequest for ${numParams} parameters`);
          if (numParams >= 2) {
            if (req.query.resumptionToken === undefined) {
              debugDev(`No resumption token`);
              const match = metadataFormats.find(({prefix}) => prefix === req.query.metadataPrefix);
              debugDev(match);
              if (match) {
                debugDev(`We have match`);
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

          async function validateOptParams() {
            debugDev(`validateOptParams`);
            const hasInvalid = await validate();

            if (hasInvalid) {
              return errors.badArgument;
            }

            async function validate() {
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

        async function validateMetadataPrefix(target) {
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
        debugDev(`--- Call.`);
        const params = await getParams();
        const result = await wrap();
        logger.debug(`${logLabel} Sending result`);
        return sendResponse({result, params});

        async function getParams() {
          debugDev(`--- getParams ---`);
          debugDev(JSON.stringify(req.query));
          debugDev('resumptionToken' in req.query);
          const parsedParams = 'resumptionToken' in req.query ? await parseToken() : await parse(req.query);
          debugDev(`parsedParams: ${JSON.stringify(parsedParams)}`);
          const params = {logLabel, ...parsedParams};
          return needsDb() ? addConnection() : params;

          async function parseToken() {
            logger.debug(`${logLabel} Parsing resumptionToken for parameters`);
            debugDev(`parseToken`);
            const params = await parseResumptionToken({
              secretEncryptionKey, verb,
              token: req.query.resumptionToken,
              sets
            });
            debugDev(`We got params from parseToken: ${params}`);
            // DEVELOP: We should probably validate also params from resumptionToken?

            return parse(params);
          }

          async function parse(params) {
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
            logger.debug(`${logLabel} Requesting a new connection from the pool...`);

            const connection = await pool.getConnection();

            logger.debug(`${logLabel} Connection acquired!`);

            return {...params, connection};
          }
        }

        function wrap() {
          debugDev(`--- Wrap.`);
          logger.debug(`${logLabel} wrap`);
          return new Promise(async (resolve, reject) => {
            req.on('close', handleClose);
            const method = getMethod();

            try {
              const result = await method(params);
              // is result circular?
              //logger.silly(`${logLabel} Result: ${JSON.stringify(result)}`);
              //if (!result || result.length === 0) {
              //  throw error('Empty result!');
              //}
              //logger.debug(`${logLabel} We got result ${result.length}`);
              await closeConnection();
              return resolve(result);
            } catch (err) {
              logger.error(`${logLabel} ERROR! ${err.message}`);
              await closeConnection();
              return reject(err);
            }

            function getMethod() {
              return {
                Identify: () => {},
                ListSets: listSets,
                ListMetadataFormats: listMetadataFormats,
                GetRecord: getRecord,
                ListIdentifiers: listIdentifiers,
                ListRecords: listRecords
              }[verb];
            }

            async function closeConnection() {
              logger.debug(`${logLabel} Closing connection: closeConnection`);
              if (req.aborted === false && params.connection) {
                await params.connection.break();
                return params.connection.close({drop: true});
              }
            }

            async function handleClose() {
              logger.info(`${logLabel} Request cancelled (handleClose)`);

              if (params.connection) {
                try {
                  logger.debug(`${logLabel} Closing connection: handleClose`);
                  await params.connection.break();
                  await params.connection.close({drop: true});
                  return resolve();
                } catch (err) {
                  //logger.debug(`${logLabel} ${err}`);
                  if (isExpectedOracleError(err) === false) {
                    return reject(err);
                  }
                  logger.debug(`${logLabel} Connection already closed`);
                  return resolve();
                }
              }

              return resolve();

              function isExpectedOracleError(err) {
                // Does new oracle dep use different error messages?
                logger.debug(`${logLabel} We got error: ${err.message}`);
                if ('message' in err && (/^DPI-1010: not connected/u).test(err.message)) {
                  return true;
                }
                // Try handling Error: ORA-01013: user requested cancel of current operation here too
                if ('message' in err && (/^ORA-01013: user requested cancel of current operation/u).test(err.message)) {
                  return true;
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
      debugDev(`Send response`);
      const requestUrl = instanceUrl;
      const query = sanitizeQueryParams(clone(req.query)); // njsscan-ignore: express_xss

      if (error) {
        const payload = await generateErrorResponse({logLabel, query, requestUrl, error});
        debugDev(`Payload from error: ${payload}`);
        return res.send(`${payload}`);
      }

      const payload = await generatePayload(verb);
      debugDev(`Payload from verb: ${payload}`);
      return res.send(payload);

      function generatePayload(method) {
        if (method === 'Identify') {
          return generateIdentifyResponse({logLabel, requestUrl, query, repoName, earliestTimestamp});
        }

        if (method === 'ListMetadataFormats') {
          if (result.length === 0) {
            return generateErrorResponse({logLabel, query, requestUrl, error: errors.idDoesNotExist});
          }

          return generateListMetadataFormatsResponse({logLabel, requestUrl, query, formats: result});
        }

        if (method === 'ListSets') {
          return generateListSetsResponse({logLabel, requestUrl, query, sets: result});
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
          const {records, cursor, timeCursor, lastCount} = result;
          debugDev(`listResources`);
          debugDev(`records: ${records ? records.length : 'no records'}, cursor: ${cursor}, timeCursor: ${timeCursor}, lastCount: ${lastCount}`);

          if (records.length === 0) {
            debugDev(`No records!`);
            return generateErrorResponse({logLabel, query, requestUrl, error: errors.noRecordsMatch});
          }


          if (cursor || timeCursor) {
            debugDev(`Records and cursor/timeCursor`);
            const newCount = calculateNewCount();
            debugDev(`newCount: ${newCount}`);

            const {token, tokenExpirationTime} = generateResumptionToken({
              ...params,
              lastCount: newCount,
              secretEncryptionKey, resumptionTokenTimeout, cursor, timeCursor
            });

            return callback({
              logLabel, requestUrl, query, records, token, tokenExpirationTime,
              format: params.metadataPrefix,
              // why we have named this cursor?
              cursor: lastCount || 0
            });
          }

          return callback({
            logLabel, requestUrl, query, records, format: params.metadataPrefix,
            // why we have named this cursor?
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
    logger.debug(`getMethods`);
    const connection = await pool.getConnection();
    const methods = await databaseFactory({connection, sets, maxResults, alephLibrary, formatRecord});

    await connection.close();
    return methods;
  }
};
