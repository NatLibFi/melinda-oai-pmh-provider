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

export const PROTOCOL_VERSION = '2.0';

export const RESPONSE_TIMESTAMP_FORMAT = 'YYYY-MM-DDTHH:mm:ss[Z]';
export const TOKEN_EXPIRATION_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSSZ';
export const DB_TIME_FORMAT = 'YYYYMMDDHHmmss';

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

export const QUERY_PARAMETERS = [
	'verb',
	'set',
	'metadataPrefix',
	'from',
	'until',
	'resumptionToken'
];

export const METADATA_FORMATS = [
	{
		prefix: 'marc',
		schema: 'https://www.loc.gov/standards/marcxml/schema/MARC21slim.xsd',
		namespace: 'http://www.loc.gov/MARC21/slim'
	},
	{
		prefix: 'marc_melinda_v1',
		schema: 'https://schemas.melinda.kansalliskirjasto.fi/marc-melinda-v1.xsd',
		namespace: 'https://melinda.kansalliskirjasto.fi/marc-melinda/v1'
	}
];

export const REPOSITORY_NAMES = {
	bib: 'Melinda OAI-PMH provider for bibliographic records',
	'aut-names': 'Melinda OAI-PMH provider for authority name records',
	'aut-subjects': 'Melinda OAI-PMH provider for authority subject records'
};
