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
import {INSTANCE_URL} from './config';
import {MARCXML} from '@natlibfi/marc-record-serializers';
import {OAI_IDENTIFIER_PREFIX} from './constants';

export const generateErrorResponse = ({verb, error}) => `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
		xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
		xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/
		http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
                <request verb="${verb}">${INSTANCE_URL}</request>
				<responseDate>${moment().toISOString(true)}</responseDate>
				<error code="${error}"/>
</OAI-PMH>`;

export const generateListRecordsResponse = ({verb, records}) => `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
		xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
		xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/
		http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
                <request verb="${verb}" metadataPrefix="marc">${INSTANCE_URL}</request>
				<responseDate>${moment().toISOString(true)}</responseDate>
				${records.map(r => `<record>
                <header>
                  <identifier>${OAI_IDENTIFIER_PREFIX}${r.id}</identifier>
                  <datestamp>${r.time.toISOString(true)}</datestamp>
                </header>
                <metadata>
                  ${MARCXML.to(r.data, {declaration: false})}
                </metadata>
              </record>`)}
</OAI-PMH>`;
