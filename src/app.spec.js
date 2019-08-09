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
import fixtureFactory from '@natlibfi/fixura';
import chai, {expect} from 'chai';
import chaiHttp from 'chai-http';
import oracledbMockFactory from './oracledb-mock';
import startApp, {__RewireAPI__ as RewireAPI} from './app'; // eslint-disable-line import/named

chai.use(chaiHttp);

describe('app', () => {
	let requester;

	const fixturesPath = [__dirname, '..', 'test-fixtures'];
	const {getFixture} = fixtureFactory({root: fixturesPath});

	beforeEach(async () => {
		RewireAPI.__Rewire__('oracledb', oracledbMockFactory());

		const httpPort = 1337;
		const secretEncryptionKey = 'foo';

		const instanceUrl = `http://localhost:${httpPort}`;
		const identifierPrefix = 'oai:foo.bar';
		const maxResults = 10;
		const resumptionTokenTimeout = 500;

		const oracleUsername = 'foo';
		const oraclePassword = 'bar';
		const oracleConnectString = 'BAR';

		const app = await startApp({
			httpPort, secretEncryptionKey, instanceUrl,
			identifierPrefix, maxResults, resumptionTokenTimeout,
			oracleUsername, oraclePassword, oracleConnectString
		});

		requester = chai.request(app).keepOpen();
	});

	afterEach(async () => {
		await requester.close();
		RewireAPI.__ResetDependency__('oracledb');
	});

	it('Shouldn\'t find the resource', async () => {
		const response = await requester.get('/foo');
		expect(response).to.have.status(HttpStatus.NOT_FOUND);
	});

	describe('bib', () => {
		describe('unprivileged', () => {
			describe.skip('GetRecord');
			describe.skip('Identify');
			describe.skip('ListIdentifiers');
			describe.skip('ListMetadataFormats');
			describe.skip('ListRecords');
			describe.skip('ListSets');
		});

		describe('privileged', () => {
			it('Shouldn\'t accept the expected payload content type', async () => {
				const response = await requester.get('/bibprv').set('Accept', 'application/json');
				expect(response).to.have.status(HttpStatus.NOT_ACCEPTABLE);
			});

			it('Should return an error because of a bad verb', async () => {
				const expectedPayload = getFixture(['bib', 'privileged', 'badVerbResponse.xml']);
				const response = await requester.get('/bibprv?verb=foo');

				expect(response).to.have.status(HttpStatus.OK);
				expect(response.body).to.equal(expectedPayload);
			});

			describe.skip('GetRecord');
			describe.skip('Identify');
			describe.skip('ListIdentifiers');
			describe.skip('ListMetadataFormats');

			describe('ListRecords', () => {
				it.skip('TESTING', async (index = '0') => {
					const expectedPayload = getFixture(['bib', 'privileged', 'ListRecords', index, 'expectedPayload.xml']);
					const response = await requester.get('/?verb=ListRecords');

					expect(response).to.have.status(HttpStatus.OK);
					expect(response.body).to.equal(expectedPayload);
				});

				/* It('Should fail because the resource does not exist', async () => {
					const response = await requester.get(`${requestPath}/foo`);
					expect(response).to.have.status(HttpStatus.NOT_FOUND);
				}); */

				/* async function init(index, getFixtures = false) {
					await mongoFixtures.populate(['read', index, 'dbContents.json']);
					if (getFixtures) {
						return {
							expectedPayload: getFixture({components: ['read', index, 'expectedPayload.json'], reader: READERS.JSON})
						};
					}
				} */
			});

			describe.skip('ListSets');
		});
	});

	describe('aut-names', () => {
		describe('unprivileged', () => {
			it.skip('Should return an error because of a bad verb');

			describe.skip('GetRecord');
			describe.skip('Identify');
			describe.skip('ListIdentifiers');
			describe.skip('ListMetadataFormats');
			describe.skip('ListRecords');
			describe.skip('ListSets');
		});

		describe('privileged', () => {
			it.skip('Should return an error because of a bad verb');

			describe.skip('GetRecord');
			describe.skip('Identify');
			describe.skip('ListIdentifiers');
			describe.skip('ListMetadataFormats');
			describe.skip('ListRecords');
			describe.skip('ListSets');
		});
	});

	describe('aut-subjects', () => {
		describe('unprivileged', () => {
			it.skip('Should return an error because of a bad verb');

			describe.skip('GetRecord');
			describe.skip('Identify');
			describe.skip('ListIdentifiers');
			describe.skip('ListMetadataFormats');
			describe.skip('ListRecords');
			describe.skip('ListSets');
		});

		describe('privileged', () => {
			it.skip('Should return an error because of a bad verb');

			describe.skip('GetRecord');
			describe.skip('Identify');
			describe.skip('ListIdentifiers');
			describe.skip('ListMetadataFormats');
			describe.skip('ListRecords');
			describe.skip('ListSets');
		});
	});
});
