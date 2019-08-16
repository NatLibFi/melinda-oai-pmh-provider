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
import {ERRORS} from './constants';
import moment from 'moment';
import ApiError from './error';
import {generateErrorResponse, generateListRecordsResponse} from './response';
import {Utils} from '@natlibfi/melinda-commons';
// Const {createLogger, createExpressLogger, encryptString, decryptString} = Utils;

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

				Object.keys(req.query).forEach(key => {
					switch (key) {
						case 'verb':
							break;
						case 'from':
							obj.from = parseDatestamp(req.query.from);
							break;
						case 'until':
							obj.until = parseDatestamp(req.query.until);
							break;
						case 'set':
							obj.set = req.query.set;
							break;
						case 'resumptionToken':
							obj.cursor = parseResumptionToken(req.query.resumptionToken);
							break;
						case 'metadataPrefix':
							if (req.query.metadataPrefix !== 'marc') {
								throw new ApiError({
									code: ERRORS.CANNOT_DISSEMINATE_FORMAT,
									verb: req.query.verb
								});
							}

							break;
						default:
							throw new ApiError({
								code: ERRORS.BAD_ARGUMENT,
								verb: req.query.verb
							});
					}
				});

				if (!req.query.metadataPrefix && !req.query.resumptionToken) {
					throw new ApiError({
						code: ERRORS.CANNOT_DISSEMINATE_FORMAT,
						verb: req.query.verb
					});
				}

				return obj;

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

				function parseResumptionToken(token) {
					const str = decryptToken();
					const [expirationTime, cursorString] = str.split(/;/);
					const cursor = Number(cursorString);

					if (moment(expirationTime).isBefore(moment()) || Number.isNaN(cursor)) {
						throw new ApiError({
							code: ERRORS.BAD_RESUMPTION_TOKEN,
							verb: req.query.verb
						});
					}

					return cursor;

					function decryptToken() {
						try {
							return decryptString({key: secretEncryptionKey, value: token, algorithm: 'aes128'});
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
				const token = encryptString({key: secretEncryptionKey, value: `${tokenExpirationTime};${cursor}`, algorithm: 'aes128'});

				return {token, tokenExpirationTime};

				function generateResumptionExpirationTime() {
					const expirationTime = moment().add(resumptionTokenTimeout, 'milliseconds');
					return expirationTime.toISOString(true);
				}
			}
		}
	};
};
