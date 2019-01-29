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
import {Utils} from '@natlibfi/melinda-commons';
import {XMLSerializer, DOMParser} from 'xmldom';
import {ERRORS, XML_DOCUMENT} from './constants';

// Const {createLogger, createExpressLogger, encryptString, decryptString} = Utils;
const {createLogger, createExpressLogger, decryptString} = Utils;

import {
	HTTP_PORT, ENABLE_PROXY, SECRET_ENCRYPTION_KEY,
	ORACLE_USERNAME, ORACLE_PASSWORD, ORACLE_CONNECT_STRING
} from './config';

export default async function ({listRecords}) {
	oracledb.outFormat = oracledb.OBJECT;

	let server;
	const pool = await oracledb.createPool({
		user: ORACLE_USERNAME, password: ORACLE_PASSWORD,
		connectString: ORACLE_CONNECT_STRING

	});

	process.on('SIGTERM', handleSignal);
	process.on('SIGINT', handleSignal);
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
				sendResponse(Object.assign({verb: 'ListRecords'}, await callMethod(listRecords)));
				break;
			default:
				sendResponse({error: ERRORS.BAD_VERB});
				break;
		}

		async function callMethod(cb, useDb = true) {
			if (useDb) {
				const params = await getParams();

				//  Error in parameters;
				if (res.headersSent) {
					return;
				}

				params.connection = await pool.getConnection();

				try {
					return await cb(params);
				} finally {
					await params.connection.close();
				}
			}

			const params = await getParams();

			//  Error in parameters;
			if (res.headersSent) {
				return;
			}

			return cb(params);

			async function getParams() {
				const {verb} = req.query;
				const params = {};

				Object.keys(req.query).forEach(key => {
					switch (key) {
						case 'verb':
							break;
						case 'from':
							params.from = parseDatestamp(req.query.from);
							break;
						case 'until':
							params.until = parseDatestamp(req.query.until);
							break;
						case 'set':
							params.set = req.query.set;
							break;
						case 'resumptionToken':
							try {
								params.offset = parseResumptionToken(req.query.resumptionToken);
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

				return params;

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

				/* Function generateResumptionToken(offset) {
					return encryptString({key: SECRET_ENCRYPTION_KEY, value: String(offset), algorithm: 'aes128'});
				} */
			}
		}

		function sendResponse({error, verb}) {
			if (res.headersSent) {
				return;
			}

			const document = new DOMParser().parseFromString(XML_DOCUMENT);
			const root = document.documentElement;

			if (error) {
				const responseElement = document.createElement('response');
				const errorElement = document.createElement('error');

				responseElement.textContent = moment().toISOString(true);
				errorElement.setAttribute('code', error);

				root.appendChild(responseElement);
				root.appendChild(errorElement);

				if (verb) {
					const requestElement = document.getElementsByTagName('request').item(0);
					requestElement.setAttribute('verb', verb);
				}
			}

			res.send(new XMLSerializer().serializeToString(document));
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
