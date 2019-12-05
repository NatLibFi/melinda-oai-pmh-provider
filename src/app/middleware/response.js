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
import {Utils} from '@natlibfi/melinda-commons';
import {Parser, Builder} from 'xml2js';
import {ERRORS, PROTOCOL_VERSION, RESPONSE_TIMESTAMP_FORMAT} from '../../constants';
import {fromMARC21} from './marc-to-dc';

export default ({oaiIdentifierPrefix, supportEmail}) => {
	const {createLogger} = Utils;
	const logger = createLogger();

	return {
		generateErrorResponse, generateListMetadataFormatsResponse, generateListSetsResponse,
		generateIdentifyResponse, generateListRecordsResponse, generateListIdentifiersResponse,
		generateGetRecordResponse
	};

	async function generateErrorResponse({requestUrl, query, error}) {
		if (error === ERRORS.BAD_VERB) {
			delete query.verb;
		}

		return generateResponse({requestUrl, query, payload: {
			error: {
				$: {code: error}
			}
		}});
	}

	async function generateGetRecordResponse({requestUrl, query, format, ...record}) {
		return generateResponse({requestUrl, query, payload: {
			GetRecord: {record: [
				await generateRecordObject({...record, format})
			]}
		}});
	}

	async function generateIdentifyResponse({requestUrl, query, repoName, earliestTimestamp}) {
		return generateResponse({requestUrl, query, payload: {
			Identify: {
				repositoryName: [repoName],
				baseURL: [requestUrl.split('?').shift()],
				procotolVersion: [PROTOCOL_VERSION],
				earliestTimestamp: [earliestTimestamp.format(RESPONSE_TIMESTAMP_FORMAT)],
				deletedRecord: ['persistent'],
				granularity: ['YYYY-MM-DDthh:mm:ssZ'],
				adminEmail: [supportEmail]
			}
		}});
	}

	async function generateListMetadataFormatsResponse({requestUrl, query, formats}) {
		return generateResponse({requestUrl, query, payload: {
			ListMetadataFormats: {
				metadataFormat: formats.map(({prefix, schema, namespace}) => ({
					metadataPrefix: [prefix],
					schema: [schema],
					metadataNamespace: [namespace]
				}))
			}
		}});
	}

	async function generateListSetsResponse({requestUrl, query, sets}) {
		return generateResponse({requestUrl, query, payload: {
			ListSets: {
				set: sets.map(({spec, name, description}) => ({
					setSpec: [spec],
					setName: [name],
					setDescription: [description]
				}))
			}
		}});
	}

	async function generateListRecordsResponse({requestUrl, query, token, tokenExpirationTime, cursor, records, format}) {
		return generateResponse({requestUrl, query, payload: {
			ListRecords: await generateListResourcesResponse({records, token, tokenExpirationTime, cursor, format})
		}});
	}

	async function generateListIdentifiersResponse({requestUrl, query, token, tokenExpirationTime, cursor, records, format}) {
		return generateResponse({requestUrl, query, payload: {
			ListIdentifiers: await generateListResourcesResponse({records, token, tokenExpirationTime, cursor, format})
		}});
	}

	function generateResponse({requestUrl, query, payload}) {
		const obj = generate();
		return toXML();

		function generate() {
			return {
				'OAI-PMH': {
					$: {
						xmlns: 'http://www.openarchives.org/OAI/2.0/',
						'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
						'xsi:schemaLocation': 'http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd'
					},
					request: [generateRequestObject()],
					responseDate: [moment().format(RESPONSE_TIMESTAMP_FORMAT)],
					...payload
				}
			};

			function generateRequestObject() {
				return {
					_: requestUrl,
					$: getAttr()
				};

				function getAttr() {
					return Object.entries(query)
						.sort((a, b) => {
							const {key: aKey} = a;
							const {key: bKey} = b;

							if (aKey === 'verb' || bKey === 'verb') {
								return -1;
							}

							return 0;
						})
						.reduce((acc, [key, value]) => ({...acc, [key]: value}), {});
				}
			}
		}

		function toXML() {
			try {
				return new Builder({
					xmldec: {
						version: '1.0',
						encoding: 'UTF-8',
						standalone: false
					},
					renderOpts: {
						pretty: true,
						indent: '\t'
					}
				}).buildObject(obj);
			} catch (err) {
				throw new Error(`XML conversion failed ${err.message} for query: ${JSON.stringify(query)}`);
			}
		}
	}

	async function generateListResourcesResponse({records, token, tokenExpirationTime, cursor, format}) {
		const obj = {
			record: await Promise.all(records.map(record => generateRecordObject({...record, format})))
		};

		if (token) {
			return {
				...obj,
				resumptionToken: {
					$: genAttr(),
					_: token
				}
			};
		}

		return obj;

		function genAttr() {
			const expirationDate = tokenExpirationTime.toISOString(true);
			return cursor === undefined ? {expirationDate} : {expirationDate, cursor};
		}
	}

	async function generateRecordObject({time, id, record, isDeleted, format}) {
		const obj = {
			header: [{
				identifier: [`${oaiIdentifierPrefix}/${id}`],
				datestamp: time.toISOString(true)
			}]
		};

		if (isDeleted) {
			return {
				...obj,
				header: [{
					...obj.header.shift(),
					$: {
						status: 'deleted'
					}
				}]
			};
		}

		if (record) {
			return {
				...obj,
				metadata: [await transformRecord()]
			};
		}

		return obj;

		async function transformRecord() {
			const str = transform();

			return new Promise((resolve, reject) => {
				new Parser().parseString(str, (err, obj) => {
					if (err) {
						reject(err);
					} else {
						resolve(obj);
					}
				});
			});

			function transform() {
				const PATTERN = /[\x00-\x1F\x7F-\x9F]/g; // eslint-disable-line no-control-regex
				const str = doTransformation();

				// Remove control characters because they will break XML conversion
				if (PATTERN.test(str)) {
					logger.log('warn', `Record ${id} contains control characters`);
					return str.replace(PATTERN, '');
				}

				return str;

				function doTransformation() {
					if (format === 'oai_dc') {
						return fromMARC21(record);
					}

					if (format === 'marc21') {
						return MARCXML.to(record, {omitDeclaration: true});
					}

					// Format: melinda_marc
					return MARCXML.to(record, {omitDeclaration: true});
				}
			}
		}
	}
};
