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

export default async function ({
	identifierPrefix, httpPort, enableProxy, name, supportEmail,
	secretEncryptionKey, resumptionTokenTimeout, maxResults,
	oracleUsername, oraclePassword, oracleConnectString, instanceUrl,
	z106Library, z115Library
}) {
	MarcRecord.setValidationOptions({subfieldValues: false});
	oracledb.outFormat = oracledb.OBJECT;

	const {createLogger, createExpressLogger} = Utils;
	const logger = createLogger();
	const app = express();

	const pool = await oracledb.createPool({
		user: oracleUsername, password: oraclePassword,
		connectString: oracleConnectString
	});

	const {
		bib,
		bibPrivileged,
		autNames,
		autPrivilegedNames,
		autSubjects,
		autPrivilegedSubjects
	} = getMiddlewares(pool);

	if (enableProxy) {
		app.enable('trust proxy', true);
	}

	app.use(createExpressLogger());

	app.get('/bib', bib);
	app.get('/bibprv', bibPrivileged);

	app.get('/aut-names', autNames);
	app.get('/autprv-names', autPrivilegedNames);

	app.get('/aut-subjects', autSubjects);
	app.get('/autprv-subjects', autPrivilegedSubjects);

	app.use(handleError);

	const server = app.listen(httpPort, () => logger.log('info', 'Started Melinda OAI-PMH provider'));
	server.on('close', async () => pool.close(2));

	return server;

	function getMiddlewares(pool) {
		const params = {
			pool, httpPort, enableProxy, name, supportEmail,
			secretEncryptionKey, resumptionTokenTimeout, identifierPrefix,
			instanceUrl, maxResults,
			oracleUsername, oraclePassword, oracleConnectString,
			z106Library
		};

		return {
			bib: bibFactory({...params, z115Library}),
			bibPrivileged: bibFactory({...params, z115Library, privileged: true}),
			autNames: autNamesFactory(params),
			autPrivilegedNames: autNamesFactory({...params, privileged: true}),
			autSubjects: autSubjectsFactory(params),
			autPrivilegedSubjects: autSubjectsFactory({...params, privileged: true})
		};
	}

	async function handleError(err, req, res, next) { // eslint-disable-line no-unused-vars		
		res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
		logger.log('error', err.stack);
	}
}
