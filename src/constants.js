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

import {PROVIDER_RESOURCE} from './config';

export const ROW_LIMIT = 100;

export const ERRORS = {
	BAD_ARGUMENT: 'badArgument',
	BAD_RESUMPTION_TOKEN: 'badResumptionToken',
	BAD_VERB: 'badVerb',
	CANNOT_DISSEMINATE_FORMAT: 'cannotDisseminateFormat',
	ID_DOES_NOT_EXIST: 'idDoesNotExist',
	NO_RECORDS_MATCH: 'noRecordsMatch',
	NO_METADATA_FORMATS: 'noMetadataFormats',
	NO_SET_HIERARCHY: 'noSetHierarchy'
};

export const DB_TIME_FORMAT = 'YYYYMMDDHHmmss';

export const OAI_IDENTIFIER_PREFIX = `oai:melinda.kansalliskirjasto.fi:${PROVIDER_RESOURCE}/`;
