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

import {INSTANCE_URL} from './config';

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

export const XML_DOCUMENT = `<?xml version="1.0" encoding="UTF-8"?> 
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" 
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/
		 http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
		 <request>${INSTANCE_URL}</request>
</OAI-PMH>`;
