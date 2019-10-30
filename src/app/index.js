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
import oracledb from 'oracledb';
import HttpStatus from 'http-status';
import {Utils} from '@natlibfi/melinda-commons';
import createMiddleware from './middleware';

export default async function ({
	httpPort, enableProxy,
	oracleUsername, oraclePassword, oracleConnectString,
	...middlewareParams
}) {
	const {createLogger, createExpressLogger} = Utils;
	const logger = createLogger();

	const pool = await initOracle();
	const server = await initExpress();

	server.on('close', async () => {
		await pool.close(0);
	});

	return server;

	async function initOracle() {
		setOracleOptions();

		logger.log('debug', 'Establishing connection to database...');

		const pool = await oracledb.createPool({
			user: oracleUsername, password: oraclePassword,
			connectString: oracleConnectString
		});

		logger.log('debug', 'Connected to database!');

		return pool;

		function setOracleOptions() {
			oracledb.outFormat = oracledb.OBJECT;
			oracledb.poolTimeout = 20;
			oracledb.events = false;
			oracledb.poolPingInterval = 10;
		}
	}

	async function initExpress() {
		const app = express();

		if (enableProxy) {
			app.enable('trust proxy', true);
		}

		app.use(createExpressLogger({
			msg: '{{req.ip}} HTTP {{req.method}} {{req.url}} - {{res.statusCode}} {{res.responseTime}}ms'
		}));

		app.get('/', await createMiddleware({...middlewareParams, pool}));

		app.use(handleError);

		return app.listen(httpPort, () => logger.log('info', 'Started Melinda OAI-PMH provider'));

		async function handleError(err, req, res, next) { // eslint-disable-line no-unused-vars
			// The correct way would be to throw if the error is unexpected...There is a race condition between the request aborted event handler and running async function.
			if (req.aborted) {
				res.sendStatus(HttpStatus.REQUEST_TIMEOUT);
				return;
			}
			/*
			Const ORACLE_ERR_IGNORE_PATTERN = /^(NJS-018|NJS-003|ORA-01013):/;

			// Certain Oracle errors don't matter if the request was closed by the client
			if (err.message && ORACLE_ERR_IGNORE_PATTERN.test(err.message) && req.aborted) {
				res.sendStatus(HttpStatus.REQUEST_TIMEOUT);
				return;
			} */

			res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
			throw err;
		}
	}
}
