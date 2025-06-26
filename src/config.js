

import {readFileSync} from 'fs';
import {parseBoolean} from '@natlibfi/melinda-commons';
import {readEnvironmentVariable, generateEncryptionKey} from '@natlibfi/melinda-backend-commons';

const alephLibrary = readEnvironmentVariable('ALEPH_LIBRARY');

export const oracleUsername = readEnvironmentVariable('ORACLE_USERNAME');
export const oraclePassword = readEnvironmentVariable('ORACLE_PASSWORD');
export const oracleConnectString = readEnvironmentVariable('ORACLE_CONNECT_STRING');
export const httpPort = readEnvironmentVariable('HTTP_PORT', {defaultValue: 8080, format: v => Number(v)});
export const enableProxy = readEnvironmentVariable('ENABLE_PROXY', {defaultValue: false, format: parseBoolean});

export const ipWhiteList = readEnvironmentVariable('IP_WHITELIST', {defaultValue: [], format: v => JSON.parse(v)});

export const middlewareOptions = {
  alephLibrary,
  instanceUrl: readEnvironmentVariable('INSTANCE_URL'),
  oaiIdentifierPrefix: readEnvironmentVariable('OAI_IDENTIFIER_PREFIX'),
  supportEmail: readEnvironmentVariable('SUPPORT_EMAIL'),
  socketTimeout: readEnvironmentVariable('SOCKET_TIMEOUT', {defaultValue: 0, format: v => Number(v)}),
  secretEncryptionKey: readEnvironmentVariable('SECRET_ENCRYPTION_KEY', {defaultValue: generateEncryptionKey(), hideDefaultValue: true}),
  maxResults: readEnvironmentVariable('MAX_RESULTS', {defaultValue: 100, format: v => Number(v)}),
  // 15 min
  resumptionTokenTimeout: readEnvironmentVariable('RESUMPTION_TOKEN_TIMEOUT', {defaultValue: '900000'}),
  sets: readEnvironmentVariable('SETS_FILE', {format: v => JSON.parse(readFileSync(v, 'utf8'))}),
  contextOptions: {
    alephLibrary,
    contextName: readEnvironmentVariable('CONTEXT_NAME'),
    melindaPrefix: readEnvironmentVariable('MELINDA_PREFIX'),
    isPrivileged: readEnvironmentVariable('IS_PRIVILEGED', {defaultValue: false, format: parseBoolean})
  }
};


