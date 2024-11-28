

import moment from 'moment';
import {encryptString, decryptString} from '@natlibfi/melinda-backend-commons';
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
  const value = generateValue();
  const token = encryptString({key: secretEncryptionKey, value, algorithm: 'aes-256-cbc'});
  debugDev(`resumptionToken: value: ${value}}`);
  debugDev(`resumptionToken: token: ${token}}`);
  debugDev(`resumptionToken: tokenExpirationTime: ${tokenExpirationTime}}`);


  return {token, tokenExpirationTime};

  function generateResumptionExpirationTime() {
    const currentTimeObj = typeof currentTime === 'string' ? /* istanbul ignore next: Exists only for the CLI which won't be tested */ moment(currentTime) : currentTime;
    return currentTimeObj.add(resumptionTokenTimeout, 'milliseconds');
  }

  function generateValue() {
    const expirationTime = tokenExpirationTime.toISOString();

    return `${expirationTime};${cursor};${metadataPrefix};${from ? from.toISOString() : ''};${until ? until.toISOString() : ''};${set || ''};${lastCount || 0};${timeCursor || ''}`;
  }
}

export function parseResumptionToken({secretEncryptionKey, verb, token, ignoreError = false}) {
  //const logger = createLogger();
  const debug = createDebugLogger('@natlibfi/melinda-oai-pmh-provider/parseResumptionToken');
  const debugDev = debug.extend('dev');
  debugDev(`resumptionToken: token ${token}`);
  const str = decryptToken();
  debugDev(`resumptionToken: string ${str}`);
  const [expirationTime, cursor, metadataPrefix, from, until, set, lastCountArg, timeCursor] = str.split(/;/gu);
  const lastCount = Number(lastCountArg);
  const expires = moment(expirationTime);

  if (expires.isValid() && moment().isBefore(expires)) {
    return filter({cursor, timeCursor, metadataPrefix, set, from, until, lastCount});
  }

  /* istanbul ignore if: Exists only for the CLI which won't be tested */
  if (ignoreError) {
    return filter({cursor, timeCursor, metadataPrefix, set, from, until, lastCount});
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

}
