

import moment from 'moment';
import {encryptString, decryptString} from '@natlibfi/melinda-backend-commons';
import {metadataFormats, requestDateStampFormats} from './app/middleware/constants';
// import { createLogger } from '@natlibfi/melinda-backend-commons/';
import ApiError from './api-error';
import createDebugLogger from 'debug';

export const errors = {
  badArgument: 'badArgument',
  badVerb: 'badVerb',
  cannotDisseminateFormat: 'cannotDisseminateFormat',
  idDoesNotExist: 'idDoesNotExist',
  noRecordsMatch: 'noRecordsMatch',
  noMetadataFormats: 'noMetadataFormats',
  badResumptionToken: 'badResumptionToken'
};

export function generateResumptionToken({
  secretEncryptionKey, resumptionTokenTimeout,
  cursor, timeCursor, metadataPrefix, from, until, set, lastCount,
  currentTime = moment()
}) {
  //const logger = createLogger();
  const debug = createDebugLogger(`@natlibfi/melinda-oai-pmh-provider/generateResumptionToken`);
  const debugDev = debug.extend('dev');
  const tokenExpirationTime = generateResumptionExpirationTime();
  debugDev(`resumptionToken: tokenExpirationTime: "${tokenExpirationTime}"`);
  const value = generateValue();
  debugDev(`resumptionToken: value: ${value}`);
  const token = encryptString({key: secretEncryptionKey, value, algorithm: 'aes-256-cbc'});
  debugDev(`resumptionToken: token: ${token}`);

  return {token, tokenExpirationTime};

  function generateResumptionExpirationTime() {
    debugDev(`Generate expirationTime`);
    debugDev(`Current time: ${JSON.stringify(currentTime)}`);
    debugDev(`ResumptionTokenTimeout: ${resumptionTokenTimeout}`);
    const currentTimeObj = typeof currentTime === 'string' ? /* istanbul ignore next: Exists only for the CLI which won't be tested */ moment(currentTime) : currentTime;
    return currentTimeObj.add(resumptionTokenTimeout, 'milliseconds');
  }

  function generateValue() {
    const expirationTime = tokenExpirationTime.toISOString();

    return `${expirationTime};${cursor};${metadataPrefix || ''};${from ? from.toISOString() : ''};${until ? until.toISOString() : ''};${set || ''};${lastCount || 0};${timeCursor || ''}`;
  }
}

export function parseResumptionToken({secretEncryptionKey, verb, token, ignoreError = false, sets}) {
  //const logger = createLogger();
  const debug = createDebugLogger('@natlibfi/melinda-oai-pmh-provider/parseResumptionToken');
  const debugDev = debug.extend('dev');
  debugDev(`resumptionToken: token ${token}`);
  const str = decryptToken();
  debugDev(`resumptionToken: string ${str}`);
  const [expirationTime, cursor, metadataPrefix, from, until, set, lastCountArg, timeCursor] = str.split(/;/gu);

  const lastCount = Number(lastCountArg);
  const expires = moment(expirationTime);
  debugDev(`Expires: ${expires}`);
  const params = filter({cursor, timeCursor, metadataPrefix, set, from, until, lastCount});
  debugDev(`params from resumptionToken: ${JSON.stringify(params)}`);

  /* istanbul ignore if: Exists only for the CLI which won't be tested */
  if (ignoreError) {
    return {...params};
  }

  validateParamsFromToken(params);

  if (expires.isValid() && moment().isBefore(expires)) {
    return {...params};
  }

  throw new ApiError({verb, code: errors.badResumptionToken});

  function decryptToken() {
    try {
      const decoded = decodeURIComponent(token);
      return decryptString({key: secretEncryptionKey, value: decoded, algorithm: 'aes-256-cbc'});
    } catch (_) {
      throw new ApiError({verb, code: errors.badResumptionToken});
    }
  }

  // Remove params with undefined value
  function filter(params) {
    return Object.entries(params)
      .filter(([, v]) => v)
      .reduce((acc, [k, v]) => ({...acc, [k]: v}), {});
  }

  function validateParamsFromToken(params) {
    const hasInvalid = validate(params);
    debugDev(`Validation hasInvalid: ${hasInvalid}`);
    if (hasInvalid) {
      throw new ApiError({verb, code: errors.badResumptionToken});
    }

    function validate(params) {
      return Object.entries(params)
        .filter(([k]) => ['verb'].includes(k) === false)
        .some(([key, value]) => {
          debugDev(`Validating: ${key} : ${value}`);

          if (['from', 'until'].includes(key)) {
            return validateTime();
          }

          if (key === 'set') {
            return validateSet();
          }

          if (key === 'metadataPrefix') {
            return validateMetadataPrefix();
          }

          if (key === 'cursor') {
            // check that cursor is a positive integer
            return Number(cursor).isNan || Number(cursor) < 0 || !Number.isInteger(Number(cursor));
          }

          if (key === 'timeCursor') {
            // check that timeCursor is a positive integer
            return Number(timeCursor).isNan || Number(timeCursor) < 0 || !Number.isInteger(Number(timeCursor));
          }

          if (key === 'lastCount') {
            // check that lastCount is a positive integer
            return lastCount.isNan || lastCount < 0 || !Number.isInteger(lastCount);
          }

          return true;

          function validateSet() {
            return sets.find(({spec}) => spec === value) === undefined;
          }

          function validateTime() {
            return moment(value, requestDateStampFormats).isValid() === false;
          }

          function validateMetadataPrefix() {
            return metadataFormats.find(({prefix}) => prefix === value) === undefined;
          }
        });

    }
  }
}


