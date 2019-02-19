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

import express from 'express';
import moment from 'moment';
import HttpStatus from 'http-status';
import {MarcRecord} from '@natlibfi/marc-record';
import {Utils} from '@natlibfi/melinda-commons';
import {ERRORS} from './constants';
import ApiError from './error';
import {generateErrorResponse, generateListRecordsResponse} from './response';

/* Import {
	httpPort, enableProxy, secretEncryptionKey, resumptionTokenTimeout,
	oracleUsername, oraclePassword, oracleConnectString
} from './config'; */

export default async function ({
	oracledb,
	listRecords, identifierPrefix, httpPort, enableProxy, secretEncryptionKey, resumptionTokenTimeout,
	oracleUsername, oraclePassword, oracleConnectString, instanceUrl
}) {
	let server;

	MarcRecord.setValidationOptions({subfieldValues: false});
	oracledb.outFormat = oracledb.OBJECT;

	const {createLogger, createExpressLogger, encryptString, decryptString} = Utils;

	const pool = await oracledb.createPool({
		user: oracleUsername, password: oraclePassword,
		connectString: oracleConnectString
	});

	/*	Process.on('SIGTERM', handleSignal);
	process.on('SIGINT', handleSignal);
	// Nodemon
	process.on('SIGUSR2', handleSignal);

	process.on('unhandledRejection', async err => {
		handleTermination({code: -1, message: err.stack});
	});
*/
	const Logger = createLogger();
	const app = express();

	if (enableProxy) {
		app.enable('trust proxy', true);
	}

	app.use(createExpressLogger());
	app.get('/', handleRequest);
	app.use(handleError);

	server = app.listen(httpPort, () => Logger.log('info', 'Started Melinda OAI-PMH provider'));

	return server;

	async function handleRequest(req, res, next) {
		res.type('application/xml');

		try {
			switch (req.query.verb) {
				case 'ListRecords':
					Logger.log('debug', 'Calling ListRecords');
					await callMethod(listRecords);
					break;
				default:
					throw new ApiError(ERRORS.BAD_VERB);
			}
		} catch (err) {
			if (err instanceof ApiError) {
				err.verb = req.query.verb;
			}

			next(err);
		}

		async function callMethod(method) {
			const params = await getParams();
			const {results, cursor} = await method(params);

			if (params.connection) {
				await params.connection.close();
				Logger.log('debug', 'Connection closed');
			}

			if (results.length === 0) {
				const err = new ApiError(ERRORS.NO_RECORDS_MATCH);
				err.verb = req.query.verb;
				throw err;
			}

			sendResponse({results, cursor, res, verb: req.query.verb});

			async function getParams(useDb = true) {
				const obj = {};

				if (useDb) {
					Logger.log('debug', 'Requesting a new connection from the pool...');
					obj.connection = await pool.getConnection();
					Logger.log('debug', 'Connection acquired!');
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
								throw new ApiError(ERRORS.CANNOT_DISSEMINATE_FORMAT);
							}

							break;
						default:
							throw new ApiError(ERRORS.BAD_ARGUMENT);
					}
				});

				if (!req.query.metadataPrefix && !req.query.resumptionToken) {
					throw new ApiError(ERRORS.CANNOT_DISSEMINATE_FORMAT);
				}

				return obj;

				function parseDatestamp(stamp) {
					const m = moment(stamp);

					if (m.isValid()) {
						return m;
					}

					throw new ApiError(ERRORS.BAD_ARGUMENT);
				}

				function parseResumptionToken(token) {
					const str = decryptToken();
					const [expirationTime, cursorString] = str.split(/;/);
					const cursor = Number(cursorString);

					if (moment(expirationTime).isBefore(moment()) || Number.isNaN(cursor)) {
						throw new ApiError(ERRORS.BAD_RESUMPTION_TOKEN);
					}

					return cursor;

					function decryptToken() {
						try {
							return decryptString({key: secretEncryptionKey, value: token, algorithm: 'aes128'});
						} catch (err) {
							throw new ApiError(ERRORS.BAD_RESUMPTION_TOKEN);
						}
					}
				}
			}
		}
	}

	function sendResponse({res, error, verb, results, cursor}) {
		if (error) {
			res.send(generateErrorResponse({instanceUrl, error, verb}));
		} else {
			const {token, tokenExpirationTime} = cursor === undefined ? [] : generateResumptionToken(cursor);

			switch (verb) {
				case 'ListRecords':
					res.send(generateListRecordsResponse({instanceUrl, verb, results, token, tokenExpirationTime, identifierPrefix}));
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

	async function handleError(err, req, res, next) { // eslint-disable-line no-unused-vars
		if (err instanceof ApiError) {
			sendResponse({error: err.code, res});
		} else {
			res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
			// HandleTermination({code: -1, message: err.stack});
			Logger.log('error', err.stack);
		}
	}

	/* Async function handleTermination({code = 0, message}) {
		await pool.close(2);

		if (server) {
			await server.close();
		}

		if (message) {
			console.log(message);
		}

		process.exit(code);
	}

	async function handleSignal(signal) {
		handleTermination({code: 1, message: `Received ${signal}`});
	} */
}
