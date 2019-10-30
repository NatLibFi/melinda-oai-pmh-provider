
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

import Langs from 'langs';
import moment from 'moment';
import {Builder} from 'xml2js';

export function fromMARC21(record, {omitDeclaration = true} = {}) {
	const elements = getElements();
	const obj = {
		'oai_dc:dc': {
			$: {
				'xmlns:oai_dc': 'http://www.openarchives.org/OAI/2.0/oai_dc/',
				'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
				'xsi:schemaLocation': 'http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd'
			},
			...elements
		}
	};

	return build(obj, omitDeclaration);

	function getElements() {
		const title = {'dc:title': getTitle()};
		const language = {'dc:language': getLanguage()};
		const date = {'dc:date': getDate()};

		return [title, language, date].filter(identity).reduce((acc, obj) => {
			return {...acc, ...obj};
		}, {});

		function getTitle() {
			const fields = record.get(/^245$/);
			return fields.length === 0 ? '' : fields[0].subfields.reduce(toStr, '');

			function toStr(acc, {value}) {
				return `${acc}${value}`;
			}
		}

		function getLanguage() {
			const fields = record.get(/^008$/);

			if (fields.length > 0) {
				const code = fields[0].value.slice(35, 38);
				const result = Langs.where('2', code);
				return result['1'];
			}
		}

		function getDate() {
			const fields = record.get(/^008$/);

			if (fields.length > 0) {
				const timeStr = fields[0].value.slice(0, 6);
				return moment(timeStr, 'YYMMDD').toISOString(true);
			}
		}

		function identity(obj) {
			// Remove entries with undefined values
			return Object.values(obj)[0];
		}
	}

	function build(obj, omitDeclaration = false) {
		try {
			const opts = {
				renderOpts: {
					pretty: true,
					indent: '\t'
				}
			};

			const builder = new Builder(omitDeclaration ? opts : {
				...opts,
				xmldec: {
					version: '1.0',
					encoding: 'UTF-8',
					standalone: false
				}
			});

			return builder.buildObject(obj);
		} catch (err) {
			throw new Error(`XML conversion failed ${err.message} for data: ${JSON.stringify(obj)}`);
		}
	}
}
