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
import {MarcRecord} from '@natlibfi/marc-record';
import {Utils} from '@natlibfi/melinda-commons';
import {bibFactory, autNamesFactory, autSubjectsFactory} from './middlewares';
import IndexingError from './indexing-error';

export default async function ({
	identifierPrefix, httpPort, enableProxy, name, supportEmail,
	secretEncryptionKey, resumptionTokenTimeout, maxResults,
	oracleUsername, oraclePassword, oracleConnectString, instanceUrl,
	alephBibLibrary, alephAutNamesLibrary, alephAutSubjectsLibrary
}) {
	setOracleOptions();

	// Disable all validation because invalid records shouldn't crash the app
	MarcRecord.setValidationOptions({
		fields: false,
		subfields: false,
		subfieldValues: false
	});

	const {createLogger, createExpressLogger} = Utils;
	const logger = createLogger();
	const app = express();

	logger.log('debug', 'Establishing connection to database...');

	const pool = await oracledb.createPool({
		user: oracleUsername, password: oraclePassword,
		connectString: oracleConnectString
	});

	logger.log('debug', 'Connected to database!');

	const {
		bib,
		autNames,
		autSubjects
	} = await getMiddlewares();

	if (enableProxy) {
		app.enable('trust proxy', true);
	}

	app.use(createExpressLogger({
		msg: '{{req.ip}} HTTP {{req.method}} {{req.url}} - {{res.statusCode}} {{res.responseTime}}ms'
	}));

	app.get('/bib', bib);
	app.get('/aut-names', autNames);
	app.get('/aut-subjects', autSubjects);

	app.use(handleError);

	const server = app.listen(httpPort, () => logger.log('info', 'Started Melinda OAI-PMH provider'));

	server.on('close', async () => {
		console.log('CLOSE CALLBACK');
		await pool.close(0);
	});

	return server;

	function setOracleOptions() {
		oracledb.outFormat = oracledb.OBJECT;
		oracledb.fetchArraySize = maxResults;
		oracledb.poolTimeout = 20;
		oracledb.events = false;
		oracledb.poolPingInterval = 10;
	}

	async function getMiddlewares() {
		const connection = await pool.getConnection();

		const params = {
			pool, httpPort, enableProxy, name, supportEmail,
			secretEncryptionKey, resumptionTokenTimeout, identifierPrefix,
			instanceUrl, maxResults,
			oracleUsername, oraclePassword, oracleConnectString,
			connection
		};

		const middlewares = {
			bib: await bibFactory({...params, library: alephBibLibrary}),
			autNames: await autNamesFactory({...params, library: alephAutNamesLibrary}),
			autSubjects: await autSubjectsFactory({...params, library: alephAutSubjectsLibrary})
		};

		await connection.close();
		return middlewares;
	}

	async function handleError(err, req, res, next) { // eslint-disable-line no-unused-vars
		const {INTERNAL_SERVER_ERROR, SERVICE_UNAVAILABLE} = HttpStatus;

		// Certain Oracle errors don't matter if the request was closed by the client
		if (err.message && err.message.startsWith('NJS-018:') && req.aborted) {
			return next();
		}

		if (err instanceof IndexingError) {
			res.sendStatus(SERVICE_UNAVAILABLE);
			logger.log('error', err.stack);
			return next();
		}

		res.sendStatus(INTERNAL_SERVER_ERROR);
		throw err;
	}
}
