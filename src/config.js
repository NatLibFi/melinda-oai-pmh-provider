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

const {readEnvironmentVariable, generateEncryptionKey} = Utils;

export const HTTP_PORT = readEnvironmentVariable('HTTP_PORT', {defaultValue: '8080'});
export const ENABLE_PROXY = readEnvironmentVariable('ENABLE_PROXY', {defaultValue: ''});

export const SECRET_ENCRYPTION_KEY = readEnvironmentVariable('SECRET_ENCRYPTION_KEY', {
	defaultValue: generateEncryptionKey(),
	hideDefaultValue: true
});

// 15 min
export const RESUMPTION_TOKEN_TIMEOUT = readEnvironmentVariable('RESUMPTION_TOKEN_TIMEOUT', {defaultValue: '900000'});

export const MAX_RESULTS = readEnvironmentVariable('MAX_RESULTS', {defaultValue: '100'});
export const OAI_IDENTIFIER_PREFIX = readEnvironmentVariable('OAI_IDENTIFIER_PREFIX', {defaultValue: 'oai:melinda.kansalliskirjasto.fi'});
export const INSTANCE_URL = readEnvironmentVariable('INSTANCE_URL');
export const SUPPORT_EMAIL = readEnvironmentVariable('SUPPORT_EMAIL');

export const Z106_LIBRARY = readEnvironmentVariable('Z106_LIBRARY');
export const Z115_LIBRARY = readEnvironmentVariable('Z115_LIBRARY');

export const ORACLE_USERNAME = readEnvironmentVariable('ORACLE_USERNAME');
export const ORACLE_PASSWORD = readEnvironmentVariable('ORACLE_PASSWORD');
export const ORACLE_CONNECT_STRING = readEnvironmentVariable('ORACLE_CONNECT_STRING');
