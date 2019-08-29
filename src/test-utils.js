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
import {expect} from 'chai';
import {readdirSync} from 'fs';
import {join as joinPath} from 'path';
import fixtureFactory, {READERS} from '@natlibfi/fixura';
import {Parser as XMLParser, Builder as XMLBuilder} from 'xml2js';
import {MarcRecord} from '@natlibfi/marc-record';
import moment from 'moment';
import {formatRecord} from './record';

export default ({rootPath, getInterfaces}) => {
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
							const {requester, oracledbMock} = getInterfaces();

							if (dbResults) {
								oracledbMock._execute([{
									results: dbResults
								}]);
							}

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
					new XMLParser().parseString(xml, (err, obj) => {
						if (err) {
							reject(err);
						} else {
							resolve(obj);
						}
					});
				});

				obj['OAI-PMH'].responseDate[0] = moment.utc('2000-01-01T00:00:00').format();

				const resumptionTokenElem = getResumptionTokenElem();

				function getResumptionTokenElem() {
					const elem = Object.values(obj['OAI-PMH']).find(o => {
						return typeof o[0] === 'object' && 'resumptionToken' in o[0];
					});

					return elem ? elem[0].resumptionToken : undefined;
				}

				if (resumptionTokenElem) {
					resumptionTokenElem[0].$.expirationDate = moment.utc('2000-01-01T00:00:00').format();
					resumptionTokenElem[0]._ = 'foo';
				}

				if ('Identify' in obj['OAI-PMH']) {
					obj['OAI-PMH'].Identify[0].earliestTimestamp[0] = moment.utc('2000-01-01T00:00:00').format();
				}

				return new XMLBuilder({
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
						if ('DATA' in row) {
							return {...row, DATA: formatRecord(new MarcRecord(row.DATA))};
						}

						return row;
					});
				});
			}
		};
	};
};
