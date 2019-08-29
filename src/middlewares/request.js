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

import {
	ERRORS, QUERY_PARAMETERS, METADATA_FORMATS,
	TOKEN_EXPIRATION_FORMAT, REPOSITORY_NAMES
} from './constants';

import {
	generateErrorResponse, generateIdentifyResponse,
	generateListMetadataFormatsResponse, generateListSetsResponse,
	generateGetRecordResponse, generateListRecordsResponse, generateListIdentifiersResponse
} from './response';

export default ({
	pool, secretEncryptionKey, supportEmail,
	instanceUrl, identifierPrefix, resumptionTokenTimeout,
	retrieveEarliestTimestamp, getRecord, listIdentifiers,
	listRecords, listSets
}) => {
	const {createLogger, encryptString, decryptString} = Utils;
	const logger = createLogger();

	return async (req, res, next) => {
		if (!req.accepts('application/xml')) {
			res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
			return;
		}

		res.type('application/xml');

		try {
			switch (req.query.verb) {
				case 'GetRecord':
					await callMethod({
						method: getRecord,
						allowedParams: ['verb', 'identifier', 'metadataPrefix'],
						requiredParams: ['verb', 'identifier', 'metadataPrefix']
					});
					break;
				case 'Identify':
					await callMethod({
						method: retrieveEarliestTimestamp,
						allowedParams: ['verb']
					});
					break;
				case 'ListIdentifiers':
					await callMethod({
						method: listIdentifiers,
						requiredParams: ['verb']
					});
					break;
				case 'ListMetadataFormats':
					await callMethod({
						method: listMetadataFormats,
						useDb: false,
						allowedParams: ['verb', 'identifier']
					});
					break;
				case 'ListRecords':
					await callMethod({
						method: listRecords,
						requiredParams: ['verb']
					});
					break;
				case 'ListSets':
					await callMethod({
						method: listSets,
						useDb: false,
						allowedParams: ['verb', 'resumptionToken']
					});
					break;
				default:
					throw new ApiError({code: ERRORS.BAD_VERB});
			}
		} catch (err) {
			if (err instanceof ApiError) {
				sendResponse({res, req, error: err.code});
			} else {
				next(err);
			}
		}

		function listMetadataFormats({identifier}) {
			if (identifier) {
				return {
					results: METADATA_FORMATS.filter(({prefix}) => prefix === identifier)
				};
			}

			return {
				results: METADATA_FORMATS.slice()
			};
		}

		async function callMethod({method, useDb, allowedParams = QUERY_PARAMETERS, requiredParams = ['verb']}) {
			const params = await getParams(useDb);

			if (method) {
				const {results, cursor} = await method(params);

				if (params.connection) {
					await params.connection.close();
					logger.log('debug', 'Connection closed');
				}

				sendResponse({res, req, results, cursor});
			} else {
				sendResponse({res, req});
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
						const params = parseResumptionToken(req.query.resumptionToken);

						return {
							...obj,
							...parse({
								...params,
								metadataPrefix: req.query.metadataPrefix
							})
						};
					}

					return {...obj, ...parse({...req.query})};
				}

				throw new ApiError({
					code: ERRORS.BAD_ARGUMENT,
					verb: req.query.verb
				});

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

						throw new ApiError({
							code: ERRORS.CANNOT_DISSEMINATE_FORMAT,
							verb: req.query.verb
						});
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

						throw new ApiError({
							code: ERRORS.BAD_ARGUMENT,
							verb: req.query.verb
						});
					}
				}

				function parseResumptionToken(token) {
					const str = decryptToken();
					const [expirationTime, cursorString, set, from, until] = str.split(/;/g);
					const expires = moment(expirationTime, TOKEN_EXPIRATION_FORMAT, true);
					const cursor = Number(cursorString);

					if (expires.isValid() && moment().isAfter(expires) && Number.isNaN(cursor) === false) {
						return {cursor, set, from, until};
					}

					throw new ApiError({
						code: ERRORS.BAD_RESUMPTION_TOKEN,
						verb: req.query.verb
					});

					function decryptToken() {
						try {
							const decoded = decodeURIComponent(token);
							return decryptString({key: secretEncryptionKey, value: decoded, algorithm: 'aes-256-cbc'});
						} catch (err) {
							throw new ApiError({
								code: ERRORS.BAD_RESUMPTION_TOKEN,
								verb: req.query.verb
							});
						}
					}
				}
			}
		}

		function sendResponse({res, req, error, results, cursor}) {
			const baseUrl = `${instanceUrl}/${req.path}`;

			if (error) {
				if (error === ERRORS.BAD_VERB) {
					delete req.query.verb;
				}

				res.send(generateErrorResponse({query: req.query, baseUrl, error}));
			} else {
				const {token, tokenExpirationTime} = cursor === undefined ? {} : generateResumptionToken(cursor);

				switch (req.query.verb) {
					case 'GetRecord':
						if (results) {
							res.send(generateGetRecordResponse({
								baseUrl, results, identifierPrefix,
								query: req.query
							}));
						} else {
							res.send(generateErrorResponse({query: req.query, baseUrl, error: ERRORS.ID_DOES_NOT_EXIST}));
						}

						break;
					case 'ListMetadataFormats':
						if (results.length === 0) {
							res.send(generateErrorResponse({query: req.query, baseUrl, error: ERRORS.ID_DOES_NOT_EXIST}));
						} else {
							res.send(generateListMetadataFormatsResponse({
								baseUrl, results,
								query: req.query
							}));
						}

						break;
					case 'ListSets':
						res.send(generateListSetsResponse({
							baseUrl, results,
							query: req.query
						}));
						break;
					case 'Identify':
						res.send(generateIdentifyResponse({
							baseUrl, supportEmail,
							name: getRepositoryDescription(),
							query: res.query,
							earliestTimestamp: results
						}));
						break;
					case 'ListRecords':
						if (results.length === 0) {
							throw new ApiError({
								code: ERRORS.NO_RECORDS_MATCH,
								verb: req.query.verb
							});
						}

						res.send(generateListRecordsResponse({
							query: req.query, baseUrl, results,
							token, tokenExpirationTime, identifierPrefix
						}));

						break;
					case 'ListIdentifiers':
						if (results.length === 0) {
							throw new ApiError({
								code: ERRORS.NO_RECORDS_MATCH,
								verb: req.query.verb
							});
						}

						res.send(generateListIdentifiersResponse({
							query: req.query, baseUrl, results,
							token, tokenExpirationTime, identifierPrefix
						}));
						break;
					default:
						break;
				}
			}

			function getRepositoryDescription() {
				// Remove the preceding slash
				return REPOSITORY_NAMES[req.path.slice(1)];
			}

			function generateResumptionToken(cursor) {
				const tokenExpirationTime = generateResumptionExpirationTime();
				const token = encryptString({key: secretEncryptionKey, value: `${tokenExpirationTime};${cursor}`, algorithm: 'aes-256-cbc'});

				return {token, tokenExpirationTime};

				function generateResumptionExpirationTime() {
					const expirationTime = moment().add(resumptionTokenTimeout, 'milliseconds');
					return expirationTime.toISOString(true);
				}
			}
		}
	};
};
