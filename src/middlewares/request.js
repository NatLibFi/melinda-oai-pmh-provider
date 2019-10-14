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
* limitations under the License.a
*/

import HttpStatus from 'http-status';
import moment from 'moment';
import {Utils} from '@natlibfi/melinda-commons';
import {REQUEST_DATE_STAMP_FORMATS} from './constants';
import ApiError from './api-error';
import responseFactory from './response';
import {parseResumptionToken, generateResumptionToken} from './utils';

import {
	ERRORS, QUERY_PARAMETERS, METADATA_FORMATS,
	REPOSITORY_NAMES
} from './constants';

export default ({
	pool, secretEncryptionKey, supportEmail,
	instanceUrl, identifierPrefix, resumptionTokenTimeout,
	getRecord, listIdentifiers,
	listRecords, listSets,
	earliestTimestamp
}) => {
	const {createLogger, clone} = Utils;
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

				if (method) {
					const result = await wrapMethodCall();

					if (params.connection) {
						await params.connection.close();
						logger.log('debug', 'Connection closed');
					}

					return sendResponse({result, params});
				}

				return sendResponse({params});

				async function wrapMethodCall() {
					return new Promise(async (resolve, reject) => { // eslint-disable-line no-async-promise-executor
						req.on('close', async () => {
							logger.log('info', 'Request cancelled');

							if (params.connection) {
								await params.connection.close();
							}

							resolve();
						});

						try {
							resolve(method(params));
						} catch (err) {
							reject(err);
						}
					});
				}

				async function getParams(useDb = true) {
					const obj = {};

					if (useDb) {
						logger.log('debug', 'Requesting a new connection from the pool...');
						obj.connection = await pool.getConnection();
						logger.log('debug', 'Connection acquired!');
					}

					if (checkArguments()) {
						if (allowedParams.includes('resumptionToken') && 'resumptionToken' in req.query) {
							const params = parseResumptionToken({
								secretEncryptionKey, verb,
								token: req.query.resumptionToken
							});

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

								if (obj.set) {
									if (hasSet(obj.set) === false) {
										throw new ApiError({verb, code: ERRORS.BAD_ARGUMENT});
									}
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

						function hasSet(set) {
							return listSets().some(({spec}) => set === spec);
						}

						function parseDatestamp(stamp) {
							const m = moment.utc(stamp, REQUEST_DATE_STAMP_FORMATS);

							if (m.isValid()) {
								return m;
							}

							throw new ApiError({verb, code: ERRORS.BAD_ARGUMENT});
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
						return generateIdentifyResponse({requestURL, query, descr, earliestTimestamp});
					}
				};

				return generators[method]();

				async function listResources(callback) {
					const {records, cursor} = result;

					if (records.length === 0) {
						return generateErrorResponse({query, requestURL, error: ERRORS.NO_RECORDS_MATCH});
					}

					if (cursor) {
						const {token, tokenExpirationTime} = generateResumptionToken({
							secretEncryptionKey, resumptionTokenTimeout,
							cursor, ...params
						});

						return callback({requestURL, query, records, token, tokenExpirationTime, cursor});
					}

					return callback({requestURL, query, records});
				}
			}
		}
	};
};
