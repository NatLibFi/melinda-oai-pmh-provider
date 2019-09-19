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

import HttpStatus from 'http-status';
import moment from 'moment';
import {Utils} from '@natlibfi/melinda-commons';
import ApiError from './error';
import responseFactory from './response';

import {
	ERRORS, QUERY_PARAMETERS, METADATA_FORMATS,
	TOKEN_EXPIRATION_FORMAT, REPOSITORY_NAMES
} from './constants';

export default ({
	pool, secretEncryptionKey, supportEmail,
	instanceUrl, identifierPrefix, resumptionTokenTimeout,
	retrieveEarliestTimestamp, getRecord, listIdentifiers,
	listRecords, listSets
}) => {
	const {createLogger, encryptString, decryptString, clone} = Utils;
	const logger = createLogger();
	const {
		generateErrorResponse, generateIdentifyResponse,
		generateListMetadataFormatsResponse, generateListSetsResponse,
		generateGetRecordResponse, generateListRecordsResponse, generateListIdentifiersResponse
	} = responseFactory({identifierPrefix, supportEmail});

	return async (req, res, next) => {
		const {query: {verb}} = req;

		if (!req.accepts('application/xml')) {
			res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
			return;
		}

		res.type('application/xml');

		try {
			await handle();
		} catch (err) {
			if (err instanceof ApiError) {
				await sendResponse({error: err.code});
			} else {
				next(err);
			}
		}

		async function handle() {
			const handlers = getHandlers();

			if (verb in handlers) {
				return callMethod(handlers[verb]);
			}

			throw new ApiError({code: ERRORS.BAD_VERB});

			function getHandlers() {
				return {
					GetRecord: {
						method: getRecord,
						allowedParams: ['verb', 'identifier', 'metadataPrefix'],
						requiredParams: ['verb', 'identifier', 'metadataPrefix']
					},
					Identify: {
						method: retrieveEarliestTimestamp,
						allowedParams: ['verb']
					},
					ListIdentifiers: {
						method: listIdentifiers,
						requiredParams: ['verb']
					},
					ListRecords: {
						method: listRecords,
						requiredParams: ['verb']
					},
					ListMetadataFormats: {
						method: listMetadataFormats,
						useDb: false,
						allowedParams: ['verb', 'identifier']
					},
					ListSets: {
						method: listSets,
						useDb: false,
						allowedParams: ['verb', 'resumptionToken']
					}
				};

				function listMetadataFormats({identifier}) {
					if (identifier) {
						return METADATA_FORMATS.filter(({prefix}) => prefix === identifier);
					}

					return METADATA_FORMATS;
				}
			}

			async function callMethod({method, useDb, allowedParams = QUERY_PARAMETERS, requiredParams = ['verb']}) {
				const params = await getParams(useDb);
				const result = await method(params);

				if (params.connection) {
					await params.connection.close();
					logger.log('debug', 'Connection closed');
				}

				await sendResponse({result, params});

				async function getParams(useDb = true) {
					const obj = {};

					if (useDb) {
						logger.log('debug', 'Requesting a new connection from the pool...');
						obj.connection = await pool.getConnection();
						logger.log('debug', 'Connection acquired!');
					}

					if (checkArguments()) {
						if (allowedParams.includes('resumptionToken') && 'resumptionToken' in req.query) {
							const params = parseResumptionToken(req.query.resumptionToken);

							return {
								...obj,
								...parse(params)
							};
						}

						return {...obj, ...parse({...req.query})};
					}

					throw new ApiError({verb, code: ERRORS.BAD_ARGUMENT});

					function checkArguments() {
						const hasOnlyAllowed = Object.keys(req.query).every(k => allowedParams.includes(k));
						const hasAllRequired = requiredParams.every(v => [v] in req.query);
						return hasOnlyAllowed && hasAllRequired;
					}

					function parse(obj) {
						if (allowedParams.includes('metadataPrefix')) {
							if (METADATA_FORMATS.some(({prefix}) => prefix === obj.metadataPrefix)) {
								if (obj.from) {
									obj.from = parseDatestamp(obj.from);
								}

								if (obj.until) {
									obj.until = parseDatestamp(obj.until);
								}

								if (obj.identifier) {
									// Strip prefix (Slice takes offset and the length of the prefix doesn't include the separator)
									obj.identifier = obj.identifier.slice(identifierPrefix.length + 1);
								}

								return obj;
							}

							throw new ApiError({verb, code: ERRORS.CANNOT_DISSEMINATE_FORMAT});
						}

						return Object.entries(obj).reduce((acc, [key, value]) => {
							if (key === 'verb') {
								return acc;
							}

							return {...acc, [key]: value};
						}, {});

						function parseDatestamp(stamp) {
							const m = moment.utc(stamp);

							if (m.isValid()) {
								return m;
							}

							throw new ApiError({verb, code: ERRORS.BAD_ARGUMENT});
						}
					}

					function parseResumptionToken(token) {
						const str = decryptToken();
						const [expirationTime, cursorString, metadataPrefix, from, until, set] = str.split(/;/g);
						const expires = moment(expirationTime, TOKEN_EXPIRATION_FORMAT, true);
						const cursor = Number(cursorString);

						if (expires.isValid() && moment().isBefore(expires) && Number.isNaN(cursor) === false) {
							return {cursor, metadataPrefix, set, from, until};
						}

						throw new ApiError({verb, code: ERRORS.BAD_RESUMPTION_TOKEN});

						function decryptToken() {
							try {
								const decoded = decodeURIComponent(token);
								return decryptString({key: secretEncryptionKey, value: decoded, algorithm: 'aes-256-cbc'});
							} catch (err) {
								throw new ApiError({verb, code: ERRORS.BAD_RESUMPTION_TOKEN});
							}
						}
					}
				}
			}
		}

		async function sendResponse({error, result, params}) {
			const query = clone(req.query);
			const requestURL = `${instanceUrl}${req.path}`;

			if (error) {
				return res.send(await generateErrorResponse({query, requestURL, error}));
			}

			return res.send(await generatePayload(verb));

			async function generatePayload(method) {
				const generators = {
					ListSets: async () => generateListSetsResponse({requestURL, query, sets: result}),
					ListRecords: async () => listResources(generateListRecordsResponse),
					ListIdentifiers: async () => listResources(generateListIdentifiersResponse),
					GetRecord: async () => {
						if (result) {
							return generateGetRecordResponse({requestURL, query, ...result});
						}

						return generateErrorResponse({requestURL, query, error: ERRORS.ID_DOES_NOT_EXIST});
					},
					ListMetadataFormats: async () => {
						if (result.length === 0) {
							return generateErrorResponse({query, requestURL, error: ERRORS.ID_DOES_NOT_EXIST});
						}

						return generateListMetadataFormatsResponse({requestURL, query, formats: result});
					},
					Identify: async () => {
						// Remove the preceding slash
						const descr = REPOSITORY_NAMES[req.path.slice(1)];
						return generateIdentifyResponse({requestURL, query, descr, earliestTimestamp: result});
					}
				};

				return generators[method]();

				async function listResources(callback) {
					const {records, cursor} = result;

					if (records.length === 0) {
						return generateErrorResponse({query, requestURL, error: ERRORS.NO_RECORDS_MATCH});
					}

					if (cursor) {
						const {token, tokenExpirationTime} = generateResumptionToken();
						return callback({requestURL, query, records, token, tokenExpirationTime});
					}

					return callback({requestURL, query, records});

					function generateResumptionToken() {
						const tokenExpirationTime = generateResumptionExpirationTime();
						const value = generateValue();
						const token = encryptString({key: secretEncryptionKey, value, algorithm: 'aes-256-cbc'});

						return {token, tokenExpirationTime};

						function generateResumptionExpirationTime() {
							return moment().add(resumptionTokenTimeout, 'milliseconds');
						}

						function generateValue() {
							const {metadataPrefix, from, until, set} = params;
							const time = tokenExpirationTime.format(TOKEN_EXPIRATION_FORMAT);
							return `${time};${cursor};${metadataPrefix};${from || ''};${until || ''};${set || ''}`;
						}
					}
				}
			}
		}
	};
};
