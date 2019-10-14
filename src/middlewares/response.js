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
import {ERRORS, PROTOCOL_VERSION, RESPONSE_TIMESTAMP_FORMAT} from './constants';
import {Parser, Builder} from 'xml2js';

export default ({identifierPrefix, supportEmail}) => {
	const {createLogger} = Utils;
	const logger = createLogger();

	return {
		generateErrorResponse, generateListMetadataFormatsResponse, generateListSetsResponse,
		generateIdentifyResponse, generateListRecordsResponse, generateListIdentifiersResponse,
		generateGetRecordResponse, generateResponse, responseToXML
	};

	async function generateErrorResponse({requestURL, query, error}) {
		if (error === ERRORS.BAD_VERB) {
			delete query.verb;
		}

		return generate({requestURL, query, payload: {
			error: {
				$: {code: error}
			}
		}});
	}

	async function generateGetRecordResponse({requestURL, query, id, time, record}) {
		return generate({requestURL, query, payload: {
			GetRecord: {record: [
				await generateRecordObject({id, time, record})
			]}
		}});
	}

	async function generateIdentifyResponse({requestURL, query, descr, earliestTimestamp}) {
		return generate({requestURL, query, payload: {
			Identify: {
				repositoryName: [descr],
				baseURL: [requestURL.split('?').shift()],
				procotolVersion: [PROTOCOL_VERSION],
				earliestTimestamp: [earliestTimestamp.format(RESPONSE_TIMESTAMP_FORMAT)],
				deletedRecord: ['persistent'],
				granularity: ['YYYY-MM-DDthh:mm:ssZ'],
				adminEmail: [supportEmail]
			}
		}});
	}

	async function generateListMetadataFormatsResponse({requestURL, query, formats}) {
		return generate({requestURL, query, payload: {
			ListMetadataFormats: {
				metadataFormat: formats.map(({prefix, schema, namespace}) => ({
					metadataPrefix: [prefix],
					schema: [schema],
					metadataNamespace: [namespace]
				}))
			}
		}});
	}

	async function generateListSetsResponse({requestURL, query, sets}) {
		return generate({requestURL, query, payload: {
			ListSets: {
				set: sets.map(({spec, name, description}) => ({
					setSpec: [spec],
					setName: [name],
					setDescription: [description]
				}))
			}
		}});
	}

	async function generateListRecordsResponse({requestURL, query, token, tokenExpirationTime, records}) {
		return generate({requestURL, query, payload: {
			ListRecords: await generateListResourcesResponse({records, token, tokenExpirationTime})
		}});
	}

	async function generateListIdentifiersResponse({requestURL, query, token, tokenExpirationTime, records}) {
		return generate({requestURL, query, payload: {
			ListIdentifiers: await generateListResourcesResponse({records, token, tokenExpirationTime})
		}});
	}

	function generateResponse({requestURL, query, payload}) {
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
				_: requestURL,
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

	function responseToXML(obj) {
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
			throw new Error(`XML conversion failed ${err.message} for data: ${JSON.stringify(obj)}`);
		}
	}

	function generate(params) {
		return responseToXML(generateResponse(params));
	}

	async function generateListResourcesResponse({records, token, tokenExpirationTime}) {
		const obj = {
			record: await Promise.all(records.map(generateRecordObject))
		};

		if (token) {
			return {
				...obj,
				resumptionToken: {
					$: {
						expirationDate: tokenExpirationTime.toISOString(true)
					},
					_: token
				}
			};
		}

		return obj;
	}

	async function generateRecordObject({time, id, record, isDeleted}) {
		const obj = {
			header: [{
				identifier: [`${identifierPrefix}/${id}`],
				datestamp: time.toISOString(true)
			}]
		};

		if (record) {
			return {
				...obj,
				metadata: [await convertRecord()]
			};
		}

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

		return obj;

		async function convertRecord() {
			const str = convert();

			function convert() {
				const PATTERN = /[\x00-\x1F\x7F-\x9F]/g; // eslint-disable-line no-control-regex
				const str = MARCXML.to(record, {omitDeclaration: true});

				// Remove control characters because they will break XML conversion
				if (PATTERN.test(str)) {
					logger.log('warn', `Record ${id} contains control characters`);
					return str.replace(PATTERN, '');
				}

				return str;
			}

			return new Promise((resolve, reject) => {
				new Parser().parseString(str, (err, obj) => {
					if (err) {
						reject(err);
					} else {
						resolve(obj);
					}
				});
			});
		}
	}
};
