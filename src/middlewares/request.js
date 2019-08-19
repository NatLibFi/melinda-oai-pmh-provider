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
import {ERRORS, QUERY_PARAMETERS, METADATA_PREFIXES, TOKEN_EXPIRATION_FORMAT} from './constants';
import moment from 'moment';
import ApiError from './error';
import {generateErrorResponse, generateListRecordsResponse} from './response';
import {Utils} from '@natlibfi/melinda-commons';

export default ({
	pool, secretEncryptionKey, instanceUrl, identifierPrefix, resumptionTokenTimeout,
	getRecord, identify, listIdentifiers, listMetadataFormats, listRecords, listSets
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
					await callMethod(getRecord);
					break;
				case 'Identify':
					await callMethod(identify);
					break;
				case 'ListIdentifiers':
					await callMethod(listIdentifiers);
					break;
				case 'ListMetadataFormats':
					await callMethod(listMetadataFormats);
					break;
				case 'ListRecords':
					await callMethod(listRecords);
					break;
				case 'ListSets':
					await callMethod(listSets);
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

		async function callMethod(method) {
			const params = await getParams();
			const {results, cursor} = await method(params);

			if (params.connection) {
				await params.connection.close();
				logger.log('debug', 'Connection closed');
			}

			if (results.length === 0) {
				throw new ApiError({
					code: ERRORS.NO_RECORDS_MATCH,
					verb: req.query.verb
				});
			}

			sendResponse({res, req, results, cursor});

			async function getParams(useDb = true) {
				const obj = {};

				if (useDb) {
					logger.log('debug', 'Requesting a new connection from the pool...');
					obj.connection = await pool.getConnection();
					logger.log('debug', 'Connection acquired!');
				}

				if (Object.keys(req.query).every(k => QUERY_PARAMETERS.includes(k))) {
					if ('resumptionToken' in req.query) {
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

				function parse(obj) {
					if ('metadataPrefix' in obj && METADATA_PREFIXES.includes(obj.metadataPrefix)) {
						if ('from' in obj) {
							obj.from = parseDatestamp(obj.from);
						}

						if ('until' in obj) {
							obj.until = parseDatestamp(obj.until);
						}

						return obj;
					}

					throw new ApiError({
						code: ERRORS.CANNOT_DISSEMINATE_FORMAT,
						verb: req.query.verb
					});

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
							// Console.log(encodeURIComponent(encryptString({key: secretEncryptionKey, value: '2000-01-01T00:00:00.000+00:00;12345;fennica;2009-01-01T00:00:00;2010-01-01T00:10:00', algorithm: 'aes-256-cbc'})));
							// console.log(encryptString({key: secretEncryptionKey, value: '2000-01-01T00:00:00.000+00:00;12345;fennica;2009-01-01T00:00:00;2010-01-01T00:10:00', algorithm: 'aes-256-cbc'}));
							return decryptString({key: secretEncryptionKey, value: decoded, algorithm: 'aes-256-cbc'});
						} catch (err) {
							console.log(err);
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
			if (error) {
				if (error === ERRORS.BAD_VERB) {
					delete req.query.verb;
				}

				res.send(generateErrorResponse({...req.query, instanceUrl, error}));
			} else {
				const {token, tokenExpirationTime} = cursor === undefined ? [] : generateResumptionToken(cursor);

				switch (req.query.verb) {
					case 'ListRecords':
						res.send(generateListRecordsResponse({
							...req.query, instanceUrl, results,
							token, tokenExpirationTime, identifierPrefix
						}));
						break;
					default:
						break;
				}
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
