
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
import {Utils} from '@natlibfi/melinda-commons';
import {REQUEST_DATE_STAMP_FORMATS} from '../../constants';
import ApiError from '../../api-error';
import responseFactory from './response';
import {parseResumptionToken, generateResumptionToken} from '../../utils';
import databaseFactory from './db';
import {ERRORS, METADATA_FORMATS} from '../../constants';

export default async ({
	pool, secretEncryptionKey, resumptionTokenTimeout,
	supportEmail, oaiIdentifierPrefix, repoName,
	instanceUrl, maxResults, alephLibrary,
	sets, formatRecord, isSupportedFormat
}) => {
	const {createLogger, clone} = Utils;
	const logger = createLogger();
	const {
		generateErrorResponse, generateIdentifyResponse,
		generateListMetadataFormatsResponse, generateListSetsResponse,
		generateGetRecordResponse, generateListRecordsResponse, generateListIdentifiersResponse
	} = responseFactory({oaiIdentifierPrefix, supportEmail});

	const {getRecord, earliestTimestamp, listIdentifiers, listRecords} = await getMethods();

	return async (req, res, next) => {
		const {query: {verb}} = req;

		try {
			await handle();
		} catch (err) {
			return err instanceof ApiError ? sendResponse({error: err.code}) : next(err);
		}

		async function handle() {
			res.type('application/xml');

			const error = validateParams();

			return error ? sendResponse({error}) : call();

			function validateParams() {
				const numParams = Object.keys(req.query).length;
				const mapping = {
					Identify: () => {},
					GetRecord: validateGetRecord,
					ListMetadataFormats: validateListMetadataFormats,
					ListSets: validateListSets,
					ListIdentifiers: validateListRequest,
					ListRecords: validateListRequest
				};

				return verb && verb in mapping ? mapping[verb]() : ERRORS.BAD_VERB;

				function validateGetRecord() {
					if (numParams === 3) {
						const error = validateMetadataPrefix(req.query.metadataPrefix);

						if (error) {
							return error;
						}

						if (isSupportedFormat(req.query.metadataPrefix) === false) {
							return ERRORS.CANNOT_DISSEMINATE_FORMAT;
						}

						return;
					}

					return ERRORS.BAD_ARGUMENT;
				}

				function validateListMetadataFormats() {
					if (numParams === 2) {
						if ('identifier' in req.query) {
							return validateMetadataPrefix(req.query.identifier);
						}

						return ERRORS.BAD_ARGUMENT;
					}
				}

				function validateListSets() {
					if (numParams === 2 && req.query.resumptionToken === undefined) {
						return ERRORS.BAD_ARGUMENT;
					}
				}

				function validateListRequest() {
					if (numParams >= 2) {
						if (req.query.resumptionToken === undefined) {
							const match = METADATA_FORMATS.find(({prefix}) => prefix === req.query.metadataPrefix);

							if (match) {
								if (isSupportedFormat(req.query.metadataPrefix) === false) {
									return ERRORS.NO_RECORDS_MATCH;
								}

								return validateOptParams();
							}

							return ERRORS.CANNOT_DISSEMINATE_FORMAT;
						}

						return;
					}

					return ERRORS.BAD_ARGUMENT;

					function validateOptParams() {
						const hasInvalid = validate();

						if (hasInvalid) {
							return ERRORS.BAD_ARGUMENT;
						}

						function validate() {
							return Object.entries(req.query)
								.filter(([k]) => ['verb', 'metadataPrefix'].includes(k) === false)
								.some(([key, value]) => {
									const mapping = {
										set: validateSet,
										from: validateTime,
										until: validateTime
									};

									return key in mapping ? mapping[key]() : true;

									function validateSet() {
										return sets.find(({spec}) => spec === value) === undefined;
									}

									function validateTime() {
										const time = moment.utc(value, REQUEST_DATE_STAMP_FORMATS);
										return time.isValid() === false;
									}
								});
						}
					}
				}

				function validateMetadataPrefix(target) {
					const match = METADATA_FORMATS.find(({prefix}) => prefix === target);

					if (match === undefined) {
						return ERRORS.CANNOT_DISSEMINATE_FORMAT;
					}
				}
			}

			async function call() {
				const method = getMethod();
				const params = await getParams();
				const result = await wrap();

				return sendResponse({result, params});

				function getMethod() {
					const mapping = {
						Identify: () => {},
						ListSets: listSets,
						ListMetadataFormats: listMetadataFormats,
						GetRecord: getRecord,
						ListIdentifiers: listIdentifiers,
						ListRecords: listRecords
					};

					return mapping[verb];
				}

				async function getParams() {
					const params = 'resumptionToken' in req.query ? parseToken() : parse(req.query);
					return needsDb() ? addConnection() : params;

					function parseToken() {
						const params = parseResumptionToken({
							secretEncryptionKey, verb,
							token: req.query.resumptionToken
						});

						return parse(params);
					}

					function parse(params) {
						return Object.entries(params)
							.reduce((acc, [key, value]) => {
								const mapping = {
									from: parseTime,
									until: parseTime,
									identifier: parseIdentifier
								};

								if (key in mapping) {
									return {...acc, [key]: mapping[key](value)};
								}

								return {...acc, [key]: value};

								function parseTime(stamp) {
									return moment.utc(stamp, REQUEST_DATE_STAMP_FORMATS);
								}

								function parseIdentifier() {
								// Strip prefix (Slice takes offset and the length of the prefix which doesn't include the separator)
									return value.slice(oaiIdentifierPrefix.length + 1);
								}
							}, {});
					}

					function needsDb() {
						return ['GetRecord', 'ListIdentifiers', 'ListRecords'].includes(verb);
					}

					async function addConnection() {
						logger.log('debug', 'Requesting a new connection from the pool...');

						const connection = await pool.getConnection();

						logger.log('debug', 'Connection acquired!');

						return {...params, connection};
					}
				}

				async function wrap() {
					return new Promise(async (resolve, reject) => { // eslint-disable-line no-async-promise-executor
						req.on('close', async () => {
							logger.log('info', 'Request cancelled');

							if (params.connection) {
								await params.connection.break();
								await params.connection.close({drop: true});
							}

							resolve();
						});

						try {
							const result = await method(params);
							resolve(result);
						} catch (err) {
							reject(err);
						} finally {
							if (req.aborted === false && params.connection) {
								await params.connection.break();
								await params.connection.close({drop: true});
							}
						}
					});
				}

				function listMetadataFormats({identifier}) {
					if (identifier) {
						return METADATA_FORMATS.filter(({prefix}) => isSupportedFormat(prefix));
					}

					return METADATA_FORMATS;
				}

				function listSets() {
					return sets.map(({spec, name, description}) => ({spec, name, description}));
				}
			}
		}

		async function sendResponse({error, result, params}) {
			const requestUrl = instanceUrl;
			const query = clone(req.query);

			if (error) {
				return res.send(await generateErrorResponse({query, requestUrl, error}));
			}

			return res.send(await generatePayload(verb));

			async function generatePayload(method) {
				const generators = {
					ListSets: async () => generateListSetsResponse({requestUrl, query, sets: result}),
					ListRecords: async () => listResources(generateListRecordsResponse),
					ListIdentifiers: async () => listResources(generateListIdentifiersResponse),
					GetRecord: async () => {
						if (result) {
							return generateGetRecordResponse({
								requestUrl, query,
								format: params.metadataPrefix,
								...result
							});
						}

						return generateErrorResponse({requestUrl, query, error: ERRORS.ID_DOES_NOT_EXIST});
					},
					ListMetadataFormats: async () => {
						if (result.length === 0) {
							return generateErrorResponse({query, requestUrl, error: ERRORS.ID_DOES_NOT_EXIST});
						}

						return generateListMetadataFormatsResponse({requestUrl, query, formats: result});
					},
					Identify: async () => {
						return generateIdentifyResponse({requestUrl, query, repoName, earliestTimestamp});
					}
				};

				return generators[method]();

				async function listResources(callback) {
					const {records, cursor, previousCursor} = result;

					if (records.length === 0) {
						return generateErrorResponse({query, requestUrl, error: ERRORS.NO_RECORDS_MATCH});
					}

					if (cursor) {
						const {token, tokenExpirationTime} = generateResumptionToken({
							...params,
							secretEncryptionKey, resumptionTokenTimeout, cursor
						});

						return callback({
							requestUrl, query, records, token, tokenExpirationTime,
							format: params.metadataPrefix,
							cursor: previousCursor === undefined ? 0 : previousCursor
						});
					}

					return callback({requestUrl, query, records, format: params.metadataPrefix});
				}
			}
		}
	};

	async function getMethods() {
		const connection = await pool.getConnection();
		const methods = await databaseFactory({connection, sets, maxResults, alephLibrary, formatRecord});

		await connection.close();
		return methods;
	}
};
