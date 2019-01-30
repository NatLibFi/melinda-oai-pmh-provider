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
import oracledb from 'oracledb';
import HttpStatus from 'http-status';
import {MarcRecord} from '@natlibfi/marc-record';
import {Utils} from '@natlibfi/melinda-commons';
import {ERRORS} from './constants';
import {generateErrorResponse, generateListRecordsResponse} from './response';

const {createLogger, createExpressLogger, encryptString, decryptString} = Utils;

MarcRecord.setValidationOptions({subfieldValues: false});

import {
	HTTP_PORT, ENABLE_PROXY, SECRET_ENCRYPTION_KEY,
	ORACLE_USERNAME, ORACLE_PASSWORD, ORACLE_CONNECT_STRING
} from './config';

export default async function (createProvider) {
	let server;

	const {listRecords} = await createProvider();
	const pool = await oracledb.createPool({
		user: ORACLE_USERNAME, password: ORACLE_PASSWORD,
		connectString: ORACLE_CONNECT_STRING
	});

	oracledb.outFormat = oracledb.OBJECT;

	process.on('SIGTERM', handleSignal);
	process.on('SIGINT', handleSignal);
	// Nodemon
	process.on('SIGUSR2', handleSignal);

	process.on('unhandledRejection', async err => {
		handleTermination({code: -1, message: err.stack});
	});

	const Logger = createLogger();
	const app = express();

	if (ENABLE_PROXY) {
		app.enable('trust proxy', true);
	}

	app.use(createExpressLogger());
	app.get('/', handleRequest);
	app.use(handleError);

	server = app.listen(HTTP_PORT, () => Logger.log('info', 'Started Melinda OAI-PMH provider'));

	async function handleTermination({code = 0, message}) {
		await pool.close();

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
	}

	async function handleRequest(req, res) {
		res.type('application/xml');

		switch (req.query.verb) {
			case 'ListRecords':
				Logger.log('debug', 'Calling listRecords');
				sendResponse(Object.assign({verb: 'ListRecords'}, await callMethod(listRecords)));
				break;
			default:
				sendResponse({error: ERRORS.BAD_VERB});
				break;
		}

		async function callMethod(cb, useDb = true) {
			if (useDb) {
				const params = getParams();

				//  Error in parameters;
				if (res.headersSent) {
					return;
				}

				params.connection = await pool.getConnection();

				try {
					const results = await cb(params);
					await params.connection.close();
					return results;
				} catch (err) {
					await params.connection.close();
					throw err;
				}
			}

			const params = getParams();

			//  Error in parameters;
			if (res.headersSent) {
				return;
			}

			return cb(params);

			function getParams() {
				const {verb} = req.query;
				const obj = {};

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
							try {
								obj.offset = parseResumptionToken(req.query.resumptionToken);
							} catch (err) {
								sendResponse({error: ERRORS.BAD_RESUMPTION_TOKEN, verb});
							}
							break;
						case 'metadataPrefix':
							if (req.query.metadataPrefix !== 'marc') {
								sendResponse({error: ERRORS.CANNOT_DISSEMINATE_FORMAT, verb});
							}
							break;
						default:
							sendResponse({error: ERRORS.BAD_ARGUMENT, verb});
					}
				});

				if (!req.query.metadataPrefix && !req.query.resumptionToken) {
					sendResponse({error: ERRORS.CANNOT_DISSEMINATE_FORMAT, verb});
				}

				return obj;

				function parseDatestamp(stamp) {
					const m = moment(stamp);

					if (m.isValid()) {
						return m;
					}

					sendResponse({error: ERRORS.BAD_ARGUMENT});
				}

				function parseResumptionToken(token) {
					const str = decryptString({key: SECRET_ENCRYPTION_KEY, value: token, algorithm: 'aes128'});
					return Number(str);
				}
			}
		}

		function sendResponse({error, verb, payload, nextOffset}) {
			if (res.headersSent) {
				return;
			}

			if (error) {
				res.send(generateErrorResponse({error, verb}));
			} else {
				const resumptionToken = Number.isNaN(nextOffset) ? generateResumptionToken(nextOffset) : undefined;

				switch (verb) {
					case 'ListRecords':
						res.send(generateListRecordsResponse({verb, records: payload, resumptionToken}));
						break;
					default:
						break;
				}
			}

			function generateResumptionToken(offset) {
				return encryptString({key: SECRET_ENCRYPTION_KEY, value: String(offset), algorithm: 'aes128'});
			}
		}
	}

	async function handleError(err, req, res, next) {
		if (res.headersSent) {
			return next(err);
		}

		res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
		handleTermination({code: -1, message: err.stack});
	}
}
