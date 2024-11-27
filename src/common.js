

import moment from 'moment';
import {encryptString, decryptString, createLogger} from '@natlibfi/melinda-backend-commons';
import ApiError from './api-error';

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
  const logger = createLogger();
  const tokenExpirationTime = generateResumptionExpirationTime();
  const value = generateValue();
  const token = encryptString({key: secretEncryptionKey, value, algorithm: 'aes-256-cbc'});
  logger.debug(`resumptionToken: value: ${value}}`);
  logger.debug(`resumptionToken: token: ${token}}`);
  logger.debug(`resumptionToken: tokenExpirationTime: ${tokenExpirationTime}}`);


  return {token, tokenExpirationTime};

  function generateResumptionExpirationTime() {
    const currentTimeObj = typeof currentTime === 'string' ? /* istanbul ignore next: Exists only for the CLI which won't be tested */ moment(currentTime) : currentTime;
    return currentTimeObj.add(resumptionTokenTimeout, 'milliseconds');
  }

  function generateValue() {
    const expirationTime = tokenExpirationTime.toISOString();

    return `${expirationTime};${cursor};${timeCursor || ''};${metadataPrefix};${from ? from.toISOString() : ''};${until ? until.toISOString() : ''};${set || ''};${lastCount || 0}`;
  }
}

export function parseResumptionToken({secretEncryptionKey, verb, token, ignoreError = false}) {
  const logger = createLogger();
  logger.debug(`resumptionToken: token ${token}`);
  const str = decryptToken();
  logger.debug(`resumptionToken: string ${str}`);
  const [expirationTime, cursor, timeCursor, metadataPrefix, from, until, set, lastCountArg] = str.split(/;/gu);
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
