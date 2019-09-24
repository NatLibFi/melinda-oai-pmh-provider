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

import chai from 'chai';
import chaiHttp from 'chai-http';

import HttpStatus from 'http-status';
import jsonpath from 'jsonpath';
import {expect} from 'chai';
import {readdirSync} from 'fs';
import {join as joinPath} from 'path';
import fixtureFactory, {READERS} from '@natlibfi/fixura';
import {Parser as XMLParser, Builder as XMLBuilder} from 'xml2js';
import {MarcRecord} from '@natlibfi/marc-record';
import {formatRecord} from './record';
import startApp, {__RewireAPI__ as RewireAPI} from './app'; // eslint-disable-line import/named
import oracledbMockFactory from './oracledb-mock';

chai.use(chaiHttp);

export default ({rootPath}) => {
	let requester;
	const oracledbMock = oracledbMockFactory();

	RewireAPI.__Rewire__('oracledb', oracledbMock);

	after(() => {
		RewireAPI.__ResetDependency__('oracledb');
	});

	afterEach(async () => {
		await requester.close();
		oracledbMock._clear();
	});

	return (...args) => {
		return async () => {
			const dir = rootPath.concat(args);
			const {getFixture} = fixtureFactory({root: dir});
			const subDirs = readdirSync(joinPath.apply(undefined, dir));

			return iterate();

			async function iterate() {
				const sub = subDirs.shift();

				if (sub) {
					const {descr, skip, expectedPayload, requestUrl, dbResults} = getData(sub);

					if (skip) {
						it.skip(`${sub} ${descr}`);
					} else {
						it(`${sub} ${descr}`, async () => {
							// Const {requester, oracledbMock} = getInterfaces();

							if (dbResults) {
								// OracledbMock._execute([{results: dbResults}]);
								oracledbMock._execute(dbResults.map(results => ({results})));
							}

							//
							const httpPort = 1337;
							const secretEncryptionKey = 'yuKf7ly1xml33H5+fThvzhdY4XlFMJwQ';

							const supportEmail = 'foo@fu.bar';
							const instanceUrl = `http://localhost:${httpPort}`;
							const identifierPrefix = 'oai:foo.bar';
							const maxResults = 5;
							// Tests will break in the 4th millennium
							const resumptionTokenTimeout = 31536000000000;
							const oracleUsername = 'foo';
							const oraclePassword = 'bar';
							const oracleConnectString = 'BAR';
							const alephLibrary = 'foo1';

							const app = await startApp({
								httpPort, secretEncryptionKey, instanceUrl,
								supportEmail, identifierPrefix,
								maxResults, resumptionTokenTimeout,
								oracleUsername, oraclePassword, oracleConnectString,
								alephLibrary
							});

							requester = chai.request(app).keepOpen();
							//

							const response = await requester.get(requestUrl).buffer(true);
							expect(response).to.have.status(HttpStatus.OK);

							const formattedResponse = await formatResponse(response.text);
							// Console.log(formattedResponse);
							// console.log(expectedPayload);
							expect(formattedResponse).to.equal(expectedPayload);
						});
					}

					iterate();
				}

				function getData(subDir) {
					const {descr, requestUrl, skip} = getFixture({
						components: [subDir, 'metadata.json'],
						reader: READERS.JSON
					});

					if (skip) {
						return {descr, skip};
					}

					const expectedPayload = getFixture([subDir, 'expectedPayload.xml']);

					try {
						const dbResults = getFixture({
							components: [subDir, 'dbResults.json'],
							reader: READERS.JSON
						});

						return {
							expectedPayload, descr, requestUrl,
							dbResults: formatDbResults(dbResults)
						};
					} catch (err) {
						if (err.code === 'ENOENT') {
							return {expectedPayload, descr, requestUrl};
						}

						throw err;
					}
				}
			}

			async function formatResponse(xml) {
				const obj = await new Promise((resolve, reject) => {
					new XMLParser({attrkey: '_attr'}).parseString(xml, (err, obj) => {
						if (err) {
							reject(err);
						} else {
							resolve(obj);
						}
					});
				});

				const timestamp = '2000-01-01T00:00:00Z';

				jsonpath.apply(obj, '$..responseDate', () => timestamp);
				jsonpath.apply(obj, '$..datestamp', () => timestamp);
				jsonpath.apply(obj, '$..expirationDate', () => timestamp);
				jsonpath.apply(obj, '$..earliestTimestamp', () => timestamp);

				jsonpath.apply(obj, '$..resumptionToken[:1]', () => ({
					_: 'foo',
					_attr: {expirationDate: timestamp}
				}));

				return new XMLBuilder({
					attrkey: '_attr',
					xmldec: {
						version: '1.0',
						encoding: 'UTF-8',
						standalone: false
					},
					renderOpts: {
						pretty: true,
						indent: '\t'
					}
				}).buildObject(obj);
			}

			function formatDbResults(results) {
				return results.map(set => {
					return set.map(row => {
						if ('RECORD' in row) {
							return {...row, RECORD: formatRecord(new MarcRecord(row.RECORD))};
						}

						return row;
					});
				});
			}
		};
	};
};
