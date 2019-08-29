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

import moment from 'moment';
import {MARCXML} from '@natlibfi/marc-record-serializers';
import {PROTOCOL_VERSION} from './constants';

export const generateErrorResponse = ({query, baseUrl, error}) => `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
	${generateRequestElement(baseUrl, query)}	
	<responseDate>${moment().toISOString(true)}</responseDate>
	<error code="${error}"/>
</OAI-PMH>`;

export const generateListMetadataFormatsResponse = ({query, results, baseUrl}) => `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
	${generateRequestElement(baseUrl, query)}	
	<responseDate>${moment().toISOString(true)}</responseDate>
	<ListMetadataFormats>	
		${results.reduce((acc, {prefix, schema, namespace}) => `${acc}<metadataFormat>
			<metadataPrefix>${prefix}</metadataPrefix>
			<schema>${schema}</schema>
		  <metadataNamespace>${namespace}</metadataNamespace>
		</metadataFormat>\n\t\t`, '')}	
	</ListMetadataFormats>
</OAI-PMH>`;

export const generateListSetsResponse = ({query, results, baseUrl}) => `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
	${generateRequestElement(baseUrl, query)}	
	<responseDate>${moment().toISOString(true)}</responseDate>
	<ListSets>	
		${results.reduce((acc, {spec, name}) => `${acc}<set>
			<setSpec>${spec}</setSpec>
			<setName>${name}</setName>
		</set>\n\t\t`, '')}	
	</ListSets>
</OAI-PMH>`;

export const generateIdentifyResponse = ({name, supportEmail, earliestTimestamp, baseUrl}) => `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
	${generateRequestElement(baseUrl)}	
	<responseDate>${moment().toISOString(true)}</responseDate>
	<Identify>
		<repositoryName>${name}</repositoryName>
		<baseURL>${baseUrl}</baseURL>
		<protocolVersion>${PROTOCOL_VERSION}</protocolVersion>
		<earliestTimestamp>${earliestTimestamp}</earliestTimestamp>
		<deletedRecord>persistent</deletedRecord>
		<granularity>YYYY-MM-DDThh:mm:ssZ</granularity>
		<adminEmail>${supportEmail}</adminEmail>
	</Identify>
</OAI-PMH>`;

export const generateListRecordsResponse = ({query, results, identifierPrefix, token, baseUrl, tokenExpirationTime}) => `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
	${generateRequestElement(baseUrl, query)}
	<responseDate>${moment().toISOString(true)}</responseDate>
	<ListRecords>
		${results.reduce((acc, r) => `${acc}<record>
			<header>
				<identifier>${identifierPrefix}/${r.id}</identifier>
				<datestamp>${r.time.toISOString(true)}</datestamp>
			</header>
			<metadata>
				${MARCXML.to(r.data, {omitDeclaration: true})}
			</metadata>
		</record>\n\t\t`, '')}
		${token === undefined ? '' : `<resumptionToken expirationDate="${tokenExpirationTime}">${token}</resumptionToken>`}
	</ListRecords>
</OAI-PMH>`;

export const generateListIdentifiersResponse = ({query, results, identifierPrefix, token, baseUrl, tokenExpirationTime}) => `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
	${generateRequestElement(baseUrl, query)}
	<responseDate>${moment().toISOString(true)}</responseDate>
	<ListIdentifiers>
		${results.reduce((acc, r) => `${acc}<record>
			<header>
				<identifier>${identifierPrefix}/${r.id}</identifier>
				<datestamp>${r.time.toISOString(true)}</datestamp>
			</header>
		</record>\n\t\t`, '')}
		${token === undefined ? '' : `<resumptionToken expirationDate="${tokenExpirationTime}">${token}</resumptionToken>`}
	</ListIdentifiers>
</OAI-PMH>`;

export const generateGetRecordResponse = ({query, results, baseUrl, identifierPrefix}) => `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
	${generateRequestElement(baseUrl, query)}
	<responseDate>${moment().toISOString(true)}</responseDate>
	<GetRecord>
		<record>
			<header>
				<identifier>${identifierPrefix}/${results.id}</identifier>
				<datestamp>${results.time.toISOString(true)}</datestamp>
			</header>
			<metadata>
				${MARCXML.to(results.data, {omitDeclaration: true})}
			</metadata>
		</record>
	</GetRecord>
</OAI-PMH>`;

function generateRequestElement(baseUrl, query = {}) {
	return `<request${generateAttr()}>${baseUrl}</request>`;

	function generateAttr() {
		return Object.entries(query)
			.sort((a, b) => {
				const {key: aKey} = a;
				const {key: bKey} = b;

				if (aKey === 'verb' || bKey === 'verb') {
					return -1;
				}

				return 0;
			})
			.reduce((acc, [key, value]) => `${acc} ${key}="${value}"`, '');
	}
}
