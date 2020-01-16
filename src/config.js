/**
 * Copyright 2019 University Of Helsinki (The National Library Of Finland)
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

import {Utils} from '@natlibfi/melinda-commons';

const {readEnvironmentVariable, generateEncryptionKey, parseBoolean} = Utils;

export const contextName = readEnvironmentVariable('CONTEXT_NAME');
export const alephLibrary = readEnvironmentVariable('ALEPH_LIBRARY');
export const melindaPrefix = readEnvironmentVariable('MELINDA_PREFIX');
export const setsFile = readEnvironmentVariable('SETS_FILE');
export const instanceUrl = readEnvironmentVariable('INSTANCE_URL');
export const oaiIdentifierPrefix = readEnvironmentVariable('OAI_IDENTIFIER_PREFIX');

export const isPrivileged = readEnvironmentVariable('IS_PRIVILEGED', {defaultValue: false, format: parseBoolean});

export const httpPort = readEnvironmentVariable('HTTP_PORT', {defaultValue: '8080'});
export const enableProxy = readEnvironmentVariable('ENABLE_PROXY', {defaultValue: false, format: parseBoolean});
export const socketTimeout = readEnvironmentVariable('SOCKET_TIMEOUT', {defaultValue: undefined, format: v => Number(v)});

export const secretEncryptionKey = readEnvironmentVariable('SECRET_ENCRYPTION_KEY', {defaultValue: generateEncryptionKey(), hideDefaultValue: true});

// 15 min
export const resumptionTokenTimeout = readEnvironmentVariable('RESUMPTION_TOKEN_TIMEOUT', {defaultValue: '900000'});

export const maxResults = readEnvironmentVariable('MAX_RESULTS', {defaultValue: 100, format: v => Number(v)});
export const supportEmail = readEnvironmentVariable('SUPPORT_EMAIL');

export const oracleUsername = readEnvironmentVariable('ORACLE_USERNAME');
export const oraclePassword = readEnvironmentVariable('ORACLE_PASSWORD');
export const oracleConnectString = readEnvironmentVariable('ORACLE_CONNECT_STRING');
